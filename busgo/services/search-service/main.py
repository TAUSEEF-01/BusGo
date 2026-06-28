from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routers.search import router as search_router
from services.es_svc import ESService
from services.kafka_consumer import SearchKafkaConsumer
from database import engine
from shared.observability import setup_observability
from shared.health import create_health_router, sqlalchemy_async_check, redis_check
import sys
import os

app = FastAPI(title="Search Service", root_path=os.environ.get("ROOT_PATH", ""))
kafka_consumer = None

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
    allow_credentials=True,
)

SERVICE_NAME = os.environ.get("SERVICE_NAME", "search-service")
setup_observability(app, SERVICE_NAME)

app.include_router(search_router)
app.include_router(create_health_router(SERVICE_NAME, {
    "database": sqlalchemy_async_check(engine),
    "redis": redis_check(os.environ.get("REDIS_URL")),
}))

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
