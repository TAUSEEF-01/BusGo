from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from typing import List
from uuid import UUID
from datetime import datetime, timezone
import asyncio
import logging

from database import get_db
from models.models import Payment, PaymentStatus, Refund, RefundStatus
from schemas.schemas import (InitiateRequest, InitiateResponse, CallbackRequest, 
                             PaymentResponse, RefundRequest, RefundResponse)
from api.deps import get_current_user_payload
from services.booking_client import BookingClient
from services.bank_client import BankClient
from services.gateway import MockGateway

import sys
import os
sys.path.append(os.path.join(os.path.dirname(__file__), '..', '..', '..'))
from shared.base_response import BaseResponse
from shared.enums import PaymentMethod
from shared.kafka_producer import KafkaProducerClient

router = APIRouter(tags=["payments"])

@router.post("/mock/simulate-failure", response_model=BaseResponse)
async def toggle_simulate_failure(fail: bool):
    MockGateway.set_simulate_failure(fail)
    return BaseResponse(success=True, message=f"Simulate failure set to {fail}")

@router.post("/initiate", response_model=BaseResponse[InitiateResponse])
async def initiate_payment(req: InitiateRequest, request: Request, db: AsyncSession = Depends(get_db), payload: dict = Depends(get_current_user_payload)):
    user_id = payload.get("user_id")

    # A transit journey pays for all its legs at once. The payment record is
    # keyed by the journey id (ref_id) so failure/refund events resolve to it.
    ref_id = str(req.journey_id) if req.journey_id else str(req.booking_id)

    # Fraud Detection 1: Amount mismatch
    auth_header = request.headers.get("Authorization", "").replace("Bearer ", "")
    if req.journey_id:
        booking = await BookingClient.get_journey(str(req.journey_id), auth_header)
    else:
        booking = await BookingClient.get_booking(str(req.booking_id), auth_header)
    if not booking:
        raise HTTPException(status_code=503, detail="Booking verification is temporarily unavailable. No payment was taken.")

    actual_fare = float(booking.get("total_fare", 0)) - float(booking.get("discount_amount", 0))
    if abs(actual_fare - req.amount) > 0.01: # allow tiny float diff
        await KafkaProducerClient.publish("audit.log", {
            "event": "fraud.detected", "user_id": user_id, "reason": "Amount mismatch", "booking_id": ref_id
        })
        raise HTTPException(status_code=400, detail="Payment amount does not match booking fare")

    # A retry after a lost HTTP response must return the original successful
    # payment instead of debiting the account a second time.
    existing_result = await db.execute(select(Payment).where(
        Payment.booking_id == ref_id,
        Payment.user_id == user_id,
        Payment.status == PaymentStatus.COMPLETED,
    ).order_by(Payment.completed_at.desc()))
    existing = existing_result.scalars().first()
    if existing:
        await KafkaProducerClient.publish("payment.completed", {
            "booking_id": ref_id,
            "payment_id": str(existing.id),
            "timestamp": existing.completed_at.isoformat() if existing.completed_at else datetime.now(timezone.utc).isoformat(),
        })
        return BaseResponse(success=True, data=InitiateResponse(
            payment_id=existing.id,
            redirect_url=MockGateway.get_redirect_url(str(existing.id), existing.method),
        ), message="Existing completed payment returned")

    # Fraud Detection 2: Multiple attempts
    trip_id = booking.get("trip_id", str(req.trip_id))
    attempts_query = select(Payment).where(Payment.user_id == user_id, Payment.trip_id == trip_id)
    attempts_res = await db.execute(attempts_query)
    attempts = len(attempts_res.scalars().all())
    
    if attempts >= 3:
        await KafkaProducerClient.publish("audit.log", {
            "event": "fraud.detected", "user_id": user_id, "reason": "Max payment attempts exceeded", "trip_id": trip_id
        })
        # Definitive failure: release the held seats so other users aren't blocked.
        await KafkaProducerClient.publish("payment.failed", {
            "booking_id": ref_id, "trip_id": str(trip_id), "reason": "max_attempts_exceeded"
        })
        raise HTTPException(status_code=403, detail="Maximum payment attempts exceeded for this trip")

    # Verify funds and debit the user's bank/mobile account via bank-service.
    method_value = req.method.value if hasattr(req.method, "value") else str(req.method)
    bank_result = await BankClient.verify_debit(
        user_id=str(user_id),
        amount=float(req.amount),
        method=method_value,
        reference=ref_id,
        mobile_number=req.mobile_number,
        pin=req.pin,
    )
    if not bank_result.get("success"):
        await KafkaProducerClient.publish("audit.log", {
            "event": "payment.declined", "user_id": user_id,
            "reason": bank_result.get("message"), "booking_id": ref_id
        })
        # Payment declined (insufficient balance / bad PIN): free the held seats
        # immediately so they're available to other users right away.
        await KafkaProducerClient.publish("payment.failed", {
            "booking_id": ref_id, "trip_id": str(trip_id), "reason": "payment_declined"
        })
        raise HTTPException(status_code=402, detail=bank_result.get("message", "Insufficient balance"))

    try:
        payment = Payment(
            booking_id=ref_id,
            user_id=user_id,
            trip_id=trip_id,
            amount=req.amount,
            method=req.method,
            # The bundled gateway is synchronous: a successful bank-service
            # debit means payment is complete before this response is returned.
            status=PaymentStatus.COMPLETED,
            completed_at=datetime.now(timezone.utc),
        )
        db.add(payment)
        await db.commit()
        await db.refresh(payment)
    except Exception as db_err:
        logging.error(f"Payment record save failed for booking {req.booking_id}: {db_err}")
        # Debit already went through — credit it back so the user isn't charged.
        await BankClient.rollback_debit(
            user_id=str(user_id),
            amount=float(req.amount),
            method=method_value,
            reference=ref_id,
        )
        # Release the held seats since this payment could not be recorded.
        await KafkaProducerClient.publish("payment.failed", {
            "booking_id": ref_id, "trip_id": str(trip_id), "reason": "payment_record_failed"
        })
        raise HTTPException(status_code=500, detail="Payment could not be processed. Your account has not been charged. Please try again.")

    redirect_url = MockGateway.get_redirect_url(str(payment.id), req.method)

    await KafkaProducerClient.publish("payment.completed", {
        "booking_id": ref_id,
        "payment_id": str(payment.id),
        "timestamp": payment.completed_at.isoformat(),
    })
    await KafkaProducerClient.publish("audit.log", {
        "event": "payment.completed",
        "payment_id": str(payment.id),
        "user_id": str(user_id),
    })

    return BaseResponse(success=True, data=InitiateResponse(payment_id=payment.id, redirect_url=redirect_url))

