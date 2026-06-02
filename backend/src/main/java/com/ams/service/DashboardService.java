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
        String tenantId = TenantContext.getTenantId();
        if (tenantId == null || tenantId.isBlank()) {
            return emptyStats();
        }
        return buildStatsFromDb(tenantId, getPendingApprovals());
    }

    private DashboardStatsDTO emptyStats() {
        DashboardStatsDTO stats = new DashboardStatsDTO();
        stats.setTotalAssets(0L);
        stats.setInUseAssets(0L);
        stats.setIdleAssets(0L);
        stats.setMaintenanceAssets(0L);
        stats.setScrapAssets(0L);
        stats.setUtilizationRate(0D);
        stats.setTotalValue(BigDecimal.ZERO);
        stats.setNetValue(BigDecimal.ZERO);
        stats.setCategoryDistribution(new HashMap<>());
        stats.setPendingApprovals(0L);
        stats.setPendingWorkOrders(0L);
        stats.setInventoryProgress(0D);
        stats.setCriticalAlerts(0L);
        return stats;
    }

    public DashboardStatsDTO getGlobalStats() {
        return buildStatsFromDb(null, getGlobalPendingApprovals());
    }

    /**
     * 基于 SQL 聚合查询构建仪表盘统计，替代原有的全量 selectList + 内存 filter 模式。
     */
    private DashboardStatsDTO buildStatsFromDb(String tenantId, Long pendingApprovals) {
        DashboardStatsDTO stats = new DashboardStatsDTO();
        boolean hasTenant = tenantId != null && !tenantId.isBlank();

        // 1. 总数
        LambdaQueryWrapper<Asset> countWrapper = new LambdaQueryWrapper<>();
        if (hasTenant) {
            countWrapper.eq(Asset::getTenantId, tenantId);
        }
        Long totalAssets = assetMapper.selectCount(countWrapper);
        stats.setTotalAssets(totalAssets != null ? totalAssets : 0L);

        // 2. 状态分布：SELECT status, COUNT(*) GROUP BY status
        QueryWrapper<Asset> statusQw = new QueryWrapper<>();
        if (hasTenant) {
            statusQw.eq("tenant_id", tenantId);
        }
        statusQw.select("status, COUNT(*) as cnt").groupBy("status");
        List<Map<String, Object>> statusRows = assetMapper.selectMaps(statusQw);
        long inUse = 0, idle = 0, maintenance = 0, scrap = 0;
        for (Map<String, Object> row : statusRows) {
            Object statusObj = row.get("status");
            Object cntObj = row.get("cnt");
            if (statusObj == null || cntObj == null) continue;
            String status = statusObj.toString();
            long count = ((Number) cntObj).longValue();
            if (AssetStatus.IN_USE.matches(status)) {
                inUse = count;
            } else if (AssetStatus.IDLE.matches(status)) {
                idle = count;
            } else if (AssetStatus.MAINTENANCE.matches(status)) {
                maintenance = count;
            } else if (AssetStatus.SCRAPPED.matches(status)) {
                scrap = count;
            }
        }
        stats.setInUseAssets(inUse);
        stats.setIdleAssets(idle);
        stats.setMaintenanceAssets(maintenance);
        stats.setScrapAssets(scrap);
        stats.setUtilizationRate(calculateRate(inUse, totalAssets != null ? totalAssets : 0L));

        // 3. 价值总和：SELECT SUM(original_value), SUM(current_value)
        QueryWrapper<Asset> valueQw = new QueryWrapper<>();
        if (hasTenant) {
            valueQw.eq("tenant_id", tenantId);
        }
        valueQw.select("IFNULL(SUM(original_value),0) as totalValue, IFNULL(SUM(current_value),0) as netValue");
        List<Map<String, Object>> valueRows = assetMapper.selectMaps(valueQw);
        if (!valueRows.isEmpty()) {
            Map<String, Object> row = valueRows.get(0);
            stats.setTotalValue(toBigDecimal(row.get("totalValue")));
            stats.setNetValue(toBigDecimal(row.get("netValue")));
        }

        // 4. 分类分布：SELECT category_id, COUNT(*) GROUP BY category_id
        QueryWrapper<Asset> catQw = new QueryWrapper<>();
        if (hasTenant) {
            catQw.eq("tenant_id", tenantId);
        }
        catQw.select("category_id, COUNT(*) as cnt")
                .isNotNull("category_id")
                .groupBy("category_id");
        List<Map<String, Object>> catRows = assetMapper.selectMaps(catQw);
        Map<String, Long> categoryDist = new HashMap<>();
        for (Map<String, Object> row : catRows) {
            Object catIdObj = row.get("category_id");
            Object cntObj = row.get("cnt");
            Long catId = catIdObj != null ? ((Number) catIdObj).longValue() : 0L;
            long count = cntObj != null ? ((Number) cntObj).longValue() : 0L;
            categoryDist.put(String.valueOf(catId), count);
        }
        stats.setCategoryDistribution(categoryDist);

        // 5. 其他关联数据
        stats.setPendingApprovals(pendingApprovals);
        stats.setPendingWorkOrders(getPendingWorkOrders(tenantId));
        stats.setInventoryProgress(getInventoryProgress(tenantId));
        stats.setCriticalAlerts(getCriticalAlertsFromDb(tenantId));

        return stats;
    }

    public List<AssetValueTrendDTO> getValueTrends(Integer days) {
        List<AssetValueTrendDTO> trends = new ArrayList<>();
        LocalDate today = LocalDate.now();

        // 一次性计算资产总值，避免在循环中重复全量查询
        String tenantId = TenantContext.getTenantId();
        BigDecimal totalValue = BigDecimal.ZERO;
        BigDecimal netValue = BigDecimal.ZERO;
        if (tenantId != null && !tenantId.isBlank()) {
            QueryWrapper<Asset> valueQw = new QueryWrapper<>();
            valueQw.eq("tenant_id", tenantId);
            valueQw.select("IFNULL(SUM(original_value),0) as totalValue, IFNULL(SUM(current_value),0) as netValue");
            List<Map<String, Object>> rows = assetMapper.selectMaps(valueQw);
            if (!rows.isEmpty()) {
                Map<String, Object> row = rows.get(0);
                totalValue = toBigDecimal(row.get("totalValue"));
                netValue = toBigDecimal(row.get("netValue"));
            }
        }

        for (int i = days - 1; i >= 0; i--) {
            AssetValueTrendDTO trend = new AssetValueTrendDTO();
            trend.setDate(today.minusDays(i));
            trend.setTotalValue(totalValue);
            trend.setNetValue(netValue);
            trends.add(trend);
        }

        return trends;
    }

    public List<DeptAssetDistributionDTO> getDeptDistribution() {
        String tenantId = TenantContext.getTenantId();
        if (tenantId == null || tenantId.isBlank()) {
            return Collections.emptyList();
        }

        // 使用 SQL GROUP BY 替代全量查询 + 内存 groupBy
        QueryWrapper<Asset> qw = new QueryWrapper<>();
        qw.eq("tenant_id", tenantId)
                .isNotNull("dept_id")
                .select("dept_id, COUNT(*) as cnt")
                .groupBy("dept_id");
        List<Map<String, Object>> rows = assetMapper.selectMaps(qw);

        if (rows.isEmpty()) {
            return Collections.emptyList();
        }

        Set<Long> deptIds = rows.stream()
                .map(r -> ((Number) r.get("dept_id")).longValue())
                .collect(Collectors.toSet());
        Map<Long, String> deptNameMap = deptMapper.selectBatchIds(deptIds).stream()
                .collect(Collectors.toMap(Dept::getId, Dept::getName));

        return rows.stream()
                .map(row -> {
                    DeptAssetDistributionDTO dto = new DeptAssetDistributionDTO();
                    Long deptId = ((Number) row.get("dept_id")).longValue();
                    dto.setDeptId(deptId);
                    dto.setDeptName(deptNameMap.getOrDefault(deptId, "未知部门"));
                    dto.setAssetCount(((Number) row.get("cnt")).longValue());
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
                            .le(MaintenanceRecord::getMaintenanceDate, monthEnd));

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
        QueryWrapper<InventoryTask> wrapper = new QueryWrapper<>();
        if (tenantId != null && !tenantId.isBlank()) {
            wrapper.eq("tenant_id", tenantId);
        }
        // 使用 SQL SUM 聚合替代全量 selectList + 内存 sum
        wrapper.select("IFNULL(SUM(total_count),0) as totalCount, IFNULL(SUM(scanned_count),0) as scannedCount");
        List<Map<String, Object>> rows = inventoryTaskMapper.selectMaps(wrapper);
        if (rows.isEmpty()) {
            return 0D;
        }
        Map<String, Object> row = rows.get(0);
        long totalCount = row.get("totalCount") != null ? ((Number) row.get("totalCount")).longValue() : 0L;
        long scannedCount = row.get("scannedCount") != null ? ((Number) row.get("scannedCount")).longValue() : 0L;
        return calculateRate(scannedCount, totalCount);
    }

    private Long getCriticalAlertsFromDb(String tenantId) {
        // 重要维修资产计数：is_important=1 AND status='MAINTENANCE'
        QueryWrapper<Asset> assetQw = new QueryWrapper<>();
        if (tenantId != null && !tenantId.isBlank()) {
            assetQw.eq("tenant_id", tenantId);
        }
        assetQw.eq("is_important", 1).eq("status", "MAINTENANCE");
        Long importantMaintenanceAssets = assetMapper.selectCount(assetQw);

        // 高优先级未完成工单计数
        LambdaQueryWrapper<WorkOrder> woWrapper = new LambdaQueryWrapper<WorkOrder>()
                .in(WorkOrder::getPriority, List.of("HIGH", "CRITICAL", "URGENT", "EMERGENCY"))
                .notIn(WorkOrder::getStatus, List.of("COMPLETED", "REJECTED", "CANCELLED"));
        if (tenantId != null && !tenantId.isBlank()) {
            woWrapper.eq(WorkOrder::getTenantId, tenantId);
        }
        Long highPriorityOrders = workOrderMapper.selectCount(woWrapper);

        long important = importantMaintenanceAssets != null ? importantMaintenanceAssets : 0L;
        long high = highPriorityOrders != null ? highPriorityOrders : 0L;
        return important + high;
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

    private List<Long> getCurrentTenantAssetIds() {
        String tenantId = TenantContext.getTenantId();
        if (tenantId == null) return List.of();
        return getCurrentTenantAssets().stream()
                .map(Asset::getId)
                .filter(Objects::nonNull)
                .toList();
    }

    private List<Asset> getCurrentTenantAssets() {
        String tenantId = TenantContext.getTenantId();
        if (tenantId == null) return List.of();
        return assetMapper.selectList(new LambdaQueryWrapper<Asset>()
                .eq(Asset::getTenantId, tenantId));
    }

    private BigDecimal toBigDecimal(Object value) {
        if (value == null) return BigDecimal.ZERO;
        if (value instanceof BigDecimal) return (BigDecimal) value;
        return new BigDecimal(value.toString());
    }
}
