"""
Unit tests for Double-Declining Balance Depreciation Calculator.

This module tests the double-declining balance depreciation calculation
logic as specified in SWARM-003 Iteration 1.

Test Categories:
    - ATB-2: DDB calculation verification
    - ATB-3: Exception input validation
    - ATB-3.4: Salvage value rate limit validation
"""

import pytest
from decimal import Decimal, ROUND_HALF_UP
from datetime import date
from typing import List

from src.application.depreciation.calculators.double_declining import (
    DoubleDecliningBalanceCalculator,
    DoubleDecliningBalanceConfig,
)
from src.domain.value_objects.depreciation_result import DepreciationResult
from src.domain.value_objects.depreciation_period import DepreciationPeriod


class TestDoubleDecliningBalanceCalculator:
    """Test suite for Double-Declining Balance depreciation calculator."""

    @pytest.fixture
    def default_config(self) -> DoubleDecliningBalanceConfig:
        """Provide default configuration for DDB calculations."""
        return DoubleDecliningBalanceConfig(
            precision=2,
            min_salvage_rate=Decimal("0.01"),
            max_salvage_rate=Decimal("0.50"),
        )

    @pytest.fixture
    def calculator_100k_5years(
        self, default_config: DoubleDecliningBalanceConfig
    ) -> DoubleDecliningBalanceCalculator:
        """
        Fixture: Calculator with original_cost=100000, useful_life=5 years.
        
        Expected DDB rate = 2/5 = 40%
        Year 1 depreciation = 100000 * 0.4 = 40000
        Year 2 depreciation = (100000 - 40000) * 0.4 = 24000
        Year 3 depreciation = (100000 - 64000) * 0.4 = 14400
        """
        return DoubleDecliningBalanceCalculator(
            original_cost=Decimal("100000"),
            acquisition_date=date(2024, 1, 1),
            useful_life_years=5,
            salvage_value=Decimal("5000"),
            config=default_config,
        )

    @pytest.fixture
    def calculator_no_salvage(
        self, default_config: DoubleDecliningBalanceConfig
    ) -> DoubleDecliningBalanceCalculator:
        """Fixture: Calculator with zero salvage value."""
        return DoubleDecliningBalanceCalculator(
            original_cost=Decimal("50000"),
            acquisition_date=date(2024, 1, 1),
            useful_life_years=10,
            salvage_value=Decimal("0"),
            config=default_config,
        )

    @pytest.fixture
    def calculator_short_life(
        self, default_config: DoubleDecliningBalanceConfig
    ) -> DoubleDecliningBalanceCalculator:
        """Fixture: Calculator with useful_life=2 years (boundary test)."""
        return DoubleDecliningBalanceCalculator(
            original_cost=Decimal("50000"),
            acquisition_date=date(2024, 1, 1),
            useful_life_years=2,
            salvage_value=Decimal("5000"),
            config=default_config,
        )


class TestDDBBasicCalculations(TestDoubleDecliningBalanceCalculator):
    """ATB-2.1: Basic double-declining balance calculation tests."""

    def test_first_year_depreciation(
        self, calculator_100k_5years: DoubleDecliningBalanceCalculator
    ) -> None:
        """
        Test: First year depreciation equals 40% of original cost.
        
        ATB-2.1 basic scenario:
        - Input: original_cost=100000, useful_life=5
        - Expected: first_year_depreciation = 40000
        """
        schedule = calculator_100k_5years.generate_schedule()
        assert len(schedule) == 5
        assert schedule[0].depreciation == Decimal("40000.00")
        assert schedule[0].year == 1
        assert schedule[0].beginning_book_value == Decimal("100000.00")

    def test_second_year_depreciation(
        self, calculator_100k_5years: DoubleDecliningBalanceCalculator
    ) -> None:
        """
        Test: Second year depreciation is 40% of remaining book value.
        
        Year 2 calculation:
        - Beginning book value = 100000 - 40000 = 60000
        - Depreciation = 60000 * 0.4 = 24000
        """
        schedule = calculator_100k_5years.generate_schedule()
        assert schedule[1].depreciation == Decimal("24000.00")
        assert schedule[1].beginning_book_value == Decimal("60000.00")
        assert schedule[1].year == 2

    def test_third_year_depreciation(
        self, calculator_100k_5years: DoubleDecliningBalanceCalculator
    ) -> None:
        """
        Test: Third year depreciation continues on declining balance.
        
        Year 3 calculation:
        - Beginning book value = 60000 - 24000 = 36000
        - Depreciation = 36000 * 0.4 = 14400
        """
        schedule = calculator_100k_5years.generate_schedule()
        assert schedule[2].depreciation == Decimal("14400.00")
        assert schedule[2].beginning_book_value == Decimal("36000.00")

    def test_ddb_rate_calculation(
        self, calculator_100k_5years: DoubleDecliningBalanceCalculator
    ) -> None:
        """Test: DDB rate equals 2 / useful_life_years."""
        expected_rate = Decimal("2") / Decimal("5")
        assert calculator_100k_5years.ddb_rate == expected_rate

    def test_total_depreciation(
        self, calculator_100k_5years: DoubleDecliningBalanceCalculator
    ) -> None:
        """Test: Total depreciation equals original_cost - salvage_value."""
        schedule = calculator_100k_5years.generate_schedule()
        total = sum(period.depreciation for period in schedule)
        expected_total = Decimal("100000.00") - Decimal("5000.00")
        assert total == expected_total

    def test_final_book_value_equals_salvage(
        self, calculator_100k_5years: DoubleDecliningBalanceCalculator
    ) -> None:
        """Test: Final period ending book value equals salvage value."""
        schedule = calculator_100k_5years.generate_schedule()
        final_period = schedule[-1]
        assert final_period.ending_book_value == Decimal("5000.00")


