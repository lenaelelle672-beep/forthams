package com.ams.service;

import com.ams.common.exception.BusinessException;
import com.ams.context.TenantContext;
import com.ams.entity.Asset;
import com.ams.mapper.AssetMapper;
import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.YearMonth;
import java.time.format.DateTimeParseException;
import java.util.Collections;
import java.util.List;
import java.util.Set;

@Service
@RequiredArgsConstructor
public class DepreciationService {

    private static final Set<String> TERMINAL_STATUSES = Set.of(
            "RETIRED",
            "SCRAPPED",
            "DISPOSED",
            "WRITTEN_OFF"
    );
    private static final BigDecimal ONE_HUNDRED = new BigDecimal("100");
    private static final BigDecimal TWELVE = new BigDecimal("12");

    private final AssetMapper assetMapper;

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
        for (Asset asset : assets) {
            if (isTerminal(asset.getStatus())) {
                throw new BusinessException("终态资产不可执行折旧计算");
            }
            BigDecimal monthlyDepreciation = calculateMonthlyDepreciation(asset);
            BigDecimal currentValue = valueOrZero(asset.getCurrentValue());
            BigDecimal nextValue = currentValue.subtract(monthlyDepreciation).max(BigDecimal.ZERO)
                    .setScale(2, RoundingMode.HALF_UP);
            asset.setCurrentValue(nextValue);
            assetMapper.updateById(asset);
            processed += 1;
        }

        return new BatchCalculateResponse(processed, "折旧计算完成");
    }

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
                "straight_line"
        );
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

    private BigDecimal calculateMonthlyDepreciation(Asset asset) {
        BigDecimal originalValue = valueOrZero(asset.getOriginalValue());
        BigDecimal annualRate = normalizeRate(asset.getDepreciationRate());
        if (originalValue.compareTo(BigDecimal.ZERO) <= 0 || annualRate.compareTo(BigDecimal.ZERO) <= 0) {
            return BigDecimal.ZERO.setScale(2, RoundingMode.HALF_UP);
        }
        return originalValue.multiply(annualRate)
                .divide(TWELVE, 2, RoundingMode.HALF_UP);
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
}
