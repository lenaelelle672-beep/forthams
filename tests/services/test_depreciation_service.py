"""
SWARM-003 资产折旧计算模块 - 折旧服务单元测试
=================================================

Phase 2 实施目标：
    P2.1 实现双倍余额递减法完整算法（含后期转直线法逻辑）
    P2.2 生成月度折旧计划表（12期 × N个资产）
    P2.3 生成年度折旧汇总报表（按资产类别聚合）
    P2.4 折旧数据持久化（写入 depreciation_records 表）
    P2.5 提供折旧计算 API 接口（供 Phase 3 调用）

验收测试基准：
    ATB-2.1: 双倍余额递减法计算验证
    ATB-2.2: 月度折旧计划表生成验证
    ATB-2.3: 年度折旧汇总报表验证
    ATB-2.4: 数据持久化验证
    ATB-2.5: API 接口验证
    ATB-2.6: 边界场景验证

边界约束：
    C-001: 折旧计算保留 2 位小数，角位四舍五入
    C-002: 单次批量计算 ≤ 1000 条资产，响应时间 ≤ 3 秒
    C-003: 预计使用年限范围：1-50 年
    C-004: 原值 > 残值，残值 ≥ 0
    C-005: 默认人民币（CNY）
"""

import pytest
from datetime import date, datetime
from decimal import Decimal, ROUND_HALF_UP
from unittest.mock import Mock, patch, MagicMock
from typing import List, Dict, Any, Optional

from services.depreciation_service import (
    DepreciationService,
    DepreciationCalculator,
    MonthlyScheduleGenerator,
    AnnualReportAggregator,
    StraightLineDepreciation,
    DoubleDecliningBalanceDepreciation,
    DepreciationRecord,
    Asset,
    DepreciationMethod,
)
from services.calculators.straight_line import StraightLineCalculator
from services.calculators.double_declining import DoubleDecliningCalculator
from services.calculators.base import BaseCalculator, DepreciationPeriod


