package com.ams.service;

import com.ams.common.exception.BusinessException;
import com.ams.context.TenantContext;
import com.ams.entity.Asset;
import com.ams.entity.DepreciationRecord;
import com.ams.enums.DepreciationMethodEnum;
import com.ams.mapper.AssetMapper;
import com.ams.mapper.DepreciationRecordMapper;
import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.YearMonth;
import java.time.format.DateTimeParseException;
import java.time.temporal.ChronoUnit;
import java.util.Collections;
import java.util.List;
import java.util.Set;

@Service
@RequiredArgsConstructor
public class DepreciationService {

    private static final Set<String> TERMINAL_STATUSES = Set.of(
            "RETIRED", "SCRAPPED", "DISPOSED", "WRITTEN_OFF"
    );
    private static final BigDecimal ONE_HUNDRED = new BigDecimal("100");
    private static final BigDecimal TWELVE = new BigDecimal("12");
    private static final BigDecimal TWO = new BigDecimal("2");

    private final AssetMapper assetMapper;
    private final DepreciationRecordMapper depreciationRecordMapper;

    // ── 计划查询 ─────────────────────────────────────────────────────────

    public DepreciationSchedulePage getSchedules(String assetNo, String period, int page, int size) {
        String tenantId = TenantContext.requireTenantId();
        String effectivePeriod = normalizePeriod(period);
        int safePage = Math.max(1, page);
        int safeSize = Math.max(1, Math.min(size, 100));

        QueryWrapper<Asset> wrapper = new QueryWrapper<Asset>()
                .eq("tenant_id", tenantId)
                .orderByAsc("id");
        if (StringUtils.hasText(assetNo)) {
            wrapper.eq("asset_no", assetNo.trim());
        }

        List<Asset> assets = assetMapper.selectList(wrapper);
        int fromIndex = Math.min((safePage - 1) * safeSize, assets.size());
        int toIndex = Math.min(fromIndex + safeSize, assets.size());
        List<DepreciationScheduleItem> rows = assets.subList(fromIndex, toIndex)
                .stream()
                .map(asset -> toScheduleItem(asset, effectivePeriod))
                .toList();

        return new DepreciationSchedulePage(rows, assets.size(), safePage, safeSize);
    }

    public List<DepreciationScheduleItem> getScheduleByAssetId(Long assetId, String period) {
        if (assetId == null) {
            throw new BusinessException("资产ID不能为空");
        }

        String tenantId = TenantContext.requireTenantId();
        String effectivePeriod = normalizePeriod(period);
        Asset asset = assetMapper.selectOne(new QueryWrapper<Asset>()
                .eq("tenant_id", tenantId)
                .eq("id", assetId)
                .last("LIMIT 1"));
        if (asset == null) {
            throw new BusinessException("资产不存在");
        }

        return List.of(toScheduleItem(asset, effectivePeriod));
    }

    @Transactional(rollbackFor = Exception.class)
    public BatchCalculateResponse calculate(List<Long> assetIds) {
        if (assetIds == null || assetIds.isEmpty()) {
            return new BatchCalculateResponse(0, "未选择资产");
        }

        String tenantId = TenantContext.requireTenantId();
        List<Asset> assets = assetMapper.selectList(new QueryWrapper<Asset>()
                .eq("tenant_id", tenantId)
                .in("id", assetIds));
        if (assets == null) {
            assets = Collections.emptyList();
        }

        int processed = 0;
        YearMonth currentPeriod = YearMonth.now();
        LocalDate periodStart = currentPeriod.atDay(1);
        LocalDate periodEnd = currentPeriod.atEndOfMonth();

        for (Asset asset : assets) {
            if (isTerminal(asset.getStatus())) {
                throw new BusinessException("终态资产不可执行折旧计算");
            }

            BigDecimal monthlyDepreciation = calculateMonthlyDepreciation(asset);
            BigDecimal currentValue = valueOrZero(asset.getCurrentValue());
            BigDecimal nextValue = currentValue.subtract(monthlyDepreciation).max(BigDecimal.ZERO)
                    .setScale(2, RoundingMode.HALF_UP);

            // 持久化折旧记录
            DepreciationRecord record = new DepreciationRecord();
            record.setTenantId(tenantId);
            record.setAssetId(asset.getId());
            record.setMethod(getEffectiveMethod(asset));
            record.setPeriodStart(periodStart);
            record.setPeriodEnd(periodEnd);
            record.setDepreciationAmount(monthlyDepreciation);
            record.setBookValueBefore(currentValue);
            record.setBookValueAfter(nextValue);
            depreciationRecordMapper.insert(record);

            asset.setCurrentValue(nextValue);
            assetMapper.updateById(asset);
            processed += 1;
        }

        return new BatchCalculateResponse(processed, "折旧计算完成");
    }

