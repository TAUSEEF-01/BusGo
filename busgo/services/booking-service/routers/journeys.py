"""Multi-leg transit journey booking — the saga.

A journey books several connecting trip legs as one all-or-nothing unit: every
leg's seats are locked, and if any leg fails the already-locked legs are
released (compensation). Payment and confirmation act on the whole journey.
"""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from datetime import datetime, timedelta, timezone
import uuid
import logging

from database import get_db
from models.models import Booking, Journey, BookingStatusHistory
from schemas.schemas import JourneyCreate
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

router = APIRouter(prefix="/journeys", tags=["journeys"])

CANCELLATION_WINDOW_HOURS = 1
REFUND_PERCENTAGE = 0.80


def _norm_city(value: str) -> str:
    key = (value or "").strip().lower()
    return {
        "chittagong": "chattogram", "comilla": "cumilla", "barisal": "barishal",
        "bogra": "bogura", "jessore": "jashore",
    }.get(key, key)


def _route_slice(route: dict, origin: str, destination: str):
    cities = [route.get("origin_city"), *(route.get("via_cities") or []), route.get("destination_city")]
    keys = [_norm_city(city) for city in cities]
    try:
        start = keys.index(_norm_city(origin))
        end = keys.index(_norm_city(destination), start + 1)
    except ValueError:
        return [], []
    assignments = route.get("leg_assignments") or []
    return cities[start:end + 1], assignments[start:end]