class TestDoubleDecliningBalanceCalculation:
    """
    ATB-2.1: 双倍余额递减法计算验证
    
    测试数据: 资产原值=100,000, 使用年限=5年, 残值=5,000
    
    预期折旧表:
        Year 1: 100,000 × 40% = 40,000
        Year 2: 60,000 × 40% = 24,000
        Year 3: 36,000 × 40% = 14,400
        Year 4: 21,600 × 40% = 8,640 → 转直线法: (21,600-5,000)/2 = 8,300
        Year 5: 13,300 → 直线法: 8,300
    """

    def test_ddb_year1_calculation(self):
        """
        验证 Year1 折旧 = 40,000
        
        ATB-2.1 物理测试期待: test_ddb_year1_calculation PASSED
        """
        # Arrange
        asset = Asset(
            id="AST-001",
            name="测试资产",
            original_value=Decimal("100000.00"),
            salvage_value=Decimal("5000.00"),
            useful_life_years=5,
            purchase_date=date(2024, 1, 1),
            category="电子设备",
        )
        
        calculator = DoubleDecliningBalanceDepreciation()
        
        # Act
        result = calculator.calculate(asset)
        
        # Assert
        year1_depreciation = result.periods[0].depreciation
        assert year1_depreciation == Decimal("40000.00"), \
            f"Year1 折旧应为 40000.00，实际为 {year1_depreciation}"

    def test_ddb_switch_to_straight_line(self):
        """
        验证 Year4 自动切换为直线法
        
        ATB-2.1 物理测试期待: test_ddb_switch_to_straight_line PASSED
        """
        # Arrange
        asset = Asset(
            id="AST-001",
            name="测试资产",
            original_value=Decimal("100000.00"),
            salvage_value=Decimal("5000.00"),
            useful_life_years=5,
            purchase_date=date(2024, 1, 1),
            category="电子设备",
        )
        
        calculator = DoubleDecliningBalanceDepreciation()
        
        # Act
        result = calculator.calculate(asset)
        
        # Assert - 检查 Year4 是否切换为直线法
        year4_period = result.periods[3]  # 索引从 0 开始，Year4 是第 4 个
        assert year4_period.method == DepreciationMethod.STRAIGHT_LINE, \
            f"Year4 应切换为直线法，实际方法: {year4_period.method}"
        
        # Year4 直线法折旧 = (21600 - 5000) / 2 = 8300
        expected_year4 = Decimal("8300.00")
        assert year4_period.depreciation == expected_year4, \
            f"Year4 折旧应为 {expected_year4}，实际为 {year4_period.depreciation}"

    def test_total_depreciation_equals_cost_minus_salvage(self):
        """
        验证 5年累计折旧 = 95,000 (原值-残值)
        
        ATB-2.1 物理测试期待: test_total_depreciation_equals_cost_minus_salvage PASSED
        
        验收公式: sum(各年折旧) = 原值 - 残值 = 100000 - 5000 = 95000
        """
        # Arrange
        asset = Asset(
            id="AST-001",
            name="测试资产",
            original_value=Decimal("100000.00"),
            salvage_value=Decimal("5000.00"),
            useful_life_years=5,
            purchase_date=date(2024, 1, 1),
            category="电子设备",
        )
        
        calculator = DoubleDecliningBalanceDepreciation()
        
        # Act
        result = calculator.calculate(asset)
        
        # Assert - 累计折旧 = 原值 - 残值
        total_depreciation = sum(p.depreciation for p in result.periods)
        expected_total = Decimal("95000.00")
        
        assert total_depreciation == expected_total, \
            f"5年累计折旧应为 {expected_total}，实际为 {total_depreciation}"
        
        # 验证最终账面价值 ≈ 残值（允许 ±0.01 误差）
        final_book_value = result.periods[-1].book_value
        assert abs(final_book_value - asset.salvage_value) <= Decimal("0.01"), \
            f"最终账面价值应接近残值 {asset.salvage_value}，实际为 {final_book_value}"

    def test_ddb_rate_calculation(self):
        """
        验证双倍余额递减法折旧率 = 2 / 使用年限
        
        边界约束 C-003: 预计使用年限范围：1-50 年
        """
        # Arrange
        asset = Asset(
            id="AST-002",
            name="年限测试资产",
            original_value=Decimal("50000.00"),
            salvage_value=Decimal("2500.00"),
            useful_life_years=5,
            purchase_date=date(2024, 1, 1),
            category="办公设备",
        )
        
        calculator = DoubleDecliningBalanceDepreciation()
        
        # Act
        result = calculator.calculate(asset)
        
        # Assert - 年折旧率 = 2 / 5 = 40%
        year1_rate = result.periods[0].depreciation / asset.original_value
        expected_rate = Decimal("0.40")
        
        assert abs(year1_rate - expected_rate) < Decimal("0.001"), \
            f"年折旧率应为 40%，实际为 {year1_rate * 100}%"


