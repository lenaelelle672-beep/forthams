package com.ams.entity;

import com.baomidou.mybatisplus.annotation.*;
import com.fasterxml.jackson.annotation.JsonFormat;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;
import lombok.Builder;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.UUID;

/**
 * 资产折旧记录实体类
 * 
 * <p>支持两种折旧计算方法：
 * <ul>
 *   <li>直线法 (straight_line): 每年折旧额固定 = (原值 - 残值) / 预计使用年限</li>
 *   <li>双倍余额递减法 (double_declining): 年折旧率 = 2 / 预计使用年限，年折旧额 = 年初账面净值 × 年折旧率</li>
 * </ul>
 * 
 * @see <a href="../../spec.md">SWARM-003 资产折旧计算模块规格说明</a>
 * @since SWARM-003 Iteration 1
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
@TableName("asset_depreciation")
public class AssetDepreciation {

    /**
     * 折旧记录唯一标识
     */
    @TableId(type = IdType.ASSIGN_UUID)
    private UUID id;

    /**
     * 关联资产ID
     */
    @TableField("asset_id")
    private UUID assetId;

    /**
     * 折旧期间，格式：YYYY-MM
     */
    @TableField("period")
    private String period;

    /**
     * 折旧计算日期
     */
    @TableField("depreciation_date")
    @JsonFormat(pattern = "yyyy-MM-dd")
    private LocalDate depreciationDate;

    /**
     * 折旧计算方法
     * <ul>
     *   <li>straight_line: 直线法</li>
     *   <li>double_declining: 双倍余额递减法</li>
     * </ul>
     */
    @TableField("calculation_method")
    private String calculationMethod;

    /**
     * 资产原值
     */
    @TableField("original_value")
    private BigDecimal originalValue;

    /**
     * 预计残值（基于残值率计算）
     */
    @TableField("residual_value")
    private BigDecimal residualValue;

    /**
     * 残值率
     */
    @TableField("residual_rate")
    private BigDecimal residualRate;

    /**
     * 预计使用年限（年）
     */
    @TableField("useful_life_years")
    private Integer usefulLifeYears;

    /**
     * 累计折旧额
     */
    @TableField("accumulated_depreciation")
    private BigDecimal accumulatedDepreciation;

    /**
     * 当前账面净值
     */
    @TableField("current_net_value")
    private BigDecimal currentNetValue;

    /**
     * 本期月折旧额
     */
    @TableField("monthly_depreciation")
    private BigDecimal monthlyDepreciation;

    /**
     * 年折旧额（用于直线法）
     */
    @TableField("annual_depreciation")
    private BigDecimal annualDepreciation;

    /**
     * 折旧率（用于双倍余额递减法）
     */
    @TableField("depreciation_rate")
    private BigDecimal depreciationRate;

    /**
     * 当前使用年度（用于双倍余额递减法，判断是否进入最后两年转直线法）
     */
    @TableField("current_year")
    private Integer currentYear;

    /**
     * 记录创建时间
     */
    @TableField(value = "created_at", fill = FieldFill.INSERT)
    @JsonFormat(pattern = "yyyy-MM-dd HH:mm:ss")
    private LocalDateTime createdAt;

    /**
     * 记录更新时间
     */
    @TableField(value = "updated_at", fill = FieldFill.INSERT_UPDATE)
    @JsonFormat(pattern = "yyyy-MM-dd HH:mm:ss")
    private LocalDateTime updatedAt;

    /**
     * 版本号（用于乐观锁）
     */
    @Version
    @TableField("version")
    private Long version;

    /**
     * 折旧方法枚举
     */
    public enum DepreciationMethod {
        /** 直线法 */
        STRAIGHT_LINE("straight_line"),
        
        /** 双倍余额递减法 */
        DOUBLE_DECLINING("double_declining");

        private final String value;

        DepreciationMethod(String value) {
            this.value = value;
        }

        public String getValue() {
            return value;
        }

        public static DepreciationMethod fromValue(String value) {
            for (DepreciationMethod method : values()) {
                if (method.value.equals(value)) {
                    return method;
                }
            }
            throw new IllegalArgumentException("Unknown depreciation method: " + value);
        }
    }

    /**
     * 计算直线法折旧
     * 
     * <p>公式：年折旧额 = (原值 - 残值) / 预计使用年限
     * <br>月折旧额 = 年折旧额 / 12
     * 
     * @param originalValue 原值
     * @param residualRate 残值率（0-1之间的小数）
     * @param usefulLifeYears 预计使用年限
     * @return AssetDepreciation 计算结果
     */
    public static AssetDepreciation calculateStraightLine(
            BigDecimal originalValue,
            BigDecimal residualRate,
            int usefulLifeYears) {
        
        // 参数校验
        if (originalValue == null || originalValue.compareTo(BigDecimal.ZERO) <= 0) {
            throw new IllegalArgumentException("原值必须大于0");
        }
        if (residualRate == null || residualRate.compareTo(BigDecimal.ZERO) < 0 || residualRate.compareTo(BigDecimal.ONE) > 1) {
            throw new IllegalArgumentException("残值率必须在0到1之间");
        }
        if (usefulLifeYears < 1 || usefulLifeYears > 50) {
            throw new IllegalArgumentException("预计使用年限必须在1到50年之间");
        }

        BigDecimal residualValue = originalValue.multiply(residualRate);
        BigDecimal depreciableAmount = originalValue.subtract(residualValue);
        BigDecimal annualDepreciation = depreciableAmount.divide(
            BigDecimal.valueOf(usefulLifeYears), 
            2, 
            java.math.RoundingMode.HALF_UP
        );
        BigDecimal monthlyDepreciation = annualDepreciation.divide(
            BigDecimal.valueOf(12), 
            2, 
            java.math.RoundingMode.HALF_UP
        );

        return AssetDepreciation.builder()
            .calculationMethod(DepreciationMethod.STRAIGHT_LINE.getValue())
            .originalValue(originalValue)
            .residualRate(residualRate)
            .residualValue(residualValue)
            .usefulLifeYears(usefulLifeYears)
            .annualDepreciation(annualDepreciation)
            .monthlyDepreciation(monthlyDepreciation)
            .build();
    }

    /**
     * 计算双倍余额递减法折旧
     * 
     * <p>公式：年折旧率 = 2 / 预计使用年限
     * <br>年折旧额 = 年初账面净值 × 年折旧率
     * <br>注意：最后两年改为直线法分摊剩余价值
     * 
     * @param originalValue 原值
     * @param usefulLifeYears 预计使用年限
     * @param currentYear 当前使用年度（从1开始）
     * @param currentNetValue 当前账面净值
     * @return AssetDepreciation 计算结果
     */
    public static AssetDepreciation calculateDoubleDeclining(
            BigDecimal originalValue,
            int usefulLifeYears,
            int currentYear,
            BigDecimal currentNetValue) {
        
        // 参数校验
        if (originalValue == null || originalValue.compareTo(BigDecimal.ZERO) <= 0) {
            throw new IllegalArgumentException("原值必须大于0");
        }
        if (usefulLifeYears < 1 || usefulLifeYears > 50) {
            throw new IllegalArgumentException("预计使用年限必须在1到50年之间");
        }
        if (currentYear < 1 || currentYear > usefulLifeYears) {
            throw new IllegalArgumentException("当前使用年度必须在1到预计使用年限之间");
        }
        if (currentNetValue == null || currentNetValue.compareTo(BigDecimal.ZERO) < 0) {
            throw new IllegalArgumentException("当前账面净值不能为负");
        }

        BigDecimal depreciationRate;
        BigDecimal annualDepreciation;
        BigDecimal monthlyDepreciation;

        // 最后两年转直线法
        if (currentYear > usefulLifeYears - 2) {
            // 最后两年：直线法分摊剩余价值
            depreciationRate = BigDecimal.ONE.divide(
                BigDecimal.valueOf(usefulLifeYears - currentYear + 1),
                4,
                java.math.RoundingMode.HALF_UP
            );
            annualDepreciation = currentNetValue.multiply(depreciationRate);
        } else {
            // 正常年份：双倍余额递减
            depreciationRate = BigDecimal.valueOf(2).divide(
                BigDecimal.valueOf(usefulLifeYears),
                4,
                java.math.RoundingMode.HALF_UP
            );
            annualDepreciation = currentNetValue.multiply(depreciationRate);
        }

        monthlyDepreciation = annualDepreciation.divide(
            BigDecimal.valueOf(12),
            2,
            java.math.RoundingMode.HALF_UP
        );

        return AssetDepreciation.builder()
            .calculationMethod(DepreciationMethod.DOUBLE_DECLINING.getValue())
            .originalValue(originalValue)
            .usefulLifeYears(usefulLifeYears)
            .currentYear(currentYear)
            .depreciationRate(depreciationRate)
            .annualDepreciation(annualDepreciation)
            .monthlyDepreciation(monthlyDepreciation)
            .currentNetValue(currentNetValue)
            .build();
    }

    /**
     * 生成完整的折旧计划表
     * 
     * @param originalValue 原值
     * @param residualRate 残值率
     * @param usefulLifeYears 预计使用年限
     * @param method 折旧方法
     * @param startDate 起始日期
     * @return 每月折旧记录列表
     */
    public static java.util.List<AssetDepreciation> generateDepreciationSchedule(
            BigDecimal originalValue,
            BigDecimal residualRate,
            int usefulLifeYears,
            DepreciationMethod method,
            LocalDate startDate) {
        
        java.util.List<AssetDepreciation> schedule = new java.util.ArrayList<>();
        BigDecimal accumulatedDepreciation = BigDecimal.ZERO;
        BigDecimal currentNetValue = originalValue;
        
        for (int year = 1; year <= usefulLifeYears; year++) {
            for (int month = 1; month <= 12; month++) {
                LocalDate depreciationDate = startDate.plusMonths((long)(year - 1) * 12 + month - 1);
                String period = depreciationDate.format(java.time.format.DateTimeFormatter.ofPattern("yyyy-MM"));
                
                AssetDepreciation record;
                if (method == DepreciationMethod.STRAIGHT_LINE) {
                    record = calculateStraightLine(originalValue, residualRate, usefulLifeYears);
                    record.setAccumulatedDepreciation(
                        record.getAnnualDepreciation().multiply(BigDecimal.valueOf(year))
                    );
                } else {
                    record = calculateDoubleDeclining(
                        originalValue, 
                        usefulLifeYears, 
                        year, 
                        currentNetValue.subtract(accumulatedDepreciation)
                    );
                    accumulatedDepreciation = accumulatedDepreciation.add(record.getAnnualDepreciation());
                    record.setAccumulatedDepreciation(accumulatedDepreciation);
                }
                
                record.setPeriod(period);
                record.setDepreciationDate(depreciationDate);
                record.setCurrentNetValue(
                    originalValue.subtract(record.getAccumulatedDepreciation())
                );
                
                schedule.add(record);
            }
        }
        
        return schedule;
    }
}