package com.ams.service;

import com.ams.entity.AuditLog;
import com.ams.mapper.AuditLogMapper;
import com.ams.common.Result;
import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.*;
import java.util.stream.Collectors;

/**
 * 风险分析服务 - SWARM-003 操作日志仪表板
 *
 * <p>为操作日志仪表板提供风险数据聚合与趋势分析能力。
 * 支持风险等级分布统计、风险趋势计算等核心功能。</p>
 *
 * <h3>风险等级定义</h3>
 * <ul>
 *   <li><b>LOW</b> - 低风险：数据查询、资源浏览</li>
 *   <li><b>MEDIUM</b> - 中风险：数据创建、常规更新</li>
 *   <li><b>HIGH</b> - 高风险：权限变更、批量删除</li>
 *   <li><b>CRITICAL</b> - 极高风险：账户删除、密码重置、系统配置修改</li>
 * </ul>
 *
 * @since 1.0.0
 * @performance 时间复杂度 O(n)，空间复杂度 O(k)，n 为日志条数，k 为风险等级数量
 * @author AMS Team
 * @task SWARM-003 - Iteration 1
 */
@Service
@Slf4j
public class RiskAnalysisService {

    private static final DateTimeFormatter DATE_FORMATTER = DateTimeFormatter.ofPattern("yyyy-MM-dd");

    /** 90天数据时效限制（毫秒） */
    private static final long NINETY_DAYS_MILLIS = 90L * 24 * 60 * 60 * 1000;

    @Autowired
    private AuditLogMapper auditLogMapper;

    /**
     * 风险等级枚举
     *
     * <p>与 operation_logs.risk_level 字段对应</p>
     */
    public enum RiskLevel {
        LOW("低风险"),
        MEDIUM("中风险"),
        HIGH("高风险"),
        CRITICAL("极高风险");

        private final String description;

        RiskLevel(String description) {
            this.description = description;
        }

        public String getDescription() {
            return description;
        }
    }

    /**
     * 单日风险统计数据
     */
    public static class DailyRiskStat {
        private String date;
        private Map<String, Long> riskCounts;
        private long totalCount;

        public DailyRiskStat() {
            this.riskCounts = new HashMap<>();
            this.totalCount = 0;
        }

        public String getDate() {
            return date;
        }

        public void setDate(String date) {
            this.date = date;
        }

        public Map<String, Long> getRiskCounts() {
            return riskCounts;
        }

        public void setRiskCounts(Map<String, Long> riskCounts) {
            this.riskCounts = riskCounts;
        }

        public long getTotalCount() {
            return totalCount;
        }

        public void setTotalCount(long totalCount) {
            this.totalCount = totalCount;
        }
    }

    /**
     * 风险分布数据
     */
    public static class RiskDistribution {
        private String level;
        private String description;
        private long count;
        private double ratio;

        public RiskDistribution() {}

        public RiskDistribution(String level, String description, long count, double ratio) {
            this.level = level;
            this.description = description;
            this.count = count;
            this.ratio = ratio;
        }

        public String getLevel() {
            return level;
        }

        public void setLevel(String level) {
            this.level = level;
        }

        public String getDescription() {
            return description;
        }

        public void setDescription(String description) {
            this.description = description;
        }

        public long getCount() {
            return count;
        }

        public void setCount(long count) {
            this.count = count;
        }

        public double getRatio() {
            return ratio;
        }

        public void setRatio(double ratio) {
            this.ratio = ratio;
        }
    }

    /**
     * 风险趋势响应数据
     */
    public static class RiskTrendResponse {
        private String period;
        private List<DailyRiskStat> series;
        private long totalOperations;
        private Map<String, Long> riskSummary;

        public String getPeriod() {
            return period;
        }

        public void setPeriod(String period) {
            this.period = period;
        }

        public List<DailyRiskStat> getSeries() {
            return series;
        }

        public void setSeries(List<DailyRiskStat> series) {
            this.series = series;
        }

        public long getTotalOperations() {
            return totalOperations;
        }

        public void setTotalOperations(long totalOperations) {
            this.totalOperations = totalOperations;
        }

        public Map<String, Long> getRiskSummary() {
            return riskSummary;
        }

