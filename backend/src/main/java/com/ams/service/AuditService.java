package com.ams.service;

import com.ams.common.Result;
import com.ams.entity.GeneralAuditEntry;
import com.ams.mapper.AuditLogMapper;
import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

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
        queryWrapper.orderByDesc("timestamp");

        // Execute paginated query via MyBatis-Plus
        Page<GeneralAuditEntry> resultPage = auditLogMapper.selectPage(page, queryWrapper);

        return Result.success(resultPage);
    }
}
