package com.ams.service;

import com.ams.dto.AssetValueTrendDTO;
import com.ams.dto.DashboardStatsDTO;
import com.ams.dto.DeptAssetDistributionDTO;
import com.ams.context.TenantContext;
import com.ams.entity.Asset;
import com.ams.entity.ApprovalProcess;
import com.ams.entity.Dept;
import com.ams.entity.InventoryTask;
import com.ams.entity.MaintenanceRecord;
import com.ams.entity.WorkOrder;
import com.ams.enums.AssetStatus;
import com.ams.mapper.ApprovalProcessMapper;
import com.ams.mapper.AssetMapper;
import com.ams.mapper.DeptMapper;
import com.ams.mapper.InventoryTaskMapper;
import com.ams.mapper.MaintenanceRecordMapper;
import com.ams.mapper.WorkOrderMapper;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.util.*;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class DashboardService {

    private final AssetMapper assetMapper;
    private final MaintenanceRecordMapper maintenanceRecordMapper;
    private final ApprovalProcessMapper approvalProcessMapper;
    private final DeptMapper deptMapper;
    private final WorkOrderMapper workOrderMapper;
    private final InventoryTaskMapper inventoryTaskMapper;

    public DashboardStatsDTO getStats() {
        List<Asset> allAssets = getCurrentTenantAssets();
        String tenantId = TenantContext.getTenantId();
        return buildStats(allAssets, tenantId, getPendingApprovals());
    }

    public DashboardStatsDTO getGlobalStats() {
        List<Asset> allAssets = assetMapper.selectList(new LambdaQueryWrapper<>());
        return buildStats(allAssets, null, getGlobalPendingApprovals());
    }

    private DashboardStatsDTO buildStats(List<Asset> allAssets, String tenantId, Long pendingApprovals) {
        DashboardStatsDTO stats = new DashboardStatsDTO();

        stats.setTotalAssets((long) allAssets.size());
        stats.setInUseAssets(allAssets.stream().filter(a -> AssetStatus.IN_USE.matches(a.getStatus())).count());
        stats.setIdleAssets(allAssets.stream().filter(a -> AssetStatus.IDLE.matches(a.getStatus())).count());
        stats.setMaintenanceAssets(allAssets.stream().filter(a -> AssetStatus.MAINTENANCE.matches(a.getStatus())).count());
        stats.setScrapAssets(allAssets.stream().filter(a -> AssetStatus.SCRAPPED.matches(a.getStatus())).count());
        stats.setUtilizationRate(calculateRate(stats.getInUseAssets(), stats.getTotalAssets()));

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

        stats.setPendingApprovals(pendingApprovals);
        stats.setPendingWorkOrders(getPendingWorkOrders(tenantId));
        stats.setInventoryProgress(getInventoryProgress(tenantId));
        stats.setCriticalAlerts(getCriticalAlerts(allAssets, tenantId));

        return stats;
    }

    public List<AssetValueTrendDTO> getValueTrends(Integer days) {
        List<AssetValueTrendDTO> trends = new ArrayList<>();
        LocalDate today = LocalDate.now();
        List<Asset> allAssets = getCurrentTenantAssets();

        for (int i = days - 1; i >= 0; i--) {
            AssetValueTrendDTO trend = new AssetValueTrendDTO();
            LocalDate date = today.minusDays(i);
            trend.setDate(date);

            BigDecimal totalValue = allAssets.stream()
                    .map(Asset::getOriginalValue)
                    .filter(Objects::nonNull)
                    .reduce(BigDecimal.ZERO, BigDecimal::add);
            BigDecimal currentValueSum = allAssets.stream()
                    .map(Asset::getCurrentValue)
                    .filter(Objects::nonNull)
                    .reduce(BigDecimal.ZERO, BigDecimal::add);

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

        Map<Long, String> deptNameMap = deptMapper.selectBatchIds(deptCountMap.keySet()).stream()
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
        } catch (Exception e) {
            stats.put("totalMaintenanceCount", 0);
            stats.put("avgMaintenanceCost", 0);
            stats.put("monthlyMaintenanceCount", 0);
        }
        return stats;
    }

    public Long getPendingApprovals() {
        String tenantId = TenantContext.getTenantId();
        if (tenantId == null) return 0L;
        return approvalProcessMapper.selectCount(
                new LambdaQueryWrapper<ApprovalProcess>()
                        .eq(ApprovalProcess::getTenantId, tenantId)
                        .eq(ApprovalProcess::getStatus, "PENDING")
        );
    }

    private Long getGlobalPendingApprovals() {
        return approvalProcessMapper.selectCount(
                new LambdaQueryWrapper<ApprovalProcess>()
                        .eq(ApprovalProcess::getStatus, "PENDING")
        );
    }

    private Long getPendingWorkOrders(String tenantId) {
        LambdaQueryWrapper<WorkOrder> wrapper = new LambdaQueryWrapper<WorkOrder>()
                .in(WorkOrder::getStatus, List.of("PENDING", "APPROVED", "EXECUTING"));
        if (tenantId != null && !tenantId.isBlank()) {
            wrapper.eq(WorkOrder::getTenantId, tenantId);
        }
        return workOrderMapper.selectCount(wrapper);
    }

    private Double getInventoryProgress(String tenantId) {
        LambdaQueryWrapper<InventoryTask> wrapper = new LambdaQueryWrapper<>();
        if (tenantId != null && !tenantId.isBlank()) {
            wrapper.eq(InventoryTask::getTenantId, tenantId);
        }

        List<InventoryTask> tasks = inventoryTaskMapper.selectList(wrapper);
        long totalCount = tasks.stream()
                .map(InventoryTask::getTotalCount)
                .filter(Objects::nonNull)
                .mapToLong(Integer::longValue)
                .sum();
        long scannedCount = tasks.stream()
                .map(InventoryTask::getScannedCount)
                .filter(Objects::nonNull)
                .mapToLong(Integer::longValue)
                .sum();
        return calculateRate(scannedCount, totalCount);
    }

    private Long getCriticalAlerts(List<Asset> allAssets, String tenantId) {
        long importantMaintenanceAssets = allAssets.stream()
                .filter(asset -> Integer.valueOf(1).equals(asset.getIsImportant()))
                .filter(asset -> AssetStatus.MAINTENANCE.matches(asset.getStatus()))
                .count();

        LambdaQueryWrapper<WorkOrder> wrapper = new LambdaQueryWrapper<WorkOrder>()
                .in(WorkOrder::getPriority, List.of("URGENT", "EMERGENCY"))
                .notIn(WorkOrder::getStatus, List.of("COMPLETED", "REJECTED", "CANCELLED"));
        if (tenantId != null && !tenantId.isBlank()) {
            wrapper.eq(WorkOrder::getTenantId, tenantId);
        }
        return importantMaintenanceAssets + workOrderMapper.selectCount(wrapper);
    }

    private Double calculateRate(long numerator, long denominator) {
        if (denominator <= 0) {
            return 0D;
        }
        return BigDecimal.valueOf(numerator)
                .multiply(BigDecimal.valueOf(100))
                .divide(BigDecimal.valueOf(denominator), 1, RoundingMode.HALF_UP)
                .doubleValue();
    }

    private List<Asset> getCurrentTenantAssets() {
        String tenantId = TenantContext.getTenantId();
        if (tenantId == null) return List.of();
        return assetMapper.selectList(new LambdaQueryWrapper<Asset>()
                .eq(Asset::getTenantId, tenantId));
    }

    private List<Long> getCurrentTenantAssetIds() {
        return getCurrentTenantAssets().stream()
                .map(Asset::getId)
                .filter(Objects::nonNull)
                .toList();
    }
}