        public void setRiskSummary(Map<String, Long> riskSummary) {
            this.riskSummary = riskSummary;
        }
    }

    /**
     * 获取风险等级分布统计
     *
     * <p>ATB-003: 验证风险等级占比计算准确性
     * 统计指定时间范围内的操作日志，按风险等级分组并计算占比</p>
     *
     * @param startDate 开始日期 (yyyy-MM-dd)
     * @param endDate   结束日期 (yyyy-MM-dd)
     * @return 风险分布统计数据
     * @throws IllegalArgumentException 当时间范围超过90天或日期格式错误时抛出
     * @since 1.0.0
     * @performance 时间复杂度 O(n)，空间复杂度 O(k)，k=4(风险等级数量)
     */
    public Result<Map<String, Object>> getRiskDistribution(String startDate, String endDate) {
        log.info("[SWARM-003] 获取风险分布统计, 时间范围: {} ~ {}", startDate, endDate);

        // 验证时间范围
        validateDateRange(startDate, endDate);

        LocalDateTime start = LocalDate.parse(startDate, DATE_FORMATTER).atStartOfDay();
        LocalDateTime end = LocalDate.parse(endDate, DATE_FORMATTER).atTime(23, 59, 59);

        // 查询风险分布数据
        QueryWrapper<AuditLog> queryWrapper = new QueryWrapper<>();
        queryWrapper.between("created_at", start, end);
        queryWrapper.select("risk_level", "COUNT(*) as count");
        queryWrapper.groupBy("risk_level");

        List<Map<String, Object>> rawData = auditLogMapper.selectMaps(queryWrapper);

        // 计算总数
        long totalCount = rawData.stream()
                .mapToLong(m -> ((Number) m.get("count")).longValue())
                .sum();

        // 构建分布数据
        List<RiskDistribution> distribution = new ArrayList<>();

        // 确保所有风险等级都存在（包括数量为0的）
        for (RiskLevel level : RiskLevel.values()) {
            long levelCount = rawData.stream()
                    .filter(m -> level.name().equals(m.get("risk_level")))
                    .findFirst()
                    .map(m -> ((Number) m.get("count")).longValue())
                    .orElse(0L);

            double ratio = totalCount > 0 ? (levelCount * 100.0 / totalCount) : 0.0;
            // 保留两位小数
            ratio = Math.round(ratio * 100.0) / 100.0;

            distribution.add(new RiskDistribution(
                    level.name(),
                    level.getDescription(),
                    levelCount,
                    ratio
            ));
        }

        // ATB-003: 验证所有风险等级占比之和为 100%
        double totalRatio = distribution.stream()
                .mapToDouble(RiskDistribution::getRatio)
                .sum();
        log.debug("[SWARM-003] 风险占比总和验证: {}%", totalRatio);

        Map<String, Object> result = new HashMap<>();
        result.put("totalCount", totalCount);
        result.put("distribution", distribution);
        result.put("startDate", startDate);
        result.put("endDate", endDate);

        log.info("[SWARM-003] 风险分布统计完成, 总操作数: {}", totalCount);
        return Result.success(result);
    }

