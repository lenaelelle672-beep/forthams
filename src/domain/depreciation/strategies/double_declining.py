"""
Double Declining Balance Depreciation Strategy.

双倍余额递减法折旧策略实现。
年折旧率 = 2 / 预计使用年限
年折旧额 = 期初净值 × 年折旧率
最后两年改为均分余额。

符合《企业会计准则第4号—固定资产》要求。

References:
    - ATB-DEP-003: 双倍余额递减法验收测试基准
    - SWARM-2025-Q2-P0-002: 资产折旧计算中心 Iteration 1
"""

from decimal import Decimal, ROUND_HALF_UP
from typing import Optional

from .base import AbstractDepreciationStrategy, DepreciationResult


class DoubleDecliningBalanceStrategy(AbstractDepreciationStrategy):
    """
    双倍余额递减法折旧策略。
    
    特点：
    - 年折旧率固定为直线法的2倍
    - 期初净值逐年递减，折旧额也逐年递减
    - 最后两年采用均分方式，确保残值不为负
    
    Example:
        >>> strategy = DoubleDecliningBalanceStrategy(
        ...     acquisition_value=Decimal("10000"),
        ...     salvage_value=Decimal("1000"),
        ...     useful_life_years=5
        ... )
        >>> result = strategy.calculate(year=1)
        >>> print(f"Year 1 depreciation: {result.annual_depreciation}")
        Year 1 depreciation: 4000.00
    """
    
    _strategy_type: str = "double_declining"
    
    def __init__(
        self,
        acquisition_value: Decimal,
        salvage_value: Decimal,
        useful_life_years: int,
    ) -> None:
        """
        初始化双倍余额递减折旧策略。
        
        Args:
            acquisition_value: 资产原值（取得时的成本）
            salvage_value: 预计残值
            useful_life_years: 预计使用年限（必须 >= 2）
            
        Raises:
            ValueError: 当参数不符合业务规则时
                - salvage_value < 0
                - acquisition_value <= salvage_value
                - useful_life_years < 2
        """
        if useful_life_years < 2:
            raise ValueError(
                f"双倍余额递减法要求使用年限 >= 2，当前值: {useful_life_years}"
            )
        if salvage_value < Decimal("0"):
            raise ValueError(f"残值不能为负数，当前值: {salvage_value}")
        if acquisition_value <= salvage_value:
            raise ValueError(
                f"原值必须大于残值，原值: {acquisition_value}, 残值: {salvage_value}"
            )
        
        self._acquisition_value = Decimal(str(acquisition_value))
        self._salvage_value = Decimal(str(salvage_value))
        self._useful_life_years = useful_life_years
        self._depreciation_rate = Decimal("2") / Decimal(str(useful_life_years))
    
    @property
    def strategy_type(self) -> str:
        """返回策略类型标识。"""
        return self._strategy_type
    
    @property
    def annual_depreciation_rate(self) -> Decimal:
        """返回年折旧率（固定为 2/N）。"""
        return self._depreciation_rate
    
    def _get_switch_year(self) -> int:
        """
        获取切换为均分法的年份。
        
        双倍余额递减法在最后两年切换为直线法均分。
        
        Returns:
            切换年份（从该年份开始采用均分）
        """
        return self._useful_life_years - 1
    
    def calculate(
        self,
        year: int,
        current_net_value: Optional[Decimal] = None,
    ) -> DepreciationResult:
        """
        计算指定年份的折旧额和期末净值。
        
        Args:
            year: 折旧年份（从1开始）
            current_net_value: 当前净值（可选，用于续算）
            
        Returns:
            DepreciationResult: 包含折旧计算结果的域对象
            
        Raises:
            ValueError: 当 year 超出有效范围时
        """
        if year < 1 or year > self._useful_life_years:
            raise ValueError(
                f"折旧年份必须在 1~{self._useful_life_years} 之间，当前值: {year}"
            )
        
        if current_net_value is None:
            current_net_value = self._acquisition_value
        
        # 计算到指定年份的累计折旧和期末净值
        accumulated = Decimal("0")
        net_value = self._acquisition_value
        
        for y in range(1, year + 1):
            if y <= self._get_switch_year():
                # 双倍余额递减阶段
                period_depreciation = (net_value * self._depreciation_rate).quantize(
                    Decimal("0.01"), rounding=ROUND_HALF_UP
                )
            else:
                # 最后两年均分阶段
                remaining_value = net_value - self._salvage_value
                period_depreciation = (remaining_value / Decimal("2")).quantize(
                    Decimal("0.01"), rounding=ROUND_HALF_UP
                )
            
            accumulated += period_depreciation
            net_value = self._acquisition_value - accumulated
        
        # 确保净值不低于残值
        if net_value < self._salvage_value:
            net_value = self._salvage_value
            accumulated = self._acquisition_value - net_value
        
        annual_depr = accumulated - self._calculate_accumulated_up_to(year - 1)
        
        return DepreciationResult(
            acquisition_value=self._acquisition_value,
            salvage_value=self._salvage_value,
            useful_life_years=self._useful_life_years,
            annual_depreciation=annual_depr,
            accumulated_depreciation=accumulated,
            net_book_value=net_value,
            depreciation_rate=self._depreciation_rate,
            year=year,
        )
    
    def _calculate_accumulated_up_to(self, year: int) -> Decimal:
        """
        计算截至指定年份的累计折旧额。
        
        Args:
            year: 截止年份（从0开始，0表示无折旧）
            
        Returns:
            累计折旧额
        """
        if year <= 0:
            return Decimal("0")
        
        accumulated = Decimal("0")
        net_value = self._acquisition_value
        
        for y in range(1, year + 1):
            if y <= self._get_switch_year():
                period_depreciation = (net_value * self._depreciation_rate).quantize(
                    Decimal("0.01"), rounding=ROUND_HALF_UP
                )
            else:
                remaining_value = net_value - self._salvage_value
                period_depreciation = (remaining_value / Decimal("2")).quantize(
                    Decimal("0.01"), rounding=ROUND_HALF_UP
                )
            
            accumulated += period_depreciation
            net_value = self._acquisition_value - accumulated
        
        return accumulated
    
    def get_depreciation_schedule(self) -> list[DepreciationResult]:
        """
        获取完整的折旧明细表。
        
        Returns:
            包含每年折旧结果的列表
        """
        schedule = []
        for year in range(1, self._useful_life_years + 1):
            schedule.append(self.calculate(year))
        return schedule
    
    def calculate_total_depreciation(self) -> Decimal:
        """
        计算折旧总额（应等于 原值 - 残值）。
        
        Returns:
            折旧总额
        """
        return self._acquisition_value - self._salvage_value