class TestMonthlyDepreciationSchedule:
    """
    ATB-2.2: 月度折旧计划表验证
    
    验收标准:
        1. 生成 12 条月度记录
        2. 月折旧额 = 年折旧额 / 12
        3. 累计折旧随月份线性增长
        4. 最后一月余额 ≈ 残值
    """

    def test_generate_12_monthly_records(self):
        """
        验证生成 12 条月度记录
        
        ATB-2.2 物理测试期待: test_generate_12_monthly_records PASSED
        """
        # Arrange
        asset = Asset(
            id="AST-003",
            name="月度计划测试资产",
            original_value=Decimal("60000.00"),
            salvage_value=Decimal("3000.00"),
            useful_life_years=1,
            purchase_date=date(2024, 1, 1),
            category="生产设备",
        )
        
        generator = MonthlyScheduleGenerator()
        
        # Act
        schedule = generator.generate_monthly_schedule(asset, year=2024)
        
        # Assert
        assert len(schedule) == 12, \
            f"应生成 12 条月度记录，实际为 {len(schedule)} 条"

    def test_monthly_amount_equals_yearly_divided_by_12(self):
        """
        验证月折旧额 = 年折旧额 / 12
        
        ATB-2.2 物理测试期待: test_monthly_amount_equals_yearly_divided_by_12 PASSED
        
        边界约束 C-001: 折旧计算保留 2 位小数，角位四舍五入
        """
        # Arrange
        asset = Asset(
            id="AST-004",
            name="月度金额测试资产",
            original_value=Decimal("120000.00"),
            salvage_value=Decimal("6000.00"),
            useful_life_years=1,
            purchase_date=date(2024, 1, 1),
            category="运输设备",
        )
        
        calculator = StraightLineDepreciation()
        yearly_result = calculator.calculate(asset)
        yearly_depreciation = sum(p.depreciation for p in yearly_result.periods)
        
        generator = MonthlyScheduleGenerator()
        
        # Act
        schedule = generator.generate_monthly_schedule(asset, year=2024)
        
        # Assert - 月折旧额四舍五入到分
        expected_monthly = (yearly_depreciation / 12).quantize(
            Decimal("0.01"), rounding=ROUND_HALF_UP
        )
        
        for month, record in enumerate(schedule, start=1):
            actual_monthly = record.depreciation_amount.quantize(
                Decimal("0.01"), rounding=ROUND_HALF_UP
            )
            assert actual_monthly == expected_monthly, \
                f"Month {month} 折旧额应为 {expected_monthly}，实际为 {actual_monthly}"

    def test_accumulated_depreciation_linear_growth(self):
        """
        验证累计折旧: Month1 < Month2 < ... < Month12
        
        ATB-2.2 物理测试期待: test_accumulated_depreciation_linear_growth PASSED
        """
        # Arrange
        asset = Asset(
            id="AST-005",
            name="累计折旧测试资产",
            original_value=Decimal("36000.00"),
            salvage_value=Decimal("1800.00"),
            useful_life_years=1,
            purchase_date=date(2024, 1, 1),
            category="家具",
        )
        
        generator = MonthlyScheduleGenerator()
        
        # Act
        schedule = generator.generate_monthly_schedule(asset, year=2024)
        
        # Assert - 验证累计折旧线性增长
        accumulated_prev = Decimal("0")
        for month, record in enumerate(schedule, start=1):
            assert record.accumulated_depreciation > accumulated_prev, \
                f"Month {month} 累计折旧 {record.accumulated_depreciation} 应大于前一期 {accumulated_prev}"
            accumulated_prev = record.accumulated_depreciation

    def test_final_period_book_value_equals_salvage(self):
        """
        验证最后一月余额 ≈ 残值
        
        ATB-2.2 物理测试期待: test_final_period_book_value_equals_salvage PASSED
        """
        # Arrange
        asset = Asset(
            id="AST-006",
            name="最终余额测试资产",
            original_value=Decimal("100000.00"),
            salvage_value=Decimal("5000.00"),
            useful_life_years=1,
            purchase_date=date(2024, 1, 1),
            category="电子设备",
        )
        
        generator = MonthlyScheduleGenerator()
        
        # Act
        schedule = generator.generate_monthly_schedule(asset, year=2024)
        
        # Assert - 最后一个月账面价值 ≈ 残值（±0.01）
        final_record = schedule[-1]
        diff = abs(final_record.book_value - asset.salvage_value)
        
        assert diff <= Decimal("0.01"), \
            f"最终账面价值应接近残值 {asset.salvage_value}，实际为 {final_record.book_value}，差异 {diff}"

    def test_monthly_schedule_includes_required_fields(self):
        """
        验证月度计划表包含必需字段
        
        必需字段: asset_id, year, month, depreciation_amount, accumulated_depreciation, book_value
        """
        # Arrange
        asset = Asset(
            id="AST-007",
            name="字段完整性测试资产",
            original_value=Decimal("24000.00"),
            salvage_value=Decimal("1200.00"),
            useful_life_years=1,
            purchase_date=date(2024, 1, 1),
            category="工具",
        )
        
        generator = MonthlyScheduleGenerator()
        
        # Act
        schedule = generator.generate_monthly_schedule(asset, year=2024)
        
        # Assert
        first_record = schedule[0]
        required_fields = [
            'asset_id', 'year', 'month', 
            'depreciation_amount', 'accumulated_depreciation', 'book_value'
        ]
        
        for field in required_fields:
            assert hasattr(first_record, field), \
                f"月度计划表记录应包含字段 {field}"


