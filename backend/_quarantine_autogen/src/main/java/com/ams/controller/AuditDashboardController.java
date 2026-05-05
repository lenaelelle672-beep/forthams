package com.ams.controller;

import com.ams.common.Result;
import com.ams.entity.AuditLog;
import com.ams.repository.AuditLogRepository;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.temporal.ChronoUnit;
import java.util.*;
import java.util.stream.Collectors;

/**
 * 操作日志仪表板控制器
 * 
 * <p>提供审计日志的聚合统计接口，包括：
 * <ul>
 *   <li>操作趋势（按时间段聚合）</li>
 *   <li>操作类型分布（饼图数据）</li>
 *   <li>Top10 活跃用户排名</li>
 * </ul>
 * 
 * <p><b>访问权限</b>：仅限 ROLE_ADMIN 和 ROLE_AUDITOR
 * 
 * <p><b>时间范围限制</b>：默认最近 7 天，最大支持 90 天
 * 
 * @author AMS Team
 * @since 1.0.0
 */
@RestController
@RequestMapping("/api/audit/dashboard")
@Tag(name = "审计仪表板", description = "操作日志统计聚合接口")
@SecurityRequirement(name = "bearerAuth")
@PreAuthorize("hasAnyRole('ADMIN', 'AUDITOR')")
public class AuditDashboardController {

    /** 默认查询时间范围（天） */
    private static final int DEFAULT_DAYS = 7;
    
    /** 最大查询时间范围（天） */
    private static final int MAX_DAYS = 90;
    
    /** Top10 榜单固定返回记录数 */
    private static final int TOP_USERS_LIMIT = 10;

    @Autowired
    private AuditLogRepository auditLogRepository;

    /**
     * 时间趋势数据点
     * 
     * @param timestamp 时间戳（ISO 8601 格式）
     * @param count 操作次数
     */
    public record TrendPoint(
        @Parameter(description = "时间戳（ISO 8601 格式）") 
        String timestamp,
        
        @Parameter(description = "操作次数") 
        long count
    ) {}

    /**
     * 操作类型分布项
     * 
     * @param operationType 操作类型（如 CREATE, READ, UPDATE, DELETE）
     * @param count 操作次数
     * @param percentage 占比百分比（0-100，保留两位小数）
     */
    public record DistributionItem(
        @Parameter(description = "操作类型") 
        String operationType,
        
        @Parameter(description = "操作次数") 
        long count,
        
        @Parameter(description = "占比百分比") 
        double percentage
    ) {}

    /**
     * 活跃用户排行项
     * 
     * @param userId 用户ID
     * @param username 用户名
     * @param operationCount 操作次数
     */
    public record TopUser(
        @Parameter(description = "用户ID") 
        String userId,
        
        @Parameter(description = "用户名") 
        String username,
        
        @Parameter(description = "操作次数") 
        long operationCount
    ) {}

    /**
     * 获取操作趋势数据
     * 
     * <p>根据指定时间范围返回操作次数的时序聚合数据。
     * 聚合粒度根据时间跨度动态调整：
     * <ul>
     *   <li>≤7 天：按日聚合</li>
     *   <li>8-30 天：按日聚合</li>
     *   <li>>30 天：按周聚合</li>
     * </ul>
     * 
     * @param start 开始日期（默认：7 天前）
     * @param end 结束日期（默认：今天）
     * @return 时间趋势数据点列表
     * 
     * @example GET /api/audit/dashboard/trend?start=2024-01-01&end=2024-01-07
     */
    @GetMapping("/trend")
    @Operation(
        summary = "获取操作趋势",
        description = "返回指定时间范围内的操作次数时序聚合数据"
    )
    public Result<List<TrendPoint>> getTrendData(
        @Parameter(description = "开始日期")
        @RequestParam(required = false) 
        @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate start,
        
        @Parameter(description = "结束日期")
        @RequestParam(required = false) 
        @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate end
    ) {
        // 参数校验与默认值处理
        LocalDate endDate = (end != null) ? end : LocalDate.now();
        LocalDate startDate = (start != null) ? start : endDate.minusDays(DEFAULT_DAYS);
        
        // 校验时间范围合法性
        if (startDate.isAfter(endDate)) {
            return Result.error("开始日期不能晚于结束日期");
        }
        
        long daysBetween = ChronoUnit.DAYS.between(startDate, endDate);
        if (daysBetween > MAX_DAYS) {
            return Result.error("时间范围不能超过 " + MAX_DAYS + " 天");
        }
        
        // 查询时间范围内的所有审计日志
        LocalDateTime startDateTime = startDate.atStartOfDay();
        LocalDateTime endDateTime = endDate.plusDays(1).atStartOfDay();
        
        List<AuditLog> logs = auditLogRepository.findByCreatedAtBetween(startDateTime, endDateTime);
        
        // 根据时间跨度确定聚合粒度
        List<TrendPoint> trendData;
        if (daysBetween <= 7) {
            // 按日聚合
            trendData = aggregateByDay(logs, startDate, endDate);
        } else if (daysBetween <= 30) {
            // 按日聚合
            trendData = aggregateByDay(logs, startDate, endDate);
        } else {
            // 按周聚合
            trendData = aggregateByWeek(logs, startDate, endDate);
        }
        
        return Result.success(trendData);
    }

