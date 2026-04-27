package com.ams.entity;

import com.baomidou.mybatisplus.annotation.*;
import java.time.LocalDateTime;

/**
 * 退休申请实体类
 * 
 * <p>隔离区文件 - 包含未完成但有价值的业务工作
 * 
 * <p>所属模块: forthAMS 退休(Retirement)审批流系统
 * <p>关联模块: approval_service.py, retirement_service.py, asset_validator.py
 * 
 * <p>业务域: 资产管理系统 - 退休申请审批流程
 * 
 * @author forthAMS Builder
 * @since 2026-04-22 (隔离)
 */
@Entity
@TableName("retirement_application")
public class RetirementApplication {
    
    /**
     * 主键ID
     */
    @TableId(type = IdType.AUTO)
    private Long id;
    
    /**
     * 退休申请编号 (对应业务标识)
     */
    private Long retirementId;
    
    /**
     * 申请人用户名
     */
    private String applicantName;
    
    /**
     * 申请人ID
     */
    private Long applicantId;
    
    /**
     * 资产ID
     */
    private Long assetId;
    
    /**
     * 资产名称
     */
    private String assetName;
    
    /**
     * 退休申请原因
     */
    private String reason;
    
    /**
     * 申请日期
     */
    private LocalDateTime applyDate;
    
    /**
     * 处理截止日期
     */
    private LocalDateTime deadline;
    
    /**
     * 审批人ID
     */
    private Long approverId;
    
    /**
     * 审批人姓名
     */
    private String approverName;
    
    /**
     * 审批意见
     */
    private String approvalComment;
    
    /**
     * 优先级 (1-高, 2-中, 3-低)
     */
    private Integer priority;
    
    /**
     * 备注信息
     */
    private String remark;
    
    /**
     * 创建时间
     */
    @TableField(fill = FieldFill.INSERT)
    private LocalDateTime createTime;
    
    /**
     * 更新时间
     */
    @TableField(fill = FieldFill.INSERT_UPDATE)
    private LocalDateTime updateTime;
    
    /**
     * 创建人
     */
    private String createBy;
    
    /**
     * 申请状态枚举
     * 
     * 状态流转:
     * PENDING -> APPROVAL_IN_PROGRESS -> APPROVED/REJECTED -> COMPLETED
     */
    public enum RetirementStatus {
        /** 待处理 */
        PENDING,
        /** 审批中 */
        APPROVAL_IN_PROGRESS,
        /** 已批准 */
        APPROVED,
        /** 已拒绝 */
        REJECTED,
        /** 已完成 */
        COMPLETED
    }
    
    /**
     * 当前申请状态
     */
    @TableField("status")
    private RetirementStatus status = RetirementStatus.PENDING;
    
    // Getter and Setter methods
    
    public Long getId() {
        return id;
    }
    
    public void setId(Long id) {
        this.id = id;
    }
    
    public Long getRetirementId() {
        return retirementId;
    }
    
    public void setRetirementId(Long retirementId) {
        this.retirementId = retirementId;
    }
    
    public String getApplicantName() {
        return applicantName;
    }
    
    public void setApplicantName(String applicantName) {
        this.applicantName = applicantName;
    }
    
    public Long getApplicantId() {
        return applicantId;
    }
    
    public void setApplicantId(Long applicantId) {
        this.applicantId = applicantId;
    }
    
    public Long getAssetId() {
        return assetId;
    }
    
    public void setAssetId(Long assetId) {
        this.assetId = assetId;
    }
    
    public String getAssetName() {
        return assetName;
    }
    
    public void setAssetName(String assetName) {
        this.assetName = assetName;
    }
    
    public String getReason() {
        return reason;
    }
    
    public void setReason(String reason) {
        this.reason = reason;
    }
    
    public LocalDateTime getApplyDate() {
        return applyDate;
    }
    
    public void setApplyDate(LocalDateTime applyDate) {
        this.applyDate = applyDate;
    }
    
    public LocalDateTime getDeadline() {
        return deadline;
    }
    
    public void setDeadline(LocalDateTime deadline) {
        this.deadline = deadline;
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
    
    public String getApprovalComment() {
        return approvalComment;
    }
    
    public void setApprovalComment(String approvalComment) {
        this.approvalComment = approvalComment;
    }
    
    public Integer getPriority() {
        return priority;
    }
    
    public void setPriority(Integer priority) {
        this.priority = priority;
    }
    
    public String getRemark() {
        return remark;
    }
    
    public void setRemark(String remark) {
        this.remark = remark;
    }
    
    public LocalDateTime getCreateTime() {
        return createTime;
    }
    
    public void setCreateTime(LocalDateTime createTime) {
        this.createTime = createTime;
    }
    
    public LocalDateTime getUpdateTime() {
        return updateTime;
    }
    
    public void setUpdateTime(LocalDateTime updateTime) {
        this.updateTime = updateTime;
    }
    
    public String getCreateBy() {
        return createBy;
    }
    
    public void setCreateBy(String createBy) {
        this.createBy = createBy;
    }
    
    public RetirementStatus getStatus() {
        return status;
    }
    
    public void setStatus(RetirementStatus status) {
        this.status = status;
    }
    
    /**
     * 检查申请是否处于可审批状态
     * 
     * @return true 如果状态为 PENDING 或 APPROVAL_IN_PROGRESS
     */
    public boolean canBeApproved() {
        return status == RetirementStatus.PENDING || 
               status == RetirementStatus.APPROVAL_IN_PROGRESS;
    }
    
    /**
     * 检查申请是否已完成
     * 
     * @return true 如果状态为 COMPLETED
     */
    public boolean isCompleted() {
        return status == RetirementStatus.COMPLETED;
    }
    
    /**
     * 检查申请是否被拒绝
     * 
     * @return true 如果状态为 REJECTED
     */
    public boolean isRejected() {
        return status == RetirementStatus.REJECTED;
    }
    
    @Override
    public String toString() {
        return "RetirementApplication{" +
                "id=" + id +
                ", retirementId=" + retirementId +
                ", applicantName='" + applicantName + '\'' +
                ", assetId=" + assetId +
                ", status=" + status +
                ", applyDate=" + applyDate +
                '}';
    }
}