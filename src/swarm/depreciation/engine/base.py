"""
资产折旧计算核心模块 — 基类定义

本模块定义了折旧计算引擎的基础抽象接口、数据类及核心异常，
为直线法和双倍余额递减法提供统一的计算框架。

主要组件：
- DepreciationCalculator: 折旧计算器抽象基类
- DepreciationResult: 折旧计算结果数据类
- DepreciationBaseException: 折旧相关异常基类
- DepreciationDateException: 日期校验异常
- ValidationException: 输入参数校验异常
- InvalidDepreciationConfigException: 无效折旧配置异常

边界约束 (BC):
- BC-001: acquisition_date <= depreciation_date
- BC-002: 折旧金额保留2位小数，四舍五入
- BC-003: residual_value <= original_cost 且 >= 0
- BC-004: useful_life_months >= 1，最大600
- BC-005: 双倍余额递减终止条件
- BC-006: 幂等性，同一资产同一月份不重复计算
- BC-007: 事务边界，单条资产为最小失败单元
- BC-008: 仅支持未来60个月内的折旧计算

相关文件：
- src/swarm/depreciation/engine/straight_line.py: 直线法实现
- src/swarm/depreciation/engine/double_declining.py: 双倍余额递减法实现
- src/swarm/depreciation/engine/factory.py: 计算器工厂
"""

from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from datetime import date
from decimal import Decimal, ROUND_HALF_UP
from typing import Protocol, Optional, List, runtime_checkable
import re


# 常量定义
HALF_UP = ROUND_HALF_UP
TWO_DECIMAL_PLACES = Decimal('0.01')
ZERO_DECIMAL = Decimal('0.00')
MAX_USEFUL_LIFE_MONTHS = 600
MAX_FUTURE_MONTHS = 60


class DepreciationBaseException(Exception):
    """折旧相关异常基类"""
    pass


class DepreciationDateException(DepreciationBaseException):
    """日期校验异常 - 计提日期早于入账日期时抛出 (BC-001)"""
    def __init__(self, message: str = "计提日期不能早于资产入账日期"):
        self.message = message
        super().__init__(self.message)


class ValidationException(DepreciationBaseException):
    """输入参数校验异常 (BC-003, BC-004)"""
    def __init__(self, message: str = "参数校验失败"):
        self.message = message
        super().__init__(self.message)


class InvalidDepreciationConfigException(DepreciationBaseException):
    """无效折旧配置异常"""
    def __init__(self, message: str = "折旧配置无效"):
        self.message = message
        super().__init__(self.message)


class DuplicateDepreciationException(DepreciationBaseException):
    """重复折旧计算异常 - 幂等性约束 (BC-006)"""
    def __init__(self, asset_id: str, period: str, message: str = ""):
        self.asset_id = asset_id
        self.period = period
        if not message:
            message = f"资产 {asset_id} 在 {period} 月份的折旧已计算，不允许重复计提"
        self.message = message
        super().__init__(self.message)


class PeriodRangeExceededException(DepreciationBaseException):
    """超出时间范围异常 - BC-008"""
    def __init__(self, message: str = "折旧计算仅支持未来60个月内"):
        self.message = message
        super().__init__(self.message)


@dataclass
class DepreciationResult:
    """
    折旧计算结果数据类
    
    封装单次折旧计算的完整结果，包含：
    - asset_id: 资产标识
    - period: 折旧期间 (YYYY-MM格式)
    - method: 折旧方法 ('STRAIGHT_LINE' | 'DECLINING_BALANCE')
    - monthly_depreciation: 月折旧额 (保留2位小数)
    - accumulated_depreciation: 累计折旧 (保留2位小数)
    - book_value: 账面净值 (保留2位小数)
    - period_depreciation: 当期折旧额 (用于报表)
    - ytd_depreciation: 本年累计折旧 (用于报表)
    """
    asset_id: str
    period: str
    method: str
    monthly_depreciation: Decimal
    accumulated_depreciation: Decimal
    book_value: Decimal
    period_depreciation: Decimal = field(default_factory=Decimal)
    ytd_depreciation: Decimal = field(default_factory=Decimal)
    
    def __post_init__(self):
        """确保所有金额字段保留2位小数"""
        self.monthly_depreciation = self.monthly_depreciation.quantize(TWO_DECIMAL_PLACES, HALF_UP)
        self.accumulated_depreciation = self.accumulated_depreciation.quantize(TWO_DECIMAL_PLACES, HALF_UP)
        self.book_value = self.book_value.quantize(TWO_DECIMAL_PLACES, HALF_UP)
        if self.period_depreciation:
            self.period_depreciation = self.period_depreciation.quantize(TWO_DECIMAL_PLACES, HALF_UP)
        if self.ytd_depreciation:
            self.ytd_depreciation = self.ytd_depreciation.quantize(TWO_DECIMAL_PLACES, HALF_UP)


