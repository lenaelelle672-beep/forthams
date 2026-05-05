package com.ams.service.impl;

import com.ams.dto.ApprovalDecisionDTO;
import com.ams.entity.ApprovalRecord;
import com.ams.entity.RetirementApprovalRecord;
import com.ams.entity.WorkOrder;
import com.ams.repository.ApprovalRecordRepository;
import com.ams.repository.RetirementApprovalRecordRepository;
import com.ams.service.RetirementService;
import com.ams.state.WorkOrderState;
import com.ams.state.WorkOrderStateMachine;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import java.util.stream.Collectors;

/**
 * WorkOrderServiceImpl - 工单服务实现类
 * 
 * <p>工单服务实现类，负责工单的创建、分配、审批和完成等核心业务逻辑。
 * 该文件来自 quarantine 目录，包含了自动生成的初步实现，需要根据实际需求进行完善。</p>
 * 
 * <p><b>Recovery Strategy</b>: 本文件包含 valuable business logic fragments，
 * 建议在未来 Java 后端开发时优先检查并按需选择性恢复。</p>
 * 
 * @see WorkOrderStateMachine
 * @see ApprovalRecordRepository
 * @see RetirementApprovalRecordRepository
 */
@Service
public class WorkOrderServiceImpl {

    private final ApprovalRecordRepository approvalRecordRepository;
    private final RetirementApprovalRecordRepository retirementApprovalRecordRepository;
    private final RetirementService retirementService;
    private final WorkOrderStateMachine workOrderStateMachine;

    @Autowired
    public WorkOrderServiceImpl(
            ApprovalRecordRepository approvalRecordRepository,
            RetirementApprovalRecordRepository retirementApprovalRecordRepository,
            RetirementService retirementService,
            WorkOrderStateMachine workOrderStateMachine) {
        this.approvalRecordRepository = approvalRecordRepository;
        this.retirementApprovalRecordRepository = retirementApprovalRecordRepository;
        this.retirementService = retirementService;
        this.workOrderStateMachine = workOrderStateMachine;
    }

    /**
     * 创建工单
     * 
     * @param workOrder 工单实体
     * @return 创建后的工单
     */
    @Transactional
    public WorkOrder createWorkOrder(WorkOrder workOrder) {
        // 初始化工单状态
        workOrder.setState(WorkOrderState.PENDING);
        workOrder.setCreatedAt(LocalDateTime.now());
        workOrder.setUpdatedAt(LocalDateTime.now());
        
        // 保存工单记录
        return saveWorkOrder(workOrder);
    }

    /**
     * 分配工单
     * 
     * @param workOrderId 工单ID
     * @param assigneeId 接收人ID
     * @return 分配后的工单
     */
    @Transactional
    public WorkOrder assignWorkOrder(Long workOrderId, Long assigneeId) {
        WorkOrder workOrder = findWorkOrderById(workOrderId);
        
        // 验证状态转换是否合法
        if (!workOrderStateMachine.canTransition(workOrder.getState(), WorkOrderState.ASSIGNED)) {
            throw new IllegalStateException(
                String.format("Cannot transition from %s to ASSIGNED", workOrder.getState()));
        }
        
        workOrder.setAssigneeId(assigneeId);
        workOrder.setState(WorkOrderState.ASSIGNED);
        workOrder.setAssignedAt(LocalDateTime.now());
        workOrder.setUpdatedAt(LocalDateTime.now());
        
        return updateWorkOrder(workOrder);
    }

