package com.ams.entity;

import com.baomidou.mybatisplus.annotation.*;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;
import lombok.Builder;

import java.time.LocalDateTime;

/**
 * 工单审批记录实体类
 * 
 * 对应工作流：工单审批流程（SWARM-2025-Q2-P0-003 Iteration 7）
 * 
 * 状态机流转规则：
 * - DRAFT    → 待提交（起草态，仅申请人可编辑）
 * - PENDING  → 待审批（已进入审批队列）
 * - APPROVED → 已通过（终态，不可逆）
 * - REJECTED → 已驳回（终态，不可逆，可重新提交）
 * - RETURNED → 已退回（中间态，申请人可修改后重新提交）
 * - CANCELLED→ 已撤回（终态，申请人主动撤销）
 * 
 * 允许的状态迁移矩阵：
 * - DRAFT    + submit     → PENDING
 * - PENDING  + approve    → APPROVED
 * - PENDING  + reject      → REJECTED
 * - PENDING  + return      → RETURNED
 * - PENDING  + cancel      → CANCELLED
 * - RETURNED + resubmit    → PENDING
 * 
 * 通知触发约束：
 * - APPROVED / REJECTED / RETURNED 触发通知投递
 * - DRAFT / PENDING / CANCELLED 不触发通知
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
@TableName("approval_record")
public class ApprovalRecord {

    /**
     * 审批记录唯一标识ID
     */
    @TableId(type = IdType.ASSIGN_UUID)
    private String id;

    /**
     * 关联工单ID
     */
    private String workOrderId;

    /**
     * 操作时的工单状态（操作前状态）
     * 枚举值：DRAFT, PENDING, APPROVED, REJECTED, RETURNED, CANCELLED
     */
    private String previousStatus;

    /**
     * 操作后目标状态
     * 枚举值：DRAFT, PENDING, APPROVED, REJECTED, RETURNED, CANCELLED
     */
    private String targetStatus;

    /**
     * 操作类型
     * 枚举值：submit, approve, reject, return, resubmit, cancel
     */
    private String operationType;

    /**
     * 操作人ID（提交人/申请人）
     */
    private String operatorId;

    /**
     * 审批人ID（仅当 operationType 为 approve/reject/return 时有效）
     */
    private String approverId;

    /**
     * 操作时间（精确到秒）
     */
    private LocalDateTime operationTime;

    /**
     * 审批意见/备注（可选）
     */
    private String comment;

    /**
     * 幂等性key
     * 格式：sha256(work_order_id + operator_id + operation_type + timestamp // 300s)
     * 用于防止5分钟窗口内的重复操作
     */
    private String idempotencyKey;

    /**
     * 版本号（乐观锁）
     */
    @Version
    private Integer version;

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
     * 是否已触发通知
     * true: 已发送通知（APPROVED/REJECTED/RETURNED 状态后）
     * false: 未发送通知（DRAFT/PENDING/CANCELLED 状态后）
     */
    private Boolean notificationSent;

    /**
     * 通知发送时间
     */
    private LocalDateTime notificationTime;
}