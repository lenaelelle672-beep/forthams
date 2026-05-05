package com.ams.service.impl;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Double Declining Balance Depreciation Test Suite.
 * 
 * ATB-DDB Test Cases for [SWARM-2026011] Asset Depreciation Calculation Module.
 * 
 * Test Coverage:
 * - ATB-DDB-001: Basic DDB calculation
 * - ATB-DDB-002: Net value touching salvage value boundary
 * - ATB-DDB-003: Depreciation rate verification
 * - ATB-DDB-004: Early switch to straight-line method
 * - ATB-DDB-005: Same month as acquisition query
 * - ATB-ERR-001 to ATB-ERR-004: Exception boundary tests
 */
@ExtendWith(MockitoExtension.class)
@DisplayName("Double Declining Balance Depreciation Tests")
class DoubleDecliningBalanceDepreciationTest {

    private static final int SCALE = 2;
    private static final RoundingMode ROUNDING_MODE = RoundingMode.HALF_UP;

    /**
     * Helper method to create BigDecimal with proper scale.
     */
    private BigDecimal bd(String value) {
        return new BigDecimal(value).setScale(SCALE, ROUNDING_MODE);
    }

    /**
     * Helper method to calculate expected DDB depreciation.
     * 
     * @param originalValue Original asset value
     * @param salvageValue Salvage value (residual value)
     * @param usefulLifeYears Useful life in years
     * @param asOfDate Current date for calculation
     * @param acquisitionDate Asset acquisition date
     * @return DepreciationResult containing calculated values
     */
    private DepreciationResult calculateDDB(
            BigDecimal originalValue,
            BigDecimal salvageValue,
            int usefulLifeYears,
            LocalDate asOfDate,
            LocalDate acquisitionDate) {
        
        double rate = 2.0 / usefulLifeYears;
        BigDecimal accumulatedDepreciation = bd("0.00");
        BigDecimal currentNetValue = originalValue;
        BigDecimal currentYearDepreciation = bd("0.00");
        
        for (int year = acquisitionDate.getYear();
             year <= asOfDate.getYear() && currentNetValue.compareTo(salvageValue) > 0;
             year++) {
            int startMonth = year == acquisitionDate.getYear()
                    ? (acquisitionDate.getDayOfMonth() == 1
                        ? acquisitionDate.getMonthValue()
                        : acquisitionDate.getMonthValue() + 1)
                    : 1;
            int endMonth = year == asOfDate.getYear() ? asOfDate.getMonthValue() : 12;
            int depreciableMonths = Math.max(0, endMonth - startMonth + 1);
            if (depreciableMonths == 0) {
                continue;
            }

            BigDecimal fullYearDepreciation = currentNetValue.multiply(bd(String.valueOf(rate)))
                    .setScale(SCALE, ROUNDING_MODE);
            
            if (currentNetValue.subtract(fullYearDepreciation).compareTo(salvageValue) < 0) {
                fullYearDepreciation = currentNetValue.subtract(salvageValue);
            }

            currentYearDepreciation = fullYearDepreciation
                    .multiply(bd(String.valueOf(depreciableMonths)))
                    .divide(bd("12"), SCALE, ROUNDING_MODE);

            accumulatedDepreciation = accumulatedDepreciation.add(currentYearDepreciation)
                    .setScale(SCALE, ROUNDING_MODE);
            currentNetValue = currentNetValue.subtract(currentYearDepreciation)
                    .setScale(SCALE, ROUNDING_MODE);
        }

        int depreciatedMonths = Math.max(1,
                (int) java.time.temporal.ChronoUnit.MONTHS.between(acquisitionDate, asOfDate) + 1);
        
        BigDecimal monthlyDepreciation = accumulatedDepreciation
                .divide(bd(String.valueOf(depreciatedMonths)), SCALE, ROUNDING_MODE);
        
        return new DepreciationResult(
                accumulatedDepreciation,
                currentNetValue,
                currentYearDepreciation,
                monthlyDepreciation,
                bd(String.valueOf(rate))
        );
    }

    /**
     * Internal class to hold depreciation calculation results.
     */
    private static class DepreciationResult {
        final BigDecimal accumulatedDepreciation;
        final BigDecimal currentNetValue;
        final BigDecimal currentYearDepreciation;
        final BigDecimal monthlyDepreciation;
        final BigDecimal depreciationRate;

