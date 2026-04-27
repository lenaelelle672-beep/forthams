"""
Depreciation Consistency Integration Tests

Integration tests for SWARM-003 asset depreciation calculation module.
Tests the consistency between depreciation methods, net value calculation,
monthly depreciation schedule generation, and report generation.

Iteration: 2
"""

import pytest
from datetime import date, timedelta
from decimal import Decimal
from typing import List
from unittest.mock import Mock, patch, MagicMock

from src.domain.entities.asset import Asset
from src.domain.entities.depreciation_record import DepreciationRecord
from src.domain.schemas import DepreciationMethod
from src.application.depreciation.services.depreciation_service import DepreciationCalculationService
from src.application.depreciation.services.report_service import DepreciationReportGenerator


class TestNetValueCalculation:
    """
    ATB-1: Asset Net Value Calculation Verification
    
    Validates the accuracy of get_current_net_value() calculations
    for both straight-line and double-declining methods.
    """
    
    def test_straight_line_net_value_at_year_end(self):
        """
        Scenario: Straight-line asset, net value calculation after 1 year.
        
        Input:
            - Original Value: 100,000
            - Useful Life: 10 years
            - Residual Value: 5,000
            - Purchase Date: 2023-01-01
            - Calculation Date: 2024-01-01
        
        Expected:
            - Annual Depreciation: (100000-5000)/10 = 9,500
            - Net Value: 100000 - 9500 = 90,500
        """
        original_value = Decimal("100000.0000")
        residual_value = Decimal("5000.0000")
        useful_life = 10
        purchase_date = date(2023, 1, 1)
        calculation_date = date(2024, 1, 1)
        
        expected_net_value = Decimal("90500.0000")
        expected_annual_depreciation = Decimal("9500.0000")
        
        with patch('src.application.depreciation.services.depreciation_service.AssetRepository') as mock_repo:
            mock_asset = Asset(
                id=1,
                original_value=original_value,
                residual_value=residual_value,
                useful_life=useful_life,
                purchase_date=purchase_date,
                depreciation_method=DepreciationMethod.STRAIGHT_LINE
            )
            mock_repo.get_by_id.return_value = mock_asset
            
            service = DepreciationCalculationService(repository=mock_repo)
            result = service.get_current_net_value(asset_id=1, as_of_date=calculation_date)
            
            assert result.net_value == expected_net_value
            assert result.annual_depreciation == expected_annual_depreciation
    
    def test_double_declining_net_value_at_partial_year(self):
        """
        Scenario: Double-declining balance asset, net value after 6 months.
        
        Input:
            - Original Value: 60,000
            - Useful Life: 5 years
            - Purchase Date: 2023-07-01
            - Calculation Date: 2024-01-01
        
        Expected:
            - First Year Rate: 40% (2/5)
            - 6-Month Depreciation: 60000 * 40% / 2 = 12,000
            - Net Value: 60,000 - 12,000 = 48,000
        """
        original_value = Decimal("60000.0000")
        residual_value = Decimal("0.0000")
        useful_life = 5
        purchase_date = date(2023, 7, 1)
        calculation_date = date(2024, 1, 1)
        
        expected_net_value = Decimal("48000.0000")
        expected_depreciation = Decimal("12000.0000")
        
        with patch('src.application.depreciation.services.depreciation_service.AssetRepository') as mock_repo:
            mock_asset = Asset(
                id=2,
                original_value=original_value,
                residual_value=residual_value,
                useful_life=useful_life,
                purchase_date=purchase_date,
                depreciation_method=DepreciationMethod.DOUBLE_DECLINING
            )
            mock_repo.get_by_id.return_value = mock_asset
            
            service = DepreciationCalculationService(repository=mock_repo)
            result = service.get_current_net_value(asset_id=2, as_of_date=calculation_date)
            
            assert result.net_value == expected_net_value
            assert result.period_depreciation == expected_depreciation
    
    def test_net_value_never_negative(self):
        """
        Scenario: Calculation date exceeds useful life, net value should not be negative.
        
        Input:
            - Original Value: 100,000
            - Useful Life: 5 years
            - Residual Value: 10,000
            - Purchase Date: 2020-01-01
            - Calculation Date: 2030-01-01 (beyond useful life)
        
        Expected:
            - Net Value: 10,000 (minimum is residual value)
        """
        original_value = Decimal("100000.0000")
        residual_value = Decimal("10000.0000")
        useful_life = 5
        purchase_date = date(2020, 1, 1)
        calculation_date = date(2030, 1, 1)
        
        expected_net_value = Decimal("10000.0000")
        
        with patch('src.application.depreciation.services.depreciation_service.AssetRepository') as mock_repo:
            mock_asset = Asset(
                id=3,
                original_value=original_value,
                residual_value=residual_value,
                useful_life=useful_life,
                purchase_date=purchase_date,
                depreciation_method=DepreciationMethod.STRAIGHT_LINE
            )
            mock_repo.get_by_id.return_value = mock_asset
            
            service = DepreciationCalculationService(repository=mock_repo)
            result = service.get_current_net_value(asset_id=3, as_of_date=calculation_date)
            
            assert result.net_value == expected_net_value
            assert result.net_value >= Decimal("0")


