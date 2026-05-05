package com.ams.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.time.LocalDateTime;

/**
 * 资产报废申请驳回数据传输对象
 * 
 * 用于接收报废申请驳回操作的请求参数，包括：
 * - 申请ID（关联待驳回的报废申请）
 * - 驳回原因（必填，记录驳回依据）
 * - 驳回时间（系统自动生成）
 * 
 * @author AMS Team
 * @version 1.0
 * @since Iteration-4
 */
public class RetirementRejectDTO {

    /**
     * 报废申请ID
     * 关联 RetirementApplication 实体
     */
    @NotNull(message = "申请ID不能为空")
    @JsonProperty("application_id")
    private Long applicationId;

    /**
     * 驳回原因
     * 记录审批人驳回申请的依据，供申请人参考修改
     */
    @NotBlank(message = "驳回原因不能为空")
    @Size(min = 5, max = 500, message = "驳回原因长度需在5-500字符之间")
    @JsonProperty("reject_reason")
    private String rejectReason;

    /**
     * 驳回人ID
     * 当前执行驳回操作的审批人
     */
    @NotNull(message = "驳回人ID不能为空")
    @JsonProperty("reject_by")
    private Long rejectBy;

    /**
     * 驳回时间
     * 系统自动记录驳回操作的时间戳
     */
    @JsonProperty("reject_at")
    private LocalDateTime rejectAt;

    /**
     * 驳回时资产状态
     * 记录驳回后资产恢复的状态（通常恢复为"可用"）
     */
    @JsonProperty("asset_status")
    private String assetStatus;

    /**
     * 审批节点层级
     * 当前驳回发生在第几级审批
     */
    @JsonProperty("approval_level")
    private Integer approvalLevel;

    /**
     * 驳回备注
     * 可选的额外说明
     */
    @Size(max = 200, message = "驳回备注长度不能超过200字符")
    @JsonProperty("reject_comment")
    private String rejectComment;

    /**
     * 是否通知申请人
     * 标记是否需要发送驳回通知
     */
    @JsonProperty("notify_applicant")
    private Boolean notifyApplicant;

    /**
     * 默认构造函数
     */
    public RetirementRejectDTO() {
        this.rejectAt = LocalDateTime.now();
        this.notifyApplicant = true;
    }

    /**
     * 全参数构造函数
     * 
     * @param applicationId  报废申请ID
     * @param rejectReason  驳回原因
     * @param rejectBy      驳回人ID
     * @param approvalLevel 审批层级
     */
    public RetirementRejectDTO(Long applicationId, String rejectReason, Long rejectBy, Integer approvalLevel) {
        this.applicationId = applicationId;
        this.rejectReason = rejectReason;
        this.rejectBy = rejectBy;
        this.approvalLevel = approvalLevel;
        this.rejectAt = LocalDateTime.now();
        this.notifyApplicant = true;
    }

    // Getter and Setter methods

    /**
     * 获取报废申请ID
     * @return 申请ID
     */
    public Long getApplicationId() {
        return applicationId;
    }

    /**
     * 设置报废申请ID
     * @param applicationId 申请ID
     */
    public void setApplicationId(Long applicationId) {
        this.applicationId = applicationId;
    }

    /**
     * 获取驳回原因
     * @return 驳回原因
     */
    public String getRejectReason() {
        return rejectReason;
    }

    /**
     * 设置驳回原因
     * @param rejectReason 驳回原因
     */
    public void setRejectReason(String rejectReason) {
        this.rejectReason = rejectReason;
    }

    /**
     * 获取驳回人ID
     * @return 驳回人ID
     */
    public Long getRejectBy() {
        return rejectBy;
    }

    /**
     * 设置驳回人ID
     * @param rejectBy 驳回人ID
     */
    public void setRejectBy(Long rejectBy) {
        this.rejectBy = rejectBy;
    }

    /**
     * 获取驳回时间
     * @return 驳回时间
     */
    public LocalDateTime getRejectAt() {
        return rejectAt;
    }

    /**
     * 设置驳回时间
     * @param rejectAt 驳回时间
     */
    public void setRejectAt(LocalDateTime rejectAt) {
        this.rejectAt = rejectAt;
    }

    /**
     * 获取资产状态
     * @return 资产状态
     */
    public String getAssetStatus() {
        return assetStatus;
    }

    /**
     * 设置资产状态
     * @param assetStatus 资产状态
     */
    public void setAssetStatus(String assetStatus) {
        this.assetStatus = assetStatus;
    }

    /**
     * 获取审批层级
     * @return 审批层级
     */
    public Integer getApprovalLevel() {
        return approvalLevel;
    }

    /**
     * 设置审批层级
     * @param approvalLevel 审批层级
     */
    public void setApprovalLevel(Integer approvalLevel) {
        this.approvalLevel = approvalLevel;
    }

    /**
     * 获取驳回备注
     * @return 驳回备注
     */
    public String getRejectComment() {
        return rejectComment;
    }

    /**
     * 设置驳回备注
     * @param rejectComment 驳回备注
     */
    public void setRejectComment(String rejectComment) {
        this.rejectComment = rejectComment;
    }

    /**
     * 获取是否通知申请人标识
     * @return 是否通知
     */
    public Boolean getNotifyApplicant() {
        return notifyApplicant;
    }

    /**
     * 设置是否通知申请人标识
     * @param notifyApplicant 是否通知
     */
    public void setNotifyApplicant(Boolean notifyApplicant) {
        this.notifyApplicant = notifyApplicant;
    }

    /**
     * 构建用于历史记录的数据结构
     * 用于生成 LifecycleHistory 或 RetirementHistory 记录
     * 
     * @return 历史事件数据映射
     */
    public java.util.Map<String, Object> toHistoryRecord() {
        java.util.Map<String, Object> record = new java.util.HashMap<>();
        record.put("application_id", this.applicationId);
        record.put("event_type", "RETIREMENT_REJECTED");
        record.put("reject_reason", this.rejectReason);
        record.put("reject_by", this.rejectBy);
        record.put("reject_at", this.rejectAt);
        record.put("approval_level", this.approvalLevel);
        record.put("reject_comment", this.rejectComment);
        record.put("asset_status", this.assetStatus);
        return record;
    }

    @Override
    public String toString() {
        return "RetirementRejectDTO{" +
                "applicationId=" + applicationId +
                ", rejectReason='" + rejectReason + '\'' +
                ", rejectBy=" + rejectBy +
                ", rejectAt=" + rejectAt +
                ", assetStatus='" + assetStatus + '\'' +
                ", approvalLevel=" + approvalLevel +
                ", rejectComment='" + rejectComment + '\'' +
                ", notifyApplicant=" + notifyApplicant +
                '}';
    }
}