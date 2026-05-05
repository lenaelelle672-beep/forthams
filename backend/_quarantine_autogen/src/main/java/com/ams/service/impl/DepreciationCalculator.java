package com.ams.service.impl;

import com.ams.entity.Asset;
import com.ams.entity.AssetDepreciation;
import com.ams.entity.DepreciationRecord;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.YearMonth;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * 资产折旧计算服务
 * 
 * <p>支持直线法和双倍余额递减法两种折旧计算方式:</p>
 * <ul>
 *   <li>直线法: 年折旧额 = (原值 - 残值) / 预计使用年限</li>
 *   <li>双倍余额递减法: 年折旧率 = 2 / 预计使用年限，后期自动转为直线法</li>
 * </ul>
 * 
 * <p>精度约束: 所有金额计算保留2位小数，角位四舍五入</p>
 * 
 * @see StraightLineDepreciation
 * @see DoubleDecliningBalanceDepreciation
 * @since SWARM-003
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class DepreciationCalculator {

    private static final BigDecimal TWO = new BigDecimal("2");
    private static final BigDecimal HUNDRED = new BigDecimal("100");
    private static final int SCALE = 2;
    private static final RoundingMode ROUNDING_MODE = RoundingMode.HALF_UP;
    private static final int MIN_USEFUL_LIFE = 1;
    private static final int MAX_USEFUL_LIFE = 50;
    private static final BigDecimal DEFAULT_SALVAGE_RATE = new BigDecimal("0.05");
    private static final DateTimeFormatter MONTH_FORMATTER = DateTimeFormatter.ofPattern("yyyy-MM");

    private final StraightLineDepreciation straightLineDepreciation;
    private final DoubleDecliningBalanceDepreciation doubleDecliningDepreciation;

    /**
     * 折旧方法枚举
     */
    public enum DepreciationMethod {
        STRAIGHT_LINE("straight_line"),
        DOUBLE_DECLINING_BALANCE("double_declining_balance");

        private final String value;

        DepreciationMethod(String value) {
            this.value = value;
        }

        public String getValue() {
            return value;
        }
    }

    /**
     * 单个折旧期间数据
     */
    public static class DepreciationPeriod {
        private int year;
        private int month;
        private String method;
        private BigDecimal depreciationAmount;
        private BigDecimal accumulatedDepreciation;
        private BigDecimal bookValue;

        public DepreciationPeriod() {}

        public DepreciationPeriod(int year, int month, String method, 
                                  BigDecimal depreciationAmount, 
                                  BigDecimal accumulatedDepreciation, 
                                  BigDecimal bookValue) {
            this.year = year;
            this.month = month;
            this.method = method;
            this.depreciationAmount = depreciationAmount;
            this.accumulatedDepreciation = accumulatedDepreciation;
            this.bookValue = bookValue;
        }

        public int getYear() { return year; }
        public void setYear(int year) { this.year = year; }
        public int getMonth() { return month; }
        public void setMonth(int month) { this.month = month; }
        public String getMethod() { return method; }
        public void setMethod(String method) { this.method = method; }
        public BigDecimal getDepreciationAmount() { return depreciationAmount; }
        public void setDepreciationAmount(BigDecimal depreciationAmount) { 
            this.depreciationAmount = depreciationAmount; 
        }
        public BigDecimal getAccumulatedDepreciation() { return accumulatedDepreciation; }
        public void setAccumulatedDepreciation(BigDecimal accumulatedDepreciation) { 
            this.accumulatedDepreciation = accumulatedDepreciation; 
        }
        public BigDecimal getBookValue() { return bookValue; }
        public void setBookValue(BigDecimal bookValue) { this.bookValue = bookValue; }
    }

    /**
     * 年度折旧汇总
     */
    public static class AnnualDepreciationSummary {
        private String assetCategory;
        private int assetCount;
        private BigDecimal originalValue;
        private BigDecimal currentDepreciation;
        private BigDecimal accumulatedDepreciation;
        private BigDecimal bookValue;

        public AnnualDepreciationSummary() {}

        public AnnualDepreciationSummary(String assetCategory, int assetCount, 
                                          BigDecimal originalValue,
                                          BigDecimal currentDepreciation,
                                          BigDecimal accumulatedDepreciation,
                                          BigDecimal bookValue) {
            this.assetCategory = assetCategory;
            this.assetCount = assetCount;
            this.originalValue = originalValue;
            this.currentDepreciation = currentDepreciation;
            this.accumulatedDepreciation = accumulatedDepreciation;
            this.bookValue = bookValue;
        }

        public String getAssetCategory() { return assetCategory; }
        public void setAssetCategory(String assetCategory) { this.assetCategory = assetCategory; }
        public int getAssetCount() { return assetCount; }
        public void setAssetCount(int assetCount) { this.assetCount = assetCount; }
        public BigDecimal getOriginalValue() { return originalValue; }
        public void setOriginalValue(BigDecimal originalValue) { this.originalValue = originalValue; }
        public BigDecimal getCurrentDepreciation() { return currentDepreciation; }
        public void setCurrentDepreciation(BigDecimal currentDepreciation) { 
            this.currentDepreciation = currentDepreciation; 
        }
        public BigDecimal getAccumulatedDepreciation() { return accumulatedDepreciation; }
        public void setAccumulatedDepreciation(BigDecimal accumulatedDepreciation) { 
            this.accumulatedDepreciation = accumulatedDepreciation; 
        }
        public BigDecimal getBookValue() { return bookValue; }
        public void setBookValue(BigDecimal bookValue) { this.bookValue = bookValue; }
    }

    /**
     * 计算资产折旧
     * 
     * <p>根据指定折旧方法计算资产的完整折旧计划</p>
     * 
     * @param asset 资产实体
     * @param method 折旧方法
     * @return 折旧期间列表
     * @throws IllegalArgumentException 当参数无效时
     */
    public List<DepreciationPeriod> calculateDepreciation(Asset asset, DepreciationMethod method) {
        validateAsset(asset);
        
        BigDecimal originalValue = asset.getOriginalValue();
        BigDecimal salvageValue = calculateSalvageValue(asset);
        int usefulLifeYears = asset.getUsefulLifeYears();
        
        log.info("开始计算折旧: 资产ID={}, 原值={}, 残值={}, 使用年限={}, 方法={}", 
                asset.getId(), originalValue, salvageValue, usefulLifeYears, method);

        List<DepreciationPeriod> periods;
        
        if (method == DepreciationMethod.STRAIGHT_LINE) {
            periods = calculateStraightLine(originalValue, salvageValue, usefulLifeYears, asset);
        } else {
            periods = calculateDoubleDeclining(originalValue, salvageValue, usefulLifeYears, asset);
        }

        log.info("折旧计算完成: 资产ID={}, 共生成{}期", asset.getId(), periods.size());
        return periods;
    }

    /**
     * 计算直线法折旧
     * 
     * <p>年折旧额 = (原值 - 残值) / 预计使用年限</p>
     */
    private List<DepreciationPeriod> calculateStraightLine(BigDecimal originalValue,
                                                            BigDecimal salvageValue,
                                                            int usefulLifeYears,
                                                            Asset asset) {
        BigDecimal depreciableAmount = originalValue.subtract(salvageValue);
        BigDecimal annualDepreciation = depreciableAmount.divide(
                BigDecimal.valueOf(usefulLifeYears), SCALE, ROUNDING_MODE);
        BigDecimal monthlyDepreciation = annualDepreciation.divide(
                BigDecimal.valueOf(12), SCALE, ROUNDING_MODE);

        List<DepreciationPeriod> periods = new ArrayList<>();
        BigDecimal accumulatedDepreciation = BigDecimal.ZERO;
        BigDecimal bookValue = originalValue;
        LocalDate startDate = asset.getPurchaseDate().plusMonths(1).withDayOfMonth(1);

        for (int year = 1; year <= usefulLifeYears; year++) {
            for (int month = 1; month <= 12; month++) {
                int totalMonths = (year - 1) * 12 + month;
                if (totalMonths > usefulLifeYears * 12) break;

                LocalDate periodDate = startDate.plusMonths(totalMonths - 1);
                
                accumulatedDepreciation = accumulatedDepreciation.add(monthlyDepreciation);
                bookValue = originalValue.subtract(accumulatedDepreciation);

                if (bookValue.compareTo(salvageValue) < 0) {
                    bookValue = salvageValue;
                }

                DepreciationPeriod period = new DepreciationPeriod(
                        year,
                        month,
                        DepreciationMethod.STRAIGHT_LINE.getValue(),
                        monthlyDepreciation.setScale(SCALE, ROUNDING_MODE),
                        accumulatedDepreciation.setScale(SCALE, ROUNDING_MODE),
                        bookValue.setScale(SCALE, ROUNDING_MODE)
                );
                period.setPeriodDate(periodDate);
                periods.add(period);

                if (bookValue.compareTo(salvageValue) <= 0) {
                    return periods;
                }
            }
        }

        return periods;
    }

    /**
     * 计算双倍余额递减法折旧
     * 
     * <p>规则:</p>
     * <ul>
     *   <li>年折旧率 = 2 / 预计使用年限</li>
     *   <li>每年折旧 = 年初净值 × 年折旧率</li>
     *   <li>当直线法折旧额 ≥ 双倍余额递减法折旧额时，转为直线法</li>
     * </ul>
     */
    private List<DepreciationPeriod> calculateDoubleDeclining(BigDecimal originalValue,
                                                               BigDecimal salvageValue,
                                                               int usefulLifeYears,
                                                               Asset asset) {
        BigDecimal ddbRate = TWO.divide(
                BigDecimal.valueOf(usefulLifeYears), SCALE, ROUNDING_MODE);
        BigDecimal ddbRatePercent = ddbRate.multiply(HUNDRED);

        List<DepreciationPeriod> periods = new ArrayList<>();
        BigDecimal bookValue = originalValue;
        BigDecimal accumulatedDepreciation = BigDecimal.ZERO;
        LocalDate startDate = asset.getPurchaseDate().plusMonths(1).withDayOfMonth(1);

        int totalMonths = 0;
        int remainingYears = usefulLifeYears;

        for (int year = 1; year <= usefulLifeYears + 1 && totalMonths < usefulLifeYears * 12; year++) {
            if (remainingYears <= 0) break;

            BigDecimal straightLineAmount = BigDecimal.ZERO;
            BigDecimal ddbAmount = BigDecimal.ZERO;

            if (bookValue.compareTo(salvageValue) > 0) {
                straightLineAmount = bookValue.subtract(salvageValue)
                        .divide(BigDecimal.valueOf(remainingYears), SCALE, ROUNDING_MODE);
                ddbAmount = bookValue.multiply(ddbRate);

                if (straightLineAmount.compareTo(ddbAmount) >= 0 && year < usefulLifeYears) {
                    remainingYears--;
                }
            }

            String currentMethod = DepreciationMethod.DOUBLE_DECLINING_BALANCE.getValue();
            BigDecimal currentDepreciation = ddbAmount;

            if (straightLineAmount.compareTo(ddbAmount) >= 0 || year >= usefulLifeYears) {
                currentMethod = DepreciationMethod.STRAIGHT_LINE.getValue();
                currentDepreciation = straightLineAmount;
            }

            BigDecimal annualDepreciation = currentDepreciation;
            BigDecimal monthlyDepreciation = annualDepreciation.divide(
                    BigDecimal.valueOf(12), SCALE, ROUNDING_MODE);

            for (int month = 1; month <= 12; month++) {
                totalMonths++;
                if (bookValue.compareTo(salvageValue) <= 0) break;

                LocalDate periodDate = startDate.plusMonths(totalMonths - 1);

                if (totalMonths > usefulLifeYears * 12) break;

                accumulatedDepreciation = accumulatedDepreciation.add(monthlyDepreciation);
                bookValue = originalValue.subtract(accumulatedDepreciation);

                if (bookValue.compareTo(salvageValue) < 0) {
                    bookValue = salvageValue;
                }

                DepreciationPeriod period = new DepreciationPeriod(
                        year,
                        month,
                        currentMethod,
                        monthlyDepreciation.setScale(SCALE, ROUNDING_MODE),
                        accumulatedDepreciation.setScale(SCALE, ROUNDING_MODE),
                        bookValue.setScale(SCALE, ROUNDING_MODE)
                );
                period.setPeriodDate(periodDate);
                periods.add(period);

                if (bookValue.compareTo(salvageValue) <= 0) {
                    return periods;
                }
            }
        }

        return periods;
    }

    /**
     * 生成月度折旧计划表
     * 
     * <p>为指定期间的资产生成月度折旧计划</p>
     * 
     * @param asset 资产实体
     * @param year 年份
     * @param month 月份
     * @return 月度折旧计划列表
     */
    public List<DepreciationPeriod> generateMonthlySchedule(Asset asset, int year, int month) {
        DepreciationMethod method = determineDepreciationMethod(asset);
        List<DepreciationPeriod> allPeriods = calculateDepreciation(asset, method);

        List<DepreciationPeriod> monthlySchedule = new ArrayList<>();
        for (DepreciationPeriod period : allPeriods) {
            if (period.getYear() == year) {
                monthlySchedule.add(period);
            }
        }

        log.debug("生成月度计划: 资产ID={}, 年={}, 月={}, 记录数={}", 
                asset.getId(), year, month, monthlySchedule.size());
        return monthlySchedule;
    }

    /**
     * 生成年度折旧汇总报表
     * 
     * <p>按资产类别聚合折旧数据</p>
     * 
     * @param assets 资产列表
     * @param year 年份
     * @return 年度汇总列表
     */
    public List<AnnualDepreciationSummary> generateAnnualReport(List<Asset> assets, int year) {
        Map<String, AnnualDepreciationSummary> summaryMap = new HashMap<>();

        for (Asset asset : assets) {
            String category = asset.getCategory() != null ? asset.getCategory() : "未分类";
            DepreciationMethod method = determineDepreciationMethod(asset);
            List<DepreciationPeriod> periods = calculateDepreciation(asset, method);

            BigDecimal yearDepreciation = BigDecimal.ZERO;
            BigDecimal accumulatedDepreciation = BigDecimal.ZERO;
            BigDecimal currentBookValue = asset.getOriginalValue();

            for (DepreciationPeriod period : periods) {
                if (period.getYear() == year) {
                    yearDepreciation = yearDepreciation.add(period.getDepreciationAmount());
                    accumulatedDepreciation = period.getAccumulatedDepreciation();
                    currentBookValue = period.getBookValue();
                }
            }

            AnnualDepreciationSummary summary = summaryMap.getOrDefault(category, 
                    new AnnualDepreciationSummary());
            if (summary.getAssetCount() == 0) {
                summary.setAssetCategory(category);
                summary.setAssetCount(0);
                summary.setOriginalValue(BigDecimal.ZERO);
                summary.setCurrentDepreciation(BigDecimal.ZERO);
                summary.setAccumulatedDepreciation(BigDecimal.ZERO);
                summary.setBookValue(BigDecimal.ZERO);
            }

            summary.setAssetCount(summary.getAssetCount() + 1);
            summary.setOriginalValue(summary.getOriginalValue().add(asset.getOriginalValue()));
            summary.setCurrentDepreciation(summary.getCurrentDepreciation().add(yearDepreciation));
            summary.setAccumulatedDepreciation(
                    summary.getAccumulatedDepreciation().add(accumulatedDepreciation));
            summary.setBookValue(summary.getBookValue().add(currentBookValue));

            summaryMap.put(category, summary);
        }

        log.info("生成年度报表: 年份={}, 资产类别数={}", year, summaryMap.size());
        return new ArrayList<>(summaryMap.values());
    }

    /**
     * 确定资产的折旧方法
     * 
     * <p>优先使用资产上配置的折旧方法，否则使用直线法</p>
     * 
     * @param asset 资产实体
     * @return 折旧方法
     */
    public DepreciationMethod determineDepreciationMethod(Asset asset) {
        if (asset.getDepreciationMethod() == null || 
            asset.getDepreciationMethod().isEmpty()) {
            return DepreciationMethod.STRAIGHT_LINE;
        }
        
        String methodStr = asset.getDepreciationMethod().toLowerCase();
        if (DepreciationMethod.DOUBLE_DECLINING_BALANCE.getValue().equals(methodStr)) {
            return DepreciationMethod.DOUBLE_DECLINING_BALANCE;
        }
        return DepreciationMethod.STRAIGHT_LINE;
    }

    /**
     * 计算残值
     * 
     * <p>如果资产未设置残值，使用默认残值率(5%)计算</p>
     * 
     * @param asset 资产实体
     * @return 残值
     */
    public BigDecimal calculateSalvageValue(Asset asset) {
        if (asset.getSalvageValue() != null && 
            asset.getSalvageValue().compareTo(BigDecimal.ZERO) >= 0) {
            return asset.getSalvageValue().setScale(SCALE, ROUNDING_MODE);
        }
        
        BigDecimal originalValue = asset.getOriginalValue();
        BigDecimal salvageValue = originalValue.multiply(DEFAULT_SALVAGE_RATE);
        return salvageValue.setScale(SCALE, ROUNDING_MODE);
    }

    /**
     * 验证资产参数有效性
     * 
     * @param asset 资产实体
     * @throws IllegalArgumentException 当参数无效时
     */
    private void validateAsset(Asset asset) {
        if (asset == null) {
            throw new IllegalArgumentException("资产不能为空");
        }
        if (asset.getOriginalValue() == null || asset.getOriginalValue().compareTo(BigDecimal.ZERO) <= 0) {
            throw new IllegalArgumentException("原值必须大于0");
        }
        if (asset.getUsefulLifeYears() < MIN_USEFUL_LIFE || 
            asset.getUsefulLifeYears() > MAX_USEFUL_LIFE) {
            throw new IllegalArgumentException(
                    "预计使用年限必须在" + MIN_USEFUL_LIFE + "-" + MAX_USEFUL_LIFE + "年之间");
        }
        
        BigDecimal salvageValue = calculateSalvageValue(asset);
        if (salvageValue.compareTo(asset.getOriginalValue()) > 0) {
            throw new IllegalArgumentException("残值不能大于原值");
        }
    }

    /**
     * 验证折旧期间
     * 
     * <p>只允许计算历史期间或当月，不得预提未来期间</p>
     * 
     * @param year 年份
     * @param month 月份
     * @throws IllegalArgumentException 当期间无效时
     */
    public void validatePeriod(int year, int month) {
        YearMonth currentPeriod = YearMonth.now();
        YearMonth queryPeriod = YearMonth.of(year, month);

        if (queryPeriod.isAfter(currentPeriod)) {
            throw new IllegalArgumentException("不允许预提未来期间的折旧");
        }
    }
}