package com.ams.service;

import com.ams.common.exception.BusinessException;
import com.ams.context.TenantContext;
import com.ams.dto.TcoCompareDTO;
import com.ams.dto.TcoResultDTO;
import com.ams.dto.TcoTrendDTO;
import com.ams.entity.*;
import com.ams.mapper.*;
import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.util.*;
import java.util.stream.Collectors;

/**
 * TCO 全生命周期成本计算服务
 * 公式: TCO = 采购成本 + 维保成本 + 工单成本 + 能耗成本 + 保险保费 - 当前净值
 */
@Service
@RequiredArgsConstructor
public class TcoService {

    private final AssetMapper assetMapper;
    private final MaintenanceRecordMapper maintenanceRecordMapper;
    private final WorkOrderMapper workOrderMapper;
    private final EnergyConsumptionMapper energyConsumptionMapper;
    private final InsuranceMapper insuranceMapper;
    private final TCORecordMapper tcoRecordMapper;

    private static final BigDecimal ZERO = BigDecimal.ZERO;

    /**
     * 计算单个资产的 TCO
     */
    @Transactional(rollbackFor = Exception.class)
    public TcoResultDTO calculateTco(Long assetId) {
        String tenantId = TenantContext.requireTenantId();

        Asset asset = assetMapper.selectOne(new QueryWrapper<Asset>()
                .eq("tenant_id", tenantId).eq("id", assetId));
        if (asset == null) {
            throw new BusinessException("资产不存在");
        }

        // 采购成本 (优先使用 purchaseCost，否则用 originalValue)
        BigDecimal purchaseCost = valueOrZero(asset.getPurchaseCost())
                .compareTo(ZERO) > 0 ? asset.getPurchaseCost() : valueOrZero(asset.getOriginalValue());

        // 维保成本
        BigDecimal maintenanceCost = aggregateMaintenanceCost(tenantId, assetId);

        // 工单成本
        BigDecimal workOrderCost = aggregateWorkOrderCost(tenantId, assetId);

        // 能耗成本
        BigDecimal energyCost = aggregateEnergyCost(tenantId, assetId);

        // 保险保费
        BigDecimal insuranceCost = aggregateInsuranceCost(tenantId, assetId);

        // 当前净值 (作为残值抵扣)
        BigDecimal currentValue = valueOrZero(asset.getCurrentValue());

        // TCO = 采购 + 维保 + 工单 + 能耗 + 保险 - 当前净值
        BigDecimal totalCost = purchaseCost.add(maintenanceCost).add(workOrderCost)
                .add(energyCost).add(insuranceCost).subtract(currentValue)
                .max(ZERO).setScale(2, RoundingMode.HALF_UP);

        // 持久化 TCO 记录
        TCORecord record = new TCORecord();
        record.setTenantId(tenantId);
        record.setAssetId(assetId);
        record.setCalculationDate(LocalDate.now());
        record.setPeriodYear(LocalDate.now().getYear());
        record.setPeriodMonth(LocalDate.now().getMonthValue());
        record.setTotalCost(totalCost);
        record.setPurchaseCost(purchaseCost);
        record.setMaintenanceCost(maintenanceCost);
        record.setWorkOrderCost(workOrderCost);
        record.setEnergyCost(energyCost);
        record.setInsuranceCost(insuranceCost);
        record.setCurrentValue(currentValue);
        tcoRecordMapper.insert(record);

        return new TcoResultDTO(
                assetId, asset.getAssetNo(), asset.getAssetName(),
                purchaseCost, maintenanceCost, workOrderCost, energyCost, insuranceCost,
                currentValue, totalCost, record.getCalculationDate()
        );
    }

    /**
     * 按部门聚合 TCO
     */
    public List<TcoResultDTO> getTcoByDepartment(Long deptId) {
        String tenantId = TenantContext.requireTenantId();
        List<Asset> assets = assetMapper.selectList(new QueryWrapper<Asset>()
                .eq("tenant_id", tenantId).eq("dept_id", deptId));
        return assets.stream()
                .map(a -> {
                    try {
                        return calculateTco(a.getId());
                    } catch (Exception e) {
                        return null;
                    }
                })
                .filter(Objects::nonNull)
                .collect(Collectors.toList());
    }

