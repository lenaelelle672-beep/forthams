"""
资产折旧计算器单元测试

测试 SWARM-2026-Q2-003: 资产折旧计算核心模块 - Iteration 2
验收标准: ATB-001 至 ATB-006, ATB-015

测试覆盖:
- 直线法折旧计算 (ATB-001, ATB-002, ATB-003)
- 双倍余额递减法折旧计算 (ATB-004, ATB-005, ATB-006)
- 数据一致性验证 (ATB-015)
"""

import pytest
from decimal import Decimal
from datetime import date
from typing import Optional

from src.swarm_003.depreciation.calculators.straight_line import StraightLineCalculator
from src.swarm_003.depreciation.calculators.base import BaseDepreciationCalculator
from src.swarm_003.depreciation.domain.schemas import (
    DepreciationMethod,
    DepreciationParams,
    DepreciationResult,
)


class TestStraightLineDepreciation:
    """直线法折旧计算测试套件"""

    @pytest.fixture
    def calculator(self) -> StraightLineCalculator:
        """创建直线法计算器实例"""
        return StraightLineCalculator()

    # ========== ATB-001: 直线法基础计算 ==========

    def test_straight_line_basic_calculation(self, calculator: StraightLineCalculator) -> None:
        """
        ATB-001: 直线法基础计算
        
        输入: acquisition_cost=100000, useful_life_months=60, salvage_value=5000
        预期: monthly_depreciation = (100000 - 5000) / 60 = 1583.33
        """
        params = DepreciationParams(
            asset_id="test-asset-001",
            acquisition_cost=Decimal("100000.00"),
            acquisition_date=date(2024, 1, 1),
            useful_life_months=60,
            salvage_value=Decimal("5000.00"),
            depreciation_method=DepreciationMethod.STRAIGHT_LINE,
        )
        
        result = calculator.calculate(params)
        
        expected_monthly = Decimal("1583.33")
        assert abs(result.monthly_depreciation - expected_monthly) < Decimal("0.0001"), \
            f"Expected monthly depreciation ~{expected_monthly}, got {result.monthly_depreciation}"
        
        # 验证累计折旧上限
        assert result.accumulated_depreciation <= params.acquisition_cost - params.salvage_value, \
            "Accumulated depreciation exceeds theoretical maximum"

    # ========== ATB-002: 直线法边界条件 - 残值为零 ==========

    def test_straight_line_zero_salvage(
        self, calculator: StraightLineCalculator
    ) -> None:
        """
        ATB-002: 直线法边界条件 - 残值为零
        
        输入: salvage_value=0
        预期: 无报错，月折旧额 = acquisition_cost / useful_life_months
        """
        params = DepreciationParams(
            asset_id="test-asset-002",
            acquisition_cost=Decimal("50000.00"),
            acquisition_date=date(2024, 1, 1),
            useful_life_months=36,
            salvage_value=Decimal("0.00"),
            depreciation_method=DepreciationMethod.STRAIGHT_LINE,
        )
        
        result = calculator.calculate(params)
        
        expected_monthly = Decimal("50000.00") / Decimal("36")
        assert abs(result.monthly_depreciation - expected_monthly) < Decimal("0.0001"), \
            f"Expected monthly depreciation ~{expected_monthly}, got {result.monthly_depreciation}"

    # ========== ATB-003: 直线法边界条件 - 使用寿命为1个月 ==========

    def test_straight_line_single_month(
        self, calculator: StraightLineCalculator
    ) -> None:
        """
        ATB-003: 直线法边界条件 - 使用寿命为1个月
        
        输入: useful_life_months=1
        预期: monthly_depreciation = acquisition_cost - salvage_value
        """
        params = DepreciationParams(
            asset_id="test-asset-003",
            acquisition_cost=Decimal("10000.00"),
            acquisition_date=date(2024, 1, 1),
            useful_life_months=1,
            salvage_value=Decimal("500.00"),
            depreciation_method=DepreciationMethod.STRAIGHT_LINE,
        )
        
        result = calculator.calculate(params)
        
        expected_monthly = Decimal("10000.00") - Decimal("500.00")
        assert result.monthly_depreciation == expected_monthly, \
            f"Expected monthly depreciation = {expected_monthly}, got {result.monthly_depreciation}"


