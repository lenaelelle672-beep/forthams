"""
资产折旧报表生成器单元测试

测试目标: DepreciationReportGenerator.generate_report()
验收标准: ATB-3 折旧报表生成验证

AC-004 相关: 本文件所有测试类和函数均包含 docstring 文档注释
"""

from datetime import date
from decimal import Decimal
from typing import List, Optional
import pytest

from src.domain.entities.asset import Asset
from src.domain.entities.depreciation_record import DepreciationRecord
from src.application.depreciation.services.report_service import (
    DepreciationReportGenerator,
    ReportSummary,
    AssetDepreciationDetail,
    DepreciationReport,
)


class TestDepreciationReportStructure:
    """
    验证报表返回结构完整性
    
    ATB-3 测试目标: 验证 generate_report() 返回结构符合预期
    """

    def test_report_contains_required_fields(self):
        """
        场景: 验证报表返回结构包含所有必需字段
        输入: 单个测试资产，查询期间 2024-01 至 2024-12
        期待返回:
        {
            "report_date": "2024-12-31",
            "period_start": "2024-01",
            "period_end": "2024-12",
            "summary": { "total_original_value": Decimal, ... },
            "details": [ { "asset_id": str, "monthly_amount": Decimal, ... }, ... ]
        }
        """
        test_asset = Asset(
            asset_id="AST-001",
            original_value=Decimal("100000.0000"),
            useful_life=10,
            residual_value=Decimal("5000.0000"),
            purchase_date=date(2024, 1, 1),
            depreciation_method="STRAIGHT_LINE",
        )
        
        report_generator = DepreciationReportGenerator()
        report = report_generator.generate_report(
            assets=[test_asset],
            period_start=date(2024, 1, 1),
            period_end=date(2024, 12, 31),
        )
        
        # 验证顶层字段
        assert "report_date" in report
        assert "period_start" in report
        assert "period_end" in report
        assert "summary" in report
        assert "details" in report
        
        # 验证 summary 字段
        summary = report["summary"]
        required_summary_fields = [
            "total_original_value",
            "total_residual_value",
            "total_accumulated_depreciation",
            "total_current_net_value",
            "asset_count",
        ]
        for field in required_summary_fields:
            assert field in summary, f"Missing required summary field: {field}"

    def test_report_details_count_matches_input(self):
        """
        场景: 验证报表明细行数与输入资产数一致
        输入: 3 个测试资产
        期待: details 列表长度为 3
        """
        assets = [
            Asset(
                asset_id=f"AST-{str(i).zfill(3)}",
                original_value=Decimal("50000.0000"),
                useful_life=5,
                residual_value=Decimal("2500.0000"),
                purchase_date=date(2024, 1, 1),
                depreciation_method="STRAIGHT_LINE",
            )
            for i in range(1, 4)
        ]
        
        report_generator = DepreciationReportGenerator()
        report = report_generator.generate_report(
            assets=assets,
            period_start=date(2024, 1, 1),
            period_end=date(2024, 12, 31),
        )
        
        assert len(report["details"]) == 3

    def test_detail_contains_required_fields(self):
        """
        场景: 验证单条明细记录包含所有必需字段
        输入: 单个测试资产
        期待: 每条 detail 包含 asset_id, monthly_amount, accumulated_depreciation 等字段
        """
        test_asset = Asset(
            asset_id="AST-TEST-001",
            original_value=Decimal("120000.0000"),
            useful_life=8,
            residual_value=Decimal("6000.0000"),
            purchase_date=date(2024, 1, 1),
            depreciation_method="STRAIGHT_LINE",
        )
        
        report_generator = DepreciationReportGenerator()
        report = report_generator.generate_report(
            assets=[test_asset],
            period_start=date(2024, 1, 1),
            period_end=date(2024, 3, 31),
        )
        
        detail = report["details"][0]
        required_detail_fields = [
            "asset_id",
            "asset_name",
            "original_value",
            "residual_value",
            "current_net_value",
            "monthly_depreciation",
            "accumulated_depreciation",
            "depreciation_method",
            "period_details",
        ]
        for field in required_detail_fields:
            assert field in detail, f"Missing required detail field: {field}"


