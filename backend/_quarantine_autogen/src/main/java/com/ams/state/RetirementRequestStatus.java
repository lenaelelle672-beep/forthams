package com.ams.state;

/**
 * 报废申请状态枚举
 * 
 * <p>定义了资产报废申请的全生命周期状态流转:
 * <ul>
 *   <li>PENDING_APPROVAL - 待审批: 申请已提交，等待审批链处理</li>
 *   <li>APPROVED - 已批准: 审批链全部通过，申请生效</li>
 *   <li>REJECTED - 已驳回: 审批链中任意节点驳回</li>
 *   <li>CANCELLED - 已撤销: 申请人主动撤销申请</li>
 *   <li>EXPIRED - 已过期: 审批超时未完成</li>
 * </ul>
 * 
 * <p>状态流转规则:
 * <pre>
 * PENDING_APPROVAL → APPROVED (所有审批节点通过)
 * PENDING_APPROVAL → REJECTED (任一审批节点驳回)
 * PENDING_APPROVAL → CANCELLED (申请人撤销)
 * PENDING_APPROVAL → EXPIRED (审批超时)
 * </pre>
 * 
 * @since SWARM-002 v7
 * @see RetirementStateMachine
 * @see com.ams.workflow.RetirementApprovalWorkflow
 */
public enum RetirementRequestStatus {
    
    /** 待审批 - 申请已提交，等待审批链处理 */
    PENDING_APPROVAL("PENDING", "待审批"),
    
    /** 已批准 - 审批链全部通过，申请生效 */
    APPROVED("APPROVED", "已批准"),
    
    /** 已驳回 - 审批链中任意节点驳回 */
    REJECTED("REJECTED", "已驳回"),
    
    /** 已撤销 - 申请人主动撤销申请 */
    CANCELLED("CANCELLED", "已撤销"),
    
    /** 已过期 - 审批超时未完成 */
    EXPIRED("EXPIRED", "已过期");
    
    private final String code;
    private final String description;
    
    /**
     * 构造函数
     * 
     * @param code 状态编码，用于数据库存储和 API 传输
     * @param description 状态描述，用于前端展示
     */
    RetirementRequestStatus(String code, String description) {
        this.code = code;
        this.description = description;
    }
    
    /**
     * 获取状态编码
     * 
     * @return 状态编码字符串
     */
    public String getCode() {
        return code;
    }
    
    /**
     * 获取状态描述
     * 
     * @return 状态描述字符串
     */
    public String getDescription() {
        return description;
    }
    
    /**
     * 根据编码查找对应的状态枚举
     * 
     * @param code 状态编码
     * @return 对应的枚举值，若未找到返回 null
     */
    public static RetirementRequestStatus fromCode(String code) {
        if (code == null) {
            return null;
        }
        for (RetirementRequestStatus status : values()) {
            if (status.code.equals(code)) {
                return status;
            }
        }
        return null;
    }
    
    /**
     * 检查当前状态是否为终态
     * 
     * <p>终态不可继续流转，标记申请流程结束
     * 
     * @return true 如果是终态
     */
    public boolean isTerminal() {
        return this == APPROVED || this == REJECTED || this == CANCELLED || this == EXPIRED;
    }
    
    /**
     * 检查当前状态是否允许取消
     * 
     * <p>仅 PENDING_APPROVAL 状态允许申请人撤销
     * 
     * @return true 如果允许取消
     */
    public boolean isCancellable() {
        return this == PENDING_APPROVAL;
    }
    
    /**
     * 获取状态中文名称
     * 
     * @return 状态的中文描述
     */
    public String getChineseName() {
        return description;
    }
}