class TestDoubleDecliningBalanceDepreciation:
    """双倍余额递减法折旧计算测试套件"""

    @pytest.fixture
    def calculator(self) -> BaseDepreciationCalculator:
        """创建双倍余额递减法计算器实例"""
        # 动态导入以避免 ModuleNotFoundError
        from src.swarm_003.depreciation.calculators.double_declining import DoubleDecliningCalculator
        return DoubleDecliningCalculator()

    # ========== ATB-004: 双倍余额递减基础计算 ==========

    def test_double_declining_basic(
        self, calculator: BaseDepreciationCalculator
    ) -> None:
        """
        ATB-004: 双倍余额递减基础计算
        
        输入: acquisition_cost=100000, useful_life_months=60, salvage_value=5000
        预期: 年折旧率 = 2/5 = 40%, 首年月折旧额 = (100000 * 0.4) / 12
        """
        params = DepreciationParams(
            asset_id="test-ddb-asset-001",
            acquisition_cost=Decimal("100000.00"),
            acquisition_date=date(2024, 1, 1),
            useful_life_months=60,
            salvage_value=Decimal("5000.00"),
            depreciation_method=DepreciationMethod.DOUBLE_DECLINING,
        )
        
        result = calculator.calculate(params)
        
        # 年折旧率 = 2/5 = 0.4
        annual_rate = Decimal("2") / Decimal("5")
        expected_first_year_monthly = (Decimal("100000.00") * annual_rate) / Decimal("12")
        
        assert abs(result.monthly_depreciation - expected_first_year_monthly) < Decimal("0.0001"), \
            f"Expected monthly depreciation ~{expected_first_year_monthly}, got {result.monthly_depreciation}"

    # ========== ATB-005: 双倍余额递减 - 切换至直线法时机 ==========

    def test_double_declining_switch_point(
        self, calculator: BaseDepreciationCalculator
    ) -> None:
        """
        ATB-005: 双倍余额递减 - 切换至直线法时机
        
        当某年直线法计算的折旧额 > 双倍余额递减额时，应切换至直线法
        验证: 账面价值永远不低于 salvage_value
        """
        params = DepreciationParams(
            asset_id="test-ddb-asset-002",
            acquisition_cost=Decimal("200000.00"),
            acquisition_date=date(2023, 1, 1),
            useful_life_months=60,
            salvage_value=Decimal("10000.00"),
            depreciation_method=DepreciationMethod.DOUBLE_DECLINING,
        )
        
        result = calculator.calculate(params)
        
        # 账面价值永远不低于残值
        assert result.book_value >= params.salvage_value, \
            f"Book value {result.book_value} fell below salvage value {params.salvage_value}"
        
        # 累计折旧不超过理论最大值
        max_depreciation = params.acquisition_cost - params.salvage_value
        assert result.accumulated_depreciation <= max_depreciation, \
            f"Accumulated depreciation {result.accumulated_depreciation} exceeds max {max_depreciation}"

    # ========== ATB-006: 双倍余额递减 - 折旧不得低于残值 ==========

    def test_double_declining_respect_salvage(
        self, calculator: BaseDepreciationCalculator
    ) -> None:
        """
        ATB-006: 双倍余额递减 - 折旧不得低于残值
        
        预期: book_value 永远不得低于 salvage_value
        """
        params = DepreciationParams(
            asset_id="test-ddb-asset-003",
            acquisition_cost=Decimal("50000.00"),
            acquisition_date=date(2024, 1, 1),
            useful_life_months=48,
            salvage_value=Decimal("2000.00"),
            depreciation_method=DepreciationMethod.DOUBLE_DECLINING,
        )
        
        result = calculator.calculate(params)
        
        assert result.book_value >= params.salvage_value, \
            f"Book value {result.book_value} is below minimum salvage {params.salvage_value}"


