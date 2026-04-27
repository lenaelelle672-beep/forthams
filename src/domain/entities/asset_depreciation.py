"""
资产折旧实体模块。

提供资产折旧相关的领域实体定义，包括折旧记录、折旧计算规则等。
"""

from dataclasses import dataclass, field
from datetime import datetime
from decimal import Decimal
from enum import Enum
from typing import Optional
import uuid


class DepreciationMethod(str, Enum):
    """
    折旧计算方法枚举。
    
    支持直线法和双倍余额递减法两种折旧计算方式。
    """
    STRAIGHT_LINE = "straight_line"
    DOUBLE_DECLINING = "double_declining"


class DepreciationStatus(str, Enum):
    """
    折旧状态枚举。
    
    表示资产折旧的当前处理状态。
    """
    PENDING = "pending"
    CALCULATING = "calculating"
    COMPLETED = "completed"
    SUSPENDED = "suspended"
    ARCHIVED = "archived"


@dataclass
class DepreciationRecord:
    """
    折旧记录实体。
    
    表示单个资产的折旧计算记录，包含折旧金额、累计折旧、账面价值等信息。
    
    Attributes:
        id: 折旧记录唯一标识符
        asset_id: 资产唯一标识符
        period: 折旧期间，格式为 YYYY-MM
        depreciation_amount: 当期折旧金额
        accumulated_depreciation: 累计折旧金额
        book_value: 账面价值
        method: 折旧计算方法
        status: 折旧状态
        created_at: 记录创建时间
        updated_at: 记录更新时间
    """
    id: str
    asset_id: str
    period: str
    depreciation_amount: Decimal
    accumulated_depreciation: Decimal
    book_value: Decimal
    method: DepreciationMethod
    status: DepreciationStatus
    created_at: datetime
    updated_at: datetime
    
    def __post_init__(self):
        """
        初始化后验证数据一致性。
        
        Raises:
            ValueError: 当账面价值为负数时
        """
        if self.book_value < 0:
            raise ValueError("账面价值不能为负数")
    
    def to_dict(self) -> dict:
        """
        将折旧记录转换为字典格式。
        
        Returns:
            包含折旧记录所有字段的字典
        """
        return {
            "id": self.id,
            "asset_id": self.asset_id,
            "period": self.period,
            "depreciation_amount": str(self.depreciation_amount),
            "accumulated_depreciation": str(self.accumulated_depreciation),
            "book_value": str(self.book_value),
            "method": self.method.value,
            "status": self.status.value,
            "created_at": self.created_at.isoformat(),
            "updated_at": self.updated_at.isoformat(),
        }


@dataclass
class DepreciationRule:
    """
    折旧规则实体。
    
    定义资产折旧计算的业务规则，包括折旧年限、残值率等参数。
    
    Attributes:
        id: 规则唯一标识符
        asset_category: 资产类别
        useful_life: 折旧年限（月）
        residual_rate: 残值率（百分比）
        method: 折旧计算方法
        is_active: 规则是否启用
        created_at: 创建时间
        updated_at: 更新时间
    """
    id: str
    asset_category: str
    useful_life: int
    residual_rate: Decimal
    method: DepreciationMethod
    is_active: bool
    created_at: datetime
    updated_at: datetime
    
    def __post_init__(self):
        """
        初始化后验证规则参数。
        
        Raises:
            ValueError: 当折旧年限小于等于0或残值率超出范围时
        """
        if self.useful_life <= 0:
            raise ValueError("折旧年限必须大于0")
        if self.residual_rate < 0 or self.residual_rate > 100:
            raise ValueError("残值率必须在0到100之间")
    
    def calculate_annual_depreciation(self, asset_cost: Decimal) -> Decimal:
        """
        计算年折旧金额。
        
        Args:
            asset_cost: 资产原值
        
        Returns:
            年折旧金额
        """
        residual_value = asset_cost * self.residual_rate / 100
        depreciable_amount = asset_cost - residual_value
        annual_depreciation = depreciable_amount / (self.useful_life / 12)
        return annual_depreciation.quantize(Decimal("0.01"))
    
    def to_dict(self) -> dict:
        """
        将折旧规则转换为字典格式。
        
        Returns:
            包含折旧规则所有字段的字典
        """
        return {
            "id": self.id,
            "asset_category": self.asset_category,
            "useful_life": self.useful_life,
            "residual_rate": str(self.residual_rate),
            "method": self.method.value,
            "is_active": self.is_active,
            "created_at": self.created_at.isoformat(),
            "updated_at": self.updated_at.isoformat(),
        }


