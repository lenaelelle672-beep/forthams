package com.ams.enums;

/**
 * 审批流程状态枚举，定义审批流程的生命周期状态。
 *
 * <p>状态流转路径：
 * <ul>
 *   <li>DRAFT → PENDING（提交审批）</li>
 *   <li>PENDING → APPROVED（审批通过）</li>
 *   <li>PENDING → REJECTED（审批驳回）</li>
 *   <li>PENDING → CANCELLED（取消审批）</li>
 *   <li>PENDING → EXPIRED（审批超时）</li>
 *   <li>APPROVED / REJECTED / CANCELLED / EXPIRED 均为终态</li>
 * </ul>
 */
public enum ApprovalStatus {

    /** 草稿：审批流程已创建，尚未提交。 */
    DRAFT,

    /** 审批中：流程已提交，等待审批人处理。 */
    PENDING,

    /** 审批通过：所有审批节点已通过。终态。 */
    APPROVED,

    /** 审批驳回：审批节点驳回了申请。终态。 */
    REJECTED,

    /** 已撤回：申请人在审批处理前撤回了申请。终态。 */
    WITHDRAWN,

    /** 已取消：审批流程被取消。终态。 */
    CANCELLED,

    /** 已过期：审批流程超过处理时限自动作废。终态。 */
    EXPIRED;
}
