/**
 * RetirementApplicationDTO
 * 
 * 退役/报废申请数据传输对象
 * 
 * 业务域: 固定资产退役审批流程 (Approval Workflow)
 * 关联实体: RetirementApplication, RetirementRequest, ApprovalProcess
 * 
 * @author forthAMS Codex
 * @since 2026-04-22
 */
package com.ams.dto;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

/**
 * 退役申请DTO
 * 
 * 用于前后端数据传输，包含申请信息、资产信息及审批状态
 */
public class RetirementApplicationDTO {
    
    // ==================== 主键与标识 ====================
    /** 申请ID */
    private Long id;
    
    /** 关联审批流程ID */
    private Long approvalProcessId;
    
    // ==================== 资产信息 ====================
    /** 资产ID */
    private Long assetId;
    
    /** 资产编号 */
    private String assetCode;
    
    /** 资产名称 */
    private String assetName;
    
    /** 资产类别 */
    private String assetCategory;
    
    /** 资产原值 */
    private BigDecimal originalValue;
    
    /** 资产净值（当前值） */
    private BigDecimal netValue;
    
    /** 累计折旧 */
    private BigDecimal accumulatedDepreciation;
    
    // ==================== 申请人信息 ====================
    /** 申请人ID */
    private Long applicantId;
    
    /** 申请人姓名 */
    private String applicantName;
    
    /** 申请人部门ID */
    private Long departmentId;
    
    /** 申请人部门名称 */
    private String departmentName;
    
    // ==================== 申请详情 ====================
    /** 申请日期 */
    private LocalDate applicationDate;
    
    /** 预计退役日期 */
    private LocalDate plannedRetirementDate;
    
    /** 实际退役日期 */
    private LocalDate actualRetirementDate;
    
    /** 退役原因 */
    private String retirementReason;
    
    /** 退役原因类型: OBSOLETE(淘汰), DAMAGED(损坏), TRANSFERRED(调拨), OTHER(其他) */
    private String retirementType;
    
    /** 详细说明 */
    private String description;
    
    // ==================== 审批状态 ====================
    /** 审批状态: PENDING(待审批), APPROVED(已批准), REJECTED(已拒绝), CANCELLED(已取消) */
    private String approvalStatus;
    
    /** 当前审批节点ID */
    private Long currentApprovalNodeId;
    
    /** 当前审批节点名称 */
    private String currentApprovalNodeName;
    
    /** 当前审批人ID */
    private Long currentApproverId;
    
    /** 当前审批人姓名 */
    private String currentApproverName;
    
    /** 审批意见 */
    private String approvalComment;
    
    /** 审批时间 */
    private LocalDateTime approvalTime;
    
    // ==================== 审计字段 ====================
    /** 创建时间 */
    private LocalDateTime createTime;
    
    /** 更新时间 */
    private LocalDateTime updateTime;
    
    /** 创建人 */
    private String createBy;
    
    /** 更新人 */
    private String updateBy;
    
    // ==================== 附件与备注 ====================
    /** 附件URL列表 (JSON数组) */
    private String attachments;
    
    /** 备注 */
    private String remark;
    
    // ==================== 业务扩展字段 ====================
    /** 预估残值 */
    private BigDecimal estimatedResidualValue;
    
    /** 处理方式: SCRAP(报废), TRANSFER(调拨), AUCTION(拍卖), OTHER(其他) */
    private String disposalMethod;
    
    /** 是否紧急 (0:否, 1:是) */
    private Integer urgent;
    
    // ==================== Getters and Setters ====================
    
    public Long getId() {
        return id;
    }
    
    public void setId(Long id) {
        this.id = id;
    }
    
    public Long getApprovalProcessId() {
        return approvalProcessId;
    }
    
    public void setApprovalProcessId(Long approvalProcessId) {
        this.approvalProcessId = approvalProcessId;
    }
    
    public Long getAssetId() {
        return assetId;
    }
    
    public void setAssetId(Long assetId) {
        this.assetId = assetId;
    }
    
    public String getAssetCode() {
        return assetCode;
    }
    
    public void setAssetCode(String assetCode) {
        this.assetCode = assetCode;
    }
    
    public String getAssetName() {
        return assetName;
    }
    
    public void setAssetName(String assetName) {
        this.assetName = assetName;
    }
    
    public String getAssetCategory() {
        return assetCategory;
    }
    
    public void setAssetCategory(String assetCategory) {
        this.assetCategory = assetCategory;
    }
    
    public BigDecimal getOriginalValue() {
        return originalValue;
    }
    
    public void setOriginalValue(BigDecimal originalValue) {
        this.originalValue = originalValue;
    }
    
