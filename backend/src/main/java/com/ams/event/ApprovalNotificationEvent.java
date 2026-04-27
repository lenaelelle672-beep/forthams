package com.ams.event;

import java.time.LocalDateTime;
import java.util.Objects;

/**
 * Application event published when an approval decision is made on a work order.
 * <p>
 * This event is published by {@code ApprovalService} after a successful approval
 * or rejection action on a work order. It is consumed asynchronously by
 * {@code ApprovalNotificationListener} to generate in-app notification records,
 * ensuring that notification delivery does not block the main approval transaction.
 * <p>
 * Supported state transitions that trigger this event:
 * <ul>
 *   <li>{@code APPROVING_LEVEL_1 → APPROVING_LEVEL_2} (L1 approve)</li>
 *   <li>{@code APPROVING_LEVEL_2 → APPROVED} (L2 approve)</li>
 *   <li>{@code APPROVING_LEVEL_1 → REJECTED} (L1 reject)</li>
 *   <li>{@code APPROVING_LEVEL_2 → REJECTED} (L2 reject)</li>
 * </ul>
 *
 * @see com.ams.service.ApprovalService
 * @see com.ams.enums.OrderStatus
 */
public class ApprovalNotificationEvent {

    /** ID of the work order that was acted upon. */
    private final Long workOrderId;

    /** Title of the work order, used for notification display. */
    private final String workOrderTitle;

    /** ID of the user who performed the approval action. */
    private final Long approverId;

    /** Display name of the approver, used for notification content. */
    private final String approverName;

    /** The approval action taken (APPROVE or REJECT). */
    private final ApprovalAction action;

    /** The approval level at which the action was taken (LEVEL_1 or LEVEL_2). */
    private final ApprovalLevel approvalLevel;

    /**
     * Rejection reason provided when the action is REJECT.
     * Must be non-null and at least 10 characters when action is REJECT;
     * may be {@code null} when action is APPROVE.
     */
    private final String rejectionReason;

    /** The status of the work order after the approval action was applied. */
    private final String targetStatus;

    /** The timestamp when the approval action occurred. */
    private final LocalDateTime timestamp;

    /**
     * Enumeration of possible approval actions.
     */
    public enum ApprovalAction {
        /** The work order passes to the next approval level or is fully approved. */
        APPROVE,
        /** The work order is rejected; a mandatory rejection reason is required. */
        REJECT
    }

    /**
     * Enumeration of approval levels in the dual-level approval chain.
     * <p>
     * LEVEL_1 corresponds to the department supervisor role;
     * LEVEL_2 corresponds to the asset administrator role.
     */
    public enum ApprovalLevel {
        /** Level 1 — department supervisor approval node. */
        LEVEL_1,
        /** Level 2 — asset administrator approval node. */
        LEVEL_2
    }

    /**
     * Constructs a new {@code ApprovalNotificationEvent} with all required context.
     *
     * @param workOrderId     the ID of the work order that was acted upon; must not be null
     * @param workOrderTitle  the title of the work order for notification display; must not be null
     * @param approverId      the ID of the user who performed the approval action; must not be null
     * @param approverName    the display name of the approver; must not be null
     * @param action          the approval action taken; must not be null
     * @param approvalLevel   the approval level at which the action was taken; must not be null
     * @param rejectionReason the rejection reason; required when action is REJECT (non-null, length &gt;= 10),
     *                        may be null when action is APPROVE
     * @param targetStatus    the work order status after the action; must not be null
     * @param timestamp       the timestamp of the approval action; must not be null
     * @throws IllegalArgumentException if any required parameter is null, or if
     *                                  rejectionReason is invalid for a REJECT action
     */
    public ApprovalNotificationEvent(
            Long workOrderId,
            String workOrderTitle,
            Long approverId,
            String approverName,
            ApprovalAction action,
            ApprovalLevel approvalLevel,
            String rejectionReason,
            String targetStatus,
            LocalDateTime timestamp) {
        this.workOrderId = Objects.requireNonNull(workOrderId, "workOrderId must not be null");
        this.workOrderTitle = Objects.requireNonNull(workOrderTitle, "workOrderTitle must not be null");
        this.approverId = Objects.requireNonNull(approverId, "approverId must not be null");
        this.approverName = Objects.requireNonNull(approverName, "approverName must not be null");
        this.action = Objects.requireNonNull(action, "action must not be null");
        this.approvalLevel = Objects.requireNonNull(approvalLevel, "approvalLevel must not be null");
        this.targetStatus = Objects.requireNonNull(targetStatus, "targetStatus must not be null");
        this.timestamp = Objects.requireNonNull(timestamp, "timestamp must not be null");

        if (action == ApprovalAction.REJECT) {
            if (rejectionReason == null || rejectionReason.length() < 10) {
                throw new IllegalArgumentException(
                        "rejectionReason is required for REJECT action and must be at least 10 characters");
            }
        }
        this.rejectionReason = rejectionReason;
    }

