package com.ams.service;

import com.ams.dto.AssetValueTrendDTO;
import com.ams.dto.DashboardStatsDTO;
import com.ams.dto.DeptAssetDistributionDTO;
import com.ams.context.TenantContext;
import com.ams.entity.Asset;
import com.ams.entity.ApprovalProcess;
import com.ams.entity.Dept;
import com.ams.entity.MaintenanceRecord;
import com.ams.enums.AssetStatus;
import com.ams.mapper.ApprovalProcessMapper;
import com.ams.mapper.AssetMapper;
import com.ams.mapper.DeptMapper;
import com.ams.mapper.MaintenanceRecordMapper;
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

    private final AssetMapper assetMapper;
    private final MaintenanceRecordMapper maintenanceRecordMapper;
    private final ApprovalProcessMapper approvalProcessMapper;
    private final DeptMapper deptMapper;

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

        for (int i = days - 1; i >= 0; i--) {
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

        // 注意：sys_dept 表为全局共享部门字典，无 tenant_id 列（见 schema.sql / Dept 实体），
        // 因此这里不能按 tenant_id 过滤。租户隔离已由上游 getCurrentTenantAssets() 保证 ——
        // 此处只解析当前租户资产所引用到的部门 ID 的名称。改用 QueryWrapper.in 而非
        // selectBatchIds，使过滤条件显式且便于后续如新增 tenant_id 列时直接追加 .eq。
        Map<Long, String> deptNameMap = deptMapper.selectList(
                        new QueryWrapper<Dept>().in("id", deptCountMap.keySet())).stream()
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
        return approvalProcessMapper.selectCount(
                new LambdaQueryWrapper<ApprovalProcess>()
                        .eq(ApprovalProcess::getTenantId, tenantId)
                        .eq(ApprovalProcess::getStatus, "PENDING")
        );
    }

    private List<Asset> getCurrentTenantAssets() {
        String tenantId = TenantContext.requireTenantId();
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
