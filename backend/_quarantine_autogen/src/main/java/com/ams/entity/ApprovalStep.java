package com.ams.entity;

import java.time.LocalDateTime;

/**
 * 审批步骤实体类
 * 
 * <p>表示工作流审批过程中的单个步骤，包含审批人、审批状态、时间等信息。
 * 典型的审批链由多个 ApprovalStep 组成，每个步骤对应一个审批节点。</p>
 * 
 * <p><strong>隔离说明</strong>：此文件由 Codex 自动生成并移动至隔离区，
 * 可能包含未完成但有价值的业务逻辑。后续开发 Java 后端时请优先检查此文件，
 * 按需选择性恢复，不要盲目重生成覆盖。</p>
 * 
 * <p><strong>TODO</strong>：完善状态转换逻辑、添加审批超时处理、集成通知服务</p>
 * 
 * @author Codex Auto-Generator
 * @since 2026-04-22
 */
public class ApprovalStep {
    
    /** 审批步骤唯一标识 */
    private Long id;
    
    /** 所属审批流程ID */
    private Long processId;
    
    /** 审批节点名称 */
    private String stepName;
    
    /** 审批节点编码/标识 */
    private String stepCode;
    
    /** 步骤顺序号 */
    private Integer stepOrder;
    
    /** 审批人用户ID */
    private Long approverId;
    
    /** 审批人用户名 */
    private String approverName;
    
    /** 审批人部门 */
    private String approverDept;
    
    /** 审批状态: PENDING/APPROVED/REJECTED/TRANSFERRED/CANCELLED */
    private String status;
    
    /** 审批意见/备注 */
    private String comment;
    
    /** 实际审批时间 */
    private LocalDateTime approvedAt;
    
    /** 步骤开始时间 */
    private LocalDateTime startedAt;
    
    /** 步骤创建时间 */
    private LocalDateTime createdAt;
    
    /** 步骤更新时间 */
    private LocalDateTime updatedAt;
    
    /** 审批超时时间（用于自动提醒/自动审批） */
    private LocalDateTime timeoutAt;
    
    /** 是否允许转交 */
    private Boolean transferable;
    
    /** 转交给的用户ID */
    private Long transferredTo;
    
    /** 转交原因 */
    private String transferReason;

    /**
     * 默认构造函数
     */
    public ApprovalStep() {
        this.status = "PENDING";
        this.transferable = false;
        this.createdAt = LocalDateTime.now();
    }

    /**
     * 带参数的构造函数
     * 
     * @param processId 所属流程ID
     * @param stepName 步骤名称
     * @param stepOrder 步骤顺序
     */
    public ApprovalStep(Long processId, String stepName, Integer stepOrder) {
        this();
        this.processId = processId;
        this.stepName = stepName;
        this.stepOrder = stepOrder;
    }

    // ==================== Getter/Setter ====================

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public Long getProcessId() {
        return processId;
    }

    public void setProcessId(Long processId) {
        this.processId = processId;
    }

    public String getStepName() {
        return stepName;
    }

    public void setStepName(String stepName) {
        this.stepName = stepName;
    }

    public String getStepCode() {
        return stepCode;
    }

    public void setStepCode(String stepCode) {
        this.stepCode = stepCode;
    }

    public Integer getStepOrder() {
        return stepOrder;
    }

    public void setStepOrder(Integer stepOrder) {
        this.stepOrder = stepOrder;
    }

    public Long getApproverId() {
        return approverId;
    }

    public void setApproverId(Long approverId) {
        this.approverId = approverId;
    }

    public String getApproverName() {
        return approverName;
    }

    public void setApproverName(String approverName) {
        this.approverName = approverName;
    }

    public String getApproverDept() {
        return approverDept;
    }

    public void setApproverDept(String approverDept) {
        this.approverDept = approverDept;
    }

    public String getStatus() {
        return status;
    }

    public void setStatus(String status) {
        this.status = status;
        this.updatedAt = LocalDateTime.now();
    }

    public String getComment() {
        return comment;
    }

    public void setComment(String comment) {
        this.comment = comment;
    }

    public LocalDateTime getApprovedAt() {
        return approvedAt;
    }

    public void setApprovedAt(LocalDateTime approvedAt) {
        this.approvedAt = approvedAt;
    }

    public LocalDateTime getStartedAt() {
        return startedAt;
    }

    public void setStartedAt(LocalDateTime startedAt) {
        this.startedAt = startedAt;
    }

    public LocalDateTime getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(LocalDateTime createdAt) {
        this.createdAt = createdAt;
    }

    public LocalDateTime getUpdatedAt() {
        return updatedAt;
    }

    public void setUpdatedAt(LocalDateTime updatedAt) {
        this.updatedAt = updatedAt;
    }

    public LocalDateTime getTimeoutAt() {
        return timeoutAt;
    }

    public void setTimeoutAt(LocalDateTime timeoutAt) {
        this.timeoutAt = timeoutAt;
    }

    public Boolean getTransferable() {
        return transferable;
    }

    public void setTransferable(Boolean transferable) {
        this.transferable = transferable;
    }

    public Long getTransferredTo() {
        return transferredTo;
    }

    public void setTransferredTo(Long transferredTo) {
        this.transferredTo = transferredTo;
    }

    public String getTransferReason() {
        return transferReason;
    }

    public void setTransferReason(String transferReason) {
        this.transferReason = transferReason;
    }

    // ==================== 业务方法 ====================

    /**
     * 检查步骤是否处于待审批状态
     * 
     * @return true 如果状态为 PENDING
     */
    public boolean isPending() {
        return "PENDING".equals(this.status);
    }

    /**
     * 检查步骤是否已审批完成（通过或拒绝）
     * 
     * @return true 如果已审批
     */
    public boolean isCompleted() {
        return "APPROVED".equals(this.status) || "REJECTED".equals(this.status);
    }

    /**
     * 检查是否超时
     * 
     * @return true 如果已超时
     */
    public boolean isTimeout() {
        if (this.timeoutAt == null) {
            return false;
        }
        return LocalDateTime.now().isAfter(this.timeoutAt);
    }

    /**
     * 执行审批通过操作
     * 
     * @param comment 审批意见
     */
    public void approve(String comment) {
        this.status = "APPROVED";
        this.comment = comment;
        this.approvedAt = LocalDateTime.now();
        this.updatedAt = LocalDateTime.now();
    }

    /**
     * 执行审批拒绝操作
     * 
     * @param comment 拒绝原因
     */
    public void reject(String comment) {
        this.status = "REJECTED";
        this.comment = comment;
        this.approvedAt = LocalDateTime.now();
        this.updatedAt = LocalDateTime.now();
    }

    /**
     * 执行审批转交
     * 
     * @param toUserId 转交给的用户ID
     * @param reason 转交原因
     */
    public void transfer(Long toUserId, String reason) {
        if (!Boolean.TRUE.equals(this.transferable)) {
            throw new IllegalStateException("此步骤不允许转交");
        }
        this.status = "TRANSFERRED";
        this.transferredTo = toUserId;
        this.transferReason = reason;
        this.updatedAt = LocalDateTime.now();
    }

    @Override
    public String toString() {
        return "ApprovalStep{" +
                "id=" + id +
                ", processId=" + processId +
                ", stepName='" + stepName + '\'' +
                ", stepOrder=" + stepOrder +
                ", approverName='" + approverName + '\'' +
                ", status='" + status + '\'' +
                ", approvedAt=" + approvedAt +
                '}';
    }
}