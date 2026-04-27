"""
Core exception classes for the asset management system.

This module defines all custom exception classes used across the application,
organized by functional domain.

Multi-tenant Isolation Exceptions (SWARM-2025-Q2-P1-004):
    - TenantContextNotFoundException: Raised when tenant context is missing
    - TenantIsolationViolationException: Raised on cross-tenant data access attempts
    - CrossTenantJoinException: Raised on prohibited cross-tenant JOIN queries
"""

from typing import Optional


# =============================================================================
# Multi-Tenant Isolation Exceptions (SWARM-2025-Q2-P1-004)
# =============================================================================

class TenantContextNotFoundException(Exception):
    """
    Exception raised when tenant context is not available.

    According to B-001 (fail-open prohibition), this exception indicates
    that the tenant context could not be resolved, and the operation must
    be denied rather than silently proceeding.

    Raised in scenarios:
        - SQL execution without TenantContext
        - Async task execution without inherited context
        - Request processing without JWT/tenant_id

    Args:
        message: Detailed error message describing the context failure
        tenant_id: The tenant_id that was expected (if known)
        operation: The operation that was attempted
    """

    def __init__(
        self,
        message: Optional[str] = None,
        tenant_id: Optional[str] = None,
        operation: Optional[str] = None
    ):
        self.tenant_id = tenant_id
        self.operation = operation

        if message is None:
            message = (
                "Tenant context not found. "
                "Cannot proceed with operation without valid tenant context."
            )

        super().__init__(message)


class TenantIsolationViolationException(Exception):
    """
    Exception raised when a cross-tenant data access violation is detected.

    This exception enforces strict tenant isolation by rejecting any attempt
    to access, modify, or delete data belonging to another tenant.

    Raised in scenarios:
        - Attempting to insert data with mismatched tenant_id
        - Attempting to update/delete another tenant's data
        - Direct bypass attempts via repository layer

    According to B-003, tenant_id must never be client-specified.

    Args:
        message: Detailed error message describing the violation
        source_tenant_id: The tenant attempting the operation
        target_tenant_id: The tenant whose data was targeted
        operation: The attempted operation type (INSERT, UPDATE, DELETE)
        resource_type: The type of resource being accessed
    """

    def __init__(
        self,
        message: Optional[str] = None,
        source_tenant_id: Optional[str] = None,
        target_tenant_id: Optional[str] = None,
        operation: Optional[str] = None,
        resource_type: Optional[str] = None
    ):
        self.source_tenant_id = source_tenant_id
        self.target_tenant_id = target_tenant_id
        self.operation = operation
        self.resource_type = resource_type

        if message is None:
            message = (
                f"Tenant isolation violation detected: "
                f"{operation} operation on tenant {target_tenant_id} "
                f"from tenant {source_tenant_id} is not permitted."
            )

        super().__init__(message)

    def to_audit_event(self) -> dict:
        """
        Convert the exception to an audit event dictionary.

        Returns:
            Audit event dict with security-relevant information.
        """
        return {
            "event": "TENANT_CONTEXT_VIOLATION",
            "tenant_id": self.source_tenant_id,
            "attempted_tenant_id": self.target_tenant_id,
            "action": self.operation,
            "resource_type": self.resource_type,
            "severity": "HIGH"
        }


class CrossTenantJoinException(Exception):
    """
    Exception raised when a cross-tenant JOIN query is attempted.

    According to B-002, SQL-level cross-tenant JOINs are strictly prohibited.
    This exception is raised by the Repository layer when such queries are
    detected before they can execute.

    Args:
        message: Detailed error message
        query_type: Type of query that triggered the exception
        involved_tables: Tables involved in the attempted JOIN
    """

    def __init__(
        self,
        message: Optional[str] = None,
        query_type: Optional[str] = None,
        involved_tables: Optional[list] = None
    ):
        self.query_type = query_type
        self.involved_tables = involved_tables or []

        if message is None:
            message = (
                f"Cross-tenant JOIN detected and blocked. "
                f"Query type: {query_type}, "
                f"tables: {', '.join(self.involved_tables)}"
            )

        super().__init__(message)


# =============================================================================
# Business Logic Exceptions
# =============================================================================

class BusinessException(Exception):
    """
    Base exception for all business logic errors.

    This provides a common ancestor for domain-specific exceptions
    and ensures consistent exception handling across the application.

    Args:
        message: Human-readable error message
        code: Error code for programmatic handling
        details: Additional context-specific details
    """

    def __init__(
        self,
        message: Optional[str] = None,
        code: Optional[str] = None,
        details: Optional[dict] = None
    ):
        self.message = message or "A business error occurred"
        self.code = code
        self.details = details or {}
        super().__init__(self.message)


class ValidationException(BusinessException):
    """
    Exception raised for data validation failures.

    Args:
        field: The field that failed validation
        value: The invalid value
        constraint: The constraint that was violated
    """

    def __init__(
        self,
        message: Optional[str] = None,
        field: Optional[str] = None,
        value: Optional[any] = None,
        constraint: Optional[str] = None
    ):
        self.field = field
        self.value = value
        self.constraint = constraint
        super().__init__(
            message or f"Validation failed for field '{field}'",
            code="VALIDATION_ERROR",
            details={"field": field, "constraint": constraint}
        )