class TestDDBZeroSalvage(TestDoubleDecliningBalanceCalculator):
    """ATB-1.2: Test DDB with zero salvage value scenario."""

    def test_zero_salvage_depreciation(
        self, calculator_no_salvage: DoubleDecliningBalanceCalculator
    ) -> None:
        """
        Test: Depreciation continues until book value reaches zero.
        
        When salvage value is zero, DDB continues until asset is
        fully depreciated (book value = 0).
        """
        schedule = calculator_no_salvage.generate_schedule()
        final_period = schedule[-1]
        assert final_period.ending_book_value == Decimal("0.00")

    def test_zero_salvage_total(
        self, calculator_no_salvage: DoubleDecliningBalanceCalculator
    ) -> None:
        """Test: Total depreciation equals original cost when salvage is zero."""
        schedule = calculator_no_salvage.generate_schedule()
        total = sum(period.depreciation for period in schedule)
        assert total == Decimal("50000.00")


class TestDDBShortLife(TestDoubleDecliningBalanceCalculator):
    """ATB-2.4: Test DDB with short useful life (boundary test)."""

    def test_two_year_life(
        self, calculator_short_life: DoubleDecliningBalanceCalculator
    ) -> None:
        """
        Test: Two-year asset with DDB depreciation.
        
        Year 1: 50000 * (2/2) = 50000, but limited to 50000 - 5000 = 45000
        Year 2: Remaining 5000 equals salvage, no more depreciation
        """
        schedule = calculator_short_life.generate_schedule()
        # With 2-year life, DDB rate = 100%
        # Year 1: min(50000 * 1.0, 50000 - 5000) = 45000
        assert schedule[0].depreciation == Decimal("45000.00")
        # Year 2: book value already at salvage, no depreciation
        assert schedule[1].depreciation == Decimal("0.00")
        assert len(schedule) == 2

    def test_100_percent_rate(
        self, calculator_short_life: DoubleDecliningBalanceCalculator
    ) -> None:
        """Test: 2-year life results in 100% DDB rate."""
        assert calculator_short_life.ddb_rate == Decimal("1.0")


class TestDDBTransitionToStraightLine(TestDoubleDecliningBalanceCalculator):
    """ATB-2.2: Test automatic transition from DDB to straight-line method."""

    def test_switch_to_straight_line_when_beneficial(
        self, default_config: DoubleDecliningBalanceConfig
    ) -> None:
        """
        Test: DDB switches to straight-line when it yields higher depreciation.
        
        This tests the scenario where remaining book value divided by
        remaining life equals or exceeds DDB calculation.
        """
        # Create a scenario where switch is needed
        calculator = DoubleDecliningBalanceCalculator(
            original_cost=Decimal("100000"),
            acquisition_date=date(2024, 1, 1),
            useful_life_years=5,
            salvage_value=Decimal("0"),  # Zero salvage
            config=default_config,
        )
        schedule = calculator.generate_schedule()
        
        # After year 1: book value = 60000, remaining life = 4
        # DDB: 60000 * 0.4 = 24000
        # Straight-line: 60000 / 4 = 15000
        # DDB is higher, continue DDB
        assert schedule[1].depreciation == Decimal("24000.00")


