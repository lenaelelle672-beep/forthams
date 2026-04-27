"""
Asset Depreciation Calculation Module - Straight-Line Method Unit Tests
=====================================================================

This module contains unit tests for the straight-line depreciation calculation
feature (SWARM-003 Iteration 2).

Test Coverage
------------
- Annual depreciation amount calculation
- Monthly depreciation schedule generation
- Current net value computation at various points in time
- Accumulated depreciation tracking
- Edge cases (zero residual, full depreciation period)

Dependencies
------------
- DepreciationCalculator: Core calculation engine
- StraightLineDepreciation: Straight-line specific implementation
- DepreciationScheduleGenerator: Monthly schedule generation

Related Tests
-------------
- test_double_declining.py: Double declining balance method tests
- test_depreciation_calculator.py: Integration tests for calculation service
- test_report_generator.py: Report generation validation

Author: SWARM-003 Development Team
Iteration: 2
"""

import pytest
from datetime import date
from decimal import Decimal
from typing import List

# Import the modules under test
from backend.services.depreciation_service import DepreciationService
from backend.services.depreciation_report_generator import DepreciationReportGenerator
from backend.models.depreciation import DepreciationRecord


class TestStraightLineDepreciationCalculator:
    """
    Unit tests for straight-line depreciation calculation logic.
    
    The straight-line method depreciates an asset evenly over its useful life.
    Formula: Annual Depreciation = (Original Value - Residual Value) / Useful Life
    """
    
    def test_annual_depreciation_calculation(self):
        """
        Verify annual depreciation amount computation.
        
        Test Scenario:
            - Original Value: 100,000
            - Residual Value: 10,000
            - Useful Life: 10 years
            
        Expected Result:
            Annual Depreciation = (100,000 - 10,000) / 10 = 9,000
        """
        original_value = Decimal("100000.00")
        residual_value = Decimal("10000.00")
        useful_life = 10
        
        expected_annual = Decimal("9000.00")
        
        # Calculate using the depreciation calculator
        result = DepreciationService.calculate_annual_depreciation(
            original_value=original_value,
            residual_value=residual_value,
            useful_life=useful_life,
            method="STRAIGHT_LINE"
        )
        
        assert result == expected_annual, (
            f"Expected annual depreciation of {expected_annual}, "
            f"but got {result}"
        )
    
    def test_monthly_depreciation_calculation(self):
        """
        Verify monthly depreciation amount computation.
        
        Test Scenario:
            - Annual Depreciation: 9,000
            - Expected Monthly: 9,000 / 12 = 750
        
        Expected Result: 750.00 per month
        """
        annual_depreciation = Decimal("9000.00")
        expected_monthly = Decimal("750.00")
        
        result = DepreciationService.calculate_monthly_depreciation(
            annual_depreciation=annual_depreciation
        )
        
        assert result == expected_monthly
    
    def test_current_net_value_at_purchase_date(self):
        """
        Verify net value equals original value at purchase date.
        
        Test Scenario:
            - Asset purchased today
            - No depreciation accumulated yet
            
        Expected Result: Net Value = Original Value (100,000)
        """
        from backend.models.asset import Asset
        
        asset = Asset(
            original_value=Decimal("100000.00"),
            residual_value=Decimal("10000.00"),
            useful_life=10,
            purchase_date=date(2024, 1, 1),
            depreciation_method="STRAIGHT_LINE"
        )
        
        service = DepreciationService()
        net_value = service.get_current_net_value(
            asset=asset,
            as_of_date=date(2024, 1, 1)
        )
        
        assert net_value == Decimal("100000.0000")
    
    def test_current_net_value_after_one_year(self):
        """
        Verify net value after one full year of depreciation.
        
        Test Scenario:
            - Original Value: 100,000
            - Residual Value: 10,000
            - Useful Life: 10 years
            - Elapsed Time: 1 year
            
        Expected Result: 
            Accumulated Depreciation = 9,000
            Net Value = 100,000 - 9,000 = 91,000
        """
        from backend.models.asset import Asset
        
        asset = Asset(
            original_value=Decimal("100000.00"),
            residual_value=Decimal("10000.00"),
            useful_life=10,
            purchase_date=date(2023, 1, 1),
            depreciation_method="STRAIGHT_LINE"
        )
        
        service = DepreciationService()
        net_value = service.get_current_net_value(
            asset=asset,
            as_of_date=date(2024, 1, 1)
        )
        
        assert net_value == Decimal("91000.0000")
    
    def test_current_net_value_after_five_years(self):
        """
        Verify net value after 5 years (half of useful life).
        
        Expected Result:
            Accumulated Depreciation = 9,000 * 5 = 45,000
            Net Value = 100,000 - 45,000 = 55,000
        """
        from backend.models.asset import Asset
        
        asset = Asset(
            original_value=Decimal("100000.00"),
            residual_value=Decimal("10000.00"),
            useful_life=10,
            purchase_date=date(2019, 1, 1),
            depreciation_method="STRAIGHT_LINE"
        )
        
        service = DepreciationService()
        net_value = service.get_current_net_value(
            asset=asset,
            as_of_date=date(2024, 1, 1)
        )
        
        assert net_value == Decimal("55000.0000")
    
    def test_current_net_value_after_full_depreciation(self):
        """
        Verify net value equals residual value after full depreciation period.
        
        Expected Result: Net Value = Residual Value = 10,000
        """
        from backend.models.asset import Asset
        
        asset = Asset(
            original_value=Decimal("100000.00"),
            residual_value=Decimal("10000.00"),
            useful_life=10,
            purchase_date=date(2014, 1, 1),
            depreciation_method="STRAIGHT_LINE"
        )
        
        service = DepreciationService()
        net_value = service.get_current_net_value(
            asset=asset,
            as_of_date=date(2024, 1, 1)
        )
        
        assert net_value == Decimal("10000.0000")
    
    def test_current_net_value_never_below_residual(self):
        """
        Verify net value never drops below residual value.
        
        Test Scenario:
            - Calculation date far exceeds useful life
            
        Expected Result: Net Value = Residual Value (floor protection)
        """
        from backend.models.asset import Asset
        
        asset = Asset(
            original_value=Decimal("100000.00"),
            residual_value=Decimal("10000.00"),
            useful_life=10,
            purchase_date=date(2010, 1, 1),
            depreciation_method="STRAIGHT_LINE"
        )
        
        service = DepreciationService()
        net_value = service.get_current_net_value(
            asset=asset,
            as_of_date=date(2030, 1, 1)
        )
        
        assert net_value >= Decimal("10000.0000")
        assert net_value == Decimal("10000.0000")
    
    def test_zero_residual_value(self):
        """
        Verify calculation with zero residual value.
        
        Test Scenario:
            - Original Value: 50,000
            - Residual Value: 0
            - Useful Life: 5 years
            
        Expected Result: Annual Depreciation = 50,000 / 5 = 10,000
        """
        original_value = Decimal("50000.00")
        residual_value = Decimal("0.00")
        useful_life = 5
        
        expected_annual = Decimal("10000.00")
        
        result = DepreciationService.calculate_annual_depreciation(
            original_value=original_value,
            residual_value=residual_value,
            useful_life=useful_life,
            method="STRAIGHT_LINE"
        )
        
        assert result == expected_annual


