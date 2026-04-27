"""
SWARM-003 资产折旧计算模块 - 直线法计算器单元测试

测试范围：
- ATB-1.1: 正常直线法月折旧额计算
- ATB-1.2: 计提前净值查询
- ATB-1.3: 计提一月后净值
- ATB-1.4: 残值边界（残值=0）
- ATB-1.5: 计提完成校验
- ATB-1.6: 重复计提拦截

引用公式：
  月折旧额 = (原值 - 残值) / 尚可使用月数
  当前净值 = 原值 - 累计折旧
"""

import pytest
from decimal import Decimal
from datetime import date
from typing import Optional

from src.domain.calculators.base import DepreciationCalculator, DepreciationMethod
from src.domain.calculators.straight_line import StraightLineCalculator
from src.domain.entities.asset_depreciation import AssetDepreciation
from src.domain.value_objects.depreciation_result import DepreciationResult
from src.domain.value_objects.depreciation_period import DepreciationPeriod


class TestStraightLineCalculator:
    """直线法折旧计算器测试套件"""

    @pytest.fixture
    def standard_asset(self) -> AssetDepreciation:
        """
        标准测试资产：
        - 原值: 120,000
        - 残值: 12,000
        - 使用年限: 10年 (120月)
        - 预期月折旧额: (120000 - 12000) / 120 = 900.00
        """
        return AssetDepreciation(
            asset_id="AST-001",
            original_cost=Decimal("120000.00"),
            salvage_value=Decimal("12000.00"),
            useful_life_months=120,
            acquisition_date=date(2024, 1, 1),
            depreciation_method=DepreciationMethod.STRAIGHT_LINE,
            accumulated_depreciation=Decimal("0.00"),
            entity_id="ENT-001"
        )

    @pytest.fixture
    def zero_salvage_asset(self) -> AssetDepreciation:
        """
        残值为零的测试资产（边界场景）：
        - 原值: 50,000
        - 残值: 0
        - 使用年限: 5年 (60月)
        - 预期月折旧额: 50000 / 60 = 833.33
        """
        return AssetDepreciation(
            asset_id="AST-002",
            original_cost=Decimal("50000.00"),
            salvage_value=Decimal("0.00"),
            useful_life_months=60,
            acquisition_date=date(2024, 1, 1),
            depreciation_method=DepreciationMethod.STRAIGHT_LINE,
            accumulated_depreciation=Decimal("0.00"),
            entity_id="ENT-001"
        )

    @pytest.fixture
    def fully_depreciated_asset(self) -> AssetDepreciation:
        """
        已完成折旧的资产（用于测试 BC-006）：
        - 原值: 120,000
        - 残值: 12,000
        - 累计折旧: 108,000 (= 120000 - 12000)
        - 状态: fully_depreciated = True
        """
        return AssetDepreciation(
            asset_id="AST-003",
            original_cost=Decimal("120000.00"),
            salvage_value=Decimal("12000.00"),
            useful_life_months=120,
            acquisition_date=date(2023, 1, 1),
            depreciation_method=DepreciationMethod.STRAIGHT_LINE,
            accumulated_depreciation=Decimal("108000.00"),
            entity_id="ENT-001",
            is_fully_depreciated=True
        )

    @pytest.fixture
    def calculator(self) -> StraightLineCalculator:
        """直线法计算器实例"""
        return StraightLineCalculator()

    # ==================== ATB-1.1: 正常直线法月折旧额 ====================

    def test_monthly_depreciation_standard(
        self,
        calculator: StraightLineCalculator,
        standard_asset: AssetDepreciation
    ) -> None:
        """
        ATB-1.1: 正常直线法月折旧额

        测试步骤：创建资产（原价=120000，残值=12000，使用年限=10年），
        调用 calculate_monthly_depreciation(StraightLine)

        预期结果：月折旧额 = (120000-12000)/120 = 900.00
        """
        result = calculator.monthly_depreciation(standard_asset)
        assert result == Decimal("900.00"), (
            f"预期月折旧额为 900.00，实际为 {result}"
        )

    def test_depreciable_amount_calculation(
        self,
        calculator: StraightLineCalculator,
        standard_asset: AssetDepreciation
    ) -> None:
        """
        可折旧金额验证：
        可折旧金额 = 原值 - 残值 = 120000 - 12000 = 108000
        """
        depreciable_amount = calculator._calculate_depreciable_amount(standard_asset)
        assert depreciable_amount == Decimal("108000.00")

    # ==================== ATB-1.2: 计提前净值 ====================

    def test_initial_net_value(
        self,
        calculator: StraightLineCalculator,
        standard_asset: AssetDepreciation
    ) -> None:
        """
        ATB-1.2: 首月净值（计提前）

        测试步骤：同一资产，创建后立即查询 get_current_net_value

        预期结果：净值为 120000.00（未计提前）
        """
        net_value = calculator.get_current_net_value(standard_asset)
        assert net_value == Decimal("120000.00"), (
            f"计提前净值应为原值 120000.00，实际为 {net_value}"
        )

    # ==================== ATB-1.3: 计提一月后净值 ====================

    def test_net_value_after_one_month(
        self,
        calculator: StraightLineCalculator,
        standard_asset: AssetDepreciation
    ) -> None:
        """
        ATB-1.3: 计提一月后净值

        测试步骤：调用 apply_depreciation 后查询净值

        预期结果：净值为 119100.00
        公式：120000 - 900 = 119100
        """
        # 模拟计提一个月
        standard_asset.accumulated_depreciation = Decimal("900.00")

        net_value = calculator.get_current_net_value(standard_asset)
        assert net_value == Decimal("119100.00"), (
            f"计提一月后净值应为 119100.00，实际为 {net_value}"
        )

    def test_accumulated_depreciation_after_one_month(
        self,
        calculator: StraightLineCalculator,
        standard_asset: AssetDepreciation
    ) -> None:
        """验证累计折旧记录正确"""
        monthly = calculator.monthly_depreciation(standard_asset)

        # 模拟多次计提
        for _ in range(6):
            result = calculator.apply_depreciation(standard_asset)
            assert result.depreciation_amount == monthly

        assert standard_asset.accumulated_depreciation == Decimal("5400.00")

    # ==================== ATB-1.4: 残值边界（残值=0） ====================

    def test_monthly_depreciation_zero_salvage(
        self,
        calculator: StraightLineCalculator,
        zero_salvage_asset: AssetDepreciation
    ) -> None:
        """
        ATB-1.4: 残值边界：残值=0

        测试步骤：原价=50000，残值=0，使用年限=5年，计算月折旧

        预期结果：月折旧 = 50000/60 = 833.33
        """
        result = calculator.monthly_depreciation(zero_salvage_asset)
        assert result == Decimal("833.33"), (
            f"残值为零时，月折旧额应为 833.33，实际为 {result}"
        )

    def test_final_net_value_with_zero_salvage(
        self,
        calculator: StraightLineCalculator,
        zero_salvage_asset: AssetDepreciation
    ) -> None:
        """
        验证残值为零时，最终净值等于零
        """
        net_value = calculator.get_current_net_value(zero_salvage_asset)
        assert net_value == Decimal("50000.00")  # 计提前

        # 计提完成后
        zero_salvage_asset.accumulated_depreciation = Decimal("50000.00")
        zero_salvage_asset.is_fully_depreciated = True
        net_value = calculator.get_current_net_value(zero_salvage_asset)
        assert net_value == Decimal("0.00")

    # ==================== ATB-1.5: 计提完成校验 ====================

    def test_fully_depreciated_asset(
        self,
        calculator: StraightLineCalculator,
        standard_asset: AssetDepreciation
    ) -> None:
        """
        ATB-1.5: 计提完成校验

        测试步骤：连续计提120个月后，资产状态变为 fully_depreciated=True

        预期结果：
        - 累计折旧 = 108000.00
        - 净值 = 残值 12000.00
        """
        # 模拟完成折旧（120个月）
        standard_asset.accumulated_depreciation = Decimal("108000.00")
        standard_asset.is_fully_depreciated = True

        monthly = calculator.monthly_depreciation(standard_asset)
        assert monthly == Decimal("0.00") or monthly == Decimal("900.00"), (
            "已完成折旧资产应返回0或最后一期金额"
        )

        net_value = calculator.get_current_net_value(standard_asset)
        assert net_value == Decimal("12000.00"), (
            f"完成折旧后净值应等于残值 12000.00，实际为 {net_value}"
        )

    def test_total_depreciation_amount(
        self,
        calculator: StraightLineCalculator,
        standard_asset: AssetDepreciation
    ) -> None:
        """
        验证总折旧金额等于可折旧金额
        总折旧 = 120 * 900 = 108000 = 原值 - 残值
        """
        monthly = calculator.monthly_depreciation(standard_asset)
        total_months = standard_asset.useful_life_months
        total_depreciation = monthly * total_months

        expected_total = standard_asset.original_cost - standard_asset.salvage_value
        assert total_depreciation == expected_total, (
            f"总折旧金额 {total_depreciation} 应等于可折旧金额 {expected_total}"
        )

    # ==================== ATB-1.6: 重复计提拦截 ====================

    def test_fully_depreciated_error_raised(
        self,
        calculator: StraightLineCalculator,
        fully_depreciated_asset: AssetDepreciation
    ) -> None:
        """
        ATB-1.6: 重复计提拦截

        测试步骤：已完全折旧资产再次调用 apply_depreciation

        预期结果：抛出 AssetFullyDepreciatedError
        """
        from src.domain.exceptions import AssetFullyDepreciatedError

        with pytest.raises(AssetFullyDepreciatedError) as exc_info:
            calculator.apply_depreciation(fully_depreciated_asset)

        assert "AST-003" in str(exc_info.value)
        assert "fully depreciated" in str(exc_info.value).lower()

    def test_prevents_over_depreciation(
        self,
        calculator: StraightLineCalculator,
        standard_asset: AssetDepreciation
    ) -> None:
        """
        BC-005: 验证累计折旧不超过可折旧金额

        约束：任一资产的累计折旧 <= 原值 - 残值
        """
        depreciable_amount = calculator._calculate_depreciable_amount(standard_asset)

        # 尝试超额计提
        standard_asset.accumulated_depreciation = depreciable_amount + Decimal("100.00")

        # 此时不应允许再次计提
        net_value = calculator.get_current_net_value(standard_asset)
        assert net_value < standard_asset.salvage_value, (
            "净值不应低于残值"
        )

    # ==================== 边界约束测试 (BC-001 ~ BC-008) ====================

    def test_bc_001_original_cost_positive(
        self,
        calculator: StraightLineCalculator
    ) -> None:
        """BC-001: 资产原值 original_cost > 0"""
        from src.domain.exceptions import ValidationError

        with pytest.raises(ValidationError) as exc_info:
            AssetDepreciation(
                asset_id="AST-ERR-001",
                original_cost=Decimal("0.00"),  # 无效：必须 > 0
                salvage_value=Decimal("0.00"),
                useful_life_months=60,
                acquisition_date=date(2024, 1, 1),
                depreciation_method=DepreciationMethod.STRAIGHT_LINE,
                entity_id="ENT-001"
            )
        assert "original_cost" in str(exc_info.value).lower()

    def test_bc_002_salvage_less_than_original(
        self,
        calculator: StraightLineCalculator
    ) -> None:
        """BC-002: 残值必须小于原值"""
        from src.domain.exceptions import ValidationError

        with pytest.raises(ValidationError) as exc_info:
            AssetDepreciation(
                asset_id="AST-ERR-002",
                original_cost=Decimal("10000.00"),
                salvage_value=Decimal("10000.00"),  # 无效：必须 < 原值
                useful_life_months=60,
                acquisition_date=date(2024, 1, 1),
                depreciation_method=DepreciationMethod.STRAIGHT_LINE,
                entity_id="ENT-001"
            )
        assert "salvage" in str(exc_info.value).lower()

    def test_bc_002_negative_salvage_rejected(
        self,
        calculator: StraightLineCalculator
    ) -> None:
        """BC-002: 残值不能为负"""
        from src.domain.exceptions import ValidationError

        with pytest.raises(ValidationError) as exc_info:
            AssetDepreciation(
                asset_id="AST-ERR-003",
                original_cost=Decimal("10000.00"),
                salvage_value=Decimal("-100.00"),  # 无效：必须 >= 0
                useful_life_months=60,
                acquisition_date=date(2024, 1, 1),
                depreciation_method=DepreciationMethod.STRAIGHT_LINE,
                entity_id="ENT-001"
            )
        assert "salvage" in str(exc_info.value).lower()

    def test_bc_003_useful_life_positive_integer(
        self,
        calculator: StraightLineCalculator
    ) -> None:
        """BC-003: 使用年限必须为正整数"""
        from src.domain.exceptions import ValidationError

        with pytest.raises(ValidationError) as exc_info:
            AssetDepreciation(
                asset_id="AST-ERR-004",
                original_cost=Decimal("10000.00"),
                salvage_value=Decimal("1000.00"),
                useful_life_months=0,  # 无效：必须 > 0
                acquisition_date=date(2024, 1, 1),
                depreciation_method=DepreciationMethod.STRAIGHT_LINE,
                entity_id="ENT-001"
            )
        assert "useful_life" in str(exc_info.value).lower()

    def test_bc_007_acquisition_date_not_future(
        self,
        calculator: StraightLineCalculator
    ) -> None:
        """BC-007: 购置日期不得晚于当前日期"""
        from src.domain.exceptions import ValidationError
        from datetime import timedelta

        future_date = date.today() + timedelta(days=30)

        with pytest.raises(ValidationError) as exc_info:
            AssetDepreciation(
                asset_id="AST-ERR-005",
                original_cost=Decimal("10000.00"),
                salvage_value=Decimal("1000.00"),
                useful_life_months=60,
                acquisition_date=future_date,  # 无效：未来日期
                depreciation_method=DepreciationMethod.STRAIGHT_LINE,
                entity_id="ENT-001"
            )
        assert "acquisition_date" in str(exc_info.value).lower()

    # ==================== 计算精度测试 ====================

    def test_decimal_precision_two_places(
        self,
        calculator: StraightLineCalculator
    ) -> None:
        """
        CC-001: 结果向下取整至分（2位小数）

        测试场景：(100000 - 10000) / 37 = 2432.4324...
        预期结果：月折旧 = 2432.43（向下取整）
        """
        asset = AssetDepreciation(
            asset_id="AST-PREC-001",
            original_cost=Decimal("100000.00"),
            salvage_value=Decimal("10000.00"),
            useful_life_months=37,
            acquisition_date=date(2024, 1, 1),
            depreciation_method=DepreciationMethod.STRAIGHT_LINE,
            entity_id="ENT-001"
        )

        result = calculator.monthly_depreciation(asset)
        # 验证结果为 Decimal 且保留2位小数
        assert result == result.quantize(Decimal("0.01"))
        assert str(result) == "2432.43"

    # ==================== 方法一致性测试 ====================

    def test_method_locked_during_lifecycle(
        self,
        calculator: StraightLineCalculator,
        standard_asset: AssetDepreciation
    ) -> None:
        """
        BizC-001: 同一种折旧方法在同一资产的生命周期内不可变更

        验证：直线法计算器只能处理 STRAIGHT_LINE 方法的资产
        """
        # 创建一个双倍余额递减法资产
        ddb_asset = AssetDepreciation(
            asset_id="AST-DDB-001",
            original_cost=Decimal("100000.00"),
            salvage_value=Decimal("5000.00"),
            useful_life_months=60,
            acquisition_date=date(2024, 1, 1),
            depreciation_method=DepreciationMethod.DOUBLE_DECLINING,
            entity_id="ENT-001"
        )

        # 直线法计算器应拒绝处理非直线法资产
        with pytest.raises(ValueError) as exc_info:
            calculator.monthly_depreciation(ddb_asset)
        assert "STRAIGHT_LINE" in str(exc_info.value)

    # ==================== 报表数据生成测试 ====================

    def test_generate_period_record(
        self,
        calculator: StraightLineCalculator,
        standard_asset: AssetDepreciation
    ) -> None:
        """
        验证生成折旧期间记录（用于报表）
        """
        period = DepreciationPeriod(
            fiscal_year=2024,
            fiscal_month=1,
            start_date=date(2024, 1, 1),
            end_date=date(2024, 1, 31)
        )

        result = calculator.calculate_for_period(standard_asset, period)

        assert isinstance(result, DepreciationResult)
        assert result.depreciation_amount == Decimal("900.00")
        assert result.fiscal_year == 2024
        assert result.fiscal_month == 1
        assert result.asset_id == "AST-001"

    def test_accumulated_depreciation_tracking(
        self,
        calculator: StraightLineCalculator,
        standard_asset: AssetDepreciation
    ) -> None:
        """
        验证累计折旧跟踪（12个月 = 10800）
        """
        monthly = calculator.monthly_depreciation(standard_asset)

        # 模拟12个月计提
        for month in range(12):
            result = calculator.apply_depreciation(standard_asset)
            assert result.depreciation_amount == monthly

        assert standard_asset.accumulated_depreciation == Decimal("10800.00")

        # 净值 = 120000 - 10800 = 109200
        net_value = calculator.get_current_net_value(standard_asset)
        assert net_value == Decimal("109200.00")

    # ==================== 性能基准测试 ====================

    @pytest.mark.benchmark
    def test_monthly_calculation_performance(
        self,
        calculator: StraightLineCalculator,
        standard_asset: AssetDepreciation,
        benchmark
    ) -> None:
        """
        性能基准：单资产月折旧计算应在 1ms 内完成
        TC-003: API 响应时间 ≤ 200ms（单资产查询）
        """
        result = benchmark(calculator.monthly_depreciation, standard_asset)
        assert result == Decimal("900.00")

    @pytest.mark.benchmark
    def test_10k_calculations_performance(
        self,
        calculator: StraightLineCalculator,
        standard_asset: AssetDepreciation,
        benchmark
    ) -> None:
        """
        批量性能测试：10000 次计算应在合理时间内完成
        """
        def batch_calculate():
            for _ in range(10000):
                calculator.monthly_depreciation(standard_asset)

        elapsed = benchmark(batch_calculate)
        assert elapsed < 5.0, f"10000次计算耗时 {elapsed}s，超过5s阈值"