    /**
     * 获取风险趋势数据（按日统计）
     *
     * <p>计算指定天数范围内的每日风险分布趋势</p>
     *
     * @param days 天数（1-90）
     * @return 每日风险统计数据列表
     * @throws IllegalArgumentException 当天数超出有效范围时抛出
     * @since 1.0.0
     * @performance 时间复杂度 O(n)，空间复杂度 O(d*k)，d=天数，k=风险等级数
     */
    public Result<RiskTrendResponse> getDailyRiskTrend(int days) {
        log.info("[SWARM-003] 获取每日风险趋势, 天数: {}", days);

        // 验证天数范围
        if (days < 1 || days > 90) {
            log.warn("[SWARM-003] 天数超出有效范围: {}", days);
            throw new IllegalArgumentException("Days must be between 1 and 90");
        }

        LocalDateTime end = LocalDateTime.now();
        LocalDateTime start = end.minusDays(days - 1).withHour(0).withMinute(0).withSecond(0);

        // 查询每日风险数据
        QueryWrapper<AuditLog> queryWrapper = new QueryWrapper<>();
        queryWrapper.between("created_at", start, end);
        queryWrapper.select("DATE(created_at) as date", "risk_level", "COUNT(*) as count");
        queryWrapper.groupBy("DATE(created_at)", "risk_level");
        queryWrapper.orderByAsc("date");

        List<Map<String, Object>> rawData = auditLogMapper.selectMaps(queryWrapper);

        // 按日期分组
        Map<String, List<Map<String, Object>>> byDate = rawData.stream()
                .collect(Collectors.groupingBy(m -> m.get("date").toString()));

        // 构建每日统计数据
        List<DailyRiskStat> series = new ArrayList<>();
        Map<String, Long> riskSummary = new HashMap<>();

        // 初始化所有风险等级计数
        for (RiskLevel level : RiskLevel.values()) {
            riskSummary.put(level.name(), 0L);
        }

        // 遍历每一天
        for (int i = 0; i < days; i++) {
            LocalDate date = start.toLocalDate().plusDays(i);
            String dateStr = date.format(DATE_FORMATTER);

            DailyRiskStat stat = new DailyRiskStat();
            stat.setDate(dateStr);

            List<Map<String, Object>> dayData = byDate.getOrDefault(dateStr, Collections.emptyList());

            long dayTotal = 0L;
            for (RiskLevel level : RiskLevel.values()) {
                long levelCount = dayData.stream()
                        .filter(m -> level.name().equals(m.get("risk_level")))
                        .findFirst()
                        .map(m -> ((Number) m.get("count")).longValue())
                        .orElse(0L);

                stat.getRiskCounts().put(level.name(), levelCount);
                dayTotal += levelCount;
                riskSummary.merge(level.name(), levelCount, Long::sum);
            }
            stat.setTotalCount(dayTotal);

            series.add(stat);
        }

        // 构建响应
        RiskTrendResponse response = new RiskTrendResponse();
        response.setPeriod(days + "d");
        response.setSeries(series);
        response.setTotalOperations(riskSummary.values().stream().mapToLong(Long::longValue).sum());
        response.setRiskSummary(riskSummary);

        log.info("[SWARM-003] 风险趋势统计完成, 共 {} 天数据", series.size());
        return Result.success(response);
    }

    /**
     * 获取高风险操作列表
     *
     * <p>查询风险等级为 HIGH 或 CRITICAL 的操作日志</p>
     *
     * @param pageNum  页码（从1开始）
     * @param pageSize 每页条数
     * @param riskLevel 风险等级过滤（可选，默认为 HIGH 及以上）
     * @return 高风险操作分页列表
     * @since 1.0.0
     * @performance 时间复杂度 O(log n + m)，m 为返回条数
     */
    public Result<Map<String, Object>> getHighRiskOperations(int pageNum, int pageSize, String riskLevel) {
        log.info("[SWARM-003] 获取高风险操作列表, 页码: {}, 每页: {}, 风险等级: {}",
                pageNum, pageSize, riskLevel);

        // 验证分页参数
        if (pageNum < 1) pageNum = 1;
        if (pageSize < 1) pageSize = 10;
        if (pageSize > 100) pageSize = 100;

        QueryWrapper<AuditLog> queryWrapper = new QueryWrapper<>();

        // 风险等级过滤
        if (riskLevel != null && !riskLevel.isEmpty()) {
            queryWrapper.eq("risk_level", riskLevel);
        } else {
            // 默认只查询 HIGH 和 CRITICAL
            queryWrapper.in("risk_level", "HIGH", "CRITICAL");
        }

        queryWrapper.orderByDesc("created_at");

        // 分页查询
        Page<AuditLog> page = new Page<>(pageNum, pageSize);
        Page<AuditLog> resultPage = auditLogMapper.selectPage(page, queryWrapper);

        // 构建响应
        Map<String, Object> result = new HashMap<>();
        result.put("total", resultPage.getTotal());
        result.put("pageNum", pageNum);
        result.put("pageSize", pageSize);
        result.put("totalPages", resultPage.getPages());
        result.put("records", resultPage.getRecords());

        log.info("[SWARM-003] 高风险操作查询完成, 总数: {}", resultPage.getTotal());
        return Result.success(result);
    }

