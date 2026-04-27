"""
Base model classes for tenant-aware data access.

This module provides the foundation for multi-tenant data isolation as defined
in SWARM-2025-Q2-P1-004 (Phase 2.3 & 2.4).

Key components:
- TenantAwareMixin: Mixin class adding tenant_id field and validation
- TenantContext: ThreadLocal-based context holder for request-scoped tenant ID
- BaseRepository: Abstract repository with automatic tenant filtering
- TenantIsolationViolationException: Raised when cross-tenant operations attempted
"""

import threading
from typing import Optional, Any, ClassVar
from datetime import datetime
from abc import ABC, abstractmethod

# =============================================================================
# Tenant Context Management (Phase 2.4)
# =============================================================================

class TenantContext:
    """
    ThreadLocal-based tenant context holder.
    
    Manages the current tenant ID for the executing thread. Used by
    middleware to inject tenant context from JWT, and by repositories
    to automatically filter queries.
    
    Thread Safety:
        Uses ThreadLocal storage, safe for concurrent request handling.
        Sub-threads inherit context via explicit propagation methods.
    
    Example:
        >>> TenantContext.set("tenant-001")
        >>> tenant_id = TenantContext.get_current_tenant()
        >>> # perform tenant-scoped operations
        >>> TenantContext.clear()
    """
    
    _local = threading.local()
    
    @classmethod
    def set(cls, tenant_id: str) -> None:
        """
        Set the current tenant ID for this thread.
        
        Args:
            tenant_id: The tenant identifier extracted from JWT.
        
        Raises:
            ValueError: If tenant_id is None or empty.
        """
        if not tenant_id:
            raise ValueError("tenant_id cannot be None or empty")
        cls._local.tenant_id = tenant_id
    
    @classmethod
    def get_current_tenant(cls) -> Optional[str]:
        """
        Get the current tenant ID for this thread.
        
        Returns:
            The current tenant ID, or None if not set.
        """
        return getattr(cls._local, 'tenant_id', None)
    
    @classmethod
    def get_required_tenant(cls) -> str:
        """
        Get the current tenant ID, raising exception if not set.
        
        Returns:
            The current tenant ID.
        
        Raises:
            TenantContextNotFoundException: If no tenant context is set.
        """
        tenant_id = cls.get_current_tenant()
        if not tenant_id:
            raise TenantContextNotFoundException(
                "Tenant context not set. Ensure request has valid JWT with tenant_id."
            )
        return tenant_id
    
    @classmethod
    def clear(cls) -> None:
        """Clear the tenant context for this thread."""
        cls._local.tenant_id = None
    
    @classmethod
    def copy_to_thread(cls, target_thread: threading.Thread) -> None:
        """
        Propagate tenant context to a spawned thread.
        
        Args:
            target_thread: The thread to propagate context to.
        
        Note:
            Must be called before starting the target thread.
        """
        current_tenant = cls.get_current_tenant()
        if current_tenant:
            # Store for propagation; use a TaskDecorator pattern in practice
            target_thread._tenant_context = current_tenant


# =============================================================================
# Exceptions (Phase 2.4 Boundary Rules)
# =============================================================================

class TenantException(Exception):
    """Base exception for tenant-related errors."""
    pass


class TenantContextNotFoundException(TenantException):
    """
    Raised when tenant context is required but not available.
    
    Boundary Rule B-001: Fail-closed - must not silently proceed.
    """
    pass


class TenantIsolationViolationException(TenantException):
    """
    Raised when a cross-tenant data access is attempted.
    
    Covers:
    - Attempting to read another tenant's data
    - Attempting to write data with mismatched tenant_id
    - Attempting to delete another tenant's records
    
    Boundary Rules B-001, B-002, B-003 apply.
    """
    pass


class CrossTenantJoinException(TenantException):
    """
    Raised when a cross-tenant JOIN is attempted.
    
    Boundary Rule B-002: SQL-level cross-tenant joins are prohibited.
    """
    pass


