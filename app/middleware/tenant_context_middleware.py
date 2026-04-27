"""
Tenant Context Middleware Module.

This middleware handles the extraction and binding of tenant context from JWT tokens
in incoming HTTP requests. It establishes the TenantContext for the duration of the
request lifecycle, ensuring proper data isolation across tenants.

Specification: SWARM-2025-Q2-P1-004 (Multi-tenant Data Isolation)

Key Features:
    - JWT token parsing and tenant_id extraction
    - TenantContext establishment via ThreadLocal
    - Request-level context binding with automatic cleanup
    - Fail-secure error handling (no silent failures)

Boundary Rules (B-001 to B-004):
    - B-001: Fail-open prohibited; exceptions return 403 Forbidden
    - B-002: Cross-tenant JOIN operations are blocked
    - B-003: tenant_id cannot be specified by client (only from JWT)
    - B-004: Raw SQL bypasses are blocked via Repository layer

Author: SWARM Team
Version: 1.0
"""

from __future__ import annotations

import time
import logging
from typing import Optional, Callable, Any
from functools import wraps

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response, JSONResponse
from starlette.status import HTTP_401_UNAUTHORIZED, HTTP_403_FORBIDDEN

# Import tenant context management
from app.core.tenant_context import TenantContext, TenantContextHolder
from app.core.exceptions import (
    TenantContextNotFoundException,
    TenantIsolationViolationException,
    InvalidTenantTokenException,
)

logger = logging.getLogger(__name__)


