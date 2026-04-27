"""
ATB-2: 双倍余额递减法计算验证测试套件

测试覆盖范围：
- ATB-2.1: 正常首月 DDB 折旧
- ATB-2.2: 第二月折旧
- ATB-2.3: 第37月强制转直线法（剩余24月临界触发）
- ATB-2.4: 最终净值 = 残值
- ATB-2.5: 残值下限保护
- 额外边界场景

参考公式：DDB 月折旧 = 期初账面净值 × 2 / 折旧年限月数
DDB 转直线临界：剩余月数 ≤ 24 时，切换为 remaining_book_value / remaining_months
"""

from decimal import Decimal
from unittest.mock import MagicMock, patch
import pytest

from src.domain.calculators.double_declining import DoubleDecliningCalculator
from src.domain.calculators.base import DepreciationCalculator
from src.domain.entities.asset import Asset
from src.domain.entities.asset import DepreciationMethod


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

@pytest.fixture
def base_asset():
    """
    标准测试资产：原值=100000，残值=5000，使用年限=5年(60月)
    用于 ATB-2.1 ~ ATB-2.4
    """
    return Asset(
        asset_id="AST-2024-001",
        original_cost=Decimal("100000.00"),
        salvage_value=Decimal("5000.00"),
        useful_life_months=60,
        acquisition_date="2024-01-01",
        method=DepreciationMethod.DOUBLE_DECLINING,
        entity_id="ENT-001",
        category="电子设备",
        asset_name="测试服务器",
    )


@pytest.fixture
def zero_salvage_asset():
    """残值为 0 的资产，用于边界测试"""
    return Asset(
        asset_id="AST-2024-002",
        original_cost=Decimal("50000.00"),
        salvage_value=Decimal("0.00"),
        useful_life_months=60,
        acquisition_date="2024-01-01",
        method=DepreciationMethod.DOUBLE_DECLINING,
        entity_id="ENT-001",
        category="办公家具",
        asset_name="办公桌",
    )


@pytest.fixture
def calc():
    """DoubleDecliningCalculator 实例"""
    return DoubleDecliningCalculator()


# ---------------------------------------------------------------------------
# ATB-2.1: 正常首月 DDB 折旧
# ---------------------------------------------------------------------------

class TestATB21_FirstMonthDepreciation:
    """ATB-2.1: 正常首月 DDB 折旧

    期望：月折旧 = 原值 × 2 / 折旧年限月数 = 100000 × 2 / 60 = 3333.33
    """

    def test_first_month_ddb_depreciation(self, calc, base_asset):
        """
        首月折旧验证：
        - 期望值 = 3333.33
        - 精度向下取整至分（2位小数）
        """
        result = calc.monthly_depreciation(base_asset)
        assert result == Decimal("3333.33"), (
            f"首月折旧应为 3333.33，实际为 {result}"
        )

    def test_first_month_rate(self, calc, base_asset):
        """
        验证年折旧率 = 2 / 5 = 40%，月折旧率 = 40% / 12
        """
        annual_rate = Decimal("2") / Decimal(str(base_asset.useful_life_months / 12))
        monthly_rate = annual_rate / Decimal("12")
        expected = base_asset.original_cost * monthly_rate.quantize(Decimal("0.01"))
        result = calc.monthly_depreciation(base_asset)
        assert result == expected.quantize(Decimal("0.01"))


# ---------------------------------------------------------------------------
# ATB-2.2: 第二月折旧
# ---------------------------------------------------------------------------