@router.post("/{gateway}/callback", response_model=BaseResponse)
async def payment_callback(gateway: str, payment_id: UUID, req: CallbackRequest, db: AsyncSession = Depends(get_db)):
    # This acts as webhook catcher (e.g. /payments/bkash/callback?payment_id=...)
    query = select(Payment).where(Payment.id == payment_id)
    result = await db.execute(query)
    payment = result.scalars().first()
    
    if not payment:
        raise HTTPException(status_code=404, detail="Payment not found")

    await asyncio.sleep(2) # Mock 2 sec processing delay

    if req.status.upper() == "SUCCESS" and not MockGateway._simulate_failure:
        payment.status = PaymentStatus.COMPLETED
        payment.gateway_transaction_id = req.gateway_transaction_id
        payment.completed_at = datetime.now(timezone.utc)
        payment.gateway_response = req.response_data
        
        await db.commit()
        
        await KafkaProducerClient.publish("payment.completed", {
            "booking_id": str(payment.booking_id),
            "payment_id": str(payment.id),
            "timestamp": datetime.now(timezone.utc).isoformat()
        })
        await KafkaProducerClient.publish("audit.log", {
            "event": "payment.completed", "payment_id": str(payment.id)
        })
        return BaseResponse(success=True, message="Payment completed")
    else:
        payment.status = PaymentStatus.FAILED
        payment.gateway_response = req.response_data
        await db.commit()
        # Gateway declined: release the held seats immediately for other users.
        await KafkaProducerClient.publish("payment.failed", {
            "booking_id": str(payment.booking_id), "trip_id": str(payment.trip_id), "reason": "gateway_failed"
        })
        return BaseResponse(success=False, message="Payment failed")

@router.get("/my", response_model=BaseResponse[List[PaymentResponse]])
async def get_my_payments(db: AsyncSession = Depends(get_db), payload: dict = Depends(get_current_user_payload)):
    user_id = payload.get("user_id")
    if not user_id or user_id == "system":
        raise HTTPException(status_code=401, detail="Unauthorized")
    result = await db.execute(select(Payment).where(Payment.user_id == user_id).order_by(Payment.initiated_at.desc()))
    payments = result.scalars().all()
    return BaseResponse(success=True, data=[PaymentResponse.model_validate(p) for p in payments])

@router.get("/{payment_id}", response_model=BaseResponse[PaymentResponse])
async def get_payment(payment_id: UUID, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Payment).where(Payment.id == payment_id))
    payment = result.scalars().first()
    if not payment:
        raise HTTPException(status_code=404, detail="Payment not found")
    return BaseResponse(success=True, data=PaymentResponse.model_validate(payment))

@router.get("/booking/{booking_id}", response_model=BaseResponse[List[PaymentResponse]])
async def get_booking_payments(booking_id: UUID, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Payment).where(Payment.booking_id == booking_id))
    payments = result.scalars().all()
    return BaseResponse(success=True, data=[PaymentResponse.model_validate(p) for p in payments])

@router.post("/{payment_id}/refund", response_model=BaseResponse[RefundResponse])
async def process_refund(payment_id: UUID, req: RefundRequest, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Payment).where(Payment.id == payment_id))
    payment = result.scalars().first()
    
    if not payment or payment.status != PaymentStatus.COMPLETED:
        raise HTTPException(status_code=400, detail="Valid completed payment required for refund")

    est_days = 5 if payment.method in [PaymentMethod.BKASH, PaymentMethod.NAGAD] else 7
    
    refund = Refund(
        payment_id=payment.id,
        booking_id=payment.booking_id,
        amount=payment.amount,
        reason=req.reason,
        status=RefundStatus.PROCESSING,
        estimated_days=est_days
    )
    db.add(refund)
    await db.commit()
    await db.refresh(refund)

    # Mock gateway call
    gw_res = await MockGateway.process_refund(float(refund.amount), payment.method)
    
    if gw_res["success"]:
        refund.status = RefundStatus.COMPLETED
        refund.gateway_refund_id = gw_res["refund_id"]
        refund.completed_at = datetime.now(timezone.utc)
        payment.status = PaymentStatus.REFUNDED
        
        await KafkaProducerClient.publish("refund.initiated", {
            "refund_id": str(refund.id), "payment_id": str(payment.id), "booking_id": str(payment.booking_id)
        })
        await KafkaProducerClient.publish("audit.log", {
            "event": "refund.completed", "refund_id": str(refund.id)
        })
    else:
        refund.status = RefundStatus.FAILED
        
    await db.commit()
    
    return BaseResponse(success=gw_res["success"], data=RefundResponse.model_validate(refund))
