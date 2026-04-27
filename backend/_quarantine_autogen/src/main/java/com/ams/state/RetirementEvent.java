package com.ams.state;

import com.ams.common.exception.BusinessException;

/**
 * 资产报废/退役事件定义
 * 
 * <p>定义资产报废与退役申请流程中的所有状态变更事件，用于状态机流转控制。
 * 支持多级审批链和生命周期追溯。</p>
 * 
 * @author AMS Team
 * @since Iteration-5
 * @see RetirementStateMachine
 * @see RetirementState
 */
public enum RetirementEvent {
    
    /**
     * 提交报废申请
     * 触发条件：用户对资产发起报废申请
     * 前置状态：IN_USE, IDLE
     * 后置状态：PENDING_APPROVAL
     * 约束：同一资产同一时间仅允许存在1条有效申请
     */
    SUBMIT_SCRAP_APPLICATION("报废申请提交", "RET_001"),
    
    /**
     * 提交退役申请
     * 触发条件：用户对资产发起退役申请
     * 前置状态：IN_USE, IDLE
     * 后置状态：PENDING_APPROVAL
     * 约束：同一资产同一时间仅允许存在1条有效申请
     */
    SUBMIT_RETIREMENT_APPLICATION("退役申请提交", "RET_002"),
    
    /**
     * 撤销申请
     * 触发条件：申请人在首级审批前主动撤销
     * 前置状态：PENDING_APPROVAL
     * 后置状态：DRAFT (可重新编辑提交) 或 CANCELLED (完全撤销)
     * 约束：仅申请人可在首级审批前撤销
     */
    WITHDRAW_APPLICATION("撤销申请", "RET_003"),
    
    /**
     * 第一级审批通过
     * 触发条件：首级审批人批准申请
     * 前置状态：PENDING_LEVEL_1_APPROVAL
     * 后置状态：PENDING_LEVEL_2_APPROVAL (如有多级) 或 APPROVED (单级审批)
     * 约束：审批人必须是配置的审批链中的节点处理人
     */
    APPROVE_LEVEL_1("一级审批通过", "RET_004"),
    
    /**
     * 第二级审批通过
     * 触发条件：二级审批人批准申请
     * 前置状态：PENDING_LEVEL_2_APPROVAL
     * 后置状态：PENDING_LEVEL_3_APPROVAL (如有多级) 或 APPROVED (二级审批完成)
     */
    APPROVE_LEVEL_2("二级审批通过", "RET_005"),
    
    /**
     * 第三级审批通过
     * 触发条件：三级审批人批准申请
     * 前置状态：PENDING_LEVEL_3_APPROVAL
     * 后置状态：PENDING_LEVEL_4_APPROVAL (如有多级) 或 APPROVED (三级审批完成)
     */
    APPROVE_LEVEL_3("三级审批通过", "RET_006"),
    
    /**
     * 第四级审批通过
     * 触发条件：四级审批人批准申请
     * 前置状态：PENDING_LEVEL_4_APPROVAL
     * 后置状态：PENDING_LEVEL_5_APPROVAL (如有多级) 或 APPROVED (四级审批完成)
     */
    APPROVE_LEVEL_4("四级审批通过", "RET_007"),
    
    /**
     * 第五级审批通过
     * 触发条件：五级审批人批准申请
     * 前置状态：PENDING_LEVEL_5_APPROVAL
     * 后置状态：APPROVED (最终审批通过)
     * 说明：最多支持5级审批链
     */
    APPROVE_LEVEL_5("五级审批通过", "RET_008"),
    
    /**
     * 审批驳回
     * 触发条件：任一级别审批人驳回申请
     * 前置状态：PENDING_*_APPROVAL
     * 后置状态：REJECTED
     * 约束：驳回必须填写审批意见（≥10字符）
     */
    REJECT("审批驳回", "RET_009"),
    