    // ── 折旧方法路由 ────────────────────────────────────────────────────

    /**
     * 计算单月折旧额，根据资产设定的方法分发
     */
    private BigDecimal calculateMonthlyDepreciation(Asset asset) {
        String method = getEffectiveMethod(asset);
        BigDecimal originalValue = valueOrZero(asset.getOriginalValue());

        if (originalValue.compareTo(BigDecimal.ZERO) <= 0) {
            return BigDecimal.ZERO.setScale(2, RoundingMode.HALF_UP);
        }

        return switch (method) {
            case "STRAIGHT_LINE" -> calculateStraightLine(asset);
            case "DOUBLE_DECLINING" -> calculateDoubleDeclining(asset);
            case "SYD" -> calculateSYD(asset);
            case "UOP" -> calculateUOP(asset);
            default -> calculateStraightLine(asset);
        };
    }

    /**
     * 直线法: 原值 × 年折旧率 ÷ 12
     */
    private BigDecimal calculateStraightLine(Asset asset) {
        BigDecimal originalValue = valueOrZero(asset.getOriginalValue());
        BigDecimal annualRate = normalizeRate(asset.getDepreciationRate());
        if (annualRate.compareTo(BigDecimal.ZERO) <= 0) {
            return BigDecimal.ZERO.setScale(2, RoundingMode.HALF_UP);
        }
        return originalValue.multiply(annualRate)
                .divide(TWELVE, 2, RoundingMode.HALF_UP);
    }

    /**
     * 双倍余额递减法: 净值 × (2 ÷ 使用年限) ÷ 12
     * 当净值 × 剩余年限 < 原值 ÷ 使用年限时转直线法
     */
    private BigDecimal calculateDoubleDeclining(Asset asset) {
        BigDecimal originalValue = valueOrZero(asset.getOriginalValue());
        BigDecimal netValue = valueOrZero(asset.getCurrentValue());
        int usefulYears = getUsefulLifeYears(asset);
        if (usefulYears <= 0) return BigDecimal.ZERO.setScale(2, RoundingMode.HALF_UP);

        // 如果净值已为0，返回0
        if (netValue.compareTo(BigDecimal.ZERO) <= 0) {
            return BigDecimal.ZERO.setScale(2, RoundingMode.HALF_UP);
        }

        BigDecimal annualRate = TWO.divide(BigDecimal.valueOf(usefulYears), 8, RoundingMode.HALF_UP);
        BigDecimal monthlyRate = annualRate.divide(TWELVE, 8, RoundingMode.HALF_UP);
        BigDecimal monthlyDepreciation = netValue.multiply(monthlyRate)
                .setScale(2, RoundingMode.HALF_UP);

        // 转直线法检测: 如果直线法折旧 > 双倍余额法折旧，转直线
        BigDecimal straightLineMonthly = netValue.divide(
                BigDecimal.valueOf(usefulYears).multiply(TWELVE), 2, RoundingMode.HALF_UP);

        if (straightLineMonthly.compareTo(monthlyDepreciation) > 0) {
            monthlyDepreciation = straightLineMonthly;
        }

        // 不能超过当前净值
        return monthlyDepreciation.min(netValue).max(BigDecimal.ZERO)
                .setScale(2, RoundingMode.HALF_UP);
    }

    /**
     * 年数总和法(SYD): (原值 - 残值) × (剩余年限 / 年数总和) ÷ 12
     */
    private BigDecimal calculateSYD(Asset asset) {
        BigDecimal originalValue = valueOrZero(asset.getOriginalValue());
        BigDecimal salvageValue = valueOrZero(asset.getCurrentValue()); // 净值作为残值
        BigDecimal depreciableBase = originalValue.subtract(salvageValue).max(BigDecimal.ZERO);

        if (depreciableBase.compareTo(BigDecimal.ZERO) <= 0) {
            return BigDecimal.ZERO.setScale(2, RoundingMode.HALF_UP);
        }

        int usefulYears = getUsefulLifeYears(asset);
        if (usefulYears <= 0) return BigDecimal.ZERO.setScale(2, RoundingMode.HALF_UP);

        // 年数总和 = n(n+1)/2
        int sumOfYears = usefulYears * (usefulYears + 1) / 2;
        if (sumOfYears <= 0) return BigDecimal.ZERO.setScale(2, RoundingMode.HALF_UP);

        // 使用已用月份计算剩余年限
        LocalDate purchaseDate = asset.getPurchaseDate();
        int monthsUsed = 0;
        if (purchaseDate != null) {
            monthsUsed = (int) ChronoUnit.MONTHS.between(
                    YearMonth.from(purchaseDate), YearMonth.now());
            monthsUsed = Math.max(0, monthsUsed);
        }

        int remainingMonths = usefulYears * 12 - monthsUsed;
        int remainingYears = Math.max(1, (remainingMonths + 11) / 12);

        // SYD年折旧率 = 剩余年限 / 年数总和
        BigDecimal yearlyDepreciation = depreciableBase
                .multiply(BigDecimal.valueOf(remainingYears))
                .divide(BigDecimal.valueOf(sumOfYears), 2, RoundingMode.HALF_UP);

        return yearlyDepreciation.divide(TWELVE, 2, RoundingMode.HALF_UP);
    }

