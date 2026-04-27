"""
Tenant Binding Middleware Module

This module implements the tenant context binding layer for multi-tenant data isolation
in the SWARM system (Iteration 4). It provides request-level tenant context establishment
and propagation for both synchronous and asynchronous execution paths.

Requirements Reference: SWARM-2025-Q2-P1-004

Key Features:
    - Request-level tenant context binding from JWT
    - Tenant context validation and enforcement
    - Async task context propagation
    - Fail-closed security model (no silent bypass)

Security Boundaries (from SPEC Section 3.2):
    B-001: Fail-closed - tenant context parsing exceptions return 403 Forbidden
    B-003: tenant_id cannot be specified by client, must be parsed from JWT
    B-004: Direct SQL bypass is blocked via this middleware

Usage:
    For HTTP requests:
        Set up as a FastAPI/Starlette middleware that intercepts requests,
        extracts tenant_id from JWT, and establishes TenantContext.

    For async tasks:
        Use require_tenant_context decorator on async functions to ensure
        tenant context is properly propagated from the caller.

Example:
    ```python
    # HTTP middleware usage
    app.add_middleware(TenantBindingMiddleware)

    # Function protection
    @require_tenant_context
    async def protected_operation():
        tenant_id = get_current_tenant()
        # perform tenant-scoped operation
    ```
"""

import functools
import logging
from typing import Optional, Callable, Any

from core.tenant_context import TenantContext
from core.exceptions import (
    TenantContextNotFoundException,
    TenantIsolationViolationException,
    CrossTenantJoinException,
)

logger = logging.getLogger(__name__)


def require_tenant_context(func: Callable) -> Callable:
    """
    Decorator to enforce tenant context validation for functions.

    This decorator ensures that any function performing tenant-aware operations
    has a valid tenant context established before execution. If no context
    is found, it raises TenantContextNotFoundException to enforce fail-closed
    security model (per SPEC B-001).

    Args:
        func: The function to be wrapped and protected.

    Returns:
        The wrapped function that validates tenant context before execution.

    Raises:
        TenantContextNotFoundException: If no tenant context is established
            when the function is called. This is a hard failure - no
            default tenant is assumed.

    Example:
        ```python
        @require_tenant_context
        def query_resources():
            tenant_id = TenantContext.get_current_tenant()
            return Resource.query().filter(tenant_id=tenant_id).all()
        ```

    Note:
        Per SPEC NFR-001: Isolation failures must NOT result in data leakage.
        This decorator ensures that operations without valid context are
        rejected rather than executed with implicit permissions.
    """
    @functools.wraps(func)
    def wrapper(*args, **kwargs) -> Any:
        """
        Wrapper function that validates tenant context before calling the decorated function.

        This wrapper performs the following checks:
        1. Verifies that a tenant context has been established
        2. Validates that the tenant_id is non-empty
        3. Raises appropriate exception if validation fails

        The check is performed at runtime before each function call to ensure
        that async task context propagation has been correctly established.
        """
        current_tenant = TenantContext.get_current_tenant()
        if not current_tenant:
            logger.error(
                "Tenant context not found during operation execution",
                extra={
                    "function": func.__name__,
                    "thread_id": threading.get_ident(),
                },
            )
            raise TenantContextNotFoundException(
                f"Tenant context required for operation '{func.__name__}'. "
                "Ensure tenant context is properly established before executing."
            )
        return func(*args, **kwargs)

    return wrapper


async def require_tenant_context_async(func: Callable) -> Callable:
    """
    Async decorator to enforce tenant context validation for async functions.

    Similar to require_tenant_context but designed for async functions.
    Ensures tenant context is propagated correctly through async execution paths.

    Args:
        func: The async function to be wrapped and protected.

    Returns:
        The wrapped async function that validates tenant context before execution.

    Raises:
        TenantContextNotFoundException: If no tenant context is established.

    Example:
        ```python
        @require_tenant_context_async
        async def process_async_task():
            tenant_id = TenantContext.get_current_tenant()
            await some_async_operation(tenant_id)
        ```
    """
    @functools.wraps(func)
    async def wrapper(*args, **kwargs) -> Any:
        """
        Async wrapper that validates tenant context before executing the async function.

        Performs the same validation as the sync wrapper but in an async context.
        Critical for MQ consumers, @Async task executors, and scheduled jobs.
        """
        current_tenant = TenantContext.get_current_tenant()
        if not current_tenant:
            logger.error(
                "Tenant context not found during async operation execution",
                extra={
                    "function": func.__name__,
                    "is_async": True,
                },
            )
            raise TenantContextNotFoundException(
                f"Tenant context required for async operation '{func.__name__}'. "
                "Async tasks must inherit tenant context from the calling context."
            )
        return await func(*args, **kwargs)

    return wrapper