    /**
     * 审批超时催办
     * 触发条件：审批任务72小时未处理
     * 行为：发送催办通知，不自动通过
     * 后置状态：保持当前审批状态
     */
    APPROVAL_TIMEOUT_REMINDER("审批超时催办", "RET_010"),
    
    /**
     * 申请重新提交（驳回后修改）
     * 触发条件：申请人对驳回的申请修改后重新提交
     * 前置状态：REJECTED
     * 后置状态：PENDING_APPROVAL
     */
    RESUBMIT_APPLICATION("重新提交申请", "RET_011"),
    
    /**
     * 报废执行完成
     * 触发条件：审批通过后完成报废处理
     * 前置状态：APPROVED (报废类型)
     * 后置状态：SCRAPPED
     */
    EXECUTE_SCRAP("执行报废", "RET_012"),
    
    /**
     * 退役执行完成
     * 触发条件：审批通过后完成退役处理
     * 前置状态：APPROVED (退役类型)
     * 后置状态：RETIRED
     */
    EXECUTE_RETIREMENT("执行退役", "RET_013"),
    
    /**
     * 审批任务转交
     * 触发条件：当前审批人将任务转交给其他人
     * 前置状态：PENDING_*_APPROVAL
     * 后置状态：PENDING_*_APPROVAL (审批人变更)
     */
    DELEGATE_APPROVAL("审批转交", "RET_014"),
    
    /**
     * 审批任务加签
     * 触发条件：需要在当前审批节点增加额外审批人
     * 前置状态：PENDING_*_APPROVAL
     * 后置状态：PENDING_*_APPROVAL (增加审批人)
     */
    ADDITIONAL_APPROVAL("加签审批", "RET_015"),
    
    /**
     * 审批任务取消
     * 触发条件：管理员或系统取消审批任务
     * 前置状态：任意PENDING_*状态
     * 后置状态：CANCELLED
     * 约束：需记录取消原因
     */
    CANCEL_APPROVAL("取消审批", "RET_016"),
    
    /**
     * 资产状态锁定
     * 触发条件：申请提交后锁定资产状态
     * 前置状态：IN_USE, IDLE
     * 后置状态：UNDER_RETIREMENT
     * 约束：审批中资产禁止其他状态变更操作
     */
    LOCK_ASSET("资产状态锁定", "RET_017"),
    
    /**
     * 资产状态解锁
     * 触发条件：申请被撤销、驳回或取消后解锁资产
     * 前置状态：UNDER_RETIREMENT
     * 后置状态：原状态 (IN_USE 或 IDLE)
     */
    UNLOCK_ASSET("资产状态解锁", "RET_018"),
    
    /**
     * 生命周期事件记录
     * 触发条件：任意状态变更时触发
     * 行为：写入生命周期事件表 (asset_lifecycle_event)
     */
    RECORD_LIFECYCLE_EVENT("记录生命周期事件", "RET_019");

    private final String description;
    private final String eventCode;

    RetirementEvent(String description, String eventCode) {
        this.description = description;
        this.eventCode = eventCode;
    }

    /**
     * 获取事件描述
     * @return 事件的人类可读描述
     */
    public String getDescription() {
        return description;
    }

    /**
     * 获取事件编码
     * @return 事件唯一编码，用于日志追踪
     */
    public String getEventCode() {
        return eventCode;
    }

