from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routers.bookings import router as bookings_router
from models.base import Base
from database import engine
from services.scheduler import scheduler
from services.kafka_consumer import BookingKafkaConsumer

import sys
import os
sys.path.append(os.path.join(os.path.dirname(__file__), '..', '..'))

app = FastAPI(title="Booking Service")
kafka_consumer = BookingKafkaConsumer()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
    allow_credentials=True,
)

app.include_router(bookings_router)

@app.on_event("startup")
async def startup():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    scheduler.start()
    await kafka_consumer.start()

@app.on_event("shutdown")
async def shutdown():
    scheduler.shutdown()
    await kafka_consumer.stop()

@app.get("/")
async def root():
    return {"message": "Booking service is running"}