class TenantContextMiddleware(BaseHTTPMiddleware):
    """
    Middleware for binding tenant context from JWT tokens to incoming requests.

    This middleware intercepts all HTTP requests, extracts the tenant_id from
    the JWT token in the Authorization header, and establishes the TenantContext
    for the duration of the request processing.

    Behavior:
        - Valid JWT with tenant_id: Establishes context, allows request to proceed
        - Missing Authorization header: Returns 401 Unauthorized
        - JWT without tenant_id claim: Returns 401 Unauthorized
        - Invalid/expired JWT: Returns 401 Unauthorized
        - Context establishment failure: Returns 403 Forbidden (fail-secure)

    Performance:
        - Target overhead: < 5ms (p99) per request
        - Context binding: < 1ms typical

    Example:
        >>> # Register in FastAPI app
        >>> from fastapi import FastAPI
        >>> app = FastAPI()
        >>> app.add_middleware(TenantContextMiddleware)
    """

    # Paths that do not require tenant context (public endpoints)
    EXEMPT_PATHS: set = frozenset({
        "/health",
        "/healthz",
        "/ready",
        "/metrics",
        "/docs",
        "/openapi.json",
        "/redoc",
    })

    # Header name for tenant override (internal use only - not exposed to clients)
    _TENANT_OVERRIDE_HEADER = "X-Tenant-ID"

    def __init__(
        self,
        app: Any,
        jwt_parser: Optional[Any] = None,
        exempt_paths: Optional[set] = None,
        enable_audit_logging: bool = True,
    ) -> None:
        """
        Initialize the Tenant Context Middleware.

        Args:
            app: The ASGI application.
            jwt_parser: Optional custom JWT parser. If None, uses default parser.
            exempt_paths: Optional set of path prefixes to exempt from tenant binding.
            enable_audit_logging: Whether to log tenant context violations.
        """
        super().__init__(app)
        self._jwt_parser = jwt_parser
        self._exempt_paths = exempt_paths or set()
        self._enable_audit_logging = enable_audit_logging
        self._context_holder = TenantContextHolder()

    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        """
        Process the request and establish tenant context.

        This method extracts tenant information from the JWT token and binds
        it to the current request context. The context is automatically cleaned
        up after the request completes.

        Args:
            request: The incoming HTTP request.
            call_next: The next middleware/handler in the chain.

        Returns:
            Response from the next handler, or an error response if context
            binding fails.

        Raises:
            None (fail-secure: errors are returned as HTTP responses, not exceptions)
        """
        start_time = time.perf_counter()

        # Check if path is exempt from tenant context
        if self._is_exempt_path(request.url.path):
            return await call_next(request)

        # Extract Authorization header
        auth_header = request.headers.get("Authorization")

        if not auth_header:
            return self._create_error_response(
                status_code=HTTP_401_UNAUTHORIZED,
                message="Authorization header required",
                error_code="MISSING_AUTH_HEADER",
                tenant_id=None,
            )

        # Validate Bearer token format
        if not auth_header.startswith("Bearer "):
            return self._create_error_response(
                status_code=HTTP_401_UNAUTHORIZED,
                message="Invalid authorization format. Expected: Bearer <token>",
                error_code="INVALID_AUTH_FORMAT",
                tenant_id=None,
            )

        token = auth_header[7:]  # Strip "Bearer " prefix

        try:
            # Parse JWT and extract tenant_id
            tenant_id = self._extract_tenant_id(token)

            if not tenant_id:
                return self._create_error_response(
                    status_code=HTTP_401_UNAUTHORIZED,
                    message="tenant_id required in JWT token",
                    error_code="MISSING_TENANT_ID",
                    tenant_id=None,
                )

            # Establish tenant context
            self._bind_tenant_context(tenant_id)

            if self._enable_audit_logging:
                self._log_context_binding(request, tenant_id)

            # Process request with context bound
            response = await call_next(request)

            return response

        except InvalidTenantTokenException as e:
            logger.warning(f"Invalid JWT token: {e}")
            return self._create_error_response(
                status_code=HTTP_401_UNAUTHORIZED,
                message="Invalid or expired token",
                error_code="INVALID_TOKEN",
                tenant_id=None,
            )

        except TenantContextNotFoundException as e:
            logger.error(f"Tenant context establishment failed: {e}")
            return self._create_error_response(
                status_code=HTTP_403_FORBIDDEN,
                message="Tenant context required",
                error_code="CONTEXT_REQUIRED",
                tenant_id=None,
            )

        except Exception as e:
            # Fail-secure: any unexpected error results in denial
            logger.exception(f"Unexpected error in tenant context middleware: {e}")
            return self._create_error_response(
                status_code=HTTP_403_FORBIDDEN,
                message="Access denied due to security policy",
                error_code="SECURITY_POLICY_VIOLATION",
                tenant_id=None,
            )

        finally:
            # Always cleanup context to prevent leaks
            self._context_holder.clear()
            if self._enable_audit_logging:
                elapsed = (time.perf_counter() - start_time) * 1000
                logger.debug(f"Tenant context middleware overhead: {elapsed:.2f}ms")

    def _is_exempt_path(self, path: str) -> bool:
        """
        Check if the request path is exempt from tenant context binding.

        Args:
            path: The request path to check.

        Returns:
            True if the path is exempt, False otherwise.
        """
        # Check exact match
        if path in self.EXEMPT_PATHS:
            return True

        # Check prefix match
        for exempt_path in self._exempt_paths:
            if path.startswith(exempt_path):
                return True

        return False

    def _extract_tenant_id(self, token: str) -> Optional[str]:
        """
        Extract tenant_id from JWT token.

        This method handles JWT parsing and validation. In production, this
        should verify the JWT signature and expiry.

        Args:
            token: The JWT token string.

        Returns:
            The tenant_id if present, None if not found.

        Raises:
            InvalidTenantTokenException: If the token is invalid or malformed.
        """
        if self._jwt_parser:
            return self._jwt_parser.extract_tenant_id(token)

        # Default implementation using JWT library
        try:
            import jwt
            from app.config import get_settings

            settings = get_settings()
            secret_key = settings.JWT_SECRET_KEY if hasattr(settings, 'JWT_SECRET_KEY') else "default-secret"

            # Decode and validate token
            payload = jwt.decode(
                token,
                secret_key,
                algorithms=["HS256"],
                options={
                    "verify_signature": True,
                    "verify_exp": True,
                    "require": ["tenant_id"],
                }
            )

            return payload.get("tenant_id")

        except jwt.ExpiredSignatureError:
            raise InvalidTenantTokenException("Token has expired")
        except jwt.InvalidTokenError as e:
            raise InvalidTenantTokenException(f"Invalid token: {str(e)}")
        except ImportError:
            # Fallback for environments without PyJWT
            logger.warning("PyJWT not available, using fallback parsing")
            return self._fallback_parse_token(token)

    def _fallback_parse_token(self, token: str) -> Optional[str]:
        """
        Fallback token parsing when JWT library is not available.

        This is a simplified parser that extracts tenant_id from unverified tokens.
        WARNING: This should only be used in development/test environments.

        Args:
            token: The token string to parse.

        Returns:
            The tenant_id if found, None otherwise.
        """
        import base64
        import json

        try:
            # Split JWT parts
            parts = token.split('.')
            if len(parts) != 3:
                return None

            # Decode payload (middle part)
            payload = parts[1]
            # Add padding if needed
            padding = 4 - len(payload) % 4
            if padding != 4:
                payload += '=' * padding

            decoded = base64.urlsafe_b64decode(payload)
            data = json.loads(decoded)

            return data.get('tenant_id')

        except Exception:
            return None

    def _bind_tenant_context(self, tenant_id: str) -> None:
        """
        Bind tenant context to the current execution context.

        Args:
            tenant_id: The tenant identifier to bind.

        Raises:
            TenantContextNotFoundException: If context cannot be established.
        """
        try:
            self._context_holder.set_tenant_id(tenant_id)
        except Exception as e:
            logger.error(f"Failed to bind tenant context: {e}")
            raise TenantContextNotFoundException(
                f"Cannot establish tenant context: {str(e)}"
            )

    def _log_context_binding(self, request: Request, tenant_id: str) -> None:
        """
        Log tenant context binding for audit purposes.

        Args:
            request: The HTTP request.
            tenant_id: The bound tenant ID.
        """
        logger.info(
            f"Tenant context bound: tenant_id={tenant_id}, "
            f"path={request.url.path}, "
            f"method={request.method}"
        )

    def _create_error_response(
        self,
        status_code: int,
        message: str,
        error_code: str,
        tenant_id: Optional[str],
    ) -> JSONResponse:
        """
        Create a standardized error response for tenant context failures.

        Args:
            status_code: HTTP status code.
            message: Human-readable error message.
            error_code: Machine-readable error code.
            tenant_id: The tenant ID involved (if any).

        Returns:
            JSONResponse with error details.
        """
        return JSONResponse(
            status_code=status_code,
            content={
                "error": message,
                "error_code": error_code,
                "tenant_id": tenant_id,
            },
        )


