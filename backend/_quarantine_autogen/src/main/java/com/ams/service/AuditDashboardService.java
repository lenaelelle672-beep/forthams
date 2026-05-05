package com.ams.service;

import com.ams.entity.AuditLog;
import com.ams.repository.AuditLogRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.*;
import java.util.stream.Collectors;

/**
 * 操作日志仪表板服务
 * 
 * 提供审计日志的聚合统计数据，支持以下维度：
 * - 按时间段的操作趋势分析
 * - 按操作类型的分布统计
 * - Top活跃用户排名
 * 
 * @since SWARM-003
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class AuditDashboardService {

    private final AuditLogRepository auditLogRepository;

    /**
     * 时间聚合粒度枚举
     */
    public enum TimeGranularity {
        HOURLY,  // 按小时聚合（适用于 <= 3 天）
        DAILY,   // 按天聚合（适用于 3-30 天）
        WEEKLY   // 按周聚合（适用于 > 30 天）
    }

    /**
     * 操作趋势数据点
     */
    public static class TrendDataPoint {
        private LocalDateTime timestamp;
        private long count;
        private String granularity;

        public TrendDataPoint() {}

        public TrendDataPoint(LocalDateTime timestamp, long count, String granularity) {
            this.timestamp = timestamp;
            this.count = count;
            this.granularity = granularity;
        }

        public LocalDateTime getTimestamp() {
            return timestamp;
        }

        public void setTimestamp(LocalDateTime timestamp) {
            this.timestamp = timestamp;
        }

        public long getCount() {
            return count;
        }

        public void setCount(long count) {
            this.count = count;
        }

        public String getGranularity() {
            return granularity;
        }

        public void setGranularity(String granularity) {
            this.granularity = granularity;
        }
    }

    /**
     * 操作类型分布数据
     */
    public static class OperationDistribution {
        private String operationType;
        private long count;
        private double percentage;

        public OperationDistribution() {}

        public OperationDistribution(String operationType, long count, double percentage) {
            this.operationType = operationType;
            this.count = count;
            this.percentage = percentage;
        }

        public String getOperationType() {
            return operationType;
        }

        public void setOperationType(String operationType) {
            this.operationType = operationType;
        }

        public long getCount() {
            return count;
        }

        public void setCount(long count) {
            this.count = count;
        }

        public double getPercentage() {
            return percentage;
        }

        public void setPercentage(double percentage) {
            this.percentage = percentage;
        }
    }

    /**
     * 活跃用户数据
     */
    public static class ActiveUserData {
        private String userId;
        private String username;
        private long operationCount;

        public ActiveUserData() {}

        public ActiveUserData(String userId, String username, long operationCount) {
            this.userId = userId;
            this.username = username;
            this.operationCount = operationCount;
        }

        public String getUserId() {
            return userId;
        }

        public void setUserId(String userId) {
            this.userId = userId;
        }

        public String getUsername() {
            return username;
        }

        public void setUsername(String username) {
            this.username = username;
        }

        public long getOperationCount() {
            return operationCount;
        }

        public void setOperationCount(long operationCount) {
            this.operationCount = operationCount;
        }
    }

    /**
     * 获取操作趋势数据
     * 
     * @param startTime 开始时间
     * @param endTime 结束时间
     * @param granularity 聚合粒度，null则自动选择
     * @return 趋势数据点列表，按时间升序排列
     * @throws IllegalArgumentException 如果时间范围非法（start > end 或超过90天）
     */
    public List<TrendDataPoint> getTrendData(LocalDateTime startTime, LocalDateTime endTime, 
                                              TimeGranularity granularity) {
        validateTimeRange(startTime, endTime);
        
        TimeGranularity resolvedGranularity = resolveGranularity(startTime, endTime, granularity);
        
        List<AuditLog> logs = auditLogRepository.findByCreatedAtBetween(startTime, endTime);
        
        Map<String, Long> aggregatedData = aggregateByGranularity(logs, resolvedGranularity);
        
        return aggregatedData.entrySet().stream()
                .map(entry -> new TrendDataPoint(
                        parseTimestamp(entry.getKey()),
                        entry.getValue(),
                        resolvedGranularity.name().toLowerCase()
                ))
                .sorted(Comparator.comparing(TrendDataPoint::getTimestamp))
                .collect(Collectors.toList());
    }

    /**
     * 获取操作类型分布统计
     * 
     * @param startTime 开始时间
     * @param endTime 结束时间
     * @return 操作类型分布列表，百分比从高到低排列
     * @throws IllegalArgumentException 如果时间范围非法
     */
    public List<OperationDistribution> getOperationDistribution(LocalDateTime startTime, LocalDateTime endTime) {
        validateTimeRange(startTime, endTime);
        
        List<AuditLog> logs = auditLogRepository.findByCreatedAtBetween(startTime, endTime);
        
        Map<String, Long> typeCountMap = logs.stream()
                .collect(Collectors.groupingBy(
                        log -> log.getActionType() != null ? log.getActionType() : "UNKNOWN",
                        Collectors.counting()
                ));
        
        long totalCount = typeCountMap.values().stream().mapToLong(Long::longValue).sum();
        
        if (totalCount == 0) {
            return Collections.emptyList();
        }
        
        return typeCountMap.entrySet().stream()
                .map(entry -> new OperationDistribution(
                        entry.getKey(),
                        entry.getValue(),
                        Math.round(entry.getValue() * 10000.0 / totalCount) / 100.0
                ))
                .sorted(Comparator.comparing(OperationDistribution::getCount).reversed())
                .collect(Collectors.toList());
    }

    /**
     * 获取Top活跃用户排名
     * 
     * @param startTime 开始时间
     * @param endTime 结束时间
     * @param limit 返回数量限制，默认10
     * @return 活跃用户列表，按操作次数降序排列
     * @throws IllegalArgumentException 如果时间范围非法或limit超出范围
     */
    public List<ActiveUserData> getTopActiveUsers(LocalDateTime startTime, LocalDateTime endTime, int limit) {
        validateTimeRange(startTime, endTime);
        
        if (limit <= 0 || limit > 100) {
            throw new IllegalArgumentException("Limit must be between 1 and 100");
        }
        
        List<AuditLog> logs = auditLogRepository.findByCreatedAtBetween(startTime, endTime);
        
        Map<String, Long> userCountMap = logs.stream()
                .filter(log -> log.getOperatorId() != null)
                .collect(Collectors.groupingBy(
                        AuditLog::getOperatorId,
                        Collectors.counting()
                ));
        
        return userCountMap.entrySet().stream()
                .sorted(Map.Entry.<String, Long>comparingByValue().reversed())
                .limit(limit)
                .map(entry -> new ActiveUserData(
                        entry.getKey(),
                        extractUsernameFromLogs(logs, entry.getKey()),
                        entry.getValue()
                ))
                .collect(Collectors.toList());
    }

    /**
     * 验证时间范围合法性
     * 
     * @param startTime 开始时间
     * @param endTime 结束时间
     * @throws IllegalArgumentException 如果时间范围非法
     */
    private void validateTimeRange(LocalDateTime startTime, LocalDateTime endTime) {
        if (startTime == null || endTime == null) {
            throw new IllegalArgumentException("Start time and end time cannot be null");
        }
        if (startTime.isAfter(endTime)) {
            throw new IllegalArgumentException("Start time cannot be after end time");
        }
        long daysBetween = java.time.Duration.between(startTime, endTime).toDays();
        if (daysBetween > 90) {
            throw new IllegalArgumentException("Time range cannot exceed 90 days");
        }
    }

    /**
     * 根据时间跨度自动选择聚合粒度
     * 
     * @param startTime 开始时间
     * @param endTime 结束时间
     * @param specified 指定粒度
     * @return 最终使用的粒度
     */
    private TimeGranularity resolveGranularity(LocalDateTime startTime, LocalDateTime endTime, 
                                                TimeGranularity specified) {
        if (specified != null) {
            return specified;
        }
        
        long daysBetween = java.time.Duration.between(startTime, endTime).toDays();
        
        if (daysBetween <= 3) {
            return TimeGranularity.HOURLY;
        } else if (daysBetween <= 30) {
            return TimeGranularity.DAILY;
        } else {
            return TimeGranularity.WEEKLY;
        }
    }

    /**
     * 按粒度聚合数据
     * 
     * @param logs 审计日志列表
     * @param granularity 聚合粒度
     * @return key为时间戳字符串，value为操作次数
     */
    private Map<String, Long> aggregateByGranularity(List<AuditLog> logs, TimeGranularity granularity) {
        DateTimeFormatter formatter = getFormatterForGranularity(granularity);
        
        return logs.stream()
                .collect(Collectors.groupingBy(
                        log -> formatTimestamp(log.getCreatedAt(), formatter),
                        Collectors.counting()
                ));
    }

    /**
     * 根据粒度获取日期格式化器
     * 
     * @param granularity 粒度
     * @return 日期时间格式化器
     */
    private DateTimeFormatter getFormatterForGranularity(TimeGranularity granularity) {
        return switch (granularity) {
            case HOURLY -> DateTimeFormatter.ofPattern("yyyy-MM-dd HH:00");
            case DAILY -> DateTimeFormatter.ofPattern("yyyy-MM-dd");
            case WEEKLY -> DateTimeFormatter.ofPattern("yyyy-'W'ww");
        };
    }

    /**
     * 解析时间戳字符串
     * 
     * @param timestampStr 时间戳字符串
     * @return LocalDateTime对象
     */
    private LocalDateTime parseTimestamp(String timestampStr) {
        if (timestampStr.contains("W")) {
            // 周格式特殊处理，返回周一
            String[] parts = timestampStr.split("-W");
            int year = Integer.parseInt(parts[0]);
            int week = Integer.parseInt(parts[1]);
            return java.time.temporal.WeekFields.ISO.weekDateYear(year);
        }
        
        DateTimeFormatter formatter = timestampStr.length() > 10 
                ? DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm") 
                : DateTimeFormatter.ofPattern("yyyy-MM-dd");
        
        return LocalDateTime.parse(timestampStr, formatter);
    }

    /**
     * 格式化时间戳
     * 
     * @param dateTime 日期时间
     * @param formatter 格式化器
     * @return 格式化后的字符串
     */
    private String formatTimestamp(LocalDateTime dateTime, DateTimeFormatter formatter) {
        if (dateTime == null) {
            return "unknown";
        }
        return dateTime.format(formatter);
    }

    /**
     * 从日志中提取用户名
     * 
     * @param logs 审计日志列表
     * @param operatorId 操作员ID
     * @return 用户名，如果未找到则返回 operatorId
     */
    private String extractUsernameFromLogs(List<AuditLog> logs, String operatorId) {
        return logs.stream()
                .filter(log -> operatorId.equals(log.getOperatorId()))
                .findFirst()
                .map(AuditLog::getOperatorName)
                .orElse(operatorId);
    }
}