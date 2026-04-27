package com.ams.repository;

import com.ams.entity.RetirementApplication;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

/**
 * 退休申请 Repository
 * 
 * 业务域: 资产管理 - 资产退休审批流
 * 
 * 功能说明:
 * - 资产管理系统的资产退休(退役)申请数据访问层
 * - 支持退休申请单的创建、查询、状态变更等操作
 * - 与 ApprovalService 配合完成多级审批流程
 * 
 * 依赖关系:
 * - 关联实体: RetirementApplication
 * - 配合 Service: RetirementService, ApprovalChainService
 * - 配合 Controller: RetirementController
 * 
 * 状态说明:
 * - PENDING_APPROVAL: 待审批
 * - APPROVED: 已审批通过
 * - REJECTED: 已驳回
 * - COMPLETED: 已完成退役
 * 
 * @note 此文件位于 _quarantine_autogen 目录，包含未完成但有价值的业务逻辑
 *       后续若开发 Java 后端，请先检查并按需选择性恢复，不要盲目重生成或覆盖
 * 
 * TODO: 补充复杂查询方法
 * TODO: 添加分页查询支持
 * TODO: 补充与 RetirementApprovalRecord 的关联查询
 */
@Repository
public interface RetirementApplicationRepository extends JpaRepository<RetirementApplication, Long> {

    /**
     * 根据申请状态查询退休申请列表
     * 
     * @param status 申请状态
     * @return 符合状态的申请列表
     */
    java.util.List<RetirementApplication> findByStatus(String status);

    /**
     * 根据申请人ID查询退休申请列表
     * 
     * @param applicantId 申请人ID
     * @return 该申请人的所有申请记录
     */
    java.util.List<RetirementApplication> findByApplicantId(Long applicantId);

    /**
     * 根据资产ID查询退休申请
     * 
     * @param assetId 资产ID
     * @return 该资产的退休申请记录
     */
    java.util.List<RetirementApplication> findByAssetId(Long assetId);

    /**
     * 根据申请状态和申请人ID查询退休申请
     * 
     * @param status 申请状态
     * @param applicantId 申请人ID
     * @return 符合条件的申请列表
     */
    java.util.List<RetirementApplication> findByStatusAndApplicantId(String status, Long applicantId);
}