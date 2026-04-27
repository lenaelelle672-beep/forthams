"""
直线法折旧计算测试模块

测试用例覆盖：
- 基础直线法年折旧额计算
- 月折旧额精度验证
- 不同使用年限场景
- 残值边界条件
- 累计折旧计算
- 净值计算准确性验证
- 跨年度折旧递进计算

参考规格: SWARM-003 资产折旧计算模块 - Iteration 2
"""

from decimal import Decimal
from datetime import date
from typing import List
import pytest

from src.domain.calculators.straight_line import StraightLineDepreciationCalculator
from src.domain.entities.depreciation_record import DepreciationRecord
from src.domain.value_objects.depreciation_result import DepreciationResult


class TestStraightLineDepreciationCalculator:
    """直线法折旧计算器测试套件"""
    
    def test_calculate_annual_depreciation_basic(self):
        """
        测试场景: 基础年折旧额计算
        输入: 原值=100000, 使用年限=10年, 残值=0
        期待: 年折旧额 = (100000-0)/10 = 10000
        """
        calculator = StraightLineDepreciationCalculator()
        asset_value = Decimal("100000")
        useful_life_years = 10
        residual_value = Decimal("0")
        
        annual_depreciation = calculator.calculate_annual_depreciation(
            original_value=asset_value,
            useful_life=useful_life_years,
            residual_value=residual_value
        )
        
        assert annual_depreciation == Decimal("10000.0000")
    
    def test_calculate_monthly_depreciation_precision(self):
        """
        测试场景: 月折旧额精度验证
        输入: 原值=50000, 使用年限=5年, 残值=5000
        期待: 月折旧额 = (50000-5000)/(5*12) = 750.00
        """
        calculator = StraightLineDepreciationCalculator()
        original_value = Decimal("50000")
        useful_life = 5
        residual_value = Decimal("5000")
        
        monthly_depreciation = calculator.calculate_monthly_depreciation(
            original_value=original_value,
            useful_life=useful_life,
            residual_value=residual_value
        )
        
        assert monthly_depreciation == Decimal("750.0000")
    
    def test_calculate_with_residual_value(self):
        """
        测试场景: 含残值的折旧计算
        输入: 原值=100000, 使用年限=10年, 残值=5000
        期待: 年折旧额 = (100000-5000)/10 = 9500
        """
        calculator = StraightLineDepreciationCalculator()
        original_value = Decimal("100000")
        useful_life = 10
        residual_value = Decimal("5000")
        
        annual = calculator.calculate_annual_depreciation(
            original_value=original_value,
            useful_life=useful_life,
            residual_value=residual_value
        )
        
        assert annual == Decimal("9500.0000")
    
    def test_depreciation_schedule_generation(self):
        """
        测试场景: 全生命周期折旧计划生成
        输入: 原值=30000, 使用年限=3年, 残值=3000
        期待: 生成 36 个月折旧计划，每月 750
        """
        calculator = StraightLineDepreciationCalculator()
        original_value = Decimal("30000")
        useful_life = 3
        residual_value = Decimal("3000")
        purchase_date = date(2024, 1, 1)
        
        schedule = calculator.generate_monthly_schedule(
            original_value=original_value,
            useful_life=useful_life,
            residual_value=residual_value,
            purchase_date=purchase_date
        )
        
        assert len(schedule) == 36
        for entry in schedule:
            assert entry.monthly_depreciation == Decimal("750.0000")
    
    def test_accumulated_depreciation_at_year_end(self):
        """
        测试场景: 年末累计折旧计算
        输入: 折旧满1年
        期待: 累计折旧 = 9500 * 1 = 9500
        """
        calculator = StraightLineDepreciationCalculator()
        original_value = Decimal("100000")
        useful_life = 10
        residual_value = Decimal("5000")
        purchase_date = date(2024, 1, 1)
        as_of_date = date(2025, 1, 1)
        
        result = calculator.calculate(
            original_value=original_value,
            useful_life=useful_life,
            residual_value=residual_value,
            purchase_date=purchase_date,
            as_of_date=as_of_date
        )
        
        assert result.accumulated_depreciation == Decimal("9500.0000")
        assert result.current_net_value == Decimal("90500.0000")
    
    def test_net_value_never_below_residual(self):
        """
        测试场景: 净值不低于残值约束
        输入: 计算日远超使用年限
        期待: 净值 = 残值，不为负
        """
        calculator = StraightLineDepreciationCalculator()
        original_value = Decimal("100000")
        useful_life = 5
        residual_value = Decimal("10000")
        purchase_date = date(2020, 1, 1)
        as_of_date = date(2030, 1, 1)
        
        result = calculator.calculate(
            original_value=original_value,
            useful_life=useful_life,
            residual_value=residual_value,
            purchase_date=purchase_date,
            as_of_date=as_of_date
        )
        
        assert result.current_net_value == Decimal("10000.0000")
        assert result.current_net_value >= residual_value
    
    def test_partial_year_depreciation_prorata(self):
        """
        测试场景: 不足一年的按月比例计算
        输入: 购置6个月后计算
        期待: 累计折旧 = 年折旧额 * 0.5
        """
        calculator = StraightLineDepreciationCalculator()
        original_value = Decimal("120000")
        useful_life = 10
        residual_value = Decimal("0")
        purchase_date = date(2024, 1, 1)
        as_of_date = date(2024, 7, 1)
        
        result = calculator.calculate(
            original_value=original_value,
            useful_life=useful_life,
            residual_value=residual_value,
            purchase_date=purchase_date,
            as_of_date=as_of_date
        )
        
        annual_depreciation = Decimal("12000")
        expected_accumulated = annual_depreciation * Decimal("0.5")
        assert result.accumulated_depreciation == expected_accumulated
    
    def test_calculation_date_before_purchase_raises_error(self):
        """
        测试场景: 计算日期早于购置日期时抛出异常
        期待: ValueError with message containing "before purchase date"
        """
        calculator = StraightLineDepreciationCalculator()
        purchase_date = date(2024, 1, 1)
        invalid_date = date(2023, 12, 31)
        
        with pytest.raises(ValueError, match="before purchase date"):
            calculator.calculate(
                original_value=Decimal("100000"),
                useful_life=10,
                residual_value=Decimal("5000"),
                purchase_date=purchase_date,
                as_of_date=invalid_date
            )