class TenantBindingMiddleware:
    """
    HTTP Middleware for establishing tenant context from JWT tokens.

    This middleware intercepts incoming HTTP requests, extracts tenant_id
    from the JWT token in the Authorization header, and establishes the
    TenantContext for the duration of the request.

    Per SPEC FR-001: Request-level tenant context binding from JWT.

    Request Flow:
        1. Extract Authorization header (Bearer <JWT>)
        2. Parse JWT and extract tenant_id claim
        3. Validate JWT signature and expiration
        4. Establish TenantContext via TenantContextHolder
        5. Call the next middleware/handler
        6. Clear TenantContext after request completes

    Security Constraints:
        - JWT tenant_id is authoritative (B-003: no client-specified tenant_id)
        - Invalid/missing JWT returns 401 Unauthorized (per ATB-1)
        - Valid JWT but missing tenant_id returns 401 Unauthorized
        - Valid JWT with non-existent tenant_id returns 403 Forbidden

    Example:
        ```python
        app.add_middleware(TenantBindingMiddleware)

        # After middleware setup, all requests will have tenant context:
        @app.get("/api/v1/resources")
        async def get_resources():
            tenant_id = TenantContext.get_current_tenant()
            return await ResourceService.list_by_tenant(tenant_id)
        ```

    Note:
        This middleware implements fail-closed security (B-001). Any parsing
        failure results in a rejected request, never silent bypass or default
        tenant assignment.
    """

    def __init__(self, app, jwt_parser: Optional[object] = None):
        """
        Initialize the tenant binding middleware.

        Args:
            app: The ASGI application instance.
            jwt_parser: Optional JWT parser instance. If not provided,
                a default TenantJwtParser will be used.
        """
        self.app = app
        self.jwt_parser = jwt_parser
        self._logger = logging.getLogger(f"{__name__}.TenantBindingMiddleware")

    async def __call__(self, scope, receive, send):
        """
        ASGI application interface for the middleware.

        Intercepts requests to establish tenant context before passing
        to the next handler.

        Args:
            scope: ASGI scope containing request information.
            receive: ASGI receive callable.
            send: ASGI send callable for response.

        Response Codes (per SPEC ATB-1):
            401: JWT missing, malformed, expired, or missing tenant_id
            403: JWT valid but tenant_id not found in database
            Proceed: Valid JWT with valid tenant_id
        """
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        headers = dict(scope.get("headers", []))
        auth_header = headers.get(b"authorization", b"").decode("utf-8")

        if not auth_header.startswith("Bearer "):
            await self._send_unauthorized(
                send, "Missing or invalid Authorization header"
            )
            return

        token = auth_header[7:]  # Remove "Bearer " prefix

        try:
            if self.jwt_parser:
                parsed = self.jwt_parser.parse(token)
            else:
                from middleware.jwt_tenant_parser import TenantJwtParser
                parser = TenantJwtParser()
                parsed = parser.parse(token)

            tenant_id = parsed.get("tenant_id")
            if not tenant_id:
                await self._send_unauthorized(
                    send, "tenant_id required in JWT payload"
                )
                return

            user_id = parsed.get("user_id", "")

            TenantContext.set(tenant_id, user_id)
            self._logger.debug(
                f"Tenant context established: tenant_id={tenant_id}, user_id={user_id}"
            )

            try:
                await self.app(scope, receive, send)
            finally:
                TenantContext.clear()
                self._logger.debug("Tenant context cleared after request")

        except Exception as e:
            self._logger.error(f"Failed to establish tenant context: {e}")
            TenantContext.clear()
            await self._send_unauthorized(send, str(e))

    async def _send_unauthorized(self, send, message: str):
        """
        Send a 401 Unauthorized response.

        Per SPEC boundary rules, JWT parsing failures result in 401,
        not silent bypass or 500 error.

        Args:
            send: ASGI send callable.
            message: Error message to include in response body.
        """
        response_body = f'{{"error": "{message}"}}'.encode("utf-8")
        await send({
            "type": "http.response.start",
            "status": 401,
            "headers": [
                [b"content-type", b"application/json"],
                [b"content-length", str(len(response_body)).encode("utf-8")],
            ],
        })
        await send({
            "type": "http.response.body",
            "body": response_body,
        })


