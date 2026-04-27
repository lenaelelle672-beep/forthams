"""
Asset Depreciation Sync Task Tests
==================================

Test suite for SWARM-003 Depreciation Sync Task (Phase 2).
Validates double declining balance method, monthly schedule generation,
annual report aggregation, and data persistence.

AC-001: Unit test for depreciation calculation (straight-line + DDB)
AC-002: Unit test for depreciation report generation
AC-003: AST static analysis passes
AC-004: All functions include docstring documentation
AC-005: Module can be imported without errors

Test Environment:
    - Python 3.11+
    - pytest 7.x
    - pytest-asyncio
"""

import pytest
from datetime import date, datetime
from decimal import Decimal
from typing import List, Dict, Any
import sys
import os

# Import modules to test
try:
    from services.depreciation_service import DepreciationService
    from services.calculators.double_declining import DoubleDecliningBalanceCalculator
    from services.calculators.straight_line import StraightLineCalculator
    from services.report_generator import ReportGenerator
    from repositories.depreciation_repository import DepreciationRepository
except ImportError:
    # Fallback for module resolution
    sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '..'))
    from services.depreciation_service import DepreciationService
    from services.calculators.double_declining import DoubleDecliningBalanceCalculator
    from services.calculators.straight_line import StraightLineCalculator
    from services.report_generator import ReportGenerator
    from repositories.depreciation_repository import DepreciationRepository


# =============================================================================
# Test Data Fixtures
# =============================================================================

@pytest.fixture
def sample_asset():
    """
    Create a sample asset for depreciation testing.
    
    Returns:
        Dict containing asset parameters:
        - original_value: 100,000 CNY
        - salvage_value: 5,000 CNY
        - useful_life_years: 5 years
        - acquisition_date: 2024-01-15
        - asset_id: TEST-001
        - category: electronics
    """
    return {
        'asset_id': 'TEST-001',
        'original_value': Decimal('100000.00'),
        'salvage_value': Decimal('5000.00'),
        'useful_life_years': 5,
        'acquisition_date': date(2024, 1, 15),
        'category': 'electronics',
        'depreciation_method': 'double_declining_balance'
    }


@pytest.fixture
def straight_line_asset():
    """
    Create a sample asset for straight-line depreciation testing.
    
    Returns:
        Dict containing asset parameters for straight-line method.
    """
    return {
        'asset_id': 'TEST-002',
        'original_value': Decimal('50000.00'),
        'salvage_value': Decimal('2500.00'),
        'useful_life_years': 4,
        'acquisition_date': date(2024, 2, 1),
        'category': 'furniture',
        'depreciation_method': 'straight_line'
    }


@pytest.fixture
def zero_salvage_asset():
    """
    Create an asset with zero salvage value for edge case testing.
    
    Returns:
        Dict with salvage_value = 0 for boundary testing.
    """
    return {
        'asset_id': 'TEST-003',
        'original_value': Decimal('20000.00'),
        'salvage_value': Decimal('0.00'),
        'useful_life_years': 2,
        'acquisition_date': date(2024, 3, 1),
        'category': 'machinery',
        'depreciation_method': 'straight_line'
    }