@router.post("/", response_model=BaseResponse)
async def create_journey(req: JourneyCreate, db: AsyncSession = Depends(get_db), payload: dict = Depends(get_current_user_payload)):
    # 1. Idempotency
    cached = await RedisIdempotencyService.get_idempotency(req.idempotency_key)
    if cached:
        return BaseResponse(success=True, data=cached, message="Retrieved from cache")

    user_id = payload.get("user_id")

    # 2. Validate legs + fare against operator-service. A client cannot alter
    # a leg price, substitute another bus, or skip a required connection.
    if not (1 <= len(req.legs) <= 3):
        raise HTTPException(status_code=400, detail="A journey must have between 1 and 3 legs")
    passenger_counts = {len(leg.seat_numbers) for leg in req.legs}
    if len(passenger_counts) != 1 or not passenger_counts or next(iter(passenger_counts)) < 1:
        raise HTTPException(status_code=400, detail="Select the same passenger count on every bus")

    trip_data = []
    authoritative_total = 0.0
    for index, leg in enumerate(req.legs):
        trip = await ExternalServices.get_trip(str(leg.trip_id))
        if not trip:
            raise HTTPException(status_code=400, detail=f"Transit leg {index + 1} is no longer available")
        if str(trip.get("status", "")).upper() != "SCHEDULED":
            raise HTTPException(status_code=400, detail=f"Transit leg {index + 1} is not scheduled")
        expected_fare = round(float(trip.get("fare_amount", 0) or 0) * len(leg.seat_numbers), 2)
        if abs(float(leg.fare) - expected_fare) > 0.01:
            raise HTTPException(status_code=400, detail=f"Fare changed for transit leg {index + 1}; refresh the journey")
        if str(trip.get("operator_id")) != str(leg.operator_id):
            raise HTTPException(status_code=400, detail=f"Operator mismatch on transit leg {index + 1}")
        if (
            _norm_city(leg.boarding_point) != _norm_city(trip.get("origin_city"))
            or _norm_city(leg.dropping_point) != _norm_city(trip.get("destination_city"))
        ):
            raise HTTPException(status_code=400, detail=f"Boarding or dropping city mismatch on transit leg {index + 1}")
        if index == 0 and _norm_city(trip.get("origin_city")) != _norm_city(req.origin):
            raise HTTPException(status_code=400, detail="The first bus does not start at the selected origin")
        if index > 0 and _norm_city(trip_data[-1].get("destination_city")) != _norm_city(trip.get("origin_city")):
            raise HTTPException(status_code=400, detail=f"Transit leg {index + 1} does not continue from the previous bus")
        trip_data.append(trip)
        authoritative_total += expected_fare

    if _norm_city(trip_data[-1].get("destination_city")) != _norm_city(req.destination):
        raise HTTPException(status_code=400, detail="The final bus does not reach the selected destination")
    authoritative_total = round(authoritative_total, 2)
    if abs(float(req.total_fare) - authoritative_total) > 0.01:
        raise HTTPException(status_code=400, detail="Journey fare changed; refresh and try again")

    route = {}
    if req.transit_route_id:
        route = await ExternalServices.get_transit_route(str(req.transit_route_id), req.origin, req.destination)
        if not route:
            raise HTTPException(status_code=400, detail="This operator transit route is no longer available")
        route_cities, assignments = _route_slice(route, req.origin, req.destination)
        if len(route_cities) != len(req.legs) + 1:
            raise HTTPException(status_code=400, detail="The selected buses do not match this transit route")
        if assignments:
            if len(assignments) != len(req.legs):
                raise HTTPException(status_code=400, detail="Transit bus assignments are incomplete")
            for index, (assignment, trip) in enumerate(zip(assignments, trip_data)):
                if (
                    str(assignment.get("bus_id")) != str(trip.get("bus_id"))
                    or str(assignment.get("route_id")) != str(trip.get("route_id"))
                ):
                    raise HTTPException(status_code=400, detail=f"Bus assignment changed for transit leg {index + 1}")

    # 3. Promo discount (validated against the whole journey fare)
    discount = 0.0
    if req.promo_code:
        promo = await ExternalServices.validate_promo(req.promo_code, req.total_fare, str(req.legs[0].trip_id), str(user_id))
        discount = promo["discount_amount"] if promo.get("valid") else 0.0

    # 3a. Operator transit-route discount (recomputed server-side; never trust client)
    if req.transit_route_id:
        pct = float(route.get("combined_discount_pct", 0) or 0)
        if pct > 0:
            discount = round(discount + req.total_fare * pct / 100.0, 2)

    journey_id = uuid.uuid4()
    expires_at = datetime.now(timezone.utc) + timedelta(minutes=10)
    leg_booking_ids = [uuid.uuid4() for _ in req.legs]

    # 4. Forward phase: lock seats leg by leg; compensate on any failure.
    locked = 0
    try:
        for i, leg in enumerate(req.legs):
            await ExternalServices.lock_seats(str(leg.trip_id), leg.seat_numbers, str(leg_booking_ids[i]), str(user_id))
            locked = i + 1
    except Exception as e:
        for j in range(locked):
            try:
                await ExternalServices.unbook_seats(str(req.legs[j].trip_id), req.legs[j].seat_numbers, str(leg_booking_ids[j]))
            except Exception as ce:
                logging.error(f"Compensation unbook failed for leg {j+1} of journey {journey_id}: {ce}")
        failed_leg = req.legs[locked]
        raise HTTPException(
            status_code=409,
            detail=f"Seat(s) unavailable on leg {locked+1} ({failed_leg.boarding_point} → {failed_leg.dropping_point}); nothing was booked.",
        )

    # 5. Persist the journey + one booking per leg. If this fails, the seats
    # are already locked — release them all so the journey is truly all-or-nothing.
    try:
        journey = Journey(
            id=journey_id, user_id=user_id, origin=req.origin, destination=req.destination,
            leg_count=len(req.legs), total_fare=req.total_fare, discount_amount=discount,
            promo_code=req.promo_code, status=BookingStatus.SEAT_LOCKED,
            idempotency_key=req.idempotency_key, transit_route_id=req.transit_route_id,
            expires_at=expires_at,
        )
        db.add(journey)
        for i, leg in enumerate(req.legs):
            booking = Booking(
                id=leg_booking_ids[i], user_id=user_id, trip_id=leg.trip_id, operator_id=leg.operator_id,
                seat_numbers=leg.seat_numbers, passenger_details=[p.model_dump() for p in req.passenger_details],
                boarding_point=leg.boarding_point, dropping_point=leg.dropping_point,
                journey_date=leg.journey_date, departure_time=leg.departure_time,
                total_fare=leg.fare, discount_amount=0.0, promo_code=req.promo_code,
                journey_id=journey_id, leg_number=i + 1, status=BookingStatus.SEAT_LOCKED,
                idempotency_key=f"{req.idempotency_key}:leg{i+1}", expires_at=expires_at,
            )
            db.add(booking)
            db.add(BookingStatusHistory(booking_id=booking.id, from_status=BookingStatus.INITIATED, to_status=BookingStatus.SEAT_LOCKED, reason=f"Transit leg {i+1} seats locked"))
        await db.commit()
    except Exception as e:
        await db.rollback()
        for i, leg in enumerate(req.legs):
            try:
                await ExternalServices.unbook_seats(str(leg.trip_id), leg.seat_numbers, str(leg_booking_ids[i]))
            except Exception as ce:
                logging.error(f"Compensation unbook (persist failure) failed for leg {i+1} of journey {journey_id}: {ce}")
        logging.error(f"Failed to persist journey {journey_id}: {e}")
        raise HTTPException(status_code=500, detail="Could not create the journey. No seats were held.")

    final_fare = max(0.0, float(req.total_fare) - discount)
    response_data = {
        "journey_id": str(journey_id),
        "booking_ids": [str(b) for b in leg_booking_ids],
        "origin": req.origin,
        "destination": req.destination,
        "legs": [
            {
                "leg_number": i + 1,
                "booking_id": str(leg_booking_ids[i]),
                "trip_id": str(leg.trip_id),
                "boarding_point": leg.boarding_point,
                "dropping_point": leg.dropping_point,
                "seat_numbers": leg.seat_numbers,
                "fare": leg.fare,
            }
            for i, leg in enumerate(req.legs)
        ],
        "total_fare": float(req.total_fare),
        "discount_amount": discount,
        "final_fare": final_fare,
        "expires_at": expires_at.isoformat(),
    }

    await RedisIdempotencyService.set_idempotency(req.idempotency_key, response_data)
    for i, leg in enumerate(req.legs):
        await KafkaProducerClient.publish("booking.created", {
            "booking_id": str(leg_booking_ids[i]), "user_id": str(user_id), "trip_id": str(leg.trip_id),
            "journey_id": str(journey_id), "leg_number": i + 1,
        })
    await KafkaProducerClient.publish("audit.log", {"event": "journey.created", "journey_id": str(journey_id), "timestamp": datetime.now(timezone.utc).isoformat()})

    return BaseResponse(success=True, data=response_data, message="Journey booked successfully")