    /**
     * 提交工单审批
     * 
     * @param workOrderId 工单ID
     * @param approvalDecisionDTO 审批决策DTO
     * @return 审批记录
     */
    @Transactional
    public ApprovalRecord submitForApproval(Long workOrderId, ApprovalDecisionDTO approvalDecisionDTO) {
        WorkOrder workOrder = findWorkOrderById(workOrderId);
        
        // 验证状态转换
        if (!workOrderStateMachine.canTransition(workOrder.getState(), WorkOrderState.SUBMITTED)) {
            throw new IllegalStateException(
                String.format("Cannot transition from %s to SUBMITTED", workOrder.getState()));
        }
        
        // 创建审批记录
        ApprovalRecord approvalRecord = new ApprovalRecord();
        approvalRecord.setWorkOrderId(workOrderId);
        approvalRecord.setApplicantId(approvalDecisionDTO.getApplicantId());
        approvalRecord.setApproverId(approvalDecisionDTO.getApproverId());
        approvalRecord.setStatus("PENDING");
        approvalRecord.setDecision(approvalDecisionDTO.getDecision());
        approvalRecord.setComments(approvalDecisionDTO.getComments());
        approvalRecord.setCreatedAt(LocalDateTime.now());
        
        // 更新工单状态
        workOrder.setState(WorkOrderState.SUBMITTED);
        workOrder.setUpdatedAt(LocalDateTime.now());
        updateWorkOrder(workOrder);
        
        return approvalRecordRepository.save(approvalRecord);
    }

    /**
     * 审批工单
     * 
     * @param approvalRecordId 审批记录ID
     * @param decision 决策结果
     * @param comments 审批意见
     * @return 审批后的工单
     */
    @Transactional
    public WorkOrder approveWorkOrder(Long approvalRecordId, String decision, String comments) {
        ApprovalRecord approvalRecord = approvalRecordRepository.findById(approvalRecordId)
            .orElseThrow(() -> new IllegalArgumentException("Approval record not found: " + approvalRecordId));
        
        WorkOrder workOrder = findWorkOrderById(approvalRecord.getWorkOrderId());
        
        // 根据决策结果更新状态
        WorkOrderState newState;
        if ("APPROVED".equals(decision)) {
            newState = WorkOrderState.APPROVED;
        } else if ("REJECTED".equals(decision)) {
            newState = WorkOrderState.REJECTED;
        } else {
            throw new IllegalArgumentException("Invalid decision: " + decision);
        }
        
        // 验证状态转换
        if (!workOrderStateMachine.canTransition(workOrder.getState(), newState)) {
            throw new IllegalStateException(
                String.format("Cannot transition from %s to %s", workOrder.getState(), newState));
        }
        
        // 更新审批记录
        approvalRecord.setDecision(decision);
        approvalRecord.setComments(comments);
        approvalRecord.setStatus("COMPLETED");
        approvalRecord.setCompletedAt(LocalDateTime.now());
        approvalRecordRepository.update(approvalRecord);
        
        // 更新工单状态
        workOrder.setState(newState);
        workOrder.setUpdatedAt(LocalDateTime.now());
        return updateWorkOrder(workOrder);
    }

    /**
     * 完成工单
     * 
     * @param workOrderId 工单ID
     * @return 完工后的工单
     */
    @Transactional
    public WorkOrder completeWorkOrder(Long workOrderId) {
        WorkOrder workOrder = findWorkOrderById(workOrderId);
        
        // 验证状态转换
        if (!workOrderStateMachine.canTransition(workOrder.getState(), WorkOrderState.COMPLETED)) {
            throw new IllegalStateException(
                String.format("Cannot transition from %s to COMPLETED", workOrder.getState()));
        }
        
        workOrder.setState(WorkOrderState.COMPLETED);
        workOrder.setCompletedAt(LocalDateTime.now());
        workOrder.setUpdatedAt(LocalDateTime.now());
        
        return updateWorkOrder(workOrder);
    }

    /**
     * 取消工单
     * 
     * @param workOrderId 工单ID
     * @param reason 取消原因
     * @return 取消后的工单
     */
    @Transactional
    public WorkOrder cancelWorkOrder(Long workOrderId, String reason) {
        WorkOrder workOrder = findWorkOrderById(workOrderId);
        
        // 验证状态转换
        if (!workOrderStateMachine.canTransition(workOrder.getState(), WorkOrderState.CANCELLED)) {
            throw new IllegalStateException(
                String.format("Cannot transition from %s to CANCELLED", workOrder.getState()));
        }
        
        workOrder.setState(WorkOrderState.CANCELLED);
        workOrder.setCancelReason(reason);
        workOrder.setUpdatedAt(LocalDateTime.now());
        
        return updateWorkOrder(workOrder);
    }

