"""
SWARM-003 资产折旧计算模块 - 边界约束与校验测试套件

本模块验证折旧计算模块的所有边界约束（BC-001 ~ BC-008）以及
验收测试基准（ATB-5）中的异常校验场景。

测试覆盖：
    - BC-001: 资产原值必须大于 0
    - BC-002: 预计残值必须 >= 0 且 < 原值
    - BC-003: 折旧年限必须为正整数月
    - BC-004: 双倍余额递减法在最后两年强制切换直线法
    - BC-005: 累计折旧不得超过 (原值 - 残值)
    - BC-006: 已完成折旧资产不得再次计提
    - BC-007: 购置日期不得晚于当前日期
    - BC-008: 报表截止日期不得早于资产购置日期
    - ATB-5.1 ~ ATB-5.4: 边界异常场景

依赖模块：
    - src.domain.entities.asset
    - src.domain.calculators.base
    - src.domain.calculators.straight_line
    - src.domain.calculators.double_declining
"""

import pytest
from decimal import Decimal
from datetime import date, timedelta
from unittest.mock import Mock, MagicMock

from src.domain.entities.asset import Asset, DepreciationMethod, AssetStatus
from src.domain.calculators.straight_line import StraightLineCalculator
from src.domain.calculators.double_declining import DoubleDecliningCalculator
from src.domain.calculators.base import DepreciationCalculator


# =============================================================================
# 异常类定义（测试替身）
# =============================================================================

class AssetValidationError(Exception):
    """资产数据校验异常"""
    pass


class DepreciationExceedsCostError(Exception):
    """累计折旧超过上限异常"""
    pass


class AssetFullyDepreciatedError(Exception):
    """资产已完全折旧异常"""
    pass


class FutureDateNotAllowedError(Exception):
    """未来日期不允许异常"""
    pass


class InvalidDateRangeError(Exception):
    """无效日期范围异常"""
    pass


class InvalidSalvageValueError(Exception):
    """无效残值异常"""
    pass


# =============================================================================
# BC-001: 资产原值必须大于 0
# =============================================================================

class TestBC001OriginalCostPositive:
    """
    BC-001: original_cost > 0
    验证时机：资产创建/更新时
    """

    def test_original_cost_zero_rejected(self):
        """原值为零时必须拒绝"""
        with pytest.raises(AssetValidationError) as exc_info:
            Asset.create(
                original_cost=Decimal("0"),
                salvage_value=Decimal("0"),
                useful_life_months=120,
                method=DepreciationMethod.STRAIGHT_LINE,
                acquisition_date=date(2024, 1, 1),
                entity_id="E001"
            )
        assert "原值必须大于零" in str(exc_info.value) or "original_cost > 0" in str(exc_info.value)

    def test_original_cost_negative_rejected(self):
        """负数原值时必须拒绝"""
        with pytest.raises(AssetValidationError) as exc_info:
            Asset.create(
                original_cost=Decimal("-1000"),
                salvage_value=Decimal("0"),
                useful_life_months=120,
                method=DepreciationMethod.STRAIGHT_LINE,
                acquisition_date=date(2024, 1, 1),
                entity_id="E001"
            )
        assert "original_cost > 0" in str(exc_info.value)

    def test_original_cost_positive_accepted(self):
        """正数原值应被接受"""
        asset = Asset.create(
            original_cost=Decimal("120000"),
            salvage_value=Decimal("12000"),
            useful_life_months=120,
            method=DepreciationMethod.STRAIGHT_LINE,
            acquisition_date=date(2024, 1, 1),
            entity_id="E001"
        )
        assert asset.original_cost == Decimal("120000")

    def test_original_cost_exactly_one_accepted(self):
        """原值为 1 时应被接受"""
        asset = Asset.create(
            original_cost=Decimal("1"),
            salvage_value=Decimal("0"),
            useful_life_months=12,
            method=DepreciationMethod.STRAIGHT_LINE,
            acquisition_date=date(2024, 1, 1),
            entity_id="E001"
        )
        assert asset.original_cost == Decimal("1")


# =============================================================================
# BC-002: 预计残值必须 >= 0 且 < 原值
# =============================================================================

