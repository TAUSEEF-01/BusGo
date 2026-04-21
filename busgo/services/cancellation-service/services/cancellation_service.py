from sqlalchemy.orm import Session
from models.cancellation import CancellationRequest, CancellationStatus
from schemas.cancellation import CancellationCreate, OperatorCancellationCreate
from fastapi import HTTPException
from datetime import datetime
import json
import sys
import os

sys.path.append(
    os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
)
from shared.kafka_producer import publish_message


# Mock for fetching booking info
def fetch_booking_details(booking_id):
    # This should be a direct HTTP call to booking-service
    return {
        "status": "CONFIRMED",
        "departure_time": datetime.utcnow().replace(year=2030),
        "total_amount": 100.0,
        "user_id": "00000000-0000-0000-0000-000000000000",
    }


def process_cancellation(db: Session, request: CancellationCreate, user_id):
    booking = fetch_booking_details(request.booking_id)

    if booking["status"] != "CONFIRMED":
        raise HTTPException(status_code=400, detail="Booking is not CONFIRMED")

    now = datetime.utcnow()
    hour = now.hour
    if 23 <= hour or hour < 7:
        raise HTTPException(
            status_code=400,
            detail="Cancellations are not allowed between 11 PM and 7 AM",
        )

    departure = booking["departure_time"]
    time_diff = (departure - now).total_seconds() / 3600

    if time_diff < 12:
        raise HTTPException(
            status_code=400, detail="Cannot cancel less than 12 hours before departure"
        )

    refund_amount = 0.0
    if time_diff > 24:
        refund_amount = booking["total_amount"] * 0.90
    elif 12 <= time_diff <= 24:
        refund_amount = booking["total_amount"] * 0.75

    cancellation = CancellationRequest(
        booking_id=request.booking_id,
        user_id=user_id,
        reason=request.reason,
        status=CancellationStatus.PENDING,
        refund_amount=refund_amount,
    )
    db.add(cancellation)
    db.commit()
    db.refresh(cancellation)

    # Publish to Kafka
    publish_message(
        "booking.cancelled",
        {
            "booking_id": str(request.booking_id),
            "user_id": str(user_id),
            "refund_amount": refund_amount,
            "reason": request.reason,
        },
    )

    publish_message(
        "audit.log",
        {
            "action": "CANCELLATION_REQUESTED",
            "entity_id": str(cancellation.id),
            "user_id": str(user_id),
        },
    )

    return {
        "cancellation_id": cancellation.id,
        "refund_amount": refund_amount,
        "estimated_days": 5,
    }


def process_operator_cancellation(db: Session, request: OperatorCancellationCreate):
    # Fetch all confirmed bookings for trip
    bookings = [
        {
            "id": "11111111-1111-1111-1111-111111111111",
            "user_id": "00000000-0000-0000-0000-000000000000",
            "total_amount": 100.0,
        }
    ]

    affected = 0
    for b in bookings:
        cancellation = CancellationRequest(
            booking_id=b["id"],
            user_id=b["user_id"],
            reason=request.reason,
            status=CancellationStatus.PENDING,
            refund_amount=b["total_amount"],
        )
        db.add(cancellation)
        affected += 1

        # publish to kafka
        publish_message(
            "booking.cancelled",
            {
                "booking_id": b["id"],
                "user_id": b["user_id"],
                "refund_amount": b["total_amount"],
                "reason": request.reason,
            },
        )

    db.commit()
    return affected


def get_cancellation(db: Session, id):
    return db.query(CancellationRequest).filter(CancellationRequest.id == id).first()


def get_cancellation_by_booking(db: Session, booking_id):
    return (
        db.query(CancellationRequest)
        .filter(CancellationRequest.booking_id == booking_id)
        .first()
    )
