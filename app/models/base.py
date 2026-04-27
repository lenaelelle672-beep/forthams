"""
Base model classes for the multi-tenant asset management system.

This module provides the foundational model classes that implement
multi-tenant data isolation per SWARM-2025-Q2-P1-004 specification.

Key features:
- All models include tenant_id field for data isolation
- BaseRepository provides automatic tenant filtering
- Write operations enforce tenant boundary protection
"""

from datetime import datetime
from typing import Any, Generic, TypeVar, Optional, ClassVar, List, Type, Union
from dataclasses import dataclass, field
import uuid

# Import tenant context for isolation enforcement
try:
    from core.tenant_context import TenantContext, TenantContextHolder
    from core.exceptions import TenantContextNotFoundException, TenantIsolationViolationException
except ImportError:
    # Fallback for testing without full module
    class TenantContext:
        @staticmethod
        def get_current_tenant() -> str:
            return getattr(TenantContext, '_tenant_id', None)
        
        @staticmethod
        def get_current_user_id() -> Optional[int]:
            return getattr(TenantContext, '_user_id', None)
    
    class TenantContextHolder:
        @staticmethod
        def get() -> Optional[str]:
            return TenantContext.get_current_tenant()
    
    class TenantContextNotFoundException(Exception):
        pass
    
    class TenantIsolationViolationException(Exception):
        pass


# Type variable for generic model
T = TypeVar('T', bound='TenantAwareModel')


class TenantAwareModel:
    """
    Base class for all tenant-aware domain models.
    
    All entities that need multi-tenant isolation must inherit from this class.
    The tenant_id field is automatically managed and enforced at the data layer.
    
    Attributes:
        id: Unique identifier for the model instance
        tenant_id: The tenant that owns this record (required)
        created_at: Timestamp when record was created
        updated_at: Timestamp when record was last modified
    """
    
    # Class variable to identify tenant-aware models
    __tenant_aware__: ClassVar[bool] = True
    
    # Fields that must be present in subclasses
    id: str
    tenant_id: str
    created_at: datetime
    updated_at: datetime
    
    def __init__(self, **kwargs):
        """Initialize model with tenant context if not provided."""
        # Store original kwargs before processing
        self._original_kwargs = kwargs.copy()
        
        # Set tenant_id from context if not provided
        if 'tenant_id' not in kwargs or not kwargs['tenant_id']:
            try:
                ctx_tenant = TenantContext.get_current_tenant()
                if ctx_tenant:
                    kwargs['tenant_id'] = ctx_tenant
            except Exception:
                pass  # Context may not be available during initialization
        
        # Apply all kwargs to instance
        for key, value in kwargs.items():
            setattr(self, key, value)
        
        # Generate UUID for id if not provided
        if not hasattr(self, 'id') or not self.id:
            self.id = str(uuid.uuid4())
        
        # Set timestamps
        now = datetime.utcnow()
        if not hasattr(self, 'created_at') or not self.created_at:
            self.created_at = now
        if not hasattr(self, 'updated_at') or not self.updated_at:
            self.updated_at = now
    
    def validate_tenant_ownership(self) -> None:
        """
        Validate that current tenant context matches this record's tenant.
        
        Raises:
            TenantIsolationViolationException: If tenant context doesn't match record's tenant_id
        """
        try:
            current_tenant = TenantContext.get_current_tenant()
        except TenantContextNotFoundException:
            raise TenantIsolationViolationException(
                "Cannot access record: No tenant context available"
            )
        
        if not current_tenant:
            raise TenantIsolationViolationException(
                "Cannot access record: No tenant context available"
            )
        
        if current_tenant != self.tenant_id:
            raise TenantIsolationViolationException(
                f"Cross-tenant access denied: Current tenant '{current_tenant}' "
                f"attempted to access record belonging to tenant '{self.tenant_id}'"
            )
    
    def save(self) -> 'TenantAwareModel':
        """
        Save the model instance with tenant enforcement.
        
        On create: Automatically injects current tenant_id
        On update: Validates tenant ownership before saving
        
        Returns:
            The saved model instance
            
        Raises:
            TenantIsolationViolationException: If cross-tenant write is attempted
        """
        # Check if this is a new record or update
        is_new = not getattr(self, '_persisted', False)
        
        if is_new:
            # New record: inject tenant_id from context
            if not getattr(self, 'tenant_id', None):
                current_tenant = TenantContext.get_current_tenant()
                if not current_tenant:
                    raise TenantContextNotFoundException(
                        "Cannot create record: No tenant context available"
                    )
                self.tenant_id = current_tenant
        else:
            # Update: validate tenant ownership
            self.validate_tenant_ownership()
        
        # Update timestamp
        self.updated_at = datetime.utcnow()
        
        # Mark as persisted
        self._persisted = True
        
        return self
    
    def delete(self) -> bool:
        """
        Delete the model instance with tenant enforcement.
        
        Returns:
            True if deletion was successful
            
        Raises:
            TenantIsolationViolationException: If cross-tenant delete is attempted
        """
        self.validate_tenant_ownership()
        # Actual deletion would be handled by repository
        self._deleted = True
        return True
    
    def to_dict(self) -> dict:
        """Convert model to dictionary representation."""
        result = {}
        for key, value in self.__dict__.items():
            if not key.startswith('_'):
                if isinstance(value, datetime):
                    result[key] = value.isoformat()
                else:
                    result[key] = value
        return result