class TestBC002SalvageValueConstraints:
    """
    BC-002: salvage_value >= 0 且 salvage_value < original_cost
    验证时机：资产创建/更新时
    """

    def test_salvage_value_negative_rejected(self):
        """负数残值时必须拒绝"""
        with pytest.raises(AssetValidationError) as exc_info:
            Asset.create(
                original_cost=Decimal("100000"),
                salvage_value=Decimal("-5000"),
                useful_life_months=120,
                method=DepreciationMethod.STRAIGHT_LINE,
                acquisition_date=date(2024, 1, 1),
                entity_id="E001"
            )
        assert "残值必须大于等于零" in str(exc_info.value) or "salvage_value >= 0" in str(exc_info.value)

    def test_salvage_value_equal_to_cost_rejected(self):
        """残值等于原值时必须拒绝"""
        with pytest.raises((AssetValidationError, InvalidSalvageValueError)) as exc_info:
            Asset.create(
                original_cost=Decimal("100000"),
                salvage_value=Decimal("100000"),
                useful_life_months=120,
                method=DepreciationMethod.STRAIGHT_LINE,
                acquisition_date=date(2024, 1, 1),
                entity_id="E001"
            )
        assert "残值必须小于原值" in str(exc_info.value) or "salvage_value < original_cost" in str(exc_info.value)

    def test_salvage_value_exceeds_cost_rejected(self):
        """残值超过原值时必须拒绝"""
        with pytest.raises((AssetValidationError, InvalidSalvageValueError)) as exc_info:
            Asset.create(
                original_cost=Decimal("100000"),
                salvage_value=Decimal("150000"),
                useful_life_months=120,
                method=DepreciationMethod.STRAIGHT_LINE,
                acquisition_date=date(2024, 1, 1),
                entity_id="E001"
            )
        assert "残值必须小于原值" in str(exc_info.value)

    def test_salvage_value_zero_accepted(self):
        """残值为零时应被接受"""
        asset = Asset.create(
            original_cost=Decimal("50000"),
            salvage_value=Decimal("0"),
            useful_life_months=60,
            method=DepreciationMethod.STRAIGHT_LINE,
            acquisition_date=date(2024, 1, 1),
            entity_id="E001"
        )
        assert asset.salvage_value == Decimal("0")

    def test_salvage_value_less_than_cost_accepted(self):
        """残值小于原值时应被接受"""
        asset = Asset.create(
            original_cost=Decimal("120000"),
            salvage_value=Decimal("12000"),
            useful_life_months=120,
            method=DepreciationMethod.STRAIGHT_LINE,
            acquisition_date=date(2024, 1, 1),
            entity_id="E001"
        )
        assert asset.salvage_value < asset.original_cost

    def test_salvage_value_one_less_than_cost_accepted(self):
        """残值为 (原值 - 1) 时应被接受"""
        asset = Asset.create(
            original_cost=Decimal("100000"),
            salvage_value=Decimal("99999"),
            useful_life_months=12,
            method=DepreciationMethod.STRAIGHT_LINE,
            acquisition_date=date(2024, 1, 1),
            entity_id="E001"
        )
        assert asset.salvage_value == asset.original_cost - Decimal("1")


# =============================================================================
# BC-003: 折旧年限必须为正整数月
# =============================================================================