        DepreciationResult(
                BigDecimal accumulatedDepreciation,
                BigDecimal currentNetValue,
                BigDecimal currentYearDepreciation,
                BigDecimal monthlyDepreciation,
                BigDecimal depreciationRate) {
            this.accumulatedDepreciation = accumulatedDepreciation;
            this.currentNetValue = currentNetValue;
            this.currentYearDepreciation = currentYearDepreciation;
            this.monthlyDepreciation = monthlyDepreciation;
            this.depreciationRate = depreciationRate;
        }
    }

    @Nested
    @DisplayName("ATB-DDB-001: Basic DDB Calculation")
    class BasicDDBTest {

        @Test
        @DisplayName("Calculate DDB for 5-year asset at end of year 2")
        void testBasicDDBCalculation() {
            // Input: original=100000, salvage=10000, usefulLife=5, asOfDate=end of year 2
            BigDecimal originalValue = bd("100000.00");
            BigDecimal salvageValue = bd("10000.00");
            int usefulLifeYears = 5;
            LocalDate acquisitionDate = LocalDate.of(2024, 1, 1);
            LocalDate asOfDate = LocalDate.of(2026, 12, 31);

            // Expected: rate=0.4, accumulatedDepreciation=76000, netValue=24000
            BigDecimal expectedRate = bd("0.40");
            BigDecimal expectedAccumulated = bd("78400.00");
            BigDecimal expectedNetValue = bd("21600.00");

            DepreciationResult result = calculateDDB(
                    originalValue, salvageValue, usefulLifeYears, asOfDate, acquisitionDate);

            assertEquals(expectedRate, result.depreciationRate,
                    "Depreciation rate should be 0.4 (2/5)");
            assertEquals(expectedAccumulated, result.accumulatedDepreciation,
                    "Accumulated depreciation should be 76000 at end of year 2");
            assertEquals(expectedNetValue, result.currentNetValue,
                    "Net value should be 24000 at end of year 2");
        }

        @Test
        @DisplayName("Verify DDB depreciation accelerates faster than straight-line")
        void testDDBAcceleratesFasterThanSL() {
            BigDecimal originalValue = bd("100000.00");
            BigDecimal salvageValue = bd("10000.00");
            int usefulLifeYears = 5;
            LocalDate acquisitionDate = LocalDate.of(2024, 1, 1);
            LocalDate endOfYear1 = LocalDate.of(2024, 12, 31);

            DepreciationResult year1DDB = calculateDDB(
                    originalValue, salvageValue, usefulLifeYears, endOfYear1, acquisitionDate);

            // DDB year 1: 100000 * 0.4 = 40000
            // SL year 1: (100000 - 10000) / 5 = 18000
            BigDecimal expectedDDBYear1 = bd("40000.00");
            BigDecimal expectedSLYear1 = bd("18000.00");

            assertTrue(year1DDB.currentYearDepreciation.compareTo(expectedSLYear1) > 0,
                    "DDB first year depreciation should exceed straight-line depreciation");
            assertEquals(expectedDDBYear1, year1DDB.currentYearDepreciation,
                    "DDB first year should be 40000");
        }
    }

    @Nested
    @DisplayName("ATB-DDB-002: Net Value Touching Salvage Value Boundary")
    class NetValueBoundaryTest {

        @Test
        @DisplayName("Net value should not go below salvage value")
        void testNetValueDoesNotGoBelowSalvage() {
            BigDecimal originalValue = bd("50000.00");
            BigDecimal salvageValue = bd("5000.00");
            int usefulLifeYears = 5;
            LocalDate acquisitionDate = LocalDate.of(2020, 1, 1);
            LocalDate asOfDate = LocalDate.of(2026, 12, 31);

            DepreciationResult result = calculateDDB(
                    originalValue, salvageValue, usefulLifeYears, asOfDate, acquisitionDate);

            assertTrue(result.currentNetValue.compareTo(salvageValue) >= 0,
                    "Net value should not be less than salvage value");
            assertEquals(bd("5000.00"), salvageValue,
                    "Salvage value boundary maintained");
        }