@router.get("/{journey_id}", response_model=BaseResponse)
async def get_journey(journey_id: uuid.UUID, db: AsyncSession = Depends(get_db), payload: dict = Depends(get_current_user_payload)):
    journey = (await db.execute(select(Journey).where(Journey.id == journey_id))).scalars().first()
    if not journey:
        raise HTTPException(status_code=404, detail="Journey not found")

    role = str(payload.get("role", "")).upper()
    if str(journey.user_id) != str(payload.get("user_id")) and role not in ("OPERATOR", "ADMIN"):
        raise HTTPException(status_code=403, detail="Not authorized to view this journey")

    legs = (await db.execute(
        select(Booking).where(Booking.journey_id == journey_id).order_by(Booking.leg_number)
    )).scalars().all()

    final_fare = max(0.0, float(journey.total_fare) - float(journey.discount_amount or 0))
    return BaseResponse(success=True, data={
        "journey_id": str(journey.id),
        "user_id": str(journey.user_id),
        "origin": journey.origin,
        "destination": journey.destination,
        "leg_count": journey.leg_count,
        "status": journey.status,
        "total_fare": float(journey.total_fare),
        "discount_amount": float(journey.discount_amount or 0),
        "final_fare": final_fare,
        "promo_code": journey.promo_code,
        "transit_route_id": str(journey.transit_route_id) if journey.transit_route_id else None,
        "payment_id": str(journey.payment_id) if journey.payment_id else None,
        "expires_at": journey.expires_at.isoformat() if journey.expires_at else None,
        "legs": [
            {
                "leg_number": l.leg_number,
                "booking_id": str(l.id),
                "trip_id": str(l.trip_id),
                "operator_id": str(l.operator_id) if l.operator_id else None,
                "boarding_point": l.boarding_point,
                "dropping_point": l.dropping_point,
                "journey_date": l.journey_date.isoformat() if l.journey_date else None,
                "departure_time": l.departure_time.isoformat() if l.departure_time else None,
                "seat_numbers": l.seat_numbers,
                "fare": float(l.total_fare),
                "status": l.status,
            }
            for l in legs
        ],
    })