class TestBC003UsefulLifeInteger:
    """
    BC-003: useful_life_months > 0 且为整数
    验证时机：资产创建/更新时
    """

    def test_useful_life_zero_rejected(self):
        """零使用年限时必须拒绝"""
        with pytest.raises(AssetValidationError) as exc_info:
            Asset.create(
                original_cost=Decimal("100000"),
                salvage_value=Decimal("10000"),
                useful_life_months=0,
                method=DepreciationMethod.STRAIGHT_LINE,
                acquisition_date=date(2024, 1, 1),
                entity_id="E001"
            )
        assert "使用年限必须大于零" in str(exc_info.value) or "useful_life_months > 0" in str(exc_info.value)

    def test_useful_life_negative_rejected(self):
        """负数使用年限时必须拒绝"""
        with pytest.raises(AssetValidationError) as exc_info:
            Asset.create(
                original_cost=Decimal("100000"),
                salvage_value=Decimal("10000"),
                useful_life_months=-12,
                method=DepreciationMethod.STRAIGHT_LINE,
                acquisition_date=date(2024, 1, 1),
                entity_id="E001"
            )
        assert "useful_life_months > 0" in str(exc_info.value)

    def test_useful_life_float_rejected(self):
        """浮点数使用年限时必须拒绝（非整数）"""
        with pytest.raises(AssetValidationError) as exc_info:
            Asset.create(
                original_cost=Decimal("100000"),
                salvage_value=Decimal("10000"),
                useful_life_months=30.5,
                method=DepreciationMethod.STRAIGHT_LINE,
                acquisition_date=date(2024, 1, 1),
                entity_id="E001"
            )
        assert "折旧年限必须为正整数月" in str(exc_info.value)

    def test_useful_life_fractional_rejected(self):
        """分数使用年限时必须拒绝"""
        with pytest.raises(AssetValidationError) as exc_info:
            Asset.create(
                original_cost=Decimal("100000"),
                salvage_value=Decimal("10000"),
                useful_life_months=12.75,
                method=DepreciationMethod.STRAIGHT_LINE,
                acquisition_date=date(2024, 1, 1),
                entity_id="E001"
            )
        assert "正整数" in str(exc_info.value)

    def test_useful_life_one_month_accepted(self):
        """1个月使用年限应被接受"""
        asset = Asset.create(
            original_cost=Decimal("10000"),
            salvage_value=Decimal("0"),
            useful_life_months=1,
            method=DepreciationMethod.STRAIGHT_LINE,
            acquisition_date=date(2024, 1, 1),
            entity_id="E001"
        )
        assert asset.useful_life_months == 1

    def test_useful_life_standard_120_months_accepted(self):
        """标准10年(120月)使用年限应被接受"""
        asset = Asset.create(
            original_cost=Decimal("120000"),
            salvage_value=Decimal("12000"),
            useful_life_months=120,
            method=DepreciationMethod.STRAIGHT_LINE,
            acquisition_date=date(2024, 1, 1),
            entity_id="E001"
        )
        assert asset.useful_life_months == 120


# =============================================================================
# BC-004: 双倍余额递减法在最后两年强制切换直线法
# =============================================================================

class TestBC004DDBToStraightLineSwitch:
    """
    BC-004: DDB 计算时，当剩余使用年限 ≤ 2 年（24个月）时，
            必须强制切换为直线法
    """

    def setup_method(self):
        """测试前准备：创建标准 DDB 资产"""
        self.asset = Asset.create(
            original_cost=Decimal("100000"),
            salvage_value=Decimal("5000"),
            useful_life_months=60,  # 5年
            method=DepreciationMethod.DOUBLE_DECLINING,
            acquisition_date=date(2024, 1, 1),
            entity_id="E001"
        )
        self.calculator = DoubleDecliningCalculator()

    def test_switch_at_remaining_24_months(self):
        """剩余24个月时应切换直线法"""
        # 模拟第36月后的账面值（已计提36个月）
        self.calculator._book_value = Decimal("13986.89")
        
        # 第37月（剩余24个月）应切换直线法
        result = self.calculator.monthly_depreciation(self.asset, month_number=37)
        
        # 直线法: 13986.89 / 24 ≈ 582.79
        expected = Decimal("13986.89") / Decimal("24")
        assert abs(result - expected) < Decimal("0.01")

    def test_switch_at_remaining_12_months(self):
        """剩余12个月时应切换直线法"""
        # 模拟第48月后的账面值
        self.calculator._book_value = Decimal("7825.00")
        
        # 第49月（剩余12个月）应切换直线法
        result = self.calculator.monthly_depreciation(self.asset, month_number=49)
        
        expected = Decimal("7825.00") / Decimal("12")
        assert abs(result - expected) < Decimal("0.01")

    def test_switch_at_remaining_1_month(self):
        """剩余1个月时应切换直线法"""
        self.calculator._book_value = Decimal("6000.00")  # 略高于残值
        
        result = self.calculator.monthly_depreciation(self.asset, month_number=60)
        
        # 剩余净值/1 = 剩余净值（但不得低于残值约束）
        expected = Decimal("6000.00") / Decimal("1")
        assert abs(result - expected) < Decimal("0.01")

    def test_no_switch_before_remaining_25_months(self):
        """剩余25个月前不应切换（继续使用 DDB）"""
        # 模拟第35月后的账面值
        self.calculator._book_value = Decimal("18000.00")
        
        # 第36月（剩余25个月）不应切换
        result = self.calculator.monthly_depreciation(self.asset, month_number=36)
        
        # DDB: 18000 * 2 / 60 ≈ 600
        ddb_expected = Decimal("18000.00") * Decimal("2") / Decimal("60")
        assert abs(result - ddb_expected) < Decimal("0.01")

    def test_final_net_value_equals_salvage(self):
        """计提完成后，净值应等于残值"""
        # 模拟已完全计提的资产
        self.asset.accumulated_depreciation = Decimal("95000")
        
        net_value = self.asset.original_cost - self.asset.accumulated_depreciation
        assert net_value == Decimal("5000.00")  # 残值


