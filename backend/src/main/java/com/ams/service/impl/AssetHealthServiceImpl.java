package com.ams.service.impl;

import com.ams.context.TenantContext;
import com.ams.dto.AssetHealthVO;
import com.ams.entity.*;
import com.ams.mapper.*;
import com.ams.service.AssetHealthService;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.*;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class AssetHealthServiceImpl implements AssetHealthService {

    private final AssetMapper assetMapper;
    private final WorkOrderMapper workOrderMapper;
    private final AssetUtilizationSnapshotMapper utilizationSnapshotMapper;

    @Override
    public AssetHealthVO calculateHealth(Long assetId) {
        String tenantId = TenantContext.requireTenantId();
        Asset asset = assetMapper.selectOne(new LambdaQueryWrapper<Asset>()
                .eq(Asset::getId, assetId)
                .eq(Asset::getTenantId, tenantId));
        if (asset == null) throw new IllegalArgumentException("Asset not found: " + assetId);

        // 1. 年龄评分 (20%)
        int ageScore = calculateAgeScore(asset);

        // 2. 维修频率评分 (25%) — 近12个月维修次数
        int maintenanceScore = calculateMaintenanceScore(assetId, tenantId);

        // 3. 故障率评分 (20%) — 近12个月故障次数 / 运行天数
        int faultRateScore = calculateFaultRateScore(assetId, tenantId);

        // 4. 利用率评分 (20%)
        int utilizationScore = calculateUtilizationScore(assetId, tenantId);

        // 5. 折旧进度评分 (15%)
        int depreciationScore = calculateDepreciationScore(asset);

        // 加权计算总分
        BigDecimal total = BigDecimal.ZERO
                .add(BigDecimal.valueOf(ageScore).multiply(new BigDecimal("0.20")))
                .add(BigDecimal.valueOf(maintenanceScore).multiply(new BigDecimal("0.25")))
                .add(BigDecimal.valueOf(faultRateScore).multiply(new BigDecimal("0.20")))
                .add(BigDecimal.valueOf(utilizationScore).multiply(new BigDecimal("0.20")))
                .add(BigDecimal.valueOf(depreciationScore).multiply(new BigDecimal("0.15")));

        int finalScore = total.setScale(0, RoundingMode.HALF_UP).intValue();
        finalScore = Math.max(0, Math.min(100, finalScore)); // 限制在 0-100

        String level = finalScore > 80 ? "HEALTHY" : finalScore >= 50 ? "WARNING" : "CRITICAL";
        String assetName = asset.getAssetName() != null ? asset.getAssetName() : "";
        String assetCode = asset.getAssetNo() != null ? asset.getAssetNo() : "";

        return AssetHealthVO.builder()
                .assetId(assetId)
                .assetName(assetName)
                .assetCode(assetCode)
                .score(finalScore)
                .scoreLevel(level)
                .ageScore(ageScore)
                .maintenanceScore(maintenanceScore)
                .faultRateScore(faultRateScore)
                .utilizationScore(utilizationScore)
                .depreciationScore(depreciationScore)
                .build();
    }

    @Override
    public List<AssetHealthVO> batchCalculateHealth(List<Long> assetIds) {
        return assetIds.stream()
                .map(this::calculateHealth)
                .collect(Collectors.toList());
    }

    @Override
    public List<AssetHealthVO> getUnhealthyAssets(int topN, int minScore) {
        String tenantId = TenantContext.requireTenantId();
        List<Asset> assets = assetMapper.selectList(new LambdaQueryWrapper<Asset>()
                .eq(Asset::getTenantId, tenantId));

        return assets.stream()
                .map(a -> calculateHealth(a.getId()))
                .filter(vo -> vo.getScore() < minScore)
                .sorted(Comparator.comparingInt(AssetHealthVO::getScore))
                .limit(topN)
                .collect(Collectors.toList());
    }

    /** 年龄评分：基于购入日期和保修期 */
    private int calculateAgeScore(Asset asset) {
        if (asset.getPurchaseDate() == null) return 50;
        long yearsInService = ChronoUnit.YEARS.between(asset.getPurchaseDate(), LocalDate.now());
        if (yearsInService <= 1) return 100;
        if (yearsInService <= 3) return 80;
        if (yearsInService <= 5) return 60;
        if (yearsInService <= 10) return 40;
        if (yearsInService <= 15) return 20;
        return 10;
    }

    /** 维修频率评分：近12个月维修次数 */
    private int calculateMaintenanceScore(Long assetId, String tenantId) {
        LocalDate oneYearAgo = LocalDate.now().minusYears(1);
        long repairCount = workOrderMapper.selectCount(new LambdaQueryWrapper<WorkOrder>()
                .eq(WorkOrder::getAssetId, assetId)
                .eq(WorkOrder::getTenantId, tenantId)
                .ge(WorkOrder::getCreateTime, oneYearAgo.atStartOfDay()));

        if (repairCount == 0) return 100;
        if (repairCount <= 1) return 80;
        if (repairCount <= 3) return 60;
        if (repairCount <= 5) return 40;
        if (repairCount <= 10) return 20;
        return 5;
    }

    /** 故障率评分：近12个月故障次数 / 运行天数 */
    private int calculateFaultRateScore(Long assetId, String tenantId) {
        LocalDate oneYearAgo = LocalDate.now().minusYears(1);
        long faultCount = workOrderMapper.selectCount(new LambdaQueryWrapper<WorkOrder>()
                .eq(WorkOrder::getAssetId, assetId)
                .eq(WorkOrder::getTenantId, tenantId)
                .ge(WorkOrder::getCreateTime, oneYearAgo.atStartOfDay()));

        if (faultCount == 0) return 100;
        long days = ChronoUnit.DAYS.between(oneYearAgo, LocalDate.now());
        if (days <= 0) days = 1;
        double rate = (double) faultCount / days;

        if (rate <= 0.01) return 90;    // 约每年 ≤3次
        if (rate <= 0.03) return 70;    // 约每年 ≤10次
        if (rate <= 0.05) return 50;    // 约每年 ≤18次
        if (rate <= 0.1) return 30;     // 约每年 ≤36次
        return 10;
    }

    /** 利用率评分 */
    private int calculateUtilizationScore(Long assetId, String tenantId) {
        List<AssetUtilizationSnapshot> snapshots = utilizationSnapshotMapper.selectList(
                new LambdaQueryWrapper<AssetUtilizationSnapshot>()
                        .eq(AssetUtilizationSnapshot::getAssetId, assetId)
                        .orderByDesc(AssetUtilizationSnapshot::getPeriodEnd)
                        .last("LIMIT 10"));

        if (snapshots.isEmpty()) return 70; // 无数据时给中等分

        double avgUtilization = snapshots.stream()
                .mapToDouble(s -> s.getUtilizationRate() != null ? s.getUtilizationRate().doubleValue() : 0.0)
                .average()
                .orElse(0.0);

        if (avgUtilization >= 80) return 100;
        if (avgUtilization >= 60) return 80;
        if (avgUtilization >= 40) return 60;
        if (avgUtilization >= 20) return 40;
        return 20;
    }

    /** 折旧进度评分：currentValue / originalValue */
    private int calculateDepreciationScore(Asset asset) {
        if (asset.getOriginalValue() == null || asset.getOriginalValue().compareTo(BigDecimal.ZERO) <= 0) {
            return 50;
        }
        BigDecimal current = asset.getCurrentValue() != null ? asset.getCurrentValue() : BigDecimal.ZERO;
        double ratio = current.divide(asset.getOriginalValue(), 4, RoundingMode.HALF_UP).doubleValue();

        if (ratio >= 0.8) return 100;    // 几乎未折旧
        if (ratio >= 0.6) return 80;
        if (ratio >= 0.4) return 60;
        if (ratio >= 0.2) return 40;
        if (ratio >= 0.1) return 20;
        return 10; // 几乎完全折旧
    }
}
