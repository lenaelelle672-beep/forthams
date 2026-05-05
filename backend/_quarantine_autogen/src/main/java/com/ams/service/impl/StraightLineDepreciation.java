package com.ams.service.impl;

import com.ams.entity.Asset;
import com.ams.entity.DepreciationRecord;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;

/**
 * 直线法折旧计算器实现类
 * 
 * 功能说明：
 * - 按照直线法（平均年限法）计算固定资产折旧
 * - 年折旧额 = (原值 - 残值) / 预计使用年限
 * - 在预计使用年限内均匀分摊折旧费用
 * 
 * 约束条件：
 * - 折旧计算保留2位小数，角位四舍五入
 * - 使用年限范围：1-50年
 * - 原值 > 残值，残值 >= 0
 * - 单次批量计算 <= 1000 条资产
 * 
 * @author AMS Team
 * @version 1.0
 */
public class StraightLineDepreciation implements DepreciationCalculator {

    /** 默认精度保留位数 */
    private static final int SCALE = 2;
    
    /** 最小使用年限 */
    private static final int MIN_USEFUL_LIFE = 1;
    
    /** 最大使用年限 */
    private static final int MAX_USEFUL_LIFE = 50;

    /**
     * 默认构造方法
     */
    public StraightLineDepreciation() {
    }

    /**
     * 计算年度折旧额
     * 
     * 计算公式：年折旧额 = (原值 - 残值) / 预计使用年限
     * 
     * @param originalValue 资产原值
     * @param salvageValue 预计残值
     * @param usefulLifeYears 预计使用年限
     * @return 年折旧额（保留2位小数）
     * @throws IllegalArgumentException 当参数不满足约束条件时
     */
    public BigDecimal calculateAnnualDepreciation(BigDecimal originalValue, 
                                                   BigDecimal salvageValue, 
                                                   int usefulLifeYears) {
        validateParameters(originalValue, salvageValue, usefulLifeYears);
        
        BigDecimal depreciableAmount = originalValue.subtract(salvageValue);
        BigDecimal annualDepreciation = depreciableAmount.divide(
            BigDecimal.valueOf(usefulLifeYears), 
            SCALE, 
            RoundingMode.HALF_UP
        );
        
        return annualDepreciation;
    }

    /**
     * 计算月度折旧额
     * 
     * @param annualDepreciation 年度折旧额
     * @return 月折旧额（保留2位小数）
     */
    public BigDecimal calculateMonthlyDepreciation(BigDecimal annualDepreciation) {
        return annualDepreciation.divide(
            BigDecimal.valueOf(12), 
            SCALE, 
            RoundingMode.HALF_UP
        );
    }

    /**
     * 生成折旧计划表（按年度）
     * 
     * 生成从开始计提月份起至使用年限结束的全部年度折旧记录。
     * 折旧从购置日期的下月首日开始计提。
     * 
     * @param asset 资产实体
     * @return 年度折旧记录列表
     * @throws IllegalArgumentException 当资产参数无效时
     */
    public List<DepreciationRecord> generateAnnualSchedule(Asset asset) {
        if (asset == null) {
            throw new IllegalArgumentException("资产参数不能为空");
        }
        
        validateParameters(
            asset.getOriginalValue(), 
            asset.getSalvageValue(), 
            asset.getUsefulLifeYears()
        );
        
        List<DepreciationRecord> records = new ArrayList<>();
        BigDecimal annualDepreciation = calculateAnnualDepreciation(
            asset.getOriginalValue(),
            asset.getSalvageValue(),
            asset.getUsefulLifeYears()
        );
        
        LocalDate startDate = calculateDepreciationStartDate(asset.getPurchaseDate());
        int usefulLifeYears = asset.getUsefulLifeYears();
        
        BigDecimal accumulatedDepreciation = BigDecimal.ZERO;
        LocalDate currentPeriod = startDate;
        
        for (int year = 1; year <= usefulLifeYears; year++) {
            // 处理最后一年的调整（确保累计折旧 = 原值 - 残值）
            BigDecimal currentYearDepreciation = annualDepreciation;
            if (year == usefulLifeYears) {
                BigDecimal targetTotal = asset.getOriginalValue().subtract(asset.getSalvageValue());
                currentYearDepreciation = targetTotal.subtract(accumulatedDepreciation);
                // 确保四舍五入到分
                currentYearDepreciation = currentYearDepreciation.setScale(SCALE, RoundingMode.HALF_UP);
            }
            
            accumulatedDepreciation = accumulatedDepreciation.add(currentYearDepreciation);
            BigDecimal bookValue = asset.getOriginalValue().subtract(accumulatedDepreciation);
            
            DepreciationRecord record = DepreciationRecord.builder()
                .assetId(asset.getId())
                .periodYear(year)
                .periodMonth(12) // 年度折旧记录
                .depreciationAmount(currentYearDepreciation)
                .accumulatedDepreciation(accumulatedDepreciation)
                .bookValue(bookValue)
                .depreciationMethod("straight_line")
                .periodStartDate(currentPeriod)
                .periodEndDate(currentPeriod.plusYears(1).minusDays(1))
                .build();
            
            records.add(record);
            currentPeriod = currentPeriod.plusYears(1);
        }
        
        return records;
    }

