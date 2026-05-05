package com.ams.state;

import com.ams.entity.RetirementApplication;
import com.ams.entity.RetirementApprovalRecord;
import org.springframework.stereotype.Component;
import org.springframework.beans.factory.annotation.Autowired;
import com.ams.service.RetirementService;
import com.ams.service.ApprovalChainService;
import com.ams.common.exception.RetirementStateTransitionException;

import java.time.LocalDateTime;
import java.util.EnumMap;
import java.util.Map;
import java.util.function.Consumer;

/**
 * 资产退役状态机
 * 
 * <p>管理资产从正常使用到退役的全生命周期状态转换。</p>
 * 
 * <p><b>上下文说明 (2026-04-22):</b></p>
 * <p>此文件位于隔离区 `_quarantine_autogen/`，可能包含未完成但有价值的业务逻辑。</p>
 * <p>后续若开发 Java 后端，请先检查并按需选择性恢复，不要盲目重生成或覆盖。</p>
 * 
 * <p><b>状态流转:</b></p>
 * <pre>
 * DRAFT → PENDING_APPROVAL → APPROVED → PROCESSING → COMPLETED
 *                      ↓           ↓
 *                   REJECTED    CANCELLED
 * </pre>
 * 
 * @since 1.0
 * @deprecated 建议使用 backend/src/main/java 下的稳定版本
 */
@Deprecated
@Component
public class RetirementStateMachine {

    private final RetirementService retirementService;
    private final ApprovalChainService approvalChainService;

    /** 状态转换映射表 */
    private final Map<RetirementState, Map<RetirementEvent, RetirementState>> transitionMap;

    /** 状态变更监听器 */
    private final Map<RetirementState, Consumer<RetirementApplication>> stateListeners;

    /**
     * 构造函数
     * 
     * @param retirementService 退役服务
     * @param approvalChainService 审批链服务
     */
    @Autowired
    public RetirementStateMachine(
            RetirementService retirementService,
            ApprovalChainService approvalChainService) {
        this.retirementService = retirementService;
        this.approvalChainService = approvalChainService;
        this.transitionMap = new EnumMap<>(RetirementState.class);
        this.stateListeners = new EnumMap<>(RetirementState.class);
        initializeTransitionMap();
        initializeStateListeners();
    }

    /**
     * 初始化状态转换映射
     */
    private void initializeTransitionMap() {
        // DRAFT 状态可接受的事件
        Map<RetirementEvent, RetirementState> draftTransitions = new EnumMap<>(RetirementEvent.class);
        draftTransitions.put(RetirementEvent.SUBMIT, RetirementState.PENDING_APPROVAL);
        draftTransitions.put(RetirementEvent.CANCEL, RetirementState.CANCELLED);
        transitionMap.put(RetirementState.DRAFT, draftTransitions);

        // PENDING_APPROVAL 状态可接受的事件
        Map<RetirementEvent, RetirementState> pendingTransitions = new EnumMap<>(RetirementEvent.class);
        pendingTransitions.put(RetirementEvent.APPROVE, RetirementState.APPROVED);
        pendingTransitions.put(RetirementEvent.REJECT, RetirementState.REJECTED);
        pendingTransitions.put(RetirementEvent.CANCEL, RetirementState.CANCELLED);
        transitionMap.put(RetirementState.PENDING_APPROVAL, pendingTransitions);

        // APPROVED 状态可接受的事件
        Map<RetirementEvent, RetirementState> approvedTransitions = new EnumMap<>(RetirementEvent.class);
        approvedTransitions.put(RetirementEvent.START_PROCESS, RetirementState.PROCESSING);
        approvedTransitions.put(RetirementEvent.CANCEL, RetirementState.CANCELLED);
        transitionMap.put(RetirementState.APPROVED, approvedTransitions);

        // PROCESSING 状态可接受的事件
        Map<RetirementEvent, RetirementState> processingTransitions = new EnumMap<>(RetirementEvent.class);
        processingTransitions.put(RetirementEvent.COMPLETE, RetirementState.COMPLETED);
        processingTransitions.put(RetirementEvent.FAIL, RetirementState.FAILED);
        transitionMap.put(RetirementState.PROCESSING, processingTransitions);

        // COMPLETED, REJECTED, CANCELLED, FAILED 为终态，无可转换事件
        transitionMap.put(RetirementState.COMPLETED, new EnumMap<>(RetirementEvent.class));
        transitionMap.put(RetirementState.REJECTED, new EnumMap<>(RetirementEvent.class));
        transitionMap.put(RetirementState.CANCELLED, new EnumMap<>(RetirementEvent.class));
        transitionMap.put(RetirementState.FAILED, new EnumMap<>(RetirementEvent.class));
    }

    /**
     * 初始化状态变更监听器
     */
    private void initializeStateListeners() {
        stateListeners.put(RetirementState.PENDING_APPROVAL, this::onPendingApproval);
        stateListeners.put(RetirementState.APPROVED, this::onApproved);
        stateListeners.put(RetirementState.REJECTED, this::onRejected);
        stateListeners.put(RetirementState.PROCESSING, this::onProcessing);
        stateListeners.put(RetirementState.COMPLETED, this::onCompleted);
        stateListeners.put(RetirementState.CANCELLED, this::onCancelled);
    }