    /**
     * 获取风险统计摘要
     *
     * <p>提供仪表板展示所需的精简风险统计数据</p>
     *
     * @param days 时间范围（天）
     * @return 风险摘要数据
     * @since 1.0.0
     * @performance 时间复杂度 O(n)，空间复杂度 O(1)
     */
    public Result<Map<String, Object>> getRiskSummary(int days) {
        log.info("[SWARM-003] 获取风险摘要, 天数: {}", days);

        LocalDateTime start = LocalDateTime.now().minusDays(days);

        QueryWrapper<AuditLog> queryWrapper = new QueryWrapper<>();
        queryWrapper.ge("created_at", start);
        queryWrapper.select(
                "COUNT(*) as total",
                "SUM(CASE WHEN risk_level = 'LOW' THEN 1 ELSE 0 END) as low_count",
                "SUM(CASE WHEN risk_level = 'MEDIUM' THEN 1 ELSE 0 END) as medium_count",
                "SUM(CASE WHEN risk_level = 'HIGH' THEN 1 ELSE 0 END) as high_count",
                "SUM(CASE WHEN risk_level = 'CRITICAL' THEN 1 ELSE 0 END) as critical_count"
        );

        Map<String, Object> rawData = auditLogMapper.selectMaps(queryWrapper).stream()
                .findFirst()
                .orElse(new HashMap<>());

        Map<String, Object> summary = new HashMap<>();
        summary.put("period", days + "d");
        summary.put("totalOperations", ((Number) rawData.getOrDefault("total", 0L)).longValue());
        summary.put("lowRisk", ((Number) rawData.getOrDefault("low_count", 0L)).longValue());
        summary.put("mediumRisk", ((Number) rawData.getOrDefault("medium_count", 0L)).longValue());
        summary.put("highRisk", ((Number) rawData.getOrDefault("high_count", 0L)).longValue());
        summary.put("criticalRisk", ((Number) rawData.getOrDefault("critical_count", 0L)).longValue());

        // 计算风险指数 (0-100, 越高表示风险越高)
        long total = ((Number) rawData.getOrDefault("total", 0L)).longValue();
        if (total > 0) {
            long highRisk = ((Number) rawData.getOrDefault("high_count", 0L)).longValue();
            long criticalRisk = ((Number) rawData.getOrDefault("critical_count", 0L)).longValue();
            double riskIndex = ((highRisk + criticalRisk * 2.0) / total) * 50;
            riskIndex = Math.round(riskIndex * 100.0) / 100.0;
            summary.put("riskIndex", riskIndex);
        } else {
            summary.put("riskIndex", 0.0);
        }

        log.info("[SWARM-003] 风险摘要统计完成, 风险指数: {}", summary.get("riskIndex"));
        return Result.success(summary);
    }

    /**
     * 验证日期范围是否合法
     *
     * <p>确保时间范围不超过90天限制</p>
     *
     * @param startDate 开始日期
     * @param endDate   结束日期
     * @throws IllegalArgumentException 当日期格式错误或超出90天限制时抛出
     * @since 1.0.0
     */
    private void validateDateRange(String startDate, String endDate) {
        if (startDate == null || endDate == null) {
            throw new IllegalArgumentException("Start date and end date are required");
        }

        LocalDate start;
        LocalDate end;

        try {
            start = LocalDate.parse(startDate, DATE_FORMATTER);
            end = LocalDate.parse(endDate, DATE_FORMATTER);
        } catch (Exception e) {
            log.error("[SWARM-003] 日期格式错误: {} ~ {}", startDate, endDate);
            throw new IllegalArgumentException("Invalid date format, expected yyyy-MM-dd");
        }

        if (start.isAfter(end)) {
            throw new IllegalArgumentException("Start date must be before or equal to end date");
        }

        long daysBetween = java.time.temporal.ChronoUnit.DAYS.between(start, end);
        if (daysBetween > 90) {
            log.warn("[SWARM-003] 时间范围超出90天限制: {} 天", daysBetween);
            throw new IllegalArgumentException("Date range exceeds 90 days limit");
        }
    }
}