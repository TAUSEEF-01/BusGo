import os
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    SECRET_KEY: str = os.getenv("JWT_SECRET", os.getenv("SECRET_KEY", "supersecretkey-please-change-in-production"))
    ALGORITHM: str = "HS256"
    REDIS_URL: str = os.getenv("REDIS_URL", "redis://redis:6379/3")
    KAFKA_BOOTSTRAP_SERVERS: str = os.getenv("KAFKA_BOOTSTRAP_SERVERS", "kafka:9092")
    INVENTORY_SERVICE_URL: str = os.getenv("INVENTORY_SERVICE_URL", "https://busgo-nhbi.onrender.com/api/inventory")
    DEALS_SERVICE_URL: str = os.getenv("DEALS_SERVICE_URL", "https://busgo-nhbi.onrender.com/api/deals")
    PAYMENT_SERVICE_URL: str = os.getenv("PAYMENT_SERVICE_URL", "http://payment-service:8000")
    BANK_SERVICE_URL: str = os.getenv("BANK_SERVICE_URL", "http://bank-service:8000")
    NOTIFICATION_SERVICE_URL: str = os.getenv("NOTIFICATION_SERVICE_URL", "http://notification-service:8000")
    OPERATOR_SERVICE_URL: str = os.getenv("OPERATOR_SERVICE_URL", "http://operator-service:8000")
    AUTH_SERVICE_URL: str = os.getenv("AUTH_SERVICE_URL", "http://auth-service:8000")

settings = Settings()
