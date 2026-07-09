import os
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    ELASTICSEARCH_URL: str = os.getenv("ELASTICSEARCH_URL", "http://elasticsearch:9200")
    REDIS_URL: str = os.getenv("REDIS_URL", "redis://redis:6379/4")
    INVENTORY_SERVICE_URL: str = os.getenv("INVENTORY_SERVICE_URL", "http://inventory-service:8000")
    OPERATOR_SERVICE_URL: str = os.getenv("OPERATOR_SERVICE_URL", "http://operator-service:8000")
    MIN_TRANSFER_MINUTES: int = int(os.getenv("MIN_TRANSFER_MINUTES", "30"))
    MAX_TRANSFER_WAIT_HOURS: int = int(os.getenv("MAX_TRANSFER_WAIT_HOURS", "6"))
    MAX_LEGS: int = int(os.getenv("MAX_LEGS", "3"))
    MAX_ITINERARIES_RETURNED: int = int(os.getenv("MAX_ITINERARIES_RETURNED", "5"))


settings = Settings()
