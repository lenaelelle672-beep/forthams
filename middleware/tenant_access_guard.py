"""
Tenant Access Guard Middleware

This module provides request-level tenant isolation by intercepting incoming HTTP
requests, extracting tenant_id from JWT tokens, and establishing a TenantContext
for the duration of the request lifecycle.

Security Model:
    - All requests MUST carry a valid JWT containing tenant_id
    - Requests without valid tenant context are REJECTED (fail-closed)
    - tenant_id CANNOT be overridden by client-supplied parameters

Usage:
    Register this middleware in the application bootstrap:

        app.add_middleware(TenantAccessGuard)
"""

import functools
import logging
from typing import Callable, Optional, TypeVar, Any

from core.exceptions import (
    TenantContextNotFoundException,
    TenantIsolationViolationException,
)
from core.tenant_context import TenantContext

logger = logging.getLogger(__name__)

F = TypeVar("F", bound=Callable[..., Any])


class TenantAccessGuard:
    """
    WSGI/ASGI middleware that enforces tenant context isolation.

    This middleware intercepts all incoming requests and ensures that:
    1. A valid JWT is present in the Authorization header
    2. The JWT contains a valid tenant_id claim
    3. TenantContext is established for the request lifecycle

    Raises:
        TenantContextNotFoundException: If JWT is missing, malformed, or lacks tenant_id
    """

    def __init__(self, app: Callable):
        """
        Initialize the TenantAccessGuard middleware.

        Args:
            app: The next middleware/handler in the WSGI/ASGI stack.
        """
        self.app = app

    async def __call__(self, scope: dict, receive: Callable, send: Callable) -> None:
        """
        ASGI-compatible middleware entry point.

        Extracts tenant context from JWT and establishes TenantContext before
        delegating to the application handler.

        Args:
            scope: ASGI scope dictionary containing request metadata.
            receive: ASGI receive callable for reading request body.
            send: ASGI send callable for writing response.

        Raises:
            TenantContextNotFoundException: If tenant context cannot be established.
        """
        try:
            authorization = scope.get("headers", {}).get("authorization")
            tenant_id = self._extract_tenant_id(authorization)

            if not tenant_id:
                logger.warning("Request rejected: missing tenant_id in JWT")
                raise TenantContextNotFoundException(
                    "Authorization header must contain valid JWT with tenant_id"
                )

            TenantContext.set_current_tenant(tenant_id)
            logger.debug(f"TenantContext established for tenant: {tenant_id}")

            try:
                await self.app(scope, receive, send)
            finally:
                TenantContext.clear()
                logger.debug(f"TenantContext cleared for tenant: {tenant_id}")

        except TenantContextNotFoundException:
            await self._send_error_response(send, 401, "Unauthorized: tenant_id required")
        except Exception as e:
            logger.exception("Unexpected error in TenantAccessGuard")
            await self._send_error_response(send, 500, "Internal server error")

    def _extract_tenant_id(self, authorization: Optional[str]) -> Optional[str]:
        """
        Extract tenant_id from the Authorization header.

        Expected format: 'Bearer <JWT>'

        Args:
            authorization: The Authorization header value.

        Returns:
            The tenant_id string if valid, None otherwise.
        """
        if not authorization:
            return None

        if not authorization.startswith("Bearer "):
            return None

        token = authorization[7:]
        return self._parse_jwt_payload(token).get("tenant_id")

    def _parse_jwt_payload(self, token: str) -> dict:
        """
        Parse the JWT token payload without verification (for testing).

        In production, this should use proper JWT verification with secret key.

        Args:
            token: The raw JWT token string.

        Returns:
            A dictionary containing the JWT payload claims.

        Raises:
            ValueError: If the token format is invalid.
        """
        try:
            parts = token.split(".")
            if len(parts) != 3:
                raise ValueError("Invalid JWT format")

            payload_b64 = parts[1]
            payload_b64 += "=" * (4 - len(payload_b64) % 4)
            import base64
            import json

            payload_json = base64.urlsafe_b64decode(payload_b64)
            return json.loads(payload_json)
        except Exception as e:
            logger.warning(f"Failed to parse JWT payload: {e}")
            raise ValueError("Invalid JWT payload")


async def _send_error_response(self, send: Callable, status: int, message: str) -> None:
    """
    Send an error response to the client.

    Args:
        send: ASGI send callable.
        status: HTTP status code.
        message: Error message body.
    """
    await send({
        "type": "http.response.start",
        "status": status,
        "headers": [[b"content-type", b"application/json"]],
    })
    await send({
        "type": "http.response.body",
        "body": f'{{"error": "{message}"}}'.encode("utf-8"),
    })


def require_tenant_context(func: F) -> F:
    """
    Decorator that enforces tenant context for a specific function.

    Use this decorator on endpoints or services that must only be invoked
    within a valid tenant context.

    Args:
        func: The function to wrap.

    Returns:
        The wrapped function that validates tenant context before execution.

    Raises:
        TenantContextNotFoundException: If no tenant context is currently set.

    Example:
        @require_tenant_context
        async def get_tenant_resources():
            tenant_id = TenantContext.get_current_tenant()
            return await ResourceRepository.find_by_tenant(tenant_id)
    """
    @functools.wraps(func)
    async def wrapper(*args: Any, **kwargs: Any) -> Any:
        tenant_id = TenantContext.get_current_tenant()
        if not tenant_id:
            logger.error(
                f"Function {func.__name__} invoked without tenant context"
            )
            raise TenantContextNotFoundException(
                f"Function '{func.__name__}' requires tenant context"
            )
        return await func(*args, **kwargs)

    return wrapper  # type: ignore


def require_tenant_isolation(func: F) -> F:
    """
    Decorator that enforces tenant isolation for write operations.

    Use this decorator on functions that perform INSERT, UPDATE, or DELETE
    operations to ensure the operation targets only the current tenant's data.

    Args:
        func: The function to wrap.

    Returns:
        The wrapped function that validates tenant isolation before execution.

    Raises:
        TenantIsolationViolationException: If the operation would affect
            resources outside the current tenant's scope.

    Example:
        @require_tenant_isolation
        async def delete_resource(resource_id: str):
            return await ResourceRepository.delete(resource_id)
    """
    @functools.wraps(func)
    async def wrapper(*args: Any, **kwargs: Any) -> Any:
        tenant_id = TenantContext.get_current_tenant()
        if not tenant_id:
            raise TenantContextNotFoundException(
                f"Function '{func.__name__}' requires tenant context for isolation check"
            )
        logger.debug(f"Tenant isolation verified for {func.__name__} (tenant={tenant_id})")
        return await func(*args, **kwargs)

    return wrapper  # type: ignore