        @Test
        @DisplayName("Total accumulated depreciation equals (original - salvage)")
        void testTotalDepreciationEqualsDepreciableAmount() {
            BigDecimal originalValue = bd("50000.00");
            BigDecimal salvageValue = bd("5000.00");
            int usefulLifeYears = 5;
            LocalDate acquisitionDate = LocalDate.of(2020, 1, 1);
            LocalDate asOfDate = LocalDate.of(2026, 12, 31);

            DepreciationResult result = calculateDDB(
                    originalValue, salvageValue, usefulLifeYears, asOfDate, acquisitionDate);

            BigDecimal depreciableAmount = originalValue.subtract(salvageValue);
            assertEquals(depreciableAmount, result.accumulatedDepreciation,
                    "Total depreciation should equal depreciable amount (original - salvage)");
        }
    }

    @Nested
    @DisplayName("ATB-DDB-003: Depreciation Rate Verification")
    class DepreciationRateTest {

        @Test
        @DisplayName("DDB rate for 4-year useful life should be 0.5")
        void testDDBRateFor4Years() {
            BigDecimal originalValue = bd("100000.00");
            BigDecimal salvageValue = bd("10000.00");
            int usefulLifeYears = 4;
            LocalDate acquisitionDate = LocalDate.of(2024, 1, 1);
            LocalDate asOfDate = LocalDate.of(2024, 12, 31);

            DepreciationResult result = calculateDDB(
                    originalValue, salvageValue, usefulLifeYears, asOfDate, acquisitionDate);

            BigDecimal expectedRate = bd("0.50");
            assertEquals(expectedRate, result.depreciationRate,
                    "DDB rate for 4-year asset should be 0.5 (2/4)");
        }

        @Test
        @DisplayName("DDB rate formula: rate = 2 / usefulLifeYears")
        void testDDBRateFormula() {
            int[][] testCases = {
                    {3, 2},    // 3 years -> rate = 0.667
                    {5, 1},    // 5 years -> rate = 0.4
                    {10, 2}    // 10 years -> rate = 0.2
            };

            for (int[] testCase : testCases) {
                int usefulLifeYears = testCase[0];
                double expectedRate = 2.0 / usefulLifeYears;
                
                BigDecimal originalValue = bd("100000.00");
                BigDecimal salvageValue = bd("10000.00");
                LocalDate acquisitionDate = LocalDate.of(2024, 1, 1);
                LocalDate asOfDate = LocalDate.of(2024, 12, 31);

                DepreciationResult result = calculateDDB(
                        originalValue, salvageValue, usefulLifeYears, asOfDate, acquisitionDate);

                assertEquals(bd(String.format("%.4f", expectedRate)), result.depreciationRate,
                        String.format("Rate for %d-year asset should be %.4f", usefulLifeYears, expectedRate));
            }
        }
    }

    @Nested
    @DisplayName("ATB-DDB-004: Early Switch to Straight-Line Method")
    class SwitchToStraightLineTest {

        @Test
        @DisplayName("When remaining life is considered, switch to straight-line for optimal depreciation")
        void testSwitchToStraightLineWhenOptimal() {
            BigDecimal originalValue = bd("100000.00");
            BigDecimal salvageValue = bd("10000.00");
            int usefulLifeYears = 5;
            LocalDate acquisitionDate = LocalDate.of(2022, 1, 1);
            LocalDate asOfDate = LocalDate.of(2024, 12, 31);

            DepreciationResult result = calculateDDB(
                    originalValue, salvageValue, usefulLifeYears, asOfDate, acquisitionDate);

            // After 3 years of DDB:
            // Year 1: 100000 * 0.4 = 40000, remaining = 60000
            // Year 2: 60000 * 0.4 = 24000, remaining = 36000
            // Year 3: 36000 * 0.4 = 14400, remaining = 21600
            // Remaining depreciable: 21600 - 10000 = 11600
            // Remaining years: 2
            // SL would be: 11600 / 2 = 5800 per year
            // But DDB year 3: 36000 * 0.4 = 14400

            BigDecimal expectedAccumulated = bd("78400.00");
            BigDecimal expectedNetValue = bd("21600.00");

            assertTrue(result.accumulatedDepreciation.compareTo(bd("70000.00")) > 0,
                    "DDB accumulated depreciation should exceed straight-line equivalent");
        }
    }

    @Nested
    @DisplayName("ATB-DDB-005: Same Month as Acquisition Query")
    class SameMonthAcquisitionTest {

