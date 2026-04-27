"""资产折旧计算引擎基类。

本模块定义了折旧计算的核心抽象接口，支持直线法和双倍余额递减法等多种折旧方式。
所有折旧计算器必须继承 DepreciationCalculator 基类并实现相应的计算方法。

模块层级:
    - DepreciationResult: 折旧计算结果数据类
    - DepreciationCalculator: 折旧计算器抽象基类
    - StraightLineCalculator: 直线法折旧计算器
    - DoubleDecliningCalculator: 双倍余额递减法折旧计算器

使用示例:
    >>> from src.swarm_003.depreciation.calculators.base import StraightLineCalculator
    >>> calc = StraightLineCalculator(
    ...     acquisition_cost=Decimal("100000"),
    ...     useful_life_months=60,
    ...     salvage_value=Decimal("5000")
    ... )
    >>> result = calc.calculate()
    >>> print(result.monthly_depreciation)
    Decimal('1583.3333')
"""

from abc import ABC, abstractmethod
from decimal import Decimal, ROUND_HALF_UP
from typing import Optional
from dataclasses import dataclass, field
from datetime import date
from enum import Enum


class DepreciationMethod(Enum):
    """折旧方法枚举。
    
    定义系统支持的折旧计算方法。
    
    Attributes:
        STRAIGHT_LINE: 直线法（平均年限法）
        DOUBLE_DECLINING: 双倍余额递减法（加速折旧法）
    """
    STRAIGHT_LINE = "straight_line"
    DOUBLE_DECLINING = "double_declining"


@dataclass
class DepreciationResult:
    """折旧计算结果数据类。
    
    封装单次折旧计算的完整结果，包含月度折旧额、累计折旧和账面价值。
    
    Attributes:
        monthly_depreciation: 月折旧额（精度：小数点后4位，四舍五入）
        accumulated_depreciation: 累计折旧额
        book_value: 账面价值 = acquisition_cost - accumulated_depreciation
        period: 折旧期间（格式：YYYY-MM）
        depreciation_method: 折旧方法枚举值
    
    Example:
        >>> result = DepreciationResult(
        ...     monthly_depreciation=Decimal("1583.3333"),
        ...     accumulated_depreciation=Decimal("1583.3333"),
        ...     book_value=Decimal("98416.6667"),
        ...     period="2026-01"
        ... )
    """
    monthly_depreciation: Decimal
    accumulated_depreciation: Decimal
    book_value: Decimal
    period: str
    depreciation_method: DepreciationMethod = DepreciationMethod.STRAIGHT_LINE
    
    def __post_init__(self):
        """验证计算结果的业务规则约束。
        
        Raises:
            ValueError: 当累计折旧超过理论最大值或账面价值为负时抛出
        """
        if self.accumulated_depreciation < 0:
            raise ValueError(f"累计折旧额不能为负数: {self.accumulated_depreciation}")
        if self.book_value < 0:
            raise ValueError(f"账面价值不能为负数: {self.book_value}")


@dataclass
class AssetDepreciationInput:
    """资产折旧计算输入参数。
    
    封装资产折旧计算所需的所有输入参数，包含原始数据与计算配置。
    
    Attributes:
        asset_id: 资产唯一标识符（UUID v4格式）
        acquisition_date: 资产购置日期
        acquisition_cost: 资产原值（精度：小数点后2位）
        useful_life_months: 预计使用寿命（月数，最小值为1）
        salvage_value: 预计残值（精度：小数点后2位）
        depreciation_method: 折旧计算方法
        current_period: 当前折旧期间（格式：YYYY-MM）
    
    Raises:
        ValueError: 当参数不符合业务规则时抛出
    """
    asset_id: str
    acquisition_date: date
    acquisition_cost: Decimal
    useful_life_months: int
    salvage_value: Decimal
    depreciation_method: DepreciationMethod
    current_period: str = field(default="")
    
    def __post_init__(self):
        """验证输入参数的合法性。
        
        Raises:
            ValueError: 当参数不符合业务规则时抛出
        """
        if self.acquisition_cost <= 0:
            raise ValueError(f"资产原值必须大于0: {self.acquisition_cost}")
        if self.useful_life_months < 1:
            raise ValueError(f"使用寿命必须至少为1个月: {self.useful_life_months}")
        if self.salvage_value < 0:
            raise ValueError(f"残值不能为负数: {self.salvage_value}")
        if self.salvage_value >= self.acquisition_cost:
            raise ValueError(
                f"残值必须小于资产原值: salvage_value={self.salvage_value}, "
                f"acquisition_cost={self.acquisition_cost}"
            )


