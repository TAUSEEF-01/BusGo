from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routers.tickets import router as tickets_router
from models.base import Base
from database import engine
from services.kafka_consumer import TicketKafkaConsumer
import os

app = FastAPI(title="Ticket Service", root_path=os.environ.get("ROOT_PATH", ""))
kafka_consumer = None

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
    allow_credentials=True,
)

app.include_router(tickets_router)

@app.on_event("startup")
async def startup():
    global kafka_consumer
    kafka_consumer = TicketKafkaConsumer()
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    await kafka_consumer.start()

@app.on_event("shutdown")
async def shutdown():
    await kafka_consumer.stop()

@app.get("/")
async def root():
    return {"message": "Ticket service is running"}
