package com.ams.service;

import com.ams.dto.LogTrendDTO;
import com.ams.entity.AuditLog;
import com.ams.mapper.AuditLogMapper;
import com.ams.repository.AuditLogRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.time.ZoneOffset;
import java.util.*;
import java.util.concurrent.TimeUnit;
import java.util.stream.Collectors;

/**
 * 日志聚合服务
 * 
 * 提供操作日志的聚合查询、趋势分析、多维筛选功能，支持分页、排序，
 * 用于操作日志仪表板的可视化展示。
 * 
 * 主要功能：
 * <ul>
 *   <li>日志列表查询：支持按时间范围、操作类型、操作者、状态等维度筛选</li>
 *   <li>趋势聚合：按日/周/月粒度统计日志数量</li>
 *   <li>单条日志详情查询</li>
 * </ul>
 * 
 * @since SWARM-003 Phase 2
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class LogAggregationService {

    private final AuditLogRepository auditLogRepository;
    private final AuditLogMapper auditLogMapper;
    private final RedisTemplate<String, Object> redisTemplate;

    /** 缓存 Key 前缀 */
    private static final String CACHE_KEY_PREFIX = "log_query:";

    /** 缓存过期时间（分钟） */
    private static final long CACHE_TTL_MINUTES = 5;

    /** 最大单页条数 */
    private static final int MAX_PAGE_SIZE = 100;

    /** 最大单次查询时间跨度（天） */
    private static final int MAX_TIME_RANGE_DAYS = 90;

    /**
     * 日志聚合查询
     * 
     * 支持多维筛选，返回分页的日志列表
     *
     * @param page 页码（从 0 开始）
     * @param pageSize 每页条数，最大 100
     * @param startTime 查询起始时间（UTC）
     * @param endTime 查询结束时间（UTC）
     * @param action 操作类型（CREATE/UPDATE/DELETE/READ）
     * @param status 操作状态（SUCCESS/FAILURE）
     * @param operatorId 操作者 ID
     * @param sortBy 排序字段（默认 timestamp）
     * @param order 排序方向（asc/desc）
     * @return 包含分页元数据的日志列表
     * @throws IllegalArgumentException 时间跨度超过 90 天
     */
    public Map<String, Object> queryLogs(
            Integer page,
            Integer pageSize,
            LocalDateTime startTime,
            LocalDateTime endTime,
            String action,
            String status,
            String operatorId,
            String sortBy,
            String order
    ) {
        // 验证参数
        page = (page == null || page < 0) ? 0 : page;
        pageSize = (pageSize == null || pageSize <= 0) ? 20 : Math.min(pageSize, MAX_PAGE_SIZE);
        sortBy = (sortBy == null || sortBy.isEmpty()) ? "timestamp" : sortBy;
        order = (order == null || order.isEmpty()) ? "desc" : order;

        // 验证时间范围
        validateTimeRange(startTime, endTime);

        // 构建缓存 Key
        String cacheKey = buildCacheKey(page, pageSize, startTime, endTime, action, status, operatorId, sortBy, order);

        // 尝试从缓存获取
        @SuppressWarnings("unchecked")
        Map<String, Object> cachedResult = (Map<String, Object>) redisTemplate.opsForValue().get(cacheKey);
        if (cachedResult != null) {
            log.debug("Cache hit for key: {}", cacheKey);
            return cachedResult;
        }

        // 构建分页对象
        Sort sort = Sort.by(
                "asc".equalsIgnoreCase(order) ? Sort.Direction.ASC : Sort.Direction.DESC,
                sortBy
        );
        Pageable pageable = PageRequest.of(page, pageSize, sort);

        // 执行查询
        Page<AuditLog> logPage = auditLogRepository.findLogsWithFilters(
                startTime,
                endTime,
                action,
                status,
                operatorId,
                pageable
        );

        // 构建返回结果
        Map<String, Object> result = new HashMap<>();
        result.put("items", logPage.getContent().stream()
                .map(auditLogMapper::toDto)
                .collect(Collectors.toList()));
        result.put("total", logPage.getTotalElements());
        result.put("page", page);
        result.put("page_size", pageSize);
        result.put("total_pages", logPage.getTotalPages());

        // 添加游标分页支持
        if (logPage.hasNext()) {
            result.put("next_cursor", logPage.nextPageable().getPageNumber());
        }
        if (logPage.hasPrevious()) {
            result.put("prev_cursor", logPage.previousPageable().getPageNumber());
        }

        // 写入缓存
        redisTemplate.opsForValue().set(cacheKey, result, CACHE_TTL_MINUTES, TimeUnit.MINUTES);
        log.debug("Cache miss, result cached with key: {}", cacheKey);

        return result;
    }

    /**
     * 趋势聚合查询
     * 
     * 按指定粒度聚合日志数量，支持按操作类型或状态拆分
     *
     * @param startTime 趋势起始时间（UTC）
     * @param endTime 趋势结束时间（UTC）
     * @param granularity 粒度（day/week/month）
     * @param breakdown 拆分维度（action/status），可选
     * @return 包含时间序列数据点的趋势数据
     * @throws IllegalArgumentException 时间跨度超过 90 天
     */
    public Map<String, Object> queryTrends(
            LocalDateTime startTime,
            LocalDateTime endTime,
            String granularity,
            String breakdown
    ) {
        // 验证时间范围
        validateTimeRange(startTime, endTime);

        // 默认粒度
        granularity = (granularity == null || granularity.isEmpty()) ? "day" : granularity.toLowerCase();

        // 构建缓存 Key
        String cacheKey = String.format("%strends:%s:%s:%s:%s:%s",
                CACHE_KEY_PREFIX,
                startTime.toString(),
                endTime.toString(),
                granularity,
                breakdown == null ? "none" : breakdown);

        // 尝试从缓存获取
        @SuppressWarnings("unchecked")
        Map<String, Object> cachedResult = (Map<String, Object>) redisTemplate.opsForValue().get(cacheKey);
        if (cachedResult != null) {
            log.debug("Cache hit for trends key: {}", cacheKey);
            return cachedResult;
        }

        // 转换时间戳为 UTC 毫秒
        long startMillis = startTime.toInstant(ZoneOffset.UTC).toEpochMilli();
        long endMillis = endTime.toInstant(ZoneOffset.UTC).toEpochMilli();

        // 执行聚合查询
        List<LogTrendDTO> dataPoints;
        if ("action".equalsIgnoreCase(breakdown)) {
            dataPoints = auditLogRepository.aggregateByActionAndTimeRange(startMillis, endMillis, granularity);
        } else if ("status".equalsIgnoreCase(breakdown)) {
            dataPoints = auditLogRepository.aggregateByStatusAndTimeRange(startMillis, endMillis, granularity);
        } else {
            dataPoints = auditLogRepository.aggregateByTimeRange(startMillis, endMillis, granularity);
        }

        // 构建返回结果
        Map<String, Object> result = new HashMap<>();
        result.put("data_points", dataPoints);
        result.put("granularity", granularity);
        result.put("start_time", startTime);
        result.put("end_time", endTime);

        // 写入缓存（趋势数据相对稳定，可适当延长缓存时间）
        redisTemplate.opsForValue().set(cacheKey, result, CACHE_TTL_MINUTES * 2, TimeUnit.MINUTES);
        log.debug("Trends data cached with key: {}", cacheKey);

        return result;
    }

    /**
     * 查询单条日志详情
     *
     * @param logId 日志 ID
     * @return 日志详情，不存在则返回 null
     */
    public Map<String, Object> getLogById(String logId) {
        if (logId == null || logId.isEmpty()) {
            throw new IllegalArgumentException("Log ID cannot be null or empty");
        }

        // 缓存 Key
        String cacheKey = CACHE_KEY_PREFIX + "detail:" + logId;

        // 尝试从缓存获取
        @SuppressWarnings("unchecked")
        Map<String, Object> cachedResult = (Map<String, Object>) redisTemplate.opsForValue().get(cacheKey);
        if (cachedResult != null) {
            return cachedResult;
        }

        // 查询数据库
        Optional<AuditLog> logOpt = auditLogRepository.findById(logId);
        if (logOpt.isEmpty()) {
            return null;
        }

        AuditLog log = logOpt.get();
        Map<String, Object> result = auditLogMapper.toDto(log);

        // 写入缓存
        redisTemplate.opsForValue().set(cacheKey, result, CACHE_TTL_MINUTES, TimeUnit.MINUTES);

        return result;
    }

    /**
     * 验证时间范围
     * 
     * 确保查询时间跨度不超过 90 天
     *
     * @param startTime 起始时间
     * @param endTime 结束时间
     * @throws IllegalArgumentException 时间跨度超过 90 天
     */
    private void validateTimeRange(LocalDateTime startTime, LocalDateTime endTime) {
        if (startTime == null || endTime == null) {
            throw new IllegalArgumentException("Start time and end time are required");
        }

        if (startTime.isAfter(endTime)) {
            throw new IllegalArgumentException("Start time must be before end time");
        }

        long daysBetween = java.time.temporal.ChronoUnit.DAYS.between(startTime, endTime);
        if (daysBetween > MAX_TIME_RANGE_DAYS) {
            throw new IllegalArgumentException(
                    String.format("Time range exceeds maximum limit of %d days", MAX_TIME_RANGE_DAYS)
            );
        }
    }

    /**
     * 构建缓存 Key
     * 
     * 基于查询参数生成唯一的缓存标识
     *
     * @param params 查询参数
     * @return 缓存 Key 字符串
     */
    private String buildCacheKey(Object... params) {
        StringBuilder keyBuilder = new StringBuilder(CACHE_KEY_PREFIX);
        for (Object param : params) {
            keyBuilder.append(param != null ? param.hashCode() : "null");
            keyBuilder.append("_");
        }
        return keyBuilder.toString();
    }

    /**
     * 清除日志查询缓存
     * 
     * 在数据变更后调用，确保缓存一致性
     *
     * @param pattern 缓存 Key 模式，支持通配符
     */
    public void clearCache(String pattern) {
        Set<String> keys = redisTemplate.keys(CACHE_KEY_PREFIX + pattern);
        if (keys != null && !keys.isEmpty()) {
            redisTemplate.delete(keys);
            log.info("Cleared {} cache entries matching pattern: {}", keys.size(), pattern);
        }
    }
}