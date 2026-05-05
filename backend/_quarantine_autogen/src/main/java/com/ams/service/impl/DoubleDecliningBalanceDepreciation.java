package com.ams.service.impl;

import com.ams.entity.Asset;
import com.ams.entity.DepreciationRecord;
import com.ams.common.exception.BusinessException;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.List;

/**
 * Double Declining Balance Depreciation Calculator
 * 
 * This implementation provides the double declining balance depreciation method
 * which accelerates depreciation in early years and automatically switches to
 * straight-line when that method yields higher depreciation expense.
 * 
 * Formula:
 * - DDB Rate = 2 / Useful Life
 * - Annual Depreciation = Book Value × DDB Rate
 * - Auto-switch to Straight-Line when SL >= DDB
 */
@Slf4j
@Service
public class DoubleDecliningBalanceDepreciation {
    
    /** Constant value 2 for DDB rate calculation */
    private static final BigDecimal TWO = new BigDecimal("2");
    
    /** Default scale for monetary calculations */
    private static final int DEFAULT_SCALE = 2;
    
    /** Rounding mode for monetary values */
    private static final RoundingMode ROUNDING_MODE = RoundingMode.HALF_UP;
    
    /** Minimum useful life allowed */
    private static final int MIN_USEFUL_LIFE = 1;
    
    /** Maximum useful life allowed */
    private static final int MAX_USEFUL_LIFE = 50;
    
    /** Maximum depreciation periods to prevent infinite loops */
    private static final int MAX_DEPRECIATION_PERIODS = 600;

    /**
     * Calculate the double declining balance depreciation rate.
     *
     * @param usefulLifeYears the useful life of the asset in years
     * @return the DDB rate as a decimal (e.g., 0.4 for 5-year life)
     * @throws BusinessException if useful life is invalid
     */
    public BigDecimal calculateDdbRate(int usefulLifeYears) {
        validateUsefulLife(usefulLifeYears);
        return TWO.divide(BigDecimal.valueOf(usefulLifeYears), DEFAULT_SCALE, ROUNDING_MODE);
    }

    /**
     * Calculate annual depreciation for a specific year using double declining balance method.
     * Automatically switches to straight-line when beneficial.
     *
     * @param asset the asset entity containing depreciation parameters
     * @param year the year number (1-based index)
     * @param currentBookValue the book value at the beginning of the year
     * @return the annual depreciation amount
     * @throws BusinessException if parameters are invalid
     */
    public BigDecimal calculateAnnualDepreciation(Asset asset, int year, BigDecimal currentBookValue) {
        validateAsset(asset);
        validateYear(year);
        validateBookValue(currentBookValue);
        
        BigDecimal originalValue = asset.getOriginalValue();
        BigDecimal salvageValue = asset.getSalvageValue();
        int usefulLife = asset.getUsefulLifeYears();
        
        // Calculate remaining depreciable amount
        BigDecimal depreciableAmount = originalValue.subtract(salvageValue);
        if (depreciableAmount.compareTo(BigDecimal.ZERO) <= 0) {
            log.debug("Asset {} has no depreciable amount (original={}, salvage={})",
                    asset.getId(), originalValue, salvageValue);
            return BigDecimal.ZERO;
        }
        
        // Check if already fully depreciated
        if (currentBookValue.compareTo(salvageValue) <= 0) {
            return BigDecimal.ZERO;
        }
        
        // Calculate remaining years for straight-line
        int remainingYears = usefulLife - year + 1;
        if (remainingYears <= 0) {
            remainingYears = 1;
        }
        
        // Calculate DDB depreciation
        BigDecimal ddbRate = calculateDdbRate(usefulLife);
        BigDecimal ddbDepreciation = currentBookValue.multiply(ddbRate)
                .setScale(DEFAULT_SCALE, ROUNDING_MODE);
        
        // Calculate straight-line depreciation for remaining life
        BigDecimal remainingDepreciable = currentBookValue.subtract(salvageValue);
        BigDecimal slDepreciation = remainingDepreciable.divide(
                BigDecimal.valueOf(remainingYears), DEFAULT_SCALE, ROUNDING_MODE);
        
        // Determine which method to use
        BigDecimal annualDepreciation;
        DepreciationMethod method;
        
        if (slDepreciation.compareTo(ddbDepreciation) >= 0 && year < usefulLife) {
            // Switch to straight-line when it yields higher or equal depreciation
            annualDepreciation = slDepreciation;
            method = DepreciationMethod.STRAIGHT_LINE;
            log.debug("Asset {} year {}: switching to straight-line (SL={}, DDB={})",
                    asset.getId(), year, slDepreciation, ddbDepreciation);
        } else {
            annualDepreciation = ddbDepreciation;
            method = DepreciationMethod.DOUBLE_DECLINING_BALANCE;
        }
        
        // Ensure we don't depreciate below salvage value
        BigDecimal maxAllowedDepreciation = currentBookValue.subtract(salvageValue);
        if (annualDepreciation.compareTo(maxAllowedDepreciation) > 0) {
            annualDepreciation = maxAllowedDepreciation.setScale(DEFAULT_SCALE, ROUNDING_MODE);
        }
        
        return annualDepreciation;
    }

