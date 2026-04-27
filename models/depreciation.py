"""
资产折旧数据模型

定义折旧记录、折旧方法枚举及相关数据结构，用于支持直线法和双倍余额递减法折旧计算。

本模块包含：
- DepreciationMethod: 折旧方法枚举
- DepreciationRecord: 折旧记录数据模型
- DepreciationSchedule: 折旧计划数据模型

使用说明:
    >>> from models.depreciation import DepreciationRecord, DepreciationMethod
    >>> record = DepreciationRecord(
    ...     asset_id="ASSET-001",
    ...     method=DepreciationMethod.STRAIGHT_LINE,
    ...     purchase_price=100000.00,
    ...     salvage_value=5000.00,
    ...     useful_life_years=10,
    ...     reference_date=date(2024, 6, 30)
    ... )

依赖模块:
    - models.asset: 资产主数据实体
    - datetime: 日期时间处理
"""

from datetime import date, datetime
from decimal import Decimal, ROUND_HALF_UP
from enum import Enum
from typing import Optional, List
from dataclasses import dataclass, field


class DepreciationMethod(str, Enum):
    """
    折旧计算方法枚举
    
    支持的折旧方法：
    - STRAIGHT_LINE: 直线法（每期折旧额固定）
    - DOUBLE_DECLINING: 双倍余额递减法（加速折旧，前期高后期低）
    """
    
    STRAIGHT_LINE = "straight_line"
    DOUBLE_DECLINING = "double_declining"
    
    def __str__(self) -> str:
        return self.value
    
    @property
    def display_name(self) -> str:
        """返回用户友好的显示名称"""
        names = {
            "straight_line": "直线法",
            "double_declining": "双倍余额递减法"
        }
        return names.get(self.value, self.value)


@dataclass
class DepreciationRecord:
    """
    单条折旧记录数据模型
    
    记录某一时间点某项资产的折旧计算结果。
    
    属性:
        asset_id: 资产唯一标识符
        method: 折旧计算方法
        purchase_date: 资产购置日期
        purchase_price: 资产购置价格
        salvage_value: 预计残值
        useful_life_years: 预计使用寿命（年）
        reference_date: 折旧计算基准日期
        calculated_date: 折旧计算日期时间
        period_month: 已计提期间月数
        annual_depreciation: 年折旧额
        monthly_depreciation: 月折旧额
        accumulated_depreciation: 累计折旧
        net_book_value: 账面净值
        depreciation_rate: 折旧率（双倍余额递减法使用）
    """
    
    asset_id: str
    method: DepreciationMethod
    purchase_date: date
    purchase_price: Decimal
    salvage_value: Decimal
    useful_life_years: int
    reference_date: date
    calculated_date: datetime = field(default_factory=datetime.now)
    period_month: int = 0
    annual_depreciation: Decimal = Decimal("0.00")
    monthly_depreciation: Decimal = Decimal("0.00")
    accumulated_depreciation: Decimal = Decimal("0.00")
    net_book_value: Decimal = Decimal("0.00")
    depreciation_rate: Optional[Decimal] = None
    
    def __post_init__(self):
        """
        数据初始化后处理
        
        验证数据有效性并将数值类型转换为Decimal确保精度
        """
        # 转换数值为Decimal确保精度
        self.purchase_price = self._to_decimal(self.purchase_price)
        self.salvage_value = self._to_decimal(self.salvage_value)
        self.annual_depreciation = self._to_decimal(self.annual_depreciation)
        self.monthly_depreciation = self._to_decimal(self.monthly_depreciation)
        self.accumulated_depreciation = self._to_decimal(self.accumulated_depreciation)
        self.net_book_value = self._to_decimal(self.net_book_value)
        
        if self.depreciation_rate is not None:
            self.depreciation_rate = self._to_decimal(self.depreciation_rate)
        
        # 验证数据有效性
        self._validate()
    
    def _to_decimal(self, value) -> Decimal:
        """
        将数值转换为Decimal类型
        
        Args:
            value: 待转换的数值（int, float, str, Decimal）
            
        Returns:
            Decimal: 转换后的Decimal值，保留2位小数
        """
        if isinstance(value, Decimal):
            return value.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
        return Decimal(str(value)).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
    
    def _validate(self):
        """
        验证折旧记录数据有效性
        
        抛出:
            ValueError: 当数据不符合业务规则时
        """
        # 残值不能大于等于购置价格
        if self.salvage_value >= self.purchase_price:
            raise ValueError(
                f"残值({self.salvage_value})不能大于等于购置价格({self.purchase_price})"
            )
        
        # 使用寿命必须为正数
        if self.useful_life_years < 1 or self.useful_life_years > 50:
            raise ValueError(
                f"使用寿命({self.useful_life_years})必须在1-50年之间"
            )
        
        # 基准日期不能早于购置日期
        if self.reference_date < self.purchase_date:
            raise ValueError(
                f"基准日期({self.reference_date})不能早于购置日期({self.purchase_date})"
            )
    
    @property
    def depreciable_amount(self) -> Decimal:
        """
        计算应计折旧总额
        
        Returns:
            Decimal: 购置价格减去预计残值
        """
        return self.purchase_price - self.salvage_value
    
    @property
    def depreciation_percentage(self) -> Decimal:
        """
        计算累计折旧占应计折旧总额的比例
        
        Returns:
            Decimal: 百分比值（0-100）
        """
        if self.depreciable_amount == 0:
            return Decimal("0.00")
        return (
            self.accumulated_depreciation / self.depreciable_amount * 100
        ).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
    
    def to_dict(self) -> dict:
        """
        转换为字典格式
        
        Returns:
            dict: 折旧记录数据字典
        """
        return {
            "asset_id": self.asset_id,
            "method": self.method.value,
            "method_display": self.method.display_name,
            "purchase_date": self.purchase_date.isoformat(),
            "purchase_price": float(self.purchase_price),
            "salvage_value": float(self.salvage_value),
            "useful_life_years": self.useful_life_years,
            "reference_date": self.reference_date.isoformat(),
            "calculated_date": self.calculated_date.isoformat(),
            "period_month": self.period_month,
            "annual_depreciation": float(self.annual_depreciation),
            "monthly_depreciation": float(self.monthly_depreciation),
            "accumulated_depreciation": float(self.accumulated_depreciation),
            "net_book_value": float(self.net_book_value),
            "depreciation_rate": float(self.depreciation_rate) if self.depreciation_rate else None,
            "depreciable_amount": float(self.depreciable_amount),
            "depreciation_percentage": float(self.depreciation_percentage)
        }


