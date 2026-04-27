package com.ams.state;

import java.util.Arrays;
import java.util.Collections;
import java.util.Set;
import java.util.HashSet;

/**
 * 资产退役状态枚举 - 状态机核心定义
 *
 * 【AUTO-GENERATED - QUARANTINED】
 * 本文件由 Codex 自动生成于 GSD_HANDOFF_NOTE_2026-04-22 交接上下文
 * 位于 backend/_quarantine_autogen/ 隔离区
 *
 * TODO: 需根据 approval 工作流进行审查和选择性恢复
 * TODO: 确认与 ApprovalChainService 的状态映射关系
 *
 * @author Codex (auto-generated)
 * @since 2026-04-22
 */
public enum RetirementState {

    /**
     * 待提交状态
     * - 资产退役申请已创建但尚未提交
     * - 可执行操作: SUBMIT
     */
    DRAFT("draft", "草稿", false),

    /**
     * 待审批状态
     * - 申请已提交，等待审批链处理
     * - 可执行操作: APPROVE, REJECT, REQUEST_INFO
     */
    PENDING("pending", "待审批", true),

    /**
     * 一级审批中
     * - 流转至一级审批节点
     * - 可执行操作: APPROVE, REJECT
     */
    LEVEL_1_REVIEW("level_1_review", "一级审批", true),

    /**
     * 二级审批中
     * - 流转至二级审批节点
     * - 可执行操作: APPROVE, REJECT
     */
    LEVEL_2_REVIEW("level_2_review", "二级审批", true),

    /**
     * 最终审批中
     * - 流转至最终审批节点
     * - 可执行操作: APPROVE, REJECT
     */
    FINAL_REVIEW("final_review", "最终审批", true),

    /**
     * 已批准状态
     * - 审批链全部通过
     * - 可执行操作: EXECUTE_RETIREMENT
     */
    APPROVED("approved", "已批准", false),

    /**
     * 已拒绝状态
     * - 审批链中有节点拒绝
     * - 可执行操作: RESUBMIT, VIEW_REASON
     */
    REJECTED("rejected", "已拒绝", false),

    /**
     * 执行中状态
     * - 退役操作正在执行
     * - 可执行操作: COMPLETE, ROLLBACK
     */
    EXECUTING("executing", "执行中", false),

    /**
     * 已完成状态
     * - 退役流程全部完成
     * - 终态，不可转换
     */
    COMPLETED("completed", "已完成", false),

    /**
     * 已取消状态
     * - 用户主动取消申请
     * - 终态，不可转换
     */
    CANCELLED("cancelled", "已取消", false),

    /**
     * 回滚状态
     * - 退役执行失败，需要回滚
     * - 可执行操作: RETRY, CANCEL
     */
    ROLLBACK("rollback", "回滚中", false),

    /**
     * 已过期状态
     * - 审批超时未处理
     * - 可执行操作: REACTIVATE, CANCEL
     */
    EXPIRED("expired", "已过期", false);

    // ==================== 枚举属性 ====================

    private final String code;
    private final String description;
    private final boolean inApprovalChain;

    // ==================== 状态转换规则 ====================

    private static final Set<RetirementState> TERMINAL_STATES = Collections.unmodifiableSet(
        new HashSet<>(Arrays.asList(COMPLETED, CANCELLED))
    );

    private static final Set<RetirementState> REVISABLE_STATES = Collections.unmodifiableSet(
        new HashSet<>(Arrays.asList(REJECTED, DRAFT))
    );

    // ==================== 构造函数 ====================

    RetirementState(String code, String description, boolean inApprovalChain) {
        this.code = code;
        this.description = description;
        this.inApprovalChain = inApprovalChain;
    }

    // ==================== 业务方法 ====================

    /**
     * 获取状态编码
     */
    public String getCode() {
        return code;
    }

    /**
     * 获取状态描述
     */
    public String getDescription() {
        return description;
    }

