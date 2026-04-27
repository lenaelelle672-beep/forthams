package com.ams.repository;

import com.ams.entity.RetirementAuditLog;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;

/**
 * Repository interface for RetirementAuditLog entity.
 * Provides data access operations for asset retirement audit trail records.
 * 
 * <p>This repository enforces an append-only strategy for audit logs:
 * <ul>
 *   <li>No UPDATE operations are permitted on audit records</li>
 *   <li>No DELETE operations are permitted on audit records</li>
 *   <li>All state changes must be recorded synchronously</li>
 * </ul>
 * 
 * <p>Audit logs are used to track the complete lifecycle of retirement applications,
 * including state transitions, approval actions, and decommission events.
 * 
 * @see RetirementAuditLog
 */
@Repository
public interface RetirementAuditLogRepository extends JpaRepository<RetirementAuditLog, Long> {

    /**
     * Find all audit logs for a specific retirement application, ordered by creation time.
     * 
     * <p>This method retrieves the complete audit trail for a retirement application,
     * ordered chronologically from earliest to latest event.
     * 
     * @param applicationId the ID of the retirement application
     * @return list of audit logs ordered by creation time ascending
     */
    @Query("SELECT a FROM RetirementAuditLog a WHERE a.applicationId = :applicationId ORDER BY a.createdAt ASC")
    List<RetirementAuditLog> findByApplicationIdOrderByCreatedAtAsc(@Param("applicationId") Long applicationId);

    /**
     * Find all audit logs for a specific retirement application, ordered by creation time descending.
     * 
     * <p>This method retrieves the audit trail in reverse chronological order,
     * useful for displaying the most recent events first.
     * 
     * @param applicationId the ID of the retirement application
     * @return list of audit logs ordered by creation time descending
     */
    @Query("SELECT a FROM RetirementAuditLog a WHERE a.applicationId = :applicationId ORDER BY a.createdAt DESC")
    List<RetirementAuditLog> findByApplicationIdOrderByCreatedAtDesc(@Param("applicationId") Long applicationId);

    /**
     * Find audit logs by event type for a specific application.
     * 
     * <p>This method allows filtering of audit logs by event type,
     * enabling focused analysis of specific event categories.
     * 
     * @param applicationId the ID of the retirement application
     * @param eventType the type of event to filter by
     * @return list of matching audit logs ordered by creation time ascending
     */
    @Query("SELECT a FROM RetirementAuditLog a WHERE a.applicationId = :applicationId AND a.eventType = :eventType ORDER BY a.createdAt ASC")
    List<RetirementAuditLog> findByApplicationIdAndEventType(
            @Param("applicationId") Long applicationId,
            @Param("eventType") String eventType);

    /**
     * Find audit logs within a date time range.
     * 
     * <p>This method supports time-range queries for audit log analysis,
     * useful for compliance reporting and historical analysis.
     * 
     * @param startTime the start of the date time range (inclusive)
     * @param endTime the end of the date time range (inclusive)
     * @return list of audit logs within the specified range
     */
    @Query("SELECT a FROM RetirementAuditLog a WHERE a.createdAt >= :startTime AND a.createdAt <= :endTime ORDER BY a.createdAt ASC")
    List<RetirementAuditLog> findByCreatedAtBetween(
            @Param("startTime") LocalDateTime startTime,
            @Param("endTime") LocalDateTime endTime);

    /**
     * Find audit logs by operator ID.
     * 
     * <p>This method allows retrieval of all audit actions performed by a specific operator,
     * supporting accountability and audit trail analysis.
     * 
     * @param operatorId the ID of the operator
     * @return list of audit logs created by the specified operator
     */
    List<RetirementAuditLog> findByOperatorId(Long operatorId);

    /**
     * Find audit logs by request ID for distributed tracing.
     * 
     * <p>Each API request carries an X-Request-ID header for链路追踪.
     * This method enables retrieval of all audit logs associated with a specific request.
     * 
     * @param requestId the unique request identifier from X-Request-ID header
     * @return list of audit logs for the specified request
     */
    List<RetirementAuditLog> findByRequestId(String requestId);

    /**
     * Count audit log entries for a specific application.
     * 
     * <p>This method provides a count of all audit entries for a retirement application,
     * useful for verification and audit trail completeness checks.
     * 
     * @param applicationId the ID of the retirement application
     * @return the count of audit log entries
     */
    @Query("SELECT COUNT(a) FROM RetirementAuditLog a WHERE a.applicationId = :applicationId")
    long countByApplicationId(@Param("applicationId") Long applicationId);

    /**
     * Find the latest audit log entry for a specific application.
     * 
     * <p>This method retrieves the most recent audit entry,
     * useful for determining the current state of the audit trail.
     * 
     * @param applicationId the ID of the retirement application
     * @return the most recent audit log entry, or null if none exists
     */
    @Query("SELECT a FROM RetirementAuditLog a WHERE a.applicationId = :applicationId ORDER BY a.createdAt DESC LIMIT 1")
    RetirementAuditLog findLatestByApplicationId(@Param("applicationId") Long applicationId);

    /**
     * Check if an audit log entry exists with the given idempotency key.
     * 
     * <p>Idempotency keys prevent duplicate audit log entries from being created
     * when retrying failed operations.
     * 
     * @param idempotencyKey the unique idempotency key
     * @return true if an entry exists, false otherwise
     */
    boolean existsByIdempotencyKey(String idempotencyKey);

    /**
     * Find audit logs for multiple applications.
     * 
     * <p>This method supports batch retrieval of audit logs for multiple applications,
     * useful for reporting and analytics purposes.
     * 
     * @param applicationIds list of application IDs to query
     * @return list of audit logs for the specified applications
     */
    @Query("SELECT a FROM RetirementAuditLog a WHERE a.applicationId IN :applicationIds ORDER BY a.createdAt ASC")
    List<RetirementAuditLog> findByApplicationIdIn(@Param("applicationIds") List<Long> applicationIds);
}