"""
SWARM-003 资产折旧计算模块 - 单元测试

Iteration 2: 资产净值计算引擎、月折旧计划生成器、折旧报表生成器

测试覆盖范围:
- ATB-1: 资产净值计算验证
- ATB-2: 月折旧计划生成验证
- ATB-3: 折旧报表生成验证
- ATB-4: 边界条件与异常处理验证
"""

import pytest
from decimal import Decimal
from datetime import date, timedelta
from typing import List

from src.swarm.depreciation.domain.entities import Asset, DepreciationMethod
from src.swarm.depreciation.domain.schemas import (
    DepreciationResult,
    MonthlyDepreciationEntry,
    DepreciationReport,
    ReportSummary
)
from src.swarm.depreciation.engine.factory import DepreciationCalculatorFactory
from src.swarm.depreciation.services.report_service import DepreciationReportService


class TestNetValueCalculation:
    """
    ATB-1: 资产净值计算验证
    
    验证 DepreciationService.get_current_net_value() 的计算准确性
    """
    
    def test_straight_line_net_value_at_year_end(self):
        """
        场景: 直线法资产，购置满1年时的净值计算
        输入: 原值=100000, 年限=10, 残值=5000, 购置日=2023-01-01, 计算日=2024-01-01
        期待: 年折旧额 = (100000-5000)/10 = 9500, 净值 = 100000-9500 = 90500
        """
        asset = Asset(
            asset_id="AST-001",
            original_value=Decimal("100000.0000"),
            useful_life_years=10,
            residual_value=Decimal("5000.0000"),
            purchase_date=date(2023, 1, 1),
            depreciation_method=DepreciationMethod.STRAIGHT_LINE
        )
        
        calculator = DepreciationCalculatorFactory.create_calculator(asset)
        result = calculator.calculate_net_value(as_of_date=date(2024, 1, 1))
        
        assert result.current_net_value == Decimal("90500.0000")
        assert result.accumulated_depreciation == Decimal("9500.0000")
        assert result.period_depreciation == Decimal("9500.0000")
    
    def test_straight_line_net_value_partial_year(self):
        """
        场景: 直线法资产，购置6个月后的净值计算
        输入: 原值=60000, 年限=5, 残值=6000, 购置日=2024-07-01, 计算日=2024-12-31
        期待: 月折旧额 = (60000-6000)/(5*12) = 900, 6个月折旧 = 5400, 净值 = 54600
        """
        asset = Asset(
            asset_id="AST-002",
            original_value=Decimal("60000.0000"),
            useful_life_years=5,
            residual_value=Decimal("6000.0000"),
            purchase_date=date(2024, 7, 1),
            depreciation_method=DepreciationMethod.STRAIGHT_LINE
        )
        
        calculator = DepreciationCalculatorFactory.create_calculator(asset)
        result = calculator.calculate_net_value(as_of_date=date(2024, 12, 31))
        
        assert result.current_net_value == Decimal("54600.0000")
        assert result.accumulated_depreciation == Decimal("5400.0000")
    
    def test_double_declining_net_value_at_partial_year(self):
        """
        场景: 双倍余额递减法，购置6个月后的净值计算
        输入: 原值=60000, 年限=5, 购置日=2023-07-01, 计算日=2024-01-01
        期待: 首年折旧率=40%, 6个月折旧=60000*40%/2 = 12000, 净值=48000
        """
        asset = Asset(
            asset_id="AST-003",
            original_value=Decimal("60000.0000"),
            useful_life_years=5,
            residual_value=Decimal("0.0000"),
            purchase_date=date(2023, 7, 1),
            depreciation_method=DepreciationMethod.DOUBLE_DECLINING_BALANCE
        )
        
        calculator = DepreciationCalculatorFactory.create_calculator(asset)
        result = calculator.calculate_net_value(as_of_date=date(2024, 1, 1))
        
        assert result.current_net_value == Decimal("48000.0000")
    
    def test_double_declining_switch_to_straight_line(self):
        """
        场景: 双倍余额递减法转入年限末尾时，自动切换为直线法
        输入: 原值=100000, 年限=5, 购置日=2020-01-01
        期待: 第4年起切换为直线法，确保折旧完毕
        """
        asset = Asset(
            asset_id="AST-004",
            original_value=Decimal("100000.0000"),
            useful_life_years=5,
            residual_value=Decimal("0.0000"),
            purchase_date=date(2020, 1, 1),
            depreciation_method=DepreciationMethod.DOUBLE_DECLINING_BALANCE
        )
        
        calculator = DepreciationCalculatorFactory.create_calculator(asset)
        
        # 第3年末净值验证 (40% * 40% * 40% = 21,600)
        year_3_result = calculator.calculate_net_value(as_of_date=date(2023, 1, 1))
        assert year_3_result.current_net_value == Decimal("21600.0000")
        
        # 第4年起应切换为直线法，最后两年应折旧完毕
        year_5_result = calculator.calculate_net_value(as_of_date=date(2025, 1, 1))
        assert year_5_result.current_net_value == Decimal("0.0000")
    
    def test_net_value_never_negative(self):
        """
        场景: 计算日超过使用年限后，净值不得为负
        期待: 净值最低为残值
        """
        asset = Asset(
            asset_id="AST-005",
            original_value=Decimal("100000.0000"),
            useful_life_years=5,
            residual_value=Decimal("10000.0000"),
            purchase_date=date(2020, 1, 1),
            depreciation_method=DepreciationMethod.STRAIGHT_LINE
        )
        
        calculator = DepreciationCalculatorFactory.create_calculator(asset)
        result = calculator.calculate_net_value(as_of_date=date(2030, 1, 1))
        
        assert result.current_net_value == Decimal("10000.0000")
        assert result.current_net_value >= asset.residual_value
    
    def test_zero_residual_value_full_depreciation(self):
        """
        场景: 残值为零时，净值最终归零
        """
        asset = Asset(
            asset_id="AST-006",
            original_value=Decimal("100000.0000"),
            useful_life_years=10,
            residual_value=Decimal("0.0000"),
            purchase_date=date(2015, 1, 1),
            depreciation_method=DepreciationMethod.STRAIGHT_LINE
        )
        
        calculator = DepreciationCalculatorFactory.create_calculator(asset)
        result = calculator.calculate_net_value(as_of_date=date(2025, 1, 1))
        
        assert result.current_net_value == Decimal("0.0000")
        assert result.accumulated_depreciation == Decimal("100000.0000")
    
    def test_first_day_purchase_no_depreciation(self):
        """
        场景: 购置当日不计折旧
        """
        asset = Asset(
            asset_id="AST-007",
            original_value=Decimal("50000.0000"),
            useful_life_years=5,
            residual_value=Decimal("5000.0000"),
            purchase_date=date(2024, 1, 1),
            depreciation_method=DepreciationMethod.STRAIGHT_LINE
        )
        
        calculator = DepreciationCalculatorFactory.create_calculator(asset)
        result = calculator.calculate_net_value(as_of_date=date(2024, 1, 1))
        
        assert result.current_net_value == Decimal("50000.0000")
        assert result.accumulated_depreciation == Decimal("0.0000")


