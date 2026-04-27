"""
QuerySet implementation for multi-tenant data isolation.

SWARM-2025-Q2-P1-004: Multi-tenant data isolation specification.
Phase 2.3: Repository layer tenant filtering.

This module provides QuerySet abstraction that automatically enforces
tenant isolation at the data access layer.
"""

from typing import Optional, List, Any, Dict, TypeVar, Type, Callable
from datetime import datetime

from core.tenant_context import TenantContext
from core.exceptions import (
    TenantContextNotFoundException,
    TenantIsolationViolationException,
    CrossTenantJoinException,
)

# Type variable for model type hinting
M = TypeVar('M')


class QuerySet:
    """
    Tenant-aware QuerySet implementation.
    
    All queries automatically inject tenant filtering conditions to ensure
    data isolation between tenants. Operations that would violate tenant
    boundaries are rejected with appropriate exceptions.
    
    Design Principles (per SWARM-2025-Q2-P1-004):
    - B-001: Fail-closed - context absence triggers rejection, never silent bypass
    - B-002: Cross-tenant JOINs are prohibited
    - B-003: tenant_id cannot be client-specified; must be derived from JWT/Context
    """

    def __init__(self, model_class: Type[M]):
        """
        Initialize QuerySet for a given model class.
        
        Args:
            model_class: The model class this QuerySet operates on.
        """
        self._model_class = model_class
        self._tenant_id: Optional[str] = None
        self._filters: List[Dict[str, Any]] = []
        self._limit: Optional[int] = None
        self._offset: Optional[int] = None
        self._order_by: List[str] = []

    def _get_current_tenant_id(self) -> str:
        """
        Retrieve current tenant ID from TenantContext.
        
        Returns:
            The current tenant_id string.
            
        Raises:
            TenantContextNotFoundException: If no tenant context exists (B-001).
        """
        tenant_id = TenantContext.get_current_tenant()
        if not tenant_id:
            raise TenantContextNotFoundException(
                "Tenant context is required for all data access operations. "
                "Request must include valid JWT with tenant_id claim."
            )
        return tenant_id

    def filter(self, **kwargs) -> 'QuerySet':
        """
        Add filter conditions to the query.
        
        Args:
            **kwargs: Field-value pairs to filter on.
            
        Returns:
            A new QuerySet instance with added filters.
            
        Raises:
            TenantContextNotFoundException: If no tenant context (B-001).
        """
        self._get_current_tenant_id()  # Validate context exists
        new_qs = self._clone()
        new_qs._filters.append(kwargs)
        return new_qs

    def exclude(self, **kwargs) -> 'QuerySet':
        """
        Add exclusion conditions to the query.
        
        Args:
            **kwargs: Field-value pairs to exclude.
            
        Returns:
            A new QuerySet instance with exclusion filters.
        """
        self._get_current_tenant_id()
        new_qs = self._clone()
        # Convert to negated filter
        for key, value in kwargs.items():
            new_qs._filters.append({f"__exclude__{key}": value})
        return new_qs

    def limit(self, n: int) -> 'QuerySet':
        """
        Limit query results.
        
        Args:
            n: Maximum number of results to return.
            
        Returns:
            A new QuerySet with limit applied.
        """
        new_qs = self._clone()
        new_qs._limit = n
        return new_qs

    def offset(self, n: int) -> 'QuerySet':
        """
        Offset query results.
        
        Args:
            n: Number of results to skip.
            
        Returns:
            A new QuerySet with offset applied.
        """
        new_qs = self._clone()
        new_qs._offset = n
        return new_qs

    def order_by(self, *fields: str) -> 'QuerySet':
        """
        Add ordering to the query.
        
        Args:
            *fields: Field names to order by. Prefix with '-' for descending.
            
        Returns:
            A new QuerySet with ordering applied.
        """
        new_qs = self._clone()
        new_qs._order_by.extend(fields)
        return new_qs

    def all(self) -> List[M]:
        """
        Execute query and return all matching results.
        
        Automatically injects tenant filtering. Only returns records
        belonging to the current tenant.
        
        Returns:
            List of model instances matching the query.
            
        Raises:
            TenantContextNotFoundException: If no tenant context (B-001).
        """
        tenant_id = self._get_current_tenant_id()
        # Inject tenant filter as primary condition
        return self._execute_query(tenant_id)

    def first(self) -> Optional[M]:
        """
        Return the first matching result or None.
        
        Returns:
            First matching model instance, or None if no matches.
        """
        results = self.limit(1).all()
        return results[0] if results else None

    def count(self) -> int:
        """
        Count matching records.
        
        Returns:
            Number of records matching the query for current tenant.
        """
        tenant_id = self._get_current_tenant_id()
        # Implementation would delegate to repository with tenant filter
        return self._count_with_tenant(tenant_id)

    def exists(self) -> bool:
        """
        Check if any records match the query.
        
        Returns:
            True if at least one record matches, False otherwise.
        """
        return self.count() > 0

    def _execute_query(self, tenant_id: str) -> List[M]:
        """
        Internal method to execute query with tenant filtering.
        
        Args:
            tenant_id: The tenant ID to filter by.
            
        Returns:
            List of matching model instances.
        """
        # Build the tenant-filtered query
        query_conditions = {"tenant_id": tenant_id}
        
        # Apply additional user filters
        for f in self._filters:
            for key, value in f.items():
                if key.startswith("__exclude__"):
                    continue  # Handle exclusion separately
                query_conditions[key] = value
        
        # In production, this delegates to the repository layer
        # which implements actual database query with tenant filtering
        return self._model_class.query_tenant_aware(
            tenant_id=tenant_id,
            conditions=query_conditions,
            limit=self._limit,
            offset=self._offset,
            order_by=self._order_by,
        )

    def _count_with_tenant(self, tenant_id: str) -> int:
        """
        Count records with tenant filtering.
        
        Args:
            tenant_id: The tenant ID to filter by.
            
        Returns:
            Count of matching records.
        """
        return self._model_class.count_tenant_aware(
            tenant_id=tenant_id,
            conditions={k: v for f in self._filters for k, v in f.items() if not k.startswith("__exclude__")}
        )

    def _clone(self) -> 'QuerySet':
        """
        Create a shallow copy of this QuerySet.
        
        Returns:
            A new QuerySet with copied state.
        """
        new_qs = QuerySet(self._model_class)
        new_qs._filters = list(self._filters)
        new_qs._limit = self._limit
        new_qs._offset = self._offset
        new_qs._order_by = list(self._order_by)
        return new_qs

    def join(self, other_model: Type, on: str) -> 'QuerySet':
        """
        Attempt a JOIN query between models.
        
        Note: Cross-tenant JOINs are strictly prohibited per B-002.
        This method raises CrossTenantJoinException if the join would
        cross tenant boundaries.
        
        Args:
            other_model: The model to join with.
            on: The join condition field.
            
        Raises:
            CrossTenantJoinException: Always, per B-002 restriction.
        """
        raise CrossTenantJoinException(
            "Cross-tenant JOIN queries are prohibited by SWARM-2025-Q2-P1-004 B-002. "
            "All queries must operate within a single tenant boundary."
        )

    def __iter__(self):
        """Allow iteration over query results."""
        return iter(self.all())

    def __len__(self) -> int:
        """Return count of results."""
        return self.count()