class TestStraightLineMonthlySchedule:
    """
    Unit tests for monthly depreciation schedule generation.
    """
    
    def test_schedule_completeness_five_year_asset(self):
        """
        Verify complete schedule generation for 5-year asset.
        
        Test Scenario:
            - Useful Life: 5 years
            
        Expected Result: 60 monthly records (5 * 12)
        """
        from backend.services.depreciation_schedule_generator import (
            MonthlyDepreciationScheduleGenerator
        )
        from backend.models.asset import Asset
        
        asset = Asset(
            original_value=Decimal("50000.00"),
            residual_value=Decimal("5000.00"),
            useful_life=5,
            purchase_date=date(2024, 1, 1),
            depreciation_method="STRAIGHT_LINE"
        )
        
        generator = MonthlyDepreciationScheduleGenerator()
        schedule = generator.generate_monthly_schedule(asset=asset)
        
        assert len(schedule) == 60, (
            f"Expected 60 monthly records for 5-year asset, got {len(schedule)}"
        )
    
    def test_schedule_period_range(self):
        """
        Verify schedule period boundaries are correct.
        
        Expected:
            - First Period: 2024-01
            - Last Period: 2028-12
        """
        from backend.services.depreciation_schedule_generator import (
            MonthlyDepreciationScheduleGenerator
        )
        from backend.models.asset import Asset
        
        asset = Asset(
            original_value=Decimal("50000.00"),
            residual_value=Decimal("5000.00"),
            useful_life=5,
            purchase_date=date(2024, 1, 1),
            depreciation_method="STRAIGHT_LINE"
        )
        
        generator = MonthlyDepreciationScheduleGenerator()
        schedule = generator.generate_monthly_schedule(asset=asset)
        
        assert schedule[0].period == "2024-01", (
            f"Expected first period '2024-01', got '{schedule[0].period}'"
        )
        assert schedule[59].period == "2028-12", (
            f"Expected last period '2028-12', got '{schedule[59].period}'"
        )
    
    def test_monthly_depreciation_amount_accuracy(self):
        """
        Verify monthly depreciation amounts are consistent.
        
        Test Scenario:
            - Annual Depreciation: (50,000 - 5,000) / 5 = 9,000
            - Monthly Depreciation: 9,000 / 12 = 750
            
        Expected Result: All 60 months have monthly_depreciation = 750.00
        """
        from backend.services.depreciation_schedule_generator import (
            MonthlyDepreciationScheduleGenerator
        )
        from backend.models.asset import Asset
        
        asset = Asset(
            original_value=Decimal("50000.00"),
            residual_value=Decimal("5000.00"),
            useful_life=5,
            purchase_date=date(2024, 1, 1),
            depreciation_method="STRAIGHT_LINE"
        )
        
        generator = MonthlyDepreciationScheduleGenerator()
        schedule = generator.generate_monthly_schedule(asset=asset)
        
        expected_monthly = Decimal("750.0000")
        
        for i, entry in enumerate(schedule):
            assert entry.monthly_depreciation == expected_monthly, (
                f"Month {i+1}: Expected {expected_monthly}, "
                f"got {entry.monthly_depreciation}"
            )
    
    def test_accumulated_depreciation_progression(self):
        """
        Verify accumulated depreciation increases correctly each month.
        
        Expected:
            - End of Month 1: 750
            - End of Month 2: 1,500
            - End of Month 12: 9,000
        """
        from backend.services.depreciation_schedule_generator import (
            MonthlyDepreciationScheduleGenerator
        )
        from backend.models.asset import Asset
        
        asset = Asset(
            original_value=Decimal("50000.00"),
            residual_value=Decimal("5000.00"),
            useful_life=5,
            purchase_date=date(2024, 1, 1),
            depreciation_method="STRAIGHT_LINE"
        )
        
        generator = MonthlyDepreciationScheduleGenerator()
        schedule = generator.generate_monthly_schedule(asset=asset)
        
        # Check month 1
        assert schedule[0].accumulated_depreciation == Decimal("750.0000")
        
        # Check month 2
        assert schedule[1].accumulated_depreciation == Decimal("1500.0000")
        
        # Check end of year 1 (month 12)
        assert schedule[11].accumulated_depreciation == Decimal("9000.0000")
        
        # Check end of year 5 (month 60)
        assert schedule[59].accumulated_depreciation == Decimal("45000.0000")
    
    def test_remaining_value_at_end_of_schedule(self):
        """
        Verify remaining value equals residual value at end of schedule.
        
        Expected:
            - Original: 50,000
            - Residual: 5,000
            - Total Depreciation: 45,000
            - Remaining Value: 5,000
        """
        from backend.services.depreciation_schedule_generator import (
            MonthlyDepreciationScheduleGenerator
        )
        from backend.models.asset import Asset
        
        asset = Asset(
            original_value=Decimal("50000.00"),
            residual_value=Decimal("5000.00"),
            useful_life=5,
            purchase_date=date(2024, 1, 1),
            depreciation_method="STRAIGHT_LINE"
        )
        
        generator = MonthlyDepreciationScheduleGenerator()
        schedule = generator.generate_monthly_schedule(asset=asset)
        
        last_entry = schedule[-1]
        assert last_entry.remaining_value == Decimal("5000.0000")