class TestMonthlyDepreciationSchedule:
    """
    ATB-2: 月折旧计划生成验证
    
    验证 MonthlyDepreciationScheduleGenerator.generate_monthly_schedule() 的完整性
    """
    
    def test_schedule_completeness(self):
        """
        场景: 5年期直线法资产，折旧计划条数验证
        期待: 应生成 60 个月 (5*12) 条记录
        """
        asset = Asset(
            asset_id="AST-101",
            original_value=Decimal("50000.0000"),
            useful_life_years=5,
            residual_value=Decimal("5000.0000"),
            purchase_date=date(2024, 1, 1),
            depreciation_method=DepreciationMethod.STRAIGHT_LINE
        )
        
        calculator = DepreciationCalculatorFactory.create_calculator(asset)
        schedule = calculator.generate_monthly_schedule()
        
        assert len(schedule) == 60
        assert schedule[0].period == "2024-01"
        assert schedule[59].period == "2028-12"
    
    def test_monthly_amount_accuracy_straight_line(self):
        """
        场景: 直线法月折旧额精度验证
        期待: 月折旧额 = (50000-5000)/(5*12) = 750.00
        """
        asset = Asset(
            asset_id="AST-102",
            original_value=Decimal("50000.0000"),
            useful_life_years=5,
            residual_value=Decimal("5000.0000"),
            purchase_date=date(2024, 1, 1),
            depreciation_method=DepreciationMethod.STRAIGHT_LINE
        )
        
        calculator = DepreciationCalculatorFactory.create_calculator(asset)
        schedule = calculator.generate_monthly_schedule()
        
        for entry in schedule:
            assert entry.monthly_depreciation == Decimal("750.0000")
    
    def test_monthly_amount_accuracy_double_declining(self):
        """
        场景: 双倍余额递减法月折旧额验证
        期待: 首年各月折旧额一致，第二年起可能不同
        """
        asset = Asset(
            asset_id="AST-103",
            original_value=Decimal("120000.0000"),
            useful_life_years=5,
            residual_value=Decimal("0.0000"),
            purchase_date=date(2024, 1, 1),
            depreciation_method=DepreciationMethod.DOUBLE_DECLINING_BALANCE
        )
        
        calculator = DepreciationCalculatorFactory.create_calculator(asset)
        schedule = calculator.generate_monthly_schedule()
        
        # 首年12个月，月折旧额应为 120000*40%/12 = 4000
        for entry in schedule[:12]:
            assert entry.monthly_depreciation == Decimal("4000.0000")
    
    def test_schedule_accumulated_depreciation_running_total(self):
        """
        场景: 累计折旧额递增验证
        期待: 每月累计折旧 = 上月累计 + 当月折旧
        """
        asset = Asset(
            asset_id="AST-104",
            original_value=Decimal("36000.0000"),
            useful_life_years=3,
            residual_value=Decimal("0.0000"),
            purchase_date=date(2024, 1, 1),
            depreciation_method=DepreciationMethod.STRAIGHT_LINE
        )
        
        calculator = DepreciationCalculatorFactory.create_calculator(asset)
        schedule = calculator.generate_monthly_schedule()
        
        for i in range(1, len(schedule)):
            expected_accumulated = schedule[i-1].accumulated_depreciation + schedule[i].monthly_depreciation
            assert schedule[i].accumulated_depreciation == expected_accumulated
    
    def test_schedule_final_period_net_value_equals_residual(self):
        """
        场景: 折旧计划最后一期，净值应等于残值
        """
        asset = Asset(
            asset_id="AST-105",
            original_value=Decimal("100000.0000"),
            useful_life_years=5,
            residual_value=Decimal("10000.0000"),
            purchase_date=date(2024, 1, 1),
            depreciation_method=DepreciationMethod.STRAIGHT_LINE
        )
        
        calculator = DepreciationCalculatorFactory.create_calculator(asset)
        schedule = calculator.generate_monthly_schedule()
        
        final_entry = schedule[-1]
        assert final_entry.ending_net_value == Decimal("10000.0000")
    
    def test_double_declining_switch_point(self):
        """
        场景: 双倍余额递减法转为直线法的临界点验证
        说明: 当直线法折旧额 > 双倍余额递减法时，应自动切换
        """
        asset = Asset(
            asset_id="AST-106",
            original_value=Decimal("100000.0000"),
            useful_life_years=5,
            residual_value=Decimal("5000.0000"),
            purchase_date=date(2024, 1, 1),
            depreciation_method=DepreciationMethod.DOUBLE_DECLINING_BALANCE
        )
        
        calculator = DepreciationCalculatorFactory.create_calculator(asset)
        schedule = calculator.generate_monthly_schedule()
        
        # 验证最后24个月为直线法 (切换点检查)
        last_24_months = schedule[-24:]
        monthly_amounts = [s.monthly_depreciation for s in last_24_months]
        
        # 最后24月折旧额应一致
        assert len(set(monthly_amounts)) == 1, "最后24期应采用直线法，折旧额一致"
    
    def test_schedule_period_sequence_continuous(self):
        """
        场景: 折旧计划期间连续性验证
        期待: 各月期间标识符连续无跳跃
        """
        asset = Asset(
            asset_id="AST-107",
            original_value=Decimal("60000.0000"),
            useful_life_years=2,
            residual_value=Decimal("6000.0000"),
            purchase_date=date(2024, 3, 15),
            depreciation_method=DepreciationMethod.STRAIGHT_LINE
        )
        
        calculator = DepreciationCalculatorFactory.create_calculator(asset)
        schedule = calculator.generate_monthly_schedule()
        
        periods = [entry.period for entry in schedule]
        assert periods[0] == "2024-03"
        assert periods[-1] == "2026-02"
        assert len(periods) == len(set(periods)), "期间标识不应重复"


