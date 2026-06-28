from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routers.bank import router as bank_router
from models.base import Base
from database import engine
from services.kafka_consumer import BankKafkaConsumer
from shared.observability import setup_observability
from shared.health import create_health_router, sqlalchemy_async_check, redis_check
import os

app = FastAPI(title="Bank Service", root_path=os.environ.get("ROOT_PATH", ""))
kafka_consumer = None

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
    allow_credentials=True,
)

SERVICE_NAME = os.environ.get("SERVICE_NAME", "bank-service")
setup_observability(app, SERVICE_NAME)

app.include_router(bank_router)
app.include_router(create_health_router(SERVICE_NAME, {
    "database": sqlalchemy_async_check(engine),
    "redis": redis_check(os.environ.get("REDIS_URL")),
}))


@app.on_event("startup")
async def startup():
    global kafka_consumer
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        await conn.execute(
            __import__("sqlalchemy", fromlist=["text"]).text(
                "ALTER TABLE bank_accounts ADD COLUMN IF NOT EXISTS pin VARCHAR(64) DEFAULT '1234'"
            )
        )
    # Kafka is best-effort: account auto-provisioning also self-heals on first
    # balance fetch, so a Kafka outage must not take the HTTP API down.
    try:
        kafka_consumer = BankKafkaConsumer()
        await kafka_consumer.start()
    except Exception as e:
        kafka_consumer = None
        print(f"Bank service: Kafka consumer unavailable, continuing without it: {e}")


@app.on_event("shutdown")
async def shutdown():
    if kafka_consumer:
        await kafka_consumer.stop()


@app.get("/")
async def root():
    return {"message": "Bank service is running"}
