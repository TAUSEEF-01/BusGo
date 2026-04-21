import json
import asyncio
from aiokafka import AIOKafkaConsumer
from sqlalchemy.future import select
from datetime import datetime, timezone
import sys
import os

from core.config import settings
from database import async_session
from models.models import Booking, BookingStatusHistory

sys.path.append(os.path.join(os.path.dirname(__file__), '..', '..', '..'))
from shared.enums import BookingStatus
from shared.kafka_producer import KafkaProducerClient

class BookingKafkaConsumer:
    def __init__(self):
        self.consumer = AIOKafkaConsumer(
            "payment.completed", "seat.lock.expired",
            bootstrap_servers=settings.KAFKA_BOOTSTRAP_SERVERS,
            group_id="booking-service-group",
            value_deserializer=lambda m: json.loads(m.decode('utf-8'))
        )

    async def start(self):
        await self.consumer.start()
        asyncio.create_task(self.consume())

    async def stop(self):
        await self.consumer.stop()

    async def consume(self):
        try:
            async for msg in self.consumer:
                await self.process_message(msg.topic, msg.value)
        except Exception as e:
            print(f"Consumer error: {e}")

    async def process_message(self, topic: str, message: dict):
        booking_id = message.get("booking_id")
        if not booking_id: return

        async with async_session() as db:
            query = select(Booking).where(Booking.id == booking_id)
            result = await db.execute(query)
            booking = result.scalars().first()
            if not booking: return

            old_status = booking.status

            if topic == "payment.completed":
                if booking.status == BookingStatus.PAYMENT_PENDING or booking.status == BookingStatus.SEAT_LOCKED:
                    booking.status = BookingStatus.CONFIRMED
                    booking.payment_id = message.get("payment_id")
                    
                    history = BookingStatusHistory(booking_id=booking.id, from_status=old_status, to_status=booking.status, reason="Payment Completed")
                    db.add(history)
                    await db.commit()
                    
                    # Publish ticket.issued
                    await KafkaProducerClient.publish("ticket.issued", {
                        "booking_id": str(booking.id),
                        "user_id": str(booking.user_id),
                        "trip_id": str(booking.trip_id)
                    })

            elif topic == "seat.lock.expired":
                if booking.status == BookingStatus.SEAT_LOCKED:
                    booking.status = BookingStatus.EXPIRED
                    
                    history = BookingStatusHistory(booking_id=booking.id, from_status=old_status, to_status=booking.status, reason="Seat Lock Expired via Kafka")
                    db.add(history)
                    await db.commit()
                    
                    await KafkaProducerClient.publish("audit.log", {
                        "event": "booking.expired", "booking_id": str(booking.id), "timestamp": datetime.now(timezone.utc).isoformat()
                    })
