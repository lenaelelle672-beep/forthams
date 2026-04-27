"""
资产折旧计算策略抽象基类

本模块定义了折旧计算策略的抽象接口，所有具体折旧计算策略
（如直线法、双倍余额递减法）均需实现此基类定义的抽象方法。

依据准则:
    - 《企业会计准则第4号—固定资产》
    - 企业资产管理（SWARM）折旧计算规范 V1.0

使用说明:
    折旧策略用于计算资产在各个会计期间的折旧额和净值。
    配置策略后，系统将根据策略类型和参数自动计算折旧。
"""

from abc import ABC, abstractmethod
from dataclasses import dataclass
from datetime import date, datetime
from decimal import Decimal, ROUND_HALF_UP
from enum import Enum
from typing import Optional, List, Dict, Any
import uuid


class DepreciationMethodType(Enum):
    """
    折旧方法类型枚举
    
    定义系统支持的折旧计算方法类型。
    
    枚举值:
        STRAIGHT_LINE: 直线法（年限平均法）
        DOUBLE_DECLINING: 双倍余额递减法
    """
    STRAIGHT_LINE = "straight_line"
    DOUBLE_DECLINING = "double_declining"


class DepreciationStatus(Enum):
    """
    折旧状态枚举
    
    表示资产折旧计算的状态。
    
    枚举值:
        ACTIVE: 有效，正在计提折旧
        SUSPENDED: 暂停，已停止计提
        COMPLETED: 完成，折旧计提完毕
    """
    ACTIVE = "active"
    SUSPENDED = "suspended"
    COMPLETED = "completed"


@dataclass
class DepreciationPeriodResult:
    """
    单个折旧期间计算结果
    
    存储某一特定会计期间（如某月或某年）的折旧计算结果。
    
    属性:
        period_start: 期间起始日期
        period_end: 期间结束日期
        period_key: 期间标识符（如 '2025-01'）
        beginning_value: 期初资产净值
        depreciation_amount: 本期折旧额
        accumulated_depreciation: 累计折旧额
        ending_value: 期末资产净值
        created_at: 记录创建时间
    """
    period_start: date
    period_end: date
    period_key: str
    beginning_value: Decimal
    depreciation_amount: Decimal
    accumulated_depreciation: Decimal
    ending_value: Decimal
    created_at: datetime


@dataclass
class DepreciationScheduleEntry:
    """
    折旧计划表条目
    
    包含资产完整折旧生命周期的单条记录。
    
    属性:
        entry_id: 条目唯一标识符
        asset_id: 关联资产ID
        period_key: 期间标识符
        year_number: 折旧年度序号（从1开始）
        depreciation_amount: 年度折旧额
        accumulated_depreciation: 累计折旧
        net_book_value: 期末净值
        depreciation_rate: 折旧率（百分比）
        status: 折旧状态
    """
    entry_id: str
    asset_id: str
    period_key: str
    year_number: int
    depreciation_amount: Decimal
    accumulated_depreciation: Decimal
    net_book_value: Decimal
    depreciation_rate: Optional[Decimal] = None
    status: DepreciationStatus = DepreciationStatus.ACTIVE


@dataclass
class DepreciationConfig:
    """
    折旧策略配置
    
    存储折旧计算所需的核心配置参数。
    
    属性:
        asset_id: 资产唯一标识符
        acquisition_value: 资产原值（购置成本）
        acquisition_date: 启用日期
        useful_life_years: 预计使用年限（年）
        salvage_value: 预计净残值
        salvage_rate: 净残值率（百分比，可选）
        method_type: 折旧方法类型
        status: 折旧状态
        effective_date: 策略生效日期
    """
    asset_id: str
    acquisition_value: Decimal
    acquisition_date: date
    useful_life_years: int
    salvage_value: Decimal
    salvage_rate: Optional[Decimal] = None
    method_type: DepreciationMethodType
    status: DepreciationStatus = DepreciationStatus.ACTIVE
    effective_date: Optional[date] = None
    
    def __post_init__(self):
        """
        配置后置验证
        
        在初始化后验证配置参数的有效性，确保满足折旧计算的基本约束。
        
        验证规则:
            - 原值必须大于0
            - 净残值不能大于原值
            - 使用年限必须大于0
            - 净残值不能为负数
        
        抛出:
            ValueError: 当配置参数违反验证规则时
        """
        if self.acquisition_value <= 0:
            raise ValueError(
                f"资产原值必须大于0，实际值: {self.acquisition_value}"
            )
        
        if self.salvage_value < 0:
            raise ValueError(
                f"净残值不能为负数，实际值: {self.salvage_value}"
            )
        
        if self.salvage_value > self.acquisition_value:
            raise ValueError(
                f"净残值({self.salvage_value})不能大于资产原值({self.acquisition_value})"
            )
        
        if self.useful_life_years <= 0:
            raise ValueError(
                f"预计使用年限必须大于0，实际值: {self.useful_life_years}"
            )
        
        # 如果未指定生效日期，默认使用启用日期
        if self.effective_date is None:
            self.effective_date = self.acquisition_date


