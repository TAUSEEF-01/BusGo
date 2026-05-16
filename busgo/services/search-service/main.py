from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routers.search import router as search_router
from services.es_svc import ESService
from services.kafka_consumer import SearchKafkaConsumer
import sys
import os

app = FastAPI(title="Search Service")
kafka_consumer = None

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
    allow_credentials=True,
)

app.include_router(search_router)

@app.on_event("startup")
async def startup():
    global kafka_consumer
    kafka_consumer = SearchKafkaConsumer()
    try:
        await ESService.init_index()
    except Exception as e:
        print(f"ES Init Error: {e}")
    await kafka_consumer.start()

@app.on_event("shutdown")
async def shutdown():
    await kafka_consumer.stop()

@app.get("/")
async def root():
    return {"message": "Search service is running"}
