import json
import redis.asyncio as aioredis
from core.config import settings

redis_client = aioredis.from_url(settings.REDIS_URL, decode_responses=True)

class RedisIdempotencyService:
    @staticmethod
    async def get_idempotency(key: str) -> dict:
        data = await redis_client.get(f"idem:{key}")
        return json.loads(data) if data else None

    @staticmethod
    async def set_idempotency(key: str, value: dict):
        # TTL 24 hours
        await redis_client.setex(f"idem:{key}", 86400, json.dumps(value))