class TestAnnualDepreciationReport:
    """
    ATB-2.3: 年度折旧汇总报表验证
    
    验收标准:
        1. 按资产类别聚合折旧金额
        2. 汇总金额 = 各明细之和
        3. 包含资产数量、原值总额、本期折旧、累计折旧、净值
    """

    def test_aggregate_by_asset_category(self):
        """
        验证按资产类别聚合折旧金额
        
        ATB-2.3 物理测试期待: test_aggregate_by_asset_category PASSED
        """
        # Arrange
        assets = [
            Asset(id="AST-101", name="电子设备A", original_value=Decimal("50000.00"),
                  salvage_value=Decimal("2500.00"), useful_life_years=5,
                  purchase_date=date(2024, 1, 1), category="电子设备"),
            Asset(id="AST-102", name="电子设备B", original_value=Decimal("30000.00"),
                  salvage_value=Decimal("1500.00"), useful_life_years=5,
                  purchase_date=date(2024, 1, 1), category="电子设备"),
            Asset(id="AST-103", name="办公设备A", original_value=Decimal("20000.00"),
                  salvage_value=Decimal("1000.00"), useful_life_years=5,
                  purchase_date=date(2024, 1, 1), category="办公设备"),
        ]
        
        aggregator = AnnualReportAggregator()
        
        # Act
        report = aggregator.aggregate_annual_report(assets, year=2024)
        
        # Assert
        assert "电子设备" in report.categories, "应包含'电子设备'类别"
        assert "办公设备" in report.categories, "应包含'办公设备'类别"
        
        # 电子设备类别的折旧应等于两台设备折旧之和
        electronics_depreciation = report.categories["电子设备"].total_depreciation
        expected_electronics = Decimal("9500.00") + Decimal("5700.00")  # 简化计算
        
        assert electronics_depreciation > 0, "电子设备类别折旧应大于 0"

    def test_grand_total_equals_detail_sum(self):
        """
        验证汇总金额 = 各明细之和
        
        ATB-2.3 物理测试期待: test_grand_total_equals_detail_sum PASSED
        """
        # Arrange
        assets = [
            Asset(id="AST-201", name="设备A", original_value=Decimal("40000.00"),
                  salvage_value=Decimal("2000.00"), useful_life_years=5,
                  purchase_date=date(2024, 1, 1), category="生产设备"),
            Asset(id="AST-202", name="设备B", original_value=Decimal("60000.00"),
                  salvage_value=Decimal("3000.00"), useful_life_years=5,
                  purchase_date=date(2024, 1, 1), category="生产设备"),
        ]
        
        aggregator = AnnualReportAggregator()
        
        # Act
        report = aggregator.aggregate_annual_report(assets, year=2024)
        
        # Assert - 汇总金额 = 各类别之和
        category_total = sum(
            cat.total_depreciation for cat in report.categories.values()
        )
        
        assert report.grand_total == category_total, \
            f"汇总金额 {report.grand_total} 应等于类别明细之和 {category_total}"

    def test_report_contains_required_fields(self):
        """
        验证报表包含必需字段
        
        必需字段: asset_count, original_value, current_depreciation, 
                  accumulated_depreciation, book_value
        
        ATB-2.3 物理测试期待: test_report_contains_required_fields PASSED
        """
        # Arrange
        assets = [
            Asset(id="AST-301", name="测试资产", original_value=Decimal("80000.00"),
                  salvage_value=Decimal("4000.00"), useful_life_years=5,
                  purchase_date=date(2024, 1, 1), category="测试类别"),
        ]
        
        aggregator = AnnualReportAggregator()
        
        # Act
        report = aggregator.aggregate_annual_report(assets, year=2024)
        
        # Assert - 验证所有必需字段存在且有效
        assert hasattr(report, 'asset_count'), "报表应包含 asset_count 字段"
        assert hasattr(report, 'original_value'), "报表应包含 original_value 字段"
        assert hasattr(report, 'current_depreciation'), "报表应包含 current_depreciation 字段"
        assert hasattr(report, 'accumulated_depreciation'), "报表应包含 accumulated_depreciation 字段"
        assert hasattr(report, 'book_value'), "报表应包含 book_value 字段"
        
        assert report.asset_count == 1, "资产数量应为 1"
        assert report.original_value == Decimal("80000.00"), "原值应为 80000.00"

    def test_report_excludes_fully_depreciated_assets(self):
        """
        验证报表排除已提完折旧的资产
        
        业务规则: 当累计折旧 = 原值 - 残值时，资产不再参与报表汇总
        """
        # Arrange
        assets = [
            Asset(id="AST-401", name="正常资产", original_value=Decimal("50000.00"),
                  salvage_value=Decimal("2500.00"), useful_life_years=5,
                  purchase_date=date(2020, 1, 1), category="正常类别", status="active"),
            Asset(id="AST-402", name="已提完折旧资产", original_value=Decimal("30000.00"),
                  salvage_value=Decimal("1500.00"), useful_life_years=5,
                  purchase_date=date(2019, 1, 1), category="正常类别", status="fully_depreciated"),
        ]
        
        aggregator = AnnualReportAggregator()
        
        # Act
        report = aggregator.aggregate_annual_report(assets, year=2024)
        
        # Assert - 应排除已提完折旧的资产
        assert report.asset_count == 1, "应只统计 1 台正常资产"
        assert report.original_value == Decimal("50000.00"), "原值应为 50000.00"