    /**
     * 根据ID查询工单
     * 
     * @param workOrderId 工单ID
     * @return 工单实体
     */
    public WorkOrder findWorkOrderById(Long workOrderId) {
        // 这里需要通过 WorkOrderMapper 或 Repository 查询
        // 简化实现，实际项目中需要注入对应的 Mapper/Repository
        WorkOrder workOrder = new WorkOrder();
        workOrder.setId(workOrderId);
        workOrder.setState(WorkOrderState.PENDING);
        return workOrder;
    }

    /**
     * 保存工单
     * 
     * @param workOrder 工单实体
     * @return 保存后的工单
     */
    private WorkOrder saveWorkOrder(WorkOrder workOrder) {
        // 实际实现需要调用 WorkOrderMapper.insert()
        return workOrder;
    }

    /**
     * 更新工单
     * 
     * @param workOrder 工单实体
     * @return 更新后的工单
     */
    private WorkOrder updateWorkOrder(WorkOrder workOrder) {
        // 实际实现需要调用 WorkOrderMapper.updateById()
        return workOrder;
    }

    /**
     * 查询待处理的审批记录
     * 
     * @param approverId 审批人ID
     * @return 待处理审批记录列表
     */
    public List<ApprovalRecord> findPendingApprovals(Long approverId) {
        return approvalRecordRepository.findByApproverIdAndStatus(approverId, "PENDING");
    }

    /**
     * 查询工单的所有审批记录
     * 
     * @param workOrderId 工单ID
     * @return 审批记录列表
     */
    public List<ApprovalRecord> findApprovalRecordsByWorkOrderId(Long workOrderId) {
        return approvalRecordRepository.findByWorkOrderId(workOrderId);
    }

    /**
     * 关联退休审批记录
     * 
     * <p>工单可能与资产退休流程关联，此方法用于获取关联的退休审批记录。</p>
     * 
     * @param workOrderId 工单ID
     * @return 关联的退休审批记录列表
     */
    public List<RetirementApprovalRecord> findRetirementApprovalRecords(Long workOrderId) {
        return retirementApprovalRecordRepository.findByWorkOrderId(workOrderId);
    }

    /**
     * 验证工单状态
     * 
     * @param workOrderId 工单ID
     * @param expectedState 期望的状态
     * @return 是否匹配
     */
    public boolean validateWorkOrderState(Long workOrderId, WorkOrderState expectedState) {
        WorkOrder workOrder = findWorkOrderById(workOrderId);
        return workOrder.getState() == expectedState;
    }

    /**
     * 获取工单统计信息
     * 
     * @return 统计信息
     */
    public WorkOrderStatistics getStatistics() {
        WorkOrderStatistics stats = new WorkOrderStatistics();
        // 实际实现需要查询数据库获取统计数据
        return stats;
    }

    /**
     * 工单统计信息内部类
     */
    public static class WorkOrderStatistics {
        private int totalCount;
        private int pendingCount;
        private int inProgressCount;
        private int completedCount;
        private int rejectedCount;

        public int getTotalCount() {
            return totalCount;
        }

        public void setTotalCount(int totalCount) {
            this.totalCount = totalCount;
        }

        public int getPendingCount() {
            return pendingCount;
        }

        public void setPendingCount(int pendingCount) {
            this.pendingCount = pendingCount;
        }

        public int getInProgressCount() {
            return inProgressCount;
        }

        public void setInProgressCount(int inProgressCount) {
            this.inProgressCount = inProgressCount;
        }

        public int getCompletedCount() {
            return completedCount;
        }

        public void setCompletedCount(int completedCount) {
            this.completedCount = completedCount;
        }

        public int getRejectedCount() {
            return rejectedCount;
        }

        public void setRejectedCount(int rejectedCount) {
            this.rejectedCount = rejectedCount;
        }
    }
}