import redis.asyncio as aioredis
from core.config import settings
from typing import Optional

redis_client = aioredis.from_url(settings.REDIS_URL, decode_responses=True)

class RedisInventoryService:
    LOCK_TTL = 600

    @staticmethod
    async def lock_seat(trip_id: str, seat_number: str, booking_id: str) -> bool:
        key = f"seat_lock:{trip_id}:{seat_number}"
        # Set NX (Not eXists) ensuring atomicity
        return await redis_client.set(key, booking_id, nx=True, ex=RedisInventoryService.LOCK_TTL)

    @staticmethod
    async def unlock_seat(trip_id: str, seat_number: str):
        key = f"seat_lock:{trip_id}:{seat_number}"
        await redis_client.delete(key)

    @staticmethod
    async def get_seat_lock(trip_id: str, seat_number: str) -> Optional[str]:
        key = f"seat_lock:{trip_id}:{seat_number}"
        return await redis_client.get(key)