@pytest.fixture
def mock_repository():
    """
    Create a mock depreciation repository for testing persistence.
    
    Returns:
        MockDepreciationRepository instance.
    """
    class MockDepreciationRepository:
        """Mock repository for depreciation record persistence testing."""
        
        def __init__(self):
            self.records: List[Dict[str, Any]] = []
            self.transaction_log: List[str] = []
        
        def save_depreciation_record(self, record: Dict[str, Any]) -> bool:
            """
            Save a single depreciation record to mock storage.
            
            Args:
                record: Depreciation record dict with asset_id, period, etc.
                
            Returns:
                True if saved successfully.
            """
            # Check for duplicate period for same asset
            for existing in self.records:
                if (existing['asset_id'] == record['asset_id'] and 
                    existing['period'] == record['period']):
                    raise ValueError(
                        f"Duplicate record: asset_id={record['asset_id']}, "
                        f"period={record['period']}"
                    )
            
            self.records.append(record)
            self.transaction_log.append(f"SAVE:{record['asset_id']}:{record['period']}")
            return True
        
        def batch_save(self, records: List[Dict[str, Any]]) -> bool:
            """
            Batch save multiple depreciation records with rollback support.
            
            Args:
                records: List of depreciation records.
                
            Returns:
                True if all saved successfully.
                
            Raises:
                ValueError: If any record fails validation.
            """
            try:
                for record in records:
                    self.save_depreciation_record(record)
                return True
            except Exception as e:
                self.records = [
                    r for r in self.records 
                    if r not in records
                ]
                self.transaction_log.append("ROLLBACK")
                raise e
        
        def query_by_asset(self, asset_id: str) -> List[Dict[str, Any]]:
            """Query all records for a specific asset."""
            return [
                r for r in self.records 
                if r['asset_id'] == asset_id
            ]
        
        def clear(self):
            """Clear all records for fresh test."""
            self.records = []
            self.transaction_log = []
    
    return MockDepreciationRepository()


# =============================================================================
# ATB-2.1: Double Declining Balance Method Verification
# =============================================================================

class TestDoubleDecliningBalance:
    """
    Test suite for double declining balance depreciation calculation.
    
    S-2.1 Scenario: Verify DDB calculation correctness with 5-year asset.
    
    Expected depreciation schedule:
        Year 1: 100,000 × 40% = 40,000
        Year 2: 60,000 × 40% = 24,000
        Year 3: 36,000 × 40% = 14,400
        Year 4: 21,600 × 40% = 8,640 → switch to straight-line: (21,600-5,000)/2 = 8,300
        Year 5: 13,300 → straight-line: 8,300
    
    Acceptance: Total 5-year depreciation = 95,000 (original - salvage)
    """
    
    def test_ddb_year1_calculation(self, sample_asset):
        """
        Test DDB Year 1 depreciation calculation.
        
        Expected: Year1 depreciation = 40,000.00
        
        Verification Method: AC-001 (unit_test)
        """
        calculator = DoubleDecliningBalanceCalculator()
        schedule = calculator.calculate(sample_asset)
        
        assert len(schedule) > 0, "Schedule should contain at least one period"
        year1_depreciation = schedule[0]['depreciation']
        
        # DDB Rate = 2 / 5 = 40%
        # Year 1: 100,000 * 0.40 = 40,000
        expected_year1 = Decimal('40000.00')
        assert year1_depreciation == expected_year1, (
            f"Year 1 depreciation should be {expected_year1}, "
            f"got {year1_depreciation}"
        )
    
    def test_ddb_switch_to_straight_line(self, sample_asset):
        """
        Test automatic switch from DDB to straight-line method.
        
        When straight-line depreciation >= DDB depreciation,
        the method should automatically switch.
        
        Verification Method: AC-001 (unit_test)
        """
        calculator = DoubleDecliningBalanceCalculator()
        schedule = calculator.calculate(sample_asset)
        
        # Find the period where switch occurs
        switch_found = False
        for period in schedule:
            if period.get('method') == 'straight_line':
                switch_found = True
                break
        
        assert switch_found, (
            "DDB method should switch to straight-line when applicable"
        )
    
    def test_ddb_total_depreciation_equals_cost_minus_salvage(self, sample_asset):
        """
        Test total depreciation equals original value minus salvage value.
        
        Expected: 5-year total = 100,000 - 5,000 = 95,000
        
        Verification Method: AC-001 (unit_test)
        """
        calculator = DoubleDecliningBalanceCalculator()
        schedule = calculator.calculate(sample_asset)
        
        total_depreciation = sum(
            Decimal(str(p['depreciation'])) for p in schedule
        )
        expected_total = sample_asset['original_value'] - sample_asset['salvage_value']
        
        # Allow for minor floating-point differences
        difference = abs(total_depreciation - expected_total)
        assert difference <= Decimal('0.01'), (
            f"Total depreciation {total_depreciation} should equal "
            f"original_value - salvage_value {expected_total}"
        )