@dataclass
class Asset:
    """
    资产实体类
    
    包含折旧计算所需的完整资产属性：
    - asset_id: 资产唯一标识
    - asset_name: 资产名称
    - original_cost: 原值
    - residual_value: 残值 (BC-003: <= original_cost, >= 0)
    - acquisition_date: 入账日期 (BC-001: 用于日期校验)
    - useful_life_months: 使用寿命月数 (BC-004: >= 1, <= 600)
    - depreciation_method: 折旧方法 ('STRAIGHT_LINE' | 'DECLINING_BALANCE')
    """
    asset_id: str
    asset_name: str
    original_cost: Decimal
    residual_value: Decimal
    acquisition_date: date
    useful_life_months: int
    depreciation_method: str = 'STRAIGHT_LINE'
    
    def __post_init__(self):
        """资产属性校验"""
        self.original_cost = Decimal(str(self.original_cost))
        self.residual_value = Decimal(str(self.residual_value))
        
        # BC-003: 残值上限校验
        if self.residual_value < ZERO_DECIMAL:
            raise ValidationException(f"资产 {self.asset_id}: 残值不能为负数")
        if self.residual_value > self.original_cost:
            raise ValidationException(f"资产 {self.asset_id}: 残值({self.residual_value})不能大于原值({self.original_cost})")
        
        # BC-004: 使用寿命校验
        if self.useful_life_months < 1:
            raise ValidationException(f"资产 {self.asset_id}: 使用寿命月数不能小于1")
        if self.useful_life_months > MAX_USEFUL_LIFE_MONTHS:
            raise ValidationException(f"资产 {self.asset_id}: 使用寿命月数不能超过{MAX_USEFUL_LIFE_MONTHS}(50年)")
        
        # 折旧方法校验
        valid_methods = ['STRAIGHT_LINE', 'DECLINING_BALANCE']
        if self.depreciation_method not in valid_methods:
            raise ValidationException(f"资产 {self.asset_id}: 无效的折旧方法 '{self.depreciation_method}'")


@dataclass
class Period:
    """
    折旧期间数据类
    
    用于表示折旧计算的时间周期：
    - year: 年份 (YYYY)
    - month: 月份 (1-12)
    - period_str: 期间字符串 (YYYY-MM格式)
    """
    year: int
    month: int
    period_str: str = field(init=False)
    
    def __post_init__(self):
        if self.month < 1 or self.month > 12:
            raise ValidationException(f"月份必须在1-12之间，实际为: {self.month}")
        self.period_str = f"{self.year:04d}-{self.month:02d}"
    
    @classmethod
    def from_string(cls, period_str: str) -> 'Period':
        """
        从字符串创建期间对象
        
        Args:
            period_str: 期间字符串，格式为 YYYY-MM
            
        Returns:
            Period 实例
            
        Raises:
            ValidationException: 格式无效时抛出
        """
        pattern = r'^(\d{4})-(\d{2})$'
        match = re.match(pattern, period_str)
        if not match:
            raise ValidationException(f"期间格式无效，应为 YYYY-MM，实际为: {period_str}")
        year, month = match.groups()
        return cls(year=int(year), month=int(month))
    
    @classmethod
    def from_date(cls, depreciation_date: date) -> 'Period':
        """从日期对象创建期间对象"""
        return cls(year=depreciation_date.year, month=depreciation_date.month)


@runtime_checkable
class DepreciationCalculator(Protocol):
    """
    折旧计算器抽象接口
    
    所有折旧计算器必须实现此协议：
    - calculate: 执行单次折旧计算
    - calculate_batch: 执行批量折旧计算
    - validate_date: 校验日期是否有效
    
    支持的折旧方法：
    - 'STRAIGHT_LINE': 直线法 (平均年限法)
    - 'DECLINING_BALANCE': 双倍余额递减法
    """
    
    @property
    def method(self) -> str:
        """返回计算器对应的折旧方法"""
        ...
    
    def calculate(
        self,
        asset: Asset,
        period: Period,
        existing_records: Optional[List[DepreciationResult]] = None
    ) -> DepreciationResult:
        """
        执行单次折旧计算
        
        Args:
            asset: 资产对象，包含折旧所需属性
            period: 折旧期间
            existing_records: 已存在的折旧记录列表 (用于计算累计折旧)
            
        Returns:
            DepreciationResult: 折旧计算结果
            
        Raises:
            DepreciationDateException: 计提日期早于入账日期 (BC-001)
            PeriodRangeExceededException: 超出时间范围 (BC-008)
            DuplicateDepreciationException: 重复计算同一资产同一月份 (BC-006)
        """
        ...
    
    def calculate_batch(
        self,
        assets: List[Asset],
        period: Period,
        existing_records: Optional[List[DepreciationResult]] = None
    ) -> List[DepreciationResult]:
        """
        执行批量折旧计算
        
        事务边界 (BC-007): 单条资产为最小失败单元，支持部分成功
        
        Args:
            assets: 资产列表
            period: 折旧期间
            existing_records: 已存在的折旧记录
            
        Returns:
            List[DepreciationResult]: 成功计算的折旧结果列表
        """
        ...
    
    def validate_date(self, asset: Asset, period: Period) -> None:
        """
        校验日期是否有效
        
        Args:
            asset: 资产对象
            period: 折旧期间
            
        Raises:
            DepreciationDateException: 计提日期早于入账日期 (BC-001)
            PeriodRangeExceededException: 超出时间范围 (BC-008)
        """
        ...


