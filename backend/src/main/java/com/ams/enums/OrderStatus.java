package com.ams.enums;

/**
 * 工单状态枚举，定义工单审批流的完整状态链路。
 *
 * <p>合法状态流转路径：
 * <ul>
 *   <li>DRAFT → PENDING（提交审批）</li>
 *   <li>PENDING → APPROVING_LEVEL_1（提交审批）</li>
 *   <li>APPROVING_LEVEL_1 → APPROVING_LEVEL_2（部门主管审批通过）</li>
 *   <li>APPROVING_LEVEL_1 → REJECTED（部门主管驳回）</li>
 *   <li>APPROVING_LEVEL_2 → APPROVED（资产管理员审批通过）</li>
 *   <li>APPROVING_LEVEL_2 → REJECTED（资产管理员驳回）</li>
 *   <li>PENDING → CANCELLED（工单取消）</li>
 *   <li>APPROVED → EXECUTING（开始执行）</li>
 *   <li>EXECUTING → COMPLETED（执行完成）</li>
 * </ul>
 *
 * <p>严禁跨级审批（如从 PENDING 直接流转至 APPROVING_LEVEL_2），
 * REJECTED、CANCELLED 与 COMPLETED 为终态，不可再变更。</p>
 */
public enum OrderStatus {

    /** 草稿：工单已创建，尚未提交审批。 */
    DRAFT,

    /** 待提交：工单已创建，尚未发起审批。 */
    PENDING,

    /** 部门主管审批中：工单已提交，等待部门主管审批。仅 DEPARTMENT_MANAGER 角色可操作。 */
    APPROVING_LEVEL_1,

    /** 资产管理员审批中：部门主管已通过，等待资产管理员审批。仅 ASSET_ADMIN 角色可操作。 */
    APPROVING_LEVEL_2,

    /** 审批通过：资产管理员已审批通过，工单完成审批流程。终态。 */
    APPROVED,

    /** 执行中：审批通过后开始执行工单内容。 */
    EXECUTING,

    /** 已完成：工单执行完毕。终态。 */
    COMPLETED,

    /** 已驳回：审批节点驳回工单。终态。驳回时必须填写 rejectionReason（>=10字符）。 */
    REJECTED,

    /** 已取消：工单在审批前被取消。终态。 */
    CANCELLED;

    /**
     * 判断给定状态是否为终态（不可再变更）。
     *
     * @param status 待判断的状态
     * @return 如果是终态返回 true，否则返回 false
     */
    public static boolean isTerminal(OrderStatus status) {
        return status == REJECTED || status == CANCELLED || status == COMPLETED || status == APPROVED;
    }

    /**
     * 判断当前状态是否为终态。
     *
     * @return 如果是终态返回 true，否则返回 false
     */
    public boolean isTerminal() {
        return isTerminal(this);
    }
}