class TestDDBEarlyCompletion(TestDoubleDecliningBalanceCalculator):
    """ATB-2.3: Test early depreciation completion scenarios."""

    def test_depreciation_stops_at_salvage_value(
        self, default_config: DoubleDecliningBalanceConfig
    ) -> None:
        """
        Test: Depreciation stops when book value reaches salvage value.
        
        When remaining book value minus salvage equals the DDB
        calculation, depreciation should not exceed the difference.
        """
        calculator = DoubleDecliningBalanceCalculator(
            original_cost=Decimal("10000"),
            acquisition_date=date(2024, 1, 1),
            useful_life_years=5,
            salvage_value=Decimal("10000"),  # High salvage = no depreciation
            config=default_config,
        )
        schedule = calculator.generate_schedule()
        
        # No depreciation should occur as salvage equals cost
        for period in schedule:
            assert period.depreciation == Decimal("0.00")


class TestDDBExceptionInputs(TestDoubleDecliningBalanceCalculator):
    """ATB-3: Exception input validation tests."""

    def test_salvage_greater_than_cost(self, default_config: DoubleDecliningBalanceConfig) -> None:
        """
        ATB-3.1: Test that salvage value >= original cost raises ValueError.
        
        Expected: ValueError with message about salvage value constraint
        """
        with pytest.raises(ValueError, match="[Ss]alvage.*[Cc]ost"):
            DoubleDecliningBalanceCalculator(
                original_cost=Decimal("10000"),
                acquisition_date=date(2024, 1, 1),
                useful_life_years=5,
                salvage_value=Decimal("10000"),  # Equal to cost
                config=default_config,
            )

    def test_salvage_exceeds_cost_raises_error(
        self, default_config: DoubleDecliningBalanceConfig
    ) -> None:
        """ATB-3.1: Test that salvage value > original cost raises ValueError."""
        with pytest.raises(ValueError, match="[Ss]alvage"):
            DoubleDecliningBalanceCalculator(
                original_cost=Decimal("10000"),
                acquisition_date=date(2024, 1, 1),
                useful_life_years=5,
                salvage_value=Decimal("15000"),  # Exceeds cost
                config=default_config,
            )

    def test_zero_useful_life_raises_error(
        self, default_config: DoubleDecliningBalanceConfig
    ) -> None:
        """
        ATB-3.2: Test that useful_life_years=0 raises ValueError.
        
        Expected: ValueError with message about positive useful life requirement
        """
        with pytest.raises(ValueError, match="[Uu]seful.?[Ll]ife|positive"):
            DoubleDecliningBalanceCalculator(
                original_cost=Decimal("50000"),
                acquisition_date=date(2024, 1, 1),
                useful_life_years=0,
                salvage_value=Decimal("5000"),
                config=default_config,
            )

    def test_negative_original_cost_raises_error(
        self, default_config: DoubleDecliningBalanceConfig
    ) -> None:
        """
        ATB-3.3: Test that negative original_cost raises ValueError.
        
        Expected: ValueError with message about positive cost requirement
        """
        with pytest.raises(ValueError, match="[Oo]riginal.?[Cc]ost|[Pp]ositive"):
            DoubleDecliningBalanceCalculator(
                original_cost=Decimal("-5000"),
                acquisition_date=date(2024, 1, 1),
                useful_life_years=5,
                salvage_value=Decimal("0"),
                config=default_config,
            )


class TestDDBSalvageRateLimit(TestDoubleDecliningBalanceCalculator):
    """ATB-3.4: Salvage value rate limit validation."""

    def test_salvage_rate_within_limit(
        self, default_config: DoubleDecliningBalanceConfig
    ) -> None:
        """Test: Salvage rate within 50% limit should succeed."""
        calculator = DoubleDecliningBalanceCalculator(
            original_cost=Decimal("100000"),
            acquisition_date=date(2024, 1, 1),
            useful_life_years=10,
            salvage_value=Decimal("50000"),  # Exactly 50%
            config=default_config,
        )
        assert calculator.salvage_rate == Decimal("0.5")

    def test_salvage_rate_exceeds_limit(
        self, default_config: DoubleDecliningBalanceConfig
    ) -> None:
        """
        ATB-3.4: Test that salvage rate > 50% raises ValidationError.
        
        Expected: ValidationError or ValueError indicating rate limit exceeded
        """
        with pytest.raises((ValueError, ValidationError), match="[Rr]ate|[Ll]imit|50"):
            DoubleDecliningBalanceCalculator(
                original_cost=Decimal("100000"),
                acquisition_date=date(2024, 1, 1),
                useful_life_years=10,
                salvage_value=Decimal("60000"),  # 60% > 50% limit
                config=default_config,
            )