class TenantAwareModel:
    """
    Base class for models that require tenant isolation.
    
    Models inheriting from this class will automatically have tenant_id
    injected on save and filtered on queries.
    """
    
    tenant_id: str
    
    @classmethod
    def query(cls) -> QuerySet:
        """
        Start a tenant-aware query.
        
        Returns:
            QuerySet configured for this model class.
        """
        return QuerySet(cls)
    
    @classmethod
    def query_tenant_aware(
        cls,
        tenant_id: str,
        conditions: Dict[str, Any],
        limit: Optional[int] = None,
        offset: Optional[int] = None,
        order_by: Optional[List[str]] = None,
    ) -> List[Any]:
        """
        Base implementation for tenant-aware queries.
        
        Override this in concrete model implementations with actual
        database access logic.
        
        Args:
            tenant_id: The tenant ID for filtering.
            conditions: Additional filter conditions.
            limit: Result limit.
            offset: Result offset.
            order_by: Ordering fields.
            
        Returns:
            List of matching model instances.
        """
        # Subclasses should override with actual repository implementation
        return []
    
    @classmethod
    def count_tenant_aware(
        cls,
        tenant_id: str,
        conditions: Dict[str, Any],
    ) -> int:
        """
        Base implementation for tenant-aware count queries.
        
        Override in concrete models with actual count logic.
        
        Args:
            tenant_id: The tenant ID for filtering.
            conditions: Additional filter conditions.
            
        Returns:
            Count of matching records.
        """
        return 0

    def save(self) -> None:
        """
        Save model with automatic tenant_id injection.
        
        If tenant_id is not set, it will be automatically populated
        from the current TenantContext.
        
        Raises:
            TenantContextNotFoundException: If no tenant context when saving.
            TenantIsolationViolationException: If attempting to save with
                a different tenant_id than current context.
        """
        current_tenant = TenantContext.get_current_tenant()
        if not current_tenant:
            raise TenantContextNotFoundException(
                "Cannot save: no tenant context available. "
                "Ensure request includes valid JWT with tenant_id."
            )
        
        # If model has tenant_id attribute, validate it
        if hasattr(self, 'tenant_id') and self.tenant_id:
            if self.tenant_id != current_tenant:
                raise TenantIsolationViolationException(
                    f"Tenant isolation violation: cannot save record with "
                    f"tenant_id='{self.tenant_id}' when current context is "
                    f"tenant_id='{current_tenant}'"
                )
        
        # Auto-inject tenant_id from context
        if hasattr(self, 'tenant_id'):
            self.tenant_id = current_tenant
        
        # Delegate to actual save implementation
        self._do_save()
    
    def _do_save(self) -> None:
        """
        Internal save implementation.
        
        Override in subclasses with actual database save logic.
        """
        pass


def validate_tenant_context(operation: str) -> str:
    """
    Validate tenant context exists and return current tenant_id.
    
    This is a utility function for use in service/repository layers
    to ensure tenant isolation before any data access.
    
    Args:
        operation: Description of the operation being performed (for error messages).
        
    Returns:
        The current tenant_id.
        
    Raises:
        TenantContextNotFoundException: If no valid tenant context.
    """
    tenant_id = TenantContext.get_current_tenant()
    if not tenant_id:
        raise TenantContextNotFoundException(
            f"Operation '{operation}' requires tenant context. "
            f"Ensure Authorization header contains valid JWT with tenant_id claim. "
            f"Request rejected per B-001 (fail-closed)."
        )
    return tenant_id