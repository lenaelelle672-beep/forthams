package com.ams.repository;

import com.ams.entity.AssetHistory;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

/**
 * Repository interface for AssetHistory entity operations.
 * Provides data access methods for asset status change history records.
 * 
 * <p>This repository supports the asset retirement workflow by providing:
 * <ul>
 *   <li>CRUD operations for history records</li>
 *   <li>Query methods for asset history retrieval</li>
 *   <li>State transition recording capabilities</li>
 * </ul>
 * 
 * @see AssetHistory
 * @since 1.0
 */
@Repository
public interface AssetHistoryRepository extends JpaRepository<AssetHistory, Long> {

    /**
     * Finds all history records for a specific asset, ordered by change time descending.
     * 
     * @param assetId the asset identifier
     * @return list of history records for the asset
     */
    List<AssetHistory> findByAssetIdOrderByChangeTimeDesc(Long assetId);

    /**
     * Finds all history records for a specific asset within a time range.
     * 
     * @param assetId the asset identifier
     * @param startTime start of the time range
     * @param endTime end of the time range
     * @return list of history records within the specified time range
     */
    @Query("SELECT h FROM AssetHistory h WHERE h.assetId = :assetId " +
           "AND h.changeTime BETWEEN :startTime AND :endTime " +
           "ORDER BY h.changeTime DESC")
    List<AssetHistory> findByAssetIdAndTimeRange(
            @Param("assetId") Long assetId,
            @Param("startTime") LocalDateTime startTime,
            @Param("endTime") LocalDateTime endTime);

    /**
     * Retrieves the latest history record for a specific asset.
     * 
     * @param assetId the asset identifier
     * @return optional containing the latest history record if exists
     */
    @Query("SELECT h FROM AssetHistory h WHERE h.assetId = :assetId " +
           "ORDER BY h.changeTime DESC LIMIT 1")
    Optional<AssetHistory> findLatestByAssetId(@Param("assetId") Long assetId);

    /**
     * Counts the number of history records for a specific asset.
     * 
     * @param assetId the asset identifier
     * @return count of history records
     */
    long countByAssetId(Long assetId);

    /**
     * Finds all history records with a specific from status.
     * 
     * @param fromStatus the source status
     * @return list of history records with the specified from status
     */
    List<AssetHistory> findByFromStatus(String fromStatus);

    /**
     * Finds all history records with a specific to status.
     * 
     * @param toStatus the target status
     * @return list of history records with the specified to status
     */
    List<AssetHistory> findByToStatus(String toStatus);

    /**
     * Finds history records by operator ID.
     * 
     * @param operatorId the operator identifier
     * @return list of history records created by the operator
     */
    List<AssetHistory> findByOperatorId(String operatorId);

    /**
     * Finds all history records within a date range across all assets.
     * 
     * @param startTime start of the time range
     * @param endTime end of the time range
     * @return list of history records within the specified time range
     */
    List<AssetHistory> findByChangeTimeBetweenOrderByChangeTimeDesc(
            LocalDateTime startTime, LocalDateTime endTime);

    /**
     * Checks if a history record exists for a specific asset with given status transition.
     * 
     * @param assetId the asset identifier
     * @param fromStatus the source status
     * @param toStatus the target status
     * @return true if such a record exists
     */
    boolean existsByAssetIdAndFromStatusAndToStatus(Long assetId, String fromStatus, String toStatus);

    /**
     * Deletes all history records for a specific asset.
     * 
     * @param assetId the asset identifier
     */
    void deleteByAssetId(Long assetId);
}