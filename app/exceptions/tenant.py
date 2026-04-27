"""
Tenant-specific exceptions for multi-tenant data isolation.

Performs request-level tenant context binding, data isolation, and context propagation
as defined in SPEC: SWARM-2025-Q2-P1-004.

Boundary Constraints (B-001 to B-004):
    B-001: No fail-open - tenant context parsing failure → 403/401, never silent pass
    B-002: No cross-tenant JOIN - repository layer must intercept and throw CrossTenantJoinException
    B-003: No tenant_id from client - must be parsed from JWT, never from request parameters
    B-004: No bypass context - raw SQL via Connection/JdbcTemplate not protected by this module

Exception Handling Boundary:
    - JWT without tenant_id → TenantContextNotFoundException (401)
    - JWT format error → TenantContextNotFoundException (401)
    - JWT valid but tenant_id not in DB → TenantAccessDeniedException (403)
    - SQL execution with empty TenantContext → TenantContextNotFoundException (500, rollback)
    - Async task without context → TenantContextNotFoundException (500)
"""

from typing import Optional


class TenantContextNotFoundException(Exception):
    """
    Raised when tenant context is required but not available.

    This exception is thrown in the following scenarios:
    - JWT without tenant_id field
    - JWT format error or signature validation failure
    - SQL execution when TenantContext is empty
    - Async task executed without tenant context propagation

    Per B-001 (no fail-open): This exception must NOT be silently caught and ignored.
    HTTP responses should return 401 Unauthorized or 500 Internal Server Error.
    """

    def __init__(
        self,
        message: Optional[str] = None,
        tenant_id: Optional[str] = None,
        user_id: Optional[str] = None,
        operation: Optional[str] = None,
    ) -> None:
        """
        Initialize TenantContextNotFoundException.

        Args:
            message: Human-readable error message. Defaults to standard message.
            tenant_id: The tenant ID that was expected but not found.
            user_id: The user ID associated with the request.
            operation: The operation that required the tenant context.
        """
        if message is None:
            message = "Tenant context is required but not available. Access denied."
        self.tenant_id = tenant_id
        self.user_id = user_id
        self.operation = operation
        super().__init__(message)


class TenantIsolationViolationException(Exception):
    """
    Raised when a cross-tenant data access attempt is detected.

    This exception is thrown in the following scenarios:
    - Attempt to read data belonging to another tenant
    - Attempt to insert data with a tenant_id different from current context
    - Attempt to update data belonging to another tenant
    - Attempt to delete data belonging to another tenant

    Per B-002 (no cross-tenant JOIN): This exception must be raised when a query
    attempts to access resources across tenant boundaries.

    Per B-001 (no fail-open): This exception must NOT be silently caught and ignored.
    HTTP responses should return 403 Forbidden.
    """

    def __init__(
        self,
        message: Optional[str] = None,
        current_tenant_id: Optional[str] = None,
        attempted_tenant_id: Optional[str] = None,
        resource_type: Optional[str] = None,
        resource_id: Optional[str] = None,
        operation: Optional[str] = None,
    ) -> None:
        """
        Initialize TenantIsolationViolationException.

        Args:
            message: Human-readable error message. Defaults to standard message.
            current_tenant_id: The tenant ID of the current context.
            attempted_tenant_id: The tenant ID that was attempted to access.
            resource_type: The type of resource being accessed (e.g., 'Asset', 'WorkOrder').
            resource_id: The ID of the resource being accessed.
            operation: The operation being performed ('QUERY', 'INSERT', 'UPDATE', 'DELETE').
        """
        if message is None:
            message = (
                f"Tenant isolation violation: attempted to access tenant "
                f"'{attempted_tenant_id}' from context '{current_tenant_id}'. "
                f"Cross-tenant data access is prohibited."
            )
        self.current_tenant_id = current_tenant_id
        self.attempted_tenant_id = attempted_tenant_id
        self.resource_type = resource_type
        self.resource_id = resource_id
        self.operation = operation
        super().__init__(message)


class CrossTenantJoinException(Exception):
    """
    Raised when a SQL JOIN query attempts to join resources across tenant boundaries.

    Per B-002 (no cross-tenant JOIN): This exception is raised when the Repository
    layer detects a SQL statement that would join tables on different tenant_id values.

    This is a critical security exception that prevents data leakage through JOIN operations.

    Per B-001 (no fail-open): This exception must NOT be silently caught and ignored.
    HTTP responses should return 403 Forbidden.
    """

    def __init__(
        self,
        message: Optional[str] = None,
        current_tenant_id: Optional[str] = None,
        join_tables: Optional[list] = None,
        join_condition: Optional[str] = None,
    ) -> None:
        """
        Initialize CrossTenantJoinException.

        Args:
            message: Human-readable error message. Defaults to standard message.
            current_tenant_id: The tenant ID of the current context.
            join_tables: List of table names involved in the cross-tenant join.
            join_condition: The JOIN condition that triggered this exception.
        """
        if message is None:
            tables_str = ", ".join(join_tables) if join_tables else "unknown"
            message = (
                f"Cross-tenant JOIN detected. Current tenant: '{current_tenant_id}'. "
                f"Tables involved: {tables_str}. Cross-tenant JOIN operations are prohibited."
            )
        self.current_tenant_id = current_tenant_id
        self.join_tables = join_tables or []
        self.join_condition = join_condition
        super().__init__(message)


class TenantAccessDeniedException(Exception):
    """
    Raised when a valid JWT contains a tenant_id that does not exist in the database.

    Per the Exception Handling Boundary specification:
    - JWT valid but tenant_id in DB does not exist → 403 Forbidden

    This differs from TenantContextNotFoundException which is for missing/invalid JWTs.
    This exception is for the case where the JWT is valid but the tenant is unknown/deactivated.

    Per B-001 (no fail-open): This exception must NOT be silently caught and ignored.
    HTTP responses should return 403 Forbidden.
    """

    def __init__(
        self,
        message: Optional[str] = None,
        tenant_id: Optional[str] = None,
        user_id: Optional[str] = None,
    ) -> None:
        """
        Initialize TenantAccessDeniedException.

        Args:
            message: Human-readable error message. Defaults to standard message.
            tenant_id: The tenant ID from the JWT that was not found in the database.
            user_id: The user ID associated with the request.
        """
        if message is None:
            message = (
                f"Access denied: tenant_id '{tenant_id}' is not recognized or is inactive. "
                f"Please contact your administrator."
            )
        self.tenant_id = tenant_id
        self.user_id = user_id
        super().__init__(message)