    /**
     * Returns the ID of the work order that was acted upon.
     *
     * @return the work order ID
     */
    public Long getWorkOrderId() {
        return workOrderId;
    }

    /**
     * Returns the title of the work order for notification display.
     *
     * @return the work order title
     */
    public String getWorkOrderTitle() {
        return workOrderTitle;
    }

    /**
     * Returns the ID of the user who performed the approval action.
     *
     * @return the approver user ID
     */
    public Long getApproverId() {
        return approverId;
    }

    /**
     * Returns the display name of the approver.
     *
     * @return the approver name
     */
    public String getApproverName() {
        return approverName;
    }

    /**
     * Returns the approval action taken.
     *
     * @return the approval action
     */
    public ApprovalAction getAction() {
        return action;
    }

    /**
     * Returns the approval level at which the action was taken.
     *
     * @return the approval level
     */
    public ApprovalLevel getApprovalLevel() {
        return approvalLevel;
    }

    /**
     * Returns the rejection reason.
     * <p>
     * This field is required (non-null, length &gt;= 10) when the action is REJECT,
     * and may be {@code null} when the action is APPROVE.
     *
     * @return the rejection reason, or null if the action is APPROVE
     */
    public String getRejectionReason() {
        return rejectionReason;
    }

    /**
     * Returns the work order status after the approval action was applied.
     *
     * @return the target status string
     */
    public String getTargetStatus() {
        return targetStatus;
    }

    /**
     * Returns the timestamp when the approval action occurred.
     *
     * @return the action timestamp
     */
    public LocalDateTime getTimestamp() {
        return timestamp;
    }

    /**
     * Checks whether this event represents a rejection action.
     *
     * @return {@code true} if the action is REJECT, {@code false} otherwise
     */
    public boolean isRejection() {
        return action == ApprovalAction.REJECT;
    }

    /**
     * Checks whether this event represents an approval action.
     *
     * @return {@code true} if the action is APPROVE, {@code false} otherwise
     */
    public boolean isApproval() {
        return action == ApprovalAction.APPROVE;
    }

    /**
     * Returns a human-readable description of the approval action for notification content.
     *
     * @return a descriptive string summarizing the event
     */
    public String getDescription() {
        if (isRejection()) {
            return String.format("工单[%s]在%s审批节点被%s驳回，原因：%s",
                    workOrderTitle,
                    approvalLevel == ApprovalLevel.LEVEL_1 ? "部门主管" : "资产管理员",
                    approverName,
                    rejectionReason);
        }
        return String.format("工单[%s]在%s审批节点被%s通过，状态变更为%s",
                workOrderTitle,
                approvalLevel == ApprovalLevel.LEVEL_1 ? "部门主管" : "资产管理员",
                approverName,
                targetStatus);
    }

    @Override
    public String toString() {
        return "ApprovalNotificationEvent{" +
                "workOrderId=" + workOrderId +
                ", workOrderTitle='" + workOrderTitle + '\'' +
                ", approverId=" + approverId +
                ", approverName='" + approverName + '\'' +
                ", action=" + action +
                ", approvalLevel=" + approvalLevel +
                ", rejectionReason='" + rejectionReason + '\'' +
                ", targetStatus='" + targetStatus + '\'' +
                ", timestamp=" + timestamp +
                '}';
    }
}