class TestPeriodFiltering:
    """
    验证报表期间过滤功能
    
    ATB-3 测试目标: 验证期间过滤的准确性
    """

    def test_filter_returns_only_period_data(self):
        """
        场景: 验证报表仅返回查询期间内的折旧数据
        输入: 资产购置于 2023-01-01，查询期间 2024-03 至 2024-05
        期待: 仅返回该期间的折旧数据
        """
        test_asset = Asset(
            asset_id="AST-PERIOD-001",
            original_value=Decimal("60000.0000"),
            useful_life=5,
            residual_value=Decimal("3000.0000"),
            purchase_date=date(2023, 1, 1),
            depreciation_method="STRAIGHT_LINE",
        )
        
        report_generator = DepreciationReportGenerator()
        report = report_generator.generate_report(
            assets=[test_asset],
            period_start=date(2024, 3, 1),
            period_end=date(2024, 5, 31),
        )
        
        # 验证期间边界
        assert report["period_start"] == "2024-03"
        assert report["period_end"] == "2024-05"
        
        # 验证明细中的期间范围
        detail = report["details"][0]
        period_details = detail.get("period_details", [])
        for pd in period_details:
            period = int(pd["period"].replace("-", ""))
            assert 202403 <= period <= 202405

    def test_quarterly_period_filter(self):
        """
        场景: 验证季度期间过滤
        输入: 查询 2024 年 Q1 (1月至3月)
        期待: 仅返回 2024-01, 2024-02, 2024-03 的数据
        """
        test_asset = Asset(
            asset_id="AST-QTR-001",
            original_value=Decimal("100000.0000"),
            useful_life=10,
            residual_value=Decimal("5000.0000"),
            purchase_date=date(2024, 1, 1),
            depreciation_method="STRAIGHT_LINE",
        )
        
        report_generator = DepreciationReportGenerator()
        report = report_generator.generate_report(
            assets=[test_asset],
            period_start=date(2024, 1, 1),
            period_end=date(2024, 3, 31),
        )
        
        detail = report["details"][0]
        period_details = detail.get("period_details", [])
        periods = [pd["period"] for pd in period_details]
        assert periods == ["2024-01", "2024-02", "2024-03"]

    def test_empty_period_returns_empty_details(self):
        """
        场景: 查询期间早于资产购置日期时返回空数据
        输入: 资产购置于 2024-06-01，查询期间 2024-01 至 2024-03
        期待: 返回空 details 或 details 中无该资产记录
        """
        test_asset = Asset(
            asset_id="AST-FUTURE-001",
            original_value=Decimal("80000.0000"),
            useful_life=5,
            residual_value=Decimal("4000.0000"),
            purchase_date=date(2024, 6, 1),
            depreciation_method="STRAIGHT_LINE",
        )
        
        report_generator = DepreciationReportGenerator()
        report = report_generator.generate_report(
            assets=[test_asset],
            period_start=date(2024, 1, 1),
            period_end=date(2024, 3, 31),
        )
        
        # 资产购置日期在查询期间之后，不应有数据
        assert len(report["details"]) == 0 or all(
            len(d.get("period_details", [])) == 0 for d in report["details"]
        )