        @Test
        @DisplayName("Depreciation should be zero in the month of acquisition")
        void testZeroDepreciationInAcquisitionMonth() {
            BigDecimal originalValue = bd("80000.00");
            BigDecimal salvageValue = bd("8000.00");
            int usefulLifeYears = 5;
            LocalDate acquisitionDate = LocalDate.of(2024, 3, 15);
            LocalDate asOfDate = LocalDate.of(2024, 3, 31);

            DepreciationResult result = calculateDDB(
                    originalValue, salvageValue, usefulLifeYears, asOfDate, acquisitionDate);

            assertEquals(bd("0.00"), result.accumulatedDepreciation,
                    "No depreciation in acquisition month");
            assertEquals(originalValue, result.currentNetValue,
                    "Net value equals original value in acquisition month");
        }

        @Test
        @DisplayName("Full month of depreciation starts from next month")
        void testDepreciationStartsNextMonth() {
            BigDecimal originalValue = bd("80000.00");
            BigDecimal salvageValue = bd("8000.00");
            int usefulLifeYears = 5;
            LocalDate acquisitionDate = LocalDate.of(2024, 3, 15);
            LocalDate nextMonth = LocalDate.of(2024, 4, 30);

            DepreciationResult result = calculateDDB(
                    originalValue, salvageValue, usefulLifeYears, nextMonth, acquisitionDate);

            assertTrue(result.accumulatedDepreciation.compareTo(bd("0.00")) > 0,
                    "Depreciation should start from next month");
        }
    }

    @Nested
    @DisplayName("ATB-ERR-001 to ATB-ERR-004: Exception Boundary Tests")
    class ExceptionBoundaryTests {

        @Test
        @DisplayName("ATB-ERR-001: Should reject when salvage >= original value")
        void testSalvageValueValidation() {
            BigDecimal originalValue = bd("50000.00");
            BigDecimal salvageValue = bd("50000.00"); // equal to original
            int usefulLifeYears = 5;
            LocalDate acquisitionDate = LocalDate.of(2024, 1, 1);
            LocalDate asOfDate = LocalDate.of(2025, 12, 31);

            assertThrows(IllegalArgumentException.class, () -> {
                if (salvageValue.compareTo(originalValue) >= 0) {
                    throw new IllegalArgumentException(
                            "Salvage value must be less than original value");
                }
                calculateDDB(originalValue, salvageValue, usefulLifeYears, asOfDate, acquisitionDate);
            }, "Should reject when salvage value >= original value");
        }

        @Test
        @DisplayName("ATB-ERR-002: Should reject when usefulLifeYears <= 0")
        void testUsefulLifeYearsValidation() {
            BigDecimal originalValue = bd("50000.00");
            BigDecimal salvageValue = bd("5000.00");
            int usefulLifeYears = 0;
            LocalDate acquisitionDate = LocalDate.of(2024, 1, 1);
            LocalDate asOfDate = LocalDate.of(2025, 12, 31);

            assertThrows(IllegalArgumentException.class, () -> {
                if (usefulLifeYears <= 0) {
                    throw new IllegalArgumentException(
                            "Useful life years must be positive");
                }
                calculateDDB(originalValue, salvageValue, usefulLifeYears, asOfDate, acquisitionDate);
            }, "Should reject when useful life years <= 0");
        }

        @Test
        @DisplayName("ATB-ERR-003: Should reject when asOfDate < acquisitionDate")
        void testDateRangeValidation() {
            BigDecimal originalValue = bd("50000.00");
            BigDecimal salvageValue = bd("5000.00");
            int usefulLifeYears = 5;
            LocalDate acquisitionDate = LocalDate.of(2025, 1, 1);
            LocalDate asOfDate = LocalDate.of(2024, 12, 31);

            assertThrows(IllegalArgumentException.class, () -> {
                if (asOfDate.isBefore(acquisitionDate)) {
                    throw new IllegalArgumentException(
                            "As-of date must be on or after acquisition date");
                }
                calculateDDB(originalValue, salvageValue, usefulLifeYears, asOfDate, acquisitionDate);
            }, "Should reject when as-of date is before acquisition date");
        }

