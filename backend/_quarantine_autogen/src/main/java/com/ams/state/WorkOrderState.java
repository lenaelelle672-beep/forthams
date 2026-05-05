package com.ams.state;

/**
 * 工单审批流程状态枚举定义
 * 
 * 状态机定义：
 * - draft → (submit) → pending_approval
 * - pending_approval → (approve) → approved (终态)
 * - pending_approval → (reject) → rejected (终态)
 * - pending_approval → (revise) → draft
 * 
 * @author AMS
 * @since Iteration-1
 */
public enum WorkOrderState {
    
    /**
     * 草稿状态 - 工单创建后的初始状态
     * 可执行操作: submit (提交审批)
     */
    draft("草稿", true, false),
    
    /**
     * 待审批状态 - 工单已提交，等待审批人处理
     * 可执行操作: approve (通过), reject (拒绝), revise (驳回重新提交)
     */
    pending_approval("待审批", false, false),
    
    /**
     * 已通过状态 - 审批人通过审批 (终态)
     * 不可再进行任何状态转换
     */
    approved("已通过", false, true),
    
    /**
     * 已拒绝状态 - 审批人拒绝审批 (终态)
     * 不可再进行任何状态转换
     */
    rejected("已拒绝", false, true);
    
    private final String description;
    
    /**
     * 是否允许编辑（针对申请人）
     */
    private final boolean editable;
    
    /**
     * 是否为终态（不可再转换）
     */
    private final boolean terminal;
    
    WorkOrderState(String description, boolean editable, boolean terminal) {
        this.description = description;
        this.editable = editable;
        this.terminal = terminal;
    }
    
    /**
     * 获取状态描述
     * 
     * @return 状态的中文描述
     */
    public String getDescription() {
        return description;
    }
    
    /**
     * 检查当前状态是否可编辑
     * 
     * @return 可编辑返回 true，否则返回 false
     */
    public boolean isEditable() {
        return editable;
    }
    
    /**
     * 检查当前状态是否为终态
     * 
     * @return 终态返回 true，否则返回 false
     */
    public boolean isTerminal() {
        return terminal;
    }
    
    /**
     * 检查是否可以从当前状态转换到目标状态
     * 
     * @param targetState 目标状态
     * @return 可转换返回 true，否则返回 false
     */
    public boolean canTransitionTo(WorkOrderState targetState) {
        return switch (this) {
            case draft -> targetState == pending_approval;
            case pending_approval -> targetState == approved 
                                  || targetState == rejected 
                                  || targetState == draft;
            case approved, rejected -> false;
        };
    }
    
    /**
     * 获取允许的转换操作列表
     * 
     * @return 可执行的操作名称数组
     */
    public String[] getAllowedActions() {
        return switch (this) {
            case draft -> new String[]{"submit"};
            case pending_approval -> new String[]{"approve", "reject", "revise"};
            case approved, rejected -> new String[]{};
        };
    }
    
    /**
     * 验证状态转换是否合法
     * 如果不合法，抛出 IllegalStateTransitionException
     * 
     * @param action 操作名称
     * @param targetState 目标状态
     * @throws IllegalStateTransitionException 当转换不合法时
     */
    public void validateTransition(String action, WorkOrderState targetState) {
        String[] allowedActions = getAllowedActions();
        boolean actionValid = false;
        
        for (String allowed : allowedActions) {
            if (allowed.equals(action)) {
                actionValid = true;
                break;
            }
        }
        
        if (!actionValid) {
            throw new IllegalStateTransitionException(
                String.format("当前状态 '%s' 不允许执行操作 '%s'", this.description, action)
            );
        }
        
        if (!canTransitionTo(targetState)) {
            throw new IllegalStateTransitionException(
                String.format("状态 '%s' 无法转换到 '%s'", this.description, targetState.getDescription())
            );
        }
        
        if (this.terminal) {
            throw new IllegalStateTransitionException(
                String.format("终态 '%s' 不可进行任何状态转换", this.description)
            );
        }
    }
}