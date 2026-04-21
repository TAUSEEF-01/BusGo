import redis
import os

REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379/2")
redis_client = redis.from_url(REDIS_URL, decode_responses=True)

def has_user_used_promo(code: str, user_id: str) -> bool:
    try:
        key = f"promo_used:{code}"
        return redis_client.sismember(key, str(user_id))
    except redis.ConnectionError:
        # Mock behavior if Redis is down
        print("Warning: Redis connection failed. Defaulting to false.")
        return False

def mark_promo_used(code: str, user_id: str):
    try:
        key = f"promo_used:{code}"
        redis_client.sadd(key, str(user_id))
    except redis.ConnectionError:
        print("Warning: Redis connection failed. Skipping mark promo used.")
