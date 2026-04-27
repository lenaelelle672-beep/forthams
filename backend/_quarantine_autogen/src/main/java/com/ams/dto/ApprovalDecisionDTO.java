package com.ams.dto;

import java.time.LocalDateTime;

/**
 * 审批决策数据传输对象
 * 
 * 用于在审批流程中传递审批决策信息
 * 
 * 业务价值评估：中等价值
 * - 提供了审批决策的基本数据结构
 * - 包含审批人、决策类型、审批时间等核心字段
 * - 可能需要根据实际业务需求补充更多字段
 * 
 * @author forthAMS Builder
 * @since 2026-04-22
 */
public class ApprovalDecisionDTO {
    
    private Long approvalId;
    private Long approverId;
    private String approverName;
    private String decisionType;  // APPROVE, REJECT, RETURN
    private LocalDateTime decisionTime;
    private String comments;
    private String attachmentUrls;
    
    // Constructors
    public ApprovalDecisionDTO() {
    }
    
    public ApprovalDecisionDTO(Long approvalId, Long approverId, String decisionType) {
        this.approvalId = approvalId;
        this.approverId = approverId;
        this.decisionType = decisionType;
        this.decisionTime = LocalDateTime.now();
    }
    
    // Getters and Setters
    public Long getApprovalId() {
        return approvalId;
    }
    
    public void setApprovalId(Long approvalId) {
        this.approvalId = approvalId;
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
    
    public String getDecisionType() {
        return decisionType;
    }
    
    public void setDecisionType(String decisionType) {
        this.decisionType = decisionType;
    }
    
    public LocalDateTime getDecisionTime() {
        return decisionTime;
    }
    
    public void setDecisionTime(LocalDateTime decisionTime) {
        this.decisionTime = decisionTime;
    }
    
    public String getComments() {
        return comments;
    }
    
    public void setComments(String comments) {
        this.comments = comments;
    }
    
    public String getAttachmentUrls() {
        return attachmentUrls;
    }
    
    public void setAttachmentUrls(String attachmentUrls) {
        this.attachmentUrls = attachmentUrls;
    }
    
    /**
     * 验证审批决策是否有效
     * 
     * @return true if valid, false otherwise
     */
    public boolean isValid() {
        return approvalId != null && approverId != null 
            && decisionType != null && !decisionType.isEmpty();
    }
    
    @Override
    public String toString() {
        return "ApprovalDecisionDTO{" +
                "approvalId=" + approvalId +
                ", approverId=" + approverId +
                ", approverName='" + approverName + '\'' +
                ", decisionType='" + decisionType + '\'' +
                ", decisionTime=" + decisionTime +
                '}';
    }
}