class TestDepreciationReport:
    """
    ATB-3: 折旧报表生成验证
    
    验证 DepreciationReportGenerator.generate_report() 的输出结构与数据准确性
    """
    
    def test_report_structure(self):
        """
        场景: 验证报表返回结构完整性
        期待返回结构包含: report_date, period_start, period_end, summary, details
        """
        assets = [
            Asset(
                asset_id=f"AST-{i:03d}",
                original_value=Decimal("50000.0000"),
                useful_life_years=5,
                residual_value=Decimal("5000.0000"),
                purchase_date=date(2024, 1, 1),
                depreciation_method=DepreciationMethod.STRAIGHT_LINE
            )
            for i in range(1, 4)
        ]
        
        report_service = DepreciationReportService()
        report = report_service.generate_report(
            assets=assets,
            period_start=date(2024, 1, 1),
            period_end=date(2024, 12, 31)
        )
        
        assert "report_date" in report
        assert "period_start" in report
        assert "period_end" in report
        assert "summary" in report
        assert "details" in report
        assert len(report["details"]) == 3
    
    def test_report_summary_totals(self):
        """
        场景: 验证报表汇总数据准确性
        期待: 汇总行的原值、累计折旧、当前净值为各资产之和
        """
        assets = [
            Asset(
                asset_id="AST-201",
                original_value=Decimal("100000.0000"),
                useful_life_years=10,
                residual_value=Decimal("10000.0000"),
                purchase_date=date(2024, 1, 1),
                depreciation_method=DepreciationMethod.STRAIGHT_LINE
            ),
            Asset(
                asset_id="AST-202",
                original_value=Decimal("50000.0000"),
                useful_life_years=5,
                residual_value=Decimal("5000.0000"),
                purchase_date=date(2024, 1, 1),
                depreciation_method=DepreciationMethod.STRAIGHT_LINE
            )
        ]
        
        report_service = DepreciationReportService()
        report = report_service.generate_report(
            assets=assets,
            period_start=date(2024, 1, 1),
            period_end=date(2024, 12, 31)
        )
        
        summary = report["summary"]
        assert summary.total_original_value == Decimal("150000.0000")
        assert summary.total_accumulated_depreciation == Decimal("22500.0000")  # 9000 + 13500
        assert summary.total_current_net_value == Decimal("127500.0000")
    
    def test_period_filtering(self):
        """
        场景: 报表期间过滤验证
        输入: 查询期间 2024-03 至 2024-05
        期待: 仅返回该期间的折旧数据
        """
        asset = Asset(
            asset_id="AST-301",
            original_value=Decimal("60000.0000"),
            useful_life_years=5,
            residual_value=Decimal("0.0000"),
            purchase_date=date(2024, 1, 1),
            depreciation_method=DepreciationMethod.STRAIGHT_LINE
        )
        
        report_service = DepreciationReportService()
        report = report_service.generate_report(
            assets=[asset],
            period_start=date(2024, 3, 1),
            period_end=date(2024, 5, 31)
        )
        
        for detail in report["details"]:
            period = int(detail["period"].replace("-", ""))
            assert 202403 <= period <= 202405, f"Period {period} out of range"
    
    def test_report_detail_structure(self):
        """
        场景: 验证报表明细行结构
        期待: 每条明细包含 asset_id, period, monthly_amount, accumulated, ending_net_value
        """
        assets = [
            Asset(
                asset_id="AST-401",
                original_value=Decimal("36000.0000"),
                useful_life_years=3,
                residual_value=Decimal("0.0000"),
                purchase_date=date(2024, 1, 1),
                depreciation_method=DepreciationMethod.STRAIGHT_LINE
            )
        ]
        
        report_service = DepreciationReportService()
        report = report_service.generate_report(
            assets=assets,
            period_start=date(2024, 1, 1),
            period_end=date(2024, 6, 30)
        )
        
        detail = report["details"][0]
        assert "asset_id" in detail
        assert "period" in detail
        assert "monthly_depreciation" in detail
        assert "accumulated_depreciation" in detail
        assert "ending_net_value" in detail
    
    def test_empty_assets_report(self):
        """
        场景: 空资产列表生成报表
        期待: 返回空明细的报表，汇总值均为零
        """
        report_service = DepreciationReportService()
        report = report_service.generate_report(
            assets=[],
            period_start=date(2024, 1, 1),
            period_end=date(2024, 12, 31)
        )
        
        assert len(report["details"]) == 0
        assert report["summary"].total_original_value == Decimal("0.0000")
        assert report["summary"].total_current_net_value == Decimal("0.0000")