    /**
     * 生成折旧计划表（按月度）
     * 
     * 生成从开始计提月份起12期的月度折旧计划。
     * 
     * @param asset 资产实体
     * @return 月度折旧记录列表（共12条）
     * @throws IllegalArgumentException 当资产参数无效时
     */
    public List<DepreciationRecord> generateMonthlySchedule(Asset asset) {
        if (asset == null) {
            throw new IllegalArgumentException("资产参数不能为空");
        }
        
        BigDecimal annualDepreciation = calculateAnnualDepreciation(
            asset.getOriginalValue(),
            asset.getSalvageValue(),
            asset.getUsefulLifeYears()
        );
        
        BigDecimal monthlyDepreciation = calculateMonthlyDepreciation(annualDepreciation);
        
        List<DepreciationRecord> records = new ArrayList<>();
        LocalDate startDate = calculateDepreciationStartDate(asset.getPurchaseDate());
        
        BigDecimal accumulatedDepreciation = BigDecimal.ZERO;
        LocalDate currentPeriod = startDate;
        
        for (int month = 1; month <= 12; month++) {
            BigDecimal currentMonthDepreciation = monthlyDepreciation;
            
            // 最后一个月调整
            if (month == 12) {
                BigDecimal targetTotal = asset.getOriginalValue().subtract(asset.getSalvageValue());
                currentMonthDepreciation = targetTotal.subtract(accumulatedDepreciation);
                currentMonthDepreciation = currentMonthDepreciation.setScale(SCALE, RoundingMode.HALF_UP);
            }
            
            accumulatedDepreciation = accumulatedDepreciation.add(currentMonthDepreciation);
            BigDecimal bookValue = asset.getOriginalValue().subtract(accumulatedDepreciation);
            
            DepreciationRecord record = DepreciationRecord.builder()
                .assetId(asset.getId())
                .periodYear(1)
                .periodMonth(month)
                .depreciationAmount(currentMonthDepreciation)
                .accumulatedDepreciation(accumulatedDepreciation)
                .bookValue(bookValue)
                .depreciationMethod("straight_line")
                .periodStartDate(currentPeriod)
                .periodEndDate(currentPeriod.withDayOfMonth(currentPeriod.lengthOfMonth()))
                .build();
            
            records.add(record);
            currentPeriod = currentPeriod.plusMonths(1);
        }
        
        return records;
    }

    /**
     * 验证折旧计算参数的有效性
     * 
     * @param originalValue 原值
     * @param salvageValue 残值
     * @param usefulLifeYears 使用年限
     * @throws IllegalArgumentException 当参数不满足约束条件时
     */
    private void validateParameters(BigDecimal originalValue, 
                                    BigDecimal salvageValue, 
                                    int usefulLifeYears) {
        if (originalValue == null) {
            throw new IllegalArgumentException("原值不能为空");
        }
        if (salvageValue == null) {
            throw new IllegalArgumentException("残值不能为空");
        }
        if (originalValue.compareTo(salvageValue) <= 0) {
            throw new IllegalArgumentException("原值必须大于残值");
        }
        if (salvageValue.compareTo(BigDecimal.ZERO) < 0) {
            throw new IllegalArgumentException("残值不能为负数");
        }
        if (usefulLifeYears < MIN_USEFUL_LIFE || usefulLifeYears > MAX_USEFUL_LIFE) {
            throw new IllegalArgumentException(
                String.format("使用年限必须在 %d 到 %d 年之间", MIN_USEFUL_LIFE, MAX_USEFUL_LIFE)
            );
        }
    }

    /**
     * 计算折旧开始日期
     * 
     * 折旧从购置日期的下月首日开始计提。
     * 
     * @param purchaseDate 购置日期
     * @return 折旧开始计提日期
     */
    private LocalDate calculateDepreciationStartDate(LocalDate purchaseDate) {
        if (purchaseDate == null) {
            throw new IllegalArgumentException("购置日期不能为空");
        }
        return purchaseDate.plusMonths(1).withDayOfMonth(1);
    }

    /**
     * 校验资产是否可计提折旧
     * 
     * @param asset 资产实体
     * @return true 如果可以计提折旧
     */
    public boolean isDepreciable(Asset asset) {
        if (asset == null) {
            return false;
        }
        try {
            validateParameters(
                asset.getOriginalValue(),
                asset.getSalvageValue(),
                asset.getUsefulLifeYears()
            );
            return true;
        } catch (IllegalArgumentException e) {
            return false;
        }
    }

    /**
     * 计算累计折旧总额
     * 
     * @param originalValue 原值
     * @param salvageValue 残值
     * @return 累计折旧总额（原值 - 残值）
     */
    public BigDecimal calculateTotalDepreciableAmount(BigDecimal originalValue, BigDecimal salvageValue) {
        if (originalValue == null || salvageValue == null) {
            throw new IllegalArgumentException("原值和残值不能为空");
        }
        return originalValue.subtract(salvageValue);
    }

    /**
     * 计算折旧完成时的账面价值
     * 
     * @param asset 资产实体
     * @return 最终账面价值（应等于残值）
     */
    public BigDecimal calculateFinalBookValue(Asset asset) {
        if (asset == null || asset.getSalvageValue() == null) {
            throw new IllegalArgumentException("资产参数无效");
        }
        return asset.getSalvageValue();
    }

    /**
     * 计算折旧进度百分比
     * 
     * @param currentAccumulatedDepreciation 当前累计折旧
     * @param totalDepreciableAmount 总可折旧金额
     * @return 进度百分比（0-100）
     */
    public BigDecimal calculateDepreciationProgress(BigDecimal currentAccumulatedDepreciation,
                                                    BigDecimal totalDepreciableAmount) {
        if (currentAccumulatedDepreciation == null || totalDepreciableAmount == null) {
            throw new IllegalArgumentException("参数不能为空");
        }
        if (totalDepreciableAmount.compareTo(BigDecimal.ZERO) <= 0) {
            return BigDecimal.valueOf(100);
        }
        return currentAccumulatedDepreciation
            .divide(totalDepreciableAmount, SCALE, RoundingMode.HALF_UP)
            .multiply(BigDecimal.valueOf(100));
    }
}