class TestStraightLineEdgeCases:
    """
    Unit tests for edge cases and boundary conditions.
    """
    
    def test_calculation_date_before_purchase_date(self):
        """
        Verify ValueError is raised when calculation date precedes purchase date.
        
        Expected: ValueError with message about invalid date range
        """
        from backend.models.asset import Asset
        
        asset = Asset(
            original_value=Decimal("100000.00"),
            residual_value=Decimal("10000.00"),
            useful_life=10,
            purchase_date=date(2024, 1, 1),
            depreciation_method="STRAIGHT_LINE"
        )
        
        service = DepreciationService()
        
        with pytest.raises(ValueError, match="[Cc]alculation date.*before.*purchase"):
            service.get_current_net_value(
                asset=asset,
                as_of_date=date(2023, 12, 31)
            )
    
    def test_invalid_useful_life_zero(self):
        """
        Verify ValidationError is raised for zero useful life.
        
        Expected: ValidationError with message about useful life range
        """
        with pytest.raises(ValueError, match="[Uu]seful life.*between"):
            DepreciationService.calculate_annual_depreciation(
                original_value=Decimal("100000.00"),
                residual_value=Decimal("10000.00"),
                useful_life=0,
                method="STRAIGHT_LINE"
            )
    
    def test_invalid_useful_life_exceeds_maximum(self):
        """
        Verify ValidationError is raised when useful life exceeds 50 years.
        
        Expected: ValidationError
        """
        with pytest.raises(ValueError, match="[Uu]seful life.*between"):
            DepreciationService.calculate_annual_depreciation(
                original_value=Decimal("100000.00"),
                residual_value=Decimal("10000.00"),
                useful_life=51,
                method="STRAIGHT_LINE"
            )
    
    def test_residual_value_exceeds_original(self):
        """
        Verify ValidationError is raised when residual value > original value.
        
        Expected: ValidationError
        """
        with pytest.raises(ValueError, match="[Rr]esidual.*exceed.*original"):
            DepreciationService.calculate_annual_depreciation(
                original_value=Decimal("100000.00"),
                residual_value=Decimal("100001.00"),
                useful_life=10,
                method="STRAIGHT_LINE"
            )
    
    def test_negative_original_value(self):
        """
        Verify ValidationError is raised for negative original value.
        
        Expected: ValidationError
        """
        with pytest.raises(ValueError, match="[Oo]riginal.*must.*positive"):
            DepreciationService.calculate_annual_depreciation(
                original_value=Decimal("-100000.00"),
                residual_value=Decimal("10000.00"),
                useful_life=10,
                method="STRAIGHT_LINE"
            )
    
    def test_one_year_useful_life(self):
        """
        Verify calculation works correctly for 1-year useful life.
        
        Test Scenario:
            - Original: 12,000
            - Residual: 0
            - Useful Life: 1 year
            
        Expected: Monthly depreciation = 12,000 / 12 = 1,000
        """
        from backend.models.asset import Asset
        
        asset = Asset(
            original_value=Decimal("12000.00"),
            residual_value=Decimal("0.00"),
            useful_life=1,
            purchase_date=date(2024, 1, 1),
            depreciation_method="STRAIGHT_LINE"
        )
        
        service = DepreciationService()
        net_value = service.get_current_net_value(
            asset=asset,
            as_of_date=date(2024, 12, 31)
        )
        
        assert net_value == Decimal("0.0000")
    
    def test_maximum_useful_life_50_years(self):
        """
        Verify calculation works correctly for maximum useful life (50 years).
        
        Test Scenario:
            - Original: 500,000
            - Residual: 50,000
            - Useful Life: 50 years
            
        Expected: Annual depreciation = (500,000 - 50,000) / 50 = 9,000
        """
        original_value = Decimal("500000.00")
        residual_value = Decimal("50000.00")
        useful_life = 50
        
        expected_annual = Decimal("9000.00")
        
        result = DepreciationService.calculate_annual_depreciation(
            original_value=original_value,
            residual_value=residual_value,
            useful_life=useful_life,
            method="STRAIGHT_LINE"
        )
        
        assert result == expected_annual


