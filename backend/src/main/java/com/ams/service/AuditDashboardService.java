package com.ams.service;

import com.ams.dto.*;
import com.ams.mapper.AuditLogMapper;
import com.ams.mapper.SysOperateLogMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class AuditDashboardService {

    private final AuditLogMapper auditLogMapper;
    private final SysOperateLogMapper sysOperateLogMapper;

    public TrendVO getTrend(LocalDate startDate, LocalDate endDate, String granularity) {
        return getTrend(startDate, endDate, granularity, null, null);
    }

    public TrendVO getTrend(LocalDate startDate, LocalDate endDate, String granularity, String operationType, String operatorId) {
        return getTrend(startDate, endDate, granularity, operationType, operatorId, null);
    }

    public TrendVO getTrend(
            LocalDate startDate,
            LocalDate endDate,
            String granularity,
            String operationType,
            String operatorId,
            String module) {
        LocalDateTime startTime = startDate.atStartOfDay();
        LocalDateTime endTime = endDate.atTime(LocalTime.MAX);

        String effectiveGranularity = (granularity != null) ? granularity : "daily";

        List<AuditLogMapper.TimeBucketRow> rows;
        if ("hourly".equalsIgnoreCase(effectiveGranularity) || "hour".equalsIgnoreCase(effectiveGranularity)) {
            rows = auditLogMapper.countByHour(startTime, endTime, operationType, operatorId, module);
        } else if ("weekly".equalsIgnoreCase(effectiveGranularity) || "week".equalsIgnoreCase(effectiveGranularity)) {
            rows = auditLogMapper.countByWeek(startTime, endTime, operationType, operatorId, module);
        } else {
            rows = auditLogMapper.countByDay(startTime, endTime, operationType, operatorId, module);
        }

        List<TrendVO.TrendDataPoint> points = rows.stream()
                .map(row -> TrendVO.TrendDataPoint.builder()
                        .date(row.getTimeBucket())
                        .count(row.getCount())
                        .build())
                .collect(Collectors.toList());

        return TrendVO.builder()
                .granularity(effectiveGranularity)
                .startDate(startDate.toString())
                .endDate(endDate.toString())
                .data(points)
                .build();
    }

    public TypeDistributionVO getTypeDistribution(LocalDate startDate, LocalDate endDate) {
        LocalDateTime startTime = startDate.atStartOfDay();
        LocalDateTime endTime = endDate.atTime(LocalTime.MAX);

        List<AuditLogMapper.TypeCountRow> rows = auditLogMapper.countByOperationType(startTime, endTime);

        long total = rows.stream().mapToLong(AuditLogMapper.TypeCountRow::getCount).sum();

        List<TypeDistributionVO.DistributionItem> distribution = rows.stream()
                .map(row -> {
                    double pct = total > 0 ? (row.getCount() * 100.0 / total) : 0.0;
                    return TypeDistributionVO.DistributionItem.builder()
                            .actionType(row.getOperationType())
                            .count(row.getCount())
                            .percentage(Math.round(pct * 100.0) / 100.0)
                            .build();
                })
                .collect(Collectors.toList());

        return TypeDistributionVO.builder()
                .totalOperations(total)
                .distribution(distribution)
                .build();
    }

    public List<OperatorRankingVO> getOperatorRanking(LocalDate startDate, LocalDate endDate, int limit) {
        int safeLimit = Math.max(1, Math.min(limit, 10));
        LocalDateTime startTime = startDate.atStartOfDay();
        LocalDateTime endTime = endDate.atTime(LocalTime.MAX);

        List<AuditLogMapper.OperatorCountRow> rows = auditLogMapper.countByOperator(startTime, endTime, safeLimit);

        List<OperatorRankingVO> result = new ArrayList<>();
        int rank = 1;
        for (AuditLogMapper.OperatorCountRow row : rows) {
            result.add(OperatorRankingVO.builder()
                    .rank(rank++)
                    .operatorId(row.getOperatorId())
                    .operatorName(row.getOperatorId())
                    .count(row.getCount())
                    .build());
        }
        return result;
    }

    public List<String> getOperationTypes() {
        return auditLogMapper.findAllOperationTypes();
    }

    /**
     * 获取审计仪表板统计(基于 sys_operate_log 表的 SQL GROUP BY 聚合).
     * 返回前端 AuditStats 接口匹配的 Map 结构:
     * { totalCount, trendData, typeDistribution, topOperators }
     */
    public Map<String, Object> getStats(String startTime, String endTime, String operationType) {
        LocalDateTime start = parseDateTime(startTime, false);
        LocalDateTime end = parseDateTime(endTime, true);

        // 1. 总操作数
        Long totalCount = sysOperateLogMapper.countTotal(start, end, operationType);

        // 2. 趋势数据(按天)
        List<AuditLogMapper.TimeBucketRow> trendRows = sysOperateLogMapper.countTrendByDay(start, end, operationType);
        List<Map<String, Object>> trendData = new ArrayList<>();
        for (AuditLogMapper.TimeBucketRow row : trendRows) {
            Map<String, Object> item = new LinkedHashMap<>();
            item.put("date", row.getTimeBucket());
            item.put("count", row.getCount());
            trendData.add(item);
        }

        // 3. 类型分布
        List<AuditLogMapper.TypeCountRow> typeRows = sysOperateLogMapper.countDistributionByType(start, end, operationType);
        Map<String, Object> typeDistribution = new LinkedHashMap<>();
        for (AuditLogMapper.TypeCountRow row : typeRows) {
            typeDistribution.put(row.getOperationType(), row.getCount());
        }

        // 4. 操作人排名(前5)
        List<AuditLogMapper.OperatorCountRow> operatorRows = sysOperateLogMapper.countTopOperators(start, end, operationType, 5);
        List<Map<String, Object>> topOperators = new ArrayList<>();
        for (AuditLogMapper.OperatorCountRow row : operatorRows) {
            Map<String, Object> item = new LinkedHashMap<>();
            item.put("operatorName", row.getOperatorId());
            item.put("count", row.getCount());
            topOperators.add(item);
        }

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("totalCount", totalCount != null ? totalCount : 0L);
        result.put("trendData", trendData);
        result.put("typeDistribution", typeDistribution);
        result.put("topOperators", topOperators);
        return result;
    }

    private LocalDateTime parseDateTime(String value, boolean endOfDay) {
        if (value == null || value.trim().isEmpty()) {
            return endOfDay ? LocalDateTime.now() : LocalDateTime.now().minusDays(7);
        }
        try {
            java.time.Instant instant = java.time.Instant.parse(value.trim());
            java.time.ZonedDateTime zdt = instant.atZone(java.time.ZoneId.systemDefault());
            if (endOfDay) {
                return zdt.toLocalDate().atTime(LocalTime.MAX);
            }
            return zdt.toLocalDateTime();
        } catch (Exception ignored) {
            return endOfDay ? LocalDateTime.now() : LocalDateTime.now().minusDays(7);
        }
    }
}
