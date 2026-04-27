package com.ams.mapper;

import com.ams.entity.RetirementHistory;
import com.ams.entity.AssetStatusHistory;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;
import org.apache.ibatis.annotations.Insert;
import org.apache.ibatis.annotations.Update;
import org.apache.ibatis.annotations.Delete;
import org.apache.ibatis.annotations.Results;
import org.apache.ibatis.annotations.Result;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

/**
 * Mapper interface for RetirementHistory entity operations.
 * 
 * <p>This mapper provides database access methods for the asset retirement/discard
 * workflow history recording. It supports querying, inserting, and managing
 * retirement-related status changes and audit trails.</p>
 * 
 * <p>Supported operations include:</p>
 * <ul>
 *   <li>Retrieving complete retirement history for an asset</li>
 *   <li>Recording state transitions during retirement workflow</li>
 *   <li>Querying history by application ID</li>
 *   <li>Audit trail management for compliance</li>
 * </ul>
 * 
 * @since SWARM-002 Phase 1
 * @see com.ams.entity.RetirementHistory
 * @see com.ams.service.RetirementService
 */
@Mapper
public interface RetirementHistoryMapper {

    /**
     * Retrieves all retirement history records for a specific asset.
     *
     * <p>This method returns the complete history of retirement-related operations
     * performed on an asset, ordered by creation time in descending order (newest first).</p>
     *
     * @param assetId The UUID of the asset to retrieve history for
     * @return List of RetirementHistory records for the asset, empty list if none found
     */
    @Select("SELECT id, application_id, asset_id, operator_id, action, prev_status, next_status, " +
            "ip_address, created_at, remark FROM retirement_history " +
            "WHERE asset_id = #{assetId} ORDER BY created_at DESC")
    @Results({
        @Result(property = "id", column = "id"),
        @Result(property = "applicationId", column = "application_id"),
        @Result(property = "assetId", column = "asset_id"),
        @Result(property = "operatorId", column = "operator_id"),
        @Result(property = "action", column = "action"),
        @Result(property = "prevStatus", column = "prev_status"),
        @Result(property = "nextStatus", column = "next_status"),
        @Result(property = "ipAddress", column = "ip_address"),
        @Result(property = "createdAt", column = "created_at"),
        @Result(property = "remark", column = "remark")
    })
    List<RetirementHistory> selectByAssetId(@Param("assetId") UUID assetId);

    /**
     * Retrieves retirement history records for a specific retirement application.
     *
     * @param applicationId The UUID of the retirement application
     * @return List of RetirementHistory records for the application
     */
    @Select("SELECT id, application_id, asset_id, operator_id, action, prev_status, next_status, " +
            "ip_address, created_at, remark FROM retirement_history " +
            "WHERE application_id = #{applicationId} ORDER BY created_at ASC")
    @Results({
        @Result(property = "id", column = "id"),
        @Result(property = "applicationId", column = "application_id"),
        @Result(property = "assetId", column = "asset_id"),
        @Result(property = "operatorId", column = "operator_id"),
        @Result(property = "action", column = "action"),
        @Result(property = "prevStatus", column = "prev_status"),
        @Result(property = "nextStatus", column = "next_status"),
        @Result(property = "ipAddress", column = "ip_address"),
        @Result(property = "createdAt", column = "created_at"),
        @Result(property = "remark", column = "remark")
    })
    List<RetirementHistory> selectByApplicationId(@Param("applicationId") UUID applicationId);

    /**
     * Retrieves a single retirement history record by ID.
     *
     * @param id The UUID of the history record
     * @return RetirementHistory record or null if not found
     */
    @Select("SELECT id, application_id, asset_id, operator_id, action, prev_status, next_status, " +
            "ip_address, created_at, remark FROM retirement_history WHERE id = #{id}")
    @Results({
        @Result(property = "id", column = "id"),
        @Result(property = "applicationId", column = "application_id"),
        @Result(property = "assetId", column = "asset_id"),
        @Result(property = "operatorId", column = "operator_id"),
        @Result(property = "action", column = "action"),
        @Result(property = "prevStatus", column = "prev_status"),
        @Result(property = "nextStatus", column = "next_status"),
        @Result(property = "ipAddress", column = "ip_address"),
        @Result(property = "createdAt", column = "created_at"),
        @Result(property = "remark", column = "remark")
    })
    RetirementHistory selectById(@Param("id") UUID id);

