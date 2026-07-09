from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text
from routers.bookings import router as bookings_router
from routers.marketing import router as marketing_router
from routers.journeys import router as journeys_router
from models.base import Base
from database import engine
from services.scheduler import scheduler
from services.kafka_consumer import BookingKafkaConsumer

import sys
import os
sys.path.append(os.path.join(os.path.dirname(__file__), '..', '..'))

from shared.observability import setup_observability
from shared.health import create_health_router, sqlalchemy_async_check, redis_check

app = FastAPI(title="Booking Service", root_path=os.environ.get("ROOT_PATH", ""))
kafka_consumer = None

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
    allow_credentials=True,
)

SERVICE_NAME = os.environ.get("SERVICE_NAME", "booking-service")
setup_observability(app, SERVICE_NAME)

# Health router first so /health isn't shadowed by the bookings_router's greedy
# auth-protected "/{booking_id}" route (which would otherwise return 401 and
# fail Kong's active health checks).
app.include_router(create_health_router(SERVICE_NAME, {
    "database": sqlalchemy_async_check(engine),
    "redis": redis_check(os.environ.get("REDIS_URL")),
}))
app.include_router(marketing_router)
app.include_router(journeys_router)
app.include_router(bookings_router)

@app.on_event("startup")
async def startup():
    global kafka_consumer
    kafka_consumer = BookingKafkaConsumer()
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        # New transit columns on the existing bookings table (create_all won't add them).
        await conn.execute(text("ALTER TABLE bookings ADD COLUMN IF NOT EXISTS journey_id UUID"))
        await conn.execute(text("ALTER TABLE bookings ADD COLUMN IF NOT EXISTS leg_number INTEGER"))
    scheduler.start()
    await kafka_consumer.start()

@app.on_event("shutdown")
async def shutdown():
    scheduler.shutdown()
    await kafka_consumer.stop()

@app.get("/")
async def root():
    return {"message": "Booking service is running"}