@dataclass
class DepreciationSchedule:
    """
    折旧计划实体。
    
    表示资产整个生命周期的折旧计划，包含多个期间的折旧预测。
    
    Attributes:
        id: 计划唯一标识符
        asset_id: 资产唯一标识符
        rule_id: 折旧规则标识符
        records: 折旧记录列表
        total_depreciation: 总折旧金额
        start_date: 折旧开始日期
        end_date: 折旧结束日期
        created_at: 创建时间
    """
    id: str
    asset_id: str
    rule_id: str
    records: list[DepreciationRecord] = field(default_factory=list)
    total_depreciation: Decimal = Decimal("0.00")
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None
    created_at: datetime = field(default_factory=datetime.now)
    
    def add_record(self, record: DepreciationRecord) -> None:
        """
        添加折旧记录到计划中。
        
        Args:
            record: 折旧记录
        """
        self.records.append(record)
        self.total_depreciation += record.depreciation_amount
    
    def get_record_by_period(self, period: str) -> Optional[DepreciationRecord]:
        """
        根据期间获取折旧记录。
        
        Args:
            period: 折旧期间，格式为 YYYY-MM
        
        Returns:
            对应期间的折旧记录，如果不存在则返回None
        """
        for record in self.records:
            if record.period == period:
                return record
        return None
    
    def get_current_book_value(self) -> Decimal:
        """
        获取当前账面价值。
        
        Returns:
            最后一期的账面价值，如果没有记录则返回初始账面价值
        """
        if self.records:
            return self.records[-1].book_value
        return Decimal("0.00")
    
    def to_dict(self) -> dict:
        """
        将折旧计划转换为字典格式。
        
        Returns:
            包含折旧计划所有字段的字典
        """
        return {
            "id": self.id,
            "asset_id": self.asset_id,
            "rule_id": self.rule_id,
            "records": [r.to_dict() for r in self.records],
            "total_depreciation": str(self.total_depreciation),
            "start_date": self.start_date.isoformat() if self.start_date else None,
            "end_date": self.end_date.isoformat() if self.end_date else None,
            "created_at": self.created_at.isoformat(),
        }


def create_depreciation_record(
    asset_id: str,
    period: str,
    depreciation_amount: Decimal,
    accumulated_depreciation: Decimal,
    book_value: Decimal,
    method: DepreciationMethod = DepreciationMethod.STRAIGHT_LINE,
    status: DepreciationStatus = DepreciationStatus.PENDING,
) -> DepreciationRecord:
    """
    创建折旧记录工厂函数。
    
    Args:
        asset_id: 资产唯一标识符
        period: 折旧期间，格式为 YYYY-MM
        depreciation_amount: 当期折旧金额
        accumulated_depreciation: 累计折旧金额
        book_value: 账面价值
        method: 折旧计算方法
        status: 折旧状态
    
    Returns:
        新创建的折旧记录实例
    """
    now = datetime.now()
    return DepreciationRecord(
        id=str(uuid.uuid4()),
        asset_id=asset_id,
        period=period,
        depreciation_amount=depreciation_amount,
        accumulated_depreciation=accumulated_depreciation,
        book_value=book_value,
        method=method,
        status=status,
        created_at=now,
        updated_at=now,
    )


def create_depreciation_rule(
    asset_category: str,
    useful_life: int,
    residual_rate: Decimal,
    method: DepreciationMethod = DepreciationMethod.STRAIGHT_LINE,
) -> DepreciationRule:
    """
    创建折旧规则工厂函数。
    
    Args:
        asset_category: 资产类别
        useful_life: 折旧年限（月）
        residual_rate: 残值率（百分比）
        method: 折旧计算方法
    
    Returns:
        新创建的折旧规则实例
    """
    now = datetime.now()
    return DepreciationRule(
        id=str(uuid.uuid4()),
        asset_category=asset_category,
        useful_life=useful_life,
        residual_rate=residual_rate,
        method=method,
        is_active=True,
        created_at=now,
        updated_at=now,
    )


def create_depreciation_schedule(
    asset_id: str,
    rule_id: str,
    start_date: Optional[datetime] = None,
) -> DepreciationSchedule:
    """
    创建折旧计划工厂函数。
    
    Args:
        asset_id: 资产唯一标识符
        rule_id: 折旧规则标识符
        start_date: 折旧开始日期
    
    Returns:
        新创建的折旧计划实例
    """
    return DepreciationSchedule(
        id=str(uuid.uuid4()),
        asset_id=asset_id,
        rule_id=rule_id,
        records=[],
        total_depreciation=Decimal("0.00"),
        start_date=start_date,
        end_date=None,
        created_at=datetime.now(),
    )