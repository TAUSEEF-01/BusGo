from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routers.operators import router as operators_router
from routers.buses_routes import router as buses_routes_router
from routers.trips import router as trips_router
from models.base import Base
from database import engine

app = FastAPI(title="Operator Service")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
    allow_credentials=True,
)

app.include_router(operators_router)
app.include_router(buses_routes_router)
app.include_router(trips_router)

@app.on_event("startup")
async def startup():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

@app.get("/")
async def root():
    return {"message": "Operator service is running"}
