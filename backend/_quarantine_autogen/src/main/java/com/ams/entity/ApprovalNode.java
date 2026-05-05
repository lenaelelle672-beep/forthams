package com.ams.entity;

import com.baomidou.mybatisplus.annotation.*;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;
import lombok.Builder;

import java.time.LocalDateTime;

/**
 * 审批节点实体
 * <p>
 * 代表工单审批流程中的单个审批节点，负责记录审批状态、操作类型、
 * 审批人信息及触发通知机制。该实体与状态机流转规则对齐，
 * 支持 DRAFT/PENDING/APPROVED/REJECTED/RETURNED/CANCELLED 状态。
 * </p>
 *
 * <p>状态迁移规则（对应 {@link com.ams.state.WorkOrderState}）：</p>
 * <ul>
 *   <li>DRAFT → PENDING：申请人提交</li>
 *   <li>PENDING → APPROVED：审批人通过</li>
 *   <li>PENDING → REJECTED：审批人驳回</li>
 *   <li>PENDING → RETURNED：审批人退回</li>
 *   <li>RETURNED → PENDING：申请人重新提交</li>
 *   <li>PENDING → CANCELLED：申请人主动撤销</li>
 * </ul>
 *
 * <p>通知触发约束：APPROVED/REJECTED/RETURNED 触发通知投递</p>
 *
 * @see com.ams.state.WorkOrderState
 * @see com.ams.state.WorkOrderStateMachine
 * @since Iteration-7
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
@TableName("approval_node")
public class ApprovalNode {

    /**
     * 主键 ID
     */
    @TableId(type = IdType.AUTO)
    private Long id;

    /**
     * 关联工单 ID
     */
    @TableField("work_order_id")
    private Long workOrderId;

    /**
     * 当前节点状态
     * <p>对应 WorkOrderState 枚举：DRAFT/PENDING/APPROVED/REJECTED/RETURNED/CANCELLED</p>
     */
    @TableField("node_status")
    private String nodeStatus;

    /**
     * 操作类型
     * <p>对应 {@link OperationType}：SUBMIT/APPROVE/REJECT/RETURN/RESUBMIT/CANCEL</p>
     */
    @TableField("operation_type")
    private String operationType;

    /**
     * 审批人/操作人 ID
     */
    @TableField("operator_id")
    private Long operatorId;

    /**
     * 审批人/操作人用户名
     */
    @TableField("operator_name")
    private String operatorName;

    /**
     * 审批意见/备注
     */
    @TableField("comment")
    private String comment;

    /**
     * 节点创建时间
     */
    @TableField("created_at")
    private LocalDateTime createdAt;

    /**
     * 节点更新时间（记录最新审批操作时间）
     */
    @TableField("updated_at")
    private LocalDateTime updatedAt;

    /**
     * 审批通过时间（精确到秒）
     */
    @TableField("approved_at")
    private LocalDateTime approvedAt;

    /**
     * 幂等 Key（sha256(work_order_id + operator_id + operation_type + timestamp // 300s)）
     */
    @TableField("idempotency_key")
    private String idempotencyKey;

    /**
     * 幂等过期时间（TTL = 300s）
     */
    @TableField("idempotency_expires_at")
    private LocalDateTime idempotencyExpiresAt;

    /**
     * 通知是否已发送标记
     */
    @TableField("notification_sent")
    private Boolean notificationSent;

    /**
     * 通知发送时间
     */
    @TableField("notification_sent_at")
    private LocalDateTime notificationSentAt;

    /**
     * 审批阶段序号（用于多级审批场景）
     */
    @TableField("approval_sequence")
    private Integer approvalSequence;

    /**
     * 逻辑删除标记（0=未删除，1=已删除）
     */
    @TableLogic
    @TableField("deleted")
    private Boolean deleted;

    /**
     * 操作类型枚举
     * <p>
     * 定义审批流程中所有允许的操作类型，对应状态机迁移规则。
     * </p>
     */
    public enum OperationType {
        /** 提交工单 */
        SUBMIT,
        /** 通过审批 */
        APPROVE,
        /** 驳回审批 */
        REJECT,
        /** 退回工单 */
        RETURN,
        /** 重新提交 */
        RESUBMIT,
        /** 撤销工单 */
        CANCEL
    }

    /**
     * 状态枚举
     * <p>
     * 对标 {@link com.ams.state.WorkOrderState} 的六种状态。
     * APPROVED/REJECTED/CANCELLED 为终态，不可逆。
     * </p>
     */
    public enum NodeStatus {
        /** 待提交（起草态，仅申请人可编辑） */
        DRAFT,
        /** 待审批（已进入审批队列） */
        PENDING,
        /** 已通过（终态，不可逆） */
        APPROVED,
        /** 已驳回（终态，可重新提交） */
        REJECTED,
        /** 已退回（中间态，申请人可修改后重新提交） */
        RETURNED,
        /** 已撤回（终态，申请人主动撤销） */
        CANCELLED
    }

    /**
     * 校验当前状态是否允许执行指定操作
     * <p>
     * 基于状态迁移规则矩阵进行合法性校验：
     * </p>
     * <ul>
     *   <li>DRAFT 状态仅允许 SUBMIT 操作</li>
     *   <li>PENDING 状态允许 APPROVE/REJECT/RETURN/CANCEL 操作</li>
     *   <li>RETURNED 状态仅允许 RESUBMIT 操作</li>
     *   <li>终态（APPROVED/REJECTED/CANCELLED）不允许任何操作</li>
     * </ul>
     *
     * @param currentStatus 当前状态
     * @param operation    待执行操作
     * @return 是否允许执行
     */
    public static boolean isOperationAllowed(NodeStatus currentStatus, OperationType operation) {
        if (currentStatus == null || operation == null) {
            return false;
        }
        switch (currentStatus) {
            case DRAFT:
                return OperationType.SUBMIT.equals(operation);
            case PENDING:
                return OperationType.APPROVE.equals(operation)
                    || OperationType.REJECT.equals(operation)
                    || OperationType.RETURN.equals(operation)
                    || OperationType.CANCEL.equals(operation);
            case RETURNED:
                return OperationType.RESUBMIT.equals(operation);
            case APPROVED:
            case REJECTED:
            case CANCELLED:
                return false;
            default:
                return false;
        }
    }

    /**
     * 判断当前状态是否为终态
     * <p>
     * 终态包括：APPROVED、REJECTED、CANCELLED
     * 终态不可进行任何状态迁移。
     * </p>
     *
     * @return 是否为终态
     */
    public boolean isTerminal() {
        return NodeStatus.APPROVED.name().equals(nodeStatus)
            || NodeStatus.REJECTED.name().equals(nodeStatus)
            || NodeStatus.CANCELLED.name().equals(nodeStatus);
    }

    /**
     * 判断当前操作是否需要触发通知
     * <p>
     * 仅当状态变更为 APPROVED/REJECTED/RETURNED 时触发通知。
     * </p>
     *
     * @return 是否需要触发通知
     */
    public boolean shouldTriggerNotification() {
        if (nodeStatus == null) {
            return false;
        }
        return NodeStatus.APPROVED.name().equals(nodeStatus)
            || NodeStatus.REJECTED.name().equals(nodeStatus)
            || NodeStatus.RETURNED.name().equals(nodeStatus);
    }

    /**
     * 判断是否为自审（审批人与申请人为同一人）
     * <p>
     * 审批人对自己提交的工单无审批权限，系统禁止自审操作。
     * </p>
     *
     * @param approverId  审批人 ID
     * @param submitterId 申请人 ID
     * @return 是否为自审
     */
    public static boolean isSelfApproval(Long approverId, Long submitterId) {
        if (approverId == null || submitterId == null) {
            return false;
        }
        return approverId.equals(submitterId);
    }

    /**
     * 生成幂等 Key
     * <p>
     * 格式：sha256(workOrderId + operatorId + operationType + timestamp // 300s)
     * 同一 Key 在 5 分钟窗口内重复提交仅执行一次状态写入。
     * </p>
     *
     * @param workOrderId    工单 ID
     * @param operatorId     操作人 ID
     * @param operationType  操作类型
     * @param currentSeconds 当前时间戳（秒）
     * @return 幂等 Key
     */
    public static String generateIdempotencyKey(Long workOrderId, Long operatorId,
                                                 String operationType, long currentSeconds) {
        long bucket = currentSeconds / 300L;
        String raw = String.format("%d_%d_%s_%d", workOrderId, operatorId, operationType, bucket);
        try {
            java.security.MessageDigest md = java.security.MessageDigest.getInstance("SHA-256");
            byte[] hash = md.digest(raw.getBytes(java.nio.charset.StandardCharsets.UTF_8));
            StringBuilder hexString = new StringBuilder();
            for (byte b : hash) {
                String hex = Integer.toHexString(0xff & b);
                if (hex.length() == 1) {
                    hexString.append('0');
                }
                hexString.append(hex);
            }
            return hexString.toString();
        } catch (java.security.NoSuchAlgorithmException e) {
            throw new RuntimeException("SHA-256 algorithm not available", e);
        }
    }

    /**
     * 获取幂等过期时间
     * <p>
     * TTL = 300 秒（5 分钟），从当前时间起算。
     * </p>
     *
     * @return 过期时间
     */
    public static LocalDateTime calculateIdempotencyExpiresAt() {
        return LocalDateTime.now().plusSeconds(300L);
    }
}