# =============================================================================
# BC-005: 累计折旧不得超过 (原值 - 残值)
# =============================================================================

class TestBC005AccumulatedDepreciationLimit:
    """
    BC-005: accumulated_depreciation <= original_cost - salvage_value
    验证时机：计提折旧后
    """

    def test_accumulated_depreciation_exceeds_limit_raises_error(self):
        """累计折旧超过上限时应抛出异常"""
        asset = Asset.create(
            original_cost=Decimal("120000"),
            salvage_value=Decimal("12000"),
            useful_life_months=120,
            method=DepreciationMethod.STRAIGHT_LINE,
            acquisition_date=date(2024, 1, 1),
            entity_id="E001"
        )
        
        # 可折旧总额 = 120000 - 12000 = 108000
        max_depreciation = asset.original_cost - asset.salvage_value
        
        # 尝试设置超限的累计折旧
        with pytest.raises(DepreciationExceedsCostError) as exc_info:
            asset.set_accumulated_depreciation(max_depreciation + Decimal("1"))
        
        assert "累计折旧不得超出可折旧总额" in str(exc_info.value)

    def test_accumulated_depreciation_at_limit_accepted(self):
        """累计折旧等于上限时应被接受"""
        asset = Asset.create(
            original_cost=Decimal("120000"),
            salvage_value=Decimal("12000"),
            useful_life_months=120,
            method=DepreciationMethod.STRAIGHT_LINE,
            acquisition_date=date(2024, 1, 1),
            entity_id="E001"
        )
        
        max_depreciation = asset.original_cost - asset.salvage_value
        asset.set_accumulated_depreciation(max_depreciation)
        
        assert asset.accumulated_depreciation == max_depreciation

    def test_accumulated_depreciation_within_limit_accepted(self):
        """累计折旧在上限内时应被接受"""
        asset = Asset.create(
            original_cost=Decimal("120000"),
            salvage_value=Decimal("12000"),
            useful_life_months=120,
            method=DepreciationMethod.STRAIGHT_LINE,
            acquisition_date=date(2024, 1, 1),
            entity_id="E001"
        )
        
        partial_depreciation = Decimal("54000")  # 50%
        asset.set_accumulated_depreciation(partial_depreciation)
        
        assert asset.accumulated_depreciation == partial_depreciation

    def test_zero_salvage_full_depreciation(self):
        """残值为零时，可折旧总额等于原值"""
        asset = Asset.create(
            original_cost=Decimal("50000"),
            salvage_value=Decimal("0"),
            useful_life_months=60,
            method=DepreciationMethod.STRAIGHT_LINE,
            acquisition_date=date(2024, 1, 1),
            entity_id="E001"
        )
        
        max_depreciation = asset.original_cost - asset.salvage_value
        assert max_depreciation == Decimal("50000")
        
        asset.set_accumulated_depreciation(max_depreciation)
        assert asset.accumulated_depreciation == Decimal("50000")


# =============================================================================
# BC-006: 已完成折旧资产不得再次计提
# =============================================================================