@router.post("/{journey_id}/confirm-payment", response_model=BaseResponse)
async def confirm_journey_payment(journey_id: uuid.UUID, payment_id: uuid.UUID = Query(...), db: AsyncSession = Depends(get_db), payload: dict = Depends(get_current_user_payload)):
    journey = (await db.execute(select(Journey).where(Journey.id == journey_id, Journey.user_id == payload.get("user_id")))).scalars().first()
    if not journey:
        raise HTTPException(status_code=404, detail="Journey not found")
    if journey.status == BookingStatus.CONFIRMED:
        if str(journey.payment_id) != str(payment_id):
            raise HTTPException(status_code=409, detail="Journey was confirmed with another payment")
        return BaseResponse(success=True, message="Journey already confirmed")

    payment = await ExternalServices.get_payment(str(payment_id))
    expected_amount = round(float(journey.total_fare) - float(journey.discount_amount or 0), 2)
    if (
        str(payment.get("status", "")).upper() != "COMPLETED"
        or str(payment.get("booking_id")) != str(journey.id)
        or str(payment.get("user_id")) != str(journey.user_id)
        or abs(float(payment.get("amount", -1)) - expected_amount) > 0.01
    ):
        raise HTTPException(status_code=400, detail="A matching completed payment is required")

    legs = (await db.execute(
        select(Booking).where(Booking.journey_id == journey_id).order_by(Booking.leg_number)
    )).scalars().all()

    old = journey.status
    journey.status = BookingStatus.CONFIRMED
    journey.payment_id = payment_id
    for leg in legs:
        prev = leg.status
        leg.status = BookingStatus.CONFIRMED
        leg.payment_id = payment_id
        db.add(BookingStatusHistory(booking_id=leg.id, from_status=prev, to_status=BookingStatus.CONFIRMED, reason="Journey payment confirmed"))
    await db.commit()

    # Consume the promo once for the whole journey.
    if journey.promo_code:
        try:
            await ExternalServices.consume_promo(journey.promo_code, str(journey.user_id))
        except Exception as e:
            logging.error(f"Failed to consume promo for journey {journey_id}: {e}")

    # Confirm seats + issue a ticket per leg + record travel.
    for leg in legs:
        try:
            await ExternalServices.confirm_seats(str(leg.trip_id), leg.seat_numbers, str(leg.id), str(leg.user_id))
        except Exception as e:
            logging.error(f"Failed to confirm seats for journey leg {leg.id}: {e}")
        await KafkaProducerClient.publish("ticket.issued", await build_ticket_event(leg))
        await record_travel(db, leg)

    return BaseResponse(success=True, message="Journey confirmed")


@router.post("/{journey_id}/cancel", response_model=BaseResponse)
async def cancel_journey(journey_id: uuid.UUID, db: AsyncSession = Depends(get_db), payload: dict = Depends(get_current_user_payload)):
    journey = (await db.execute(select(Journey).where(Journey.id == journey_id))).scalars().first()
    if not journey:
        raise HTTPException(status_code=404, detail="Journey not found")
    if str(journey.user_id) != str(payload.get("user_id")):
        raise HTTPException(status_code=403, detail="Not authorized")
    if journey.status in (BookingStatus.CANCELLED, BookingStatus.REFUNDED, BookingStatus.EXPIRED):
        raise HTTPException(status_code=400, detail=f"Journey is already {journey.status}")
    if journey.status != BookingStatus.CONFIRMED:
        raise HTTPException(status_code=400, detail="Only confirmed journeys can be cancelled")

    # Enforce the 1-hour post-payment cancellation window.
    payment_completed_at = await ExternalServices.get_payment_completed_at(str(journey.payment_id))
    if payment_completed_at and datetime.now(timezone.utc) >= payment_completed_at + timedelta(hours=CANCELLATION_WINDOW_HOURS):
        raise HTTPException(status_code=400, detail=f"Cancellation window of {CANCELLATION_WINDOW_HOURS}h has expired")

    final_fare = float(journey.total_fare) - float(journey.discount_amount or 0)
    refund_amount = round(final_fare * REFUND_PERCENTAGE, 2)

    legs = (await db.execute(select(Booking).where(Booking.journey_id == journey_id))).scalars().all()
    journey.status = BookingStatus.CANCELLED
    for leg in legs:
        prev = leg.status
        leg.status = BookingStatus.CANCELLED
        db.add(BookingStatusHistory(booking_id=leg.id, from_status=prev, to_status=BookingStatus.CANCELLED, reason="Journey cancelled"))
        try:
            await ExternalServices.unbook_seats(str(leg.trip_id), leg.seat_numbers, str(leg.id))
        except Exception as e:
            logging.error(f"Failed to unbook seats on journey cancel, leg {leg.id}: {e}")
    await db.commit()

    for leg in legs:
        await KafkaProducerClient.publish("booking.cancelled", {
            "booking_id": str(leg.id), "user_id": str(leg.user_id), "trip_id": str(leg.trip_id),
            "seat_numbers": leg.seat_numbers,
        })

    refund_credited = False
    if payment_completed_at and refund_amount > 0:
        try:
            refund_credited = await ExternalServices.credit_refund(
                user_id=str(journey.user_id), amount=refund_amount,
                payment_id=str(journey.payment_id), booking_id=str(journey.id),
            )
        except Exception as e:
            logging.error(f"Failed to credit refund for journey {journey_id}: {e}")

    return BaseResponse(success=True, data={
        "refund_amount": refund_amount,
        "refund_credited": refund_credited,
        "message": f"Journey cancelled. ৳{refund_amount} refunded." if refund_credited else "Journey cancelled. Refund will be processed shortly.",
    })
