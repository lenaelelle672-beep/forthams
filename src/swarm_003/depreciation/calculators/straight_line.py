"""
直线法（Straight-Line Method）折旧计算器

本模块实现直线法折旧计算逻辑。
直线法是最基础的折旧计算方式，将资产成本均匀分摊到整个使用年限。

公式: 每月折旧额 = (原值 - 残值) / 使用寿命(月数)
"""
from decimal import Decimal, ROUND_HALF_UP
from typing import Optional
from dataclasses import dataclass

from .base import DepreciationCalculator, DepreciationParams, DepreciationResult


@dataclass
class StraightLineParams:
    """
    直线法折旧计算参数

    Attributes:
        acquisition_cost: 资产原值（购入成本）
        salvage_value: 预计残值
        useful_life_months: 预计使用寿命（月数）
    """
    acquisition_cost: Decimal
    salvage_value: Decimal
    useful_life_months: int

    def __post_init__(self):
        """参数校验"""
        if self.acquisition_cost < 0:
            raise ValueError("资产原值不能为负数")
        if self.salvage_value < 0:
            raise ValueError("残值不能为负数")
        if self.salvage_value > self.acquisition_cost:
            raise ValueError("残值不能大于资产原值")
        if self.useful_life_months < 1:
            raise ValueError("使用寿命必须至少为1个月")


class StraightLineCalculator:
    """
    直线法折旧计算器
    
    直线法折旧将资产成本均匀分摊到整个使用年限，
    每月折旧额固定，计算简单直观。
    
    Example:
        >>> params = StraightLineParams(
        ...     acquisition_cost=Decimal("100000"),
        ...     salvage_value=Decimal("5000"),
        ...     useful_life_months=60
        ... )
        >>> calculator = StraightLineCalculator()
        >>> result = calculator.calculate(params)
        >>> print(result.monthly_depreciation)
        1583.3333
    """
    
    def __init__(self, precision: int = 4):
        """
        初始化直线法计算器
        
        Args:
            precision: 计算精度，保留小数位数，默认为4位
        """
        self.precision = precision
    
    def calculate(self, params: StraightLineParams) -> StraightLineResult:
        """
        执行直线法折旧计算
        
        计算每月折旧额、折旧总额和期末账面价值。
        
        Args:
            params: 直线法折旧计算参数
            
        Returns:
            StraightLineResult: 包含折旧计算结果的 dataclass
            
        Raises:
            ValueError: 当参数校验失败时抛出
        """
        # 计算应折旧总额
        depreciable_amount = params.acquisition_cost - params.salvage_value
        
        # 计算月折旧额（精确到指定小数位）
        monthly_depreciation = depreciable_amount / Decimal(params.useful_life_months)
        monthly_depreciation = monthly_depreciation.quantize(
            Decimal("0.0001"),
            rounding=ROUND_HALF_UP
        )
        
        # 计算折旧总额
        total_depreciation = monthly_depreciation * Decimal(params.useful_life_months)
        
        # 确保折旧总额不超过应折旧总额（处理浮点误差）
        if total_depreciation > depreciable_amount:
            total_depreciation = depreciable_amount
        
        # 计算期末账面价值
        final_book_value = params.acquisition_cost - total_depreciation
        
        return StraightLineResult(
            monthly_depreciation=monthly_depreciation,
            annual_depreciation=monthly_depreciation * Decimal(12),
            total_depreciation=total_depreciation,
            depreciable_amount=depreciable_amount,
            final_book_value=final_book_value,
            useful_life_months=params.useful_life_months
        )
    
    def calculate_accumulated(
        self,
        params: StraightLineParams,
        periods_elapsed: int
    ) -> StraightLineResult:
        """
        计算特定期间后的累计折旧
        
        Args:
            params: 直线法折旧计算参数
            periods_elapsed: 已过去的期间数（月数）
            
        Returns:
            StraightLineResult: 包含折旧计算结果的 dataclass
        """
        base_result = self.calculate(params)
        
        # 计算累计折旧
        accumulated = base_result.monthly_depreciation * Decimal(periods_elapsed)
        
        # 确保累计折旧不超过应折旧总额
        if accumulated > base_result.depreciable_amount:
            accumulated = base_result.depreciable_amount
        
        # 计算当前账面价值
        current_book_value = params.acquisition_cost - accumulated
        
        return StraightLineResult(
            monthly_depreciation=base_result.monthly_depreciation,
            annual_depreciation=base_result.annual_depreciation,
            total_depreciation=accumulated,
            depreciable_amount=base_result.depreciable_amount,
            final_book_value=current_book_value,
            useful_life_months=params.useful_life_months
        )
    
    def get_depreciation_schedule(
        self,
        params: StraightLineParams
    ) -> list[DepreciationPeriodDetail]:
        """
        生成完整折旧计划表
        
        返回每个月的折旧明细。
        
        Args:
            params: 直线法折旧计算参数
            
        Returns:
            list[DepreciationPeriodDetail]: 折旧明细列表
        """
        base_result = self.calculate(params)
        schedule = []
        
        accumulated = Decimal("0")
        
        for month in range(1, params.useful_life_months + 1):
            accumulated += base_result.monthly_depreciation
            
            # 最后一期调整，确保总额精确
            if month == params.useful_life_months:
                accumulated = base_result.depreciable_amount
            
            current_book_value = params.acquisition_cost - accumulated
            
            schedule.append(DepreciationPeriodDetail(
                period=month,
                period_depreciation=base_result.monthly_depreciation,
                accumulated_depreciation=accumulated,
                book_value=current_book_value
            ))
        
        return schedule


@dataclass
class StraightLineResult:
    """
    直线法折旧计算结果
    
    Attributes:
        monthly_depreciation: 月折旧额
        annual_depreciation: 年折旧额
        total_depreciation: 累计/总折旧额
        depreciable_amount: 应折旧总额（原值 - 残值）
        final_book_value: 期末账面价值
        useful_life_months: 使用寿命（月数）
    """
    monthly_depreciation: Decimal
    annual_depreciation: Decimal
    total_depreciation: Decimal
    depreciable_amount: Decimal
    final_book_value: Decimal
    useful_life_months: int


@dataclass
class DepreciationPeriodDetail:
    """
    单个折旧期间明细
    
    Attributes:
        period: 期间序号（月）
        period_depreciation: 本期折旧额
        accumulated_depreciation: 累计折旧
        book_value: 账面价值
    """
    period: int
    period_depreciation: Decimal
    accumulated_depreciation: Decimal
    book_value: Decimal


# 兼容性别名（保持与现有代码的兼容性）
DepreciationCalculator = StraightLineCalculator
DepreciationParams = StraightLineParams
DepreciationResult = StraightLineResult