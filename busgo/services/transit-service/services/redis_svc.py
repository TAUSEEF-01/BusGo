import json
import redis.asyncio as aioredis
from core.config import settings

redis_client = aioredis.from_url(settings.REDIS_URL, decode_responses=True)


class RedisTransitService:
    @staticmethod
    async def get(key: str):
        data = await redis_client.get(key)
        return json.loads(data) if data else None

    @staticmethod
    async def set(key: str, value, ttl: int):
        await redis_client.setex(key, ttl, json.dumps(value))
