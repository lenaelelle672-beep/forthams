package com.ams.service;

import com.ams.context.TenantContext;
import com.ams.entity.WorkOrder;
import com.ams.entity.WorkOrderTimeLog;
import com.ams.mapper.WorkOrderMapper;
import com.ams.mapper.WorkOrderTimeLogMapper;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDateTime;
import java.util.*;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class ReliabilityAnalyticsService {

    private final WorkOrderMapper workOrderMapper;
    private final WorkOrderTimeLogMapper workOrderTimeLogMapper;

    /**
     * 获取可靠性概览
     *
     * @param assetId  可选资产ID
     * @param startDate 开始时间
     * @param endDate   结束时间
     * @return 可靠性概览数据
     */
    public Map<String, Object> getSummary(Long assetId, LocalDateTime startDate, LocalDateTime endDate) {
        String tenantId = TenantContext.requireTenantId();

        // 查询已完成工单（COMPLETED 或 ACCEPTED 状态）
        LambdaQueryWrapper<WorkOrder> wrapper = new LambdaQueryWrapper<WorkOrder>()
                .eq(WorkOrder::getTenantId, tenantId)
                .in(WorkOrder::getStatus, "COMPLETED", "ACCEPTED")
                .orderByDesc(WorkOrder::getCreateTime);
        if (assetId != null) {
            wrapper.eq(WorkOrder::getAssetId, assetId);
        }
        if (startDate != null) {
            wrapper.ge(WorkOrder::getActualEndDate, startDate);
        }
        if (endDate != null) {
            wrapper.le(WorkOrder::getActualEndDate, endDate);
        }

        List<WorkOrder> completedOrders = workOrderMapper.selectList(wrapper);

        long totalFailures = completedOrders.size();
        long totalRepairMinutes = 0;

        for (WorkOrder wo : completedOrders) {
            List<WorkOrderTimeLog> logs = workOrderTimeLogMapper.selectList(
                    new LambdaQueryWrapper<WorkOrderTimeLog>()
                            .eq(WorkOrderTimeLog::getWorkOrderId, wo.getId())
                            .eq(WorkOrderTimeLog::getTenantId, tenantId));
            totalRepairMinutes += logs.stream()
                    .filter(l -> l.getDurationMinutes() != null)
                    .mapToLong(WorkOrderTimeLog::getDurationMinutes)
                    .sum();
        }

        double totalRepairHours = totalRepairMinutes / 60.0;
        double mtbf = totalFailures > 0 ? 8760.0 / totalFailures : 0; // 假设年运行时间 8760 小时
        double mttr = totalFailures > 0 ? totalRepairHours / totalFailures : 0;
        double availability = mtbf + mttr > 0 ? mtbf / (mtbf + mttr) * 100 : 100;
        double failureRate = totalFailures > 0 ? (double) totalFailures / 365.0 * 30 : 0; // 月均故障率

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("mtbf", round(mtbf, 2));
        result.put("mttr", round(mttr, 2));
        result.put("availability", round(availability, 2));
        result.put("failureRate", round(failureRate, 2));
        result.put("totalFailures", totalFailures);
        result.put("totalRepairHours", round(totalRepairHours, 2));
        result.put("totalOperatingHours", totalFailures * 8760);
        return result;
    }

    /**
     * 获取可靠性趋势（按月/季度）
     */
    public List<Map<String, Object>> getTrend(String period, LocalDateTime startDate, LocalDateTime endDate) {
        String tenantId = TenantContext.requireTenantId();

        LambdaQueryWrapper<WorkOrder> wrapper = new LambdaQueryWrapper<WorkOrder>()
                .eq(WorkOrder::getTenantId, tenantId)
                .in(WorkOrder::getStatus, "COMPLETED", "ACCEPTED");
        if (startDate != null) wrapper.ge(WorkOrder::getActualEndDate, startDate);
        if (endDate != null) wrapper.le(WorkOrder::getActualEndDate, endDate);

        List<WorkOrder> completedOrders = workOrderMapper.selectList(wrapper);

        // 按月分组
        Map<String, List<WorkOrder>> grouped = completedOrders.stream()
                .filter(wo -> wo.getActualEndDate() != null)
                .collect(Collectors.groupingBy(wo -> {
                    LocalDateTime d = wo.getActualEndDate();
                    return d.getYear() + "-" + String.format("%02d", d.getMonthValue());
                }));

        List<Map<String, Object>> trends = new ArrayList<>();
        for (Map.Entry<String, List<WorkOrder>> entry : grouped.entrySet()) {
            List<WorkOrder> orders = entry.getValue();
            long count = orders.size();
            long totalMinutes = 0;
            for (WorkOrder wo : orders) {
                List<WorkOrderTimeLog> logs = workOrderTimeLogMapper.selectList(
                        new LambdaQueryWrapper<WorkOrderTimeLog>()
                                .eq(WorkOrderTimeLog::getWorkOrderId, wo.getId())
                                .eq(WorkOrderTimeLog::getTenantId, tenantId));
                totalMinutes += logs.stream()
                        .filter(l -> l.getDurationMinutes() != null)
                        .mapToLong(WorkOrderTimeLog::getDurationMinutes)
                        .sum();
            }
            double totalHours = totalMinutes / 60.0;
            double mtbf = count > 0 ? 730.0 / count : 0; // 月均 730 小时
            double mttr = count > 0 ? totalHours / count : 0;
            double availability = mtbf + mttr > 0 ? mtbf / (mtbf + mttr) * 100 : 100;

            Map<String, Object> point = new LinkedHashMap<>();
            point.put("period", entry.getKey());
            point.put("mtbf", round(mtbf, 2));
            point.put("mttr", round(mttr, 2));
            point.put("availability", round(availability, 2));
            trends.add(point);
        }

        trends.sort(Comparator.comparing(m -> (String) m.get("period")));
        return trends;
    }

    /**
     * 获取资产可靠性排名
     */
    public List<Map<String, Object>> getRanking(String sortBy, Integer limit) {
        String tenantId = TenantContext.requireTenantId();

        List<WorkOrder> completedOrders = workOrderMapper.selectList(
                new LambdaQueryWrapper<WorkOrder>()
                        .eq(WorkOrder::getTenantId, tenantId)
                        .in(WorkOrder::getStatus, "COMPLETED", "ACCEPTED"));

        // 按资产分组
        Map<Long, List<WorkOrder>> byAsset = completedOrders.stream()
                .filter(wo -> wo.getAssetId() != null)
                .collect(Collectors.groupingBy(WorkOrder::getAssetId));

        List<Map<String, Object>> rankings = new ArrayList<>();
        for (Map.Entry<Long, List<WorkOrder>> entry : byAsset.entrySet()) {
            WorkOrder sample = entry.getValue().get(0);
            long count = entry.getValue().size();
            long totalMinutes = 0;
            for (WorkOrder wo : entry.getValue()) {
                List<WorkOrderTimeLog> logs = workOrderTimeLogMapper.selectList(
                        new LambdaQueryWrapper<WorkOrderTimeLog>()
                                .eq(WorkOrderTimeLog::getWorkOrderId, wo.getId())
                                .eq(WorkOrderTimeLog::getTenantId, tenantId));
                totalMinutes += logs.stream()
                        .filter(l -> l.getDurationMinutes() != null)
                        .mapToLong(WorkOrderTimeLog::getDurationMinutes)
                        .sum();
            }
            double totalHours = totalMinutes / 60.0;
            double mtbf = count > 0 ? 8760.0 / count : 0;
            double mttr = count > 0 ? totalHours / count : 0;
            double availability = mtbf + mttr > 0 ? mtbf / (mtbf + mttr) * 100 : 100;

            Map<String, Object> item = new LinkedHashMap<>();
            item.put("assetId", sample.getAssetId());
            item.put("assetName", sample.getAssetName() != null ? sample.getAssetName() : "未知");
            item.put("assetCode", sample.getAssetCode() != null ? sample.getAssetCode() : "未知");
            item.put("mtbf", round(mtbf, 2));
            item.put("mttr", round(mttr, 2));
            item.put("availability", round(availability, 2));
            item.put("failureCount", count);
            rankings.add(item);
        }

        // 排序
        String sortField = sortBy != null ? sortBy.toLowerCase() : "mtbf";
        Comparator<Map<String, Object>> comparator = switch (sortField) {
            case "mttr" -> Comparator.comparing(m -> (Double) m.get("mttr"));
            case "availability" -> Comparator.comparing(m -> (Double) m.get("availability"));
            default -> Comparator.comparing(m -> (Double) m.get("mtbf"));
        };
        rankings.sort(comparator.reversed());

        if (limit != null && limit > 0 && limit < rankings.size()) {
            rankings = rankings.subList(0, limit);
        }
        return rankings;
    }

    private double round(double value, int places) {
        return BigDecimal.valueOf(value).setScale(places, RoundingMode.HALF_UP).doubleValue();
    }
}
