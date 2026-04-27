"""
Multi-tenant Data Isolation - Tenant Context Module

This module implements the core tenant context infrastructure for SWARM-2025-Q2-P1-004.
It provides ThreadLocal-based storage for request-level tenant binding and supports
context propagation for async tasks, message queue callbacks, and scheduled jobs.

Hard Constraints (B-001 to B-004):
- B-001: Fail-open forbidden - tenant context parsing failure returns 403 or throws exception
- B-002: Cross-tenant JOINs forbidden
- B-003: tenant_id cannot be client-specified, must come from JWT
- B-004: Raw SQL bypass forbidden

Reference: SPEC.md Section 2, 4, 7.1
"""

from __future__ import annotations

import threading
from contextlib import contextmanager
from dataclasses import dataclass, field
from typing import TYPE_CHECKING, Optional, Generator, Any
import logging

# Import tenant-related exceptions
from core.exceptions import (
    TenantContextNotFoundException,
    TenantIsolationViolationException,
    CrossTenantJoinException,
)

if TYPE_CHECKING:
    pass

logger = logging.getLogger(__name__)


@dataclass
class TenantContext:
    """
    Immutable tenant context data holder.
    
    Stores the current tenant identifier and associated metadata.
    This object is stored in ThreadLocal storage and should not be
    modified after creation to ensure thread safety.
    
    Attributes:
        tenant_id: The unique identifier for the current tenant (required)
        user_id: Optional user identifier within the tenant
        metadata: Optional additional context metadata
        
    Example:
        >>> ctx = TenantContext(tenant_id="tenant-001", user_id="user-123")
        >>> ctx.tenant_id
        'tenant-001'
    """
    tenant_id: str
    user_id: Optional[str] = None
    metadata: dict = field(default_factory=dict)
    
    def __post_init__(self) -> None:
        """Validate tenant context after initialization."""
        if not self.tenant_id or not self.tenant_id.strip():
            raise ValueError("tenant_id cannot be empty")


class TenantContextHolder:
    """
    ThreadLocal-based tenant context holder.
    
    This class manages the tenant context for the current thread using ThreadLocal
    storage. It provides methods for setting, getting, and clearing the context,
    as well as context propagation support for async/threaded execution.
    
    Thread Safety:
        This class is thread-safe. Each thread maintains its own context.
        For async context propagation, use the copy_context() method.
    
    Fail-Closed Behavior:
        - If no context is set and one is required, raises TenantContextNotFoundException
        - Context must be explicitly set before any tenant-aware operations
    
    Performance:
        - Context operations complete in < 5ms (p99) per ATB-5
        - Uses efficient ThreadLocal storage
    
    Example:
        >>> # Set context for current request
        >>> TenantContextHolder.set_context(TenantContext(tenant_id="tenant-001"))
        >>> 
        >>> # Get current tenant
        >>> tenant_id = TenantContextHolder.get_tenant_id()
        >>> 
        >>> # Clear context when request ends
        >>> TenantContextHolder.clear()
    """
    
    # Thread-local storage for tenant context
    _local: threading.local = threading.local()
    
    @classmethod
    def set_context(cls, context: TenantContext) -> None:
        """
        Set the tenant context for the current thread.
        
        Args:
            context: The TenantContext object to store.
            
        Raises:
            ValueError: If context is None or invalid.
            
        Example:
            >>> ctx = TenantContext(tenant_id="tenant-001", user_id="user-001")
            >>> TenantContextHolder.set_context(ctx)
        """
        if context is None:
            raise ValueError("TenantContext cannot be None")
        
        cls._local.tenant_context = context
        logger.debug(f"Tenant context set: tenant_id={context.tenant_id}")
    
    @classmethod
    def get_context(cls) -> TenantContext:
        """
        Get the current tenant context.
        
        Returns:
            The current TenantContext.
            
        Raises:
            TenantContextNotFoundException: If no context has been set for this thread.
            
        Example:
            >>> ctx = TenantContextHolder.get_context()
            >>> print(ctx.tenant_id)
        """
        context = getattr(cls._local, 'tenant_context', None)
        
        if context is None:
            logger.warning("Tenant context accessed but not set")
            raise TenantContextNotFoundException(
                "Tenant context not found. Ensure JWT authentication is complete "
                "and TenantContextFilter has been applied."
            )
        
        return context
    
    @classmethod
    def get_tenant_id(cls) -> str:
        """
        Get the current tenant ID.
        
        Convenience method to directly retrieve the tenant_id string.
        
        Returns:
            The current tenant_id string.
            
        Raises:
            TenantContextNotFoundException: If no context has been set.
            
        Example:
            >>> tenant_id = TenantContextHolder.get_tenant_id()
        """
        return cls.get_context().tenant_id
    
    @classmethod
    def get_user_id(cls) -> Optional[str]:
        """
        Get the current user ID from the context.
        
        Returns:
            The user_id if set, None otherwise.
            
        Raises:
            TenantContextNotFoundException: If no context has been set.
        """
        return cls.get_context().user_id
    
    @classmethod
    def get_metadata(cls, key: str, default: Any = None) -> Any:
        """
        Get metadata value from the current context.
        
        Args:
            key: The metadata key to retrieve.
            default: Default value if key not found.
            
        Returns:
            The metadata value or default.
            
        Raises:
            TenantContextNotFoundException: If no context has been set.
        """
        return cls.get_context().metadata.get(key, default)
    
    @classmethod
    def clear(cls) -> None:
        """
        Clear the tenant context for the current thread.
        
        Should be called when a request completes to prevent context leakage.
        
        Example:
            >>> TenantContextHolder.clear()
        """
        if hasattr(cls._local, 'tenant_context'):
            logger.debug(f"Clearing tenant context")
            delattr(cls._local, 'tenant_context')
    
    @classmethod
    def has_context(cls) -> bool:
        """
        Check if a tenant context exists for the current thread.
        
        Returns:
            True if context is set, False otherwise.
            
        Example:
            >>> if TenantContextHolder.has_context():
            ...     do_tenant_aware_operation()
        """
        return hasattr(cls._local, 'tenant_context')
    
    @classmethod
    def copy_context(cls) -> Optional[TenantContext]:
        """
        Create a copy of the current context for propagation to child threads.
        
        This method should be used when spawning async tasks or threads
        to ensure the child inherits the tenant context.
        
        Returns:
            A copy of the current TenantContext, or None if no context exists.
            
        Example:
            >>> # In parent thread
            >>> context_copy = TenantContextHolder.copy_context()
            >>> 
            >>> # In child thread
            >>> if context_copy:
            ...     TenantContextHolder.set_context(context_copy)
        """
        if not cls.has_context():
            return None
        
        current = cls.get_context()
        return TenantContext(
            tenant_id=current.tenant_id,
            user_id=current.user_id,
            metadata=current.metadata.copy()
        )
    
    @classmethod
    @contextmanager
    def context_manager(cls, tenant_id: str, user_id: Optional[str] = None) -> Generator[None, None, None]:
        """
        Context manager for safely setting and clearing tenant context.
        
        Ensures context is cleared even if an exception occurs.
        
        Args:
            tenant_id: The tenant ID to set.
            user_id: Optional user ID.
            
        Yields:
            None
            
        Example:
            >>> with TenantContextHolder.context_manager("tenant-001"):
            ...     do_something()  # tenant context is active here
            >>> # context is cleared here
        """
        context = TenantContext(tenant_id=tenant_id, user_id=user_id)
        previous_context = cls.copy_context()
        
        try:
            cls.set_context(context)
            yield
        finally:
            cls.clear()
            if previous_context:
                cls.set_context(previous_context)
    
    @classmethod
    def require_context(cls) -> TenantContext:
        """
        Get context or raise exception (fail-closed).
        
        This is the primary method for code that requires tenant context.
        It implements the fail-closed behavior required by B-001.
        
        Returns:
            The current TenantContext.
            
        Raises:
            TenantContextNotFoundException: If no context is set.
            
        Example:
            >>> # In a service method
            >>> ctx = TenantContextHolder.require_context()
            >>> do_tenant_aware_operation(ctx.tenant_id)
        """
        return cls.get_context()


