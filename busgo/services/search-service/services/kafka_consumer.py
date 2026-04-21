import json
import asyncio
from aiokafka import AIOKafkaConsumer
from core.config import settings
from services.es_svc import ESService

class SearchKafkaConsumer:
    def __init__(self):
        self.consumer = AIOKafkaConsumer(
            "trip.created", "trip.updated", "trip.cancelled",
            bootstrap_servers=settings.KAFKA_BOOTSTRAP_SERVERS,
            group_id="search-service-group",
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
        trip_id = message.get("id") or message.get("trip_id")
        if not trip_id: return

        if topic == "trip.created":
            await ESService.index_trip(message)
        elif topic == "trip.updated":
            await ESService.update_trip(trip_id, message)
        elif topic == "trip.cancelled":
            await ESService.update_trip(trip_id, {"status": "CANCELLED"})
        print(f"Processed {topic} for trip {trip_id} into ES")
