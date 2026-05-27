package com.ams.service;

import com.ams.common.Result;
import com.ams.entity.GeneralAuditEntry;
import com.ams.entity.SysOperateLog;
import com.ams.mapper.AuditLogMapper;
import com.ams.mapper.SysOperateLogMapper;
import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.time.OffsetDateTime;
import java.time.ZoneId;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.Date;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Service
public class AuditService {

    private final AuditLogMapper auditLogMapper;
    private final SysOperateLogMapper sysOperateLogMapper;

    public AuditService(AuditLogMapper auditLogMapper, SysOperateLogMapper sysOperateLogMapper) {
        this.auditLogMapper = auditLogMapper;
        this.sysOperateLogMapper = sysOperateLogMapper;
    }

    @Transactional
    public void save(GeneralAuditEntry auditEntry) {
        auditLogMapper.insert(auditEntry);
    }

    /**
     * Query audit logs with pagination.
     *
     * <p>Validates input parameters and applies default values for out-of-range inputs:
     * - pageNum &lt; 0 is corrected to 0
     * - pageSize outside [1, 100] is clamped to 10</p>
     *
     * @param pageNum  page number (0-based), defaults to 0 if negative
     * @param pageSize page size, defaults to 10 if &lt; 1 or &gt; 100
     * @return paginated result containing audit logs sorted by timestamp descending
     */
    public Result<Page<GeneralAuditEntry>> queryLogs(int pageNum, int pageSize) {
        return queryLogs(pageNum, pageSize, null, null, null, null, null);
    }

    public Result<Page<GeneralAuditEntry>> queryLogs(
            int pageNum,
            int pageSize,
            String startTime,
            String endTime,
            String operationType,
            String operatorId,
            String module) {
        return queryLogs(pageNum, pageSize, startTime, endTime, operationType, operatorId, module, null);
    }

    public Result<Page<GeneralAuditEntry>> queryLogs(
            int pageNum,
            int pageSize,
            String startTime,
            String endTime,
            String operationType,
            String operatorId,
            String module,
            String keyword) {
        // Parameter validation and defense (Constraint #2)
        if (pageNum < 0) {
            pageNum = 0;
        }
        if (pageSize < 1 || pageSize > 100) {
            pageSize = 10;
        }

        Page<SysOperateLog> operatePage = new Page<>(pageNum + 1, pageSize);
        QueryWrapper<SysOperateLog> operateWrapper = buildOperateLogWrapper(startTime, endTime, operationType, operatorId, module, keyword)
                .orderByDesc("create_time");
        Page<SysOperateLog> operateResult = sysOperateLogMapper.selectPage(operatePage, operateWrapper);
        if (operateResult.getTotal() > 0 || hasOperateOnlyFilter(keyword)) {
            return Result.success(toAuditPage(operateResult));
        }

        // Build pagination object (MyBatis-Plus Page is 1-based)
        Page<GeneralAuditEntry> page = new Page<>(pageNum + 1, pageSize);

        // Query wrapper - sort by timestamp descending (Constraint #4: parameterized binding)
        QueryWrapper<GeneralAuditEntry> queryWrapper = new QueryWrapper<>();
        Date parsedStartTime = parseDateTime(startTime, false);
        Date parsedEndTime = parseDateTime(endTime, true);

        if (parsedStartTime != null) {
            queryWrapper.ge("timestamp", parsedStartTime);
        }
        if (parsedEndTime != null) {
            queryWrapper.le("timestamp", parsedEndTime);
        }
        if (StringUtils.hasText(operationType)) {
            queryWrapper.eq("operation_type", operationType.trim());
        }
        if (StringUtils.hasText(operatorId)) {
            queryWrapper.eq("operator_id", operatorId.trim());
        }
        if (StringUtils.hasText(module)) {
            queryWrapper.eq("resource_type", module.trim());
        }
        queryWrapper.orderByDesc("timestamp");

        // Execute paginated query via MyBatis-Plus
        Page<GeneralAuditEntry> resultPage = auditLogMapper.selectPage(page, queryWrapper);

        return Result.success(resultPage);
    }