class TestEdgeCases:
    """
    ATB-4: 边界条件与异常处理验证
    """
    
    def test_invalid_date_range_raises_error(self):
        """
        场景: 计算日期早于购置日期时抛出 ValueError
        """
        asset = Asset(
            asset_id="AST-501",
            original_value=Decimal("100000.0000"),
            useful_life_years=10,
            residual_value=Decimal("5000.0000"),
            purchase_date=date(2024, 1, 1),
            depreciation_method=DepreciationMethod.STRAIGHT_LINE
        )
        
        calculator = DepreciationCalculatorFactory.create_calculator(asset)
        
        with pytest.raises(ValueError, match="Calculation date cannot be before purchase date"):
            calculator.calculate_net_value(as_of_date=date(2023, 12, 31))
    
    def test_invalid_useful_life_too_short(self):
        """
        场景: 使用年限小于1时抛出 ValidationError
        """
        with pytest.raises(ValueError, match="Useful life must be between 1 and 50"):
            Asset(
                asset_id="AST-502",
                original_value=Decimal("100000.0000"),
                useful_life_years=0,
                residual_value=Decimal("5000.0000"),
                purchase_date=date(2024, 1, 1),
                depreciation_method=DepreciationMethod.STRAIGHT_LINE
            )
    
    def test_invalid_useful_life_too_long(self):
        """
        场景: 使用年限大于50时抛出 ValidationError
        """
        with pytest.raises(ValueError, match="Useful life must be between 1 and 50"):
            Asset(
                asset_id="AST-503",
                original_value=Decimal("100000.0000"),
                useful_life_years=51,
                residual_value=Decimal("5000.0000"),
                purchase_date=date(2024, 1, 1),
                depreciation_method=DepreciationMethod.STRAIGHT_LINE
            )
    
    def test_residual_exceeds_original_value(self):
        """
        场景: 残值超过原值时抛出 ValidationError
        """
        with pytest.raises(ValueError, match="Residual value cannot exceed original value"):
            Asset(
                asset_id="AST-504",
                original_value=Decimal("100000.0000"),
                useful_life_years=10,
                residual_value=Decimal("150000.0000"),
                purchase_date=date(2024, 1, 1),
                depreciation_method=DepreciationMethod.STRAIGHT_LINE
            )
    
    def test_negative_original_value(self):
        """
        场景: 原值为负数时抛出 ValidationError
        """
        with pytest.raises(ValueError, match="Original value must be positive"):
            Asset(
                asset_id="AST-505",
                original_value=Decimal("-100000.0000"),
                useful_life_years=10,
                residual_value=Decimal("0.0000"),
                purchase_date=date(2024, 1, 1),
                depreciation_method=DepreciationMethod.STRAIGHT_LINE
            )
    
    def test_precision_rounding(self):
        """
        场景: 金额计算精度验证
        期待: 所有金额保留4位小数
        """
        asset = Asset(
            asset_id="AST-506",
            original_value=Decimal("33333.3333"),
            useful_life_years=3,
            residual_value=Decimal("333.3333"),
            purchase_date=date(2024, 1, 1),
            depreciation_method=DepreciationMethod.STRAIGHT_LINE
        )
        
        calculator = DepreciationCalculatorFactory.create_calculator(asset)
        result = calculator.calculate_net_value(as_of_date=date(2024, 7, 1))
        
        # 验证精度
        str_value = str(result.current_net_value)
        decimal_places = len(str_value.split('.')[-1]) if '.' in str_value else 0
        assert decimal_places <= 4