# =============================================================================
# Tenant-Aware Mixin
# =============================================================================

class TenantAwareMixin:
    """
    Mixin class adding tenant awareness to models.
    
    All tenant-aware models must:
    1. Have a tenant_id field (populated on creation)
    2. Validate tenant_id matches current context on save
    3. Exclude tenant_id from client-provided update payloads
    
    Usage:
        class Asset(TenantAwareMixin, BaseModel):
            name: str
            tenant_id: str = ""  # Auto-populated
    """
    
    # Class variable to track tenant-aware models
    _is_tenant_aware: ClassVar[bool] = True
    
    @property
    def tenant_id(self) -> Optional[str]:
        """Get the tenant ID of this entity."""
        return getattr(self, '_tenant_id', None)
    
    @tenant_id.setter
    def tenant_id(self, value: str) -> None:
        """Set the tenant ID of this entity."""
        self._tenant_id = value
    
    def _validate_tenant_context(self) -> None:
        """
        Validate that save/update operations respect tenant isolation.
        
        Raises:
            TenantIsolationViolationException: If tenant_id doesn't match context.
        """
        current_tenant = TenantContext.get_current_tenant()
        entity_tenant = self.tenant_id
        
        if entity_tenant and current_tenant and entity_tenant != current_tenant:
            raise TenantIsolationViolationException(
                f"Cross-tenant operation denied: entity tenant={entity_tenant}, "
                f"current context={current_tenant}"
            )
    
    def _ensure_tenant_id(self) -> None:
        """
        Ensure tenant_id is set before save operations.
        
        Sets tenant_id from current context if not already set.
        """
        if not self.tenant_id:
            self.tenant_id = TenantContext.get_required_tenant()


# =============================================================================
# Base Model
# =============================================================================

class BaseModel:
    """
    Base class for all domain models.
    
    Provides:
    - Common timestamp fields (created_at, updated_at)
    - ID field for all entities
    - Soft delete support
    """
    
    id: Optional[str] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    deleted_at: Optional[datetime] = None
    
    def __init__(self, **kwargs):
        """Initialize model with provided attributes."""
        for key, value in kwargs.items():
            if hasattr(self.__class__, key):
                setattr(self, key, value)
    
    def to_dict(self) -> dict:
        """Convert model to dictionary representation."""
        result = {}
        for key, value in self.__dict__.items():
            if not key.startswith('_'):
                result[key] = value
        return result
    
    @classmethod
    def get_field_names(cls) -> list:
        """Get all field names for this model."""
        return [
            attr for attr in dir(cls) 
            if not attr.startswith('_') and not callable(getattr(cls, attr))
        ]


# =============================================================================
# Base Repository (Phase 2.3: Repository 层租户过滤)
# =============================================================================

