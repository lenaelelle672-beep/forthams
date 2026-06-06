package com.ams.event;

import java.time.LocalDateTime;

/**
 * 通用审批流程事件，在审批操作完成后发布。
 * <p>
 * 包含审批流程的核心上下文，供监听器创建待办和分发通知。
 * 本事件已承载业务数据字段（businessData），监听器无需额外数据库查询即可获取条件分支评估上下文。
 * <p>
 * 事件在事务内发布，监听器通过 {@code @TransactionalEventListener(phase = AFTER_COMMIT)}
 * 在事务提交后异步消费，确保不影响审批主事务。
 *
 * @see com.ams.service.ApprovalService
 */
public class ApprovalProcessEvent {

    private final Long processId;
    private final String processNo;
    private final String processType;
    private final Integer currentStep;
    private final Integer finalStep;
    private final String result;          // APPROVED / REJECTED / CANCELLED / SUBMITTED
    private final Long approverId;
    private final String approverName;
    private final Long applicantId;
    private final String businessData;
    private final String tenantId;
    private final LocalDateTime timestamp;
    /** 抄送角色编码列表，逗号分隔 */
    private final String ccRoleCodes;
    /** 抄送用户 ID 列表，逗号分隔 */
    private final String ccUserIds;
    /** 通知渠道配置 JSON 数组, 取值 in_app/email/dingtalk/wechat/webhook */
    private final String notifyChannels;

    /**
     * 15 参数全量构造函数。
     */
    public ApprovalProcessEvent(Long processId, String processNo, String processType,
                                Integer currentStep, Integer finalStep, String result,
                                Long approverId, String approverName, Long applicantId,
                                String businessData, String tenantId, LocalDateTime timestamp,
                                String ccRoleCodes, String ccUserIds, String notifyChannels) {
        this.processId = processId;
        this.processNo = processNo;
        this.processType = processType;
        this.currentStep = currentStep;
        this.finalStep = finalStep;
        this.result = result;
        this.approverId = approverId;
        this.approverName = approverName;
        this.applicantId = applicantId;
        this.businessData = businessData;
        this.tenantId = tenantId;
        this.timestamp = timestamp;
        this.ccRoleCodes = ccRoleCodes != null ? ccRoleCodes : "";
        this.ccUserIds = ccUserIds != null ? ccUserIds : "";
        this.notifyChannels = notifyChannels != null ? notifyChannels : "";
    }

    /**
     * 14 参数构造函数（带 CC 角色和用户，无 notifyChannels）。
     * <p>notifyChannels 默认空串。</p>
     */
    public ApprovalProcessEvent(Long processId, String processNo, String processType,
                                Integer currentStep, Integer finalStep, String result,
                                Long approverId, String approverName, Long applicantId,
                                String businessData, String tenantId, LocalDateTime timestamp,
                                String ccRoleCodes, String ccUserIds) {
        this(processId, processNo, processType, currentStep, finalStep, result,
                approverId, approverName, applicantId, businessData, tenantId, timestamp,
                ccRoleCodes, ccUserIds, "");
    }

    /**
     * 12 参数构造函数（无 CC 信息，兼容现有调用方）。
     * <p>ccRoleCodes、ccUserIds 和 notifyChannels 默认空串。</p>
     */
    public ApprovalProcessEvent(Long processId, String processNo, String processType,
                                Integer currentStep, Integer finalStep, String result,
                                Long approverId, String approverName, Long applicantId,
                                String businessData, String tenantId, LocalDateTime timestamp) {
        this(processId, processNo, processType, currentStep, finalStep, result,
                approverId, approverName, applicantId, businessData, tenantId, timestamp,
                null, null, null);
    }

    // --- getters ---

    public Long getProcessId() { return processId; }

    public String getProcessNo() { return processNo; }

    public String getProcessType() { return processType; }

    public Integer getCurrentStep() { return currentStep; }

    public Integer getFinalStep() { return finalStep; }

    public String getResult() { return result; }

    public Long getApproverId() { return approverId; }

    public String getApproverName() { return approverName; }

    public Long getApplicantId() { return applicantId; }

    public String getBusinessData() { return businessData; }

    public String getTenantId() { return tenantId; }

    public LocalDateTime getTimestamp() { return timestamp; }

    public String getCcRoleCodes() { return ccRoleCodes; }

    public String getCcUserIds() { return ccUserIds; }

    public String getNotifyChannels() { return notifyChannels; }

    // --- convenience methods ---

    public boolean isApproved() {
        return "APPROVED".equals(result);
    }

    public boolean isRejected() {
        return "REJECTED".equals(result);
    }

    public boolean isCancelled() {
        return "CANCELLED".equals(result);
    }

    public boolean isSubmitted() {
        return "SUBMITTED".equals(result);
    }

    public boolean isFinalStep() {
        return currentStep != null && finalStep != null && currentStep >= finalStep;
    }

    /**
     * 返回审批事件的人类可读描述。
     *
     * @return 描述字符串
     */
    public String getDescription() {
        if (isSubmitted()) {
            return String.format("审批流程【%s】已提交", processNo);
        }
        if (isRejected()) {
            return String.format("审批流程【%s】已被驳回（步骤 %d/%d）",
                    processNo, currentStep, finalStep);
        }
        if (isCancelled()) {
            return String.format("审批流程【%s】已取消", processNo);
        }
        return String.format("审批流程【%s】已通过（步骤 %d/%d）",
                processNo, currentStep, finalStep);
    }

    @Override
    public String toString() {
        return "ApprovalProcessEvent{" +
                "processId=" + processId +
                ", processNo='" + processNo + '\'' +
                ", processType='" + processType + '\'' +
                ", currentStep=" + currentStep +
                ", finalStep=" + finalStep +
                ", result='" + result + '\'' +
                ", approverId=" + approverId +
                ", approverName='" + approverName + '\'' +
                ", applicantId=" + applicantId +
                ", businessData='" + businessData + '\'' +
                ", tenantId='" + tenantId + '\'' +
                ", timestamp=" + timestamp +
                ", ccRoleCodes='" + ccRoleCodes + '\'' +
                ", ccUserIds='" + ccUserIds + '\'' +
                ", notifyChannels='" + notifyChannels + '\'' +
                '}';
    }
}
