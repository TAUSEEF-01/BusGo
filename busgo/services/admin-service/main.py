from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routers.admin import router as admin_router
from database import engine
from models import Base
from shared.observability import setup_observability
from shared.health import create_health_router, sqlalchemy_sync_check, redis_check
import os

app = FastAPI(title="Admin Service", root_path=os.environ.get("ROOT_PATH", ""))

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
    allow_credentials=True,
)

SERVICE_NAME = os.environ.get("SERVICE_NAME", "admin-service")
setup_observability(app, SERVICE_NAME)

app.include_router(admin_router)
app.include_router(create_health_router(SERVICE_NAME, {
    "database": sqlalchemy_sync_check(engine),
    "redis": redis_check(os.environ.get("REDIS_URL")),
}))

@app.on_event("startup")
def startup():
    Base.metadata.create_all(bind=engine)

@app.get("/")
async def root():
    return {"message": "admin-service is running on port 8011"}