    /**
     * 工作量法(UOP): (原值 - 残值) × (本期工作量 / 总预期工作量)
     */
    private BigDecimal calculateUOP(Asset asset) {
        BigDecimal originalValue = valueOrZero(asset.getOriginalValue());
        BigDecimal salvageValue = valueOrZero(asset.getCurrentValue());
        BigDecimal depreciableBase = originalValue.subtract(salvageValue).max(BigDecimal.ZERO);

        if (depreciableBase.compareTo(BigDecimal.ZERO) <= 0) {
            return BigDecimal.ZERO.setScale(2, RoundingMode.HALF_UP);
        }

        BigDecimal totalExpected = valueOrZero(asset.getTotalExpectedUnits());
        BigDecimal actualUnits = valueOrZero(asset.getActualUnits());

        if (totalExpected.compareTo(BigDecimal.ZERO) <= 0) {
            return BigDecimal.ZERO.setScale(2, RoundingMode.HALF_UP);
        }

        // 本期无新增工作量
        if (actualUnits.compareTo(BigDecimal.ZERO) <= 0) {
            return BigDecimal.ZERO.setScale(2, RoundingMode.HALF_UP);
        }

        return depreciableBase
                .multiply(actualUnits)
                .divide(totalExpected, 2, RoundingMode.HALF_UP);
    }

    // ── 辅助方法 ─────────────────────────────────────────────────────────

    private DepreciationScheduleItem toScheduleItem(Asset asset, String period) {
        BigDecimal originalValue = valueOrZero(asset.getOriginalValue());
        BigDecimal currentValue = asset.getCurrentValue() == null
                ? originalValue
                : asset.getCurrentValue().setScale(2, RoundingMode.HALF_UP);
        BigDecimal accumulated = originalValue.subtract(currentValue).max(BigDecimal.ZERO)
                .setScale(2, RoundingMode.HALF_UP);

        return new DepreciationScheduleItem(
                asset.getId(),
                asset.getId(),
                asset.getAssetNo(),
                asset.getAssetName(),
                period,
                calculateMonthlyDepreciation(asset),
                accumulated,
                currentValue,
                normalizeRate(asset.getDepreciationRate()),
                asset.getStatus(),
                getEffectiveMethod(asset)
        );
    }

    /**
     * 获取资产的有效折旧方法，默认直线法
     */
    public String getEffectiveMethod(Asset asset) {
        String method = asset.getDepreciationMethod();
        if (method == null || method.isBlank()) {
            return DepreciationMethodEnum.STRAIGHT_LINE.name();
        }
        return method;
    }

    /**
     * 从折旧率推导使用年限（直线法: 使用年限 ≈ 1 / 年折旧率）
     */
    public int getUsefulLifeYears(Asset asset) {
        BigDecimal annualRate = normalizeRate(asset.getDepreciationRate());
        if (annualRate.compareTo(BigDecimal.ZERO) <= 0) {
            return 10; // 默认10年
        }
        int years = BigDecimal.ONE.divide(annualRate, 0, RoundingMode.HALF_UP).intValue();
        return Math.max(1, years);
    }

    private String normalizePeriod(String period) {
        if (!StringUtils.hasText(period)) {
            return YearMonth.now().toString();
        }
        try {
            return YearMonth.parse(period.trim()).toString();
        } catch (DateTimeParseException ex) {
            throw new BusinessException("会计期间格式不正确，请使用 YYYY-MM");
        }
    }

    private BigDecimal normalizeRate(BigDecimal rate) {
        BigDecimal safeRate = valueOrZero(rate);
        if (safeRate.compareTo(BigDecimal.ONE) > 0) {
            return safeRate.divide(ONE_HUNDRED, 8, RoundingMode.HALF_UP);
        }
        return safeRate;
    }

    private BigDecimal valueOrZero(BigDecimal value) {
        return value == null ? BigDecimal.ZERO : value;
    }

    private boolean isTerminal(String status) {
        return status != null && TERMINAL_STATUSES.contains(status.toUpperCase());
    }

