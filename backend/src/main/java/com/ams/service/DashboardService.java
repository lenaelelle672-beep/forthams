package com.ams.service;

import com.ams.dto.AssetValueTrendDTO;
import com.ams.dto.DashboardStatsDTO;
import com.ams.dto.DeptAssetDistributionDTO;
import com.ams.entity.Asset;
import com.ams.entity.ApprovalProcess;
import com.ams.entity.Dept;
import com.ams.entity.MaintenanceRecord;
import com.ams.mapper.ApprovalProcessMapper;
import com.ams.mapper.AssetMapper;
import com.ams.mapper.DeptMapper;
import com.ams.mapper.MaintenanceRecordMapper;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
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

    public DashboardStatsDTO getStats() {
        DashboardStatsDTO stats = new DashboardStatsDTO();
        
        List<Asset> allAssets = assetMapper.selectList(null);
        
        stats.setTotalAssets((long) allAssets.size());
        stats.setInUseAssets(allAssets.stream().filter(a -> "IN_USE".equals(a.getStatus())).count());
        stats.setIdleAssets(allAssets.stream().filter(a -> "IDLE".equals(a.getStatus())).count());
        stats.setMaintenanceAssets(allAssets.stream().filter(a -> "MAINTENANCE".equals(a.getStatus())).count());
        stats.setScrapAssets(allAssets.stream().filter(a -> "SCRAP".equals(a.getStatus())).count());
        
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

    public List<AssetValueTrendDTO> getValueTrends(Integer days) {
        List<AssetValueTrendDTO> trends = new ArrayList<>();
        LocalDate today = LocalDate.now();
        
        for (int i = days - 1; i >= 0; i--) {
            AssetValueTrendDTO trend = new AssetValueTrendDTO();
            LocalDate date = today.minusDays(i);
            trend.setDate(date);
            
            List<Asset> allAssets = assetMapper.selectList(null);
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
        List<Asset> allAssets = assetMapper.selectList(null);
        
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

        Long totalMaintenanceCount = maintenanceRecordMapper.selectCount(null);

        QueryWrapper<MaintenanceRecord> avgCostWrapper = new QueryWrapper<>();
        avgCostWrapper.select("AVG(cost) AS avgCost");
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
                        .ge(MaintenanceRecord::getMaintenanceDate, monthStart)
                        .le(MaintenanceRecord::getMaintenanceDate, monthEnd)
        );

        stats.put("totalMaintenanceCount", totalMaintenanceCount);
        stats.put("avgMaintenanceCost", avgMaintenanceCost);
        stats.put("monthlyMaintenanceCount", monthlyMaintenanceCount);
        return stats;
    }

    public Long getPendingApprovals() {
        return approvalProcessMapper.selectCount(
                new LambdaQueryWrapper<ApprovalProcess>()
                        .eq(ApprovalProcess::getStatus, "PENDING")
        );
    }
}