    /**
     * 判断是否在审批链中
     */
    public boolean isInApprovalChain() {
        return inApprovalChain;
    }

    /**
     * 判断是否为终态
     * 终态不可进行状态转换
     */
    public boolean isTerminal() {
        return TERMINAL_STATES.contains(this);
    }

    /**
     * 判断是否可以重新提交
     */
    public boolean isRevisable() {
        return REVISABLE_STATES.contains(this);
    }

    /**
     * 判断是否可以批准
     */
    public boolean canApprove() {
        return this == PENDING ||
               this == LEVEL_1_REVIEW ||
               this == LEVEL_2_REVIEW ||
               this == FINAL_REVIEW;
    }

    /**
     * 判断是否可以拒绝
     */
    public boolean canReject() {
        return canApprove();
    }

    /**
     * 判断是否可以取消
     */
    public boolean canCancel() {
        return !isTerminal() && this != EXECUTING;
    }

    /**
     * 验证状态转换是否合法
     *
     * @param targetState 目标状态
     * @return 是否允许此转换
     */
    public boolean canTransitionTo(RetirementState targetState) {
        if (targetState == null) {
            return false;
        }

        // 终态不可转换
        if (this.isTerminal()) {
            return false;
        }

        // 草稿只能转到待审批
        if (this == DRAFT) {
            return targetState == PENDING;
        }

        // 待审批/审批中状态只能按审批链流转
        if (this.inApprovalChain || this == PENDING) {
            return isValidApprovalChainTransition(targetState);
        }

        // 已批准状态只能转到执行中
        if (this == APPROVED) {
            return targetState == EXECUTING;
        }

        // 执行中状态可转到完成或回滚
        if (this == EXECUTING) {
            return targetState == COMPLETED || targetState == ROLLBACK;
        }

        // 回滚状态可重试或取消
        if (this == ROLLBACK) {
            return targetState == EXECUTING || targetState == CANCELLED;
        }

        // 已拒绝状态可重新提交
        if (this == REJECTED) {
            return targetState == PENDING;
        }

        return false;
    }

    /**
     * 审批链状态转换验证
     */
    private boolean isValidApprovalChainTransition(RetirementState target) {
        switch (this) {
            case PENDING:
                return target == LEVEL_1_REVIEW;
            case LEVEL_1_REVIEW:
                return target == LEVEL_2_REVIEW || target == REJECTED;
            case LEVEL_2_REVIEW:
                return target == FINAL_REVIEW || target == REJECTED;
            case FINAL_REVIEW:
                return target == APPROVED || target == REJECTED;
            default:
                return false;
        }
    }

    /**
     * 获取允许的下一个状态列表
     */
    public Set<RetirementState> getAllowedTransitions() {
        Set<RetirementState> allowed = new HashSet<>();

        for (RetirementState state : values()) {
            if (this.canTransitionTo(state)) {
                allowed.add(state);
            }
        }

        return Collections.unmodifiableSet(allowed);
    }

    /**
     * 根据编码获取状态
     *
     * @param code 状态编码
     * @return 对应状态，若无匹配则返回 null
     */
    public static RetirementState fromCode(String code) {
        if (code == null) {
            return null;
        }

        for (RetirementState state : values()) {
            if (state.code.equals(code)) {
                return state;
            }
        }

        return null;
    }

    // ==================== 状态机上下文方法 ====================

    /**
     * 获取审批层级
     * @return 审批层级号，若不在审批中则返回 -1
     */
    public int getApprovalLevel() {
        switch (this) {
            case PENDING:
                return 0;
            case LEVEL_1_REVIEW:
                return 1;
            case LEVEL_2_REVIEW:
                return 2;
            case FINAL_REVIEW:
                return 3;
            default:
                return -1;
        }
    }

    /**
     * 判断是否需要审批
     */
    public boolean requiresApproval() {
        return this.inApprovalChain || this == PENDING;
    }

    @Override
    public String toString() {
        return String.format("RetirementState[%s: %s]", code, description);
    }
}