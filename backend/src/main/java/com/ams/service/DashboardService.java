package com.ams.service;

import com.ams.common.exception.BusinessException;
import com.ams.dto.AssetValueTrendDTO;
import com.ams.dto.DashboardStatsDTO;
import com.ams.dto.DeptAssetDistributionDTO;
import com.ams.context.TenantContext;
import com.ams.entity.Asset;
import com.ams.entity.Dept;
import com.ams.entity.MaintenanceRecord;
import com.ams.entity.RetirementApplication;
import com.ams.enums.AssetStatus;
import com.ams.mapper.AssetMapper;
import com.ams.mapper.DeptMapper;
import com.ams.mapper.MaintenanceRecordMapper;
import com.ams.mapper.RetirementApplicationMapper;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.dao.DataAccessException;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.*;
import java.util.stream.Collectors;

@Service
@Slf4j
@RequiredArgsConstructor
public class DashboardService {

    public static final int MAX_TREND_DAYS = 365;
    private static final int DEFAULT_TREND_DAYS = 30;

    private final AssetMapper assetMapper;
    private final MaintenanceRecordMapper maintenanceRecordMapper;
    private final RetirementApplicationMapper retirementApplicationMapper;
    private final DeptMapper deptMapper;
    private final AssetDataPermissionEvaluator assetDataPermissionEvaluator;

    public DashboardStatsDTO getStats() {
        DashboardStatsDTO stats = new DashboardStatsDTO();
        
        List<Asset> allAssets = getCurrentTenantAssets();
        
        stats.setTotalAssets((long) allAssets.size());
        stats.setInUseAssets(allAssets.stream().filter(a -> AssetStatus.IN_USE.matches(a.getStatus())).count());
        stats.setIdleAssets(allAssets.stream().filter(a -> AssetStatus.IDLE.matches(a.getStatus())).count());
        stats.setMaintenanceAssets(allAssets.stream().filter(a -> AssetStatus.MAINTENANCE.matches(a.getStatus())).count());
        stats.setScrapAssets(allAssets.stream().filter(a -> AssetStatus.SCRAPPED.matches(a.getStatus())).count());
        
        BigDecimal totalValue = allAssets.stream()
                .map(Asset::getOriginalValue)
                .filter(Objects::nonNull)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        stats.setTotalValue(totalValue);
        
        BigDecimal currentValueSum = allAssets.stream()
                .map(Asset::getCurrentValue)
                .filter(Objects::nonNull)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        stats.setNetValue(currentValueSum);
        
        Map<String, Long> categoryDist = allAssets.stream()
                .collect(Collectors.groupingBy(
                        a -> String.valueOf(a.getCategoryId() != null ? a.getCategoryId() : 0),
                        Collectors.counting()
                ));
        stats.setCategoryDistribution(categoryDist);
        
        stats.setPendingApprovals(getPendingApprovals());
        
        return stats;
    }

    /**
     * 返回最近 {@code days} 天的资产价值趋势。
     * <p>
     * <b>注意：当前为「快照视图」而非历史视图。</b> 数据库目前没有 value-history 价值历史表，
     * 因此这里复用的是当前资产快照的原值/现值，所有日期会呈现同一总值（即价值不变的水平线）。
     * 真正的历史趋势需要新增 value-history 表并按日聚合，待该表落地后再切换实现。
     * <p>
     * 性能：原值/现值在循环外只计算一次（O(assets)），随后按天填充，避免 O(days * assets) 的重复扫描。
     */
    public List<AssetValueTrendDTO> getValueTrends(Integer days) {
        int boundedDays = normalizeTrendDays(days);
        List<AssetValueTrendDTO> trends = new ArrayList<>();
        LocalDate today = LocalDate.now();
        List<Asset> allAssets = getCurrentTenantAssets();

        // 总值/净值按当前快照计算一次，所有日期共用同一份结果（见方法注释）。
        BigDecimal totalValue = allAssets.stream()
                .map(Asset::getOriginalValue)
                .filter(Objects::nonNull)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal currentValueSum = allAssets.stream()
                .map(Asset::getCurrentValue)
                .filter(Objects::nonNull)
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        for (int i = boundedDays - 1; i >= 0; i--) {
            AssetValueTrendDTO trend = new AssetValueTrendDTO();
            trend.setDate(today.minusDays(i));
            trend.setTotalValue(totalValue);
            trend.setNetValue(currentValueSum);
            trends.add(trend);
        }

        return trends;
    }

