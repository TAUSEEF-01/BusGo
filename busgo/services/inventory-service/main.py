from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from routers.inventory import router as inventory_router
from models.base import Base
from database import engine
from services.kafka_consumer import InventoryKafkaConsumer
import sys
import os
sys.path.append(os.path.join(os.path.dirname(__file__), '..', '..'))
from shared.exceptions import SeatAlreadyLocked
from shared.base_response import BaseResponse

app = FastAPI(title="Inventory Service", root_path=os.environ.get("ROOT_PATH", ""))
kafka_consumer = None

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
    allow_credentials=True,
)

@app.exception_handler(SeatAlreadyLocked)
async def seat_already_locked_handler(request: Request, exc: SeatAlreadyLocked):
    return JSONResponse(
        status_code=409,
        content=BaseResponse(success=False, message=str(exc)).model_dump()
    )

app.include_router(inventory_router)

@app.on_event("startup")
async def startup():
    global kafka_consumer
    kafka_consumer = InventoryKafkaConsumer()
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    await kafka_consumer.start()

@app.on_event("shutdown")
async def shutdown():
    if kafka_consumer:
        await kafka_consumer.stop()

@app.get("/")
async def root():
    return {"message": "Inventory service is running"}
