"""
Tenant-related exceptions for multi-tenant data isolation.

This module defines custom exceptions used throughout the application
to enforce tenant isolation and provide clear error handling for
tenant context violations.

All exceptions in this module extend from TenantIsolationError
to allow centralized exception handling for tenant-related issues.

Example:
    >>> from app.exceptions.tenant import TenantContextRequired
    >>> raise TenantContextRequired("Tenant context not set for query operation")
"""

from typing import Optional, Any


class TenantIsolationError(Exception):
    """
    Base exception for all tenant isolation related errors.
    
    This exception serves as the parent class for all tenant-specific
    exceptions, enabling centralized exception handling for multi-tenant
    isolation violations.
    
    Attributes:
        message: Human-readable error message describing the violation.
        tenant_id: The tenant ID involved in the error (if applicable).
        operation: The operation that triggered the error (e.g., 'query', 'create').
    """

    def __init__(
        self,
        message: str,
        tenant_id: Optional[str] = None,
        operation: Optional[str] = None
    ):
        """
        Initialize a TenantIsolationError.
        
        Args:
            message: Error message describing the violation.
            tenant_id: The tenant ID involved (if known).
            operation: The operation that triggered the error.
        """
        super().__init__(message)
        self.message = message
        self.tenant_id = tenant_id
        self.operation = operation

    def __repr__(self) -> str:
        """Return a detailed string representation of the exception."""
        parts = [f"TenantIsolationError({self.message!r}"]
        if self.tenant_id:
            parts.append(f", tenant_id={self.tenant_id!r}")
        if self.operation:
            parts.append(f", operation={self.operation!r}")
        parts.append(")")
        return "".join(parts)


class TenantContextRequired(TenantIsolationError):
    """
    Exception raised when tenant context is required but not set.
    
    This exception is thrown when an operation (typically database query)
    requires a tenant context to be set via TenantContext, but the context
    is currently unset or unavailable.
    
    HTTP Status Code: 401 Unauthorized
    
    Example:
        >>> from app.exceptions.tenant import TenantContextRequired
        >>> # Raised automatically when querying without tenant context
        >>> raise TenantContextRequired(operation="SELECT")
    """

    def __init__(
        self,
        operation: Optional[str] = None,
        detail: Optional[str] = None
    ):
        """
        Initialize a TenantContextRequired exception.
        
        Args:
            operation: The database operation that requires tenant context.
            detail: Additional details about the error context.
        """
        operation_str = f" for {operation}" if operation else ""
        message = f"Tenant context is required{operation_str}."
        if detail:
            message += f" Detail: {detail}"
        
        super().__init__(
            message=message,
            operation=operation
        )
        self.status_code = 401


class TenantAccessDenied(TenantIsolationError):
    """
    Exception raised when access to a tenant's resource is denied.
    
    This exception is thrown when a user or process attempts to access
    a resource (record, data, or operation) that belongs to a different
    tenant than the one specified in the current context.
    
    HTTP Status Code: 403 Forbidden
    
    Example:
        >>> from app.exceptions.tenant import TenantAccessDenied
        >>> raise TenantAccessDenied(
        ...     tenant_id="tenant-456",
        ...     resource_type="Asset",
        ...     resource_id="asset-123"
        ... )
    """

    def __init__(
        self,
        tenant_id: Optional[str] = None,
        resource_type: Optional[str] = None,
        resource_id: Optional[Any] = None,
        detail: Optional[str] = None
    ):
        """
        Initialize a TenantAccessDenied exception.
        
        Args:
            tenant_id: The tenant ID of the resource being accessed.
            resource_type: Type of the resource (e.g., 'Asset', 'WorkOrder').
            resource_id: Identifier of the specific resource.
            detail: Additional details about the access denial.
        """
        message_parts = ["Access denied to tenant resource"]
        if tenant_id:
            message_parts.append(f" (tenant: {tenant_id})")
        if resource_type:
            message_parts.append(f" {resource_type}")
        if resource_id:
            message_parts.append(f"#{resource_id}")
        if detail:
            message_parts.append(f". Detail: {detail}")
        
        message = "".join(message_parts)
        
        super().__init__(
            message=message,
            tenant_id=tenant_id,
            operation="access"
        )
        self.resource_type = resource_type
        self.resource_id = resource_id
        self.status_code = 403