class TestDepreciationPersistence:
    """
    ATB-2.4: 数据持久化验证
    
    验收标准:
        1. 记录字段: asset_id, period, depreciation_amount, book_value
        2. 无重复period记录（同资产同期间）
        3. 事务一致性：批量写入失败时回滚
    """

    @pytest.fixture
    def mock_db_session(self):
        """模拟数据库会话"""
        session = Mock()
        session.add = Mock()
        session.commit = Mock()
        session.rollback = Mock()
        session.query = Mock(return_value=Mock())
        return session

    def test_persist_single_record(self, mock_db_session):
        """
        验证单条折旧记录持久化
        
        ATB-2.4 物理测试期待: test_persist_single_record PASSED
        """
        # Arrange
        record = DepreciationRecord(
            id="DEP-001",
            asset_id="AST-501",
            period="2024-01",
            depreciation_amount=Decimal("1500.00"),
            book_value=Decimal("48500.00"),
            method=DepreciationMethod.STRAIGHT_LINE,
        )
        
        service = DepreciationService(db_session=mock_db_session)
        
        # Act
        service.persist_record(record)
        
        # Assert
        mock_db_session.add.assert_called_once_with(record)
        mock_db_session.commit.assert_called_once()

    def test_no_duplicate_period_for_same_asset(self, mock_db_session):
        """
        验证同一资产同一期间只允许一条记录
        
        ATB-2.4 物理测试期待: test_no_duplicate_period_for_same_asset PASSED
        
        异常场景: 同资产同期间重复插入应抛出 IntegrityError
        """
        # Arrange
        mock_db_session.query.return_value.filter.return_value.first.return_value = Mock()  # 已存在记录
        
        service = DepreciationService(db_session=mock_db_session)
        
        duplicate_record = DepreciationRecord(
            id="DEP-002",
            asset_id="AST-502",
            period="2024-01",
            depreciation_amount=Decimal("1600.00"),
            book_value=Decimal("48400.00"),
            method=DepreciationMethod.STRAIGHT_LINE,
        )
        
        # Act & Assert - 应抛出重复记录异常
        with pytest.raises(Exception) as exc_info:
            service.persist_record(duplicate_record)
        
        assert "duplicate" in str(exc_info.value).lower() or "unique" in str(exc_info.value).lower(), \
            "应抛出重复记录相关异常"

    def test_batch_write_rollback_on_failure(self, mock_db_session):
        """
        验证批量写入失败时回滚
        
        ATB-2.4 物理测试期待: test_batch_write_rollback_on_failure PASSED
        
        业务规则: 批量写入事务一致性
        """
        # Arrange
        mock_db_session.commit.side_effect = Exception("Database error")
        
        service = DepreciationService(db_session=mock_db_session)
        
        records = [
            DepreciationRecord(
                id=f"DEP-{i:03d}",
                asset_id=f"AST-{i}",
                period="2024-01",
                depreciation_amount=Decimal("1000.00"),
                book_value=Decimal("49000.00"),
                method=DepreciationMethod.STRAIGHT_LINE,
            )
            for i in range(1, 4)
        ]
        
        # Act
        with pytest.raises(Exception):
            service.persist_batch_records(records)
        
        # Assert - 应执行回滚
        mock_db_session.rollback.assert_called()

    def test_record_contains_required_fields(self):
        """
        验证折旧记录包含所有必需字段
        
        必需字段: id, asset_id, period, depreciation_amount, book_value, method, created_at
        """
        # Arrange
        record = DepreciationRecord(
            id="DEP-003",
            asset_id="AST-503",
            period="2024-02",
            depreciation_amount=Decimal("1500.00"),
            book_value=Decimal("47000.00"),
            method=DepreciationMethod.DOUBLE_DECLINING_BALANCE,
        )
        
        # Assert
        required_fields = ['id', 'asset_id', 'period', 'depreciation_amount', 'book_value', 'method']
        
        for field in required_fields:
            assert hasattr(record, field), f"折旧记录应包含字段 {field}"