    // ── 记录类型 ─────────────────────────────────────────────────────────

    public record DepreciationSchedulePage(
            List<DepreciationScheduleItem> data,
            long total,
            int page,
            int pageSize) {
    }

    public record DepreciationScheduleItem(
            Long id,
            Long assetId,
            String assetNo,
            String assetName,
            String period,
            BigDecimal depreciationAmount,
            BigDecimal accumulatedDepreciation,
            BigDecimal netValue,
            BigDecimal depreciationRate,
            String assetStatus,
            String depreciationMethod) {
    }

    public record BatchCalculateResponse(int processedCount, String message) {
    }

    // ── 折旧方法对比 ─────────────────────────────────────────────────────

    /**
     * 生成折旧方法对比数据（同一资产使用不同方法的对比）。
     *
     * @param assetId 资产 ID
     * @param period 会计期间（YYYY-MM）
     * @return 对比数据列表
     */
    public DepreciationComparisonPage getComparison(Long assetId, String period) {
        String tenantId = TenantContext.requireTenantId();
        String effectivePeriod = normalizePeriod(period);

        // 查询资产
        Asset asset = assetMapper.selectById(assetId);
        if (asset == null) {
            throw new BusinessException("资产不存在");
        }
        if (!tenantId.equals(asset.getTenantId())) {
            throw new AccessDeniedException("Asset belongs to another tenant");
        }

        // 资产基本信息
        BigDecimal originalValue = valueOrZero(asset.getOriginalValue());
        BigDecimal currentValue = valueOrZero(asset.getCurrentValue());
        int usefulLifeYears = getUsefulLifeYears(asset);

        // 构建对比数据（每种方法一行）
        List<DepreciationComparisonItem> items = new java.util.ArrayList<>();
        for (DepreciationMethodEnum method : DepreciationMethodEnum.values()) {
            // 临时修改资产方法以进行计算
            String originalMethod = asset.getDepreciationMethod();
            asset.setDepreciationMethod(method.name());

            try {
                BigDecimal monthlyDepreciation = calculateMonthlyDepreciation(asset);
                BigDecimal annualDepreciation = monthlyDepreciation.multiply(TWELVE)
                        .setScale(2, RoundingMode.HALF_UP);
                BigDecimal annualRate = annualDepreciation.divide(
                                originalValue.compareTo(BigDecimal.ZERO) > 0 ? originalValue : BigDecimal.ONE,
                                4, RoundingMode.HALF_UP)
                        .multiply(ONE_HUNDRED)
                        .setScale(2, RoundingMode.HALF_UP);
                BigDecimal accumulatedDepreciation = originalValue.subtract(currentValue).max(BigDecimal.ZERO)
                        .setScale(2, RoundingMode.HALF_UP);
                BigDecimal netValue = currentValue.setScale(2, RoundingMode.HALF_UP);

                items.add(new DepreciationComparisonItem(
                        method.name(),
                        method.getLabel(),
                        monthlyDepreciation,
                        annualDepreciation,
                        annualRate,
                        accumulatedDepreciation,
                        netValue,
                        getMethodDescription(method)
                ));
            } finally {
                // 恢复原始方法
                asset.setDepreciationMethod(originalMethod);
            }
        }

        return new DepreciationComparisonPage(
                assetId,
                asset.getAssetNo(),
                asset.getAssetName(),
                originalValue,
                currentValue,
                usefulLifeYears,
                effectivePeriod,
                items
        );
    }

    /**
     * 获取折旧方法的描述。
     */
    private String getMethodDescription(DepreciationMethodEnum method) {
        return switch (method) {
            case STRAIGHT_LINE -> "直线法：每年折旧额相等，计算简单，适用于使用均匀的资产";
            case DOUBLE_DECLINING -> "双倍余额递减法：前期折旧多，后期折旧少，适用于技术更新快的资产";
            case SYD -> "年数总和法：前期折旧多，后期折旧少，折旧额按年数递减";
            case UOP -> "工作量法：按实际工作量计算折旧，适用于使用程度不均的资产";
        };
    }

    public record DepreciationComparisonPage(
            Long assetId,
            String assetNo,
            String assetName,
            BigDecimal originalValue,
            BigDecimal currentValue,
            int usefulLifeYears,
            String period,
            List<DepreciationComparisonItem> data) {
    }

    public record DepreciationComparisonItem(
            String methodCode,
            String methodName,
            BigDecimal monthlyDepreciation,
            BigDecimal annualDepreciation,
            BigDecimal annualRate,
            BigDecimal accumulatedDepreciation,
            BigDecimal netValue,
            String description) {
    }
}