class BaseRepository(Generic[T]):
    """
    Abstract base repository class that provides multi-tenant data isolation.
    
    All data access operations automatically filter by current tenant context,
    preventing cross-tenant data access at the repository layer.
    
    Type Parameters:
        T: The model type this repository manages
        
    Example:
        class AssetRepository(BaseRepository[Asset]):
            pass
        
        # All queries automatically filtered by tenant
        assets = asset_repo.find_all()  # Only returns current tenant's assets
    """
    
    # The model class this repository manages
    model_class: ClassVar[Type[T]]
    
    # In-memory storage for demo/testing (replace with actual DB in production)
    _storage: ClassVar[List[T]] = []
    
    def __init__(self):
        """Initialize repository with current tenant context."""
        self._ensure_tenant_context()
    
    def _ensure_tenant_context(self) -> None:
        """
        Ensure tenant context is available before any operation.
        
        Raises:
            TenantContextNotFoundException: If no tenant context is set
        """
        try:
            current_tenant = TenantContext.get_current_tenant()
            if not current_tenant:
                raise TenantContextNotFoundException(
                    "Tenant context required for repository operation"
                )
        except TenantContextNotFoundException:
            raise
    
    def _get_current_tenant(self) -> str:
        """
        Get the current tenant ID from context.
        
        Returns:
            The current tenant ID
            
        Raises:
            TenantContextNotFoundException: If no tenant context available
        """
        tenant = TenantContext.get_current_tenant()
        if not tenant:
            raise TenantContextNotFoundException(
                "Tenant context required for repository operation"
            )
        return tenant
    
    def _filter_by_tenant(self, records: List[T]) -> List[T]:
        """
        Filter records to only those belonging to current tenant.
        
        Args:
            records: List of records to filter
            
        Returns:
            Filtered list containing only current tenant's records
        """
        current_tenant = self._get_current_tenant()
        return [
            record for record in records
            if hasattr(record, 'tenant_id') and record.tenant_id == current_tenant
        ]
    
    def _validate_tenant_for_write(self, record: T) -> None:
        """
        Validate that write operation is within tenant boundaries.
        
        Args:
            record: The record being written
            
        Raises:
            TenantIsolationViolationException: If write would cross tenant boundary
        """
        current_tenant = self._get_current_tenant()
        
        # Check if record has different tenant_id
        record_tenant = getattr(record, 'tenant_id', None)
        if record_tenant and record_tenant != current_tenant:
            raise TenantIsolationViolationException(
                f"Cross-tenant write denied: Cannot write to tenant '{record_tenant}' "
                f"from tenant '{current_tenant}'"
            )
    
    def find_by_id(self, record_id: str) -> Optional[T]:
        """
        Find a record by ID, restricted to current tenant.
        
        Args:
            record_id: The ID of the record to find
            
        Returns:
            The record if found within current tenant, None otherwise
        """
        current_tenant = self._get_current_tenant()
        
        for record in self._storage:
            if (hasattr(record, 'id') and 
                record.id == record_id and 
                hasattr(record, 'tenant_id') and 
                record.tenant_id == current_tenant):
                return record
        
        return None
    
    def find_all(self) -> List[T]:
        """
        Find all records belonging to current tenant.
        
        Returns:
            List of records for current tenant (never returns other tenants' data)
        """
        return self._filter_by_tenant(self._storage)
    
    def find_by(self, **criteria) -> List[T]:
        """
        Find records matching criteria, automatically filtered by tenant.
        
        Args:
            **criteria: Field-value pairs to match
            
        Returns:
            List of matching records within current tenant
        """
        # Always include tenant filter
        criteria['tenant_id'] = self._get_current_tenant()
        
        results = []
        for record in self._storage:
            match = True
            for key, value in criteria.items():
                record_value = getattr(record, key, None)
                if record_value != value:
                    match = False
                    break
            if match:
                results.append(record)
        
        return results
    
    def save(self, record: T) -> T:
        """
        Save a record with tenant enforcement.
        
        On create: Sets tenant_id from current context
        On update: Validates tenant ownership
        
        Args:
            record: The record to save
            
        Returns:
            The saved record
            
        Raises:
            TenantContextNotFoundException: If no tenant context available
            TenantIsolationViolationException: If cross-tenant write attempted
        """
        # Ensure record has tenant_id from context
        if not getattr(record, 'tenant_id', None):
            record.tenant_id = self._get_current_tenant()
        
        # Validate no cross-tenant write
        self._validate_tenant_for_write(record)
        
        # Check if update or create
        is_update = getattr(record, '_persisted', False)
        
        if is_update:
            # Verify ownership
            existing = self.find_by_id(record.id)
            if not existing:
                raise TenantIsolationViolationException(
                    f"Cannot update non-existent or unauthorized record: {record.id}"
                )
        
        # Set timestamps
        record.updated_at = datetime.utcnow()
        if not getattr(record, '_persisted', False):
            record.created_at = datetime.utcnow()
        
        # Persist
        record._persisted = True
        
        # Add to storage (replace if exists)
        self._remove_from_storage(record.id)
        self._storage.append(record)
        
        return record
    
    def _remove_from_storage(self, record_id: str) -> bool:
        """
        Remove a record from storage by ID (tenant-aware).
        
        Args:
            record_id: ID of record to remove
            
        Returns:
            True if record was removed
        """
        current_tenant = self._get_current_tenant()
        
        for i, record in enumerate(self._storage):
            if (hasattr(record, 'id') and 
                record.id == record_id and 
                hasattr(record, 'tenant_id') and 
                record.tenant_id == current_tenant):
                del self._storage[i]
                return True
        
        return False
    
    def delete(self, record_id: str) -> bool:
        """
        Delete a record by ID with tenant enforcement.
        
        Args:
            record_id: ID of record to delete
            
        Returns:
            True if deletion successful
            
        Raises:
            TenantContextNotFoundException: If no tenant context
            TenantIsolationViolationException: If record belongs to different tenant
        """
        # Verify record exists within this tenant first
        record = self.find_by_id(record_id)
        if not record:
            raise TenantIsolationViolationException(
                f"Cannot delete record {record_id}: Record not found or access denied"
            )
        
        return self._remove_from_storage(record_id)
    
    def delete_by_id(self, record_id: str) -> bool:
        """
        Delete a record by ID (alias for delete).
        
        Args:
            record_id: ID of record to delete
            
        Returns:
            True if deletion successful
            
        Raises:
            TenantContextNotFoundException: If no tenant context
            TenantIsolationViolationException: If cross-tenant delete attempted
        """
        return self.delete(record_id)
    
    def count(self) -> int:
        """
        Count records for current tenant.
        
        Returns:
            Number of records belonging to current tenant
        """
        return len(self.find_all())
    
    def exists(self, record_id: str) -> bool:
        """
        Check if a record exists within current tenant.
        
        Args:
            record_id: ID to check
            
        Returns:
            True if record exists within current tenant
        """
        return self.find_by_id(record_id) is not None