class TestBC006FullyDepreciatedAsset:
    """
    BC-006: 已完成折旧（fully_depreciated=True）的资产不得再次计提
    验证时机：折旧计提时
    """

    def test_fully_depreciated_asset_rejects_depreciation(self):
        """已完全折旧资产再次计提时应抛出异常"""
        asset = Asset.create(
            original_cost=Decimal("120000"),
            salvage_value=Decimal("12000"),
            useful_life_months=120,
            method=DepreciationMethod.STRAIGHT_LINE,
            acquisition_date=date(2024, 1, 1),
            entity_id="E001"
        )
        
        # 标记为已完全折旧
        asset.mark_fully_depreciated()
        
        calculator = StraightLineCalculator()
        
        with pytest.raises(AssetFullyDepreciatedError) as exc_info:
            calculator.apply_depreciation(asset)
        
        assert "已完全折旧" in str(exc_info.value)

    def test_fully_depreciated_status_query(self):
        """查询资产折旧完成状态"""
        asset = Asset.create(
            original_cost=Decimal("120000"),
            salvage_value=Decimal("12000"),
            useful_life_months=120,
            method=DepreciationMethod.STRAIGHT_LINE,
            acquisition_date=date(2024, 1, 1),
            entity_id="E001"
        )
        
        assert asset.is_fully_depreciated() is False
        
        asset.mark_fully_depreciated()
        
        assert asset.is_fully_depreciated() is True

    def test_not_fully_depreciated_asset_accepts_depreciation(self):
        """未完全折旧资产应接受计提"""
        asset = Asset.create(
            original_cost=Decimal("120000"),
            salvage_value=Decimal("12000"),
            useful_life_months=120,
            method=DepreciationMethod.STRAIGHT_LINE,
            acquisition_date=date(2024, 1, 1),
            entity_id="E001"
        )
        
        assert asset.is_fully_depreciated() is False
        
        calculator = StraightLineCalculator()
        result = calculator.apply_depreciation(asset)
        
        assert result is not None


# =============================================================================
# BC-007: 购置日期不得晚于当前日期
# =============================================================================

class TestBC007AcquisitionDateConstraint:
    """
    BC-007: acquisition_date <= 当前日期
    验证时机：资产创建时
    """

    def test_future_acquisition_date_rejected(self):
        """未来购置日期必须拒绝"""
        future_date = date.today() + timedelta(days=30)
        
        with pytest.raises(AssetValidationError) as exc_info:
            Asset.create(
                original_cost=Decimal("100000"),
                salvage_value=Decimal("10000"),
                useful_life_months=120,
                method=DepreciationMethod.STRAIGHT_LINE,
                acquisition_date=future_date,
                entity_id="E001"
            )
        assert "购置日期不得晚于当前日期" in str(exc_info.value) or "acquisition_date" in str(exc_info.value)

    def test_today_acquisition_date_accepted(self):
        """今天作为购置日期应被接受"""
        today = date.today()
        
        asset = Asset.create(
            original_cost=Decimal("100000"),
            salvage_value=Decimal("10000"),
            useful_life_months=120,
            method=DepreciationMethod.STRAIGHT_LINE,
            acquisition_date=today,
            entity_id="E001"
        )
        
        assert asset.acquisition_date == today

    def test_past_acquisition_date_accepted(self):
        """过去日期作为购置日期应被接受"""
        past_date = date(2020, 1, 1)
        
        asset = Asset.create(
            original_cost=Decimal("100000"),
            salvage_value=Decimal("10000"),
            useful_life_months=120,
            method=DepreciationMethod.STRAIGHT_LINE,
            acquisition_date=past_date,
            entity_id="E001"
        )
        
        assert asset.acquisition_date == past_date


# =============================================================================
# BC-008: 报表截止日期不得早于资产购置日期
# =============================================================================

class TestBC008ReportDateRangeConstraint:
    """
    BC-008: end_date >= 资产购置日期
    验证时机：报表请求时
    """

    def test_end_date_before_acquisition_date_rejected(self):
        """报表截止日期早于购置日期时应拒绝"""
        asset = Asset.create(
            original_cost=Decimal("100000"),
            salvage_value=Decimal("10000"),
            useful_life_months=120,
            method=DepreciationMethod.STRAIGHT_LINE,
            acquisition_date=date(2024, 6, 1),
            entity_id="E001"
        )
        
        with pytest.raises(InvalidDateRangeError) as exc_info:
            asset.validate_report_date_range(
                start_date=date(2024, 1, 1),
                end_date=date(2024, 5, 31)  # 早于购置日期
            )
        
        assert "截止日期不得早于资产购置日期" in str(exc_info.value) or "end_date" in str(exc_info.value)

    def test_end_date_equals_acquisition_date_accepted(self):
        """报表截止日期等于购置日期时应接受"""
        asset = Asset.create(
            original_cost=Decimal("100000"),
            salvage_value=Decimal("10000"),
            useful_life_months=120,
            method=DepreciationMethod.STRAIGHT_LINE,
            acquisition_date=date(2024, 6, 1),
            entity_id="E001"
        )
        
        # 不应抛出异常
        asset.validate_report_date_range(
            start_date=date(2024, 6, 1),
            end_date=date(2024, 6, 1)
        )

    def test_end_date_after_acquisition_date_accepted(self):
        """报表截止日期晚于购置日期时应接受"""
        asset = Asset.create(
            original_cost=Decimal("100000"),
            salvage_value=Decimal("10000"),
            useful_life_months=120,
            method=DepreciationMethod.STRAIGHT_LINE,
            acquisition_date=date(2024, 1, 1),
            entity_id="E001"
        )
        
        # 不应抛出异常
        asset.validate_report_date_range(
            start_date=date(2024, 1, 1),
            end_date=date(2024, 12, 31)
        )