    /**
     * 按分类聚合 TCO
     */
    public List<TcoResultDTO> getTcoByCategory(Long categoryId) {
        String tenantId = TenantContext.requireTenantId();
        List<Asset> assets = assetMapper.selectList(new QueryWrapper<Asset>()
                .eq("tenant_id", tenantId).eq("category_id", categoryId));
        return assets.stream()
                .map(a -> {
                    try {
                        return calculateTco(a.getId());
                    } catch (Exception e) {
                        return null;
                    }
                })
                .filter(Objects::nonNull)
                .collect(Collectors.toList());
    }

    /**
     * 获取单个资产的 TCO 趋势
     */
    public List<TcoTrendDTO> getTcoTrend(Long assetId, int months) {
        String tenantId = TenantContext.requireTenantId();
        LocalDate since = LocalDate.now().minusMonths(months);
        List<TCORecord> records = tcoRecordMapper.selectByAssetId(tenantId, assetId);
        return records.stream()
                .filter(r -> !r.getCalculationDate().isBefore(since))
                .map(r -> new TcoTrendDTO(
                        r.getCalculationDate().toString(),
                        valueOrZero(r.getTotalCost()),
                        valueOrZero(r.getPurchaseCost()),
                        valueOrZero(r.getMaintenanceCost()),
                        valueOrZero(r.getWorkOrderCost()),
                        valueOrZero(r.getEnergyCost()),
                        valueOrZero(r.getInsuranceCost())
                ))
                .sorted(Comparator.comparing(TcoTrendDTO::period))
                .collect(Collectors.toList());
    }

    /**
     * 获取同类资产对比 (同分类下 TCO 排行)
     */
    public List<TcoCompareDTO> getCategoryComparison(Long categoryId) {
        String tenantId = TenantContext.requireTenantId();
        List<Asset> assets = assetMapper.selectList(new QueryWrapper<Asset>()
                .eq("tenant_id", tenantId).eq("category_id", categoryId));
        return assets.stream()
                .map(a -> {
                    BigDecimal tco = ZERO;
                    try {
                        TcoResultDTO result = calculateTco(a.getId());
                        tco = result.totalCost();
                    } catch (Exception ignored) {}
                    return new TcoCompareDTO(
                            a.getId(), a.getAssetNo(), a.getAssetName(),
                            tco, tco
                    );
                })
                .sorted((a, b) -> b.totalCost().compareTo(a.totalCost()))
                .collect(Collectors.toList());
    }

    // ── 聚合辅助方法 ─────────────────────────────────────────────────────

    private BigDecimal aggregateMaintenanceCost(String tenantId, Long assetId) {
        List<MaintenanceRecord> records = maintenanceRecordMapper.selectList(
                new QueryWrapper<MaintenanceRecord>()
                        .eq("tenant_id", tenantId).eq("asset_id", assetId));
        return records.stream()
                .map(r -> valueOrZero(r.getCost()))
                .reduce(ZERO, BigDecimal::add);
    }

    private BigDecimal aggregateWorkOrderCost(String tenantId, Long assetId) {
        List<WorkOrder> orders = workOrderMapper.selectList(
                new QueryWrapper<WorkOrder>()
                        .eq("tenant_id", tenantId).eq("asset_id", assetId));
        return orders.stream()
                .map(r -> valueOrZero(r.getActualCost()))
                .reduce(ZERO, BigDecimal::add);
    }

    private BigDecimal aggregateEnergyCost(String tenantId, Long assetId) {
        // energy_consumption 表无 tenant_id 列，通过 asset JOIN 多租户
        List<EnergyConsumption> records = energyConsumptionMapper.selectList(
                new QueryWrapper<EnergyConsumption>().eq("asset_id", assetId));
        return records.stream()
                .map(r -> valueOrZero(r.getCost()))
                .reduce(ZERO, BigDecimal::add);
    }

    private BigDecimal aggregateInsuranceCost(String tenantId, Long assetId) {
        List<Insurance> policies = insuranceMapper.selectByAssetId(tenantId, assetId);
        return policies.stream()
                .map(r -> valueOrZero(r.getPremium()))
                .reduce(ZERO, BigDecimal::add);
    }

    private BigDecimal valueOrZero(BigDecimal value) {
        return value == null ? ZERO : value;
    }
}