    /**
     * Inserts a new retirement history record.
     *
     * <p>Records a state transition or action within the retirement workflow.
     * This is used for audit trail purposes and workflow state tracking.</p>
     *
     * @param history The RetirementHistory record to insert
     * @return Number of rows affected (should be 1)
     */
    @Insert("INSERT INTO retirement_history (id, application_id, asset_id, operator_id, action, " +
            "prev_status, next_status, ip_address, created_at, remark) " +
            "VALUES (#{id}, #{applicationId}, #{assetId}, #{operatorId}, #{action}, " +
            "#{prevStatus}, #{nextStatus}, #{ipAddress}, #{createdAt}, #{remark})")
    int insert(RetirementHistory history);

    /**
     * Updates an existing retirement history record.
     *
     * @param history The RetirementHistory record with updated values
     * @return Number of rows affected
     */
    @Update("UPDATE retirement_history SET application_id = #{applicationId}, " +
            "asset_id = #{assetId}, operator_id = #{operatorId}, action = #{action}, " +
            "prev_status = #{prevStatus}, next_status = #{nextStatus}, " +
            "ip_address = #{ipAddress}, remark = #{remark} WHERE id = #{id}")
    int update(RetirementHistory history);

    /**
     * Deletes a retirement history record by ID.
     *
     * @param id The UUID of the history record to delete
     * @return Number of rows affected
     */
    @Delete("DELETE FROM retirement_history WHERE id = #{id}")
    int deleteById(@Param("id") UUID id);

    /**
     * Retrieves the most recent retirement history entry for an asset.
     *
     * <p>Useful for determining the current state of the retirement workflow
     * for a given asset.</p>
     *
     * @param assetId The UUID of the asset
     * @return The most recent RetirementHistory record or null if none found
     */
    @Select("SELECT id, application_id, asset_id, operator_id, action, prev_status, next_status, " +
            "ip_address, created_at, remark FROM retirement_history " +
            "WHERE asset_id = #{assetId} ORDER BY created_at DESC LIMIT 1")
    @Results({
        @Result(property = "id", column = "id"),
        @Result(property = "applicationId", column = "application_id"),
        @Result(property = "assetId", column = "asset_id"),
        @Result(property = "operatorId", column = "operator_id"),
        @Result(property = "action", column = "action"),
        @Result(property = "prevStatus", column = "prev_status"),
        @Result(property = "nextStatus", column = "next_status"),
        @Result(property = "ipAddress", column = "ip_address"),
        @Result(property = "createdAt", column = "created_at"),
        @Result(property = "remark", column = "remark")
    })
    RetirementHistory selectLatestByAssetId(@Param("assetId") UUID assetId);

    /**
     * Retrieves retirement history records within a specified time range.
     *
     * <p>Supports audit queries for compliance and reporting purposes.</p>
     *
     * @param startTime Start of the time range
     * @param endTime End of the time range
     * @return List of RetirementHistory records within the range
     */
    @Select("SELECT id, application_id, asset_id, operator_id, action, prev_status, next_status, " +
            "ip_address, created_at, remark FROM retirement_history " +
            "WHERE created_at BETWEEN #{startTime} AND #{endTime} ORDER BY created_at DESC")
    @Results({
        @Result(property = "id", column = "id"),
        @Result(property = "applicationId", column = "application_id"),
        @Result(property = "assetId", column = "asset_id"),
        @Result(property = "operatorId", column = "operator_id"),
        @Result(property = "action", column = "action"),
        @Result(property = "prevStatus", column = "prev_status"),
        @Result(property = "nextStatus", column = "next_status"),
        @Result(property = "ipAddress", column = "ip_address"),
        @Result(property = "createdAt", column = "created_at"),
        @Result(property = "remark", column = "remark")
    })
    List<RetirementHistory> selectByTimeRange(
            @Param("startTime") LocalDateTime startTime,
            @Param("endTime") LocalDateTime endTime);

    /**
     * Counts total retirement history records for a specific asset.
     *
     * @param assetId The UUID of the asset
     * @return Total count of history records
     */
    @Select("SELECT COUNT(*) FROM retirement_history WHERE asset_id = #{assetId}")
    long countByAssetId(@Param("assetId") UUID assetId);
}