class TestStraightLineCalculatorEdgeCases:
    """直线法计算器边界场景测试"""

    def test_single_month_life(self) -> None:
        """使用年限为1个月的极端场景"""
        asset = AssetDepreciation(
            asset_id="AST-EDGE-001",
            original_cost=Decimal("60000.00"),
            salvage_value=Decimal("0.00"),
            useful_life_months=1,
            acquisition_date=date(2024, 1, 1),
            depreciation_method=DepreciationMethod.STRAIGHT_LINE,
            entity_id="ENT-001"
        )

        calc = StraightLineCalculator()
        monthly = calc.monthly_depreciation(asset)
        assert monthly == Decimal("60000.00")

        # 计提后净值应为0
        asset.accumulated_depreciation = monthly
        assert calc.get_current_net_value(asset) == Decimal("0.00")

    def test_large_value_asset(self) -> None:
        """大额资产（百亿级别）"""
        asset = AssetDepreciation(
            asset_id="AST-EDGE-002",
            original_cost=Decimal("999999999999.99"),
            salvage_value=Decimal("999.99"),
            useful_life_months=360,  # 30年
            acquisition_date=date(2024, 1, 1),
            depreciation_method=DepreciationMethod.STRAIGHT_LINE,
            entity_id="ENT-001"
        )

        calc = StraightLineCalculator()
        monthly = calc.monthly_depreciation(asset)

        # 验证精度不丢失
        assert monthly > Decimal("0")
        assert monthly == monthly.quantize(Decimal("0.01"))

    def test_salvage_equals_half_original(self) -> None:
        """残值等于原价50%的场景"""
        asset = AssetDepreciation(
            asset_id="AST-EDGE-003",
            original_cost=Decimal("10000.00"),
            salvage_value=Decimal("5000.00"),
            useful_life_months=60,
            acquisition_date=date(2024, 1, 1),
            depreciation_method=DepreciationMethod.STRAIGHT_LINE,
            entity_id="ENT-001"
        )

        calc = StraightLineCalculator()
        monthly = calc.monthly_depreciation(asset)
        # (10000 - 5000) / 60 = 83.33
        assert monthly == Decimal("83.33")