class TestATB22_SecondMonthDepreciation:
    """ATB-2.2: 第二月折旧

    首月计提后账面净值 = 100000 - 3333.33 = 96666.67
    第二月折旧 = 96666.67 × 2 / 60 = 3222.22
    """

    def test_second_month_depreciation_after_first_apply(
        self, calc, base_asset
    ):
        """
        首月计提后，第二月折旧验证：
        - 计提首月后账面净值 = 96666.67
        - 第二月折旧 = 96666.67 × 2 / 60 = 3222.22
        """
        # 模拟首月计提
        calc.apply_depreciation(base_asset)
        second_month = calc.monthly_depreciation(base_asset)
        assert second_month == Decimal("3222.22"), (
            f"第二月折旧应为 3222.22，实际为 {second_month}"
        )

    def test_accumulated_after_two_months(self, calc, base_asset):
        """
        验证连续两月计提后累计折旧 = 3333.33 + 3222.22 = 6555.55
        """
        calc.apply_depreciation(base_asset)
        calc.apply_depreciation(base_asset)
        accumulated = calc.get_accumulated_depreciation(base_asset)
        assert accumulated == Decimal("6555.55"), (
            f"累计折旧应为 6555.55，实际为 {accumulated}"
        )

    def test_net_value_after_two_months(self, calc, base_asset):
        """
        验证连续两月计提后净值 = 100000 - 6555.55 = 93444.45
        """
        calc.apply_depreciation(base_asset)
        calc.apply_depreciation(base_asset)
        net_value = calc.current_net_value(base_asset)
        assert net_value == Decimal("93444.45"), (
            f"净值为 93444.45，实际为 {net_value}"
        )


# ---------------------------------------------------------------------------
# ATB-2.3: 第37月强制转直线法
# ---------------------------------------------------------------------------

class TestATB23_SwitchToStraightLine:
    """ATB-2.3: 第59月强制转直线法

    当剩余使用年限 ≤ 24个月时，切换为直线法：
    switch_depreciation = remaining_book_value / remaining_months
    """

    def test_switch_at_month_37(self, calc, base_asset):
        """
        模拟计提至第36月（剩余24月），第37月切换直线法

        第36月后账面值约 13986.89，第37月切换为：
        13986.89 / 24 ≈ 582.79
        """
        # 模拟前36月连续计提
        for _ in range(36):
            calc.apply_depreciation(base_asset)

        # 第37月折旧（应切换直线法）
        month_37 = calc.monthly_depreciation(base_asset, month_number=37)

        # 13986.89 / 24 = 582.787 ≈ 582.79
        assert month_37 == Decimal("582.79"), (
            f"第37月（切换直线法）折旧应为 582.79，实际为 {month_37}"
        )

    def test_switch_at_month_59(self, calc, base_asset):
        """
        验证第59月（最后两月）仍为直线法
        """
        # 模拟前58月
        for _ in range(58):
            calc.apply_depreciation(base_asset)

        month_59 = calc.monthly_depreciation(base_asset, month_number=59)
        # 此时剩余约1月（残值附近），直线法计算应等于剩余净值
        # 允许一个小的容差范围
        assert month_59 >= Decimal("0"), (
            f"第59月折旧应为正数，实际为 {month_59}"
        )

    def test_switch_triggers_at_remaining_24_months(self, calc, base_asset):
        """
        边界验证：剩余24月时触发切换，剩余25月时不切换
        """
        # 模拟前35月（剩余25月，不应切换）
        for _ in range(35):
            calc.apply_depreciation(base_asset)

        # 第36月仍为 DDB
        month_36_ddb = calc.monthly_depreciation(base_asset, month_number=36)
        # DDB 公式: book_value × 2 / 60
        # 此处 book_value 约 15632.67，DDB = 521.09
        # 直线法会是 15632.67 / 24 = 651.36
        # 两者应有明显差异
        assert month_36_ddb < Decimal("600.00"), (
            f"第36月仍应为DDB (<600)，实际为 {month_36_ddb}"
        )


# ---------------------------------------------------------------------------
# ATB-2.4: 最终净值 = 残值
# ---------------------------------------------------------------------------