@dataclass
class DepreciationSchedule:
    """
    折旧计划数据模型
    
    包含资产全生命周期的折旧明细列表。
    
    属性:
        asset_id: 资产唯一标识符
        method: 折旧计算方法
        purchase_price: 资产购置价格
        salvage_value: 预计残值
        useful_life_years: 预计使用寿命（年）
        schedule: 折旧明细列表
        total_depreciation: 折旧总额
        total_periods: 总计提期间数
    """
    
    asset_id: str
    method: DepreciationMethod
    purchase_price: Decimal
    salvage_value: Decimal
    useful_life_years: int
    schedule: List[DepreciationRecord] = field(default_factory=list)
    total_depreciation: Decimal = Decimal("0.00")
    total_periods: int = 0
    
    def __post_init__(self):
        """初始化后处理，转换数值类型"""
        self.purchase_price = Decimal(str(self.purchase_price))
        self.salvage_value = Decimal(str(self.salvage_value))
        self.total_depreciation = Decimal(str(self.total_depreciation))
    
    def add_period(self, record: DepreciationRecord):
        """
        添加一个期间的折旧记录
        
        Args:
            record: 折旧记录实例
        """
        self.schedule.append(record)
        self.total_depreciation += record.annual_depreciation
        self.total_periods += 1
    
    def get_net_value_at(self, year: int, month: int) -> Optional[Decimal]:
        """
        获取指定年月的账面净值
        
        Args:
            year: 年份
            month: 月份
            
        Returns:
            Optional[Decimal]: 指定时点的账面净值，如不存在返回None
        """
        for record in self.schedule:
            if record.period_month == year * 12 + month:
                return record.net_book_value
        return None
    
    def to_dict(self) -> dict:
        """
        转换为字典格式
        
        Returns:
            dict: 折旧计划数据字典
        """
        return {
            "asset_id": self.asset_id,
            "method": self.method.value,
            "method_display": self.method.display_name,
            "purchase_price": float(self.purchase_price),
            "salvage_value": float(self.salvage_value),
            "useful_life_years": self.useful_life_years,
            "total_depreciation": float(self.total_depreciation),
            "total_periods": self.total_periods,
            "schedule": [r.to_dict() for r in self.schedule]
        }


class DepreciationCalculatorValidator:
    """
    折旧计算参数验证器
    
    提供折旧计算所需参数的验证逻辑。
    """
    
    @staticmethod
    def validate_asset_params(
        purchase_price: Decimal,
        salvage_value: Decimal,
        useful_life_years: int
    ) -> bool:
        """
        验证资产折旧参数
        
        Args:
            purchase_price: 购置价格
            salvage_value: 预计残值
            useful_life_years: 使用寿命（年）
            
        Returns:
            bool: 验证通过返回True
            
        抛出:
            ValueError: 参数验证失败时抛出
        """
        # 购置价格必须为正
        if purchase_price <= 0:
            raise ValueError(f"购置价格必须大于0，当前值: {purchase_price}")
        
        # 残值不能为负
        if salvage_value < 0:
            raise ValueError(f"残值不能为负数，当前值: {salvage_value}")
        
        # 残值不能大于等于购置价格
        if salvage_value >= purchase_price:
            raise ValueError(
                f"残值({salvage_value})必须小于购置价格({purchase_price})"
            )
        
        # 使用寿命范围验证
        if useful_life_years < 1:
            raise ValueError(f"使用寿命必须至少为1年，当前值: {useful_life_years}")
        
        if useful_life_years > 50:
            raise ValueError(f"使用寿命不能超过50年，当前值: {useful_life_years}")
        
        return True
    
    @staticmethod
    def validate_date_range(
        purchase_date: date,
        reference_date: date
    ) -> bool:
        """
        验证日期范围
        
        Args:
            purchase_date: 购置日期
            reference_date: 基准日期
            
        Returns:
            bool: 验证通过返回True
            
        抛出:
            ValueError: 日期验证失败时抛出
        """
        if reference_date < purchase_date:
            raise ValueError(
                f"基准日期({reference_date})不能早于购置日期({purchase_date})"
            )
        return True