# Backward compatibility alias
class TenantContextManager:
    """
    Backward-compatible alias for TenantContextHolder.
    
    Provides the same functionality with a different class name for
    backward compatibility with existing code.
    """
    
    @staticmethod
    def set(tenant_id: str, user_id: Optional[str] = None) -> None:
        """Set tenant context."""
        ctx = TenantContext(tenant_id=tenant_id, user_id=user_id)
        TenantContextHolder.set_context(ctx)
    
    @staticmethod
    def get() -> str:
        """Get current tenant ID."""
        return TenantContextHolder.get_tenant_id()
    
    @staticmethod
    def clear() -> None:
        """Clear tenant context."""
        TenantContextHolder.clear()
    
    @staticmethod
    def check() -> bool:
        """Check if context exists."""
        return TenantContextHolder.has_context()


# Convenience functions for common operations
def get_current_tenant() -> str:
    """
    Get the current tenant ID.
    
    Convenience function that wraps TenantContextHolder.get_tenant_id().
    
    Returns:
        The current tenant_id string.
        
    Raises:
        TenantContextNotFoundException: If no context is set.
        
    Example:
        >>> tenant_id = get_current_tenant()
    """
    return TenantContextHolder.get_tenant_id()


def require_tenant_context() -> TenantContext:
    """
    Get tenant context or raise exception (fail-closed).
    
    Convenience function that wraps TenantContextHolder.require_context().
    
    Returns:
        The current TenantContext.
        
    Raises:
        TenantContextNotFoundException: If no context is set.
        
    Example:
        >>> ctx = require_tenant_context()
    """
    return TenantContextHolder.require_context()


def set_current_tenant(tenant_id: str, user_id: Optional[str] = None) -> None:
    """
    Set the current tenant context.
    
    Convenience function that creates a TenantContext and sets it.
    
    Args:
        tenant_id: The tenant ID to set.
        user_id: Optional user ID.
        
    Example:
        >>> set_current_tenant("tenant-001", "user-001")
    """
    context = TenantContext(tenant_id=tenant_id, user_id=user_id)
    TenantContextHolder.set_context(context)


def clear_tenant_context() -> None:
    """
    Clear the current tenant context.
    
    Convenience function that clears the ThreadLocal context.
    
    Example:
        >>> clear_tenant_context()
    """
    TenantContextHolder.clear()


def has_tenant_context() -> bool:
    """
    Check if tenant context is set.
    
    Convenience function that checks if a context exists.
    
    Returns:
        True if context is set, False otherwise.
        
    Example:
        >>> if has_tenant_context():
        ...     do_tenant_aware_operation()
    """
    return TenantContextHolder.has_context()


__all__ = [
    # Core classes
    "TenantContext",
    "TenantContextHolder",
    "TenantContextManager",
    # Convenience functions
    "get_current_tenant",
    "require_tenant_context",
    "set_current_tenant",
    "clear_tenant_context",
    "has_tenant_context",
    # Exceptions (re-exported for convenience)
    "TenantContextNotFoundException",
    "TenantIsolationViolationException",
    "CrossTenantJoinException",
]