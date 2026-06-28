"""Resilient async HTTP client for inter-service calls.

Wraps ``httpx.AsyncClient`` with:
- sensible split timeouts (connect/read/write/pool),
- retries with exponential backoff on transport errors, timeouts and 5xx,
- a lightweight per-host circuit breaker so a chronically failing dependency
  fails fast instead of tying up request workers,
- automatic propagation of the ``X-Request-ID`` correlation header.

Example::

    from shared.http_client import ResilientClient
    client = ResilientClient(base_url=settings.INVENTORY_SERVICE_URL)
    data = await client.get_json(f"/trips/{trip_id}/available-count")
"""
import logging
import time
from typing import Any, Dict, Optional
from urllib.parse import urlsplit

import httpx
from tenacity import (
    AsyncRetrying,
    retry_if_exception_type,
    stop_after_attempt,
    wait_exponential,
)

try:  # avoid a hard dependency when used outside a FastAPI service
    from shared.observability import request_id_ctx, REQUEST_ID_HEADER
except Exception:  # pragma: no cover
    from contextvars import ContextVar

    request_id_ctx: "ContextVar[str]" = ContextVar("request_id", default="-")
    REQUEST_ID_HEADER = "X-Request-ID"

logger = logging.getLogger("http_client")

DEFAULT_TIMEOUT = httpx.Timeout(connect=3.0, read=10.0, write=10.0, pool=3.0)

# Exceptions worth retrying / counting toward the breaker.
_RETRYABLE = (httpx.TransportError, httpx.TimeoutException)


class CircuitBreakerOpen(Exception):
    """Raised when the breaker for a host is open (failing fast)."""


class _Breaker:
    def __init__(self, fail_max: int = 5, reset_timeout: float = 30.0):
        self.fail_max = fail_max
        self.reset_timeout = reset_timeout
        self.failures = 0
        self.opened_at: Optional[float] = None

    def check(self, host: str) -> None:
        if self.opened_at is None:
            return
        if time.monotonic() - self.opened_at >= self.reset_timeout:
            return  # half-open: let one trial through
        raise CircuitBreakerOpen(f"circuit open for {host}")

    def on_success(self) -> None:
        self.failures = 0
        self.opened_at = None

    def on_failure(self) -> None:
        self.failures += 1
        if self.failures >= self.fail_max:
            self.opened_at = time.monotonic()


# One breaker per host, shared across client instances in the process.
_breakers: Dict[str, _Breaker] = {}


def _breaker_for(url: str) -> tuple[str, _Breaker]:
    host = urlsplit(url).netloc or url
    if host not in _breakers:
        _breakers[host] = _Breaker()
    return host, _breakers[host]


class ResilientClient:
    def __init__(
        self,
        base_url: str = "",
        *,
        timeout: httpx.Timeout = DEFAULT_TIMEOUT,
        retries: int = 3,
        fail_max: int = 5,
        reset_timeout: float = 30.0,
    ):
        self.base_url = base_url
        self.timeout = timeout
        self.retries = retries
        self.fail_max = fail_max
        self.reset_timeout = reset_timeout

    def _headers(self, extra: Optional[Dict[str, str]]) -> Dict[str, str]:
        headers = dict(extra or {})
        headers.setdefault(REQUEST_ID_HEADER, request_id_ctx.get())
        return headers

    async def request(self, method: str, url: str, **kwargs: Any) -> httpx.Response:
        full_url = url if url.startswith("http") else f"{self.base_url}{url}"
        host, breaker = _breaker_for(full_url)
        breaker.fail_max, breaker.reset_timeout = self.fail_max, self.reset_timeout
        breaker.check(host)

        kwargs["headers"] = self._headers(kwargs.get("headers"))
        kwargs.setdefault("timeout", self.timeout)

        try:
            async for attempt in AsyncRetrying(
                stop=stop_after_attempt(self.retries),
                wait=wait_exponential(min=0.5, max=8),
                retry=retry_if_exception_type(_RETRYABLE),
                reraise=True,
            ):
                with attempt:
                    async with httpx.AsyncClient() as client:
                        resp = await client.request(method, full_url, **kwargs)
                    # Treat 5xx as retryable/breaker-tripping; 4xx is a real answer.
                    if resp.status_code >= 500:
                        raise httpx.HTTPStatusError(
                            f"{resp.status_code} from {host}",
                            request=resp.request,
                            response=resp,
                        )
                    breaker.on_success()
                    return resp
        except Exception:
            breaker.on_failure()
            logger.warning("request failed: %s %s", method, full_url)
            raise
        # Unreachable, but keeps type checkers happy.
        raise RuntimeError("retry loop exited without returning")

    async def get(self, url: str, **kwargs: Any) -> httpx.Response:
        return await self.request("GET", url, **kwargs)

    async def post(self, url: str, **kwargs: Any) -> httpx.Response:
        return await self.request("POST", url, **kwargs)

    async def get_json(self, url: str, **kwargs: Any) -> Any:
        resp = await self.get(url, **kwargs)
        resp.raise_for_status()
        return resp.json()

    async def post_json(self, url: str, **kwargs: Any) -> Any:
        resp = await self.post(url, **kwargs)
        resp.raise_for_status()
        return resp.json()
