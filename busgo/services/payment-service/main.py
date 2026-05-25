from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routers.payments import router as payments_router
from models.base import Base
from database import engine
from services.kafka_consumer import PaymentKafkaConsumer
import os

app = FastAPI(title="Payment Service", root_path=os.environ.get("ROOT_PATH", ""))
kafka_consumer = None

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
    allow_credentials=True,
)

app.include_router(payments_router)

@app.on_event("startup")
async def startup():
    global kafka_consumer
    kafka_consumer = PaymentKafkaConsumer()
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    await kafka_consumer.start()

@app.on_event("shutdown")
async def shutdown():
    await kafka_consumer.stop()

@app.get("/")
async def root():
    return {"message": "Payment service is running"}
