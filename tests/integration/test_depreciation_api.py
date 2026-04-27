"""
资产折旧 API 集成测试

测试目标: SWARM-003 资产折旧计算模块 Iteration 2
验证折旧计算服务的 API 端点集成功能

测试范围:
- 资产净值计算 API
- 月折旧计划生成 API
- 折旧报表生成 API
- 数据一致性验证
"""

import pytest
from datetime import date, datetime
from decimal import Decimal
from unittest.mock import Mock, patch

import sys
import os

# 添加项目根目录到路径
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))


class TestDepreciationNetValueAPI:
    """
    资产净值计算 API 测试集
    
    验证 get_current_net_value 接口的正确性
    """
    
    def test_get_net_value_straight_line_full_year(self):
        """
        场景: 直线法资产满一年后的净值查询
        输入: 原值=100000, 年限=10, 残值=5000, 购置日=2023-01-01, 计算日=2024-01-01
        期待: 返回净值 90500.0000
        """
        from src.domain.calculators.straight_line import StraightLineCalculator
        
        calculator = StraightLineCalculator(
            original_value=Decimal("100000"),
            useful_life=10,
            residual_value=Decimal("5000")
        )
        
        result = calculator.calculate_net_value(
            purchase_date=date(2023, 1, 1),
            as_of_date=date(2024, 1, 1)
        )
        
        assert result == Decimal("90500.0000")
    
    def test_get_net_value_double_declining_partial_year(self):
        """
        场景: 双倍余额递减法半年后的净值查询
        输入: 原值=60000, 年限=5, 购置日=2023-07-01, 计算日=2024-01-01
        期待: 返回净值 48000.0000 (折旧率40%, 半年折旧12000)
        """
        from src.domain.calculators.double_declining import DoubleDecliningCalculator
        
        calculator = DoubleDecliningCalculator(
            original_value=Decimal("60000"),
            useful_life=5,
            residual_value=Decimal("0")
        )
        
        result = calculator.calculate_net_value(
            purchase_date=date(2023, 7, 1),
            as_of_date=date(2024, 1, 1)
        )
        
        assert result == Decimal("48000.0000")
    
    def test_get_net_value_boundary_minimum(self):
        """
        场景: 折旧计算后净值不得低于残值
        输入: 原值=100000, 年限=5, 残值=10000, 超过使用年限后计算
        期待: 返回残值 10000.0000
        """
        from src.domain.calculators.straight_line import StraightLineCalculator
        
        calculator = StraightLineCalculator(
            original_value=Decimal("100000"),
            useful_life=5,
            residual_value=Decimal("10000")
        )
        
        result = calculator.calculate_net_value(
            purchase_date=date(2020, 1, 1),
            as_of_date=date(2030, 1, 1)
        )
        
        assert result == Decimal("10000.0000")
        assert result >= calculator.residual_value


class TestDepreciationMonthlyScheduleAPI:
    """
    月折旧计划生成 API 测试集
    
    验证 generate_monthly_depreciation_schedule 接口的正确性
    """
    
    def test_generate_monthly_schedule_completeness(self):
        """
        场景: 5年期直线法资产的完整月折旧计划生成
        输入: 原值=50000, 年限=5, 残值=5000, 购置日=2024-01-01
        期待: 生成60条月度折旧记录 (5年*12月)
        """
        from src.application.services.depreciation_service import DepreciationService
        
        service = DepreciationService()
        
        schedule = service.generate_monthly_schedule(
            original_value=Decimal("50000"),
            useful_life=5,
            residual_value=Decimal("5000"),
            purchase_date=date(2024, 1, 1),
            method="STRAIGHT_LINE"
        )
        
        assert len(schedule) == 60
        assert schedule[0].period == "2024-01"
        assert schedule[59].period == "2028-12"
    
    def test_generate_monthly_schedule_amount_accuracy(self):
        """
        场景: 月折旧额精度验证
        输入: 原值=50000, 年限=5, 残值=5000
        期待: 月折旧额 = (50000-5000)/(5*12) = 750.0000
        """
        from src.application.services.depreciation_service import DepreciationService
        
        service = DepreciationService()
        
        schedule = service.generate_monthly_schedule(
            original_value=Decimal("50000"),
            useful_life=5,
            residual_value=Decimal("5000"),
            purchase_date=date(2024, 1, 1),
            method="STRAIGHT_LINE"
        )
        
        expected_monthly = Decimal("750.0000")
        for entry in schedule:
            assert entry.monthly_depreciation == expected_monthly
    
    def test_generate_monthly_schedule_accumulated_accuracy(self):
        """
        场景: 累计折旧额递增验证
        输入: 直线法资产, 月折旧额=750
        期待: 第12期累计折旧=9000, 第24期累计折旧=18000
        """
        from src.application.services.depreciation_service import DepreciationService
        
        service = DepreciationService()
        
        schedule = service.generate_monthly_schedule(
            original_value=Decimal("50000"),
            useful_life=5,
            residual_value=Decimal("5000"),
            purchase_date=date(2024, 1, 1),
            method="STRAIGHT_LINE"
        )
        
        assert schedule[11].accumulated_depreciation == Decimal("9000.0000")
        assert schedule[23].accumulated_depreciation == Decimal("18000.0000")
        assert schedule[59].accumulated_depreciation == Decimal("45000.0000")