    /**
     * Calculate monthly depreciation amount from annual depreciation.
     *
     * @param annualDepreciation the annual depreciation amount
     * @return monthly depreciation (annual / 12)
     */
    public BigDecimal calculateMonthlyDepreciation(BigDecimal annualDepreciation) {
        if (annualDepreciation == null || annualDepreciation.compareTo(BigDecimal.ZERO) < 0) {
            throw new BusinessException("Annual depreciation must be non-negative");
        }
        return annualDepreciation.divide(BigDecimal.valueOf(12), DEFAULT_SCALE, ROUNDING_MODE);
    }

    /**
     * Calculate the number of months between two dates.
     *
     * @param startDate the start date
     * @param endDate the end date
     * @return number of months difference
     */
    public long calculateMonthsBetween(LocalDate startDate, LocalDate endDate) {
        if (startDate == null || endDate == null) {
            throw new BusinessException("Dates cannot be null");
        }
        if (endDate.isBefore(startDate)) {
            throw new BusinessException("End date cannot be before start date");
        }
        return ChronoUnit.MONTHS.between(startDate, endDate);
    }

    /**
     * Generate a complete depreciation schedule for an asset.
     *
     * @param asset the asset to calculate depreciation for
     * @param startDate the date to start depreciation (typically month after acquisition)
     * @param periods number of periods to calculate (months)
     * @return list of depreciation records ordered by period
     * @throws BusinessException if parameters are invalid
     */
    public List<DepreciationRecord> generateDepreciationSchedule(
            Asset asset, LocalDate startDate, int periods) {
        validateAsset(asset);
        validateStartDate(startDate);
        
        if (periods <= 0 || periods > MAX_DEPRECIATION_PERIODS) {
            throw new BusinessException(
                    String.format("Periods must be between 1 and %d", MAX_DEPRECIATION_PERIODS));
        }
        
        List<DepreciationRecord> schedule = new ArrayList<>();
        BigDecimal bookValue = asset.getOriginalValue();
        BigDecimal salvageValue = asset.getSalvageValue();
        LocalDate currentDate = startDate;
        int currentYear = 1;
        int periodsInCurrentYear = 0;
        BigDecimal accumulatedDepreciation = BigDecimal.ZERO;
        
        for (int period = 1; period <= periods; period++) {
            // Check if we've reached salvage value
            if (bookValue.compareTo(salvageValue) <= 0) {
                log.info("Asset {} fully depreciated at period {}", asset.getId(), period);
                break;
            }
            
            // Calculate annual depreciation if starting new year
            if (periodsInCurrentYear == 0 || periodsInCurrentYear >= 12) {
                currentYear = (period - 1) / 12 + 1;
                periodsInCurrentYear = 0;
            }
            
            // Calculate depreciation for current period
            BigDecimal annualDepreciation = calculateAnnualDepreciation(
                    asset, currentYear, bookValue);
            BigDecimal monthlyDepreciation = calculateMonthlyDepreciation(annualDepreciation);
            
            // Adjust for final period to ensure book value doesn't go below salvage
            BigDecimal remainingDepreciable = bookValue.subtract(salvageValue);
            if (monthlyDepreciation.compareTo(remainingDepreciable) > 0) {
                monthlyDepreciation = remainingDepreciable.setScale(DEFAULT_SCALE, ROUNDING_MODE);
            }
            
            // Update book value and accumulated depreciation
            bookValue = bookValue.subtract(monthlyDepreciation);
            accumulatedDepreciation = accumulatedDepreciation.add(monthlyDepreciation);
            
            // Create depreciation record
            DepreciationRecord record = DepreciationRecord.builder()
                    .assetId(asset.getId())
                    .periodYear(currentYear)
                    .periodMonth(periodsInCurrentYear + 1)
                    .depreciationAmount(monthlyDepreciation)
                    .accumulatedDepreciation(accumulatedDepreciation)
                    .bookValue(bookValue)
                    .calculationDate(currentDate)
                    .depreciationMethod(DepreciationMethod.DOUBLE_DECLINING_BALANCE)
                    .build();
            
            schedule.add(record);
            periodsInCurrentYear++;
            currentDate = currentDate.plusMonths(1);
        }
        
        log.info("Generated {} depreciation periods for asset {}", schedule.size(), asset.getId());
        return schedule;
    }

