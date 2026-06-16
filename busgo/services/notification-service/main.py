from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from database import engine, Base
from consumer import run_consumer_bg
from scheduler import start_scheduler
from notification_router import router as notification_router
import os

app = FastAPI(title="Notification Service", root_path=os.environ.get("ROOT_PATH", ""))

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
    allow_credentials=True,
)

Base.metadata.create_all(bind=engine)

# ── Include routers ────────────────────────────────────────────────────────
app.include_router(notification_router)

@app.on_event("startup")
async def startup_event():
    run_consumer_bg()
    start_scheduler()

@app.get("/")
async def root():
    return {"message": "notification-service is running"}

@app.get("/health")
def health_check():
    return {"status": "ok"}