class TestSummaryCalculation:
    """
    验证报表汇总数据计算准确性
    
    ATB-3 测试目标: 验证汇总行数据正确性
    """

    def test_summary_totals_match_individual_assets(self):
        """
        场景: 验证汇总值等于各资产对应值之和
        输入: 3 个资产，原值分别为 100000, 50000, 80000
        期待: total_original_value = 230000
        """
        assets = [
            Asset(
                asset_id="AST-SUM-001",
                original_value=Decimal("100000.0000"),
                useful_life=10,
                residual_value=Decimal("5000.0000"),
                purchase_date=date(2024, 1, 1),
                depreciation_method="STRAIGHT_LINE",
            ),
            Asset(
                asset_id="AST-SUM-002",
                original_value=Decimal("50000.0000"),
                useful_life=5,
                residual_value=Decimal("2500.0000"),
                purchase_date=date(2024, 1, 1),
                depreciation_method="STRAIGHT_LINE",
            ),
            Asset(
                asset_id="AST-SUM-003",
                original_value=Decimal("80000.0000"),
                useful_life=8,
                residual_value=Decimal("4000.0000"),
                purchase_date=date(2024, 1, 1),
                depreciation_method="STRAIGHT_LINE",
            ),
        ]
        
        report_generator = DepreciationReportGenerator()
        report = report_generator.generate_report(
            assets=assets,
            period_start=date(2024, 1, 1),
            period_end=date(2024, 12, 31),
        )
        
        summary = report["summary"]
        assert summary["total_original_value"] == Decimal("230000.0000")
        assert summary["total_residual_value"] == Decimal("11500.0000")
        assert summary["asset_count"] == 3

    def test_accumulated_depreciation_calculation(self):
        """
        场景: 验证累计折旧额计算
        输入: 原值 100000，残值 5000，使用年限 10 年，已使用 1 年
        期待: 累计折旧 = (100000 - 5000) / 10 = 9500
        """
        test_asset = Asset(
            asset_id="AST-ACCUM-001",
            original_value=Decimal("100000.0000"),
            useful_life=10,
            residual_value=Decimal("5000.0000"),
            purchase_date=date(2023, 1, 1),
            depreciation_method="STRAIGHT_LINE",
        )
        
        report_generator = DepreciationReportGenerator()
        report = report_generator.generate_report(
            assets=[test_asset],
            period_start=date(2024, 1, 1),
            period_end=date(2024, 12, 31),
        )
        
        summary = report["summary"]
        # 直线法年折旧额 = (100000 - 5000) / 10 = 9500
        assert summary["total_accumulated_depreciation"] == Decimal("9500.0000")

    def test_current_net_value_in_summary(self):
        """
        场景: 验证当前净值计算
        输入: 原值 100000，残值 5000，已折旧 9500
        期待: 当前净值 = 100000 - 9500 = 90500
        """
        test_asset = Asset(
            asset_id="AST-NETVAL-001",
            original_value=Decimal("100000.0000"),
            useful_life=10,
            residual_value=Decimal("5000.0000"),
            purchase_date=date(2023, 1, 1),
            depreciation_method="STRAIGHT_LINE",
        )
        
        report_generator = DepreciationReportGenerator()
        report = report_generator.generate_report(
            assets=[test_asset],
            period_start=date(2024, 1, 1),
            period_end=date(2024, 12, 31),
        )
        
        summary = report["summary"]
        assert summary["total_current_net_value"] == Decimal("90500.0000")


class TestDoubleDecliningMethod:
    """
    验证双倍余额递减法的报表生成
    
    ATB-3 扩展测试: 验证加速折旧法的报表输出
    """

    def test_double_declining_report_generation(self):
        """
        场景: 验证双倍余额递减法资产的报表生成
        输入: 原值 60000，使用年限 5 年，双倍余额递减法
        期待: 报表包含正确的首年折旧率 (40%)
        """
        test_asset = Asset(
            asset_id="AST-DDB-001",
            original_value=Decimal("60000.0000"),
            useful_life=5,
            residual_value=Decimal("3000.0000"),
            purchase_date=date(2024, 1, 1),
            depreciation_method="DOUBLE_DECLINING",
        )
        
        report_generator = DepreciationReportGenerator()
        report = report_generator.generate_report(
            assets=[test_asset],
            period_start=date(2024, 1, 1),
            period_end=date(2024, 12, 31),
        )
        
        detail = report["details"][0]
        assert detail["depreciation_method"] == "DOUBLE_DECLINING"
        assert detail["current_net_value"] == Decimal("36000.0000")  # 60000 * 0.6

    def test_ddb_switch_to_straight_line(self):
        """
        场景: 验证双倍余额递减法在后期自动切换为直线法
        输入: 5 年期资产，查询期间包含第 4、5 年
        期待: 最后两年折旧额一致（切换为直线法）
        """
        test_asset = Asset(
            asset_id="AST-SWITCH-001",
            original_value=Decimal("100000.0000"),
            useful_life=5,
            residual_value=Decimal("5000.0000"),
            purchase_date=date(2022, 1, 1),
            depreciation_method="DOUBLE_DECLINING",
        )
        
        report_generator = DepreciationReportGenerator()
        report = report_generator.generate_report(
            assets=[test_asset],
            period_start=date(2025, 1, 1),
            period_end=date(2025, 12, 31),
        )
        
        detail = report["details"][0]
        period_details = detail.get("period_details", [])
        
        # 验证最后12个月（2025年）的月折旧额一致
        if len(period_details) == 12:
            monthly_amounts = [pd["monthly_depreciation"] for pd in period_details]
            assert len(set(monthly_amounts)) == 1  # 应全部相等