    /**
     * 执行状态转换
     * 
     * @param application 退役申请
     * @param event 触发事件
     * @return 转换后的状态
     * @throws RetirementStateTransitionException 如果转换非法
     */
    public RetirementState transition(RetirementApplication application, RetirementEvent event) {
        RetirementState currentState = RetirementState.fromCode(application.getStatus());
        
        if (!canTransition(currentState, event)) {
            throw new RetirementStateTransitionException(
                String.format("无法从状态 %s 执行事件 %s", currentState, event)
            );
        }

        RetirementState newState = transitionMap.get(currentState).get(event);
        application.setStatus(newState.getCode());
        application.setUpdateTime(LocalDateTime.now());

        // 触发状态变更监听器
        Consumer<RetirementApplication> listener = stateListeners.get(newState);
        if (listener != null) {
            listener.accept(application);
        }

        return newState;
    }

    /**
     * 检查是否可以从当前状态执行指定事件
     * 
     * @param currentState 当前状态
     * @param event 触发事件
     * @return 是否可以转换
     */
    public boolean canTransition(RetirementState currentState, RetirementEvent event) {
        Map<RetirementEvent, RetirementState> transitions = transitionMap.get(currentState);
        return transitions != null && transitions.containsKey(event);
    }

    /**
     * 获取可用的事件列表
     * 
     * @param currentState 当前状态
     * @return 可执行的事件列表
     */
    public java.util.List<RetirementEvent> getAvailableEvents(RetirementState currentState) {
        Map<RetirementEvent, RetirementState> transitions = transitionMap.get(currentState);
        if (transitions == null) {
            return java.util.Collections.emptyList();
        }
        return new java.util.ArrayList<>(transitions.keySet());
    }

    // === 状态变更监听器实现 ===

    /**
     * 进入待审批状态时的处理
     */
    private void onPendingApproval(RetirementApplication application) {
        // 创建审批链记录
        RetirementApprovalRecord approvalRecord = new RetirementApprovalRecord();
        approvalRecord.setApplicationId(application.getId());
        approvalRecord.setStatus(RetirementRequestStatus.PENDING_APPROVAL.getCode());
        approvalRecord.setCreateTime(LocalDateTime.now());
        approvalChainService.createApprovalChain(approvalRecord);
    }

    /**
     * 进入已批准状态时的处理
     */
    private void onApproved(RetirementApplication application) {
        // 更新审批链状态
        approvalChainService.updateApprovalStatus(
            application.getId(), 
            RetirementRequestStatus.APPROVED.getCode()
        );
    }

    /**
     * 进入已拒绝状态时的处理
     */
    private void onRejected(RetirementApplication application) {
        // 记录拒绝原因
        approvalChainService.rejectApproval(
            application.getId(),
            application.getRejectReason()
        );
    }

    /**
     * 进入处理中状态时的处理
     */
    private void onProcessing(RetirementApplication application) {
        // 执行资产退役处理
        retirementService.processRetirement(application);
    }

    /**
     * 进入已完成状态时的处理
     */
    private void onCompleted(RetirementApplication application) {
        // 标记资产为已退役状态
        retirementService.completeRetirement(application);
    }

    /**
     * 进入已取消状态时的处理
     */
    private void onCancelled(RetirementApplication application) {
        // 清理关联的审批记录
        approvalChainService.cancelApprovalChain(application.getId());
    }

    /**
     * 获取状态机配置信息
     * 
     * @return 状态转换规则映射
     */
    public Map<String, Object> getConfiguration() {
        Map<String, Object> config = new java.util.HashMap<>();
        config.put("type", "RetirementStateMachine");
        config.put("version", "1.0");
        config.put("deprecated", true);
        
        Map<String, Object> transitions = new java.util.HashMap<>();
        for (Map.Entry<RetirementState, Map<RetirementEvent, RetirementState>> entry 
                : transitionMap.entrySet()) {
            String state = entry.getKey().name();
            List<Map<String, String>> stateTransitions = new java.util.ArrayList<>();
            for (Map.Entry<RetirementEvent, RetirementState> transition : entry.getValue().entrySet()) {
                Map<String, String> t = new java.util.HashMap<>();
                t.put("event", transition.getKey().name());
                t.put("targetState", transition.getValue().name());
                stateTransitions.add(t);
            }
            transitions.put(state, stateTransitions);
        }
        config.put("transitions", transitions);
        
        return config;
    }

    /**
     * 验证状态机的完整性
     * 
     * @return 验证结果
     */
    public ValidationResult validate() {
        ValidationResult result = new ValidationResult();
        
        // 检查所有非终态都有至少一个转换
        for (RetirementState state : RetirementState.values()) {
            if (state.isTerminal()) {
                continue;
            }
            Map<RetirementEvent, RetirementState> transitions = transitionMap.get(state);
            if (transitions == null || transitions.isEmpty()) {
                result.addError("状态 " + state + " 缺少转换定义");
            }
        }
        
        // 检查监听器配置完整性
        for (RetirementState state : RetirementState.values()) {
            if (!state.isTerminal() && stateListeners.get(state) == null) {
                result.addWarning("状态 " + state + " 缺少监听器");
            }
        }
        
        return result;
    }

    /**
     * 验证结果内部类
     */
    public static class ValidationResult {
        private final List<String> errors = new java.util.ArrayList<>();
        private final List<String> warnings = new java.util.ArrayList<>();

        public void addError(String message) {
            errors.add(message);
        }

        public void addWarning(String message) {
            warnings.add(message);
        }

        public boolean isValid() {
            return errors.isEmpty();
        }

        public List<String> getErrors() {
            return errors;
        }

        public List<String> getWarnings() {
            return warnings;
        }
    }
}