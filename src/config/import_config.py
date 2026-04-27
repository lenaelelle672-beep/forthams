"""
资产批量导入导出配置文件

本模块定义了资产批量导入导出功能的核心配置，包括：
- 文件格式与大小限制
- 字段校验规则
- 性能约束
- 异步处理配置

Iteration: 2
Feature: SWARM-2025-Q2-P2-006
Phase: Phase 2 - 数据交换层
"""

from enum import Enum
from typing import Dict, List, Any
from dataclasses import dataclass, field


class ImportMode(Enum):
    """
    导入模式枚举
    
    定义了两种导入模式：
    - strict: 全量失败模式，任意一行错误则整个导入失败
    - partial: 部分导入模式，跳过错误行继续处理
    """
    STRICT = "strict"
    PARTIAL = "partial"


class AssetType(Enum):
    """
    资产类型枚举
    
    定义了支持的资产类型：
    - EQUIPMENT: 设备
    - INSTRUMENT: 仪器
    - VEHICLE: 车辆
    - OTHER: 其他
    """
    EQUIPMENT = "EQUIPMENT"
    INSTRUMENT = "INSTRUMENT"
    VEHICLE = "VEHICLE"
    OTHER = "OTHER"


class AssetStatus(Enum):
    """
    资产状态枚举
    
    定义了资产的状态：
    - ACTIVE: 活跃/在用
    - MAINTENANCE: 维护中
    - SCRAPPED: 已报废
    """
    ACTIVE = "ACTIVE"
    MAINTENANCE = "MAINTENANCE"
    SCRAPPED = "SCRAPPED"


@dataclass
class FileConstraint:
    """
    文件约束配置
    
    定义了导入导出文件的大小和格式限制
    """
    max_file_size_mb: int = 50
    max_import_rows: int = 100000
    max_export_rows: int = 500000
    supported_formats: List[str] = field(default_factory=lambda: ["xlsx", "xls", "csv"])
    file_retention_days: int = 30


@dataclass
class FieldConstraint:
    """
    字段约束配置
    
    定义了资产字段的类型、长度和校验规则
    """
    asset_id: Dict[str, Any] = field(default_factory=lambda: {
        "required": True,
        "max_length": 64,
        "pattern": r"^[A-Za-z0-9_]+$",
        "unique": True
    })
    asset_name: Dict[str, Any] = field(default_factory=lambda: {
        "required": True,
        "max_length": 128
    })
    asset_type: Dict[str, Any] = field(default_factory=lambda: {
        "required": True,
        "enum_values": ["EQUIPMENT", "INSTRUMENT", "VEHICLE", "OTHER"]
    })
    purchase_date: Dict[str, Any] = field(default_factory=lambda: {
        "required": True,
        "format": "YYYY-MM-DD",
        "pattern": r"^\d{4}-\d{2}-\d{2}$"
    })
    purchase_amount: Dict[str, Any] = field(default_factory=lambda: {
        "required": True,
        "min_value": 0,
        "precision": 2
    })
    department: Dict[str, Any] = field(default_factory=lambda: {
        "required": True,
        "max_length": 64,
        "validate_exists": True
    })
    status: Dict[str, Any] = field(default_factory=lambda: {
        "required": True,
        "enum_values": ["ACTIVE", "MAINTENANCE", "SCRAPPED"]
    })
    location: Dict[str, Any] = field(default_factory=lambda: {
        "required": False,
        "max_length": 128
    })
    description: Dict[str, Any] = field(default_factory=lambda: {
        "required": False,
        "max_length": 512
    })


@dataclass
class PerformanceConstraint:
    """
    性能约束配置
    
    定义了导入导出的性能要求
    """
    small_file_threshold_mb: int = 5
    sync_import_timeout_seconds: int = 5
    async_import_timeout_seconds: int = 30
    sync_export_timeout_seconds: int = 10
    max_concurrent_import_tasks: int = 10
    chunk_size: int = 1000


@dataclass
class SecurityConstraint:
    """
    安全约束配置
    
    定义了导入导出的安全配置
    """
    enable_virus_scan: bool = True
    require_confirm_for_sensitive_fields: bool = True
    enable_audit_log: bool = True
    download_link_expiry_hours: int = 24


@dataclass
class AsyncConfig:
    """
    异步处理配置
    
    定义了异步导入任务的队列和重试配置
    """
    queue_name: str = "asset_import"
    max_retries: int = 3
    retry_delay_seconds: int = 60
    task_timeout_seconds: int = 300


class ImportConfig:
    """
    导入配置主类
    
    整合所有导入导出相关的配置项
    """
    
    def __init__(self):
        """
        初始化导入配置
        
        加载所有约束配置，包括文件、字段、性能、安全和异步配置
        """
        self.file_constraint = FileConstraint()
        self.field_constraint = FieldConstraint()
        self.performance_constraint = PerformanceConstraint()
        self.security_constraint = SecurityConstraint()
        self.async_config = AsyncConfig()
        self.default_import_mode = ImportMode.PARTIAL
        self.overwrite_default = False
    
    def get_field_rules(self, field_name: str) -> Dict[str, Any]:
        """
        获取指定字段的校验规则
        
        Args:
            field_name: 字段名称
        
        Returns:
            字段校验规则字典
        
        Raises:
            KeyError: 当字段不存在时
        """
        field_rules = {
            "asset_id": self.field_constraint.asset_id,
            "asset_name": self.field_constraint.asset_name,
            "asset_type": self.field_constraint.asset_type,
            "purchase_date": self.field_constraint.purchase_date,
            "purchase_amount": self.field_constraint.purchase_amount,
            "department": self.field_constraint.department,
            "status": self.field_constraint.status,
            "location": self.field_constraint.location,
            "description": self.field_constraint.description
        }
        if field_name not in field_rules:
            raise KeyError(f"Unknown field: {field_name}")
        return field_rules[field_name]
    
    def validate_file_size(self, file_size_mb: float) -> bool:
        """
        验证文件大小是否在允许范围内
        
        Args:
            file_size_mb: 文件大小（MB）
        
        Returns:
            True 如果文件大小合法，否则 False
        """
        return file_size_mb <= self.file_constraint.max_file_size_mb
    
    def is_async_required(self, file_size_mb: float) -> bool:
        """
        判断文件是否需要异步处理
        
        Args:
            file_size_mb: 文件大小（MB）
        
        Returns:
            True 如果文件需要异步处理，否则 False
        """
        return file_size_mb > self.performance_constraint.small_file_threshold_mb


# 全局配置实例
import_config = ImportConfig()


def get_import_config() -> ImportConfig:
    """
    获取导入配置单例
    
    Returns:
        ImportConfig 实例
    """
    return import_config