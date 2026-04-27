"""
资产数据模型模块 (Asset Model Module)

本模块定义了资产管理系统的核心数据模型，支持批量导入导出功能。
包含资产实体的完整字段定义、枚举类型和导入导出相关的扩展方法。

版本: Iteration 2 (SWARM-2025-Q2-P2-006)
"""

from __future__ import annotations

import uuid
from datetime import datetime
from decimal import Decimal
from enum import Enum
from typing import Optional, List

from sqlalchemy import Column, String, DateTime, Numeric, Text, Enum as SQLEnum
from sqlalchemy.orm import declarative_base

Base = declarative_base()


class AssetType(Enum):
    """
    资产类型枚举
    
    定义系统支持的资产类型分类
    """
    EQUIPMENT = "EQUIPMENT"   # 设备
    INSTRUMENT = "INSTRUMENT"  # 仪器仪表
    VEHICLE = "VEHICLE"       # 车辆
    OTHER = "OTHER"           # 其他


class AssetStatus(Enum):
    """
    资产状态枚举
    
    定义资产的生命周期状态
    """
    ACTIVE = "ACTIVE"                       # 正常使用
    MAINTENANCE = "MAINTENANCE"             # 维护中
    SCRAPPED = "SCRAPPED"                   # 已报废


class Asset(Base):
    """
    资产数据模型
    
    表示企业管理的一个实物资产，包含采购、维护、折旧等完整信息。
    
    属性:
        id: 主键 UUID
        asset_id: 资产编号（全局唯一）
        asset_name: 资产名称
        asset_type: 资产类型（设备/仪器/车辆/其他）
        purchase_date: 采购日期（ISO 8601 格式）
        purchase_amount: 采购金额（精度2位小数）
        department: 所属部门编码
        status: 当前状态（使用中/维护中/已报废）
        location: 存放地点
        description: 资产描述备注
        created_at: 创建时间戳
        updated_at: 更新时间戳
    
    示例:
        >>> asset = Asset(
        ...     asset_id="AST-2025-001",
        ...     asset_name="台式计算机",
        ...     asset_type=AssetType.EQUIPMENT,
        ...     purchase_date=datetime(2025, 1, 15).date(),
        ...     purchase_amount=Decimal("5000.00"),
        ...     department="IT-DEPT",
        ...     status=AssetStatus.ACTIVE
        ... )
    """
    
    __tablename__ = "assets"
    
    # 主键
    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    
    # 资产编号（业务主键，唯一性校验）
    asset_id = Column(String(64), unique=True, nullable=False, index=True)
    
    # 资产名称
    asset_name = Column(String(128), nullable=False)
    
    # 资产类型枚举
    asset_type = Column(SQLEnum(AssetType), nullable=False)
    
    # 采购日期
    purchase_date = Column(DateTime, nullable=False)
    
    # 采购金额（精度2位）
    purchase_amount = Column(Numeric(18, 2), nullable=False)
    
    # 所属部门编码
    department = Column(String(64), nullable=False, index=True)
    
    # 资产状态
    status = Column(SQLEnum(AssetStatus), nullable=False, default=AssetStatus.ACTIVE)
    
    # 存放地点（可选）
    location = Column(String(128), nullable=True)
    
    # 描述备注（可选）
    description = Column(String(512), nullable=True)
    
    # 时间戳
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
    
    def __repr__(self) -> str:
        """
        返回资产的字符串表示
        
        返回:
            格式化的资产信息字符串
        """
        return (
            f"Asset(id={self.asset_id}, name={self.asset_name}, "
            f"type={self.asset_type.value}, status={self.status.value})"
        )
    
    def to_dict(self) -> dict:
        """
        将资产对象转换为字典格式
        
        用于批量导出和 API 响应序列化。
        
        返回:
            包含所有字段的字典
        """
        return {
            "asset_id": self.asset_id,
            "asset_name": self.asset_name,
            "asset_type": self.asset_type.value,
            "purchase_date": self.purchase_date.strftime("%Y-%m-%d") if self.purchase_date else None,
            "purchase_amount": str(self.purchase_amount) if self.purchase_amount else None,
            "department": self.department,
            "status": self.status.value,
            "location": self.location,
            "description": self.description,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }
    
    @classmethod
    def from_dict(cls, data: dict) -> Asset:
        """
        从字典数据创建资产对象
        
        用于批量导入时的数据映射。
        
        参数:
            data: 包含资产字段的字典
            
        返回:
            新创建的 Asset 实例
        """
        return cls(
            asset_id=data["asset_id"],
            asset_name=data["asset_name"],
            asset_type=AssetType(data["asset_type"]),
            purchase_date=datetime.strptime(data["purchase_date"], "%Y-%m-%d"),
            purchase_amount=Decimal(data["purchase_amount"]),
            department=data["department"],
            status=AssetStatus(data.get("status", "ACTIVE")),
            location=data.get("location"),
            description=data.get("description"),
        )
    
    def validate_fields(self) -> List[str]:
        """
        校验资产字段是否满足约束条件
        
        用于批量导入前的数据验证。
        
        返回:
            错误信息列表，空列表表示验证通过
        """
        errors = []
        
        # asset_id 校验
        if not self.asset_id:
            errors.append("asset_id 必填")
        elif len(self.asset_id) > 64:
            errors.append("asset_id 长度不能超过 64")
        elif not all(c.isalnum() or c == "_" for c in self.asset_id):
            errors.append("asset_id 只能包含字母、数字和下划线")
        
        # asset_name 校验
        if not self.asset_name:
            errors.append("asset_name 必填")
        elif len(self.asset_name) > 128:
            errors.append("asset_name 长度不能超过 128")
        
        # asset_type 校验（由枚举自动处理）
        if self.asset_type not in AssetType:
            errors.append(f"无效的 asset_type: {self.asset_type}")
        
        # purchase_date 校验
        if not self.purchase_date:
            errors.append("purchase_date 必填")
        
        # purchase_amount 校验
        if self.purchase_amount is None:
            errors.append("purchase_amount 必填")
        elif self.purchase_amount < 0:
            errors.append("purchase_amount 必须 >= 0")
        
        # department 校验
        if not self.department:
            errors.append("department 必填")
        elif len(self.department) > 64:
            errors.append("department 长度不能超过 64")
        
        # status 校验（由枚举自动处理）
        if self.status not in AssetStatus:
            errors.append(f"无效的 status: {self.status}")
        
        # description 长度校验
        if self.description and len(self.description) > 512:
            errors.append("description 长度不能超过 512")
        
        return errors
    
    @property
    def is_active(self) -> bool:
        """
        判断资产是否处于正常使用状态
        
        返回:
            True 表示资产可用，False 表示不可用
        """
        return self.status == AssetStatus.ACTIVE
    
    @property
    def is_scrapped(self) -> bool:
        """
        判断资产是否已报废
        
        返回:
            True 表示已报废，False 表示未报废
        """
        return self.status == AssetStatus.SCRAPPED