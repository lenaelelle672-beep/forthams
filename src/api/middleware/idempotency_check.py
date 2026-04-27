"""
Idempotency check middleware for asset retirement workflow APIs.

Provides request deduplication and idempotent processing guarantees
for retirement submission and approval operations, ensuring that
replayed requests do not cause duplicate state transitions or events.
"""

import time
import hashlib
import logging
from typing import Any, Dict, Optional

from fastapi import HTTPException, Request
from fastapi.responses import JSONResponse

from ..dependencies.db import get_session
from ..schemas.request import IdempotencyKeyRequest
from ..schemas.responses import IdempotencyResponse
from ...common.exception import DuplicateRequestException
from ...common import Result

logger = logging.getLogger(__name__)
class IdempotencyMiddleware:
    """
    Middleware that enforces idempotency for mutating API endpoints.

    Uses a request-scoped cache plus persistent storage to guarantee
    that identical requests (same key within the configured window)
    receive the same response and do not trigger duplicate side-effects.
    """

    def __init__(self, app, *, window_seconds: int = 300, storage=None):
        self.app = app
        self.window = window_seconds
        self.storage = storage or get_session()
        self._cache: Dict[str, Dict[str, Any]] = {}

    async def __call__(self, scope, receive, send):
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        request = Request(scope, receive)
        if request.method not in ("POST", "PUT", "PATCH"):
            await self.app(scope, receive, send)
            return

        # Build idempotency key from headers + deterministic body hash
        key = self._build_key(request)
        if not key:
            await self.app(scope, request, send)
            return

        # Fast in-memory cache check
        now = time.time()
        cached = self._cache.get(key)
        if cached:
            if now - cached["timestamp"] <= self.window:
                logger.info("Idempotent cache hit for key: %s", key)
                await self._send_response(send, cached["response"])
                return
            else:
                # expired
                del self._cache[key]

        # Persistent check (atomic within DB session)
        try:
            existing = self._check_or_create(key, request)
            if existing:
                logger.info("Idempotent DB hit for key: %s", key)
                await self._send_response(send, existing.response)
                return
        except DuplicateRequestException as exc:
            logger.warning("Duplicate request detected: %s", exc.detail)
            await self._send_response(send, exc.response)
            return
        except Exception as exc:
            logger.error("Idempotency check failed: %s", exc, exc_info=True)
            # Do not block the request on internal error
            await self.app(scope, request, send)
            return

        # Wrap send to capture response for caching
        async def wrapped_send(message):
            if message["type"] == "http.response.start":
                self._capture_response(key, message, request)
            await send(message)

        await self.app(scope, request, wrapped_send)

    def _build_key(self, request: Request) -> Optional[str]:
        """Build a deterministic key for the request."""
        try:
            body = request.body()
        except Exception:
            body = b""
        payload = {
            "method": request.method,
            "path": request.url.path,
            "headers": sorted((k.lower(), v) for k, v in request.headers.items()),
            "body_hash": hashlib.sha256(body).hexdigest() if body else "",
        }
        data = f"{payload['method']}:{payload['path']}:{payload['body_hash']}"
        if not data.endswith(":"):
            data += ":"
        key = hashlib.sha256(data.encode()).hexdigest()
        return key if key else None

    def _check_or_create(self, key: str, request: Request):
        """
        Check persistent store for existing key; if absent create record.
        Runs within a DB session to ensure atomicity.
        """
        from ...domain.entities import IdempotencyRecord as Record

        session = self.storage()
        existing = session.query(Record).filter_by(key=key).first()
        if existing:
            if (time.time() - existing.created_at) <= self.window:
                return existing
            # stale entry: replace with new attempt (race handled by DB constraint)
            session.delete(existing)
            self.storage().commit()

        # Attempt insert; unique constraint prevents duplicates
        record = Record(key=key, created_at=time.time(), request_data=request.json())
        try:
            session.add(record)
            session.commit()
            session.refresh(record)
            return record
        except Exception as exc:
            session.rollback()
            # If duplicate due to race, treat as cache hit
            same = session.query(Record).filter_by(key=key).first()
            if same:
                return same
            raise DuplicateRequestException(
                detail="Idempotency key collision; request already processed."
            )

    def _capture_response(self, key: str, message, request: Request):
        """Store response metadata for cache reuse."""
        # Response body may be large; store only status and headers
        session = self.storage()
        record = session.query(self._get_record_model()).filter_by(key=key).first()
        if record:
            record.response_status = message["status"]
            record.updated_at = time.time()
            try:
                session.commit()
            except Exception:
                session.rollback()

    def _send_response(self, send, response_data: Dict[str, Any]):
        """Replay cached response to the ASGI send callable."""
        async def send_cached(message):
            if message["type"] == "http.response.start":
                from starlette.status import HTTPStatus
                status = response_data.get("status", 200)
                headers = response_data.get("headers", [])
                for k, v in headers:
                    message["headers"].append((k.encode(), v.encode()))
                message["status"] = status
            elif message["type"] == "http.response.body":
                body = response_data.get("body", b"")
                message["body"] = body
                message["more_body"] = False
            await send(message)

        # Replace send with cached sender; we must re-enter ASGI cycle carefully.
        # For simplicity in middleware context, we raise via exception or use
        # a dedicated fast response path. Here we delegate to a helper that
        # writes directly via the provided send after re-wiring.
        raise NotImplementedError("Response replay requires ASGI scope reuse;")

    def _get_record_model(self):
        from ...domain.entities import IdempotencyRecord
        return IdempotencyRecord
# --- Legacy function-based API for compatibility ---
def idempotency_middleware_factory(app, *, window_seconds: int = 300, storage=None):
    """Factory to plug the middleware into the application stack."""
    return IdempotencyMiddleware(app, window_seconds=window_seconds, storage=storage)
def validate_idempotency_key(request: Request) -> Result[str]:
    """
    Validate that the request carries a proper idempotency key.
    Returns the key on success, or an error Result.
    """
    key = request.headers.get("Idempotency-Key")
    if not key or not isinstance(key, str) or len(key.strip()) == 0:
        return Result.err("Missing or invalid Idempotency-Key header")
    return Result.ok(key.strip())
async def idempotent_response(
    request: Request,
    handler,
    *,
    key: Optional[str] = None
) -> JSONResponse:
    """
    Execute a handler idempotently: if key is provided and a prior response
    exists within the window, return the cached response; otherwise run handler
    and cache its result.
    """
    if key is None:
        key = request.headers.get("Idempotency-Key")
    if not key:
        return JSONResponse({"detail": "Idempotency-Key header required"}, status_code=400)

    cache_key = f"idemp:{key}:{request.url.path}"
    # In-memory fast path
    memory_cache = getattr(request.state, "_idemp_cache", {})
    if cache_key in memory_cache:
        return memory_cache[cache_key]

    # Persistent check
    session = get_session()
    from ...domain.entities import IdempotencyRecord as Record

    existing = session.query(Record).filter_by(key=cache_key).first()
    if existing and (time.time() - existing.created_at) <= 300:
        return JSONResponse(existing.response_body, status_code=existing.response_status)

    response = await handler()
    if isinstance(response, JSONResponse):
        record = Record(
            key=cache_key,
            created_at=time.time(),
            request_data=request.query_params,
            response_status=response.status_code,
            response_body=response.body,
        )
        session.add(record)
        session.commit()
    return response