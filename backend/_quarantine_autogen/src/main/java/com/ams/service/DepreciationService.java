package com.ams.service;

import com.ams.entity.Asset;
import com.ams.entity.DepreciationRecord;
import com.ams.mapper.AssetMapper;
import com.ams.mapper.DepreciationRecordMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.Optional;
import java.util.UUID;

/**
 * 资产折旧计算服务
 * 
 * <p>支持直线法和双倍余额递减法两种折旧计算方式，用于计算资产在任意时点的累计折旧和当前净值。</p>
 * 
 * <p>业务规则 BR-001: 折旧上限 - 双倍余额递减法下，当期初净值≤残值时，当期折旧额=0
 * <br>业务规则 BR-002: 折旧起算 - 折旧从资产入账日期次月开始计提
 * <br>业务规则 BR-003: 年内月均摊 - 年度折旧额按月均摊返回月折旧额</p>
 *
 * @see StraightLineDepreciation
 * @see DoubleDecliningBalanceDepreciation
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class DepreciationService {

    /** 折旧计算精度：小数点后2位 */
    private static final int SCALE = 2;
    
    /** 月份数量（用于月均摊计算） */
    private static final int MONTHS_PER_YEAR = 12;

    private final AssetMapper assetMapper;
    private final DepreciationRecordMapper depreciationRecordMapper;

    /**
     * 折旧计算方法枚举
     */
    public enum DepreciationMethod {
        /** 直线法 */
        STRAIGHT_LINE("straight_line"),
        /** 双倍余额递减法 */
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
     * 折旧计算结果
     */
    public record DepreciationResult(
        BigDecimal accumulatedDepreciation,
        BigDecimal currentNetValue,
        BigDecimal currentYearDepreciation,
        BigDecimal monthlyDepreciation,
        BigDecimal depreciationRate
    ) {
        /**
         * 创建折旧结果，同时校验计算结果的合理性
         *
         * @param originalValue 原值
         * @param salvageValue 残值
         * @return 校验后的折旧结果
         */
        public DepreciationResult validated(BigDecimal originalValue, BigDecimal salvageValue) {
            // 累计折旧不得超过(原值-残值)
            BigDecimal maxDepreciation = originalValue.subtract(salvageValue);
            if (accumulatedDepreciation.compareTo(maxDepreciation) > 0) {
                log.warn("累计折旧超过上限，截断至{}，原计算值={}", maxDepreciation, accumulatedDepreciation);
                return new DepreciationResult(
                    maxDepreciation,
                    salvageValue,
                    currentYearDepreciation,
                    monthlyDepreciation,
                    depreciationRate
                );
            }
            return this;
        }
    }

    /**
     * 计算直线法折旧
     *
     * <p>公式：年折旧额 = (原值 - 残值) / 使用年限</p>
     *
     * @param originalValue 原值
     * @param salvageValue 残值
     * @param usefulLifeYears 使用年限（年）
     * @param acquisitionDate 入账日期
     * @param asOfDate 截止日期
     * @return 折旧计算结果
     * @throws IllegalArgumentException 参数校验失败
     */
    public DepreciationResult calculateStraightLine(
            BigDecimal originalValue,
            BigDecimal salvageValue,
            int usefulLifeYears,
            LocalDate acquisitionDate,
            LocalDate asOfDate
    ) {
        validateInputs(originalValue, salvageValue, usefulLifeYears, acquisitionDate, asOfDate);
        
        log.debug("直线法折旧计算：原值={}, 残值={}, 使用年限={}, 入账日期={}, 截止日期={}",
                originalValue, salvageValue, usefulLifeYears, acquisitionDate, asOfDate);

        // BR-002: 入账当月折旧为0
        if (!asOfDate.isAfter(acquisitionDate)) {
            return zeroResult();
        }

        // 计算年折旧额
        BigDecimal depreciableAmount = originalValue.subtract(salvageValue);
        BigDecimal annualDepreciation = depreciableAmount
                .divide(BigDecimal.valueOf(usefulLifeYears), SCALE, RoundingMode.HALF_UP);

        // 计算累计折旧月份数（从次月开始计算）
        long monthsElapsed = ChronoUnit.MONTHS.between(acquisitionDate, asOfDate);
        if (monthsElapsed <= 0) {
            return zeroResult();
        }

        // 累计折旧 = 月数 × 月折旧额
        BigDecimal monthlyDepreciation = annualDepreciation
                .divide(BigDecimal.valueOf(MONTHS_PER_YEAR), SCALE, RoundingMode.HALF_UP);
        BigDecimal accumulatedDepreciation = monthlyDepreciation
                .multiply(BigDecimal.valueOf(monthsElapsed))
                .setScale(SCALE, RoundingMode.HALF_UP);

        // BR-001: 累计折旧不得超过可折旧总额
        if (accumulatedDepreciation.compareTo(depreciableAmount) > 0) {
            accumulatedDepreciation = depreciableAmount;
        }

        // 计算当前净值
        BigDecimal currentNetValue = originalValue.subtract(accumulatedDepreciation);

        // 计算当年折旧额（简化处理：以年度为周期）
        int currentYear = asOfDate.getYear();
        int acquisitionYear = acquisitionDate.getYear();
        BigDecimal currentYearDepreciation;
        if (currentYear == acquisitionYear) {
            // 入账当年按实际月份计算
            int startMonth = acquisitionDate.getMonthValue() + 1;
            int endMonth = asOfDate.getMonthValue();
            int monthsInYear = Math.max(0, endMonth - startMonth + 1);
            currentYearDepreciation = monthlyDepreciation.multiply(BigDecimal.valueOf(monthsInYear));
        } else {
            currentYearDepreciation = annualDepreciation;
        }

        // 折旧率 = 年折旧额 / 原值
        BigDecimal depreciationRate = annualDepreciation
                .divide(originalValue, 4, RoundingMode.HALF_UP);

        DepreciationResult result = new DepreciationResult(
            accumulatedDepreciation,
            currentNetValue,
            currentYearDepreciation,
            monthlyDepreciation,
            depreciationRate
        );

        return result.validated(originalValue, salvageValue);
    }

    /**
     * 计算双倍余额递减法折旧
     *
     * <p>公式：折旧率 = 2 / 使用年限，年折旧额 = 期初净值 × 折旧率</p>
     * <p>当净值降至残值时停止折旧，末期可转为直线法补提</p>
     *
     * @param originalValue 原值
     * @param salvageValue 残值
     * @param usefulLifeYears 使用年限（年）
     * @param acquisitionDate 入账日期
     * @param asOfDate 截止日期
     * @return 折旧计算结果
     * @throws IllegalArgumentException 参数校验失败
     */
    public DepreciationResult calculateDoubleDecliningBalance(
            BigDecimal originalValue,
            BigDecimal salvageValue,
            int usefulLifeYears,
            LocalDate acquisitionDate,
            LocalDate asOfDate
    ) {
        validateInputs(originalValue, salvageValue, usefulLifeYears, acquisitionDate, asOfDate);

        log.debug("双倍余额递减法折旧计算：原值={}, 残值={}, 使用年限={}, 入账日期={}, 截止日期={}",
                originalValue, salvageValue, usefulLifeYears, acquisitionDate, asOfDate);

        // BR-002: 入账当月折旧为0
        if (!asOfDate.isAfter(acquisitionDate)) {
            return zeroResult();
        }

        // 计算折旧率
        BigDecimal depreciationRate = BigDecimal.valueOf(2)
                .divide(BigDecimal.valueOf(usefulLifeYears), 4, RoundingMode.HALF_UP);

        // 计算累计折旧
        BigDecimal accumulatedDepreciation = BigDecimal.ZERO;
        BigDecimal bookValue = originalValue;
        BigDecimal maxDepreciable = originalValue.subtract(salvageValue);
        int acquisitionYear = acquisitionDate.getYear();
        int currentYear = asOfDate.getYear();
        BigDecimal currentYearDepreciation = BigDecimal.ZERO;

        int startYear = acquisitionYear;
        int endYear = asOfDate.getYear();

        for (int year = startYear; year <= endYear; year++) {
            if (bookValue.compareTo(salvageValue) <= 0) {
                // BR-001: 净值已降至残值，停止折旧
                break;
            }

            BigDecimal yearDepreciation;
            int remainingYears = usefulLifeYears - (year - startYear);
            
            if (remainingYears <= 0) {
                break;
            }

            if (remainingYears <= 2 && year == endYear - 1) {
                // 最后两年转为直线法
                yearDepreciation = bookValue.subtract(salvageValue)
                        .divide(BigDecimal.valueOf(2), SCALE, RoundingMode.HALF_UP);
            } else {
                yearDepreciation = bookValue.multiply(depreciationRate)
                        .setScale(SCALE, RoundingMode.HALF_UP);
            }

            // 校验：当年折旧后净值不能低于残值
            BigDecimal newBookValue = bookValue.subtract(yearDepreciation);
            if (newBookValue.compareTo(salvageValue) < 0) {
                yearDepreciation = bookValue.subtract(salvageValue);
                newBookValue = salvageValue;
            }

            // 累加折旧
            if (year == endYear) {
                currentYearDepreciation = yearDepreciation;
            }

            accumulatedDepreciation = accumulatedDepreciation.add(yearDepreciation);
            bookValue = newBookValue;

            // 防止无限循环
            if (accumulatedDepreciation.compareTo(maxDepreciable) >= 0) {
                accumulatedDepreciation = maxDepreciable;
                break;
            }
        }

        // 计算当前净值
        BigDecimal currentNetValue = originalValue.subtract(accumulatedDepreciation);

        // 计算月折旧额
        BigDecimal monthlyDepreciation = currentYearDepreciation
                .divide(BigDecimal.valueOf(MONTHS_PER_YEAR), SCALE, RoundingMode.HALF_UP);

        DepreciationResult result = new DepreciationResult(
            accumulatedDepreciation,
            currentNetValue,
            currentYearDepreciation,
            monthlyDepreciation,
            depreciationRate
        );

        return result.validated(originalValue, salvageValue);
    }

    /**
     * 获取资产当前折旧信息
     *
     * @param assetId 资产ID
     * @param method 折旧方法
     * @param asOfDate 截止日期
     * @return 折旧计算结果
     * @throws IllegalArgumentException 参数无效
     * @throws RuntimeException 资产不存在
     */
    public DepreciationResult getCurrentDepreciation(
            UUID assetId,
            DepreciationMethod method,
            LocalDate asOfDate
    ) {
        if (assetId == null) {
            throw new IllegalArgumentException("资产ID不能为空");
        }
        if (method == null) {
            throw new IllegalArgumentException("折旧方法不能为空");
        }

        // 查询资产信息
        Asset asset = assetMapper.selectById(assetId);
        if (asset == null) {
            throw new RuntimeException("资产不存在: " + assetId);
        }

        return calculateDepreciation(asset, method, asOfDate);
    }

    /**
     * 根据资产和折旧方法计算折旧
     *
     * @param asset 资产实体
     * @param method 折旧方法
     * @param asOfDate 截止日期
     * @return 折旧计算结果
     */
    private DepreciationResult calculateDepreciation(
            Asset asset,
            DepreciationMethod method,
            LocalDate asOfDate
    ) {
        BigDecimal originalValue = asset.getOriginalValue();
        BigDecimal salvageValue = asset.getSalvageValue() != null 
                ? asset.getSalvageValue() 
                : BigDecimal.ZERO;
        int usefulLifeYears = asset.getUsefulLifeYears() != null 
                ? asset.getUsefulLifeYears() 
                : 0;
        LocalDate acquisitionDate = asset.getAcquisitionDate();

        // 校验截止日期不能早于入账日期
        if (asOfDate.isBefore(acquisitionDate)) {
            throw new IllegalArgumentException("截止日期不能早于入账日期");
        }

        // 校验截止日期不能超过当前日期
        if (asOfDate.isAfter(LocalDate.now())) {
            throw new IllegalArgumentException("截止日期不能超过当前日期");
        }

        return switch (method) {
            case STRAIGHT_LINE -> calculateStraightLine(
                originalValue, salvageValue, usefulLifeYears, acquisitionDate, asOfDate);
            case DOUBLE_DECLINING_BALANCE -> calculateDoubleDecliningBalance(
                originalValue, salvageValue, usefulLifeYears, acquisitionDate, asOfDate);
        };
    }

    /**
     * 保存折旧记录
     *
     * @param assetId 资产ID
     * @param result 折旧计算结果
     * @param method 折旧方法
     * @param asOfDate 计算日期
     */
    public void saveDepreciationRecord(
            UUID assetId,
            DepreciationResult result,
            DepreciationMethod method,
            LocalDate asOfDate
    ) {
        DepreciationRecord record = DepreciationRecord.builder()
                .assetId(assetId)
                .calculationDate(asOfDate)
                .method(method.getValue())
                .accumulatedDepreciation(result.accumulatedDepreciation())
                .currentNetValue(result.currentNetValue())
                .annualDepreciation(result.currentYearDepreciation())
                .depreciationRate(result.depreciationRate())
                .build();

        depreciationRecordMapper.insert(record);
        log.info("保存折旧记录：资产ID={}, 日期={}, 累计折旧={}", 
                assetId, asOfDate, result.accumulatedDepreciation());
    }

    /**
     * 查询最新折旧记录
     *
     * @param assetId 资产ID
     * @return 最新折旧记录
     */
    public Optional<DepreciationRecord> getLatestRecord(UUID assetId) {
        return Optional.ofNullable(
            depreciationRecordMapper.selectLatestByAssetId(assetId)
        );
    }

    /**
     * 输入参数校验
     */
    private void validateInputs(
            BigDecimal originalValue,
            BigDecimal salvageValue,
            int usefulLifeYears,
            LocalDate acquisitionDate,
            LocalDate asOfDate
    ) {
        if (originalValue == null || originalValue.compareTo(BigDecimal.ZERO) <= 0) {
            throw new IllegalArgumentException("原值必须大于0");
        }
        if (salvageValue == null || salvageValue.compareTo(BigDecimal.ZERO) < 0) {
            throw new IllegalArgumentException("残值不能为负数");
        }
        if (salvageValue.compareTo(originalValue) >= 0) {
            throw new IllegalArgumentException("残值必须小于原值");
        }
        if (usefulLifeYears <= 0 || usefulLifeYears > 100) {
            throw new IllegalArgumentException("使用年限必须在1-100之间");
        }
        if (acquisitionDate == null) {
            throw new IllegalArgumentException("入账日期不能为空");
        }
        if (asOfDate == null) {
            throw new IllegalArgumentException("截止日期不能为空");
        }
        if (asOfDate.isAfter(LocalDate.now())) {
            throw new IllegalArgumentException("截止日期不能超过当前日期");
        }
    }

    /**
     * 返回零折旧结果
     */
    private DepreciationResult zeroResult() {
        return new DepreciationResult(
            BigDecimal.ZERO,
            BigDecimal.ZERO,
            BigDecimal.ZERO,
            BigDecimal.ZERO,
            BigDecimal.ZERO
        );
    }
}