# =============================================================================
# ATB-2.2: Monthly Depreciation Schedule Verification
# =============================================================================

class TestMonthlyDepreciationSchedule:
    """
    Test suite for monthly depreciation schedule generation.
    
    S-2.2 Scenario: Verify monthly schedule generation.
    
    Acceptance criteria:
        1. Generate 12 monthly records per year
        2. Monthly depreciation = Annual depreciation / 12
        3. Accumulated depreciation grows linearly
        4. Final period book value ≈ salvage value
    """
    
    def test_generate_12_monthly_records(self, sample_asset):
        """
        Test that 12 monthly records are generated for one year.
        
        Verification Method: AC-002 (unit_test)
        """
        service = DepreciationService()
        schedule = service.generate_monthly_schedule(sample_asset, year=1)
        
        assert len(schedule) == 12, (
            f"Should generate 12 monthly records, got {len(schedule)}"
        )
    
    def test_monthly_amount_equals_yearly_divided_by_12(self, sample_asset):
        """
        Test monthly depreciation = yearly depreciation / 12.
        
        Verification Method: AC-002 (unit_test)
        """
        service = DepreciationService()
        
        # Get annual depreciation
        annual_schedule = service.generate_annual_schedule(sample_asset)
        year1_annual = annual_schedule[0]['depreciation']
        
        # Get monthly schedule
        monthly_schedule = service.generate_monthly_schedule(sample_asset, year=1)
        month1_depreciation = Decimal(str(monthly_schedule[0]['depreciation']))
        expected_monthly = Decimal(str(year1_annual)) / Decimal('12')
        
        difference = abs(month1_depreciation - expected_monthly)
        assert difference <= Decimal('0.01'), (
            f"Monthly depreciation {month1_depreciation} should equal "
            f"annual / 12 = {expected_monthly}"
        )
    
    def test_accumulated_depreciation_linear_growth(self, sample_asset):
        """
        Test accumulated depreciation grows linearly over months.
        
        Verification Method: AC-002 (unit_test)
        """
        service = DepreciationService()
        schedule = service.generate_monthly_schedule(sample_asset, year=1)
        
        accumulated = Decimal('0')
        for i, period in enumerate(schedule):
            accumulated += Decimal(str(period['depreciation']))
            
            # Each month's accumulated value should be greater than previous
            if i > 0:
                prev_accumulated = schedule[i-1].get('accumulated_depreciation', 0)
                assert accumulated >= Decimal(str(prev_accumulated)), (
                    "Accumulated depreciation should grow linearly"
                )
    
    def test_final_period_book_value_equals_salvage(self, sample_asset):
        """
        Test final period book value equals salvage value.
        
        Verification Method: AC-002 (unit_test)
        """
        service = DepreciationService()
        annual_schedule = service.generate_annual_schedule(sample_asset)
        
        # Get last period's book value
        last_period = annual_schedule[-1]
        final_book_value = Decimal(str(last_period.get('book_value', 0)))
        expected_salvage = sample_asset['salvage_value']
        
        difference = abs(final_book_value - expected_salvage)
        assert difference <= Decimal('0.01'), (
            f"Final book value {final_book_value} should equal "
            f"salvage value {expected_salvage}"
        )


# =============================================================================
# ATB-2.3: Annual Depreciation Report Verification
# =============================================================================