class DepreciationCalculatorMixin(ABC):
    """
    折旧计算器混入基类
    
    提供通用工具方法，供具体计算器继承使用：
    - 日期校验
    - 金额格式化
    - 期间计算
    - 幂等性检查
    """
    
    def _validate_acquisition_date(self, asset: Asset, period: Period) -> None:
        """
        校验入账日期 (BC-001)
        
        Args:
            asset: 资产对象
            period: 折旧期间
            
        Raises:
            DepreciationDateException: 计提日期早于入账日期
        """
        acq = asset.acquisition_date
        dep_period = period
        
        # 获取资产入账年月
        acq_year, acq_month = acq.year, acq.month
        dep_year, dep_month = dep_period.year, dep_period.month
        
        # 转换为总月份数进行比较
        acq_total_months = acq_year * 12 + acq_month
        dep_total_months = dep_year * 12 + dep_month
        
        if dep_total_months < acq_total_months:
            raise DepreciationDateException(
                f"资产 {asset.asset_id}: 计提月份 {period.period_str} 早于入账月份 "
                f"{acq_year:04d}-{acq_month:02d}"
            )
    
    def _validate_future_range(self, period: Period, reference_date: Optional[date] = None) -> None:
        """
        校验时间范围 (BC-008)
        
        仅支持计算未来60个月内的折旧
        
        Args:
            period: 折旧期间
            reference_date: 参考日期，默认为今天
            
        Raises:
            PeriodRangeExceededException: 超出时间范围
        """
        from datetime import date as date_type
        
        if reference_date is None:
            reference_date = date_type.today()
        
        ref_total_months = reference_date.year * 12 + reference_date.month
        period_total_months = period.year * 12 + period.month
        
        months_diff = period_total_months - ref_total_months
        
        if months_diff > MAX_FUTURE_MONTHS:
            raise PeriodRangeExceededException(
                f"折旧计算仅支持未来 {MAX_FUTURE_MONTHS} 个月内，"
                f"请求期间 {period.period_str} 超出范围"
            )
    
    def _check_idempotency(
        self,
        asset_id: str,
        period: str,
        existing_records: Optional[List[DepreciationResult]]
    ) -> Optional[DepreciationResult]:
        """
        幂等性检查 (BC-006)
        
        检查是否已存在相同资产相同月份的折旧记录
        
        Args:
            asset_id: 资产标识
            period: 期间字符串
            existing_records: 已存在的折旧记录列表
            
        Returns:
            已存在的记录或 None
        """
        if not existing_records:
            return None
        
        for record in existing_records:
            if record.asset_id == asset_id and record.period == period:
                return record
        return None
    
    def _round_currency(self, amount: Decimal) -> Decimal:
        """
        金额四舍五入到2位小数 (BC-002)
        
        Args:
            amount: 原始金额
            
        Returns:
            保留2位小数的金额
        """
        return Decimal(str(amount)).quantize(TWO_DECIMAL_PLACES, HALF_UP)
    
    def _calculate_period_number(
        self,
        acquisition_date: date,
        depreciation_date: date
    ) -> int:
        """
        计算折旧期间序号
        
        从入账月到计提月之间的月份数
        
        Args:
            acquisition_date: 入账日期
            depreciation_date: 计提日期
            
        Returns:
            期间序号 (入账当月为1)
        """
        acq_total = acquisition_date.year * 12 + acquisition_date.month
        dep_total = depreciation_date.year * 12 + depreciation_date.month
        return dep_total - acq_total + 1
    
    def _get_depreciable_amount(self, asset: Asset) -> Decimal:
        """
        获取应计折旧总额
        
        Args:
            asset: 资产对象
            
        Returns:
            应计折旧总额 = 原值 - 残值
        """
        return self._round_currency(asset.original_cost - asset.residual_value)