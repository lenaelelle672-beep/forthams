package com.ams.common.exception;

import com.ams.state.RetirementState;
import lombok.Getter;

/**
 * 资产报废退役状态转换异常.
 *
 * <p>当状态机检测到非法状态转换时抛出此异常。</p>
 *
 * <p>允许的转换规则:</p>
 * <ul>
 *   <li>DRAFT → PENDING_APPROVAL, ARCHIVED(撤回)</li>
 *   <li>PENDING_APPROVAL → APPROVED, REJECTED</li>
 *   <li>APPROVED → DECOMMISSIONED</li>
 *   <li>REJECTED → DRAFT(重新编辑), ARCHIVED</li>
 *   <li>DECOMMISSIONED → ARCHIVED</li>
 * </ul>
 *
 * @see com.ams.state.RetirementState
 * @see com.ams.state.RetirementEvent
 */
@Getter
public class RetirementStateTransitionException extends BusinessException {

    private static final long serialVersionUID = 1L;

    /** 资产报废申请ID */
    private final Long applicationId;

    /** 资产ID */
    private final Long assetId;

    /** 当前状态 */
    private final RetirementState currentState;

    /** 尝试转换的目标状态 */
    private final RetirementState targetState;

    /** 触发转换的事件 */
    private final String triggerEvent;

    /**
     * 构造状态转换异常.
     *
     * @param applicationId 报废申请ID
     * @param assetId      资产ID
     * @param currentState 当前状态
     * @param targetState  目标状态
     * @param triggerEvent 触发的事件
     */
    public RetirementStateTransitionException(
            Long applicationId,
            Long assetId,
            RetirementState currentState,
            RetirementState targetState,
            String triggerEvent) {
        super(buildMessage(applicationId, assetId, currentState, targetState, triggerEvent));
        this.applicationId = applicationId;
        this.assetId = assetId;
        this.currentState = currentState;
        this.targetState = targetState;
        this.triggerEvent = triggerEvent;
    }

    /**
     * 构造状态转换异常(简化构造).
     *
     * @param currentState 当前状态
     * @param targetState  目标状态
     */
    public RetirementStateTransitionException(
            RetirementState currentState,
            RetirementState targetState) {
        this(null, null, currentState, targetState, null);
    }

    /**
     * 构建异常消息.
     *
     * @param applicationId 报废申请ID
     * @param assetId      资产ID
     * @param currentState 当前状态
     * @param targetState  目标状态
     * @param triggerEvent 触发的事件
     * @return 格式化后的错误消息
     */
    private static String buildMessage(
            Long applicationId,
            Long assetId,
            RetirementState currentState,
            RetirementState targetState,
            String triggerEvent) {
        StringBuilder sb = new StringBuilder("Invalid state transition: ");
        if (applicationId != null) {
            sb.append("applicationId=").append(applicationId).append(", ");
        }
        if (assetId != null) {
            sb.append("assetId=").append(assetId).append(", ");
        }
        sb.append("state: ").append(currentState).append(" -> ").append(targetState);
        if (triggerEvent != null) {
            sb.append(", triggered by: ").append(triggerEvent);
        }
        return sb.toString();
    }

    /**
     * 获取错误码.
     *
     * @return 错误码，格式为 4xxxx
     */
    @Override
    public String getErrorCode() {
        return "44001";
    }
}