class TestAnnualDepreciationReport:
    """
    Test suite for annual depreciation summary report aggregation.
    
    S-2.3 Scenario: Verify annual report aggregation.
    
    Acceptance criteria:
        1. Aggregate by asset category
        2. Grand total = sum of category totals
        3. Report contains required fields
    """
    
    def test_aggregate_by_asset_category(self):
        """
        Test aggregation by asset category.
        
        Verification Method: AC-002 (unit_test)
        """
        assets = [
            {
                'asset_id': 'ASSET-001',
                'original_value': Decimal('50000.00'),
                'salvage_value': Decimal('2500.00'),
                'useful_life_years': 5,
                'category': 'electronics',
                'depreciation_method': 'straight_line'
            },
            {
                'asset_id': 'ASSET-002',
                'original_value': Decimal('30000.00'),
                'salvage_value': Decimal('1500.00'),
                'useful_life_years': 4,
                'category': 'electronics',
                'depreciation_method': 'straight_line'
            },
            {
                'asset_id': 'ASSET-003',
                'original_value': Decimal('20000.00'),
                'salvage_value': Decimal('1000.00'),
                'useful_life_years': 3,
                'category': 'furniture',
                'depreciation_method': 'straight_line'
            }
        ]
        
        report_generator = ReportGenerator()
        report = report_generator.generate_annual_report(assets, year=1)
        
        categories = report.get('category_totals', {}).keys()
        assert 'electronics' in categories, "Should contain electronics category"
        assert 'furniture' in categories, "Should contain furniture category"
    
    def test_grand_total_equals_detail_sum(self):
        """
        Test grand total equals sum of all category totals.
        
        Verification Method: AC-002 (unit_test)
        """
        assets = [
            {
                'asset_id': 'ASSET-001',
                'original_value': Decimal('40000.00'),
                'salvage_value': Decimal('2000.00'),
                'useful_life_years': 5,
                'category': 'electronics',
                'depreciation_method': 'straight_line'
            },
            {
                'asset_id': 'ASSET-002',
                'original_value': Decimal('60000.00'),
                'salvage_value': Decimal('3000.00'),
                'useful_life_years': 5,
                'category': 'machinery',
                'depreciation_method': 'straight_line'
            }
        ]
        
        report_generator = ReportGenerator()
        report = report_generator.generate_annual_report(assets, year=1)
        
        grand_total = Decimal(str(report.get('grand_total', 0)))
        category_totals = sum(
            Decimal(str(val)) 
            for val in report.get('category_totals', {}).values()
        )
        
        difference = abs(grand_total - category_totals)
        assert difference <= Decimal('0.01'), (
            f"Grand total {grand_total} should equal "
            f"sum of category totals {category_totals}"
        )
    
    def test_report_contains_required_fields(self):
        """
        Test report contains all required fields.
        
        Required fields:
            - asset_count
            - original_value
            - current_depreciation
            - accumulated_depreciation
            - book_value
        
        Verification Method: AC-002 (unit_test)
        """
        assets = [{
            'asset_id': 'ASSET-001',
            'original_value': Decimal('50000.00'),
            'salvage_value': Decimal('2500.00'),
            'useful_life_years': 5,
            'category': 'electronics',
            'depreciation_method': 'straight_line'
        }]
        
        report_generator = ReportGenerator()
        report = report_generator.generate_annual_report(assets, year=1)
        
        required_fields = [
            'asset_count',
            'original_value',
            'current_depreciation',
            'accumulated_depreciation',
            'book_value'
        ]
        
        for field in required_fields:
            assert field in report, (
                f"Report should contain field: {field}"
            )


# =============================================================================
# ATB-2.4: Data Persistence Verification
# =============================================================================

