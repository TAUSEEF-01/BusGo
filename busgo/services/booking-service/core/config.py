import os
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    SECRET_KEY: str = os.getenv("JWT_SECRET", os.getenv("SECRET_KEY", "supersecretkey-please-change-in-production"))
    ALGORITHM: str = "HS256"
    REDIS_URL: str = os.getenv("REDIS_URL", "redis://redis:6379/3")
    KAFKA_BOOTSTRAP_SERVERS: str = os.getenv("KAFKA_BOOTSTRAP_SERVERS", "kafka:9092")
    INVENTORY_SERVICE_URL: str = os.getenv("INVENTORY_SERVICE_URL", "https://busgo-nhbi.onrender.com/api/inventory")
    DEALS_SERVICE_URL: str = os.getenv("DEALS_SERVICE_URL", "https://busgo-nhbi.onrender.com/api/deals")

settings = Settings()
