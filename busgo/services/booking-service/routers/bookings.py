from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from typing import List
from uuid import UUID
from datetime import datetime, timedelta, timezone
import uuid

from database import get_db
from models.models import Booking, BookingStatusHistory
from schemas.schemas import BookingCreate, BookingResponse, ApplyPromoRequest
from api.deps import get_current_user_payload
from services.redis_svc import RedisIdempotencyService
from services.external import ExternalServices
from services.travel_records import record_travel
from services.ticket_events import build_ticket_event

import sys
import os
sys.path.append(os.path.join(os.path.dirname(__file__), '..', '..', '..'))
from shared.base_response import BaseResponse
from shared.enums import BookingStatus
from shared.kafka_producer import KafkaProducerClient

router = APIRouter(tags=["bookings"])
SERVICE_FEE = 20.0


def _valid_route_point(value: str, city: str, points: list) -> bool:
    selected = (value or "").strip().lower()
    allowed = {(city or "").strip().lower()}
    for point in points or []:
        if isinstance(point, dict):
            allowed.add(str(point.get("name", "")).strip().lower())
            allowed.add(str(point.get("address", "")).strip().lower())
    allowed.discard("")
    return selected in allowed

@router.post("/", response_model=BaseResponse)
async def create_booking(req: BookingCreate, db: AsyncSession = Depends(get_db), payload: dict = Depends(get_current_user_payload)):
    # 1. Idempotency Check
    cached_resp = await RedisIdempotencyService.get_idempotency(req.idempotency_key)
    if cached_resp:
        return BaseResponse(success=True, data=cached_resp, message="Retrieved from cache")

    user_id = payload.get("user_id")

    # Validate all client-supplied booking facts against operator-service. The
    # mobile/web clients display fares, but they are never trusted as the source
    # of truth for payment.
    if not req.seat_numbers or len(req.seat_numbers) > 4:
        raise HTTPException(status_code=400, detail="Select between 1 and 4 seats")
    if len(set(req.seat_numbers)) != len(req.seat_numbers):
        raise HTTPException(status_code=400, detail="Duplicate seats are not allowed")
    if len(req.passenger_details) != len(req.seat_numbers):
        raise HTTPException(status_code=400, detail="Enter details for every selected seat")
    passenger_seats = {passenger.seat for passenger in req.passenger_details}
    if passenger_seats != set(req.seat_numbers):
        raise HTTPException(status_code=400, detail="Passenger details do not match the selected seats")

    trip = await ExternalServices.get_trip(str(req.trip_id))
    if not trip:
        raise HTTPException(status_code=400, detail="This trip is no longer available")
    if str(trip.get("status", "")).upper() != "SCHEDULED":
        raise HTTPException(status_code=400, detail="This trip is not open for booking")
    if str(trip.get("operator_id")) != str(req.operator_id):
        raise HTTPException(status_code=400, detail="Operator information changed; refresh the trip")
    if not _valid_route_point(req.boarding_point, trip.get("origin_city", ""), trip.get("boarding_points", [])) or not _valid_route_point(
        req.dropping_point, trip.get("destination_city", ""), trip.get("dropping_points", [])
    ):
        raise HTTPException(status_code=400, detail="Boarding or destination information changed; refresh the trip")
    authoritative_total = round(float(trip.get("fare_amount", 0)) * len(req.seat_numbers) + SERVICE_FEE, 2)
    if abs(float(req.total_fare) - authoritative_total) > 0.01:
        raise HTTPException(status_code=400, detail="Fare changed; refresh the trip and try again")

    # 2. Promo Validation (only honour a valid promo's discount)
    promo_result = await ExternalServices.validate_promo(req.promo_code, req.total_fare, str(req.trip_id), str(user_id))
    discount = promo_result["discount_amount"] if promo_result.get("valid") else 0.0
    
    # 3. Create Booking Record
    booking_id = uuid.uuid4()
    expires_at = datetime.now(timezone.utc) + timedelta(minutes=10)
    
    # Exclude operator_name from the booking data as it's not in the model
    booking = Booking(
        id=booking_id,
        user_id=user_id,
        trip_id=req.trip_id,
        operator_id=req.operator_id,
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
        logging.error(f"Exception type: {type(e).__name__}")
        logging.error(f"Exception details: {repr(e)}")
        if hasattr(e, 'response'):
            logging.error(f"Response status: {e.response.status_code if hasattr(e.response, 'status_code') else 'N/A'}")
            logging.error(f"Response body: {e.response.text if hasattr(e.response, 'text') else 'N/A'}")
        raise HTTPException(status_code=400, detail=f"Failed to lock seats: {str(e)}")

    db.add(booking)
    history = BookingStatusHistory(booking_id=booking.id, from_status=BookingStatus.INITIATED, to_status=BookingStatus.SEAT_LOCKED, reason="Seats Locked Successfully")
    db.add(history)
    await db.commit()

    response_data = {
        "booking_id": str(booking.id),
        "user_id": str(booking.user_id),
        "trip_id": str(booking.trip_id),
        "operator_id": str(booking.operator_id) if booking.operator_id else None,
        "boarding_point": booking.boarding_point,
        "dropping_point": booking.dropping_point,
        "journey_date": booking.journey_date.isoformat() if booking.journey_date else None,
        "departure_time": booking.departure_time.isoformat() if booking.departure_time else None,
        "seat_numbers": booking.seat_numbers,
        "expires_at": expires_at.isoformat(),
        "total_fare": float(booking.total_fare - booking.discount_amount)
    }

    # 5. Set Cache and Publish Events
    await RedisIdempotencyService.set_idempotency(req.idempotency_key, response_data)
    
    await KafkaProducerClient.publish("booking.created", response_data)
    await KafkaProducerClient.publish("audit.log", {"event": "booking.created", "booking_id": str(booking.id), "timestamp": datetime.now(timezone.utc).isoformat()})

    return BaseResponse(success=True, data=response_data, message="Booking created successfully")

@router.post("/{booking_id}/apply-promo", response_model=BaseResponse)
async def apply_promo_to_booking(booking_id: UUID, req: ApplyPromoRequest, db: AsyncSession = Depends(get_db), payload: dict = Depends(get_current_user_payload)):
    """Validate a promo code against this booking and persist the discount so the
    amount due (and the payment-service fraud check) reflect the reduced fare.
    The promo is only *consumed* (counter decremented) on successful payment."""
    user_id = payload.get("user_id")
    query = select(Booking).where(Booking.id == booking_id, Booking.user_id == user_id)
    result = await db.execute(query)
    booking = result.scalars().first()
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")

    if booking.status != BookingStatus.SEAT_LOCKED:
        raise HTTPException(status_code=400, detail="Promo can only be applied before payment")

    promo_result = await ExternalServices.validate_promo(
        req.promo_code, float(booking.total_fare), str(booking.trip_id), str(user_id)
    )
    if not promo_result.get("valid"):
        raise HTTPException(status_code=400, detail=promo_result.get("message") or "Invalid promo code")

    discount = float(promo_result["discount_amount"])
    booking.discount_amount = discount
    booking.promo_code = req.promo_code.upper()
    await db.commit()

    final_fare = float(booking.total_fare) - discount
    return BaseResponse(success=True, data={
        "booking_id": str(booking.id),
        "promo_code": booking.promo_code,
        "total_fare": float(booking.total_fare),
        "discount_amount": discount,
        "final_fare": max(0.0, final_fare),
    }, message="Promo applied successfully")


@router.delete("/{booking_id}/apply-promo", response_model=BaseResponse)
async def remove_promo_from_booking(booking_id: UUID, db: AsyncSession = Depends(get_db), payload: dict = Depends(get_current_user_payload)):
    """Remove a previously applied (but not yet paid) promo from a booking."""
    user_id = payload.get("user_id")
    query = select(Booking).where(Booking.id == booking_id, Booking.user_id == user_id)
    result = await db.execute(query)
    booking = result.scalars().first()
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    if booking.status != BookingStatus.SEAT_LOCKED:
        raise HTTPException(status_code=400, detail="Promo can only be changed before payment")

    booking.discount_amount = 0.0
    booking.promo_code = None
    await db.commit()
    return BaseResponse(success=True, data={
        "booking_id": str(booking.id),
        "total_fare": float(booking.total_fare),
        "discount_amount": 0.0,
        "final_fare": float(booking.total_fare),
    }, message="Promo removed")


async def enrich_bookings_with_operator_names(bookings: List[Booking], db: AsyncSession) -> List[BookingResponse]:
    if not bookings:
        return []
    
    operator_names = {}
    trip_routes = {}
    import httpx
    import logging
    
    # Try fetching all operators via operator-service internal HTTP API
    try:
        async with httpx.AsyncClient() as client:
            res = await client.get("http://operator-service:8000/operators/", timeout=5.0)
            if res.status_code == 200:
                ops_list = res.json().get("data", [])
                for op in ops_list:
                    op_id = op.get("id")
                    op_name = op.get("name")
                    if op_id and op_name:
                        operator_names[op_id] = op_name
                        operator_names[str(op_id)] = op_name
    except Exception as e:
        logging.error(f"Error fetching all operators via HTTP: {e}")

    # Fallback to fetching individual operator if not found in list, and fetch trip details
    async with httpx.AsyncClient() as client:
        for b in bookings:
            b_op_id = str(b.operator_id)
            if b_op_id not in operator_names:
                try:
                    res = await client.get(f"http://operator-service:8000/operators/{b_op_id}", timeout=3.0)
                    if res.status_code == 200:
                        op_data = res.json().get("data", {})
                        op_name = op_data.get("name")
                        if op_name:
                            operator_names[b_op_id] = op_name
                except Exception as e:
                    logging.error(f"Error fetching operator {b_op_id} via HTTP: {e}")
            
            b_trip_id = str(b.trip_id)
            if b_trip_id not in trip_routes:
                try:
                    res = await client.get(f"http://operator-service:8000/trips/{b_trip_id}", timeout=3.0)
                    if res.status_code == 200:
                        trip_data = res.json().get("data", {})
                        origin = trip_data.get("origin_city")
                        dest = trip_data.get("destination_city")
                        if origin and dest:
                            trip_routes[b_trip_id] = (origin, dest)
                except Exception as e:
                    logging.error(f"Error fetching trip {b_trip_id} details via HTTP: {e}")
            
    response_data = []
    for b in bookings:
        resp = BookingResponse.model_validate(b)
        resp.operator_name = operator_names.get(b.operator_id, operator_names.get(str(b.operator_id), "Unknown Operator"))
        route_info = trip_routes.get(str(b.trip_id))
        if route_info:
            resp.origin_city = route_info[0]
            resp.destination_city = route_info[1]
        else:
            resp.origin_city = "Dhaka"
            resp.destination_city = "Destination"
        response_data.append(resp)
    return response_data

@router.get("/my", response_model=BaseResponse[List[BookingResponse]])
async def get_my_bookings(skip: int = Query(0, ge=0), limit: int = Query(20, gt=0), db: AsyncSession = Depends(get_db), payload: dict = Depends(get_current_user_payload)):
    user_id = payload.get("user_id")
    query = select(Booking).where(Booking.user_id == user_id).order_by(Booking.created_at.desc()).offset(skip).limit(limit)
    result = await db.execute(query)
    bookings = result.scalars().all()
    enriched = await enrich_bookings_with_operator_names(bookings, db)
    return BaseResponse(success=True, data=enriched)

@router.get("/operator/{operator_id}", response_model=BaseResponse[List[BookingResponse]])
async def get_operator_bookings(operator_id: UUID, skip: int = Query(0, ge=0), limit: int = Query(20, gt=0), db: AsyncSession = Depends(get_db), payload: dict = Depends(get_current_user_payload)):
    # Fetch bookings specifically for the given operator to ensure proper data isolation
    query = select(Booking).where(Booking.operator_id == operator_id).order_by(Booking.created_at.desc()).offset(skip).limit(limit)
    result = await db.execute(query)
    bookings = result.scalars().all()
    enriched = await enrich_bookings_with_operator_names(bookings, db)
    return BaseResponse(success=True, data=enriched)

@router.get("/trip/{trip_id}", response_model=BaseResponse[List[BookingResponse]])
async def get_trip_bookings(trip_id: UUID, db: AsyncSession = Depends(get_db)):
    query = select(Booking).where(Booking.trip_id == trip_id).order_by(Booking.created_at.desc())
    result = await db.execute(query)
    bookings = result.scalars().all()
    enriched = await enrich_bookings_with_operator_names(bookings, db)
    return BaseResponse(success=True, data=enriched)

@router.get("/{booking_id}", response_model=BaseResponse[BookingResponse])
async def get_booking(booking_id: UUID, db: AsyncSession = Depends(get_db), payload: dict = Depends(get_current_user_payload)):
    query = select(Booking).where(Booking.id == booking_id, Booking.user_id == payload.get("user_id"))
    result = await db.execute(query)
    booking = result.scalars().first()
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    enriched = await enrich_bookings_with_operator_names([booking], db)
    return BaseResponse(success=True, data=enriched[0])

@router.post("/{booking_id}/confirm-payment")
async def confirm_payment_internal(booking_id: UUID, payment_id: UUID = Query(...), db: AsyncSession = Depends(get_db), payload: dict = Depends(get_current_user_payload)):
    query = select(Booking).where(Booking.id == booking_id, Booking.user_id == payload.get("user_id"))
    result = await db.execute(query)
    booking = result.scalars().first()
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    if booking.status == BookingStatus.CONFIRMED:
        if str(booking.payment_id) != str(payment_id):
            raise HTTPException(status_code=409, detail="Booking was confirmed with another payment")
        return BaseResponse(success=True, message="Booking already confirmed")

    payment = await ExternalServices.get_payment(str(payment_id))
    expected_amount = round(float(booking.total_fare) - float(booking.discount_amount or 0), 2)
    if (
        str(payment.get("status", "")).upper() != "COMPLETED"
        or str(payment.get("booking_id")) != str(booking.id)
        or str(payment.get("user_id")) != str(booking.user_id)
        or abs(float(payment.get("amount", -1)) - expected_amount) > 0.01
    ):
        raise HTTPException(status_code=400, detail="A matching completed payment is required")

    old_status = booking.status
    booking.status = BookingStatus.CONFIRMED
    booking.payment_id = payment_id
    
    history = BookingStatusHistory(booking_id=booking.id, from_status=old_status, to_status=booking.status, reason="Payment Configuration Endpoint")
    db.add(history)
    await db.commit()

    # Consume the promo now that payment is confirmed: enforces one-use-per-user
    # and decrements the promo's remaining uses. Idempotent in deals-service, so
    # a duplicate confirm won't double-decrement.
    if booking.promo_code:
        try:
            await ExternalServices.consume_promo(booking.promo_code, str(booking.user_id))
        except Exception as e:
            import logging
            logging.error(f"Failed to consume promo for booking {booking.id}: {e}")

    # Track this journey in the user's travel record (drives re-marketing).
    await record_travel(db, booking)

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

    await KafkaProducerClient.publish("ticket.issued", await build_ticket_event(booking))
    
    return BaseResponse(success=True, message="Booking confirmed")

CANCELLATION_WINDOW_HOURS = 1
REFUND_PERCENTAGE = 0.80  # 80% refund, 20% cancellation fee


@router.get("/{booking_id}/cancellation-info")
async def cancellation_info(booking_id: UUID, db: AsyncSession = Depends(get_db), payload: dict = Depends(get_current_user_payload)):
    """Returns whether cancellation is still allowed and the expected refund amount."""
    query = select(Booking).where(Booking.id == booking_id, Booking.user_id == payload.get("user_id"))
    result = await db.execute(query)
    booking = result.scalars().first()
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")

    if booking.status != BookingStatus.CONFIRMED:
        return BaseResponse(success=True, data={
            "cancellable": False,
            "reason": f"Booking is {booking.status}",
            "refund_amount": 0,
            "window_expires_at": None,
        })

    payment_completed_at = await ExternalServices.get_payment_completed_at(str(booking.payment_id))
    if not payment_completed_at:
        return BaseResponse(success=True, data={
            "cancellable": False,
            "reason": "Payment record not found",
            "refund_amount": 0,
            "window_expires_at": None,
        })

    window_expires_at = payment_completed_at + timedelta(hours=CANCELLATION_WINDOW_HOURS)
    now = datetime.now(timezone.utc)
    cancellable = now < window_expires_at
    refund_amount = float(booking.total_fare) * REFUND_PERCENTAGE if cancellable else 0

    return BaseResponse(success=True, data={
        "cancellable": cancellable,
        "reason": None if cancellable else f"Cancellation window of {CANCELLATION_WINDOW_HOURS}h has expired",
        "refund_amount": round(refund_amount, 2),
        "window_expires_at": window_expires_at.isoformat(),
        "refund_percentage": int(REFUND_PERCENTAGE * 100),
    })


@router.post("/{booking_id}/cancel")
async def cancel_booking(booking_id: UUID, db: AsyncSession = Depends(get_db), payload: dict = Depends(get_current_user_payload)):
    query = select(Booking).where(Booking.id == booking_id, Booking.user_id == payload.get("user_id"))
    result = await db.execute(query)
    booking = result.scalars().first()

    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")

    if booking.status in [BookingStatus.CANCELLED, BookingStatus.REFUNDED, BookingStatus.EXPIRED]:
        raise HTTPException(status_code=400, detail=f"Booking is already {booking.status}")

    if booking.status != BookingStatus.CONFIRMED:
        raise HTTPException(status_code=400, detail="Only confirmed bookings can be cancelled")

    # Enforce 1-hour cancellation window from payment time
    payment_completed_at = await ExternalServices.get_payment_completed_at(str(booking.payment_id))
    if payment_completed_at:
        window_expires_at = payment_completed_at + timedelta(hours=CANCELLATION_WINDOW_HOURS)
        if datetime.now(timezone.utc) >= window_expires_at:
            raise HTTPException(
                status_code=400,
                detail=f"Cancellation window has expired. Tickets can only be cancelled within {CANCELLATION_WINDOW_HOURS} hour of payment."
            )

    refund_amount = round(float(booking.total_fare) * REFUND_PERCENTAGE, 2)

    old_status = booking.status
    booking.status = BookingStatus.CANCELLED
    history = BookingStatusHistory(booking_id=booking.id, from_status=old_status, to_status=booking.status, reason="User Cancelled")
    db.add(history)

    # Release seats
    try:
        await ExternalServices.unbook_seats(str(booking.trip_id), booking.seat_numbers, str(booking.id))
    except Exception as e:
        import logging
        logging.error(f"Failed to unbook seats on cancellation: {str(e)}")

    await db.commit()

    await KafkaProducerClient.publish("booking.cancelled", {
        "booking_id": str(booking.id),
        "user_id": str(booking.user_id),
        "trip_id": str(booking.trip_id),
        "operator_id": str(booking.operator_id) if booking.operator_id else None,
        "boarding_point": booking.boarding_point,
        "dropping_point": booking.dropping_point,
        "journey_date": booking.journey_date.isoformat() if booking.journey_date else None,
        "departure_time": booking.departure_time.isoformat() if booking.departure_time else None,
        "seat_numbers": booking.seat_numbers,
        "total_fare": float(booking.total_fare),
    })
    # Credit refund back to user's account via bank-service
    refund_credited = False
    if payment_completed_at and refund_amount > 0:
        try:
            refund_credited = await ExternalServices.credit_refund(
                user_id=str(booking.user_id),
                amount=refund_amount,
                payment_id=str(booking.payment_id),
                booking_id=str(booking.id),
            )
        except Exception as e:
            import logging
            logging.error(f"Failed to credit refund for booking {booking.id}: {str(e)}")

    await KafkaProducerClient.publish("booking.cancelled", {
        "booking_id": str(booking.id),
        "trip_id": str(booking.trip_id),
        "refund_amount": refund_amount,
    })

    return BaseResponse(success=True, data={
        "refund_amount": refund_amount,
        "refund_credited": refund_credited,
        "message": f"Booking cancelled. ৳{refund_amount} refunded to your account." if refund_credited else "Booking cancelled. Refund will be processed shortly.",
    })