    public GeneralAuditEntry queryLogById(Long id) {
        SysOperateLog operateLog = sysOperateLogMapper.selectById(id);
        if (operateLog != null) {
            return toAuditEntry(operateLog);
        }
        return auditLogMapper.selectById(id);
    }

    public Map<String, Object> getStats(String startTime, String endTime, String operationType) {
        QueryWrapper<SysOperateLog> countWrapper = buildOperateLogWrapper(startTime, endTime, operationType, null, null, null);
        Long totalCount = sysOperateLogMapper.selectCount(countWrapper);

        List<SysOperateLog> logs = sysOperateLogMapper.selectList(
                buildOperateLogWrapper(startTime, endTime, operationType, null, null, null)
                        .orderByDesc("create_time")
                        .last("limit 1000"));

        LocalDate end = parseLocalDate(endTime, LocalDate.now());
        LocalDate start = parseLocalDate(startTime, end.minusDays(6));
        Map<String, Long> trend = new LinkedHashMap<>();
        for (LocalDate day = start; !day.isAfter(end); day = day.plusDays(1)) {
            trend.put(day.toString(), 0L);
        }

        Map<String, Long> typeDistribution = new LinkedHashMap<>();
        Map<String, Long> operatorCounts = new LinkedHashMap<>();
        for (SysOperateLog log : logs) {
            if (log.getCreateTime() != null) {
                String day = log.getCreateTime().toLocalDate().toString();
                if (trend.containsKey(day)) {
                    trend.put(day, trend.get(day) + 1);
                }
            }
            String type = safeText(log.getBusinessType(), "UNKNOWN");
            typeDistribution.put(type, typeDistribution.getOrDefault(type, 0L) + 1);

            String operator = safeText(log.getOperatorName(), log.getOperatorId() == null ? "未知用户" : String.valueOf(log.getOperatorId()));
            operatorCounts.put(operator, operatorCounts.getOrDefault(operator, 0L) + 1);
        }

        List<Map<String, Object>> trendData = trend.entrySet().stream()
                .map(entry -> {
                    Map<String, Object> item = new LinkedHashMap<>();
                    item.put("date", entry.getKey());
                    item.put("count", entry.getValue());
                    return item;
                })
                .collect(Collectors.toList());

        List<Map<String, Object>> topOperators = operatorCounts.entrySet().stream()
                .sorted((a, b) -> Long.compare(b.getValue(), a.getValue()))
                .limit(5)
                .map(entry -> {
                    Map<String, Object> item = new LinkedHashMap<>();
                    item.put("operatorName", entry.getKey());
                    item.put("count", entry.getValue());
                    return item;
                })
                .collect(Collectors.toList());

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("trendData", trendData);
        result.put("typeDistribution", typeDistribution);
        result.put("topOperators", topOperators);
        result.put("totalCount", totalCount == null ? 0L : totalCount);
        return result;
    }

    private QueryWrapper<SysOperateLog> buildOperateLogWrapper(
            String startTime,
            String endTime,
            String operationType,
            String operatorId,
            String module,
            String keyword) {
        QueryWrapper<SysOperateLog> wrapper = new QueryWrapper<>();
        LocalDateTime parsedStartTime = toLocalDateTime(parseDateTime(startTime, false));
        LocalDateTime parsedEndTime = toLocalDateTime(parseDateTime(endTime, true));
        if (parsedStartTime != null) {
            wrapper.ge("create_time", parsedStartTime);
        }
        if (parsedEndTime != null) {
            wrapper.le("create_time", parsedEndTime);
        }
        if (StringUtils.hasText(operationType)) {
            wrapper.eq("business_type", operationType.trim());
        }
        if (StringUtils.hasText(operatorId)) {
            wrapper.eq("operator_id", operatorId.trim());
        }
        if (StringUtils.hasText(module)) {
            wrapper.like("module", module.trim());
        }
        if (StringUtils.hasText(keyword)) {
            String value = keyword.trim();
            wrapper.and(w -> w.like("operator_name", value)
                    .or().like("operation", value)
                    .or().like("module", value)
                    .or().like("request_uri", value)
                    .or().like("business_type", value)
                    .or().like("error_message", value));
        }
        return wrapper;
    }

