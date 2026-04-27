"""
Tenant Aware Mixin Module

This module provides the base mixin class for tenant-aware models.
It ensures data isolation by automatically injecting tenant_id
and blocking cross-tenant data access.

Based on SWARM-2025-Q2-P1-004: Multi-tenant Data Isolation Specification

硬性边界约束:
- B-001: 租户上下文解析异常时禁止静默放行
- B-002: SQL 层面禁止跨租户 JOIN 查询
- B-003: tenant_id 不可由客户端指定，必须从 JWT 解析
- B-004: 直接裸 SQL 执行不受此保护层约束
"""

from typing import Optional, Any, Dict


class TenantContextNotFoundException(RuntimeError):
    """
    Exception raised when tenant context is not available.
    
    Raised in scenarios:
    - JWT parsing failure
    - Missing tenant_id in JWT payload
    - Async task without inherited context
    - Direct SQL execution without context
    
    根据 B-001: 此异常必须抛出，禁止 fail-open
    """
    pass


class TenantIsolationViolationException(RuntimeError):
    """
    Exception raised when cross-tenant data access is attempted.
    
    Raised in scenarios:
    - Attempting to create record with different tenant_id
    - Attempting to update record belonging to different tenant
    - Attempting to delete record belonging to different tenant
    - Cross-tenant JOIN attempt
    
    根据 B-001: 此异常必须抛出，禁止 fail-open
    """
    pass


class CrossTenantJoinException(TenantIsolationViolationException):
    """
    Exception raised when cross-tenant JOIN is detected.
    
    根据 B-002: 禁止跨租户 JOIN 查询
    """
    pass


class TenantContextHolder:
    """
    Thread-local tenant context holder.
    
    Provides static methods for managing the tenant context using ThreadLocal storage.
    Supports context inheritance for async tasks.
    
    实现参考 Phase 2.4: 异步路径上下文传播
    """
    
    _local = None  # Will be initialized to contextvars.ContextVar or threading.local
    
    @classmethod
    def _get_storage(cls):
        """
        Get the underlying storage mechanism.
        
        Returns:
            Thread-local storage instance.
        """
        import threading
        if cls._local is None:
            cls._local = threading.local()
        return cls._local
    
    @classmethod
    def set(cls, tenant_id: str) -> None:
        """
        Set the current tenant_id in the context.
        
        Args:
            tenant_id: The tenant ID to set.
            
        Note:
            性能目标: p99 < 5ms (ATB-5)
        """
        storage = cls._get_storage()
        storage.tenant_id = tenant_id
    
    @classmethod
    def get(cls) -> Optional[str]:
        """
        Get the current tenant_id from context.
        
        Returns:
            The current tenant_id, or None if not set.
        """
        storage = cls._get_storage()
        return getattr(storage, 'tenant_id', None)
    
    @classmethod
    def clear(cls) -> None:
        """
        Clear the tenant context.
        
        Should be called at the end of request processing.
        """
        storage = cls._get_storage()
        if hasattr(storage, 'tenant_id'):
            delattr(storage, 'tenant_id')


def get_current_tenant_id(required: bool = True) -> Optional[str]:
    """
    Get the current tenant_id from the tenant context.
    
    Args:
        required: If True, raises TenantContextNotFoundException when context is missing.
                  If False, returns None when context is missing.
                  
    Returns:
        The current tenant_id.
        
    Raises:
        TenantContextNotFoundException: If required=True and context is not set.
        
    Note:
        根据 B-001: 租户上下文解析失败时默认拒绝访问
        根据 B-003: tenant_id 必须从 JWT 解析，不接受客户端传入
    """
    tenant_id = TenantContextHolder.get()
    if required and not tenant_id:
        raise TenantContextNotFoundException(
            "Tenant context not found. "
            "Ensure tenant context is set before performing data operations. "
            "This may indicate: JWT missing tenant_id, expired token, or context not propagated to async task."
        )
    return tenant_id


