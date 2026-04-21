import random
import redis.asyncio as aioredis
from core.config import settings

redis_client = aioredis.from_url(settings.REDIS_URL, decode_responses=True)

class OTPService:
    @staticmethod
    def generate_otp() -> str:
        return str(random.randint(100000, 999999))

    @staticmethod
    async def store_otp(phone: str, otp: str):
        # Store in Redis with 5 minutes (300 seconds) TTL
        await redis_client.setex(f"otp:{phone}", 300, otp)
        
    @staticmethod
    async def verify_otp(phone: str, otp: str) -> bool:
        stored_otp = await redis_client.get(f"otp:{phone}")
        if stored_otp and stored_otp == otp:
            await redis_client.delete(f"otp:{phone}")
            return True
        return False

    @staticmethod
    def send_sms(phone: str, otp: str):
        # Mock SMS send
        print(f"[MOCK SMS] Sending OTP {otp} to {phone}")