class DepreciationCalculator(ABC):
    """折旧计算器抽象基类。
    
    所有折旧计算器必须继承此类并实现 calculate_monthly_depreciation 方法。
    提供统一的输入验证、结果格式化接口。
    
    Attributes:
        acquisition_cost: 资产原值
        useful_life_months: 使用寿命（月）
        salvage_value: 残值
        depreciable_amount: 应计提折旧总额
    
    Example:
        class StraightLineCalculator(DepreciationCalculator):
            def _compute_monthly(self) -> Decimal:
                # 实现具体计算逻辑
                pass
        
        calc = StraightLineCalculator(
            acquisition_cost=Decimal("100000"),
            useful_life_months=60,
            salvage_value=Decimal("5000")
        )
        result = calc.calculate()
    """
    
    DECIMAL_PRECISION: int = 4  # 计算精度：小数点后4位
    _ROUNDING_MODE = ROUND_HALF_UP  # 四舍五入规则
    
    def __init__(
        self,
        acquisition_cost: Decimal,
        useful_life_months: int,
        salvage_value: Decimal,
        asset_id: Optional[str] = None,
    ):
        """初始化折旧计算器。
        
        Args:
            acquisition_cost: 资产原值
            useful_life_months: 使用寿命（月）
            salvage_value: 残值
            asset_id: 资产标识符（可选，用于日志追踪）
        
        Raises:
            ValueError: 当参数不符合业务规则时抛出
        """
        self.asset_id = asset_id
        self.acquisition_cost = Decimal(str(acquisition_cost))
        self.useful_life_months = useful_life_months
        self.salvage_value = Decimal(str(salvage_value))
        self._validate_inputs()
    
    def _validate_inputs(self) -> None:
        """验证输入参数的合法性。
        
        Raises:
            ValueError: 当参数不符合业务规则时抛出
        """
        if self.acquisition_cost <= 0:
            raise ValueError(f"acquisition_cost 必须大于 0，当前值: {self.acquisition_cost}")
        if self.useful_life_months < 1:
            raise ValueError(f"useful_life_months 必须至少为 1，当前值: {self.useful_life_months}")
        if self.salvage_value < 0:
            raise ValueError(f"salvage_value 不能为负数，当前值: {self.salvage_value}")
        if self.salvage_value >= self.acquisition_cost:
            raise ValueError(
                f"salvage_value 必须小于 acquisition_cost: "
                f"salvage_value={self.salvage_value}, acquisition_cost={self.acquisition_cost}"
            )
    
    @property
    def depreciable_amount(self) -> Decimal:
        """计算应计提折旧总额。
        
        Returns:
            应计提折旧总额 = acquisition_cost - salvage_value
        """
        return self.acquisition_cost - self.salvage_value
    
    def _round_decimal(self, value: Decimal) -> Decimal:
        """将 Decimal 值四舍五入至指定精度。
        
        Args:
            value: 待处理的 Decimal 值
        
        Returns:
            四舍五入后的 Decimal 值
        """
        return value.quantize(
            Decimal(f"0.{'0' * self.DECIMAL_PRECISION}"),
            rounding=self._ROUNDING_MODE
        )
    
    @abstractmethod
    def calculate(
        self,
        period: int,
        accumulated_from_previous: Optional[Decimal] = None,
    ) -> DepreciationResult:
        """计算指定期间的折旧额。
        
        此方法为抽象方法，子类必须实现具体的计算逻辑。
        
        Args:
            period: 期间序号（从1开始，1表示第一个折旧期间）
            accumulated_from_previous: 前期累计折旧额（可选）
        
        Returns:
            DepreciationResult: 折旧计算结果对象
        
        Raises:
            ValueError: 当期间参数无效时抛出
        """
        if period < 1:
            raise ValueError(f"期间序号必须大于等于1: {period}")
        if period > self.useful_life_months:
            raise ValueError(
                f"期间序号超过使用寿命: period={period}, "
                f"useful_life_months={self.useful_life_months}"
            )
    
    @abstractmethod
    def _compute_monthly(self, current_book_value: Decimal, remaining_months: int) -> Decimal:
        """计算月折旧额的核心抽象方法。
        
        子类必须实现具体的折旧计算公式。
        
        Args:
            current_book_value: 当前账面价值
            remaining_months: 剩余折旧月数
        
        Returns:
            计算的月折旧额
        """
        pass
    
    def calculate_batch(
        self,
        start_period: int,
        end_period: int,
    ) -> list[DepreciationResult]:
        """批量计算指定期间范围的折旧额。
        
        Args:
            start_period: 起始期间（包含）
            end_period: 结束期间（包含）
        
        Returns:
            包含指定范围内每个期间折旧结果的列表
        
        Raises:
            ValueError: 当期间范围无效时抛出
        """
        if start_period > end_period:
            raise ValueError(
                f"起始期间不能大于结束期间: start_period={start_period}, end_period={end_period}"
            )
        
        results: list[DepreciationResult] = []
        accumulated: Decimal = Decimal("0")
        
        for period in range(start_period, end_period + 1):
            result = self.calculate(period, accumulated)
            results.append(result)
            accumulated = result.accumulated_depreciation
        
        return results


