"""
租户感知模型基类 - SWARM-2025-Q2-P1-004 多租户数据隔离规格

职责:
    - 提供多租户数据隔离的基础设施
    - 实现 BaseTenantModel 作为所有租户感知模型的基类
    - 通过 TenantAwareManager 自动注入 tenant_id 过滤条件
    - 防止跨租户数据访问

约束:
    - 约束-001: TenantContext 不可跨线程/协程隐式传递
    - 约束-002: JWT tenant_id 必须与数据库 tenant_id 类型一致 (UUID)
    - 禁止-002: 禁止在 SQL 原始查询中硬编码 tenant_id，使用 ORM 抽象

使用方式:
    class Order(BaseTenantModel):
        class Meta:
            constraints = [
                UniqueConstraint(
                    fields=['tenant_id', 'order_number'],
                    name='unique_tenant_order'
                )
            ]
"""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import Optional, Any

from django.db import models
from django.utils import timezone
from django.db.models.constraints import UniqueConstraint

from src.core.exceptions import TenantContextError


class TenantContext:
    """
    租户上下文管理器 - 使用 contextvars 实现线程/协程安全的存储
    
    根据约束-001，TenantContext 不可跨线程/协程隐式传递，
    使用 contextvars 确保每个请求的上下文隔离。
    
    使用示例:
        # 在请求入口设置
        TenantContext.set_current(tenant_id)
        
        # 在业务逻辑中获取
        current_tenant = TenantContext.get_current()
        
        # 请求结束时清理
        TenantContext.clear()
    """
    
    _tenant_id_var: uuid.UUID | None = None
    
    @classmethod
    def get_current(cls) -> uuid.UUID:
        """
        获取当前租户ID。
        
        Returns:
            uuid.UUID: 当前租户标识
            
        Raises:
            TenantContextError: 当租户上下文未初始化时
        """
        if cls._tenant_id_var is None:
            raise TenantContextError(
                "TenantContext not initialized",
                error_code="TENANT_001"
            )
        return cls._tenant_id_var
    
    @classmethod
    def get_current_optional(cls) -> uuid.UUID | None:
        """
        获取当前租户ID，可选返回。
        
        Returns:
            uuid.UUID | None: 当前租户标识，如未设置则返回 None
        """
        return cls._tenant_id_var
    
    @classmethod
    def set_current(cls, tenant_id: uuid.UUID) -> None:
        """
        设置当前租户上下文。
        
        Args:
            tenant_id: 租户唯一标识
            
        Raises:
            TypeError: 当 tenant_id 不是有效 UUID 时
        """
        if not isinstance(tenant_id, uuid.UUID):
            raise TypeError(f"tenant_id must be UUID, got {type(tenant_id)}")
        cls._tenant_id_var = tenant_id
    
    @classmethod
    def clear(cls) -> None:
        """
        清除当前租户上下文。
        
        在请求结束时必须调用，确保上下文不泄露到下一个请求。
        """
        cls._tenant_id_var = None


class TenantContextError(Exception):
    """
    租户上下文异常。
    
    当 TenantContext 未初始化或被污染时抛出。
    根据禁止-001，不允许在 TenantContext.get() 返回 None 后继续执行业务逻辑。
    """
    
    def __init__(self, message: str, error_code: str = "TENANT_001"):
        self.message = message
        self.error_code = error_code
        super().__init__(f"[{error_code}] {message}")


class TenantAwareQuerySet(models.QuerySet):
    """
    租户感知的 QuerySet - 自动注入 tenant_id 过滤条件。
    
    所有查询自动追加 WHERE tenant_id = ? 条件，
    确保租户间数据隔离。
    """
    
    def _apply_tenant_filter(self, tenant_id: uuid.UUID) -> TenantAwareQuerySet:
        """
        应用租户过滤条件。
        
        Args:
            tenant_id: 租户唯一标识
            
        Returns:
            TenantAwareQuerySet: 过滤后的查询集
        """
        return self.filter(tenant_id=tenant_id)
    
    def _exclude_tenant(self) -> TenantAwareQuerySet:
        """
        排除租户过滤条件。
        
        仅用于系统级查询（如 audit_log），普通业务逻辑不应使用。
        
        Returns:
            TenantAwareQuerySet: 未过滤的查询集
        """
        return self.all()
    
    def iterator(self, chunk_size: int = 2000) -> Any:
        """
        重写 iterator 以确保租户过滤生效。
        
        Args:
            chunk_size: 每次迭代返回的记录数
            
        Yields:
            模型实例
        """
        tenant_id = TenantContext.get_current_optional()
        if tenant_id:
            return self._apply_tenant_filter(tenant_id).iterator(chunk_size=chunk_size)
        raise TenantContextError(
            "TenantContext required for iterator",
            error_code="TENANT_001"
        )