class BaseDepreciationStrategy(ABC):
    """
    折旧策略抽象基类
    
    定义折旧计算的核心接口和通用功能，所有具体折旧计算策略必须继承此类
    并实现抽象方法。
    
    设计原则:
        - 策略模式（Strategy Pattern）：支持多种折旧计算方法
        - 模板方法模式（Template Method）：定义折旧计算的标准流程
        - 数据类不可变设计：计算结果一旦生成不可修改
    
    使用示例:
        >>> config = DepreciationConfig(
        ...     asset_id="AST-001",
        ...     acquisition_value=Decimal("10000"),
        ...     acquisition_date=date(2025, 1, 1),
        ...     useful_life_years=5,
        ...     salvage_value=Decimal("1000"),
        ...     method_type=DepreciationMethodType.STRAIGHT_LINE
        ... )
        >>> strategy = StraightLineStrategy(config)
        >>> result = strategy.calculate_period("2025-01")
        >>> print(f"本期折旧: {result.depreciation_amount}")
    
    注意事项:
        - 所有金额计算使用 Decimal 类型以保证精度
        - 计算结果按"元"四舍五入保留两位小数
    """
    
    # 折旧计算精度常量
    PRECISION = Decimal("0.01")
    ROUNDING_MODE = ROUND_HALF_UP
    
    def __init__(self, config: DepreciationConfig):
        """
        初始化折旧策略
        
        Args:
            config: 折旧策略配置对象，包含资产信息和折旧参数
        
        Raises:
            ValueError: 当配置参数无效时
            TypeError: 当配置类型不正确时
        """
        if not isinstance(config, DepreciationConfig):
            raise TypeError(
                f"配置参数必须是 DepreciationConfig 类型，实际类型: {type(config)}"
            )
        
        self._config = config
        self._validate_method_compatibility()
    
    def _validate_method_compatibility(self) -> None:
        """
        验证折旧方法与配置参数的兼容性
        
        子类可重写此方法以添加特定折旧方法的额外验证逻辑。
        
        抛出:
            ValueError: 当配置不满足特定折旧方法要求时
        """
        pass
    
    @property
    def config(self) -> DepreciationConfig:
        """
        获取折旧策略配置
        
        Returns:
            DepreciationConfig: 折旧策略配置对象（只读副本）
        """
        return self._config
    
    @property
    @abstractmethod
    def method_type(self) -> DepreciationMethodType:
        """
        获取折旧方法类型
        
        抽象属性，子类必须实现以返回其折旧方法类型。
        
        Returns:
            DepreciationMethodType: 折旧方法类型枚举值
        """
        pass
    
    @abstractmethod
    def calculate_period(self, period_key: str) -> DepreciationPeriodResult:
        """
        计算指定期间的折旧额
        
        计算某一特定会计期间的折旧数据，包括期初净值、本期折旧、
        累计折旧和期末净值。
        
        Args:
            period_key: 期间标识符，格式为 'YYYY-MM'（如 '2025-01'）
        
        Returns:
            DepreciationPeriodResult: 该期间的折旧计算结果
        
        Raises:
            ValueError: 当期间标识符格式不正确或期间超出折旧期限时
        """
        pass
    
    @abstractmethod
    def calculate_annual(self, year: int) -> Decimal:
        """
        计算指定年度的折旧额
        
        计算某一自然年度或财务年度的折旧总额。
        
        Args:
            year: 年份（如 2025）
        
        Returns:
            Decimal: 该年度的折旧总额
        
        Raises:
            ValueError: 当年份超出折旧期限时
        """
        pass
    
    @abstractmethod
    def get_net_book_value(self, as_of_date: date) -> Decimal:
        """
        获取截至指定日期的资产净值
        
        根据折旧策略计算截至特定日期的资产当前净值。
        
        Args:
            as_of_date: 计算日期
        
        Returns:
            Decimal: 截至指定日期的资产净值（不低于净残值）
        """
        pass
    
    @abstractmethod
    def get_accumulated_depreciation(self, as_of_date: date) -> Decimal:
        """
        获取截至指定日期的累计折旧
        
        计算截至特定日期已计提的折旧总额。
        
        Args:
            as_of_date: 计算日期
        
        Returns:
            Decimal: 截至指定日期的累计折旧额
        """
        pass
    
    def generate_schedule(self) -> List[DepreciationScheduleEntry]:
        """
        生成完整折旧计划表
        
        根据折旧策略为资产生成整个使用年限内的折旧计划。
        
        Returns:
            List[DepreciationScheduleEntry]: 折旧计划条目列表
        
        性能说明:
            对于长使用年限（如20年）的资产，此方法可能需要较长时间，
            建议在后台任务中执行或使用分页加载。
        """
        schedule: List[DepreciationScheduleEntry] = []
        current_year = 1
        
        # 遍历整个使用年限
        depreciation_date = self._config.acquisition_date
        end_date = self._calculate_depreciation_end_date()
        
        while depreciation_date <= end_date:
            period_key = f"{depreciation_date.year}-{depreciation_date.month:02d}"
            
            entry = self._create_schedule_entry(
                period_key=period_key,
                year_number=current_year,
                depreciation_date=depreciation_date
            )
            
            if entry is not None:
                schedule.append(entry)
            
            # 更新折旧日期
            depreciation_date = self._advance_month(depreciation_date)
            
            # 跟踪年份变化
            if depreciation_date.month == 1:
                current_year += 1
        
        return schedule
    
    def _calculate_depreciation_end_date(self) -> date:
        """
        计算折旧截止日期
        
        根据启用日期和使用年限计算折旧计提的截止日期。
        
        Returns:
            date: 折旧截止日期（启用日期 + 使用年限 - 1个月的最后一天）
        """
        from datetime import timedelta
        
        # 折旧结束于使用年限的最后一个月的最后一天
        end_year = self._config.acquisition_date.year + self._config.useful_life_years - 1
        end_month = self._config.acquisition_date.month
        
        # 计算月份最后一天
        if end_month == 12:
            next_month = date(end_year + 1, 1, 1)
        else:
            next_month = date(end_year, end_month + 1, 1)
        
        return next_month - timedelta(days=1)
    
    def _advance_month(self, current: date) -> date:
        """
        日期月份前进一个月
        
        Args:
            current: 当前日期
        
        Returns:
            date: 下个月同一天的日期（若该日不存在则调整为月末）
        """
        from calendar import monthrange
        
        year = current.year
        month = current.month + 1
        
        if month > 12:
            year += 1
            month = 1
        
        # 处理月末日期问题（如1月31日后推至2月28/29日）
        max_day = monthrange(year, month)[1]
        day = min(current.day, max_day)
        
        return date(year, month, day)
    
    def _create_schedule_entry(
        self,
        period_key: str,
        year_number: int,
        depreciation_date: date
    ) -> Optional[DepreciationScheduleEntry]:
        """
        创建折旧计划条目
        
        模板方法，子类可重写以定制条目创建逻辑。
        
        Args:
            period_key: 期间标识符
            year_number: 年度序号
            depreciation_date: 折旧日期
        
        Returns:
            DepreciationScheduleEntry: 折旧计划条目，若返回 None 则跳过该期间
        """
        result = self.calculate_period(period_key)
        
        return DepreciationScheduleEntry(
            entry_id=str(uuid.uuid4()),
            asset_id=self._config.asset_id,
            period_key=period_key,
            year_number=year_number,
            depreciation_amount=result.depreciation_amount,
            accumulated_depreciation=result.accumulated_depreciation,
            net_book_value=result.ending_value,
            depreciation_rate=self._calculate_depreciation_rate(),
            status=self._config.status
        )
    
    def _calculate_depreciation_rate(self) -> Optional[Decimal]:
        """
        计算折旧率
        
        计算年折旧率。直线法直接返回，双倍余额递减法可重写。
        
        Returns:
            Optional[Decimal]: 年折旧率（百分比形式），不支持时返回 None
        """
        return None
    
    def _round_currency(self, amount: Decimal) -> Decimal:
        """
        金额四舍五入至货币精度
        
        Args:
            amount: 原始金额
        
        Returns:
            Decimal: 四舍五入后的金额（保留两位小数）
        """
        return amount.quantize(self.PRECISION, rounding=self.ROUNDING_MODE)
    
    def _is_complete(self, current_value: Decimal) -> bool:
        """
        判断折旧是否已完成
        
        当资产净值已达到净残值时，折旧计提完成。
        
        Args:
            current_value: 当前资产净值
        
        Returns:
            bool: 若净值已低于或等于净残值，返回 True
        """
        return current_value <= self._config.salvage_value
    
    def __repr__(self) -> str:
        """
        返回对象的字符串表示
        
        Returns:
            str: 折旧策略的调试信息
        """
        return (
            f"{self.__class__.__name__}("
            f"asset_id={self._config.asset_id}, "
            f"method={self.method_type.value}, "
            f"useful_life={self._config.useful_life_years})"
        )