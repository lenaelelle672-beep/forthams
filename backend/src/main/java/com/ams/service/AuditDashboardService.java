package com.ams.service;

import com.ams.dto.*;
import com.ams.mapper.AuditLogMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.ArrayList;
import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class AuditDashboardService {

    private final AuditLogMapper auditLogMapper;

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
}