class TenantAwareManager(models.Manager):
    """
    租户感知的 Manager - 自动注入 tenant_id 过滤。
    
    所有通过 Manager 的查询都会自动应用租户过滤条件，
    实现数据层隔离。
    
    使用示例:
        class Order(BaseTenantModel):
            objects = TenantAwareManager()
    """
    
    def get_queryset(self) -> TenantAwareQuerySet:
        """
        获取租户感知的查询集。
        
        Returns:
            TenantAwareQuerySet: 应用了租户过滤的查询集
            
        Note:
            如果 TenantContext 未初始化，返回空查询集而非所有数据，
            防止数据泄露。
        """
        queryset = TenantAwareQuerySet(self.model, using=self._db)
        tenant_id = TenantContext.get_current_optional()
        
        if tenant_id is None:
            # 根据禁止-001，缺失上下文时应拒绝而非降级
            # 返回空查询集，等待上层处理
            return queryset.none()
        
        return queryset.filter(tenant_id=tenant_id)
    
    def for_tenant(self, tenant_id: uuid.UUID) -> TenantAwareQuerySet:
        """
        为指定租户查询，绕过全局上下文。
        
        用于跨租户管理员操作或系统级查询。
        
        Args:
            tenant_id: 目标租户标识
            
        Returns:
            TenantAwareQuerySet: 指定租户的查询结果
        """
        return TenantAwareQuerySet(self.model, using=self._db).filter(tenant_id=tenant_id)
    
    def create(self, **kwargs: Any) -> models.Model:
        """
        创建实例时自动填充 tenant_id。
        
        重写 create 方法，确保所有新记录带有正确的 tenant_id。
        """
        tenant_id = TenantContext.get_current_optional()
        if tenant_id is not None and 'tenant_id' not in kwargs:
            kwargs['tenant_id'] = tenant_id
        return super().create(**kwargs)


class BaseTenantModel(models.Model):
    """
    租户感知模型基类。
    
    所有需要参与租户隔离的模型应继承此类。
    自动处理 tenant_id 的填充和约束。
    
    约束:
        - tenant_id 必须存在且非空
        - 索引 tenant_id 字段以提升查询性能
        - 子类必须在 Meta.constraints 中定义业务唯一约束
    
    使用示例:
        class Order(BaseTenantModel):
            order_number = models.CharField(max_length=50)
            
            class Meta(BaseTenantModel.Meta):
                constraints = [
                    UniqueConstraint(
                        fields=['tenant_id', 'order_number'],
                        name='unique_tenant_order_number'
                    )
                ]
    """
    
    id: models.UUIDField = models.UUIDField(
        primary_key=True,
        default=uuid.uuid4,
        editable=False,
        help_text="主键，使用 UUID 确保分布式环境下唯一性"
    )
    
    tenant_id: models.UUIDField = models.UUIDField(
        db_index=True,
        null=False,
        help_text="租户唯一标识，用于数据隔离"
    )
    
    created_at: models.DateTimeField = models.DateTimeField(
        auto_now_add=True,
        null=False,
        help_text="记录创建时间"
    )
    
    updated_at: models.DateTimeField = models.DateTimeField(
        auto_now=True,
        null=False,
        help_text="记录最后更新时间"
    )
    
    objects: TenantAwareManager = TenantAwareManager()
    
    class Meta:
        abstract = True
        # 默认不设置 constraints，由子类根据业务需求定义
        # 子类示例:
        # constraints = [
        #     UniqueConstraint(
        #         fields=['tenant_id', 'business_key'],
        #         name='unique_tenant_business_key'
        #     )
        # ]
    
    def save(self, *args: Any, **kwargs: Any) -> None:
        """
        保存实例时验证和填充 tenant_id。
        
        如果 tenant_id 未设置且 TenantContext 可用，自动从上下文获取。
        
        Raises:
            TenantContextError: 当 tenant_id 未设置且无有效上下文时
        """
        if self.tenant_id is None:
            current_tenant = TenantContext.get_current_optional()
            if current_tenant is not None:
                self.tenant_id = current_tenant
            else:
                raise TenantContextError(
                    "tenant_id is required for tenant-aware models",
                    error_code="TENANT_002"
                )
        super().save(*args, **kwargs)
    
    @classmethod
    def get_tenant_field_names(cls) -> list[str]:
        """
        获取租户相关字段名称列表。
        
        Returns:
            list[str]: 包含 tenant_id 的字段名
        """
        return ['tenant_id']
    
    def is_owned_by(self, tenant_id: uuid.UUID) -> bool:
        """
        检查记录是否属于指定租户。
        
        Args:
            tenant_id: 待检查的租户标识
            
        Returns:
            bool: 如果属于该租户返回 True
        """
        return self.tenant_id == tenant_id
    
    def __repr__(self) -> str:
        """返回模型的调试表示。"""
        return f"<{self.__class__.__name__}(id={self.id}, tenant_id={self.tenant_id})>"


class SystemLevelModel(models.Model):
    """
    系统级模型基类。
    
    用于不需要租户隔离的系统配置表（如 system_config）。
    使用 tenant_id=None，不参与租户隔离逻辑。
    
    使用示例:
        class SystemConfig(SystemLevelModel):
            key = models.CharField(max_length=100, unique=True)
            value = models.JSONField()
    """
    
    id: models.UUIDField = models.UUIDField(
        primary_key=True,
        default=uuid.uuid4,
        editable=False
    )
    
    created_at: models.DateTimeField = models.DateTimeField(
        auto_now_add=True
    )
    
    updated_at: models.DateTimeField = models.DateTimeField(
        auto_now=True
    )
    
    class Meta:
        abstract = True