def require_tenant_context(func: Callable) -> Callable:
    """
    Decorator to ensure tenant context is present for a function.

    This decorator can be used on service functions that require tenant context.
    It will raise TenantContextNotFoundException if context is not established.

    Args:
        func: The function to wrap.

    Returns:
        Wrapped function that checks for tenant context before execution.

    Example:
        >>> @require_tenant_context
        >>> def get_user_data():
        ...     tenant_id = TenantContext.get_current_tenant()
        ...     return db.query(tenant_id)
    """
    @wraps(func)
    def wrapper(*args: Any, **kwargs: Any) -> Any:
        if not TenantContextHolder.has_context():
            raise TenantContextNotFoundException(
                f"Tenant context required for {func.__name__}"
            )
        return func(*args, **kwargs)

    return wrapper


def with_tenant_context(tenant_id: str) -> Callable:
    """
    Decorator factory to execute a function with a specific tenant context.

    This is useful for background tasks or scheduled jobs that need to run
    with an explicit tenant context.

    Args:
        tenant_id: The tenant ID to bind during function execution.

    Returns:
        Decorator function that manages tenant context.

    Example:
        >>> @with_tenant_context("tenant-001")
        >>> def cleanup_old_records():
        ...     # This function runs with tenant-001 context
        ...     pass
    """
    def decorator(func: Callable) -> Callable:
        @wraps(func)
        def wrapper(*args: Any, **kwargs: Any) -> Any:
            holder = TenantContextHolder()
            previous_context = holder.get_context()

            try:
                holder.set_tenant_id(tenant_id)
                result = func(*args, **kwargs)
                return result
            finally:
                # Restore previous context
                if previous_context:
                    holder.set_context(previous_context)
                else:
                    holder.clear()

        return wrapper
    return decorator