    private Page<GeneralAuditEntry> toAuditPage(Page<SysOperateLog> source) {
        Page<GeneralAuditEntry> target = new Page<>(source.getCurrent(), source.getSize(), source.getTotal());
        target.setRecords(source.getRecords().stream().map(this::toAuditEntry).collect(Collectors.toList()));
        return target;
    }

    private GeneralAuditEntry toAuditEntry(SysOperateLog log) {
        GeneralAuditEntry entry = new GeneralAuditEntry();
        entry.setId(log.getId());
        entry.setTimestamp(log.getCreateTime() == null ? null : Date.from(log.getCreateTime().atZone(ZoneId.systemDefault()).toInstant()));
        entry.setAction(log.getOperation());
        entry.setOperationType(log.getBusinessType());
        entry.setOperatorId(log.getOperatorId() == null ? null : String.valueOf(log.getOperatorId()));
        entry.setOperatorName(log.getOperatorName());
        entry.setResourceType(log.getModule());
        entry.setResourceId(log.getRequestUri());
        entry.setDetail(buildOperateDetail(log));
        entry.setBeforeRecord(log.getRequestParams());
        entry.setAfterRecord(log.getResponseData());
        entry.setIpAddress(log.getOperatorIp());
        return entry;
    }

    private String buildOperateDetail(SysOperateLog log) {
        List<String> parts = new ArrayList<>();
        if (StringUtils.hasText(log.getOperation())) {
            parts.add(log.getOperation());
        }
        if (StringUtils.hasText(log.getRequestMethod()) || StringUtils.hasText(log.getRequestUri())) {
            parts.add(safeText(log.getRequestMethod(), "") + " " + safeText(log.getRequestUri(), ""));
        }
        if (log.getStatus() != null && log.getStatus() != 0) {
            parts.add("失败" + (StringUtils.hasText(log.getErrorMessage()) ? ": " + log.getErrorMessage() : ""));
        }
        if (log.getCostTime() != null) {
            parts.add(log.getCostTime() + "ms");
        }
        return String.join(" · ", parts);
    }

    private boolean hasOperateOnlyFilter(String keyword) {
        return StringUtils.hasText(keyword);
    }

    private LocalDateTime toLocalDateTime(Date value) {
        if (value == null) {
            return null;
        }
        return LocalDateTime.ofInstant(value.toInstant(), ZoneId.systemDefault());
    }

    private LocalDate parseLocalDate(String value, LocalDate fallback) {
        Date parsed = parseDateTime(value, false);
        if (parsed == null) {
            return fallback;
        }
        return parsed.toInstant().atZone(ZoneId.systemDefault()).toLocalDate();
    }

    private String safeText(String value, String fallback) {
        return StringUtils.hasText(value) ? value : fallback;
    }

    private Date parseDateTime(String value, boolean endOfDay) {
        if (!StringUtils.hasText(value)) {
            return null;
        }

        String trimmed = value.trim();
        try {
            return Date.from(Instant.parse(trimmed));
        } catch (DateTimeParseException ignored) {
            // Fall through to offset, local datetime, and date-only formats.
        }

        try {
            return Date.from(OffsetDateTime.parse(trimmed).toInstant());
        } catch (DateTimeParseException ignored) {
        }

        try {
            LocalDateTime localDateTime = LocalDateTime.parse(trimmed);
            return Date.from(localDateTime.atZone(ZoneId.systemDefault()).toInstant());
        } catch (DateTimeParseException ignored) {
        }

        try {
            LocalDate localDate = LocalDate.parse(trimmed);
            LocalDateTime localDateTime = endOfDay
                    ? localDate.atTime(LocalTime.MAX)
                    : localDate.atStartOfDay();
            return Date.from(localDateTime.atZone(ZoneId.systemDefault()).toInstant());
        } catch (DateTimeParseException ignored) {
            return null;
        }
    }
}