    /**
     * Generate annual depreciation summary for reporting.
     *
     * @param asset the asset entity
     * @param startDate the depreciation start date
     * @param years number of years to calculate
     * @return list of annual depreciation summaries
     */
    public List<AnnualDepreciationSummary> generateAnnualSummary(
            Asset asset, LocalDate startDate, int years) {
        validateAsset(asset);
        
        if (years <= 0 || years > asset.getUsefulLifeYears()) {
            years = asset.getUsefulLifeYears();
        }
        
        List<AnnualDepreciationSummary> summaries = new ArrayList<>();
        BigDecimal bookValue = asset.getOriginalValue();
        
        for (int year = 1; year <= years; year++) {
            BigDecimal annualDepreciation = calculateAnnualDepreciation(asset, year, bookValue);
            bookValue = bookValue.subtract(annualDepreciation);
            
            // Ensure book value doesn't go below salvage
            if (bookValue.compareTo(asset.getSalvageValue()) < 0) {
                bookValue = asset.getSalvageValue();
            }
            
            AnnualDepreciationSummary summary = new AnnualDepreciationSummary();
            summary.setYear(year);
            summary.setOpeningBookValue(asset.getOriginalValue().subtract(
                    summaries.stream()
                            .map(AnnualDepreciationSummary::getDepreciationAmount)
                            .reduce(BigDecimal.ZERO, BigDecimal::add)));
            summary.setDepreciationAmount(annualDepreciation);
            summary.setAccumulatedDepreciation(asset.getOriginalValue().subtract(bookValue));
            summary.setClosingBookValue(bookValue);
            
            summaries.add(summary);
            
            if (bookValue.compareTo(asset.getSalvageValue()) <= 0) {
                break;
            }
        }
        
        return summaries;
    }

    /**
     * Calculate total depreciation over the asset's useful life.
     *
     * @param asset the asset entity
     * @return total depreciation amount
     */
    public BigDecimal calculateTotalDepreciation(Asset asset) {
        validateAsset(asset);
        BigDecimal depreciableAmount = asset.getOriginalValue().subtract(asset.getSalvageValue());
        if (depreciableAmount.compareTo(BigDecimal.ZERO) <= 0) {
            return BigDecimal.ZERO;
        }
        return depreciableAmount;
    }

    // ==================== Validation Methods ====================

    private void validateAsset(Asset asset) {
        if (asset == null) {
            throw new BusinessException("Asset cannot be null");
        }
        if (asset.getOriginalValue() == null || asset.getOriginalValue().compareTo(BigDecimal.ZERO) <= 0) {
            throw new BusinessException("Asset original value must be positive");
        }
        if (asset.getSalvageValue() == null || asset.getSalvageValue().compareTo(BigDecimal.ZERO) < 0) {
            throw new BusinessException("Asset salvage value cannot be negative");
        }
        if (asset.getOriginalValue().compareTo(asset.getSalvageValue()) < 0) {
            throw new BusinessException("Original value cannot be less than salvage value");
        }
        validateUsefulLife(asset.getUsefulLifeYears());
    }

    private void validateUsefulLife(int usefulLife) {
        if (usefulLife < MIN_USEFUL_LIFE || usefulLife > MAX_USEFUL_LIFE) {
            throw new BusinessException(
                    String.format("Useful life must be between %d and %d years",
                            MIN_USEFUL_LIFE, MAX_USEFUL_LIFE));
        }
    }

    private void validateYear(int year) {
        if (year < 1) {
            throw new BusinessException("Year must be a positive integer");
        }
    }

    private void validateBookValue(BigDecimal bookValue) {
        if (bookValue == null || bookValue.compareTo(BigDecimal.ZERO) < 0) {
            throw new BusinessException("Book value cannot be negative");
        }
    }

    private void validateStartDate(LocalDate startDate) {
        if (startDate == null) {
            throw new BusinessException("Start date cannot be null");
        }
    }

    // ==================== Inner Classes ====================

    /**
     * Depreciation method enumeration
     */
    public enum DepreciationMethod {
        /** Double declining balance method */
        DOUBLE_DECLINING_BALANCE,
        
        /** Straight-line method (used when switching) */
        STRAIGHT_LINE
    }

    /**
     * Annual depreciation summary for reporting
     */
    public static class AnnualDepreciationSummary {
        private int year;
        private BigDecimal openingBookValue;
        private BigDecimal depreciationAmount;
        private BigDecimal accumulatedDepreciation;
        private BigDecimal closingBookValue;

        public AnnualDepreciationSummary() {
        }

        public int getYear() {
            return year;
        }

        public void setYear(int year) {
            this.year = year;
        }

        public BigDecimal getOpeningBookValue() {
            return openingBookValue;
        }

        public void setOpeningBookValue(BigDecimal openingBookValue) {
            this.openingBookValue = openingBookValue;
        }

        public BigDecimal getDepreciationAmount() {
            return depreciationAmount;
        }

        public void setDepreciationAmount(BigDecimal depreciationAmount) {
            this.depreciationAmount = depreciationAmount;
        }

        public BigDecimal getAccumulatedDepreciation() {
            return accumulatedDepreciation;
        }

        public void setAccumulatedDepreciation(BigDecimal accumulatedDepreciation) {
            this.accumulatedDepreciation = accumulatedDepreciation;
        }

        public BigDecimal getClosingBookValue() {
            return closingBookValue;
        }

        public void setClosingBookValue(BigDecimal closingBookValue) {
            this.closingBookValue = closingBookValue;
        }
    }
}