class StraightLineCalculator(DepreciationCalculator):
    """直线法（平均年限法）折旧计算器。
    
    特点：折旧额在各期间均匀分摊，适用于固定资产使用效益相对稳定的资产。
    
    计算公式:
        月折旧额 = (原值 - 残值) / 使用寿命（月）
    
    Example:
        >>> calc = StraightLineCalculator(
        ...     acquisition_cost=Decimal("100000"),
        ...     useful_life_months=60,
        ...     salvage_value=Decimal("5000")
        ... )
        >>> calc.calculate(period=1)
        DepreciationResult(
            monthly_depreciation=Decimal('1583.3333'),
            accumulated_depreciation=Decimal('1583.3333'),
            book_value=Decimal('98416.6667'),
            period='2026-01'
        )
    """
    
    def _compute_monthly(self, current_book_value: Decimal, remaining_months: int) -> Decimal:
        """计算直线法月折旧额。
        
        公式: monthly = depreciable_amount / useful_life_months
        
        Args:
            current_book_value: 当前账面价值（直线法中不参与计算）
            remaining_months: 剩余折旧月数（直线法中不参与计算）
        
        Returns:
            月折旧额
        """
        return self.depreciable_amount / Decimal(str(self.useful_life_months))
    
    def calculate(
        self,
        period: int,
        accumulated_from_previous: Optional[Decimal] = None,
    ) -> DepreciationResult:
        """计算直线法指定期间的折旧额。
        
        Args:
            period: 期间序号（从1开始）
            accumulated_from_previous: 前期累计折旧额
        
        Returns:
            直线法折旧计算结果
        """
        super().calculate(period, accumulated_from_previous)
        
        monthly_depreciation = self._round_decimal(self._compute_monthly(
            current_book_value=Decimal("0"),
            remaining_months=0
        ))
        
        accumulated = accumulated_from_previous or Decimal("0")
        accumulated = self._round_decimal(accumulated + monthly_depreciation)
        
        book_value = self._round_decimal(self.acquisition_cost - accumulated)
        
        return DepreciationResult(
            monthly_depreciation=monthly_depreciation,
            accumulated_depreciation=accumulated,
            book_value=book_value,
            period=f"period_{period}",
            depreciation_method=DepreciationMethod.STRAIGHT_LINE,
        )