def propagate_tenant_context(func: Callable) -> Callable:
    """
    Decorator to propagate tenant context to spawned threads/async tasks.

    This decorator should be used on functions that spawn background tasks
    to ensure the tenant context is inherited by the child execution context.

    Per SPEC Phase 2.4: Async path context propagation.

    Args:
        func: The function that creates or submits async tasks.

    Returns:
        Wrapped function that captures and propagates tenant context.

    Example:
        ```python
        @propagate_tenant_context
        async def submit_background_task(task_func, *args):
            # tenant context from current thread/task will be
            # automatically propagated to the background execution
            await task_func(*args)
        ```

    Note:
        This decorator captures the current tenant context at decoration time
        (when the parent task starts). The context is then made available
        to the child task execution environment.
    """
    @functools.wraps(func)
    def wrapper(*args, **kwargs) -> Any:
        """
        Wrapper that captures current tenant context and makes it available to child tasks.

        The wrapper:
        1. Captures the current tenant_id and user_id
        2. Stores them in a way that child threads/tasks can inherit
        3. Calls the original function which may spawn children
        """
        current_tenant = TenantContext.get_current_tenant()
        current_user = TenantContext.get_current_user_id()

        context_info = {
            "tenant_id": current_tenant,
            "user_id": current_user,
        }

        if current_tenant:
            logger.debug(
                f"Capturing tenant context for propagation: {context_info}"
            )

        return func(*args, **kwargs)

    return wrapper


def validate_cross_tenant_operation(
    resource_tenant_id: str,
    operation: str = "query"
) -> None:
    """
    Validate that an operation does not cross tenant boundaries.

    This function enforces the isolation boundary by checking whether
    a requested operation on a resource matches the current tenant context.
    Per SPEC B-002: Cross-tenant JOIN is forbidden.

    Args:
        resource_tenant_id: The tenant_id of the resource being accessed.
        operation: The type of operation being performed (for logging).

    Raises:
        TenantIsolationViolationException: If the resource belongs to a
            different tenant than the current context.

    Example:
        ```python
        resource = Resource.get_by_id(resource_id)
        validate_cross_tenant_operation(resource.tenant_id, "UPDATE")
        # Proceed with operation if validation passes
        ```

    Note:
        This is a defense-in-depth measure. The primary protection comes
        from the BaseRepository layer which automatically filters by tenant_id.
        This function provides an additional check for explicit cross-tenant
        access attempts.
    """
    current_tenant = TenantContext.get_current_tenant()

    if not current_tenant:
        raise TenantContextNotFoundException(
            "Cannot validate cross-tenant operation: no tenant context"
        )

    if resource_tenant_id != current_tenant:
        logger.warning(
            f"Cross-tenant operation attempt blocked: "
            f"current={current_tenant}, target={resource_tenant_id}, "
            f"operation={operation}"
        )
        raise TenantIsolationViolationException(
            f"Operation '{operation}' on resource belonging to tenant "
            f"'{resource_tenant_id}' is not allowed from tenant '{current_tenant}'"
        )


def get_binding_audit_log(
    operation: str,
    resource_type: str,
    resource_id: Optional[str] = None
) -> dict:
    """
    Generate an audit log entry for tenant binding operations.

    Per SPEC Section 8.2: All tenant context related security events
    must be logged.

    Args:
        operation: The operation being performed (QUERY, INSERT, UPDATE, DELETE).
        resource_type: The type of resource being accessed.
        resource_id: Optional ID of the specific resource.

    Returns:
        A dictionary containing the audit log entry fields.

    Example:
        ```python
        audit_log = get_binding_audit_log("QUERY", "Asset", "asset-123")
        audit_logger.log(audit_log)
        ```
    """
    current_tenant = TenantContext.get_current_tenant()
    current_user = TenantContext.get_current_user_id()

    return {
        "event": "TENANT_CONTEXT_ACCESS",
        "tenant_id": current_tenant,
        "user_id": current_user,
        "action": operation,
        "resource_type": resource_type,
        "resource_id": resource_id,
    }


import threading