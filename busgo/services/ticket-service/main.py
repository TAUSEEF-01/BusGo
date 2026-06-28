from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routers.tickets import router as tickets_router
from models.base import Base
from database import engine
from services.kafka_consumer import TicketKafkaConsumer
from shared.observability import setup_observability
from shared.health import create_health_router, sqlalchemy_async_check, redis_check
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

SERVICE_NAME = os.environ.get("SERVICE_NAME", "ticket-service")
setup_observability(app, SERVICE_NAME)

# Health router first so /health isn't shadowed by the tickets_router's
# greedy "/{ticket_id}" route.
app.include_router(create_health_router(SERVICE_NAME, {
    "database": sqlalchemy_async_check(engine),
    "redis": redis_check(os.environ.get("REDIS_URL")),
}))
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
