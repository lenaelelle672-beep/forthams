package com.ams.enums;

/**
 * 工单状态机流转事件枚举。
 *
 * <p>定义工单生命周期中所有合法的状态转移事件，配合 {@link OrderStatus} 枚举
 * 构成完整的审批流状态机。事件严格遵循以下流转路径：</p>
 *
 * <pre>
 *   SUBMIT    : PENDING           → APPROVING_LEVEL_1
 *   APPROVE_L1: APPROVING_LEVEL_1 → APPROVING_LEVEL_2
 *   APPROVE_L2: APPROVING_LEVEL_2 → APPROVED
 *   REJECT    : APPROVING_LEVEL_1 / APPROVING_LEVEL_2 → REJECTED
 *   CANCEL    : PENDING           → CANCELLED
 * </pre>
 *
 * <p>严禁跨级审批（如从 PENDING 直接流转至 APPROVING_LEVEL_2），
 * 驳回操作必须携带 rejectionReason（非空且长度 &gt;= 10 字符）。</p>
 *
 * @see OrderStatus
 */
public enum OrderEvent {

    /**
     * 提交工单事件。
     *
     * <p>将工单从 {@link OrderStatus#PENDING} 流转至
     * {@link OrderStatus#APPROVING_LEVEL_1}，进入部门主管审批节点。</p>
     */
    SUBMIT,

    /**
     * 部门主管（L1）审批通过事件。
     *
     * <p>将工单从 {@link OrderStatus#APPROVING_LEVEL_1} 流转至
     * {@link OrderStatus#APPROVING_LEVEL_2}，进入资产管理员审批节点。
     * 仅限部门主管角色操作。</p>
     */
    APPROVE_L1,

    /**
     * 资产管理员（L2）审批通过事件。
     *
     * <p>将工单从 {@link OrderStatus#APPROVING_LEVEL_2} 流转至
     * {@link OrderStatus#APPROVED}，工单审批完成。
     * 仅限资产管理员角色操作。</p>
     */
    APPROVE_L2,

    /**
     * 驳回事件。
     *
     * <p>将工单从 {@link OrderStatus#APPROVING_LEVEL_1} 或
     * {@link OrderStatus#APPROVING_LEVEL_2} 流转至 {@link OrderStatus#REJECTED}（终态）。
     * 执行驳回操作时，rejectionReason 字段为必填（非空且长度 &gt;= 10 字符），
     * 否则请求将被拦截。</p>
     */
    REJECT,

    /**
     * 取消工单事件。
     *
     * <p>将工单从 {@link OrderStatus#PENDING} 流转至
     * {@link OrderStatus#CANCELLED}（终态）。仅在工单处于待提交状态时允许取消。</p>
     */
    CANCEL
}