    /**
     * 验证事件是否支持指定状态
     * @param state 当前状态
     * @return 是否允许从当前状态触发此事件
     * @throws BusinessException 如果状态不匹配
     */
    public boolean validateFromState(RetirementState state) {
        return switch (this) {
            case SUBMIT_SCRAP_APPLICATION, SUBMIT_RETIREMENT_APPLICATION -> 
                state == RetirementState.IN_USE || state == RetirementState.IDLE;
            case WITHDRAW_APPLICATION -> state == RetirementState.PENDING_APPROVAL;
            case APPROVE_LEVEL_1 -> state == RetirementState.PENDING_LEVEL_1_APPROVAL;
            case APPROVE_LEVEL_2 -> state == RetirementState.PENDING_LEVEL_2_APPROVAL;
            case APPROVE_LEVEL_3 -> state == RetirementState.PENDING_LEVEL_3_APPROVAL;
            case APPROVE_LEVEL_4 -> state == RetirementState.PENDING_LEVEL_4_APPROVAL;
            case APPROVE_LEVEL_5 -> state == RetirementState.PENDING_LEVEL_5_APPROVAL;
            case REJECT -> state.name().startsWith("PENDING_");
            case APPROVAL_TIMEOUT_REMINDER -> state.name().startsWith("PENDING_");
            case RESUBMIT_APPLICATION -> state == RetirementState.REJECTED;
            case EXECUTE_SCRAP, EXECUTE_RETIREMENT -> state == RetirementState.APPROVED;
            case DELEGATE_APPROVAL, ADDITIONAL_APPROVAL -> state.name().startsWith("PENDING_");
            case CANCEL_APPROVAL -> state.name().startsWith("PENDING_") || state == RetirementState.APPROVED;
            case LOCK_ASSET -> state == RetirementState.IN_USE || state == RetirementState.IDLE;
            case UNLOCK_ASSET -> state == RetirementState.UNDER_RETIREMENT;
            case RECORD_LIFECYCLE_EVENT -> true;
        };
    }

    /**
     * 获取事件对应的目标状态
     * @return 触发此事件后的目标状态
     * @throws BusinessException 如果事件无明确目标状态
     */
    public RetirementState getTargetState() {
        return switch (this) {
            case SUBMIT_SCRAP_APPLICATION, SUBMIT_RETIREMENT_APPLICATION -> RetirementState.PENDING_APPROVAL;
            case WITHDRAW_APPLICATION -> RetirementState.DRAFT;
            case APPROVE_LEVEL_1 -> RetirementState.PENDING_LEVEL_2_APPROVAL;
            case APPROVE_LEVEL_2 -> RetirementState.PENDING_LEVEL_3_APPROVAL;
            case APPROVE_LEVEL_3 -> RetirementState.PENDING_LEVEL_4_APPROVAL;
            case APPROVE_LEVEL_4 -> RetirementState.PENDING_LEVEL_5_APPROVAL;
            case APPROVE_LEVEL_5 -> RetirementState.APPROVED;
            case REJECT -> RetirementState.REJECTED;
            case RESUBMIT_APPLICATION -> RetirementState.PENDING_APPROVAL;
            case EXECUTE_SCRAP -> RetirementState.SCRAPPED;
            case EXECUTE_RETIREMENT -> RetirementState.RETIRED;
            case CANCEL_APPROVAL -> RetirementState.CANCELLED;
            case LOCK_ASSET -> RetirementState.UNDER_RETIREMENT;
            case UNLOCK_ASSET -> RetirementState.IN_USE;
            default -> throw new BusinessException("事件 " + this.name() + " 无明确的目标状态");
        };
    }

    /**
     * 判断是否为审批通过事件
     * @return 是否为任一级别审批通过事件
     */
    public boolean isApprovalEvent() {
        return this == APPROVE_LEVEL_1 || this == APPROVE_LEVEL_2 || 
               this == APPROVE_LEVEL_3 || this == APPROVE_LEVEL_4 || this == APPROVE_LEVEL_5;
    }

    /**
     * 获取审批级别（如果当前事件是审批事件）
     * @return 审批级别（1-5），如果不是审批事件返回 -1
     */
    public int getApprovalLevel() {
        return switch (this) {
            case APPROVE_LEVEL_1 -> 1;
            case APPROVE_LEVEL_2 -> 2;
            case APPROVE_LEVEL_3 -> 3;
            case APPROVE_LEVEL_4 -> 4;
            case APPROVE_LEVEL_5 -> 5;
            default -> -1;
        };
    }
}