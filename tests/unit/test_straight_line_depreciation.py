"""
直线法折旧计算单元测试

验收标准: ATB-1
- ATB-1.1: 原值=100000, 残值=5000, 使用寿命=60月，计提月份=第1月 → 月折旧额=1583.33
- ATB-1.2: 原值=100000, 残值=5000, 使用寿命=60月，计提月份=第60月 → 累计折旧=95000, 账面净值=5000
- ATB-1.3: 原值=100000, 残值=0, 使用寿命=120月，计提月份=第1月 → 月折旧额=833.33
- ATB-1.4: 计提月份=第0月（早于入账月） → 抛出 DepreciationDateException

边界约束:
- BC-001: 折旧年月不可早于资产入账年月
- BC-002: 折旧金额保留2位小数，四舍五入；误差不超过0.01元
- BC-003: 残值 <= 原值，且 >= 0
- BC-004: 使用寿命 >= 1，最大600
- BC-006: 幂等性
"""

import pytest
from decimal import Decimal
from datetime import date
from unittest.mock import MagicMock

from src.swarm_003.depreciation.calculators.straight_line import StraightLineCalculator
from src.swarm_003.depreciation.domain.entities import DepreciationAsset
from src.swarm_003.depreciation.domain.schemas import DepreciationPeriod, DepreciationResult