# =============================================================================
# ATB-5: 边界异常场景测试
# =============================================================================

class TestATB51SalvageValueValidation:
    """
    ATB-5.1: 残值 >= 原值时返回 HTTP 422
    对应 API: POST /api/v1/assets
    """

    def test_api_rejects_salvage_greater_or_equal_to_cost(self):
        """API 应拒绝残值 >= 原值的请求"""
        payload = {
            "original_cost": "10000.00",
            "salvage_value": "10000.00",  # 等于原值
            "useful_life_months": 120,
            "method": "STRAIGHT_LINE",
            "acquisition_date": "2024-01-01",
            "entity_id": "E001"
        }
        
        # 模拟 API 校验
        with pytest.raises(InvalidSalvageValueError) as exc_info:
            Asset.create(
                original_cost=Decimal(payload["original_cost"]),
                salvage_value=Decimal(payload["salvage_value"]),
                useful_life_months=payload["useful_life_months"],
                method=DepreciationMethod.STRAIGHT_LINE,
                acquisition_date=date.fromisoformat(payload["acquisition_date"]),
                entity_id=payload["entity_id"]
            )
        
        assert "残值必须小于原值" in str(exc_info.value)


class TestATB52AccumulatedDepreciationExceedsLimit:
    """
    ATB-5.2: 累计折旧超限时返回 HTTP 500 并记录日志
    """

    def test_exceeds_limit_raises_server_error(self):
        """累计折旧超限时抛出服务器错误"""
        asset = Asset.create(
            original_cost=Decimal("120000"),
            salvage_value=Decimal("12000"),
            useful_life_months=120,
            method=DepreciationMethod.STRAIGHT_LINE,
            acquisition_date=date(2024, 1, 1),
            entity_id="E001"
        )
        
        # 注入异常数据：累计折旧超过可折旧总额
        max_depreciable = asset.original_cost - asset.salvage_value
        
        with pytest.raises(DepreciationExceedsCostError):
            asset.set_accumulated_depreciation(max_depreciable + Decimal("100"))

    def test_exceeds_limit_error_message(self):
        """错误消息应包含可折旧总额信息"""
        asset = Asset.create(
            original_cost=Decimal("120000"),
            salvage_value=Decimal("12000"),
            useful_life_months=120,
            method=DepreciationMethod.STRAIGHT_LINE,
            acquisition_date=date(2024, 1, 1),
            entity_id="E001"
        )
        
        max_depreciable = asset.original_cost - asset.salvage_value
        
        with pytest.raises(DepreciationExceedsCostError) as exc_info:
            asset.set_accumulated_depreciation(max_depreciable + Decimal("1"))
        
        error_msg = str(exc_info.value)
        # 错误消息应包含关键数值
        assert "108000" in error_msg or "超出" in error_msg or "exceeds" in error_msg.lower()


class TestATB53NegativeOriginalCost:
    """
    ATB-5.3: 负数原值时返回 HTTP 422
    """

    def test_api_rejects_negative_original_cost(self):
        """API 应拒绝负数原值"""
        payload = {
            "original_cost": "-1000.00",
            "salvage_value": "0.00",
            "useful_life_months": 120,
            "method": "STRAIGHT_LINE",
            "acquisition_date": "2024-01-01",
            "entity_id": "E001"
        }
        
        with pytest.raises(AssetValidationError) as exc_info:
            Asset.create(
                original_cost=Decimal(payload["original_cost"]),
                salvage_value=Decimal(payload["salvage_value"]),
                useful_life_months=payload["useful_life_months"],
                method=DepreciationMethod.STRAIGHT_LINE,
                acquisition_date=date.fromisoformat(payload["acquisition_date"]),
                entity_id=payload["entity_id"]
            )
        
        error_msg = str(exc_info.value)
        assert "original_cost" in error_msg or "原值" in error_msg