    /**
     * 获取操作类型分布
     * 
     * <p>返回各操作类型的次数统计及其占比百分比。
     * 百分比保留两位小数，总和为 100%。
     * 
     * @param start 开始日期（默认：7 天前）
     * @param end 结束日期（默认：今天）
     * @return 操作类型分布列表
     * 
     * @example GET /api/audit/dashboard/distribution?start=2024-01-01&end=2024-01-07
     */
    @GetMapping("/distribution")
    @Operation(
        summary = "获取操作类型分布",
        description = "返回各操作类型的次数统计及占比"
    )
    public Result<List<DistributionItem>> getOperationDistribution(
        @Parameter(description = "开始日期")
        @RequestParam(required = false) 
        @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate start,
        
        @Parameter(description = "结束日期")
        @RequestParam(required = false) 
        @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate end
    ) {
        // 参数校验与默认值处理
        LocalDate endDate = (end != null) ? end : LocalDate.now();
        LocalDate startDate = (start != null) ? start : endDate.minusDays(DEFAULT_DAYS);
        
        // 校验时间范围合法性
        if (startDate.isAfter(endDate)) {
            return Result.error("开始日期不能晚于结束日期");
        }
        
        long daysBetween = ChronoUnit.DAYS.between(startDate, endDate);
        if (daysBetween > MAX_DAYS) {
            return Result.error("时间范围不能超过 " + MAX_DAYS + " 天");
        }
        
        // 查询时间范围内的所有审计日志
        LocalDateTime startDateTime = startDate.atStartOfDay();
        LocalDateTime endDateTime = endDate.plusDays(1).atStartOfDay();
        
        List<AuditLog> logs = auditLogRepository.findByCreatedAtBetween(startDateTime, endDateTime);
        
        // 按操作类型分组统计
        Map<String, Long> typeCountMap = logs.stream()
            .collect(Collectors.groupingBy(
                log -> Optional.ofNullable(log.getActionType()).orElse("UNKNOWN"),
                Collectors.counting()
            ));
        
        // 计算总数用于计算百分比
        long totalCount = typeCountMap.values().stream()
            .mapToLong(Long::longValue)
            .sum();
        
        // 构建分布列表
        List<DistributionItem> distribution = typeCountMap.entrySet().stream()
            .map(entry -> {
                double percentage = totalCount > 0 
                    ? Math.round(entry.getValue() * 10000.0 / totalCount) / 100.0 
                    : 0.0;
                return new DistributionItem(entry.getKey(), entry.getValue(), percentage);
            })
            .sorted((a, b) -> Long.compare(b.count(), a.count())) // 按次数降序排列
            .collect(Collectors.toList());
        
        return Result.success(distribution);
    }