class TestDepreciationReportAPI:
    """
    折旧报表生成 API 测试集
    
    验证 generate_depreciation_report 接口的正确性
    """
    
    def test_generate_report_structure(self):
        """
        场景: 报表返回结构完整性验证
        期待返回结构包含: report_date, period_start, period_end, summary, details
        """
        from src.application.services.depreciation_service import DepreciationService
        from src.domain.entities.depreciation_record import DepreciationRecord
        
        service = DepreciationService()
        
        test_assets = [
            DepreciationRecord(
                asset_id="A001",
                original_value=Decimal("100000"),
                current_net_value=Decimal("90500"),
                period_depreciation=Decimal("9500")
            ),
            DepreciationRecord(
                asset_id="A002",
                original_value=Decimal("60000"),
                current_net_value=Decimal("48000"),
                period_depreciation=Decimal("12000")
            )
        ]
        
        report = service.generate_report(
            assets=test_assets,
            period_start=date(2024, 1, 1),
            period_end=date(2024, 12, 31)
        )
        
        assert "report_date" in report
        assert "summary" in report
        assert "details" in report
        assert len(report["details"]) == 2
    
    def test_generate_report_period_filtering(self):
        """
        场景: 报表期间过滤验证
        输入: 查询期间 2024-03 至 2024-05
        期待: 仅返回该期间的折旧数据
        """
        from src.application.services.depreciation_service import DepreciationService
        from src.domain.entities.depreciation_record import DepreciationRecord
        
        service = DepreciationService()
        
        test_assets = [
            DepreciationRecord(
                asset_id="A001",
                original_value=Decimal("100000"),
                current_net_value=Decimal("95000"),
                period_depreciation=Decimal("5000"),
                period="2024-03"
            ),
            DepreciationRecord(
                asset_id="A001",
                original_value=Decimal("100000"),
                current_net_value=Decimal("94500"),
                period_depreciation=Decimal("5000"),
                period="2024-04"
            ),
            DepreciationRecord(
                asset_id="A001",
                original_value=Decimal("100000"),
                current_net_value=Decimal("94000"),
                period_depreciation=Decimal("5000"),
                period="2024-05"
            )
        ]
        
        report = service.generate_report(
            assets=test_assets,
            period_start=date(2024, 3, 1),
            period_end=date(2024, 5, 31)
        )
        
        for detail in report["details"]:
            period = detail.get("period", "")
            if period:
                period_num = int(period.replace("-", ""))
                assert 202403 <= period_num <= 202405