class TestEdgeCases:
    """
    边界条件与异常处理测试
    
    ATB-4 测试目标: 验证边界条件和异常处理
    """

    def test_zero_residual_value_asset(self):
        """
        场景: 残值为零的资产报表生成
        输入: 残值 = 0，原值 100000，使用年限 10 年
        期待: 报表正常生成，净值最终归零
        """
        test_asset = Asset(
            asset_id="AST-ZERO-RES-001",
            original_value=Decimal("100000.0000"),
            useful_life=10,
            residual_value=Decimal("0.0000"),
            purchase_date=date(2024, 1, 1),
            depreciation_method="STRAIGHT_LINE",
        )
        
        report_generator = DepreciationReportGenerator()
        report = report_generator.generate_report(
            assets=[test_asset],
            period_start=date(2024, 1, 1),
            period_end=date(2024, 12, 31),
        )
        
        detail = report["details"][0]
        assert detail["residual_value"] == Decimal("0.0000")

    def test_single_month_period(self):
        """
        场景: 单月期间报表
        输入: 查询期间仅包含 2024-01
        期待: 报表正常生成，仅包含 1 条月度明细
        """
        test_asset = Asset(
            asset_id="AST-SINGLE-MONTH-001",
            original_value=Decimal("60000.0000"),
            useful_life=5,
            residual_value=Decimal("3000.0000"),
            purchase_date=date(2024, 1, 1),
            depreciation_method="STRAIGHT_LINE",
        )
        
        report_generator = DepreciationReportGenerator()
        report = report_generator.generate_report(
            assets=[test_asset],
            period_start=date(2024, 1, 1),
            period_end=date(2024, 1, 31),
        )
        
        detail = report["details"][0]
        period_details = detail.get("period_details", [])
        assert len(period_details) == 1
        assert period_details[0]["period"] == "2024-01"

    def test_invalid_date_range_raises_error(self):
        """
        场景: 无效日期范围（结束日期早于开始日期）
        输入: period_start = 2024-12-31, period_end = 2024-01-01
        期待: 抛出 ValueError
        """
        test_asset = Asset(
            asset_id="AST-INVALID-DATE-001",
            original_value=Decimal("50000.0000"),
            useful_life=5,
            residual_value=Decimal("2500.0000"),
            purchase_date=date(2024, 1, 1),
            depreciation_method="STRAIGHT_LINE",
        )
        
        report_generator = DepreciationReportGenerator()
        
        with pytest.raises(ValueError, match="Period end date must be after start date"):
            report_generator.generate_report(
                assets=[test_asset],
                period_start=date(2024, 12, 31),
                period_end=date(2024, 1, 1),
            )

    def test_empty_assets_list(self):
        """
        场景: 空资产列表
        输入: assets = []
        期待: 返回空报表，details 为空列表
        """
        report_generator = DepreciationReportGenerator()
        report = report_generator.generate_report(
            assets=[],
            period_start=date(2024, 1, 1),
            period_end=date(2024, 12, 31),
        )
        
        assert report["details"] == []
        assert report["summary"]["asset_count"] == 0
        assert report["summary"]["total_original_value"] == Decimal("0.0000")


class TestDecimalPrecision:
    """
    验证数值精度处理
    
    功能约束: 金额计算统一使用 Decimal 类型，精度保留4位小数
    """

    def test_decimal_precision_maintained(self):
        """
        场景: 验证计算结果保留4位小数精度
        输入: 原值 33333.33，残值 333.33，使用年限 3 年
        期待: 所有金额字段保留4位小数
        """
        test_asset = Asset(
            asset_id="AST-DECIMAL-001",
            original_value=Decimal("33333.3333"),
            useful_life=3,
            residual_value=Decimal("333.3333"),
            purchase_date=date(2024, 1, 1),
            depreciation_method="STRAIGHT_LINE",
        )
        
        report_generator = DepreciationReportGenerator()
        report = report_generator.generate_report(
            assets=[test_asset],
            period_start=date(2024, 1, 1),
            period_end=date(2024, 12, 31),
        )
        
        detail = report["details"][0]
        
        # 验证精度
        def assert_precision(value, expected_decimals=4):
            """验证数值精度"""
            str_value = str(value)
            if "." in str_value:
                decimals = len(str_value.split(".")[1])
                assert decimals <= expected_decimals
        
        assert_precision(detail["original_value"])
        assert_precision(detail["monthly_depreciation"])
        assert_precision(detail["accumulated_depreciation"])

    def test_net_value_never_exceeds_original(self):
        """
        场景: 验证净值永不超过原值
        输入: 任意有效资产
        期待: current_net_value <= original_value
        """
        test_asset = Asset(
            asset_id="AST-BOUND-001",
            original_value=Decimal("100000.0000"),
            useful_life=5,
            residual_value=Decimal("5000.0000"),
            purchase_date=date(2020, 1, 1),
            depreciation_method="STRAIGHT_LINE",
        )
        
        report_generator = DepreciationReportGenerator()
        report = report_generator.generate_report(
            assets=[test_asset],
            period_start=date(2030, 1, 1),
            period_end=date(2030, 12, 31),
        )
        
        detail = report["details"][0]
        assert detail["current_net_value"] <= detail["original_value"]
        assert detail["current_net_value"] >= Decimal("0.0000")

    def test_net_value_never_below_residual(self):
        """
        场景: 验证净值永不低于残值
        输入: 已折旧完成的资产
        期待: current_net_value >= residual_value
        """
        test_asset = Asset(
            asset_id="AST-RESIDUAL-001",
            original_value=Decimal("100000.0000"),
            useful_life=5,
            residual_value=Decimal("10000.0000"),
            purchase_date=date(2020, 1, 1),
            depreciation_method="STRAIGHT_LINE",
        )
        
        report_generator = DepreciationReportGenerator()
        report = report_generator.generate_report(
            assets=[test_asset],
            period_start=date(2026, 1, 1),
            period_end=date(2026, 12, 31),
        )
        
        detail = report["details"][0]
        assert detail["current_net_value"] >= detail["residual_value"]


