from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from typing import List
from uuid import UUID
from datetime import datetime, timedelta, timezone
import uuid

from database import get_db
from models.models import Booking, BookingStatusHistory
from schemas.schemas import BookingCreate, BookingResponse
from api.deps import get_current_user_payload
from services.redis_svc import RedisIdempotencyService
from services.external import ExternalServices

import sys
import os
sys.path.append(os.path.join(os.path.dirname(__file__), '..', '..', '..'))
from shared.base_response import BaseResponse
from shared.enums import BookingStatus
from shared.kafka_producer import KafkaProducerClient

router = APIRouter(tags=["bookings"])

@router.post("/", response_model=BaseResponse)
async def create_booking(req: BookingCreate, db: AsyncSession = Depends(get_db), payload: dict = Depends(get_current_user_payload)):
    # 1. Idempotency Check
    cached_resp = await RedisIdempotencyService.get_idempotency(req.idempotency_key)
    if cached_resp:
        return BaseResponse(success=True, data=cached_resp, message="Retrieved from cache")

    user_id = payload.get("user_id")

    # 2. Promo Validation
    discount = await ExternalServices.validate_promo(req.promo_code, req.total_fare, str(req.trip_id), str(user_id))
    
    # 3. Create Booking Record
    booking_id = uuid.uuid4()
    expires_at = datetime.now(timezone.utc) + timedelta(minutes=10)
    
    booking = Booking(
        id=booking_id,
        user_id=user_id,
        trip_id=req.trip_id,
        operator_id=req.operator_id,
        operator_name=req.operator_name,
        seat_numbers=req.seat_numbers,
        passenger_details=[p.model_dump() for p in req.passenger_details],
        boarding_point=req.boarding_point,
        dropping_point=req.dropping_point,
        journey_date=req.journey_date,
        departure_time=req.departure_time,
        total_fare=req.total_fare,
        discount_amount=discount,
        promo_code=req.promo_code,
        status=BookingStatus.SEAT_LOCKED,
        idempotency_key=req.idempotency_key,
        expires_at=expires_at
    )
    
    # 4. Lock Seats in Inventory
    try:
        await ExternalServices.lock_seats(str(req.trip_id), req.seat_numbers, str(booking_id), str(user_id))
    except Exception as e:
        import logging
        logging.error(f"Failed to lock seats in inventory: {str(e)}")
        raise HTTPException(status_code=400, detail="Failed to lock seats. They may already be booked or locked.")

    db.add(booking)
    history = BookingStatusHistory(booking_id=booking.id, from_status=BookingStatus.INITIATED, to_status=BookingStatus.SEAT_LOCKED, reason="Seats Locked Successfully")
    db.add(history)
    await db.commit()

    response_data = {
        "booking_id": str(booking.id),
        "expires_at": expires_at.isoformat(),
        "total_fare": float(booking.total_fare - booking.discount_amount)
    }

    # 5. Set Cache and Publish Events
    await RedisIdempotencyService.set_idempotency(req.idempotency_key, response_data)
    
    await KafkaProducerClient.publish("booking.created", response_data)
    await KafkaProducerClient.publish("audit.log", {"event": "booking.created", "booking_id": str(booking.id), "timestamp": datetime.now(timezone.utc).isoformat()})

    return BaseResponse(success=True, data=response_data, message="Booking created successfully")

@router.get("/my", response_model=BaseResponse[List[BookingResponse]])
async def get_my_bookings(skip: int = Query(0, ge=0), limit: int = Query(20, gt=0), db: AsyncSession = Depends(get_db), payload: dict = Depends(get_current_user_payload)):
    user_id = payload.get("user_id")
    query = select(Booking).where(Booking.user_id == user_id).order_by(Booking.created_at.desc()).offset(skip).limit(limit)
    result = await db.execute(query)
    bookings = result.scalars().all()
    return BaseResponse(success=True, data=[BookingResponse.model_validate(b) for b in bookings])

@router.get("/operator/{operator_id}", response_model=BaseResponse[List[BookingResponse]])
async def get_operator_bookings(operator_id: UUID, skip: int = Query(0, ge=0), limit: int = Query(20, gt=0), db: AsyncSession = Depends(get_db), payload: dict = Depends(get_current_user_payload)):
    # The user requested to see ALL bookings in the operator dashboard
    query = select(Booking).order_by(Booking.created_at.desc()).offset(skip).limit(limit)
    result = await db.execute(query)
    bookings = result.scalars().all()
    return BaseResponse(success=True, data=[BookingResponse.model_validate(b) for b in bookings])

@router.get("/{booking_id}", response_model=BaseResponse[BookingResponse])
async def get_booking(booking_id: UUID, db: AsyncSession = Depends(get_db), payload: dict = Depends(get_current_user_payload)):
    query = select(Booking).where(Booking.id == booking_id, Booking.user_id == payload.get("user_id"))
    result = await db.execute(query)
    booking = result.scalars().first()
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    return BaseResponse(success=True, data=BookingResponse.model_validate(booking))

@router.post("/{booking_id}/confirm-payment")
async def confirm_payment_internal(booking_id: UUID, payment_id: UUID, db: AsyncSession = Depends(get_db)):
    # Usually internal or heavily secured, maybe omit payload check for system communication.
    query = select(Booking).where(Booking.id == booking_id)
    result = await db.execute(query)
    booking = result.scalars().first()
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
        
    old_status = booking.status
    booking.status = BookingStatus.CONFIRMED
    booking.payment_id = payment_id
    
    history = BookingStatusHistory(booking_id=booking.id, from_status=old_status, to_status=booking.status, reason="Payment Configuration Endpoint")
    db.add(history)
    await db.commit()

    # Confirm seats in inventory service so they show as BOOKED
    try:
        await ExternalServices.confirm_seats(
            str(booking.trip_id),
            booking.seat_numbers,
            str(booking.id),
            str(booking.user_id)
        )
    except Exception as e:
        import logging
        logging.error(f"Failed to confirm seats in inventory: {str(e)}")

    await KafkaProducerClient.publish("ticket.issued", {
        "booking_id": str(booking.id),
        "user_id": str(booking.user_id),
        "trip_id": str(booking.trip_id)
    })
    
    return BaseResponse(success=True, message="Booking confirmed")

@router.post("/{booking_id}/cancel")
async def cancel_booking(booking_id: UUID, db: AsyncSession = Depends(get_db), payload: dict = Depends(get_current_user_payload)):
    query = select(Booking).where(Booking.id == booking_id, Booking.user_id == payload.get("user_id"))
    result = await db.execute(query)
    booking = result.scalars().first()
    
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    
    if booking.status in [BookingStatus.CANCELLED, BookingStatus.REFUNDED, BookingStatus.EXPIRED]:
        raise HTTPException(status_code=400, detail=f"Cannot cancel booking in {booking.status} status")
        
    # Cancellation rules go here (time checks etc)

    old_status = booking.status
    booking.status = BookingStatus.CANCELLED
    
    history = BookingStatusHistory(booking_id=booking.id, from_status=old_status, to_status=booking.status, reason="User Cancelled")
    db.add(history)
    await db.commit()

    await KafkaProducerClient.publish("booking.cancelled", {"booking_id": str(booking.id), "trip_id": str(booking.trip_id)})

    return BaseResponse(success=True, message="Booking cancelled successfully")
