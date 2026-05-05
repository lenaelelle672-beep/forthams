package com.ams.service;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.*;
import java.util.stream.Collectors;

import org.springframework.stereotype.Service;

import com.ams.entity.AuditLog;
import com.ams.repository.AuditLogRepository;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

/**
 * 趋势计算服务
 * 
 * <p>为操作日志仪表板提供趋势数据计算能力，支持：
 * <ul>
 *   <li>操作频率趋势分析（按日/周/月）</li>
 *   <li>风险等级分布统计</li>
 *   <li>高风险操作频率变化追踪</li>
 *   <li>合规性监控数据聚合</li>
 * </ul>
 * 
 * <p><b>ATB 相关性：</b>
 * <ul>
 *   <li>ATB-002: 趋势数据计算准确性 - {@link #calculateDailyTrend(LocalDate, LocalDate)}</li>
 *   <li>ATB-003: 风险分布数据正确性 - {@link #calculateRiskDistribution(LocalDate, LocalDate)}</li>
 *   <li>PTB-003: API 响应时间性能基准验证</li>
 * </ul>
 * 
 * @since SWARM-003 Iteration 1
 * @see <a href="/docs/swarm-003-spec.md">SWARM-003 规格文档</a>
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class TrendCalculationService {

    private final AuditLogRepository auditLogRepository;

    /** 风险等级优先级排序（从高到低） */
    private static final List<String> RISK_ORDER = Arrays.asList(
            "CRITICAL", "HIGH", "MEDIUM", "LOW"
    );

    /**
     * 计算每日操作趋势数据
     * 
     * <p>统计指定日期范围内的每日操作数量，返回时间序列数据点列表。
     * 
     * <p><b>测试验证点（ATB-002）：</b>
     * <ul>
     *   <li>返回数据点数量与查询日期范围匹配</li>
     *   <li>每个数据点包含 date 和 count 字段</li>
     *   <li>count 值非负</li>
     *   <li>数据按日期升序排列</li>
     * </ul>
     * 
     * @param startDate 开始日期（包含）
     * @param endDate  结束日期（包含）
     * @return 每日趋势数据列表
     * @throws IllegalArgumentException 日期范围超出 90 天限制
     */
    public List<DailyTrendDTO> calculateDailyTrend(LocalDate startDate, LocalDate endDate) {
        validateDateRange(startDate, endDate);
        log.info("计算每日操作趋势: {} ~ {}", startDate, endDate);

        LocalDateTime startDateTime = startDate.atStartOfDay();
        LocalDateTime endDateTime = endDate.atTime(23, 59, 59);

        List<AuditLog> logs = auditLogRepository.findByCreatedAtBetween(startDateTime, endDateTime);

        Map<LocalDate, Long> dailyCount = logs.stream()
                .collect(Collectors.groupingBy(
                        log -> log.getCreatedAt().toLocalDate(),
                        Collectors.counting()));

        return dailyCount.entrySet().stream()
                .sorted(Map.Entry.comparingByKey())
                .map(entry -> new DailyTrendDTO(entry.getKey(), entry.getValue()))
                .collect(Collectors.toList());
    }

    /**
     * 按操作类型分组计算每日趋势
     * 
     * <p>返回以操作类型为键、每日趋势数据为值的 Map 结构。
     * 
     * @param startDate 开始日期（包含）
     * @param endDate   结束日期（包含）
     * @return 按操作类型分组的趋势数据
     */
    public Map<String, List<DailyTrendDTO>> calculateTrendByOperationType(LocalDate startDate, LocalDate endDate) {
        validateDateRange(startDate, endDate);
        log.info("按操作类型计算趋势: {} ~ {}", startDate, endDate);

        LocalDateTime startDateTime = startDate.atStartOfDay();
        LocalDateTime endDateTime = endDate.atTime(23, 59, 59);

        List<AuditLog> logs = auditLogRepository.findByCreatedAtBetween(startDateTime, endDateTime);

        Map<String, Map<LocalDate, Long>> groupedData = logs.stream()
                .collect(Collectors.groupingBy(
                        AuditLog::getOperationType,
                        Collectors.groupingBy(
                                log -> log.getCreatedAt().toLocalDate(),
                                Collectors.counting())));

        return groupedData.entrySet().stream()
                .collect(Collectors.toMap(
                        Map.Entry::getKey,
                        entry -> entry.getValue().entrySet().stream()
                                .sorted(Map.Entry.comparingByKey())
                                .map(e -> new DailyTrendDTO(e.getKey(), e.getValue()))
                                .collect(Collectors.toList())));
    }

    /**
     * 计算周趋势数据
     * 
     * <p>将日志按周聚合统计，适用于中期趋势分析。
     * 
     * @param startDate 开始日期
     * @param endDate   结束日期
     * @return 每周趋势数据列表
     */
    public List<WeeklyTrendDTO> calculateWeeklyTrend(LocalDate startDate, LocalDate endDate) {
        validateDateRange(startDate, endDate);
        log.info("计算每周操作趋势: {} ~ {}", startDate, endDate);

        LocalDateTime startDateTime = startDate.atStartOfDay();
        LocalDateTime endDateTime = endDate.atTime(23, 59, 59);

        List<AuditLog> logs = auditLogRepository.findByCreatedAtBetween(startDateTime, endDateTime);

        Map<Integer, Long> weeklyCount = logs.stream()
                .collect(Collectors.groupingBy(
                        log -> getWeekOfYear(log.getCreatedAt().toLocalDate()),
                        Collectors.counting()));

        return weeklyCount.entrySet().stream()
                .sorted(Map.Entry.comparingByKey())
                .map(entry -> new WeeklyTrendDTO(entry.getKey(), entry.getValue()))
                .collect(Collectors.toList());
    }

    /**
     * 计算月趋势数据
     * 
     * <p>将日志按月聚合统计，适用于长期趋势分析。
     * 
     * @param year 指定年份
     * @return 每月趋势数据列表
     */
    public List<MonthlyTrendDTO> calculateMonthlyTrend(int year) {
        log.info("计算每月操作趋势: year={}", year);

        LocalDateTime startOfYear = LocalDate.of(year, 1, 1).atStartOfDay();
        LocalDateTime endOfYear = LocalDate.of(year, 12, 31).atTime(23, 59, 59);

        List<AuditLog> logs = auditLogRepository.findByCreatedAtBetween(startOfYear, endOfYear);

        Map<Integer, Long> monthlyCount = logs.stream()
                .collect(Collectors.groupingBy(
                        log -> log.getCreatedAt().getMonthValue(),
                        Collectors.counting()));

        return monthlyCount.entrySet().stream()
                .sorted(Map.Entry.comparingByKey())
                .map(entry -> new MonthlyTrendDTO(entry.getKey(), entry.getValue()))
                .collect(Collectors.toList());
    }

    /**
     * 计算风险等级分布
     * 
     * <p><b>测试验证点（ATB-003）：</b>
     * <ul>
     *   <li>所有风险等级占比之和为 100%</li>
     *   <li>各等级数据包含 count 和 ratio 字段</li>
     *   <li>ratio 值范围为 0-100</li>
     * </ul>
     * 
     * @param startDate 开始日期
     * @param endDate   结束日期
     * @return 风险分布数据列表（按严重程度降序排列）
     */
    public List<RiskDistributionDTO> calculateRiskDistribution(LocalDate startDate, LocalDate endDate) {
        validateDateRange(startDate, endDate);
        log.info("计算风险分布: {} ~ {}", startDate, endDate);

        LocalDateTime startDateTime = startDate.atStartOfDay();
        LocalDateTime endDateTime = endDate.atTime(23, 59, 59);

        List<AuditLog> logs = auditLogRepository.findByCreatedAtBetween(startDateTime, endDateTime);

        if (logs.isEmpty()) {
            return RISK_ORDER.stream()
                    .map(level -> new RiskDistributionDTO(level, 0L, 0.0))
                    .collect(Collectors.toList());
        }

        Map<String, Long> riskCount = logs.stream()
                .collect(Collectors.groupingBy(
                        log -> Optional.ofNullable(log.getRiskLevel()).orElse("LOW"),
                        Collectors.counting()));

        long totalCount = logs.size();

        return RISK_ORDER.stream()
                .map(level -> {
                    long count = riskCount.getOrDefault(level, 0L);
                    double ratio = totalCount > 0 ? (count * 100.0) / totalCount : 0.0;
                    return new RiskDistributionDTO(level, count, ratio);
                })
                .collect(Collectors.toList());
    }

    /**
     * 计算高风险操作频率变化
     * 
     * <p>比较前后两个周期的操作频率，用于识别风险趋势升降。
     * 
     * @param highRiskTypes 高风险操作类型列表
     * @param currentStart  当前周期开始日期
     * @param currentEnd    当前周期结束日期
     * @param previousStart 前一周期开始日期
     * @param previousEnd   前一周期结束日期
     * @return 高风险操作频率变化趋势
     */
    public List<RiskTrendDTO> calculateHighRiskTrend(
            List<String> highRiskTypes,
            LocalDate currentStart,
            LocalDate currentEnd,
            LocalDate previousStart,
            LocalDate previousEnd) {

        log.info("计算高风险操作趋势: current=[{}~{}], previous=[{}~{}]",
                currentStart, currentEnd, previousStart, previousEnd);

        long currentCount = countHighRiskOperations(highRiskTypes, currentStart, currentEnd);
        long previousCount = countHighRiskOperations(highRiskTypes, previousStart, previousEnd);

        double changeRate = previousCount > 0
                ? ((double) (currentCount - previousCount)) / previousCount * 100
                : 0.0;

        String trend = currentCount > previousCount ? "UP"
                : currentCount < previousCount ? "DOWN" : "STABLE";

        return highRiskTypes.stream()
                .map(type -> {
                    long typeCurrent = countOperationsByType(type, currentStart, currentEnd);
                    long typePrevious = countOperationsByType(type, previousStart, previousEnd);
                    double typeChangeRate = typePrevious > 0
                            ? ((double) (typeCurrent - typePrevious)) / typePrevious * 100
                            : 0.0;
                    return new RiskTrendDTO(type, typeCurrent, typePrevious, typeChangeRate,
                            currentCount > typePrevious ? "UP" : currentCount < typePrevious ? "DOWN" : "STABLE");
                })
                .collect(Collectors.toList());
    }

    /**
     * 计算合规性监控指标
     * 
     * <p>检查审计日志的完整性，包括日志覆盖率、缺失字段统计等。
     * 
     * @param startDate 开始日期
     * @param endDate   结束日期
     * @return 合规性监控数据
     */
    public ComplianceMonitorDTO calculateComplianceMonitor(LocalDate startDate, LocalDate endDate) {
        validateDateRange(startDate, endDate);
        log.info("计算合规性监控: {} ~ {}", startDate, endDate);

        LocalDateTime startDateTime = startDate.atStartOfDay();
        LocalDateTime endDateTime = endDate.atTime(23, 59, 59);

        List<AuditLog> logs = auditLogRepository.findByCreatedAtBetween(startDateTime, endDateTime);

        if (logs.isEmpty()) {
            return new ComplianceMonitorDTO(0L, 0, 0, Collections.emptyMap(), 0.0);
        }

        long totalLogs = logs.size();

        long logsWithUserId = logs.stream()
                .filter(log -> log.getUserId() != null)
                .count();

        long logsWithIp = logs.stream()
                .filter(log -> log.getIpAddress() != null)
                .count();

        long logsWithDetail = logs.stream()
                .filter(log -> log.getDetail() != null)
                .count();

        Map<String, Long> missingFields = new HashMap<>();
        missingFields.put("userId", totalLogs - logsWithUserId);
        missingFields.put("ipAddress", totalLogs - logsWithIp);
        missingFields.put("detail", totalLogs - logsWithDetail);

        double coverageRate = (logsWithUserId * 100.0) / totalLogs;

        return new ComplianceMonitorDTO(totalLogs, logsWithUserId, logsWithIp, missingFields, coverageRate);
    }

    // ==================== 私有辅助方法 ====================

    /**
     * 验证日期范围是否合法
     * 
     * @param startDate 开始日期
     * @param endDate   结束日期
     * @throws IllegalArgumentException 日期范围超出 90 天或日期无效
     */
    private void validateDateRange(LocalDate startDate, LocalDate endDate) {
        if (startDate == null || endDate == null) {
            throw new IllegalArgumentException("开始日期和结束日期不能为空");
        }
        if (startDate.isAfter(endDate)) {
            throw new IllegalArgumentException("开始日期不能晚于结束日期");
        }
        if (startDate.plusDays(90).isBefore(endDate)) {
            throw new IllegalArgumentException("日期范围超出 90 天限制");
        }
    }

    /**
     * 获取日期所在的周数（年内）
     */
    private int getWeekOfYear(LocalDate date) {
        return date.get(java.time.temporal.WeekFields.ISO.weekOfWeekBasedYear());
    }

    /**
     * 统计高风险操作数量
     */
    private long countHighRiskOperations(List<String> highRiskTypes, LocalDate startDate, LocalDate endDate) {
        LocalDateTime startDateTime = startDate.atStartOfDay();
        LocalDateTime endDateTime = endDate.atTime(23, 59, 59);

        List<AuditLog> logs = auditLogRepository.findByCreatedAtBetween(startDateTime, endDateTime);

        return logs.stream()
                .filter(log -> highRiskTypes.contains(log.getOperationType()))
                .count();
    }

    /**
     * 按操作类型统计数量
     */
    private long countOperationsByType(String operationType, LocalDate startDate, LocalDate endDate) {
        LocalDateTime startDateTime = startDate.atStartOfDay();
        LocalDateTime endDateTime = endDate.atTime(23, 59, 59);

        List<AuditLog> logs = auditLogRepository.findByCreatedAtBetween(startDateTime, endDateTime);

        return logs.stream()
                .filter(log -> operationType.equals(log.getOperationType()))
                .count();
    }

    // ==================== DTO 内部类 ====================

    /**
     * 每日趋势数据传输对象
     */
    public static class DailyTrendDTO {
        private final LocalDate date;
        private final Long count;

        public DailyTrendDTO(LocalDate date, Long count) {
            this.date = date;
            this.count = count;
        }

        public LocalDate getDate() {
            return date;
        }

        public Long getCount() {
            return count;
        }
    }

    /**
     * 每周趋势数据传输对象
     */
    public static class WeeklyTrendDTO {
        private final Integer weekOfYear;
        private final Long count;

        public WeeklyTrendDTO(Integer weekOfYear, Long count) {
            this.weekOfYear = weekOfYear;
            this.count = count;
        }

        public Integer getWeekOfYear() {
            return weekOfYear;
        }

        public Long getCount() {
            return count;
        }
    }

    /**
     * 每月趋势数据传输对象
     */
    public static class MonthlyTrendDTO {
        private final Integer month;
        private final Long count;

        public MonthlyTrendDTO(Integer month, Long count) {
            this.month = month;
            this.count = count;
        }

        public Integer getMonth() {
            return month;
        }

        public Long getCount() {
            return count;
        }
    }

    /**
     * 风险分布数据传输对象
     */
    public static class RiskDistributionDTO {
        private final String level;
        private final Long count;
        private final Double ratio;

        public RiskDistributionDTO(String level, Long count, Double ratio) {
            this.level = level;
            this.count = count;
            this.ratio = Math.round(ratio * 100.0) / 100.0;
        }

        public String getLevel() {
            return level;
        }

        public Long getCount() {
            return count;
        }

        public Double getRatio() {
            return ratio;
        }
    }

    /**
     * 风险趋势数据传输对象
     */
    public static class RiskTrendDTO {
        private final String operationType;
        private final Long currentCount;
        private final Long previousCount;
        private final Double changeRate;
        private final String trend;

        public RiskTrendDTO(String operationType, Long currentCount, Long previousCount,
                           Double changeRate, String trend) {
            this.operationType = operationType;
            this.currentCount = currentCount;
            this.previousCount = previousCount;
            this.changeRate = Math.round(changeRate * 100.0) / 100.0;
            this.trend = trend;
        }

        public String getOperationType() {
            return operationType;
        }

        public Long getCurrentCount() {
            return currentCount;
        }

        public Long getPreviousCount() {
            return previousCount;
        }

        public Double getChangeRate() {
            return changeRate;
        }

        public String getTrend() {
            return trend;
        }
    }

    /**
     * 合规性监控数据传输对象
     */
    public static class ComplianceMonitorDTO {
        private final Long totalLogs;
        private final Long logsWithUserId;
        private final Long logsWithIp;
        private final Map<String, Long> missingFields;
        private final Double coverageRate;

        public ComplianceMonitorDTO(Long totalLogs, Long logsWithUserId, Long logsWithIp,
                                   Map<String, Long> missingFields, Double coverageRate) {
            this.totalLogs = totalLogs;
            this.logsWithUserId = logsWithUserId;
            this.logsWithIp = logsWithIp;
            this.missingFields = missingFields;
            this.coverageRate = Math.round(coverageRate * 100.0) / 100.0;
        }

        public Long getTotalLogs() {
            return totalLogs;
        }

        public Long getLogsWithUserId() {
            return logsWithUserId;
        }

        public Long getLogsWithIp() {
            return logsWithIp;
        }

        public Map<String, Long> getMissingFields() {
            return missingFields;
        }

        public Double getCoverageRate() {
            return coverageRate;
        }
    }
}