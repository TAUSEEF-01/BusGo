from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text
from routers.operators import router as operators_router
from routers.buses_routes import router as buses_routes_router
from routers.trips import router as trips_router
from routers.transit_routes import router as transit_routes_router
from models.base import Base
from database import engine
from shared.observability import setup_observability
from shared.health import create_health_router, sqlalchemy_async_check, redis_check
import os

app = FastAPI(title="Operator Service", root_path=os.environ.get("ROOT_PATH", ""))

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
    allow_credentials=True,
)

SERVICE_NAME = os.environ.get("SERVICE_NAME", "operator-service")
setup_observability(app, SERVICE_NAME)

app.include_router(operators_router)
app.include_router(buses_routes_router)
app.include_router(trips_router)
app.include_router(transit_routes_router)
app.include_router(create_health_router(SERVICE_NAME, {
    "database": sqlalchemy_async_check(engine),
    "redis": redis_check(os.environ.get("REDIS_URL")),
}))

@app.on_event("startup")
async def startup():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        # New transit opt-in column on the existing trips table.
        await conn.execute(text("ALTER TABLE trips ADD COLUMN IF NOT EXISTS allow_transit BOOLEAN DEFAULT TRUE"))

@app.get("/")
async def root():
    return {"message": "Operator service is running"}