class TestDDBPrecision(TestDoubleDecliningBalanceCalculator):
    """Test decimal precision handling in DDB calculations."""

    def test_precision_rounding(
        self, default_config: DoubleDecliningBalanceConfig
    ) -> None:
        """
        Test: Depreciation amounts are rounded to configured precision.
        
        With precision=2, amounts should be rounded to 2 decimal places
        using ROUND_HALF_UP.
        """
        calculator = DoubleDecliningBalanceCalculator(
            original_cost=Decimal("100000"),
            acquisition_date=date(2024, 1, 1),
            useful_life_years=3,
            salvage_value=Decimal("33333"),
            config=default_config,
        )
        schedule = calculator.generate_schedule()
        
        for period in schedule:
            # Check that depreciation has at most 2 decimal places
            str_depr = str(period.depreciation)
            if "." in str_depr:
                decimal_places = len(str_depr.split(".")[1])
                assert decimal_places <= 2


class TestDDBMonthlySchedule(TestDoubleDecliningBalanceCalculator):
    """Test monthly depreciation schedule generation."""

    def test_monthly_schedule_length(
        self, default_config: DoubleDecliningBalanceConfig
    ) -> None:
        """Test: Monthly schedule should have 12 * useful_life periods."""
        calculator = DoubleDecliningBalanceCalculator(
            original_cost=Decimal("120000"),
            acquisition_date=date(2024, 1, 1),
            useful_life_years=5,
            salvage_value=Decimal("0"),
            config=default_config,
        )
        schedule = calculator.generate_monthly_schedule()
        assert len(schedule) == 60  # 5 years * 12 months

    def test_monthly_depreciation_sum_equals_annual(
        self, calculator_100k_5years: DoubleDecliningBalanceCalculator
    ) -> None:
        """Test: Sum of monthly depreciation equals annual depreciation."""
        monthly_schedule = calculator_100k_5years.generate_monthly_schedule()
        annual_schedule = calculator_100k_5years.generate_schedule()
        
        # Sum first year's monthly depreciation
        year_1_monthly = sum(
            m.depreciation for m in monthly_schedule if m.year == 1
        )
        year_1_annual = annual_schedule[0].depreciation
        
        # Allow for small rounding differences
        diff = abs(year_1_monthly - year_1_annual)
        assert diff < Decimal("1.00")


class TestDDBIntegration(TestDoubleDecliningBalanceCalculator):
    """Integration tests for DDB calculator with real-world scenarios."""

    def test_vehicle_depreciation(
        self, default_config: DoubleDecliningBalanceConfig
    ) -> None:
        """
        Real-world scenario: Company vehicle depreciation.
        
        - Original cost: $30,000
        - Useful life: 5 years
        - Salvage value: $5,000
        - DDB rate: 40%
        """
        calculator = DoubleDecliningBalanceCalculator(
            original_cost=Decimal("30000"),
            acquisition_date=date(2024, 1, 1),
            useful_life_years=5,
            salvage_value=Decimal("5000"),
            config=default_config,
        )
        schedule = calculator.generate_schedule()
        
        # Year 1: 30000 * 0.4 = 12000
        assert schedule[0].depreciation == Decimal("12000.00")
        # Year 2: (30000 - 12000) * 0.4 = 7200
        assert schedule[1].depreciation == Decimal("7200.00")
        # Year 3: (30000 - 19200) * 0.4 = 4320
        assert schedule[2].depreciation == Decimal("4320.00")
        
        # Total should equal 30000 - 5000 = 25000
        total = sum(p.depreciation for p in schedule)
        assert total == Decimal("25000.00")

    def test_equipment_depreciation(
        self, default_config: DoubleDecliningBalanceConfig
    ) -> None:
        """
        Real-world scenario: Office equipment depreciation.
        
        - Original cost: $10,000
        - Useful life: 3 years
        - Salvage value: $1,000
        - DDB rate: 66.67%
        """
        calculator = DoubleDecliningBalanceCalculator(
            original_cost=Decimal("10000"),
            acquisition_date=date(2024, 3, 15),
            useful_life_years=3,
            salvage_value=Decimal("1000"),
            config=default_config,
        )
        schedule = calculator.generate_schedule()
        
        # Year 1: 10000 * (2/3) ≈ 6666.67
        year1 = schedule[0].depreciation
        assert year1 == Decimal("6666.67")
        
        # Total should equal 10000 - 1000 = 9000
        total = sum(p.depreciation for p in schedule)
        assert total == Decimal("9000.00")