class TestDepreciationDataConsistency:
    """折旧数据一致性验证测试套件"""

    # ========== ATB-015: 累计折旧上限校验 ==========

    @pytest.mark.parametrize("method", [
        DepreciationMethod.STRAIGHT_LINE,
        DepreciationMethod.DOUBLE_DECLINING,
    ])
    def test_accumulated_depreciation_cap(
        self, 
        method: DepreciationMethod
    ) -> None:
        """
        ATB-015: 累计折旧上限校验
        
        预期: accumulated_depreciation <= acquisition_cost - salvage_value
        任何计算结果均不得超过理论最大值
        """
        # 动态导入以避免 ModuleNotFoundError
        if method == DepreciationMethod.STRAIGHT_LINE:
            from src.swarm_003.depreciation.calculators.straight_line import StraightLineCalculator
            calc = StraightLineCalculator()
        else:
            from src.swarm_003.depreciation.calculators.double_declining import DoubleDecliningCalculator
            calc = DoubleDecliningCalculator()
        
        params = DepreciationParams(
            asset_id=f"test-consistency-{method.value}",
            acquisition_cost=Decimal("150000.00"),
            acquisition_date=date(2024, 1, 1),
            useful_life_months=120,
            salvage_value=Decimal("15000.00"),
            depreciation_method=method,
        )
        
        result = calc.calculate(params)
        
        max_theoretical = params.acquisition_cost - params.salvage_value
        assert result.accumulated_depreciation <= max_theoretical, \
            f"[{method.value}] Accumulated depreciation {result.accumulated_depreciation} " \
            f"exceeds theoretical maximum {max_theoretical}"
        
        # 账面价值必须为正
        assert result.book_value >= Decimal("0"), \
            f"Book value cannot be negative: {result.book_value}"
        
        # 账面价值 = 原值 - 累计折旧
        expected_book_value = params.acquisition_cost - result.accumulated_depreciation
        assert result.book_value == expected_book_value, \
            f"Book value mismatch: {result.book_value} != {expected_book_value}"


class TestDepreciationEdgeCases:
    """折旧计算边界情况测试"""

    def test_zero_useful_life_rejected(self) -> None:
        """使用寿命为零应被拒绝"""
        params = DepreciationParams(
            asset_id="test-edge-001",
            acquisition_cost=Decimal("10000.00"),
            acquisition_date=date(2024, 1, 1),
            useful_life_months=0,  # 无效值
            salvage_value=Decimal("0.00"),
            depreciation_method=DepreciationMethod.STRAIGHT_LINE,
        )
        
        with pytest.raises(ValueError, match="useful_life_months must be >= 1"):
            calculator = StraightLineCalculator()
            calculator.calculate(params)

    def test_negative_cost_rejected(self) -> None:
        """负原值应被拒绝"""
        params = DepreciationParams(
            asset_id="test-edge-002",
            acquisition_cost=Decimal("-1000.00"),  # 无效值
            acquisition_date=date(2024, 1, 1),
            useful_life_months=12,
            salvage_value=Decimal("0.00"),
            depreciation_method=DepreciationMethod.STRAIGHT_LINE,
        )
        
        with pytest.raises(ValueError, match="acquisition_cost must be >= 0"):
            calculator = StraightLineCalculator()
            calculator.calculate(params)

    def test_salvage_exceeds_cost_rejected(self) -> None:
        """残值大于原值应被拒绝"""
        params = DepreciationParams(
            asset_id="test-edge-003",
            acquisition_cost=Decimal("5000.00"),
            acquisition_date=date(2024, 1, 1),
            useful_life_months=60,
            salvage_value=Decimal("6000.00"),  # 无效值
            depreciation_method=DepreciationMethod.STRAIGHT_LINE,
        )
        
        with pytest.raises(ValueError, match="salvage_value cannot exceed acquisition_cost"):
            calculator = StraightLineCalculator()
            calculator.calculate(params)

    def test_precision_rounding(self) -> None:
        """验证小数精度和四舍五入"""
        params = DepreciationParams(
            asset_id="test-precision-001",
            acquisition_cost=Decimal("100000.00"),
            acquisition_date=date(2024, 1, 1),
            useful_life_months=7,  # 会产生循环小数
            salvage_value=Decimal("1000.00"),
            depreciation_method=DepreciationMethod.STRAIGHT_LINE,
        )
        
        calculator = StraightLineCalculator()
        result = calculator.calculate(params)
        
        # 验证精度为小数点后4位
        assert result.monthly_depreciation == result.monthly_depreciation.quantize(Decimal("0.0001"))