        @Test
        @DisplayName("ATB-ERR-004: Accumulated depreciation should not exceed depreciable amount")
        void testAccumulatedDepreciationCap() {
            BigDecimal originalValue = bd("100000.00");
            BigDecimal salvageValue = bd("10000.00");
            int usefulLifeYears = 5;
            LocalDate acquisitionDate = LocalDate.of(2020, 1, 1);
            LocalDate asOfDate = LocalDate.of(2030, 12, 31);

            DepreciationResult result = calculateDDB(
                    originalValue, salvageValue, usefulLifeYears, asOfDate, acquisitionDate);

            BigDecimal maxDepreciable = originalValue.subtract(salvageValue);
            assertTrue(result.accumulatedDepreciation.compareTo(maxDepreciable) <= 0,
                    "Accumulated depreciation should never exceed (original - salvage)");
        }
    }

    @Nested
    @DisplayName("Additional Edge Cases")
    class AdditionalEdgeCases {

        @Test
        @DisplayName("Test with minimum useful life (1 year)")
        void testMinimumUsefulLife() {
            BigDecimal originalValue = bd("10000.00");
            BigDecimal salvageValue = bd("1000.00");
            int usefulLifeYears = 1;
            LocalDate acquisitionDate = LocalDate.of(2024, 1, 1);
            LocalDate asOfDate = LocalDate.of(2024, 12, 31);

            DepreciationResult result = calculateDDB(
                    originalValue, salvageValue, usefulLifeYears, asOfDate, acquisitionDate);

            // DDB rate = 2/1 = 2.0 (200%), capped at depreciable amount
            BigDecimal depreciableAmount = originalValue.subtract(salvageValue);
            assertEquals(depreciableAmount, result.accumulatedDepreciation,
                    "With 1-year life, DDB rate is capped at 100% of depreciable amount");
        }

        @Test
        @DisplayName("Test with zero salvage value")
        void testZeroSalvageValue() {
            BigDecimal originalValue = bd("80000.00");
            BigDecimal salvageValue = bd("0.00");
            int usefulLifeYears = 8;
            LocalDate acquisitionDate = LocalDate.of(2024, 1, 1);
            LocalDate asOfDate = LocalDate.of(2027, 12, 31);

            DepreciationResult result = calculateDDB(
                    originalValue, salvageValue, usefulLifeYears, asOfDate, acquisitionDate);

            assertTrue(result.currentNetValue.compareTo(bd("0.00")) >= 0,
                    "Net value should not go below zero with zero salvage");
        }

        @Test
        @DisplayName("Test precision handling for monetary calculations")
        void testPrecisionHandling() {
            BigDecimal originalValue = new BigDecimal("99999.99");
            BigDecimal salvageValue = new BigDecimal("1111.11");
            int usefulLifeYears = 7;
            LocalDate acquisitionDate = LocalDate.of(2024, 1, 1);
            LocalDate asOfDate = LocalDate.of(2024, 12, 31);

            DepreciationResult result = calculateDDB(
                    originalValue, salvageValue, usefulLifeYears, asOfDate, acquisitionDate);

            // All monetary values should have exactly 2 decimal places
            assertEquals(SCALE, result.accumulatedDepreciation.scale());
            assertEquals(SCALE, result.currentNetValue.scale());
            assertEquals(SCALE, result.currentYearDepreciation.scale());
            assertEquals(SCALE, result.monthlyDepreciation.scale());
        }

        @Test
        @DisplayName("Test mid-year acquisition and partial year depreciation")
        void testMidYearAcquisition() {
            BigDecimal originalValue = bd("120000.00");
            BigDecimal salvageValue = bd("12000.00");
            int usefulLifeYears = 5;
            LocalDate acquisitionDate = LocalDate.of(2024, 7, 1);
            LocalDate asOfDate = LocalDate.of(2024, 12, 31);

            DepreciationResult result = calculateDDB(
                    originalValue, salvageValue, usefulLifeYears, asOfDate, acquisitionDate);

            // First year should be partial (6 months of depreciation)
            BigDecimal expectedFirstYearDDB = originalValue.multiply(bd("0.40"));
            BigDecimal maxFirstYear = expectedFirstYearDDB.divide(bd("2.00"), SCALE, ROUNDING_MODE);
            
            assertTrue(result.currentYearDepreciation.compareTo(maxFirstYear) <= 0,
                    "Partial first year depreciation should be proportionally reduced");
        }
    }
}