class TestStraightLineDepreciation:
    """直线法折旧计算器测试套件"""

    @pytest.fixture
    def calculator(self):
        """创建直线法计算器实例"""
        return StraightLineCalculator()

    @pytest.fixture
    def base_asset(self):
        """基础资产配置: 原值100000, 残值5000, 使用寿命60月"""
        return DepreciationAsset(
            asset_id="AST-001",
            asset_name="测试固定资产",
            original_cost=Decimal("100000.00"),
            residual_value=Decimal("5000.00"),
            useful_life_months=60,
            acquisition_date=date(2026, 1, 1),
            depreciation_method="STRAIGHT_LINE"
        )

    @pytest.fixture
    def zero_residual_asset(self):
        """零残值资产: 原值100000, 残值0, 使用寿命120月"""
        return DepreciationAsset(
            asset_id="AST-002",
            asset_name="零残值资产",
            original_cost=Decimal("100000.00"),
            residual_value=Decimal("0.00"),
            useful_life_months=120,
            acquisition_date=date(2026, 1, 1),
            depreciation_method="STRAIGHT_LINE"
        )

    # ==================== ATB-1.1: 第1月折旧计算 ====================
    def test_atb_1_1_first_month_depreciation(self, calculator, base_asset):
        """
        ATB-1.1: 原值=100000, 残值=5000, 使用寿命=60月，计提月份=第1月
        期待: 月折旧额 = 1583.33
        公式: (100000 - 5000) / 60 = 95000 / 60 = 1583.33
        """
        period = DepreciationPeriod(year=2026, month=2, period_number=1)

        result = calculator.calculate(asset=base_asset, period=period)

        assert result.asset_id == "AST-001"
        assert result.method == "STRAIGHT_LINE"
        assert result.period == "2026-02"
        assert result.monthly_depreciation == Decimal("1583.33")
        assert result.accumulated_depreciation == Decimal("1583.33")
        assert result.book_value == Decimal("98416.67")

    # ==================== ATB-1.2: 最后1月折旧计算 ====================
    def test_atb_1_2_final_month_depreciation(self, calculator, base_asset):
        """
        ATB-1.2: 原值=100000, 残值=5000, 使用寿命=60月，计提月份=第60月
        期待: 累计折旧=95000, 账面净值=5000
        """
        period = DepreciationPeriod(year=2031, month=1, period_number=60)

        result = calculator.calculate(asset=base_asset, period=period)

        assert result.monthly_depreciation == Decimal("1583.33")
        assert result.accumulated_depreciation == Decimal("95000.00")
        assert result.book_value == Decimal("5000.00")

    # ==================== ATB-1.3: 零残值折旧计算 ====================
    def test_atb_1_3_zero_residual_first_month(self, calculator, zero_residual_asset):
        """
        ATB-1.3: 原值=100000, 残值=0, 使用寿命=120月，计提月份=第1月
        期待: 月折旧额 = 833.33
        公式: (100000 - 0) / 120 = 833.33
        """
        period = DepreciationPeriod(year=2026, month=2, period_number=1)

        result = calculator.calculate(asset=zero_residual_asset, period=period)

        assert result.monthly_depreciation == Decimal("833.33")
        assert result.accumulated_depreciation == Decimal("833.33")
        assert result.book_value == Decimal("99166.67")

    # ==================== ATB-1.4: 日期校验异常 ====================
    def test_atb_1_4_date_before_acquisition_raises_exception(self, calculator, base_asset):
        """
        ATB-1.4: 计提月份=第0月（早于入账月）
        期待: 抛出 DepreciationDateException
        约束: BC-001
        """
        period = DepreciationPeriod(year=2025, month=12, period_number=0)

        with pytest.raises(DepreciationDateException):
            calculator.calculate(asset=base_asset, period=period)

    # ==================== BC-002: 精度校验 ====================
    def test_bc_002_decimal_precision(self, calculator):
        """
        BC-002: 折旧金额保留2位小数，四舍五入；误差不超过0.01元
        """
        asset = DepreciationAsset(
            asset_id="AST-003",
            asset_name="精度测试资产",
            original_cost=Decimal("100000.00"),
            residual_value=Decimal("3333.33"),
            useful_life_months=7,
            acquisition_date=date(2026, 1, 1),
            depreciation_method="STRAIGHT_LINE"
        )
        # 可折旧金额: 100000 - 3333.33 = 96666.67, 月折旧: 96666.67 / 7 = 13809.52
        period = DepreciationPeriod(year=2026, month=2, period_number=1)

        result = calculator.calculate(asset=asset, period=period)

        # 验证小数位数
        monthly_str = str(result.monthly_depreciation)
        decimal_places = len(monthly_str.split('.')[-1]) if '.' in monthly_str else 0
        assert decimal_places <= 2, f"月折旧额小数位数超过2位: {monthly_str}"

        # 验证误差不超过0.01
        expected = Decimal("13809.52")
        diff = abs(result.monthly_depreciation - expected)
        assert diff <= Decimal("0.01"), f"月折旧额误差超过0.01: 实际={result.monthly_depreciation}, 预期={expected}"

    # ==================== BC-003: 残值校验 ====================
    def test_bc_003_residual_value_exceeds_cost_raises_exception(self, calculator):
        """
        BC-003: 残值 > 原值 → 抛出异常
        """
        asset = DepreciationAsset(
            asset_id="AST-004",
            asset_name="残值异常资产",
            original_cost=Decimal("10000.00"),
            residual_value=Decimal("15000.00"),  # 残值 > 原值
            useful_life_months=60,
            acquisition_date=date(2026, 1, 1),
            depreciation_method="STRAIGHT_LINE"
        )
        period = DepreciationPeriod(year=2026, month=2, period_number=1)

        with pytest.raises(InvalidDepreciationConfigException):
            calculator.calculate(asset=asset, period=period)

    def test_bc_003_negative_residual_value_raises_exception(self, calculator):
        """
        BC-003: 残值 < 0 → 抛出异常
        """
        asset = DepreciationAsset(
            asset_id="AST-005",
            asset_name="负残值资产",
            original_cost=Decimal("100000.00"),
            residual_value=Decimal("-100.00"),  # 负残值
            useful_life_months=60,
            acquisition_date=date(2026, 1, 1),
            depreciation_method="STRAIGHT_LINE"
        )
        period = DepreciationPeriod(year=2026, month=2, period_number=1)

        with pytest.raises(InvalidDepreciationConfigException):
            calculator.calculate(asset=asset, period=period)

    # ==================== BC-004: 使用寿命校验 ====================
    def test_bc_004_useful_life_zero_raises_exception(self, calculator):
        """
        BC-004: 使用寿命 = 0 → 抛出异常
        """
        asset = DepreciationAsset(
            asset_id="AST-006",
            asset_name="寿命为零资产",
            original_cost=Decimal("100000.00"),
            residual_value=Decimal("5000.00"),
            useful_life_months=0,  # 无效使用寿命
            acquisition_date=date(2026, 1, 1),
            depreciation_method="STRAIGHT_LINE"
        )
        period = DepreciationPeriod(year=2026, month=2, period_number=1)

        with pytest.raises(ValidationException):
            calculator.calculate(asset=asset, period=period)

    def test_bc_004_useful_life_exceeds_maximum_raises_exception(self, calculator):
        """
        BC-004: 使用寿命 > 600 → 抛出异常
        """
        asset = DepreciationAsset(
            asset_id="AST-007",
            asset_name="超长寿命资产",
            original_cost=Decimal("100000.00"),
            residual_value=Decimal("5000.00"),
            useful_life_months=601,  # 超过最大600
            acquisition_date=date(2026, 1, 1),
            depreciation_method="STRAIGHT_LINE"
        )
        period = DepreciationPeriod(year=2026, month=2, period_number=1)

        with pytest.raises(ValidationException):
            calculator.calculate(asset=asset, period=period)

    # ==================== BC-006: 幂等性校验 ====================
    def test_bc_006_idempotency_same_period_same_result(self, calculator, base_asset):
        """
        BC-006: 同一资产同一月份的折旧计算必须幂等
        """
        period = DepreciationPeriod(year=2026, month=3, period_number=2)

        result1 = calculator.calculate(asset=base_asset, period=period)
        result2 = calculator.calculate(asset=base_asset, period=period)

        assert result1.monthly_depreciation == result2.monthly_depreciation
        assert result1.accumulated_depreciation == result2.accumulated_depreciation
        assert result1.book_value == result2.book_value

    # ==================== 中间月份累计折旧验证 ====================
    def test_middle_period_accumulated_depreciation(self, calculator, base_asset):
        """
        验证中间月份累计折旧正确性
        第30月: 累计折旧 = 1583.33 * 30 = 47499.90
        """
        period = DepreciationPeriod(year=2028, month=7, period_number=30)

        result = calculator.calculate(asset=base_asset, period=period)

        expected_monthly = Decimal("1583.33")
        expected_accumulated = Decimal("47499.90")
        expected_book_value = Decimal("52500.10")

        assert result.monthly_depreciation == expected_monthly
        assert result.accumulated_depreciation == expected_accumulated
        assert result.book_value == expected_book_value

    # ==================== 边界: 第1月即最后1月 (使用寿命=1) ====================
    def test_single_month_asset_full_depreciation(self, calculator):
        """
        使用寿命=1月的资产，应一次性折旧完毕
        """
        asset = DepreciationAsset(
            asset_id="AST-008",
            asset_name="1月寿命资产",
            original_cost=Decimal("12000.00"),
            residual_value=Decimal("0.00"),
            useful_life_months=1,
            acquisition_date=date(2026, 1, 1),
            depreciation_method="STRAIGHT_LINE"
        )
        period = DepreciationPeriod(year=2026, month=2, period_number=1)

        result = calculator.calculate(asset=asset, period=period)

        assert result.monthly_depreciation == Decimal("12000.00")
        assert result.accumulated_depreciation == Decimal("12000.00")
        assert result.book_value == Decimal("0.00")

    # ==================== 边界: 残值等于原值 ====================
    def test_residual_equals_original_cost_no_depreciation(self, calculator):
        """
        残值等于原值，无可折旧金额
        """
        asset = DepreciationAsset(
            asset_id="AST-009",
            asset_name="无折旧资产",
            original_cost=Decimal("50000.00"),
            residual_value=Decimal("50000.00"),  # 残值=原值
            useful_life_months=60,
            acquisition_date=date(2026, 1, 1),
            depreciation_method="STRAIGHT_LINE"
        )
        period = DepreciationPeriod(year=2026, month=2, period_number=1)

        result = calculator.calculate(asset=asset, period=period)

        assert result.monthly_depreciation == Decimal("0.00")
        assert result.accumulated_depreciation == Decimal("0.00")
        assert result.book_value == Decimal("50000.00")


# ==================== 自定义异常定义（与代码实现保持一致） ====================

class DepreciationDateException(Exception):
    """折旧日期异常: 计提日期早于资产入账日期"""
    pass


class InvalidDepreciationConfigException(Exception):
    """无效折旧配置异常"""
    pass


class ValidationException(Exception):
    """校验异常"""
    pass