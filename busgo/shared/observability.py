"""Shared observability wiring for BusGo services: Prometheus metrics,
structured JSON logging, and request-correlation IDs.

One call wires everything::

    from shared.observability import setup_observability
    setup_observability(app, "auth-service")

This adds:
- ``GET /metrics``        -> Prometheus metrics (request count + latency).
- a correlation-ID middleware that reads ``X-Request-ID`` (set by Kong's
  correlation-id plugin) or generates one, stores it in a contextvar, and echoes
  it on the response. ``shared.http_client`` propagates it on outbound calls so a
  single request can be traced gateway -> service -> downstream.
- structured JSON logs (one line per record) that include ``service`` and
  ``request_id``, ready for Loki/Promtail aggregation.

Note on metrics: we use ``prometheus_client`` directly via a tiny middleware
rather than ``prometheus-fastapi-instrumentator``, because that library resolves
route names by iterating ``app.routes`` and is incompatible with this FastAPI
version's lazy ``_IncludedRouter`` objects (it raises AttributeError on every
request). Labels are kept low-cardinality (service/method/status, no raw path).
"""
import logging
import sys
import time
import uuid
from contextvars import ContextVar

from prometheus_client import CONTENT_TYPE_LATEST, Counter, Histogram, generate_latest
from pythonjsonlogger import jsonlogger
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response

# Correlation id for the in-flight request; "-" when outside a request.
request_id_ctx: ContextVar[str] = ContextVar("request_id", default="-")

REQUEST_ID_HEADER = "X-Request-ID"

# Module-level metrics (one process per container, so defined once).
_REQUESTS = Counter(
    "http_requests_total",
    "Total HTTP requests",
    ["service", "method", "status"],
)
_LATENCY = Histogram(
    "http_request_duration_seconds",
    "HTTP request latency in seconds",
    ["service", "method"],
)


class _ContextFilter(logging.Filter):
    def __init__(self, service_name: str):
        super().__init__()
        self.service_name = service_name

    def filter(self, record: logging.LogRecord) -> bool:
        record.service = self.service_name
        record.request_id = request_id_ctx.get()
        return True


def _configure_logging(service_name: str) -> None:
    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(
        jsonlogger.JsonFormatter(
            "%(asctime)s %(levelname)s %(name)s %(service)s %(request_id)s %(message)s",
            rename_fields={"asctime": "timestamp", "levelname": "level"},
        )
    )
    handler.addFilter(_ContextFilter(service_name))
    root = logging.getLogger()
    root.handlers = [handler]
    root.setLevel(logging.INFO)
    # Route uvicorn's loggers through the same JSON handler.
    for name in ("uvicorn", "uvicorn.error", "uvicorn.access"):
        lg = logging.getLogger(name)
        lg.handlers = [handler]
        lg.propagate = False


class CorrelationIdMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        rid = (
            request.headers.get(REQUEST_ID_HEADER)
            or request.headers.get("X-Correlation-ID")
            or uuid.uuid4().hex
        )
        token = request_id_ctx.set(rid)
        try:
            response = await call_next(request)
        finally:
            request_id_ctx.reset(token)
        response.headers[REQUEST_ID_HEADER] = rid
        return response


class MetricsMiddleware(BaseHTTPMiddleware):
    def __init__(self, app, service_name: str):
        super().__init__(app)
        self.service_name = service_name

    async def dispatch(self, request: Request, call_next):
        if request.url.path == "/metrics":
            return await call_next(request)
        start = time.perf_counter()
        response = await call_next(request)
        elapsed = time.perf_counter() - start
        method = request.method
        _REQUESTS.labels(self.service_name, method, str(response.status_code)).inc()
        _LATENCY.labels(self.service_name, method).observe(elapsed)
        return response


def setup_observability(app, service_name: str):
    """Wire logging, correlation IDs and Prometheus metrics onto a FastAPI app."""
    _configure_logging(service_name)
    # add_middleware applies last-added as outermost, so CorrelationId wraps
    # Metrics and the request id is set before anything else runs.
    app.add_middleware(MetricsMiddleware, service_name=service_name)
    app.add_middleware(CorrelationIdMiddleware)

    async def metrics(_request: Request) -> Response:
        return Response(generate_latest(), media_type=CONTENT_TYPE_LATEST)

    # add_route registers a plain Starlette route (a real, introspectable route),
    # avoiding the included-router wrapper entirely.
    app.add_route("/metrics", metrics, methods=["GET"], include_in_schema=False)

    logging.getLogger(service_name).info("observability initialised")
    return app