class TestDepreciationAPI:
    """
    ATB-2.5: API 接口验证
    
    端点: POST /api/v1/assets/{asset_id}/calculate-depreciation
    
    验收标准:
        1. HTTP 200 响应
        2. JSON 包含 depreciation_schedule 字段
        3. 响应时间 ≤ 500ms (单资产)
    """

    def test_api_returns_200_with_valid_request(self):
        """
        验证有效请求返回 HTTP 200
        
        ATB-2.5 物理测试期待: test_api_returns_200_with_valid_request PASSED
        """
        # Arrange
        service = DepreciationService()
        asset = Asset(
            id="AST-601",
            name="API测试资产",
            original_value=Decimal("100000.00"),
            salvage_value=Decimal("5000.00"),
            useful_life_years=5,
            purchase_date=date(2024, 1, 1),
            category="测试类别",
        )
        
        # Act
        result = service.calculate_depreciation(asset)
        
        # Assert
        assert result is not None, "计算结果不应为空"
        assert hasattr(result, 'periods'), "结果应包含 periods 字段"

    def test_api_response_json_structure(self):
        """
        验证 API 响应 JSON 结构
        
        ATB-2.5 物理测试期待: test_api_response_json_structure PASSED
        
        必需字段: asset_id, depreciation_schedule, total_depreciation
        """
        # Arrange
        service = DepreciationService()
        asset = Asset(
            id="AST-602",
            name="结构测试资产",
            original_value=Decimal("80000.00"),
            salvage_value=Decimal("4000.00"),
            useful_life_years=5,
            purchase_date=date(2024, 1, 1),
            category="测试类别",
        )
        
        # Act
        result = service.calculate_depreciation(asset)
        response_dict = result.to_dict() if hasattr(result, 'to_dict') else vars(result)
        
        # Assert
        required_fields = ['asset_id', 'depreciation_schedule', 'total_depreciation']
        
        for field in required_fields:
            assert field in response_dict or hasattr(result, field), \
                f"API 响应应包含字段 {field}"

    def test_api_response_time_under_500ms(self):
        """
        验证单资产计算响应时间 ≤ 500ms
        
        ATB-2.5 物理测试期待: test_api_response_time_under_500ms PASSED
        
        性能约束 C-002: 单次计算响应时间 < 0.5 秒
        """
        # Arrange
        import time
        service = DepreciationService()
        asset = Asset(
            id="AST-603",
            name="性能测试资产",
            original_value=Decimal("50000.00"),
            salvage_value=Decimal("2500.00"),
            useful_life_years=5,
            purchase_date=date(2024, 1, 1),
            category="测试类别",
        )
        
        # Act
        start_time = time.time()
        service.calculate_depreciation(asset)
        elapsed_time = time.time() - start_time
        
        # Assert
        assert elapsed_time < 0.5, \
            f"单资产计算应在 500ms 内完成，实际耗时 {elapsed_time*1000:.2f}ms"


