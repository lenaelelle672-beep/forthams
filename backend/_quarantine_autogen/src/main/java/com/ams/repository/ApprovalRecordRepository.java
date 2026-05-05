package com.ams.repository;

import com.ams.entity.ApprovalRecord;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

/**
 * Repository for ApprovalRecord entities.
 * Supports work order approval workflow (Iteration 7, SWARM-2025-Q2-P0-003).
 *
 * <p>Provides queries for:
 * <ul>
 *   <li>Finding records by work order ID</li>
 *   <li>Idempotency key deduplication</li>
 *   <li>Audit log retrieval for notification triggers</li>
 * </ul>
 *
 * @see ApprovalRecord
 */
@Repository
public interface ApprovalRecordRepository extends JpaRepository<ApprovalRecord, Long> {

    /**
     * Find all approval records for a given work order.
     *
     * @param workOrderId the work order ID
     * @return list of approval records ordered by creation time ascending
     */
    List<ApprovalRecord> findByWorkOrderIdOrderByCreatedAtAsc(Long workOrderId);

    /**
     * Find the latest approval record for a given work order.
     *
     * @param workOrderId the work order ID
     * @return the most recent approval record, empty if none exist
     */
    Optional<ApprovalRecord> findTopByWorkOrderIdOrderByCreatedAtDesc(Long workOrderId);

    /**
     * Check whether an idempotency key already exists within the given TTL window.
     * Used to enforce the 5-minute idempotency window defined in the spec.
     *
     * @param idempotencyKey the deduplication key
     * @param windowStart    the start of the idempotency window (now - 5 minutes)
     * @return true if a record with this key and within the window exists
     */
    @Query("SELECT COUNT(a) > 0 FROM ApprovalRecord a " +
           "WHERE a.idempotencyKey = :idempotencyKey " +
           "AND a.createdAt >= :windowStart")
    boolean existsByIdempotencyKeyWithinWindow(
            @Param("idempotencyKey") String idempotencyKey,
            @Param("windowStart") LocalDateTime windowStart);

    /**
     * Find approval records by operator ID (the approver who performed the action).
     *
     * @param operatorId the approver's user ID
     * @return list of records where this operator is the approver
     */
    List<ApprovalRecord> findByOperatorId(Long operatorId);

    /**
     * Find all approval records whose status is one of the notification-triggering statuses.
     * Per spec, only APPROVED, REJECTED, and RETURNED trigger notifications.
     *
     * @return list of approval records with notification-triggering statuses
     */
    @Query("SELECT a FROM ApprovalRecord a " +
           "WHERE a.status IN ('APPROVED', 'REJECTED', 'RETURNED') " +
           "AND a.notificationSent = false")
    List<ApprovalRecord> findPendingNotificationRecords();

    /**
     * Find all approval records for a given work order with a specific status.
     *
     * @param workOrderId the work order ID
     * @param status      the approval status (e.g. APPROVED, REJECTED, RETURNED)
     * @return list of matching approval records
     */
    List<ApprovalRecord> findByWorkOrderIdAndStatus(Long workOrderId, String status);
}