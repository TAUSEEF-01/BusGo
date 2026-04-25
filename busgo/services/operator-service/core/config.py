import os
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    SECRET_KEY: str = os.getenv("JWT_SECRET", os.getenv("SECRET_KEY", "supersecretkey-please-change-in-production"))
    ALGORITHM: str = "HS256"
    KAFKA_BOOTSTRAP_SERVERS: str = os.getenv("KAFKA_BOOTSTRAP_SERVERS", "kafka:9092")

settings = Settings()