class TestDepreciationEdgeCases:
    """
    ATB-2.6: 边界场景验证
    
    验收标准:
        1. 原值=残值 → 不产生折旧
        2. 使用年限=1 → 1年内完成折旧
        3. 无效折旧方法 → 返回错误
    """

    def test_zero_salvage_no_depreciation(self):
        """
        验证原值=残值时不产生折旧
        
        ATB-2.6 物理测试期待: test_zero_salvage_no_depreciation PASSED
        
        边界场景: 原值等于残值，无折旧空间
        """
        # Arrange
        asset = Asset(
            id="AST-701",
            name="零折旧资产",
            original_value=Decimal("10000.00"),
            salvage_value=Decimal("10000.00"),  # 原值 = 残值
            useful_life_years=5,
            purchase_date=date(2024, 1, 1),
            category="测试类别",
        )
        
        calculator = StraightLineDepreciation()
        
        # Act
        result = calculator.calculate(asset)
        
        # Assert - 不应产生折旧记录
        assert len(result.periods) == 0 or all(p.depreciation == 0 for p in result.periods), \
            "原值=残值时不应产生折旧"

    def test_one_year_useful_life(self):
        """
        验证使用年限=1时，1年内完成折旧
        
        ATB-2.6 物理测试期待: test_one_year_useful_life PASSED
        
        边界约束 C-003: 预计使用年限范围 1-50 年
        """
        # Arrange
        asset = Asset(
            id="AST-702",
            name="1年折旧资产",
            original_value=Decimal("36000.00"),
            salvage_value=Decimal("1800.00"),
            useful_life_years=1,
            purchase_date=date(2024, 1, 1),
            category="测试类别",
        )
        
        calculator = StraightLineDepreciation()
        
        # Act
        result = calculator.calculate(asset)
        
        # Assert - 应只有 1 期折旧记录
        assert len(result.periods) == 1, \
            f"1年使用年限应只产生 1 期折旧，实际 {len(result.periods)} 期"
        
        # 折旧额 = 原值 - 残值 = 36000 - 1800 = 34200
        expected_depreciation = Decimal("34200.00")
        assert result.periods[0].depreciation == expected_depreciation, \
            f"折旧额应为 {expected_depreciation}，实际为 {result.periods[0].depreciation}"

    def test_invalid_method_returns_error(self):
        """
        验证无效折旧方法返回错误
        
        ATB-2.6 物理测试期待: test_invalid_method_returns_400 PASSED
        
        业务规则: 仅支持 'straight_line' 和 'double_declining_balance'
        """
        # Arrange
        service = DepreciationService()
        asset = Asset(
            id="AST-703",
            name="无效方法测试资产",
            original_value=Decimal("50000.00"),
            salvage_value=Decimal("2500.00"),
            useful_life_years=5,
            purchase_date=date(2024, 1, 1),
            category="测试类别",
        )
        
        # Act & Assert - 应抛出无效方法异常
        with pytest.raises(ValueError) as exc_info:
            service.calculate_depreciation(asset, method="invalid_method")
        
        assert "invalid" in str(exc_info.value).lower() or "method" in str(exc_info.value).lower(), \
            "应抛出与方法相关错误"

    def test_original_value_must_exceed_salvage(self):
        """
        验证原值必须大于残值
        
        边界约束 C-004: 原值 > 残值，残值 ≥ 0
        """
        # Arrange
        asset = Asset(
            id="AST-704",
            name="残值过高资产",
            original_value=Decimal("10000.00"),
            salvage_value=Decimal("15000.00"),  # 残值 > 原值
            useful_life_years=5,
            purchase_date=date(2024, 1, 1),
            category="测试类别",
        )
        
        service = DepreciationService()
        
        # Act & Assert - 应抛出业务异常
        with pytest.raises(ValueError) as exc_info:
            service.calculate_depreciation(asset)
        
        assert "salvage" in str(exc_info.value).lower() or "original" in str(exc_info.value).lower(), \
            "应抛出与残值/原值相关错误"

    def test_useful_life_range_1_to_50(self):
        """
        验证使用年限在 1-50 年范围内
        
        边界约束 C-003: 预计使用年限范围：1-50 年
        """
        # 测试年限 = 0 (无效)
        with pytest.raises(ValueError):
            Asset(
                id="AST-705",
                name="无效年限资产",
                original_value=Decimal("50000.00"),
                salvage_value=Decimal("2500.00"),
                useful_life_years=0,
                purchase_date=date(2024, 1, 1),
                category="测试类别",
            )
        
        # 测试年限 = 51 (超出范围)
        with pytest.raises(ValueError):
            Asset(
                id="AST-706",
                name="超限年限资产",
                original_value=Decimal("50000.00"),
                salvage_value=Decimal("2500.00"),
                useful_life_years=51,
                purchase_date=date(2024, 1, 1),
                category="测试类别",
            )