class TenantMismatchError(TenantIsolationError):
    """
    Exception raised when written data does not match the current tenant context.
    
    This exception is thrown when an attempt is made to create or update
    a record with a tenant_id that differs from the tenant context currently
    set via TenantContext. All data mutations must use the tenant context
    from the authenticated request.
    
    HTTP Status Code: 400 Bad Request
    
    Example:
        >>> from app.exceptions.tenant import TenantMismatchError
        >>> raise TenantMismatchError(
        ...     context_tenant="tenant-123",
        ...     data_tenant="tenant-456",
        ...     operation="create"
        ... )
    """

    def __init__(
        self,
        context_tenant: Optional[str] = None,
        data_tenant: Optional[str] = None,
        operation: str = "create",
        detail: Optional[str] = None
    ):
        """
        Initialize a TenantMismatchError exception.
        
        Args:
            context_tenant: The tenant ID from the current context.
            data_tenant: The tenant ID provided in the data being written.
            operation: The operation being performed (e.g., 'create', 'update').
            detail: Additional details about the mismatch.
        """
        message_parts = [
            f"Tenant mismatch during {operation}: "
        ]
        if context_tenant and data_tenant:
            message_parts.append(
                f"data tenant ({data_tenant}) does not match "
                f"context tenant ({context_tenant})"
            )
        elif data_tenant:
            message_parts.append(f"explicit tenant_id ({data_tenant}) not allowed")
        else:
            message_parts.append("tenant context is required for data operations")
        
        if detail:
            message_parts.append(f". Detail: {detail}")
        
        message = "".join(message_parts)
        
        super().__init__(
            message=message,
            tenant_id=data_tenant,
            operation=operation
        )
        self.context_tenant = context_tenant
        self.data_tenant = data_tenant
        self.status_code = 400


class TenantNotFoundError(TenantIsolationError):
    """
    Exception raised when a requested tenant does not exist.
    
    This exception is thrown when an operation references a tenant ID
    that does not exist in the system or is not accessible by the
    current user.
    
    HTTP Status Code: 404 Not Found
    
    Example:
        >>> from app.exceptions.tenant import TenantNotFoundError
        >>> raise TenantNotFoundError(tenant_id="tenant-999")
    """

    def __init__(
        self,
        tenant_id: Optional[str] = None,
        detail: Optional[str] = None
    ):
        """
        Initialize a TenantNotFoundError exception.
        
        Args:
            tenant_id: The tenant ID that was not found.
            detail: Additional details about the error.
        """
        message = f"Tenant not found"
        if tenant_id:
            message += f": {tenant_id}"
        if detail:
            message += f". Detail: {detail}"
        
        super().__init__(
            message=message,
            tenant_id=tenant_id,
            operation="lookup"
        )
        self.status_code = 404


class TenantContextLeakError(TenantIsolationError):
    """
    Exception raised when potential tenant context leakage is detected.
    
    This is a security-related exception that may be raised when
    an operation could potentially leak tenant context information
    or when cross-tenant data access patterns are detected.
    
    HTTP Status Code: 500 Internal Server Error
    
    This is typically used for logging and monitoring rather than
    direct user-facing error responses.
    """

    def __init__(
        self,
        message: str = "Potential tenant context leak detected",
        detail: Optional[str] = None
    ):
        """
        Initialize a TenantContextLeakError exception.
        
        Args:
            message: Error message describing the potential leak.
            detail: Additional context about the potential leak.
        """
        if detail:
            message += f". Detail: {detail}"
        
        super().__init__(message=message, operation="security_check")
        self.status_code = 500