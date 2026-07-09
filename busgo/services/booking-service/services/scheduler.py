from apscheduler.schedulers.asyncio import AsyncIOScheduler
from sqlalchemy.future import select
from datetime import datetime, timezone
import sys
import os

from database import async_session
from models.models import Booking, BookingStatusHistory, Journey

sys.path.append(os.path.join(os.path.dirname(__file__), '..', '..', '..'))
from shared.enums import BookingStatus
from shared.kafka_producer import KafkaProducerClient

scheduler = AsyncIOScheduler()

@scheduler.scheduled_job('interval', minutes=1)
async def expire_stale_bookings():
    now = datetime.now(timezone.utc)
    async with async_session() as db:
        query = select(Booking).where(Booking.status == BookingStatus.SEAT_LOCKED, Booking.expires_at < now)
        result = await db.execute(query)
        bookings = result.scalars().all()
        
        for booking in bookings:
            old_status = booking.status
            booking.status = BookingStatus.EXPIRED
            history = BookingStatusHistory(booking_id=booking.id, from_status=old_status, to_status=BookingStatus.EXPIRED, reason="Scheduler Lock Expired")
            db.add(history)
            
            await KafkaProducerClient.publish("seat.lock.expired", {
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
            await KafkaProducerClient.publish("audit.log", {
                "event": "booking.expired", "booking_id": str(booking.id), "timestamp": now.isoformat()
            })
            
        if bookings:
            await db.commit()
            print(f"Expired {len(bookings)} bookings")

        # Roll up any journey whose legs are all terminal (EXPIRED/CANCELLED) but
        # whose own status is still an active hold.
        stale_journeys = (await db.execute(
            select(Journey).where(Journey.status.in_([BookingStatus.SEAT_LOCKED, BookingStatus.PAYMENT_PENDING]))
        )).scalars().all()
        rolled = 0
        for journey in stale_journeys:
            legs = (await db.execute(select(Booking).where(Booking.journey_id == journey.id))).scalars().all()
            if legs and all(l.status in (BookingStatus.EXPIRED, BookingStatus.CANCELLED) for l in legs):
                journey.status = BookingStatus.EXPIRED
                rolled += 1
        if rolled:
            await db.commit()
            print(f"Expired {rolled} journeys")
