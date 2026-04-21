from apscheduler.schedulers.asyncio import AsyncIOScheduler
from sqlalchemy.future import select
from datetime import datetime, timezone
import sys
import os

from database import async_session
from models.models import Booking, BookingStatusHistory

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
                "trip_id": str(booking.trip_id)
            })
            await KafkaProducerClient.publish("audit.log", {
                "event": "booking.expired", "booking_id": str(booking.id), "timestamp": now.isoformat()
            })
            
        if bookings:
            await db.commit()
            print(f"Expired {len(bookings)} bookings")