class TestMixedMethods:
    """
    验证混合折旧方法报表
    
    业务场景: 同时支持直线法和双倍余额递减法资产的报表
    """

    def test_mixed_depreciation_methods_in_single_report(self):
        """
        场景: 单次报表包含不同折旧方法的资产
        输入: 3 个资产，分别使用 STRAIGHT_LINE, DOUBLE_DECLINING, STRAIGHT_LINE
        期待: 报表正确处理不同方法，各资产独立计算
        """
        assets = [
            Asset(
                asset_id="AST-MIX-001",
                original_value=Decimal("100000.0000"),
                useful_life=10,
                residual_value=Decimal("5000.0000"),
                purchase_date=date(2024, 1, 1),
                depreciation_method="STRAIGHT_LINE",
            ),
            Asset(
                asset_id="AST-MIX-002",
                original_value=Decimal("100000.0000"),
                useful_life=10,
                residual_value=Decimal("5000.0000"),
                purchase_date=date(2024, 1, 1),
                depreciation_method="DOUBLE_DECLINING",
            ),
            Asset(
                asset_id="AST-MIX-003",
                original_value=Decimal("100000.0000"),
                useful_life=10,
                residual_value=Decimal("5000.0000"),
                purchase_date=date(2024, 1, 1),
                depreciation_method="STRAIGHT_LINE",
            ),
        ]
        
        report_generator = DepreciationReportGenerator()
        report = report_generator.generate_report(
            assets=assets,
            period_start=date(2024, 1, 1),
            period_end=date(2024, 12, 31),
        )
        
        # 验证所有资产都包含在报表中
        assert len(report["details"]) == 3
        
        # 验证各方法的月折旧额不同
        monthly_amounts = [d["monthly_depreciation"] for d in report["details"]]
        # 直线法: (100000-5000)/10/12 = 791.67
        # 双倍余额递减法: 100000*20%/12 = 1666.67 (首年)
        assert monthly_amounts[0] == Decimal("791.6700")
        assert monthly_amounts[1] == Decimal("1666.6700")  # 双倍余额递减首年更高
        assert monthly_amounts[2] == Decimal("791.6700")


# ========== Fixtures ==========

@pytest.fixture
def sample_straight_line_asset():
    """
    创建示例直线法资产
    """
    return Asset(
        asset_id="AST-FIXTURE-001",
        original_value=Decimal("50000.0000"),
        useful_life=5,
        residual_value=Decimal("2500.0000"),
        purchase_date=date(2024, 1, 1),
        depreciation_method="STRAIGHT_LINE",
    )


@pytest.fixture
def sample_double_declining_asset():
    """
    创建示例双倍余额递减法资产
    """
    return Asset(
        asset_id="AST-FIXTURE-002",
        original_value=Decimal("60000.0000"),
        useful_life=5,
        residual_value=Decimal("3000.0000"),
        purchase_date=date(2024, 1, 1),
        depreciation_method="DOUBLE_DECLINING",
    )


@pytest.fixture
def report_generator():
    """
    创建报表生成器实例
    """
    return DepreciationReportGenerator()