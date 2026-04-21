import json
import asyncio
from aiokafka import AIOKafkaConsumer
from core.config import settings
from database import async_session
from sqlalchemy.future import select
from models.models import SeatInventory, SeatStatus
from services.redis_svc import RedisInventoryService

class InventoryKafkaConsumer:
    def __init__(self):
        self.consumer = AIOKafkaConsumer(
            "seat.lock.expired", "booking.cancelled",
            bootstrap_servers=settings.KAFKA_BOOTSTRAP_SERVERS,
            group_id="inventory-service-group",
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
        trip_id = message.get("trip_id")
        if not booking_id:
            return

        async with async_session() as db:
            query = select(SeatInventory).where(SeatInventory.locked_by_booking_id == booking_id)
            if trip_id:
                query = query.where(SeatInventory.trip_id == trip_id)
                
            result = await db.execute(query)
            seats = result.scalars().all()

            for seat in seats:
                if seat.status != SeatStatus.BOOKED:
                    seat.status = SeatStatus.AVAILABLE
                    seat.locked_by_booking_id = None
                    seat.lock_expires_at = None
                await RedisInventoryService.unlock_seat(str(seat.trip_id), seat.seat_number)

            await db.commit()
            print(f"Processed {topic} for booking {booking_id}")