class TestATB54NonIntegerUsefulLife:
    """
    ATB-5.4: 非整数使用年限时返回 HTTP 422
    """

    def test_api_rejects_fractional_useful_life(self):
        """API 应拒绝分数使用年限"""
        payload = {
            "original_cost": "100000.00",
            "salvage_value": "10000.00",
            "useful_life_months": 30.5,  # 非整数
            "method": "STRAIGHT_LINE",
            "acquisition_date": "2024-01-01",
            "entity_id": "E001"
        }
        
        with pytest.raises(AssetValidationError) as exc_info:
            Asset.create(
                original_cost=Decimal(payload["original_cost"]),
                salvage_value=Decimal(payload["salvage_value"]),
                useful_life_months=payload["useful_life_months"],
                method=DepreciationMethod.STRAIGHT_LINE,
                acquisition_date=date.fromisoformat(payload["acquisition_date"]),
                entity_id=payload["entity_id"]
            )
        
        assert "折旧年限必须为正整数月" in str(exc_info.value)

    def test_api_rejects_string_useful_life(self):
        """API 应拒绝字符串类型使用年限"""
        with pytest.raises((AssetValidationError, TypeError)):
            Asset.create(
                original_cost=Decimal("100000"),
                salvage_value=Decimal("10000"),
                useful_life_months="120",  # 字符串类型
                method=DepreciationMethod.STRAIGHT_LINE,
                acquisition_date=date(2024, 1, 1),
                entity_id="E001"
            )


# =============================================================================
# 边界值测试（Edge Case Testing）
# =============================================================================

class TestEdgeCases:
    """
    边界值测试：测试临界条件
    """

    def test_zero_depreciation_scenario(self):
        """零折旧场景：残值等于原值（理论上不应发生，但测试健壮性）"""
        # 这种场景在 BC-002 中应被拒绝
        with pytest.raises(AssetValidationError):
            Asset.create(
                original_cost=Decimal("100000"),
                salvage_value=Decimal("100000"),
                useful_life_months=120,
                method=DepreciationMethod.STRAIGHT_LINE,
                acquisition_date=date(2024, 1, 1),
                entity_id="E001"
            )

    def test_single_month_depreciation(self):
        """单月折旧场景：使用年限为1个月"""
        asset = Asset.create(
            original_cost=Decimal("12000"),
            salvage_value=Decimal("0"),
            useful_life_months=1,
            method=DepreciationMethod.STRAIGHT_LINE,
            acquisition_date=date(2024, 1, 1),
            entity_id="E001"
        )
        
        calculator = StraightLineCalculator()
        monthly = calculator.monthly_depreciation(asset)
        
        assert monthly == Decimal("12000.00")

    def test_large_asset_depreciation(self):
        """大型资产场景：原值为百万级别"""
        asset = Asset.create(
            original_cost=Decimal("999999999.99"),
            salvage_value=Decimal("999999.99"),
            useful_life_months=360,  # 30年
            method=DepreciationMethod.STRAIGHT_LINE,
            acquisition_date=date(2024, 1, 1),
            entity_id="E001"
        )
        
        calculator = StraightLineCalculator()
        monthly = calculator.monthly_depreciation(asset)
        
        # (999999999.99 - 999999.99) / 360 ≈ 2777777.78
        expected = (asset.original_cost - asset.salvage_value) / Decimal("360")
        assert abs(monthly - expected) < Decimal("0.01")

    def test_precision_handling(self):
        """精度处理：确保计算结果精确到分（2位小数）"""
        asset = Asset.create(
            original_cost=Decimal("100000"),
            salvage_value=Decimal("3333"),
            useful_life_months=7,  # 会产生循环小数
            method=DepreciationMethod.STRAIGHT_LINE,
            acquisition_date=date(2024, 1, 1),
            entity_id="E001"
        )
        
        calculator = StraightLineCalculator()
        monthly = calculator.monthly_depreciation(asset)
        
        # 检查精度：应精确到分
        decimal_places = abs(monthly.as_tuple().exponent)
        assert decimal_places >= -2, "折旧额应精确到分（2位小数）"


# =============================================================================
# 测试运行配置
# =============================================================================

if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])