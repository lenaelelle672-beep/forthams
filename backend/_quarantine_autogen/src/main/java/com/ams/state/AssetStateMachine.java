package com.ams.state;

import java.util.EnumMap;
import java.util.EnumSet;
import java.util.HashMap;
import java.util.HashSet;
import java.util.Map;
import java.util.Set;

/**
 * Asset State Machine
 * 
 * 资产状态流转引擎，负责管理资产从采购到报废的全生命周期状态转换。
 * 支持预定义的状态转换规则校验，确保资产状态变更的合法性和一致性。
 * 
 * 状态转换规则矩阵：
 * <ul>
 *   <li>IN_USE → PENDING_RETIREMENT: 报废申请创建成功</li>
 *   <li>PENDING_RETIREMENT → RETIRED: 审批链全部通过</li>
 *   <li>PENDING_RETIREMENT → IN_USE: 审批驳回 / 申请人撤销</li>
 *   <li>RETIRED → (禁止): 不可逆状态</li>
 *   <li>IN_USE → IDLE: 资产闲置</li>
 *   <li>IDLE → IN_USE: 重新启用</li>
 *   <li>IN_USE → MAINTENANCE: 进入维修</li>
 *   <li>MAINTENANCE → IN_USE: 维修完成</li>
 * </ul>
 * 
 * 边界约束：
 * <ul>
 *   <li>C-001: 资产状态仅允许按预定义规则流转，禁止跨状态跳跃</li>
 *   <li>C-005: 每次状态变更必须记录历史</li>
 *   <li>C-006: 并发约束：同一资产同时仅允许一个处于 PENDING_RETIREMENT 的报废申请</li>
 * </ul>
 * 
 * @since SWARM-002 Iteration 7
 * @see AssetState
 * @see RetirementEvent
 * @see StateTransitionException
 */
public class AssetStateMachine {

    /**
     * 状态转换规则映射表
     * Key: 当前状态, Value: 可转换的事件及对应的目标状态
     */
    private final Map<AssetState, Map<RetirementEvent, AssetState>> transitionRules;

    /**
     * 状态描述映射
     */
    private static final Map<AssetState, String> STATE_DESCRIPTIONS;

    static {
        STATE_DESCRIPTIONS = new HashMap<>();
        STATE_DESCRIPTIONS.put(AssetState.IN_USE, "在用");
        STATE_DESCRIPTIONS.put(AssetState.PENDING_RETIREMENT, "待审批");
        STATE_DESCRIPTIONS.put(AssetState.RETIRED, "已报废");
        STATE_DESCRIPTIONS.put(AssetState.IDLE, "闲置");
        STATE_DESCRIPTIONS.put(AssetState.MAINTENANCE, "维修中");
    }

    /**
     * 构造函数
     * 初始化状态转换规则映射表
     */
    public AssetStateMachine() {
        this.transitionRules = new EnumMap<>(AssetState.class);
        initializeTransitionRules();
    }

    /**
     * 初始化状态转换规则
     * 构建完整的状态转换矩阵
     */
    private void initializeTransitionRules() {
        // IN_USE 状态可转换规则
        Map<RetirementEvent, AssetState> inUseTransitions = new EnumMap<>(RetirementEvent.class);
        inUseTransitions.put(RetirementEvent.REQUEST_RETIREMENT, AssetState.PENDING_RETIREMENT);
        inUseTransitions.put(RetirementEvent.SET_IDLE, AssetState.IDLE);
        inUseTransitions.put(RetirementEvent.START_MAINTENANCE, AssetState.MAINTENANCE);
        transitionRules.put(AssetState.IN_USE, inUseTransitions);

        // PENDING_RETIREMENT 状态可转换规则
        Map<RetirementEvent, AssetState> pendingTransitions = new EnumMap<>(RetirementEvent.class);
        pendingTransitions.put(RetirementEvent.APPROVE_RETIREMENT, AssetState.RETIRED);
        pendingTransitions.put(RetirementEvent.REJECT_RETIREMENT, AssetState.IN_USE);
        pendingTransitions.put(RetirementEvent.CANCEL_RETIREMENT, AssetState.IN_USE);
        transitionRules.put(AssetState.PENDING_RETIREMENT, pendingTransitions);

        // IDLE 状态可转换规则
        Map<RetirementEvent, AssetState> idleTransitions = new EnumMap<>(RetirementEvent.class);
        idleTransitions.put(RetirementEvent.REACTIVATE, AssetState.IN_USE);
        idleTransitions.put(RetirementEvent.REQUEST_RETIREMENT, AssetState.PENDING_RETIREMENT);
        transitionRules.put(AssetState.IDLE, idleTransitions);

        // MAINTENANCE 状态可转换规则
        Map<RetirementEvent, AssetState> maintenanceTransitions = new EnumMap<>(RetirementEvent.class);
        maintenanceTransitions.put(RetirementEvent.COMPLETE_MAINTENANCE, AssetState.IN_USE);
        transitionRules.put(AssetState.MAINTENANCE, maintenanceTransitions);

        // RETIRED 状态为终态，不允许任何转换
        transitionRules.put(AssetState.RETIRED, new EnumMap<>(RetirementEvent.class));
    }