class StateTransitionException(BusinessException):
    """
    Exception raised when an invalid state transition is attempted.

    Args:
        current_state: The current state of the entity
        target_state: The attempted target state
        entity_type: Type of entity (e.g., 'Asset', 'WorkOrder')
        entity_id: Identifier of the entity
    """

    def __init__(
        self,
        message: Optional[str] = None,
        current_state: Optional[str] = None,
        target_state: Optional[str] = None,
        entity_type: Optional[str] = None,
        entity_id: Optional[str] = None
    ):
        self.current_state = current_state
        self.target_state = target_state
        self.entity_type = entity_type
        self.entity_id = entity_id
        super().__init__(
            message or f"Invalid state transition from {current_state} to {target_state}",
            code="STATE_TRANSITION_ERROR",
            details={
                "current_state": current_state,
                "target_state": target_state,
                "entity_type": entity_type
            }
        )


# =============================================================================
# Repository/Service Layer Exceptions
# =============================================================================

class RepositoryException(BusinessException):
    """
    Base exception for repository/data access layer errors.

    Args:
        message: Error message
        operation: The failed operation (SELECT, INSERT, UPDATE, DELETE)
        entity_type: Type of entity being accessed
    """

    def __init__(
        self,
        message: Optional[str] = None,
        operation: Optional[str] = None,
        entity_type: Optional[str] = None
    ):
        self.operation = operation
        self.entity_type = entity_type
        super().__init__(
            message or f"Repository operation '{operation}' failed",
            code="REPOSITORY_ERROR",
            details={"operation": operation, "entity_type": entity_type}
        )


class EntityNotFoundException(RepositoryException):
    """
    Exception raised when an entity cannot be found.

    Args:
        entity_type: Type of the entity
        entity_id: Identifier of the entity
    """

    def __init__(
        self,
        entity_type: Optional[str] = None,
        entity_id: Optional[str] = None
    ):
        self.entity_id = entity_id
        super().__init__(
            message=f"{entity_type} with id '{entity_id}' not found",
            operation="SELECT",
            entity_type=entity_type
        )


class DuplicateEntityException(RepositoryException):
    """
    Exception raised when attempting to create a duplicate entity.

    Args:
        entity_type: Type of the entity
        unique_field: Field that must be unique
        field_value: The duplicate value
    """

    def __init__(
        self,
        entity_type: Optional[str] = None,
        unique_field: Optional[str] = None,
        field_value: Optional[str] = None
    ):
        self.unique_field = unique_field
        self.field_value = field_value
        super().__init__(
            message=f"{entity_type} with {unique_field}='{field_value}' already exists",
            operation="INSERT",
            entity_type=entity_type
        )


# =============================================================================
# Authentication/Authorization Exceptions
# =============================================================================

class AuthenticationException(BusinessException):
    """
    Exception raised for authentication failures.

    According to the spec, JWT missing tenant_id or malformed JWT
    should result in 401 Unauthorized.

    Args:
        message: Error message
        reason: Specific reason for authentication failure
    """

    def __init__(
        self,
        message: Optional[str] = None,
        reason: Optional[str] = None
    ):
        self.reason = reason
        super().__init__(
            message or "Authentication failed",
            code="AUTHENTICATION_ERROR",
            details={"reason": reason}
        )


class AuthorizationException(BusinessException):
    """
    Exception raised for authorization failures.

    According to the spec, JWT valid but tenant_id not in DB
    should result in 403 Forbidden.

    Args:
        message: Error message
        required_permission: The permission that was required
    """

    def __init__(
        self,
        message: Optional[str] = None,
        required_permission: Optional[str] = None
    ):
        self.required_permission = required_permission
        super().__init__(
            message or "Authorization failed",
            code="AUTHORIZATION_ERROR",
            details={"required_permission": required_permission}
        )


# =============================================================================
# Integration/External Service Exceptions
# =============================================================================

class ExternalServiceException(BusinessException):
    """
    Exception raised when an external service call fails.

    Args:
        service_name: Name of the external service
        original_error: The original exception if available
    """

    def __init__(
        self,
        message: Optional[str] = None,
        service_name: Optional[str] = None,
        original_error: Optional[Exception] = None
    ):
        self.service_name = service_name
        self.original_error = original_error
        super().__init__(
            message or f"External service '{service_name}' call failed",
            code="EXTERNAL_SERVICE_ERROR",
            details={"service_name": service_name}
        )


# =============================================================================
# Configuration/Setup Exceptions
# =============================================================================

class ConfigurationException(BusinessException):
    """
    Exception raised for configuration errors.

    Args:
        message: Error message
        config_key: The configuration key that caused the error
    """

    def __init__(
        self,
        message: Optional[str] = None,
        config_key: Optional[str] = None
    ):
        self.config_key = config_key
        super().__init__(
            message or f"Configuration error for key '{config_key}'",
            code="CONFIGURATION_ERROR",
            details={"config_key": config_key}
        )