    public BigDecimal getNetValue() {
        return netValue;
    }
    
    public void setNetValue(BigDecimal netValue) {
        this.netValue = netValue;
    }
    
    public BigDecimal getAccumulatedDepreciation() {
        return accumulatedDepreciation;
    }
    
    public void setAccumulatedDepreciation(BigDecimal accumulatedDepreciation) {
        this.accumulatedDepreciation = accumulatedDepreciation;
    }
    
    public Long getApplicantId() {
        return applicantId;
    }
    
    public void setApplicantId(Long applicantId) {
        this.applicantId = applicantId;
    }
    
    public String getApplicantName() {
        return applicantName;
    }
    
    public void setApplicantName(String applicantName) {
        this.applicantName = applicantName;
    }
    
    public Long getDepartmentId() {
        return departmentId;
    }
    
    public void setDepartmentId(Long departmentId) {
        this.departmentId = departmentId;
    }
    
    public String getDepartmentName() {
        return departmentName;
    }
    
    public void setDepartmentName(String departmentName) {
        this.departmentName = departmentName;
    }
    
    public LocalDate getApplicationDate() {
        return applicationDate;
    }
    
    public void setApplicationDate(LocalDate applicationDate) {
        this.applicationDate = applicationDate;
    }
    
    public LocalDate getPlannedRetirementDate() {
        return plannedRetirementDate;
    }
    
    public void setPlannedRetirementDate(LocalDate plannedRetirementDate) {
        this.plannedRetirementDate = plannedRetirementDate;
    }
    
    public LocalDate getActualRetirementDate() {
        return actualRetirementDate;
    }
    
    public void setActualRetirementDate(LocalDate actualRetirementDate) {
        this.actualRetirementDate = actualRetirementDate;
    }
    
    public String getRetirementReason() {
        return retirementReason;
    }
    
    public void setRetirementReason(String retirementReason) {
        this.retirementReason = retirementReason;
    }
    
    public String getRetirementType() {
        return retirementType;
    }
    
    public void setRetirementType(String retirementType) {
        this.retirementType = retirementType;
    }
    
    public String getDescription() {
        return description;
    }
    
    public void setDescription(String description) {
        this.description = description;
    }
    
    public String getApprovalStatus() {
        return approvalStatus;
    }
    
    public void setApprovalStatus(String approvalStatus) {
        this.approvalStatus = approvalStatus;
    }
    
    public Long getCurrentApprovalNodeId() {
        return currentApprovalNodeId;
    }
    
    public void setCurrentApprovalNodeId(Long currentApprovalNodeId) {
        this.currentApprovalNodeId = currentApprovalNodeId;
    }
    
    public String getCurrentApprovalNodeName() {
        return currentApprovalNodeName;
    }
    
    public void setCurrentApprovalNodeName(String currentApprovalNodeName) {
        this.currentApprovalNodeName = currentApprovalNodeName;
    }
    
    public Long getCurrentApproverId() {
        return currentApproverId;
    }
    
    public void setCurrentApproverId(Long currentApproverId) {
        this.currentApproverId = currentApproverId;
    }
    
    public String getCurrentApproverName() {
        return currentApproverName;
    }
    
    public void setCurrentApproverName(String currentApproverName) {
        this.currentApproverName = currentApproverName;
    }
    
    public String getApprovalComment() {
        return approvalComment;
    }
    
    public void setApprovalComment(String approvalComment) {
        this.approvalComment = approvalComment;
    }
    
    public LocalDateTime getApprovalTime() {
        return approvalTime;
    }
    
    public void setApprovalTime(LocalDateTime approvalTime) {
        this.approvalTime = approvalTime;
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
    
    public String getUpdateBy() {
        return updateBy;
    }
    
    public void setUpdateBy(String updateBy) {
        this.updateBy = updateBy;
    }
    
    public String getAttachments() {
        return attachments;
    }
    
    public void setAttachments(String attachments) {
        this.attachments = attachments;
    }
    
    public String getRemark() {
        return remark;
    }
    
    public void setRemark(String remark) {
        this.remark = remark;
    }
    
    public BigDecimal getEstimatedResidualValue() {
        return estimatedResidualValue;
    }
    
    public void setEstimatedResidualValue(BigDecimal estimatedResidualValue) {
        this.estimatedResidualValue = estimatedResidualValue;
    }
    
    public String getDisposalMethod() {
        return disposalMethod;
    }
    
    public void setDisposalMethod(String disposalMethod) {
        this.disposalMethod = disposalMethod;
    }
    
    public Integer getUrgent() {
        return urgent;
    }
    
    public void setUrgent(Integer urgent) {
        this.urgent = urgent;
    }
}