class TestStraightLinePrecision:
    """
    Unit tests for calculation precision with Decimal type.
    """
    
    def test_decimal_precision_four_places(self):
        """
        Verify all monetary calculations maintain 4 decimal place precision.
        
        Test Scenario:
            - Original: 100,000.1234
            - Residual: 10,000.5678
            - Useful Life: 3 years
            
        Expected: Annual depreciation = (100,000.1234 - 10,000.5678) / 3
        """
        original_value = Decimal("100000.1234")
        residual_value = Decimal("10000.5678")
        useful_life = 3
        
        result = DepreciationService.calculate_annual_depreciation(
            original_value=original_value,
            residual_value=residual_value,
            useful_life=useful_life,
            method="STRAIGHT_LINE"
        )
        
        # Verify precision is maintained
        assert result == result.quantize(Decimal("0.0001"))
    
    def test_rounding_behavior(self):
        """
        Verify rounding follows standard financial rules (half-up).
        
        Test Scenario:
            - 1,000 / 3 = 333.3333... should round to 333.3333
        """
        original_value = Decimal("1000.00")
        residual_value = Decimal("0.00")
        useful_life = 3
        
        result = DepreciationService.calculate_annual_depreciation(
            original_value=original_value,
            residual_value=residual_value,
            useful_life=useful_life,
            method="STRAIGHT_LINE"
        )
        
        # 1000 / 3 = 333.3333...
        assert result == Decimal("333.3333")


