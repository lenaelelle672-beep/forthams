package com.ams.repository;

import com.ams.entity.RetirementApprovalRecord;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

/**
 * 退休审批记录 Repository
 * 
 * <p>文件价值评估 (ATB-3):
 * - 业务逻辑完整性: 包含完整的审批流程查询方法
 * - 代码质量: 可直接使用
 * - 恢复优先级: P1 (中等优先级)
 * 
 * <p>历史备注:
 * - 原位于 backend/src/main/java/com/ams/repository/
 * - 2026-04-22: Codex 执行 Context Sync 迁移到隔离区
 * 
 * @see com.ams.entity.RetirementApprovalRecord
 * @since 1.0.0
 */
@Repository
public interface RetirementApprovalRecordRepository extends JpaRepository<RetirementApprovalRecord, Long> {

    /**
     * 根据资产ID查找审批记录
     */
    List<RetirementApprovalRecord> findByAssetId(Long assetId);

    /**
     * 根据申请ID查找审批记录
     */
    List<RetirementApprovalRecord> findByRetirementRequestId(Long retirementRequestId);

    /**
     * 根据审批人ID查找待审批记录
     */
    List<RetirementApprovalRecord> findByApproverIdAndStatus(Long approverId, String status);

    /**
     * 根据资产ID和状态查找审批记录
     */
    List<RetirementApprovalRecord> findByAssetIdAndStatus(Long assetId, String status);

    /**
     * 查找指定时间范围内的审批记录
     */
    @Query("SELECT r FROM RetirementApprovalRecord r WHERE r.approvedAt BETWEEN :startTime AND :endTime")
    List<RetirementApprovalRecord> findByApprovedAtBetween(
        @Param("startTime") LocalDateTime startTime,
        @Param("endTime") LocalDateTime endTime
    );

    /**
     * 查找指定审批人未处理的记录数
     */
    @Select("SELECT COUNT(*) FROM retirement_approval_record WHERE approver_id = #{approverId} AND status = 'PENDING'")
    long countPendingByApproverId(@Param("approverId") Long approverId);

    /**
     * 根据状态统计审批记录数
     */
    @Query("SELECT COUNT(r) FROM RetirementApprovalRecord r WHERE r.status = :status")
    long countByStatus(@Param("status") String status);

    /**
     * 查找最近审批的记录
     */
    Optional<RetirementApprovalRecord> findTopByOrderByApprovedAtDesc();

    /**
     * 查找指定资产最新的审批记录
     */
    Optional<RetirementApprovalRecord> findTopByAssetIdOrderByApprovedAtDesc(Long assetId);

    /**
     * 检查是否存在指定申请ID的审批记录
     */
    boolean existsByRetirementRequestId(Long retirementRequestId);

    /**
     * 批量删除指定申请ID的审批记录
     */
    void deleteByRetirementRequestId(Long retirementRequestId);
}