class TestDepreciationValidation:
    """
    折旧计算边界条件与异常处理测试集
    """
    
    def test_invalid_purchase_date_raises_error(self):
        """
        场景: 计算日期早于购置日期时应抛出 ValueError
        """
        from src.domain.calculators.straight_line import StraightLineCalculator
        
        calculator = StraightLineCalculator(
            original_value=Decimal("100000"),
            useful_life=10,
            residual_value=Decimal("5000")
        )
        
        with pytest.raises(ValueError, match="Calculation date cannot be before purchase date"):
            calculator.calculate_net_value(
                purchase_date=date(2024, 1, 1),
                as_of_date=date(2023, 12, 31)
            )
    
    def test_invalid_useful_life_range(self):
        """
        场景: 使用年限超出 [1, 50] 范围时应抛出 ValidationError
        """
        from src.domain.calculators.straight_line import StraightLineCalculator
        
        with pytest.raises(ValueError, match="Useful life must be between 1 and 50"):
            StraightLineCalculator(
                original_value=Decimal("100000"),
                useful_life=51,
                residual_value=Decimal("5000")
            )
    
    def test_residual_value_exceeds_original(self):
        """
        场景: 残值超过原值时应抛出 ValidationError
        """
        from src.domain.calculators.straight_line import StraightLineCalculator
        
        with pytest.raises(ValueError, match="Residual value cannot exceed original value"):
            StraightLineCalculator(
                original_value=Decimal("100000"),
                useful_life=10,
                residual_value=Decimal("150000")
            )


class TestDepreciationDoubleDecliningSwitch:
    """
    双倍余额递减法转直线法临界点测试集
    """
    
    def test_double_declining_switch_point(self):
        """
        场景: 双倍余额递减法在直线法折旧额更大时自动切换
        说明: 通常在使用年限的后两年切换为直线法
        """
        from src.domain.calculators.double_declining import DoubleDecliningCalculator
        
        calculator = DoubleDecliningCalculator(
            original_value=Decimal("100000"),
            useful_life=5,
            residual_value=Decimal("5000")
        )
        
        schedule = calculator.generate_full_schedule(purchase_date=date(2024, 1, 1))
        
        # 验证最后24个月(2年)的月折旧额一致(直线法特征)
        last_24_months = [s.monthly_depreciation for s in schedule[-24:]]
        assert len(set(last_24_months)) == 1, "最后24个月应采用直线法"
    
    def test_double_declining_net_value_convergence(self):
        """
        场景: 双倍余额递减法净值最终收敛于残值
        """
        from src.domain.calculators.double_declining import DoubleDecliningCalculator
        
        calculator = DoubleDecliningCalculator(
            original_value=Decimal("100000"),
            useful_life=5,
            residual_value=Decimal("5000")
        )
        
        final_record = calculator.get_final_depreciation_record(
            purchase_date=date(2024, 1, 1)
        )
        
        assert final_record.current_net_value == Decimal("5000.0000")
        assert final_record.current_net_value >= calculator.residual_value


class TestDepreciationDataConsistency:
    """
    折旧计算数据一致性测试集
    """
    
    def test_accumulated_equals_sum_of_periods(self):
        """
        场景: 累计折旧额等于各期折旧额之和
        验证: Σ(每期折旧额) = 累计折旧额
        """
        from src.application.services.depreciation_service import DepreciationService
        
        service = DepreciationService()
        
        schedule = service.generate_monthly_schedule(
            original_value=Decimal("50000"),
            useful_life=5,
            residual_value=Decimal("5000"),
            purchase_date=date(2024, 1, 1),
            method="STRAIGHT_LINE"
        )
        
        total_period_depreciation = sum(s.monthly_depreciation for s in schedule)
        final_accumulated = schedule[-1].accumulated_depreciation
        
        assert total_period_depreciation == final_accumulated
    
    def test_net_value_plus_accumulated_equals_original(self):
        """
        场景: 净值 + 累计折旧 = 原值
        验证: 当前净值 + 累计折旧额 = 资产原值
        """
        from src.application.services.depreciation_service import DepreciationService
        
        service = DepreciationService()
        
        schedule = service.generate_monthly_schedule(
            original_value=Decimal("50000"),
            useful_life=5,
            residual_value=Decimal("5000"),
            purchase_date=date(2024, 1, 1),
            method="STRAIGHT_LINE"
        )
        
        for record in schedule:
            expected_sum = record.current_net_value + record.accumulated_depreciation
            assert expected_sum == Decimal("50000.0000")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])