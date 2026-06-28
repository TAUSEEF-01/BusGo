from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from database import engine, Base
from consumer import run_consumer_bg
from scheduler import start_scheduler
from notification_router import router as notification_router
from shared.observability import setup_observability
from shared.health import create_health_router, sqlalchemy_sync_check, redis_check
import os

app = FastAPI(title="Notification Service", root_path=os.environ.get("ROOT_PATH", ""))

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
    allow_credentials=True,
)

SERVICE_NAME = os.environ.get("SERVICE_NAME", "notification-service")
setup_observability(app, SERVICE_NAME)

Base.metadata.create_all(bind=engine)

# ── Include routers ────────────────────────────────────────────────────────
app.include_router(notification_router)
app.include_router(create_health_router(SERVICE_NAME, {
    "database": sqlalchemy_sync_check(engine),
    "redis": redis_check(os.environ.get("REDIS_URL")),
}))

@app.on_event("startup")
async def startup_event():
    run_consumer_bg()
    start_scheduler()

@app.get("/")
async def root():
    return {"message": "notification-service is running"}