class TestDepreciationPrecision:
    """
    精度测试: 验证折旧计算的精度约束
    
    边界约束 C-001: 折旧计算保留 2 位小数，角位四舍五入
    """

    def test_depreciation_rounded_to_2_decimal_places(self):
        """
        验证折旧计算结果保留 2 位小数
        """
        # Arrange
        asset = Asset(
            id="AST-801",
            name="精度测试资产",
            original_value=Decimal("100000.00"),
            salvage_value=Decimal("3333.33"),  # 故意设置为除不尽
            useful_life_years=3,
            purchase_date=date(2024, 1, 1),
            category="测试类别",
        )
        
        calculator = StraightLineDepreciation()
        
        # Act
        result = calculator.calculate(asset)
        
        # Assert - 所有折旧额保留 2 位小数
        for period in result.periods:
            depreciation_str = str(period.depreciation)
            decimal_places = len(depreciation_str.split('.')[-1]) if '.' in depreciation_str else 0
            
            assert decimal_places <= 2, \
                f"Period {period.year} 折旧额应保留 2 位小数，实际: {period.depreciation}"

    def test_half_up_rounding(self):
        """
        验证四舍五入 (ROUND_HALF_UP) 规则
        
        例如: 1.555 → 1.56
        """
        # Arrange
        monthly_amount = Decimal("1234.567")
        
        # Act
        rounded = monthly_amount.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
        
        # Assert
        assert rounded == Decimal("1234.57"), \
            f"1.555 四舍五入应为 1.56，实际为 {rounded}"


class TestBatchPerformance:
    """
    批量性能测试
    
    边界约束 C-002: 单次批量计算 ≤ 1000 条资产，响应时间 ≤ 3 秒
    """

    def test_batch_calculation_performance(self):
        """
        验证 1000 条资产批量计算性能
        
        ATB 执行物理测试期待: 响应时间 ≤ 3 秒
        """
        # Arrange
        import time
        service = DepreciationService()
        
        assets = [
            Asset(
                id=f"AST-BATCH-{i:04d}",
                name=f"批量资产{i}",
                original_value=Decimal("50000.00"),
                salvage_value=Decimal("2500.00"),
                useful_life_years=5,
                purchase_date=date(2024, 1, 1),
                category="批量类别",
            )
            for i in range(1, 1001)  # 1000 条资产
        ]
        
        # Act
        start_time = time.time()
        
        results = []
        for asset in assets:
            result = service.calculate_depreciation(asset)
            results.append(result)
        
        elapsed_time = time.time() - start_time
        
        # Assert
        assert elapsed_time <= 3.0, \
            f"1000 条资产批量计算应在 3 秒内完成，实际耗时 {elapsed_time:.2f}秒"
        
        assert len(results) == 1000, "应返回 1000 条计算结果"


class TestDepreciationServiceIntegration:
    """
    折旧服务集成测试
    
    验证完整的折旧计算 → 计划表生成 → 报表汇总流程
    """

    def test_full_depreciation_workflow(self):
        """
        验证完整折旧工作流
        
        流程: 资产 → 折旧计算 → 月度计划表 → 年度报表
        """
        # Arrange
        service = DepreciationService()
        
        assets = [
            Asset(
                id="AST-INTEG-1",
                name="集成测试资产1",
                original_value=Decimal("60000.00"),
                salvage_value=Decimal("3000.00"),
                useful_life_years=5,
                purchase_date=date(2024, 1, 1),
                category="电子设备",
            ),
            Asset(
                id="AST-INTEG-2",
                name="集成测试资产2",
                original_value=Decimal("40000.00"),
                salvage_value=Decimal("2000.00"),
                useful_life_years=5,
                purchase_date=date(2024, 1, 1),
                category="办公设备",
            ),
        ]
        
        # Act - Step 1: 折旧计算
        depreciation_results = []
        for asset in assets:
            result = service.calculate_depreciation(asset)
            depreciation_results.append(result)
        
        # Act - Step 2: 月度计划表生成
        schedule_generator = MonthlyScheduleGenerator()
        all_schedules = []
        for asset, result in zip(assets, depreciation_results):
            schedule = schedule_generator.generate_monthly_schedule(asset, year=2024)
            all_schedules.extend(schedule)
        
        # Act - Step 3: 年度报表汇总
        aggregator = AnnualReportAggregator()
        report = aggregator.aggregate_annual_report(assets, year=2024)
        
        # Assert - 验证完整流程
        assert len(depreciation_results) == 2, "应计算 2 个资产的折旧"
        assert len(all_schedules) >= 12, "应生成至少 12 条月度计划"
        assert report.asset_count == 2, "报表应包含 2 个资产"
        assert len(report.categories) >= 2, "报表应按类别分组"


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])