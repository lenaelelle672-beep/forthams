package com.ams.service;

import com.ams.common.Result;
import com.ams.entity.GeneralAuditEntry;
import com.ams.mapper.AuditLogMapper;
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
import java.util.Date;

@Service
public class AuditService {

    private final AuditLogMapper auditLogMapper;

    public AuditService(AuditLogMapper auditLogMapper) {
        this.auditLogMapper = auditLogMapper;
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
        // Parameter validation and defense (Constraint #2)
        if (pageNum < 0) {
            pageNum = 0;
        }
        if (pageSize < 1 || pageSize > 100) {
            pageSize = 10;
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
        return auditLogMapper.selectById(id);
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