    public List<DeptAssetDistributionDTO> getDeptDistribution() {
        List<Asset> allAssets = getCurrentTenantAssets();
        
        Map<Long, Long> deptCountMap = allAssets.stream()
                .filter(a -> a.getDeptId() != null)
                .collect(Collectors.groupingBy(Asset::getDeptId, Collectors.counting()));

        if (deptCountMap.isEmpty()) {
            return Collections.emptyList();
        }

        String tenantId = TenantContext.requireTenantId();
        Map<Long, String> deptNameMap = deptMapper.selectList(
                        new QueryWrapper<Dept>()
                                .eq("tenant_id", tenantId)
                                .eq("deleted", 0)
                                .in("id", deptCountMap.keySet())).stream()
                .collect(Collectors.toMap(Dept::getId, Dept::getName));

        return deptCountMap.entrySet().stream()
                .map(entry -> {
                    DeptAssetDistributionDTO dto = new DeptAssetDistributionDTO();
                    dto.setDeptId(entry.getKey());
                    dto.setDeptName(deptNameMap.getOrDefault(entry.getKey(), "未知部门"));
                    dto.setAssetCount(entry.getValue());
                    return dto;
                })
                .sorted(Comparator.comparing(DeptAssetDistributionDTO::getAssetCount).reversed())
                .collect(Collectors.toList());
    }

    public Map<String, Object> getMaintenanceStats() {
        Map<String, Object> stats = new HashMap<>();
        try {
        List<Long> tenantAssetIds = getCurrentTenantAssetIds();
        if (tenantAssetIds.isEmpty()) {
            stats.put("totalMaintenanceCount", 0L);
            stats.put("avgMaintenanceCost", BigDecimal.ZERO);
            stats.put("monthlyMaintenanceCount", 0L);
            return stats;
        }

        Long totalMaintenanceCount = maintenanceRecordMapper.selectCount(
                new LambdaQueryWrapper<MaintenanceRecord>()
                        .in(MaintenanceRecord::getAssetId, tenantAssetIds));

        QueryWrapper<MaintenanceRecord> avgCostWrapper = new QueryWrapper<>();
        avgCostWrapper.select("AVG(cost) AS avgCost")
                .in("asset_id", tenantAssetIds);
        Map<String, Object> avgCostMap = maintenanceRecordMapper.selectMaps(avgCostWrapper)
                .stream()
                .findFirst()
                .orElse(Collections.emptyMap());
        Object avgCostObj = avgCostMap.get("avgCost");
        BigDecimal avgMaintenanceCost = avgCostObj == null
                ? BigDecimal.ZERO
                : new BigDecimal(avgCostObj.toString());

        LocalDate today = LocalDate.now();
        LocalDate monthStart = today.withDayOfMonth(1);
        LocalDate monthEnd = today.withDayOfMonth(today.lengthOfMonth());
        Long monthlyMaintenanceCount = maintenanceRecordMapper.selectCount(
                new LambdaQueryWrapper<MaintenanceRecord>()
                        .in(MaintenanceRecord::getAssetId, tenantAssetIds)
                        .ge(MaintenanceRecord::getMaintenanceDate, monthStart)
                        .le(MaintenanceRecord::getMaintenanceDate, monthEnd)
        );

        stats.put("totalMaintenanceCount", totalMaintenanceCount);
        stats.put("avgMaintenanceCost", avgMaintenanceCost);
        stats.put("monthlyMaintenanceCount", monthlyMaintenanceCount);
        } catch (DataAccessException | NumberFormatException e) {
            // 仅捕获可预期的 DB 访问异常与 AVG 结果数值转换异常，避免吞掉 NPE/编程错误等。
            // 失败时记录告警，便于定位；返回值类型与成功路径保持一致（Long / BigDecimal），
            // 而非原先的 Integer 0，避免下游因类型不一致出现 ClassCastException。
            log.warn("Maintenance stats query failed", e);
            stats.put("totalMaintenanceCount", 0L);
            stats.put("avgMaintenanceCost", BigDecimal.ZERO);
            stats.put("monthlyMaintenanceCount", 0L);
        }
        return stats;
    }

    public Long getPendingApprovals() {
        String tenantId = TenantContext.requireTenantId();
        LambdaQueryWrapper<RetirementApplication> wrapper = new LambdaQueryWrapper<RetirementApplication>()
                .eq(RetirementApplication::getTenantId, tenantId)
                .in(RetirementApplication::getStatus, List.of("PENDING", "APPROVING"));
        // approval_process 没有统一 asset_id，不能安全对所有流程复用资产范围；只计入可证明
        // 与可见资产关联的退役审批，其他流程在此资产域 dashboard 中默认不展示。
        assetDataPermissionEvaluator.applyToRelatedAsset(wrapper);
        return retirementApplicationMapper.selectCount(wrapper);
    }

    private List<Asset> getCurrentTenantAssets() {
        String tenantId = TenantContext.requireTenantId();
        LambdaQueryWrapper<Asset> wrapper = new LambdaQueryWrapper<Asset>()
                .eq(Asset::getTenantId, tenantId);
        assetDataPermissionEvaluator.applyTo(wrapper);
        return assetMapper.selectList(wrapper);
    }

    private List<Long> getCurrentTenantAssetIds() {
        return getCurrentTenantAssets().stream()
                .map(Asset::getId)
                .filter(Objects::nonNull)
                .toList();
    }

    private int normalizeTrendDays(Integer days) {
        int requestedDays = days == null ? DEFAULT_TREND_DAYS : days;
        if (requestedDays < 1 || requestedDays > MAX_TREND_DAYS) {
            throw new BusinessException("days必须在1到" + MAX_TREND_DAYS + "之间");
        }
        return requestedDays;
    }
}
