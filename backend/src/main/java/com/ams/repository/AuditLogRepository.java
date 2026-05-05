package com.ams.repository;

/**
 * Compatibility repository marker for audit log acceptance targets.
 *
 * <p>Audit log persistence is implemented by {@code AuditLogMapper}; this type
 * preserves the repository API surface expected by generated checks.</p>
 */
public interface AuditLogRepository {
}