class TestMonthlyDepreciationSchedule:
    """
    ATB-2: Monthly Depreciation Schedule Generation Verification
    
    Validates the completeness and accuracy of generate_monthly_schedule()
    for both depreciation methods.
    """
    
    def test_schedule_completeness(self):
        """
        Scenario: 5-year straight-line asset, verify schedule entry count.
        
        Input:
            - Original Value: 50,000
            - Useful Life: 5 years
            - Residual Value: 5,000
            - Purchase Date: 2024-01-01
            - Method: STRAIGHT_LINE
        
        Expected:
            - Schedule entries: 60 months (5 * 12)
            - First period: "2024-01"
            - Last period: "2028-12"
        """
        original_value = Decimal("50000.0000")
        residual_value = Decimal("5000.0000")
        useful_life = 5
        purchase_date = date(2024, 1, 1)
        
        expected_entries = 60
        expected_first_period = "2024-01"
        expected_last_period = "2028-12"
        
        with patch('src.application.depreciation.services.depreciation_service.AssetRepository') as mock_repo:
            mock_asset = Asset(
                id=4,
                original_value=original_value,
                residual_value=residual_value,
                useful_life=useful_life,
                purchase_date=purchase_date,
                depreciation_method=DepreciationMethod.STRAIGHT_LINE
            )
            mock_repo.get_by_id.return_value = mock_asset
            mock_repo.save_depreciation_records.return_value = True
            
            service = DepreciationCalculationService(repository=mock_repo)
            schedule = service.generate_monthly_schedule(asset_id=4)
            
            assert len(schedule) == expected_entries
            assert schedule[0].period == expected_first_period
            assert schedule[59].period == expected_last_period
    
    def test_monthly_amount_accuracy(self):
        """
        Scenario: Verify monthly depreciation amount precision.
        
        Input:
            - Original Value: 50,000
            - Useful Life: 5 years
            - Residual Value: 5,000
            - Purchase Date: 2024-01-01
        
        Expected:
            - Monthly Depreciation: (50000-5000)/(5*12) = 750.00
        """
        original_value = Decimal("50000.0000")
        residual_value = Decimal("5000.0000")
        useful_life = 5
        purchase_date = date(2024, 1, 1)
        
        expected_monthly = Decimal("750.0000")
        
        with patch('src.application.depreciation.services.depreciation_service.AssetRepository') as mock_repo:
            mock_asset = Asset(
                id=5,
                original_value=original_value,
                residual_value=residual_value,
                useful_life=useful_life,
                purchase_date=purchase_date,
                depreciation_method=DepreciationMethod.STRAIGHT_LINE
            )
            mock_repo.get_by_id.return_value = mock_asset
            mock_repo.save_depreciation_records.return_value = True
            
            service = DepreciationCalculationService(repository=mock_repo)
            schedule = service.generate_monthly_schedule(asset_id=5)
            
            for entry in schedule:
                assert entry.monthly_depreciation == expected_monthly
    
    def test_double_declining_switch_to_straight_line(self):
        """
        Scenario: Double-declining balance switches to straight-line at threshold.
        
        Description: When straight-line depreciation exceeds double-declining,
        the method should automatically switch.
        
        Input:
            - Original Value: 100,000
            - Useful Life: 5 years
            - Residual Value: 5,000
            - Purchase Date: 2024-01-01
        
        Expected:
            - Last 24 months should have consistent depreciation (after switch)
        """
        original_value = Decimal("100000.0000")
        residual_value = Decimal("5000.0000")
        useful_life = 5
        purchase_date = date(2024, 1, 1)
        
        with patch('src.application.depreciation.services.depreciation_service.AssetRepository') as mock_repo:
            mock_asset = Asset(
                id=6,
                original_value=original_value,
                residual_value=residual_value,
                useful_life=useful_life,
                purchase_date=purchase_date,
                depreciation_method=DepreciationMethod.DOUBLE_DECLINING
            )
            mock_repo.get_by_id.return_value = mock_asset
            mock_repo.save_depreciation_records.return_value = True
            
            service = DepreciationCalculationService(repository=mock_repo)
            schedule = service.generate_monthly_schedule(asset_id=6)
            
            last_24_months = [s.monthly_depreciation for s in schedule[-24:]]
            unique_amounts = set(last_24_months)
            
            assert len(unique_amounts) == 1