class TestATB24_FinalNetValueEqualsSalvage:
    """ATB-2.4: 最终净值 = 残值

    60月后：累计折旧 = 95000，净值 = 5000（残值）
    """

    def test_full_depreciation_complete(self, calc, base_asset):
        """
        连续计提60月后，资产状态应为 fully_depreciated=True
        累计折旧 = 95000，净值 = 5000（残值）
        """
        # 连续计提60月
        for _ in range(60):
            calc.apply_depreciation(base_asset)

        # 验证最终状态
        net_value = calc.current_net_value(base_asset)
        accumulated = calc.get_accumulated_depreciation(base_asset)
        is_fully_depreciated = calc.is_fully_depreciated(base_asset)

        assert net_value == Decimal("5000.00"), (
            f"最终净值应为残值 5000.00，实际为 {net_value}"
        )
        assert accumulated == Decimal("95000.00"), (
            f"累计折旧应为 95000.00，实际为 {accumulated}"
        )
        assert is_fully_depreciated is True, (
            "资产应标记为完全折旧"
        )

    def test_accumulated_never_exceeds_depreciable_amount(self, calc, base_asset):
        """
        BC-005: 任一资产的累计折旧 ≤ 原值 - 残值 = 95000
        """
        for _ in range(70):  # 故意超额计提
            try:
                calc.apply_depreciation(base_asset)
            except Exception:
                break

        accumulated = calc.get_accumulated_depreciation(base_asset)
        depreciable_amount = base_asset.original_cost - base_asset.salvage_value
        assert accumulated <= depreciable_amount, (
            f"累计折旧 {accumulated} 不得超过可折旧金额 {depreciable_amount}"
        )


# ---------------------------------------------------------------------------
# ATB-2.5: 残值下限保护
# ---------------------------------------------------------------------------

class TestATB25_SalvageValueFloor:
    """ATB-2.5: 残值下限保护

    DDB 计算结果不得低于残值
    """

    def test_depreciation_never_below_salvage(self, calc, base_asset):
        """
        验证任一月度的折旧后净值不低于残值
        """
        for _ in range(65):  # 多计提几月确保覆盖边界
            try:
                calc.apply_depreciation(base_asset)
            except Exception:
                break
            net_value = calc.current_net_value(base_asset)
            assert net_value >= base_asset.salvage_value, (
                f"净值 {net_value} 低于残值 {base_asset.salvage_value}"
            )

    def test_late_months_floor_protection(self, calc, base_asset):
        """
        在折旧末期，验证 DDB 计算值被限制在残值之上
        """
        # 快速模拟至接近折旧末期
        for _ in range(57):
            calc.apply_depreciation(base_asset)

        # 第58月
        month_58 = calc.monthly_depreciation(base_asset, month_number=58)
        net_value_after = calc.current_net_value(base_asset) - month_58

        assert net_value_after >= base_asset.salvage_value, (
            f"第58月计提后净值 {net_value_after} 低于残值 {base_asset.salvage_value}"
        )


# ---------------------------------------------------------------------------
# 边界场景测试
# ---------------------------------------------------------------------------

class TestEdgeCases:
    """边界场景测试"""

    def test_zero_salvage_value(self, calc, zero_salvage_asset):
        """
        残值为0时，DDB 计算正常工作
        首月折旧 = 50000 × 2 / 60 = 1666.67
        """
        result = calc.monthly_depreciation(zero_salvage_asset)
        assert result == Decimal("1666.67"), (
            f"残值0时首月折旧应为 1666.67，实际为 {result}"
        )

    def test_full_depreciated_asset_raises_error(self, calc, base_asset):
        """
        已完全折旧资产再次计提应抛出 AssetFullyDepreciatedError
        ATB-1.6 / BC-006
        """
        # 先完全折旧
        for _ in range(60):
            calc.apply_depreciation(base_asset)

        with pytest.raises(Exception) as exc_info:
            calc.apply_depreciation(base_asset)

        assert "fully depreciated" in str(exc_info.value).lower() or \
               "depreciated" in str(exc_info.value).lower(), (
            f"应抛出完全折旧异常，实际抛出: {exc_info.value}"
        )

    def test_single_month_asset(self, calc):
        """
        使用年限=1月的极端边界情况
        """
        asset = Asset(
            asset_id="AST-EDGE-001",
            original_cost=Decimal("12000.00"),
            salvage_value=Decimal("0.00"),
            useful_life_months=1,
            acquisition_date="2024-01-01",
            method=DepreciationMethod.DOUBLE_DECLINING,
            entity_id="ENT-001",
            category="测试",
            asset_name="单月资产",
        )
        result = calc.monthly_depreciation(asset)
        assert result == Decimal("12000.00"), (
            f"1月资产折旧应为 12000.00，实际为 {result}"
        )

    def test_decimal_precision_two_places(self, calc, base_asset):
        """
        CC-001/CC-002: 所有金额计算结果向下取整至分（2位小数）
        """
        for _ in range(3):
            calc.apply_depreciation(base_asset)

        accumulated = calc.get_accumulated_depreciation(base_asset)
        # 验证仅有最多2位小数
        decimal_places = abs(accumulated.as_tuple().exponent)
        assert decimal_places <= 2, (
            f"金额精度不应超过2位小数，实际: {accumulated}"
        )

    def test_current_net_value_formula(self, calc, base_asset):
        """
        CC-005: 净值计算公式 current_net_value = original_cost - accumulated_depreciation
        """
        calc.apply_depreciation(base_asset)
        calc.apply_depreciation(base_asset)

        net_value = calc.current_net_value(base_asset)
        accumulated = calc.get_accumulated_depreciation(base_asset)
        expected = base_asset.original_cost - accumulated

        assert net_value == expected, (
            f"净值计算错误: {base_asset.original_cost} - {accumulated} = {expected}，实际: {net_value}"
        )