    /**
     * 检查状态转换是否合法
     * 
     * @param currentState 当前状态
     * @param targetState 目标状态
     * @return 是否允许该转换
     * @throws IllegalArgumentException 如果状态参数为 null
     */
    public boolean canTransition(AssetState currentState, AssetState targetState) {
        if (currentState == null || targetState == null) {
            throw new IllegalArgumentException("状态参数不能为 null");
        }

        Map<RetirementEvent, AssetState> allowedTransitions = transitionRules.get(currentState);
        if (allowedTransitions == null || allowedTransitions.isEmpty()) {
            return false;
        }

        return allowedTransitions.containsValue(targetState);
    }

    /**
     * 检查通过事件触发能否达到目标状态
     * 
     * @param currentState 当前状态
     * @param event 触发事件
     * @param targetState 目标状态
     * @return 是否允许该转换
     */
    public boolean canTransition(AssetState currentState, RetirementEvent event, AssetState targetState) {
        if (currentState == null || event == null || targetState == null) {
            throw new IllegalArgumentException("参数不能为 null");
        }

        Map<RetirementEvent, AssetState> allowedTransitions = transitionRules.get(currentState);
        if (allowedTransitions == null) {
            return false;
        }

        AssetState stateForEvent = allowedTransitions.get(event);
        return targetState.equals(stateForEvent);
    }

    /**
     * 通过事件执行状态转换
     * 
     * @param currentState 当前状态
     * @param event 触发事件
     * @return 转换后的目标状态
     * @throws StateTransitionException 如果转换不合法
     * @throws IllegalArgumentException 如果参数为 null
     */
    public AssetState transition(AssetState currentState, RetirementEvent event) {
        if (currentState == null || event == null) {
            throw new IllegalArgumentException("参数不能为 null");
        }

        Map<RetirementEvent, AssetState> allowedTransitions = transitionRules.get(currentState);
        if (allowedTransitions == null) {
            throw new StateTransitionException(
                String.format("当前状态 %s 没有定义的转换规则", currentState)
            );
        }

        AssetState targetState = allowedTransitions.get(event);
        if (targetState == null) {
            throw new StateTransitionException(
                String.format("状态 %s 不允许事件 %s 触发转换", currentState, event)
            );
        }

        return targetState;
    }

    /**
     * 直接转换到目标状态（通过内部事件推导）
     * 
     * @param currentState 当前状态
     * @param targetState 目标状态
     * @return 转换是否成功
     * @throws StateTransitionException 如果转换不合法
     */
    public boolean doTransition(AssetState currentState, AssetState targetState) {
        if (!canTransition(currentState, targetState)) {
            throw new StateTransitionException(
                String.format("非法状态转换: %s -> %s", currentState, targetState)
            );
        }
        return true;
    }

    /**
     * 获取当前状态可用的所有目标状态
     * 
     * @param currentState 当前状态
     * @return 可转换的目标状态集合，如果状态不存在则返回空集合
     */
    public Set<AssetState> getAvailableTransitions(AssetState currentState) {
        Set<AssetState> availableStates = new HashSet<>();
        Map<RetirementEvent, AssetState> transitions = transitionRules.get(currentState);

        if (transitions != null) {
            availableStates.addAll(transitions.values());
        }

        return availableStates;
    }

    /**
     * 获取当前状态可触发的事件列表
     * 
     * @param currentState 当前状态
     * @return 可触发的事件集合
     */
    public Set<RetirementEvent> getAvailableEvents(AssetState currentState) {
        Set<RetirementEvent> events = new HashSet<>();
        Map<RetirementEvent, AssetState> transitions = transitionRules.get(currentState);

        if (transitions != null) {
            events.addAll(transitions.keySet());
        }

        return events;
    }

    /**
     * 检查是否为终态
     * 
     * @param state 待检查的状态
     * @return 是否为终态（不可再转换）
     */
    public boolean isFinalState(AssetState state) {
        if (state == null) {
            return false;
        }
        Map<RetirementEvent, AssetState> transitions = transitionRules.get(state);
        return transitions == null || transitions.isEmpty();
    }

    /**
     * 检查资产是否可发起报废申请
     * 仅 IN_USE 和 IDLE 状态的资产可发起报废申请
     * 
     * @param currentState 当前状态
     * @return 是否可发起报废申请
     */
    public boolean canRequestRetirement(AssetState currentState) {
        return currentState == AssetState.IN_USE || currentState == AssetState.IDLE;
    }

    /**
     * 获取状态描述
     * 
     * @param state 状态
     * @return 状态的中文描述
     */
    public String getStateDescription(AssetState state) {
        return STATE_DESCRIPTIONS.getOrDefault(state, "未知状态");
    }

    /**
     * 获取完整的转换规则映射
     * 用于调试和状态可视化
     * 
     * @return 不可修改的转换规则副本
     */
    public Map<AssetState, Map<RetirementEvent, AssetState>> getTransitionRules() {
        Map<AssetState, Map<RetirementEvent, AssetState>> copy = new HashMap<>();
        for (Map.Entry<AssetState, Map<RetirementEvent, AssetState>> entry : transitionRules.entrySet()) {
            copy.put(entry.getKey(), new EnumMap<>(entry.getValue()));
        }
        return copy;
    }
}