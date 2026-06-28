"""Shared liveness/readiness health endpoints for BusGo services.

Usage in a service ``main.py``::

    from shared.health import create_health_router, sqlalchemy_async_check, redis_check
    app.include_router(create_health_router("auth-service", {
        "database": sqlalchemy_async_check(engine),
        "redis": redis_check(os.environ.get("REDIS_URL")),
    }))

- ``GET /health``       -> liveness, always 200 (process is up).
- ``GET /health/ready`` -> readiness, 200 only if every check passes, else 503.

Readiness checks may be plain or async callables; both are supported. These
endpoints also back Kong's active health checks (see infrastructure/kong/kong.yml).
"""
import inspect
from typing import Awaitable, Callable, Dict, Union

from fastapi import APIRouter
from fastapi.responses import JSONResponse

Check = Callable[[], Union[None, Awaitable[None]]]


def create_health_router(service_name: str, readiness_checks: Dict[str, Check] | None = None) -> APIRouter:
    router = APIRouter(tags=["health"])
    checks: Dict[str, Check] = {k: v for k, v in (readiness_checks or {}).items() if v is not None}

    @router.get("/health")
    async def health():  # liveness
        return {"status": "ok", "service": service_name}

    @router.get("/health/ready")
    async def ready():  # readiness
        results: Dict[str, str] = {}
        healthy = True
        for name, check in checks.items():
            try:
                outcome = check()
                if inspect.isawaitable(outcome):
                    await outcome
                results[name] = "ok"
            except Exception as exc:  # noqa: BLE001 - report, don't crash the probe
                healthy = False
                results[name] = f"error: {exc.__class__.__name__}: {exc}"
        return JSONResponse(
            status_code=200 if healthy else 503,
            content={
                "status": "ready" if healthy else "not_ready",
                "service": service_name,
                "checks": results,
            },
        )

    return router


def sqlalchemy_async_check(engine) -> Check:
    """Readiness check for an async SQLAlchemy engine (asyncpg services)."""
    from sqlalchemy import text

    async def _check() -> None:
        async with engine.connect() as conn:
            await conn.execute(text("SELECT 1"))

    return _check


def sqlalchemy_sync_check(engine) -> Check:
    """Readiness check for a sync SQLAlchemy engine."""
    from sqlalchemy import text

    def _check() -> None:
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))

    return _check


def redis_check(redis_url: str | None) -> Check | None:
    """Readiness check pinging Redis. Returns None (skipped) if no URL given."""
    if not redis_url:
        return None

    async def _check() -> None:
        import redis.asyncio as aioredis

        client = aioredis.from_url(redis_url, socket_connect_timeout=2)
        try:
            await client.ping()
        finally:
            await client.aclose()

    return _check
