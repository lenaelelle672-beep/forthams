"""
直线法折旧计算策略模块。

本模块实现企业会计准则第4号——固定资产中规定的直线法折旧计算逻辑。
折旧计算公式: 年折旧额 = (原值 - 残值) / 预计使用年限

Author: SWARM-2025-Q2-P0-002
"""

from decimal import Decimal, ROUND_HALF_UP
from typing import Optional

from .base import AbstractDepreciationStrategy, DepreciationInput, DepreciationResult


class StraightLineDepreciationStrategy(AbstractDepreciationStrategy):
    """
    直线法折旧计算策略实现类。
    
    直线法将折旧金额均匀分摊到资产预计使用年限内的每个期间，
    适用于使用寿命有限且使用强度相对稳定的固定资产。
    
    Example:
        >>> strategy = StraightLineDepreciationStrategy()
        >>> result = strategy.calculate(
        ...     acquisition_value=Decimal("10000"),
        ...     salvage_value=Decimal("1000"),
        ...     useful_life_years=5,
        ...     period=3
        ... )
        >>> print(f"年折旧额: {result.annual_depreciation}")
        年折旧额: 1800.00
    """
    
    STRATEGY_TYPE = "straight_line"
    
    def calculate(
        self,
        acquisition_value: Decimal,
        salvage_value: Decimal,
        useful_life_years: int,
        period: Optional[int] = None
    ) -> DepreciationResult:
        """
        计算直线法折旧金额及相关指标。
        
        Args:
            acquisition_value: 资产原值（购置成本）
            salvage_value: 预计残值（处置时可回收金额）
            useful_life_years: 预计使用年限（年）
            period: 可选，计算至第几期期末的折旧
        
        Returns:
            DepreciationResult: 包含年折旧额、累计折旧、净值等计算结果
        
        Raises:
            ValueError: 当参数不符合业务规则时抛出
                - 残值大于原值
                - 使用年限小于等于0
                - 原值小于等于0
        
        Note:
            月折旧额 = 年折旧额 / 12
            期末净值 = 原值 - 累计已提折旧
        """
        # 参数校验
        self._validate_inputs(acquisition_value, salvage_value, useful_life_years)
        
        # 计算可折旧金额
        depreciable_amount = acquisition_value - salvage_value
        
        # 计算年折旧额
        annual_depreciation = (depreciable_amount / Decimal(useful_life_years)).quantize(
            Decimal("0.01"), rounding=ROUND_HALF_UP
        )
        
        # 计算月折旧额
        monthly_depreciation = (annual_depreciation / Decimal("12")).quantize(
            Decimal("0.01"), rounding=ROUND_HALF_UP
        )
        
        # 确定计算周期数
        calc_period = period if period is not None else useful_life_years
        
        # 计算累计折旧
        accumulated_depreciation = annual_depreciation * Decimal(calc_period)
        accumulated_depreciation = accumulated_depreciation.quantize(
            Decimal("0.01"), rounding=ROUND_HALF_UP
        )
        
        # 计算期末净值（不能低于残值）
        net_book_value = acquisition_value - accumulated_depreciation
        if net_book_value < salvage_value:
            net_book_value = salvage_value
        net_book_value = net_book_value.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
        
        # 计算折旧进度百分比
        depreciation_progress = (accumulated_depreciation / depreciable_amount * Decimal("100")).quantize(
            Decimal("0.01"), rounding=ROUND_HALF_UP
        ) if depreciable_amount > 0 else Decimal("0")
        
        return DepreciationResult(
            annual_depreciation=annual_depreciation,
            monthly_depreciation=monthly_depreciation,
            accumulated_depreciation=accumulated_depreciation,
            net_book_value=net_book_value,
            depreciation_progress=depreciation_progress,
            current_period=calc_period
        )
    
    def _validate_inputs(
        self,
        acquisition_value: Decimal,
        salvage_value: Decimal,
        useful_life_years: int
    ) -> None:
        """
        校验折旧计算输入参数。
        
        Args:
            acquisition_value: 资产原值
            salvage_value: 预计残值
            useful_life_years: 预计使用年限
        
        Raises:
            ValueError: 参数不符合业务规则时抛出
        """
        if acquisition_value <= Decimal("0"):
            raise ValueError(
                f"资产原值必须大于0，当前值: {acquisition_value}"
            )
        
        if useful_life_years <= 0:
            raise ValueError(
                f"预计使用年限必须大于0，当前值: {useful_life_years}"
            )
        
        if salvage_value < Decimal("0"):
            raise ValueError(
                f"残值不能为负数，当前值: {salvage_value}"
            )
        
        if salvage_value > acquisition_value:
            raise ValueError(
                f"残值({salvage_value})不能大于原值({acquisition_value})"
            )
    
    def get_strategy_type(self) -> str:
        """
        返回折旧策略类型标识。
        
        Returns:
            str: 策略类型标识，"straight_line"表示直线法
        """
        return self.STRATEGY_TYPE