    /**
     * 获取 Top10 活跃用户
     * 
     * <p>返回指定时间范围内操作次数最多的前 10 名用户。
     * 结果按操作次数降序排列。
     * 
     * @param start 开始日期（默认：7 天前）
     * @param end 结束日期（默认：今天）
     * @param limit 返回记录数限制（默认：10，最大：50）
     * @return 活跃用户排行列表
     * 
     * @example GET /api/audit/dashboard/top-users?start=2024-01-01&end=2024-01-07&limit=10
     */
    @GetMapping("/top-users")
    @Operation(
        summary = "获取 Top10 活跃用户",
        description = "返回操作次数最多的活跃用户排行"
    )
    public Result<List<TopUser>> getTopUsers(
        @Parameter(description = "开始日期")
        @RequestParam(required = false) 
        @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate start,
        
        @Parameter(description = "结束日期")
        @RequestParam(required = false) 
        @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate end,
        
        @Parameter(description = "返回记录数限制")
        @RequestParam(required = false, defaultValue = "10") Integer limit
    ) {
        // 参数校验与默认值处理
        LocalDate endDate = (end != null) ? end : LocalDate.now();
        LocalDate startDate = (start != null) ? start : endDate.minusDays(DEFAULT_DAYS);
        
        // 校验时间范围合法性
        if (startDate.isAfter(endDate)) {
            return Result.error("开始日期不能晚于结束日期");
        }
        
        long daysBetween = ChronoUnit.DAYS.between(startDate, endDate);
        if (daysBetween > MAX_DAYS) {
            return Result.error("时间范围不能超过 " + MAX_DAYS + " 天");
        }
        
        // 限制参数校验
        int effectiveLimit = Math.min(
            Optional.ofNullable(limit).orElse(TOP_USERS_LIMIT),
            50 // 最大限制
        );
        
        // 查询时间范围内的所有审计日志
        LocalDateTime startDateTime = startDate.atStartOfDay();
        LocalDateTime endDateTime = endDate.plusDays(1).atStartOfDay();
        
        List<AuditLog> logs = auditLogRepository.findByCreatedAtBetween(startDateTime, endDateTime);
        
        // 按用户分组统计
        Map<String, Long> userCountMap = logs.stream()
            .filter(log -> Optional.ofNullable(log.getOperatorId()).isPresent())
            .collect(Collectors.groupingBy(
                AuditLog::getOperatorId,
                Collectors.counting()
            ));
        
        // 构建用户排行列表
        List<TopUser> topUsers = userCountMap.entrySet().stream()
            .map(entry -> new TopUser(
                entry.getKey(),
                resolveUsername(entry.getKey()), // 实际应从用户服务获取
                entry.getValue()
            ))
            .sorted((a, b) -> Long.compare(b.operationCount(), a.operationCount()))
            .limit(effectiveLimit)
            .collect(Collectors.toList());
        
        return Result.success(topUsers);
    }

    /**
     * 按日聚合审计日志
     * 
     * @param logs 审计日志列表
     * @param startDate 开始日期
     * @param endDate 结束日期
     * @return 按日聚合的趋势数据点
     */
    private List<TrendPoint> aggregateByDay(List<AuditLog> logs, LocalDate startDate, LocalDate endDate) {
        // 初始化每日计数器
        Map<LocalDate, Long> dailyCount = new TreeMap<>();
        LocalDate current = startDate;
        while (!current.isAfter(endDate)) {
            dailyCount.put(current, 0L);
            current = current.plusDays(1);
        }
        
        // 统计每日次数
        for (AuditLog log : logs) {
            if (log.getCreatedAt() != null) {
                LocalDate logDate = log.getCreatedAt().toLocalDate();
                dailyCount.merge(logDate, 1L, Long::sum);
            }
        }
        
        // 转换为响应格式
        return dailyCount.entrySet().stream()
            .map(entry -> new TrendPoint(
                entry.getKey().atStartOfDay().toString(),
                entry.getValue()
            ))
            .collect(Collectors.toList());
    }

    /**
     * 按周聚合审计日志
     * 
     * @param logs 审计日志列表
     * @param startDate 开始日期
     * @param endDate 结束日期
     * @return 按周聚合的趋势数据点
     */
    private List<TrendPoint> aggregateByWeek(List<AuditLog> logs, LocalDate startDate, LocalDate endDate) {
        // 初始化每周计数器
        Map<LocalDate, Long> weeklyCount = new TreeMap<>();
        LocalDate current = startDate;
        while (!current.isAfter(endDate)) {
            LocalDate weekStart = current.minusDays(current.getDayOfWeek().getValue() - 1);
            weeklyCount.putIfAbsent(weekStart, 0L);
            current = current.plusDays(1);
        }
        
        // 统计每周次数
        for (AuditLog log : logs) {
            if (log.getCreatedAt() != null) {
                LocalDate logDate = log.getCreatedAt().toLocalDate();
                LocalDate weekStart = logDate.minusDays(logDate.getDayOfWeek().getValue() - 1);
                weeklyCount.merge(weekStart, 1L, Long::sum);
            }
        }
        
        // 转换为响应格式
        return weeklyCount.entrySet().stream()
            .map(entry -> new TrendPoint(
                entry.getKey().atStartOfDay().toString(),
                entry.getValue()
            ))
            .collect(Collectors.toList());
    }

    /**
     * 解析用户名
     * 
     * <p>根据用户ID获取用户名。
     * 实际实现应调用用户服务，此处为简化占位实现。
     * 
     * @param userId 用户ID
     * @return 用户名
     */
    private String resolveUsername(String userId) {
        // TODO: 实际应从 UserService 或缓存中获取用户名
        return Optional.ofNullable(userId).orElse("Unknown");
    }
}