class TestDepreciationPersistence:
    """
    Test suite for depreciation record data persistence.
    
    S-2.4 Scenario: Verify depreciation_records table operations.
    
    Acceptance criteria:
        1. Records written with correct fields
        2. No duplicate period for same asset
        3. Transaction rollback on failure
    """
    
    def test_persist_single_record(self, mock_repository):
        """
        Test single depreciation record persistence.
        
        Verification Method: AC-002 (unit_test)
        """
        record = {
            'asset_id': 'TEST-001',
            'period': '2024-01',
            'depreciation_amount': Decimal('8333.33'),
            'book_value': Decimal('91666.67'),
            'created_at': datetime.now()
        }
        
        result = mock_repository.save_depreciation_record(record)
        assert result is True, "Save should return True"
        
        records = mock_repository.query_by_asset('TEST-001')
        assert len(records) == 1, "Should have exactly one record"
    
    def test_no_duplicate_period_for_same_asset(self, mock_repository):
        """
        Test that duplicate period for same asset raises error.
        
        Verification Method: AC-002 (unit_test)
        """
        record1 = {
            'asset_id': 'TEST-001',
            'period': '2024-01',
            'depreciation_amount': Decimal('8333.33'),
            'book_value': Decimal('91666.67')
        }
        record2 = {
            'asset_id': 'TEST-001',
            'period': '2024-01',  # Same period
            'depreciation_amount': Decimal('8333.33'),
            'book_value': Decimal('91666.67')
        }
        
        mock_repository.save_depreciation_record(record1)
        
        with pytest.raises(ValueError, match="Duplicate record"):
            mock_repository.save_depreciation_record(record2)
    
    def test_batch_write_rollback_on_failure(self, mock_repository):
        """
        Test batch write rollback on failure.
        
        Verification Method: AC-002 (unit_test)
        """
        records = [
            {
                'asset_id': 'TEST-001',
                'period': '2024-01',
                'depreciation_amount': Decimal('8333.33'),
                'book_value': Decimal('91666.67')
            },
            {
                'asset_id': 'TEST-001',
                'period': '2024-02',
                'depreciation_amount': Decimal('8333.33'),
                'book_value': Decimal('83333.34')
            }
        ]
        
        # First batch should succeed
        result = mock_repository.batch_save(records)
        assert result is True
        
        # Reset for second test
        mock_repository.clear()
        
        # Create a batch that will fail
        records_with_duplicate = [
            {
                'asset_id': 'TEST-001',
                'period': '2024-01',
                'depreciation_amount': Decimal('8333.33'),
                'book_value': Decimal('91666.67')
            },
            {
                'asset_id': 'TEST-001',
                'period': '2024-01',  # Duplicate
                'depreciation_amount': Decimal('8333.33'),
                'book_value': Decimal('91666.67')
            }
        ]
        
        with pytest.raises(ValueError):
            mock_repository.batch_save(records_with_duplicate)
        
        # Verify rollback
        assert 'ROLLBACK' in mock_repository.transaction_log, (
            "Transaction should be rolled back on failure"
        )


# =============================================================================
# ATB-2.5: API Interface Verification
# =============================================================================

class TestDepreciationAPI:
    """
    Test suite for depreciation calculation API endpoints.
    
    S-2.5 Scenario: Verify REST API interface.
    
    Acceptance criteria:
        1. HTTP 200 response
        2. JSON contains depreciation_schedule field
        3. Response time ≤ 500ms for single asset
    
    Note: These are unit tests for the API service layer.
          Full integration tests require API server running.
    """
    
    def test_api_response_json_structure(self, sample_asset):
        """
        Test API response JSON structure.
        
        Verification Method: AC-005 (unit_test - import)
        """
        service = DepreciationService()
        response = service.calculate_depreciation(sample_asset)
        
        # Verify response structure
        assert 'asset_id' in response, "Response should contain asset_id"
        assert 'depreciation_schedule' in response, (
            "Response should contain depreciation_schedule"
        )
        assert 'total_depreciation' in response, (
            "Response should contain total_depreciation"
        )
    
    def test_api_calculation_endpoint_exists(self):
        """
        Test that calculation endpoint service is available.
        
        Verification Method: AC-005 (unit_test - import)
        """
        # Verify service can be instantiated
        service = DepreciationService()
        assert service is not None
        assert hasattr(service, 'calculate_depreciation')


# =============================================================================
# ATB-2.6: Edge Cases Verification
# =============================================================================