class TestDepreciationReport:
    """
    ATB-3: Depreciation Report Generation Verification
    
    Validates the output structure and data accuracy of generate_report().
    """
    
    def test_report_structure(self):
        """
        Scenario: Verify report return structure completeness.
        
        Expected Return Structure:
        {
            "report_date": "2024-12-31",
            "period_start": "2024-01",
            "period_end": "2024-12",
            "summary": { 
                "total_original_value": Decimal,
                "total_accumulated_depreciation": Decimal,
                ...
            },
            "details": [
                {
                    "asset_id": str,
                    "monthly_amount": Decimal,
                    "accumulated": Decimal,
                    ...
                },
                ...
            ]
        }
        """
        mock_assets = [
            Asset(id=7, original_value=Decimal("100000.0000"), 
                  residual_value=Decimal("5000.0000"), useful_life=10,
                  purchase_date=date(2024, 1, 1),
                  depreciation_method=DepreciationMethod.STRAIGHT_LINE),
            Asset(id=8, original_value=Decimal("50000.0000"),
                  residual_value=Decimal("2500.0000"), useful_life=5,
                  purchase_date=date(2024, 1, 1),
                  depreciation_method=DepreciationMethod.STRAIGHT_LINE),
            Asset(id=9, original_value=Decimal("75000.0000"),
                  residual_value=Decimal("7500.0000"), useful_life=10,
                  purchase_date=date(2024, 1, 1),
                  depreciation_method=DepreciationMethod.DOUBLE_DECLINING),
        ]
        
        with patch('src.application.depreciation.services.report_service.AssetRepository') as mock_repo:
            mock_repo.get_assets_for_period.return_value = mock_assets
            mock_repo.get_depreciation_records.return_value = []
            
            report_generator = DepreciationReportGenerator(repository=mock_repo)
            report = report_generator.generate_report(
                assets=mock_assets,
                period_start=date(2024, 1, 1),
                period_end=date(2024, 12, 31)
            )
            
            assert "report_date" in report
            assert "summary" in report
            assert "details" in report
            assert "period_start" in report
            assert "period_end" in report
            assert len(report["details"]) == 3
    
    def test_period_filtering(self):
        """
        Scenario: Report period filtering verification.
        
        Input:
            - Query Period: 2024-03 to 2024-05
        
        Expected:
            - Only returns depreciation data for that period
        """
        mock_assets = [
            Asset(id=10, original_value=Decimal("60000.0000"),
                  residual_value=Decimal("3000.0000"), useful_life=5,
                  purchase_date=date(2024, 1, 1),
                  depreciation_method=DepreciationMethod.STRAIGHT_LINE),
        ]
        
        with patch('src.application.depreciation.services.report_service.AssetRepository') as mock_repo:
            mock_repo.get_assets_for_period.return_value = mock_assets
            mock_repo.get_depreciation_records.return_value = [
                DepreciationRecord(asset_id=10, period="2024-03", monthly_depreciation=Decimal("900.0000")),
                DepreciationRecord(asset_id=10, period="2024-04", monthly_depreciation=Decimal("900.0000")),
                DepreciationRecord(asset_id=10, period="2024-05", monthly_depreciation=Decimal("900.0000")),
                DepreciationRecord(asset_id=10, period="2024-06", monthly_depreciation=Decimal("900.0000")),
            ]
            
            report_generator = DepreciationReportGenerator(repository=mock_repo)
            report = report_generator.generate_report(
                assets=mock_assets,
                period_start=date(2024, 3, 1),
                period_end=date(2024, 5, 31)
            )
            
            for detail in report["details"]:
                period = detail.get("period", "")
                period_int = int(period.replace("-", ""))
                assert 202403 <= period_int <= 202405