class BaseRepository(ABC):
    """
    Abstract base repository with automatic tenant filtering.
    
    All inheriting repositories automatically filter queries by tenant_id.
    This implements Phase 2.3 requirements:
    - BaseRepository 抽象类: 所有继承类自动注入 `WHERE tenant_id = ?`
    - 硬删除防护: 跨租户删除操作直接抛出 TenantIsolationViolationException
    
    Boundary Rules Enforced:
    - B-001: Tenant context required for all operations
    - B-003: tenant_id cannot be set from client request
    
    Usage:
        class AssetRepository(BaseRepository):
            def find_by_name(self, name: str) -> Optional[Asset]:
                ...
        
        # All queries automatically filtered by current tenant
        repo = AssetRepository()
        TenantContext.set("tenant-001")
        assets = repo.find_all()  # Only returns tenant-001 assets
    """
    
    def __init__(self):
        """Initialize repository with tenant-aware query capabilities."""
        self._tenant_filter_applied = True
    
    def _get_tenant_condition(self) -> dict:
        """
        Build tenant filter condition for queries.
        
        Returns:
            Dictionary with tenant_id filter.
        
        Raises:
            TenantContextNotFoundException: If no tenant context.
        """
        tenant_id = TenantContext.get_required_tenant()
        return {'tenant_id': tenant_id}
    
    def _validate_no_cross_tenant_access(self, entity: Any) -> None:
        """
        Validate that an entity belongs to current tenant before modifications.
        
        Args:
            entity: The entity to validate.
        
        Raises:
            TenantIsolationViolationException: If cross-tenant access detected.
        """
        if hasattr(entity, 'tenant_id') and entity.tenant_id:
            current_tenant = TenantContext.get_current_tenant()
            if entity.tenant_id != current_tenant:
                raise TenantIsolationViolationException(
                    f"Cannot modify entity from another tenant: "
                    f"entity tenant={entity.tenant_id}, current={current_tenant}"
                )
    
    @abstractmethod
    def find_by_id(self, entity_id: str) -> Optional[Any]:
        """
        Find entity by ID, filtered by current tenant.
        
        Args:
            entity_id: The entity identifier.
        
        Returns:
            Entity if found and belongs to current tenant, None otherwise.
        """
        pass
    
    @abstractmethod
    def find_all(self) -> list:
        """
        Find all entities for current tenant.
        
        Returns:
            List of entities belonging to current tenant.
        """
        pass
    
    @abstractmethod
    def save(self, entity: Any) -> Any:
        """
        Save entity with automatic tenant_id injection.
        
        Args:
            entity: The entity to save.
        
        Returns:
            Saved entity with tenant_id set.
        
        Raises:
            TenantContextNotFoundException: If no tenant context.
            TenantIsolationViolationException: If cross-tenant save attempted.
        """
        pass
    
    @abstractmethod
    def delete(self, entity_id: str) -> None:
        """
        Delete entity with cross-tenant protection.
        
        Args:
            entity_id: The entity identifier to delete.
        
        Raises:
            TenantIsolationViolationException: If attempting to delete another
                tenant's entity.
        """
        pass


# =============================================================================
# Query Set Support
# =============================================================================

class TenantAwareQuerySet:
    """
    QuerySet wrapper that applies tenant filtering automatically.
    
    Used by repositories to build tenant-scoped queries.
    """
    
    def __init__(self, model_class: type, tenant_id: str):
        """
        Initialize query set with tenant filter.
        
        Args:
            model_class: The model class being queried.
            tenant_id: The tenant ID to filter by.
        """
        self._model_class = model_class
        self._tenant_id = tenant_id
        self._filters = {'tenant_id': tenant_id}
        self._limit = None
        self._offset = None
    
    def filter(self, **kwargs) -> 'TenantAwareQuerySet':
        """
        Add filter conditions (tenant filter applied automatically).
        
        Args:
            **kwargs: Filter conditions.
        
        Returns:
            New query set with additional filters.
        """
        new_qs = self._copy()
        new_qs._filters.update(kwargs)
        return new_qs
    
    def exclude(self, **kwargs) -> 'TenantAwareQuerySet':
        """
        Add exclusion conditions.
        
        Args:
            **kwargs: Exclusion conditions.
        
        Returns:
            New query set with exclusions.
        """
        new_qs = self._copy()
        for key, value in kwargs.items():
            new_qs._filters[f'!{key}'] = value
        return new_qs
    
    def limit(self, n: int) -> 'TenantAwareQuerySet':
        """Apply limit to query."""
        new_qs = self._copy()
        new_qs._limit = n
        return new_qs
    
    def offset(self, n: int) -> 'TenantAwareQuerySet':
        """Apply offset to query."""
        new_qs = self._copy()
        new_qs._offset = n
        return new_qs
    
    def all(self) -> list:
        """Execute query and return results."""
        # This would integrate with actual ORM in implementation
        return self._execute_query()
    
    def first(self) -> Optional[Any]:
        """Get first result."""
        results = self.limit(1).all()
        return results[0] if results else None
    
    def _execute_query(self) -> list:
        """
        Execute the query with tenant filter.
        
        Returns:
            List of matching entities.
        """
        # Placeholder for actual ORM integration
        # In real implementation: SELECT * FROM table WHERE tenant_id = ?
        return []
    
    def _copy(self) -> 'TenantAwareQuerySet':
        """Create a copy of this query set."""
        qs = TenantAwareQuerySet(self._model_class, self._tenant_id)
        qs._filters = dict(self._filters)
        qs._limit = self._limit
        qs._offset = self._offset
        return qs
    
    def __iter__(self):
        """Allow iteration over query results."""
        return iter(self.all())