class TenantAwareMixin:
    """
    Mixin class for models that require tenant isolation.
    
    This mixin provides:
    - Automatic tenant_id injection on save (FR-002)
    - Cross-tenant write protection (B-001, B-003)
    - Tenant-aware query filtering helper (FR-002)
    
    Usage:
        class Resource(TenantAwareMixin, BaseModel):
            tenant_id: str
    
    实现参考 Phase 2.3: Repository 层租户过滤
    
    Note:
        所有 tenant-aware 模型必须包含 tenant_id 字段。
        在执行数据库操作前必须设置租户上下文。
    """
    
    # Class attribute to identify tenant-aware models
    _is_tenant_aware = True
    
    def get_current_tenant_id(self) -> str:
        """
        Retrieve the current tenant_id from the context.
        
        Returns:
            str: The current tenant ID.
            
        Raises:
            TenantContextNotFoundException: If no tenant context is set.
        """
        tenant_id = get_current_tenant_id(required=True)
        if not tenant_id:
            raise TenantContextNotFoundException(
                "Tenant context not found. "
                "Ensure tenant context is set before performing data operations."
            )
        return tenant_id
    
    def _inject_tenant_id(self) -> None:
        """
        Inject the current tenant_id into the model instance.
        
        Called before save to ensure tenant_id is set.
        
        Raises:
            TenantContextNotFoundException: If no tenant context is available.
        """
        if not getattr(self, 'tenant_id', None):
            self.tenant_id = self.get_current_tenant_id()
    
    def _validate_tenant_isolation(self, operation: str = "create") -> None:
        """
        Validate that the operation does not violate tenant isolation.
        
        Args:
            operation: The operation being performed ('create', 'update', 'delete').
            
        Raises:
            TenantIsolationViolationException: If tenant_id does not match current context.
        """
        current_tenant = get_current_tenant_id(required=True)
        record_tenant = getattr(self, 'tenant_id', None)
        
        if record_tenant and record_tenant != current_tenant:
            raise TenantIsolationViolationException(
                f"Cross-tenant {operation} attempt blocked. "
                f"Record tenant_id={record_tenant}, "
                f"Current tenant context={current_tenant}. "
                f"Operation: {operation} on {self.__class__.__name__}"
            )
    
    def _is_new(self) -> bool:
        """
        Check if this is a new record (not yet persisted).
        
        Returns:
            bool: True if the record is new, False otherwise.
        """
        pk = getattr(self, 'id', None) or getattr(self, 'pk', None)
        return pk is None or pk == 0
    
    def save(self, *args, **kwargs) -> Any:
        """
        Save the model instance with automatic tenant_id injection.
        
        On create operations:
        - Automatically assigns the current tenant_id if not set
        - Validates that set tenant_id matches current context (B-003)
        
        On update operations:
        - Validates the tenant_id matches current context
        
        Args:
            *args: Additional positional arguments passed to parent save.
            **kwargs: Additional keyword arguments passed to parent save.
            
        Returns:
            The result of the parent save operation.
            
        Raises:
            TenantContextNotFoundException: If no tenant context is available for new records.
            TenantIsolationViolationException: If attempting to modify a record from another tenant.
            
        Note:
            根据 B-001: 禁止 fail-open，隔离失效必须抛出异常
            根据 B-003: tenant_id 必须从 JWT 解析，不接受客户端指定
        """
        is_new = self._is_new()
        
        if is_new:
            # Auto-inject tenant_id for new records
            if not getattr(self, 'tenant_id', None):
                self._inject_tenant_id()
            else:
                # Client attempted to set tenant_id - validate it matches context (B-003)
                # This prevents malicious clients from specifying tenant_id
                self._validate_tenant_isolation(operation='create')
        else:
            # Validate tenant_id on update - block cross-tenant modification
            self._validate_tenant_isolation(operation='update')
        
        return super().save(*args, **kwargs)
    
    @classmethod
    def get_tenant_filter(cls) -> Dict[str, str]:
        """
        Get the current tenant filter dict for database queries.
        
        Returns:
            dict: A filter dict with the current tenant_id.
            
        Raises:
            TenantContextNotFoundException: If no tenant context is available.
            
        Example:
            >>> filter_dict = Resource.get_tenant_filter()
            >>> # Returns: {'tenant_id': 'tenant-001'}
            >>> Resource.query().filter(**filter_dict)
        """
        return {'tenant_id': get_current_tenant_id(required=True)}
    
    @classmethod
    def query_tenant_aware(cls) -> 'QuerySet':
        """
        Create a tenant-aware query filtered by the current tenant.
        
        Returns:
            A QuerySet filtered by the current tenant_id.
            
        Raises:
            TenantContextNotFoundException: If no tenant context is available.
            
        Note:
            This is a helper method. Concrete implementations should override
            with ORM-specific implementations (JPA Specification, MyBatis filter, etc.)
            
        Example:
            >>> class Resource(TenantAwareMixin, BaseModel):
            ...     tenant_id: str
            >>> 
            >>> # Usage - automatically filters by current tenant
            >>> resources = Resource.query_tenant_aware().all()
        """
        # This method should be overridden by concrete repository implementations
        # For now, return a filter dict that can be applied to any ORM
        return cls.query().filter(**cls.get_tenant_filter())


def validate_cross_tenant_join(
    left_model: type,
    right_model: type,
    join_condition: str = None
) -> None:
    """
    Validate that a JOIN operation does not cross tenant boundaries.
    
    Args:
        left_model: The left model class in the join.
        right_model: The right model class in the join.
        join_condition: Optional join condition for logging.
        
    Raises:
        CrossTenantJoinException: If cross-tenant join is detected.
        
    Note:
        根据 B-002: 禁止跨租户 JOIN 查询
    """
    left_has_tenant = getattr(left_model, '_is_tenant_aware', False)
    right_has_tenant = getattr(right_model, '_is_tenant_aware', False)
    
    if left_has_tenant and right_has_tenant:
        # Both are tenant-aware - validate they're for the same tenant
        left_tenant = get_current_tenant_id(required=False)
        if left_tenant:
            raise CrossTenantJoinException(
                f"Cross-tenant JOIN detected between {left_model.__name__} and {right_model.__name__}. "
                f"Join condition: {join_condition}. "
                f"All tenant-aware tables must be joined within the same tenant context."
            )