class TestDepreciationMethodConsistency:
    """
    额外测试: 折旧方法一致性验证
    """
    
    def test_straight_line_annual_vs_monthly_sum(self):
        """
        场景: 直线法年折旧额 = 各月折旧额之和
        """
        asset = Asset(
            asset_id="AST-601",
            original_value=Decimal("120000.0000"),
            useful_life_years=10,
            residual_value=Decimal("0.0000"),
            purchase_date=date(2024, 1, 1),
            depreciation_method=DepreciationMethod.STRAIGHT_LINE
        )
        
        calculator = DepreciationCalculatorFactory.create_calculator(asset)
        
        # 获取年度折旧
        annual_result = calculator.calculate_net_value(as_of_date=date(2025, 1, 1))
        
        # 获取月度明细
        schedule = calculator.generate_monthly_schedule()
        first_year_monthly_sum = sum(entry.monthly_depreciation for entry in schedule[:12])
        
        assert annual_result.period_depreciation == first_year_monthly_sum
    
    def test_depreciation_not_exceed_original_value(self):
        """
        场景: 全生命周期累计折旧不得超过原值
        """
        asset = Asset(
            asset_id="AST-602",
            original_value=Decimal("100000.0000"),
            useful_life_years=5,
            residual_value=Decimal("10000.0000"),
            purchase_date=date(2024, 1, 1),
            depreciation_method=DepreciationMethod.DOUBLE_DECLINING_BALANCE
        )
        
        calculator = DepreciationCalculatorFactory.create_calculator(asset)
        schedule = calculator.generate_monthly_schedule()
        
        final_accumulated = schedule[-1].accumulated_depreciation
        assert final_accumulated <= asset.original_value
        assert final_accumulated == asset.original_value - asset.residual_value