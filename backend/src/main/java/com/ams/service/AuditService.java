package com.ams.service;

import com.ams.context.TenantContext;
import com.ams.entity.GeneralAuditEntry;
import com.ams.mapper.AuditLogMapper;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;

/**
 * Write-side service for the audit log.
 *
 * <p>Persists {@link GeneralAuditEntry} records into {@code general_audit_entry} via
 * {@link AuditLogMapper#insertAuditEntry(GeneralAuditEntry)}. Persistence is best-effort:
 * an audit failure must never break the business operation it observes, so exceptions
 * are caught and logged rather than propagated to the caller.</p>
 */
@Service
@RequiredArgsConstructor
public class AuditService {

    private static final Logger log = LoggerFactory.getLogger(AuditService.class);

    private final AuditLogMapper auditLogMapper;

    /**
     * Persists a single audit entry.
     *
     * <p>The entry is normalised before insert: a missing {@code tenantId} falls back to the
     * current {@link TenantContext}, and {@code timestamp}/{@code createdAt} default to now.
     * Any persistence failure is logged and swallowed so callers in the request path are
     * not disrupted.</p>
     *
     * @param auditEntry the entry to persist; must not be {@code null}
     */
    public void save(GeneralAuditEntry auditEntry) {
        if (auditEntry == null) {
            return;
        }
        try {
            normalize(auditEntry);
            auditLogMapper.insertAuditEntry(auditEntry);
        } catch (RuntimeException ex) {
            log.warn("audit_persist_failed tenantId={} operationType={} action={} status={} message={}",
                    auditEntry.getTenantId(), auditEntry.getOperationType(),
                    auditEntry.getAction(), auditEntry.getStatus(), ex.getMessage());
        }
    }

    private void normalize(GeneralAuditEntry entry) {
        if (entry.getTenantId() == null || entry.getTenantId().isBlank()) {
            entry.setTenantId(TenantContext.getTenantId());
        }
        LocalDateTime now = LocalDateTime.now();
        if (entry.getTimestamp() == null) {
            entry.setTimestamp(now);
        }
        if (entry.getCreatedAt() == null) {
            entry.setCreatedAt(now);
        }
    }
}