class TestEdgeCases:
    """
    ATB-4: Boundary Conditions and Exception Handling Verification
    
    Validates edge case handling for depreciation calculations.
    """
    
    def test_zero_residual_value(self):
        """
        Scenario: Asset with zero residual value.
        
        Expected:
            - Net value should eventually reach zero
        """
        original_value = Decimal("100000.0000")
        residual_value = Decimal("0.0000")
        useful_life = 10
        purchase_date = date(2024, 1, 1)
        
        with patch('src.application.depreciation.services.depreciation_service.AssetRepository') as mock_repo:
            mock_asset = Asset(
                id=11,
                original_value=original_value,
                residual_value=residual_value,
                useful_life=useful_life,
                purchase_date=purchase_date,
                depreciation_method=DepreciationMethod.STRAIGHT_LINE
            )
            mock_repo.get_by_id.return_value = mock_asset
            
            service = DepreciationCalculationService(repository=mock_repo)
            result = service.get_current_net_value(asset_id=11, as_of_date=date(2034, 1, 1))
            
            assert result.net_value == Decimal("0.0000")
    
    def test_invalid_date_range(self):
        """
        Scenario: Calculation date before purchase date.
        
        Expected:
            - Should raise ValueError
        """
        purchase_date = date(2024, 1, 1)
        
        with patch('src.application.depreciation.services.depreciation_service.AssetRepository') as mock_repo:
            mock_asset = Asset(
                id=12,
                original_value=Decimal("100000.0000"),
                residual_value=Decimal("5000.0000"),
                useful_life=10,
                purchase_date=purchase_date,
                depreciation_method=DepreciationMethod.STRAIGHT_LINE
            )
            mock_repo.get_by_id.return_value = mock_asset
            
            service = DepreciationCalculationService(repository=mock_repo)
            
            with pytest.raises(ValueError, match="Calculation date cannot be before purchase date"):
                service.get_current_net_value(asset_id=12, as_of_date=date(2023, 12, 31))
    
    def test_invalid_useful_life(self):
        """
        Scenario: Useful life exceeds allowed range.
        
        Expected:
            - Should raise ValidationError
        
        Note: This test validates input validation at the model level.
        """
        from src.domain.exceptions import ValidationError
        
        with pytest.raises(ValidationError, match="Useful life must be between 1 and 50"):
            Asset(
                id=13,
                original_value=Decimal("100000.0000"),
                residual_value=Decimal("5000.0000"),
                useful_life=51,
                purchase_date=date(2024, 1, 1),
                depreciation_method=DepreciationMethod.STRAIGHT_LINE
            )
    
    def test_residual_exceeds_half_original(self):
        """
        Scenario: Residual value exceeds 50% of original value.
        
        Expected:
            - Should raise ValidationError
        """
        from src.domain.exceptions import ValidationError
        
        with pytest.raises(ValidationError, match="Residual value cannot exceed 50% of original value"):
            Asset(
                id=14,
                original_value=Decimal("100000.0000"),
                residual_value=Decimal("60000.0000"),
                useful_life=10,
                purchase_date=date(2024, 1, 1),
                depreciation_method=DepreciationMethod.STRAIGHT_LINE
            )


class TestCrossMethodConsistency:
    """
    Cross-Method Consistency Verification
    
    Ensures that different methods produce consistent results at equivalence points.
    """
    
    def test_total_depreciation_equals_original_minus_residual(self):
        """
        Scenario: Total depreciation over useful life should equal original - residual.
        
        For both methods:
            sum(all period depreciations) = original_value - residual_value
        """
        original_value = Decimal("100000.0000")
        residual_value = Decimal("10000.0000")
        useful_life = 10
        purchase_date = date(2024, 1, 1)
        
        expected_total = original_value - residual_value
        
        for method in [DepreciationMethod.STRAIGHT_LINE, DepreciationMethod.DOUBLE_DECLINING]:
            with patch('src.application.depreciation.services.depreciation_service.AssetRepository') as mock_repo:
                mock_asset = Asset(
                    id=15,
                    original_value=original_value,
                    residual_value=residual_value,
                    useful_life=useful_life,
                    purchase_date=purchase_date,
                    depreciation_method=method
                )
                mock_repo.get_by_id.return_value = mock_asset
                mock_repo.save_depreciation_records.return_value = True
                
                service = DepreciationCalculationService(repository=mock_repo)
                schedule = service.generate_monthly_schedule(asset_id=15)
                
                total_depreciation = sum(entry.monthly_depreciation for entry in schedule)
                tolerance = Decimal("0.0001")
                
                assert abs(total_depreciation - expected_total) < tolerance


if __name__ == "__main__":
    pytest.main([__file__, "-v"])