class TestStraightLineIntegration:
    """
    Integration tests combining calculation and schedule generation.
    """
    
    def test_full_lifecycle_depreciation(self):
        """
        Verify complete asset lifecycle from purchase to full depreciation.
        
        Test Scenario:
            - Purchase: 2024-01-01
            - Useful Life: 3 years
            - Checkpoints: 6 months, 1 year, 2 years, 3 years, 4 years
            
        Expected Values at Each Checkpoint:
            - Month 0: Net Value = 30,000
            - Month 6: Net Value = 22,500
            - Month 12: Net Value = 20,000
            - Month 24: Net Value = 10,000
            - Month 36: Net Value = 0
            - Month 48: Net Value = 0 (floor protection)
        """
        from backend.models.asset import Asset
        from backend.services.depreciation_schedule_generator import (
            MonthlyDepreciationScheduleGenerator
        )
        
        asset = Asset(
            original_value=Decimal("30000.00"),
            residual_value=Decimal("0.00"),
            useful_life=3,
            purchase_date=date(2024, 1, 1),
            depreciation_method="STRAIGHT_LINE"
        )
        
        service = DepreciationService()
        generator = MonthlyDepreciationScheduleGenerator()
        
        # Verify at 6 months
        net_value_6m = service.get_current_net_value(
            asset=asset,
            as_of_date=date(2024, 7, 1)
        )
        assert net_value_6m == Decimal("22500.0000")
        
        # Verify at 1 year
        net_value_1y = service.get_current_net_value(
            asset=asset,
            as_of_date=date(2025, 1, 1)
        )
        assert net_value_1y == Decimal("20000.0000")
        
        # Verify at 2 years
        net_value_2y = service.get_current_net_value(
            asset=asset,
            as_of_date=date(2026, 1, 1)
        )
        assert net_value_2y == Decimal("10000.0000")
        
        # Verify at 3 years (full depreciation)
        net_value_3y = service.get_current_net_value(
            asset=asset,
            as_of_date=date(2027, 1, 1)
        )
        assert net_value_3y == Decimal("0.0000")
        
        # Verify at 4 years (floor protection)
        net_value_4y = service.get_current_net_value(
            asset=asset,
            as_of_date=date(2028, 1, 1)
        )
        assert net_value_4y == Decimal("0.0000")
        
        # Verify schedule completeness
        schedule = generator.generate_monthly_schedule(asset=asset)
        assert len(schedule) == 36
        assert schedule[-1].remaining_value == Decimal("0.0000")
    
    def test_depreciation_method_consistency(self):
        """
        Verify calculation results match schedule entries.
        
        This test ensures that on-demand calculations and schedule
        generation produce consistent results.
        """
        from backend.models.asset import Asset
        from backend.services.depreciation_schedule_generator import (
            MonthlyDepreciationScheduleGenerator
        )
        
        asset = Asset(
            original_value=Decimal("60000.00"),
            residual_value=Decimal("6000.00"),
            useful_life=5,
            purchase_date=date(2024, 1, 1),
            depreciation_method="STRAIGHT_LINE"
        )
        
        service = DepreciationService()
        generator = MonthlyDepreciationScheduleGenerator()
        
        schedule = generator.generate_monthly_schedule(asset=asset)
        
        # Check each month matches on-demand calculation
        test_months = [0, 5, 11, 17, 23, 29, 35, 36]
        
        for month_offset in test_months:
            if month_offset < 36:
                calc_date = date(2024, 1, 1).replace(
                    month=((month_offset) % 12) + 1,
                    year=2024 + (month_offset) // 12
                )
                net_value = service.get_current_net_value(
                    asset=asset,
                    as_of_date=calc_date
                )
                schedule_net_value = Decimal("60000.0000") - schedule[month_offset].accumulated_depreciation
                
                assert net_value == schedule_net_value, (
                    f"Mismatch at month {month_offset}: "
                    f"on-demand={net_value}, schedule={schedule_net_value}"
                )