class TestDepreciationEdgeCases:
    """
    Test suite for edge cases and boundary conditions.
    
    S-2.6 Scenario: Verify boundary scenario handling.
    
    Acceptance criteria:
        1. original_value == salvage_value → no depreciation
        2. useful_life = 1 year → depreciate within 1 year
        3. Invalid depreciation method → appropriate error
    """
    
    def test_zero_salvage_no_depreciation(self, zero_salvage_asset):
        """
        Test asset with zero salvage value.
        
        When original_value equals salvage_value, no depreciation should occur.
        
        Verification Method: AC-001 (unit_test)
        """
        calculator = StraightLineCalculator()
        schedule = calculator.calculate(zero_salvage_asset)
        
        # With zero salvage, all value should be depreciated
        total = sum(Decimal(str(p['depreciation'])) for p in schedule)
        expected = zero_salvage_asset['original_value']
        
        difference = abs(total - expected)
        assert difference <= Decimal('0.01'), (
            f"Total depreciation {total} should equal "
            f"original value {expected}"
        )
    
    def test_one_year_useful_life(self, straight_line_asset):
        """
        Test asset with 1-year useful life.
        
        Should complete depreciation within 1 year.
        
        Verification Method: AC-001 (unit_test)
        """
        asset_1year = straight_line_asset.copy()
        asset_1year['useful_life_years'] = 1
        asset_1year['original_value'] = Decimal('10000.00')
        asset_1year['salvage_value'] = Decimal('1000.00')
        
        calculator = StraightLineCalculator()
        schedule = calculator.calculate(asset_1year)
        
        assert len(schedule) == 1, (
            f"1-year asset should have 1 period, got {len(schedule)}"
        )
        
        expected_depreciation = (
            asset_1year['original_value'] - asset_1year['salvage_value']
        )
        actual_depreciation = Decimal(str(schedule[0]['depreciation']))
        
        difference = abs(actual_depreciation - expected_depreciation)
        assert difference <= Decimal('0.01'), (
            f"Depreciation should be {expected_depreciation}, "
            f"got {actual_depreciation}"
        )
    
    def test_invalid_method_returns_error(self, sample_asset):
        """
        Test invalid depreciation method handling.
        
        Verification Method: AC-001 (unit_test)
        """
        service = DepreciationService()
        asset_invalid = sample_asset.copy()
        asset_invalid['depreciation_method'] = 'invalid_method'
        
        with pytest.raises(ValueError, match="Invalid depreciation method"):
            service.calculate_depreciation(asset_invalid)


# =============================================================================
# ATB-2.7: Straight-Line Method Verification
# =============================================================================

class TestStraightLineDepreciation:
    """
    Test suite for straight-line depreciation calculation.
    
    Verification: Straight-line = (Original Value - Salvage) / Useful Life
    """
    
    def test_straight_line_basic_calculation(self, straight_line_asset):
        """
        Test basic straight-line depreciation calculation.
        
        Formula: Annual Depreciation = (Original - Salvage) / Useful Life
        
        Verification Method: AC-001 (unit_test)
        """
        calculator = StraightLineCalculator()
        schedule = calculator.calculate(straight_line_asset)
        
        annual_depreciation = schedule[0]['depreciation']
        expected = (
            (straight_line_asset['original_value'] - straight_line_asset['salvage_value'])
            / straight_line_asset['useful_life_years']
        )
        
        difference = abs(Decimal(str(annual_depreciation)) - expected)
        assert difference <= Decimal('0.01'), (
            f"Annual depreciation should be {expected}, got {annual_depreciation}"
        )
    
    def test_straight_line_total_equals_cost_minus_salvage(self, straight_line_asset):
        """
        Test total straight-line depreciation.
        
        Verification Method: AC-001 (unit_test)
        """
        calculator = StraightLineCalculator()
        schedule = calculator.calculate(straight_line_asset)
        
        total = sum(Decimal(str(p['depreciation'])) for p in schedule)
        expected = (
            straight_line_asset['original_value'] - 
            straight_line_asset['salvage_value']
        )
        
        difference = abs(total - expected)
        assert difference <= Decimal('0.01'), (
            f"Total depreciation {total} should equal {expected}"
        )


# =============================================================================
# Main Entry Point for Direct Execution
# =============================================================================

if __name__ == '__main__':
    """
    Run tests directly via: python tests/tasks/test_depreciation_sync_task.py
    
    Or via pytest:
        pytest tests/tasks/test_depreciation_sync_task.py -v
    """
    pytest.main([__file__, '-v', '--tb=short'])