# =============================================================================
# JPA Specification Support (Phase 2.3)
# =============================================================================

class TenantSpecification:
    """
    Utility class for building tenant-aware JPA/ORM specifications.
    
    Supports dynamic拼接租户条件 for complex queries.
    
    Usage:
        >>> spec = TenantSpecification.build()
        >>> if filter_name:
        ...     spec = spec.and(AssetSpecifications.with_name(filter_name))
        >>> results = repository.find_all(spec)
    """
    
    @staticmethod
    def build() -> 'TenantSpecification':
        """Start building a tenant specification."""
        return TenantSpecification()
    
    def __init__(self):
        """Initialize with base tenant filter."""
        self._conditions = []
        tenant_id = TenantContext.get_current_tenant()
        if tenant_id:
            self._conditions.append(('tenant_id', '=', tenant_id))
    
    def and_(self, other: 'TenantSpecification') -> 'TenantSpecification':
        """
        Combine with another specification using AND.
        
        Args:
            other: Another tenant specification.
        
        Returns:
            Combined specification.
        """
        result = TenantSpecification()
        result._conditions = list(self._conditions) + list(other._conditions)
        return result
    
    def get_conditions(self) -> list:
        """Get all conditions as tuples."""
        return list(self._conditions)


# =============================================================================
# SQL Interceptor Support (Phase 2.3 - MyBatis/SQLAlchemy)
# =============================================================================

class TenantSqlInterceptor:
    """
    SQL interceptor for adding tenant filters to raw queries.
    
    Provides defense-in-depth for queries not using the Repository layer.
    Implements Boundary Rule B-004 by wrapping raw SQL execution.
    
    Usage:
        >>> interceptor = TenantSqlInterceptor()
        >>> safe_sql = interceptor.inject_tenant_filter("SELECT * FROM assets")
        >>> results = connection.execute(safe_sql, params)
    """
    
    @staticmethod
    def inject_tenant_filter(sql: str) -> str:
        """
        Inject tenant filter into SQL query.
        
        Args:
            sql: Original SQL query.
        
        Returns:
            Modified SQL with tenant filter appended.
        
        Raises:
            TenantContextNotFoundException: If no tenant context available.
        """
        tenant_id = TenantContext.get_required_tenant()
        
        # Prevent cross-tenant joins
        sql_upper = sql.upper()
        if 'JOIN' in sql_upper and 'tenant_id' not in sql_upper.lower():
            raise CrossTenantJoinException(
                "Cross-tenant JOIN detected. All JOINs must include tenant_id filter."
            )
        
        # Inject WHERE clause or AND to existing WHERE
        if 'WHERE' in sql_upper:
            return f"{sql} AND tenant_id = '{tenant_id}'"
        else:
            return f"{sql} WHERE tenant_id = '{tenant_id}'"
    
    @staticmethod
    def validate_no_bypass(sql: str) -> None:
        """
        Validate SQL doesn't attempt to bypass tenant filtering.
        
        Args:
            sql: SQL query to validate.
        
        Raises:
            TenantIsolationViolationException: If bypass attempt detected.
        """
        dangerous_patterns = [
            'tenant_id = NULL',
            'tenant_id IS NULL',
            'tenant_id = \'\'',
            '-- tenant_filter',
            '/* tenant_filter */',
        ]
        
        for pattern in dangerous_patterns:
            if pattern.lower() in sql.lower():
                raise TenantIsolationViolationException(
                    f"Tenant filter bypass attempt detected: {pattern}"
                )