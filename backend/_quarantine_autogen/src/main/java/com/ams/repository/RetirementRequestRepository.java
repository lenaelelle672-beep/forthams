package com.ams.repository;

import com.ams.entity.RetirementRequest;
import com.ams.entity.RetirementApplication;
import com.ams.state.RetirementRequestStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

/**
 * Repository for managing RetirementRequest entities.
 * Supports asset retirement workflow with state transitions, approval chains, and history persistence.
 * 
 * <p>This repository provides CRUD operations and complex queries for retirement requests,
 * including concurrent request prevention (C-006) and approval workflow support.</p>
 * 
 * @see RetirementRequest
 * @see RetirementRequestStatus
 * @since SWARM-002 Iteration 7
 */
@Repository
public interface RetirementRequestRepository extends JpaRepository<RetirementRequest, Long> {

    /**
     * Finds all retirement requests with the given status.
     * Used by approval workflow to query pending requests.
     *
     * @param status the retirement request status
     * @return list of retirement requests with the specified status
     */
    List<RetirementRequest> findByStatus(RetirementRequestStatus status);

    /**
     * Finds all retirement requests for a specific asset.
     * Supports asset lifecycle tracking and history queries.
     *
     * @param assetId the asset identifier
     * @return list of retirement requests for the asset
     */
    List<RetirementRequest> findByAssetId(Long assetId);

    /**
     * Finds all retirement requests submitted by a specific applicant.
     *
     * @param applicantId the applicant user identifier
     * @return list of retirement requests by the applicant
     */
    List<RetirementRequest> findByApplicantId(Long applicantId);

    /**
     * Checks if an asset has any pending approval retirement requests.
     * Implements C-006 constraint: no concurrent pending requests for same asset.
     *
     * @param assetId the asset identifier
     * @param status the status to check (typically PENDING_APPROVAL)
     * @return true if a pending request exists for the asset
     */
    boolean existsByAssetIdAndStatus(Long assetId, RetirementRequestStatus status);

    /**
     * Finds pending retirement requests for a specific asset.
     * Used to prevent duplicate concurrent requests.
     *
     * @param assetId the asset identifier
     * @param status the status to query
     * @return optional containing the pending request if exists
     */
    Optional<RetirementRequest> findByAssetIdAndStatus(Long assetId, RetirementRequestStatus status);

    /**
     * Finds all retirement requests that have been updated within the given time range.
     * Supports audit and history tracking operations.
     *
     * @param startTime the start of the time range
     * @param endTime the end of the time range
     * @return list of retirement requests updated within the range
     */
    @Query("SELECT r FROM RetirementRequest r WHERE r.updatedAt BETWEEN :startTime AND :endTime")
    List<RetirementRequest> findByUpdatedAtBetween(
            @Param("startTime") LocalDateTime startTime,
            @Param("endTime") LocalDateTime endTime);

    /**
     * Counts the number of retirement requests by status.
     * Supports dashboard statistics and workflow analytics.
     *
     * @param status the retirement request status
     * @return count of requests with the specified status
     */
    long countByStatus(RetirementRequestStatus status);

    /**
     * Finds all retirement requests that have exceeded the approval timeout.
     * Supports automated workflow monitoring.
     *
     * @param status the status to check
     * @param cutoffTime requests created before this time are considered stalled
     * @return list of stalled retirement requests
     */
    @Query("SELECT r FROM RetirementRequest r WHERE r.status = :status AND r.createdAt < :cutoffTime")
    List<RetirementRequest> findStalledRequests(
            @Param("status") RetirementRequestStatus status,
            @Param("cutoffTime") LocalDateTime cutoffTime);

    /**
     * Finds retirement requests with their associated approval records.
     * Eager fetch to avoid N+1 query problem during approval chain processing.
     *
     * @param status the status to filter by
     * @return list of retirement requests with approval records
     */
    @Query("SELECT DISTINCT r FROM RetirementRequest r LEFT JOIN FETCH r.approvalRecords WHERE r.status = :status")
    List<RetirementRequest> findByStatusWithApprovalRecords(@Param("status") RetirementRequestStatus status);

    /**
     * Finds the most recent retirement request for an asset.
     * Useful for checking asset retirement history.
     *
     * @param assetId the asset identifier
     * @return optional containing the most recent request if exists
     */
    @Query("SELECT r FROM RetirementRequest r WHERE r.assetId = :assetId ORDER BY r.createdAt DESC LIMIT 1")
    Optional<RetirementRequest> findLatestByAssetId(@Param("assetId") Long assetId);

    /**
     * Finds all rejected retirement requests for an asset that can be resubmitted.
     * Supports business rule: rejected requests can be recreated after addressing feedback.
     *
     * @param assetId the asset identifier
     * @return list of rejected requests for the asset
     */
    List<RetirementRequest> findByAssetIdAndStatusNot(Long assetId, RetirementRequestStatus status);
}