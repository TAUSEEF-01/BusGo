import os
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    SECRET_KEY: str = os.getenv("JWT_SECRET", os.getenv("SECRET_KEY", "supersecretkey"))
    ALGORITHM: str = "HS256"
    KAFKA_BOOTSTRAP_SERVERS: str = os.getenv("KAFKA_BOOTSTRAP_SERVERS", "kafka:9092")
    BOOKING_SERVICE_URL: str = os.getenv("BOOKING_SERVICE_URL", "https://busgo-nhbi.onrender.com/api/bookings")
    BANK_SERVICE_URL: str = os.getenv("BANK_SERVICE_URL", "http://bank-service:8000")

settings = Settings()
