from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routers.transit import router as transit_router
from services.es_svc import es_client
import os
import sys

sys.path.append(os.path.join(os.path.dirname(__file__), '..', '..'))
from shared.observability import setup_observability
from shared.health import create_health_router, redis_check

app = FastAPI(title="Transit Service", root_path=os.environ.get("ROOT_PATH", ""))

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
    allow_credentials=True,
)

SERVICE_NAME = os.environ.get("SERVICE_NAME", "transit-service")
setup_observability(app, SERVICE_NAME)


async def es_ping_check():
    if not await es_client.ping():
        raise RuntimeError("elasticsearch unreachable")


# Health router FIRST so /health is never shadowed (gotcha #2).
app.include_router(create_health_router(SERVICE_NAME, {
    "elasticsearch": es_ping_check,
    "redis": redis_check(os.environ.get("REDIS_URL")),
}))
app.include_router(transit_router)


@app.get("/")
async def root():
    return {"message": "Transit service is running"}
