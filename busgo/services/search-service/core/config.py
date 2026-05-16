import os
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    ELASTICSEARCH_URL: str = os.getenv("ELASTICSEARCH_URL", "http://elasticsearch:9200")
    REDIS_URL: str = os.getenv("REDIS_URL", "redis://redis:6379/2")
    KAFKA_BOOTSTRAP_SERVERS: str = os.getenv("KAFKA_BOOTSTRAP_SERVERS", "kafka:9092")
    INVENTORY_SERVICE_URL: str = os.getenv("INVENTORY_SERVICE_URL", "https://busgo-nhbi.onrender.com/api/inventory")

settings = Settings()