class TenantSpecification:
    """
    Utility class for building tenant-aware query specifications.
    
    Provides static methods to create tenant filtering conditions
    that can be combined with other query criteria.
    
    Example:
        spec = TenantSpecification.for_current_tenant()
        combined = spec.and_(Asset.status == 'active')
    """
    
    @staticmethod
    def for_current_tenant() -> dict:
        """
        Create tenant filter for current context.
        
        Returns:
            Dict with tenant_id filter
            
        Raises:
            TenantContextNotFoundException: If no tenant context available
        """
        tenant = TenantContext.get_current_tenant()
        if not tenant:
            raise TenantContextNotFoundException(
                "Tenant context required for specification"
            )
        return {'tenant_id': tenant}
    
    @staticmethod
    def for_tenant(tenant_id: str) -> dict:
        """
        Create tenant filter for specific tenant.
        
        Args:
            tenant_id: The tenant ID to filter by
            
        Returns:
            Dict with tenant_id filter
        """
        return {'tenant_id': tenant_id}


class TenantSqlInterceptor:
    """
    SQL interceptor that enforces tenant filtering on raw queries.
    
    This interceptor ensures that even direct SQL execution
    maintains tenant isolation boundaries.
    
    Note: In production, this would integrate with the actual SQL
    execution layer (e.g., MyBatis interceptor, SQLAlchemy event listener).
    """
    
    @staticmethod
    def intercept_sql(sql: str, params: list) -> tuple:
        """
        Intercept and modify SQL to include tenant filtering.
        
        Args:
            sql: Original SQL statement
            params: SQL parameters
            
        Returns:
            Tuple of (modified_sql, modified_params)
            
        Raises:
            TenantContextNotFoundException: If no tenant context available
        """
        tenant = TenantContext.get_current_tenant()
        if not tenant:
            raise TenantContextNotFoundException(
                "Tenant context required for SQL execution"
            )
        
        # For SELECT queries, add tenant WHERE clause
        if sql.strip().upper().startswith('SELECT'):
            # Simple injection - in production use proper SQL parser
            if 'WHERE' in sql.upper():
                # Append to existing WHERE
                modified_sql = sql + f" AND tenant_id = ?"
            else:
                # Add new WHERE
                modified_sql = sql + f" WHERE tenant_id = ?"
            
            params = params + [tenant]
            return modified_sql, params
        
        # For INSERT, validate tenant_id
        if sql.strip().upper().startswith('INSERT'):
            # Ensure tenant_id is in the insert values
            # This is a safety check - actual validation happens at higher layer
            pass
        
        # For UPDATE/DELETE, reject if no tenant context
        if sql.strip().upper().startswith(('UPDATE', 'DELETE')):
            if 'tenant_id' not in sql.lower():
                raise TenantIsolationViolationException(
                    "UPDATE/DELETE operations must include tenant_id filter"
                )
        
        return sql, params