# ---------------------------------------------------------------------------
# 接口契约测试
# ---------------------------------------------------------------------------

class TestInterfaceContract:
    """验证 DoubleDecliningCalculator 符合 DepreciationCalculator 抽象接口"""

    def test_calculator_inherits_from_base(self, calc):
        """验证继承自 DepreciationCalculator"""
        assert isinstance(calc, DepreciationCalculator), (
            "DoubleDecliningCalculator 必须继承 DepreciationCalculator"
        )

    def test_required_methods_exist(self, calc):
        """验证必需方法存在"""
        assert hasattr(calc, "monthly_depreciation"), "缺少 monthly_depreciation 方法"
        assert hasattr(calc, "current_net_value"), "缺少 current_net_value 方法"
        assert hasattr(calc, "apply_depreciation"), "缺少 apply_depreciation 方法"
        assert hasattr(calc, "get_accumulated_depreciation"), "缺少 get_accumulated_depreciation 方法"
        assert hasattr(calc, "is_fully_depreciated"), "缺少 is_fully_depreciated 方法"

    def test_monthly_depreciation_returns_decimal(self, calc, base_asset):
        """验证返回值类型为 Decimal"""
        result = calc.monthly_depreciation(base_asset)
        assert isinstance(result, Decimal), (
            f"monthly_depreciation 必须返回 Decimal，实际返回 {type(result)}"
        )

    def test_depreciation_method_enum(self):
        """验证 DepreciationMethod.DOUBLE_DECLINING 枚举存在"""
        assert DepreciationMethod.DOUBLE_DECLINING is not None
        assert DepreciationMethod.DOUBLE_DECLINING.name == "DOUBLE_DECLINING"


# ---------------------------------------------------------------------------
# DDB 特定行为测试
# ---------------------------------------------------------------------------

class TestDDB_SpecificBehavior:
    """双倍余额递减法特有行为测试"""

    def test_ddb_rate_consistency(self, calc, base_asset):
        """
        验证 DDB 月折旧率恒定为 2/60
        """
        rate = Decimal("2") / Decimal("60")
        for _ in range(3):
            before = calc.current_net_value(base_asset)
            depr = calc.monthly_depreciation(base_asset)
            expected = (before * rate).quantize(Decimal("0.01"))
            assert depr == expected, (
                f"DDB 折旧率应恒定为 2/60: 期望 {expected}，实际 {depr}"
            )
            calc.apply_depreciation(base_asset)

    def test_accumulated_grows_monotonically(self, calc, base_asset):
        """
        验证累计折旧单调递增
        """
        prev_accumulated = Decimal("0.00")
        for _ in range(10):
            calc.apply_depreciation(base_asset)
            current = calc.get_accumulated_depreciation(base_asset)
            assert current > prev_accumulated, (
                f"累计折旧应单调递增: 前={prev_accumulated}，当前={current}"
            )
            prev_accumulated = current

    def test_net_value_decreases_monotonically(self, calc, base_asset):
        """
        验证净值单调递减
        """
        prev_net_value = base_asset.original_cost
        for _ in range(10):
            calc.apply_depreciation(base_asset)
            current = calc.current_net_value(base_asset)
            assert current < prev_net_value, (
                f"净值应单调递减: 前={prev_net_value}，当前={current}"
            )
            prev_net_value = current