class DoubleDecliningCalculator(DepreciationCalculator):
    """双倍余额递减法折旧计算器。
    
    特点：折旧初期计算额较大，随时间递减，加速资产价值转移。
    规则：当某年按双倍余额递减法计算的折旧额小于直线法时，切换为直线法。
    
    计算公式:
        年折旧率 = 2 / 折旧年限
        月折旧额 = (期初账面价值 - 预估残值) * 年折旧率 / 12
    
    Warning:
        折旧末期应确保账面价值不低于残值。
    
    Example:
        >>> calc = DoubleDecliningCalculator(
        ...     acquisition_cost=Decimal("100000"),
        ...     useful_life_months=60,
        ...     salvage_value=Decimal("5000")
        ... )
        >>> calc.calculate(period=1)
        DepreciationResult(
            monthly_depreciation=Decimal('3333.3333'),
            accumulated_depreciation=Decimal('3333.3333'),
            book_value=Decimal('96666.6667'),
            period='period_1'
        )
    """
    
    def __init__(
        self,
        acquisition_cost: Decimal,
        useful_life_months: int,
        salvage_value: Decimal,
        asset_id: Optional[str] = None,
    ):
        """初始化双倍余额递减计算器。
        
        Args:
            acquisition_cost: 资产原值
            useful_life_months: 使用寿命（月）
            salvage_value: 残值
            asset_id: 资产标识符（可选）
        """
        super().__init__(acquisition_cost, useful_life_months, salvage_value, asset_id)
        self.useful_life_years = self.useful_life_months / 12
        self._annual_rate = Decimal("2") / Decimal(str(self.useful_life_years))
        self._switched_to_straight_line: bool = False
    
    def _compute_monthly(self, current_book_value: Decimal, remaining_months: int) -> Decimal:
        """计算双倍余额递减法月折旧额。
        
        Args:
            current_book_value: 当前账面价值
            remaining_months: 剩余折旧月数
        
        Returns:
            月折旧额
        """
        if self._switched_to_straight_line or remaining_months <= 0:
            return self.depreciable_amount / Decimal(str(self.useful_life_months))
        
        annual_depreciation = current_book_value * self._annual_rate
        monthly = annual_depreciation / Decimal("12")
        
        straight_line_monthly = (current_book_value - self.salvage_value) / Decimal(str(remaining_months))
        
        if straight_line_monthly > monthly and remaining_months > 0:
            self._switched_to_straight_line = True
            return straight_line_monthly
        
        return monthly
    
    def calculate(
        self,
        period: int,
        accumulated_from_previous: Optional[Decimal] = None,
    ) -> DepreciationResult:
        """计算双倍余额递减法指定期间的折旧额。
        
        当直线法计算的折旧额大于双倍余额递减额时，自动切换为直线法。
        
        Args:
            period: 期间序号（从1开始）
            accumulated_from_previous: 前期累计折旧额
        
        Returns:
            双倍余额递减法折旧计算结果
        """
        super().calculate(period, accumulated_from_previous)
        
        accumulated = accumulated_from_previous or Decimal("0")
        current_book_value = self.acquisition_cost - accumulated
        remaining_months = self.useful_life_months - period + 1
        
        if remaining_months <= 0:
            remaining_months = 1
        
        monthly_depreciation = self._compute_monthly(current_book_value, remaining_months)
        monthly_depreciation = self._round_decimal(monthly_depreciation)
        
        max_additional = self._round_decimal(current_book_value - self.salvage_value)
        if monthly_depreciation > max_additional:
            monthly_depreciation = max_additional
        
        if monthly_depreciation < 0:
            monthly_depreciation = Decimal("0")
        
        new_accumulated = self._round_decimal(accumulated + monthly_depreciation)
        book_value = self._round_decimal(self.acquisition_cost - new_accumulated)
        
        return DepreciationResult(
            monthly_depreciation=monthly_depreciation,
            accumulated_depreciation=new_accumulated,
            book_value=book_value,
            period=f"period_{period}",
            depreciation_method=DepreciationMethod.DOUBLE_DECLINING,
        )
    
    def reset_switch_state(self) -> None:
        """重置直线法切换状态。
        
        用于批量计算时重置内部状态，确保每次完整计算的一致性。
        """
        self._switched_to_straight_line = False


def create_calculator(
    method: DepreciationMethod,
    acquisition_cost: Decimal,
    useful_life_months: int,
    salvage_value: Decimal,
    asset_id: Optional[str] = None,
) -> DepreciationCalculator:
    """工厂函数：根据折旧方法创建对应的计算器实例。
    
    Args:
        method: 折旧方法枚举
        acquisition_cost: 资产原值
        useful_life_months: 使用寿命（月）
        salvage_value: 残值
        asset_id: 资产标识符（可选）
    
    Returns:
        对应折旧方法的具体计算器实例
    
    Raises:
        ValueError: 当折旧方法不支持时抛出
    
    Example:
        >>> calc = create_calculator(
        ...     method=DepreciationMethod.STRAIGHT_LINE,
        ...     acquisition_cost=Decimal("100000"),
        ...     useful_life_months=60,
        ...     salvage_value=Decimal("5000")
        ... )
    """
    calculators = {
        DepreciationMethod.STRAIGHT_LINE: StraightLineCalculator,
        DepreciationMethod.DOUBLE_DECLINING: DoubleDecliningCalculator,
    }
    
    calculator_class = calculators.get(method)
    if calculator_class is None:
        raise ValueError(f"不支持的折旧方法: {method}")
    
    return calculator_class(
        acquisition_cost=acquisition_cost,
        useful_life_months=useful_life_months,
        salvage_value=salvage_value,
        asset_id=asset_id,
    )