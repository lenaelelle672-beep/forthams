package com.ams.state;

import com.ams.entity.AssetStatusChangedEvent;
import com.ams.common.exception.StateTransitionException;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Component;

import java.time.LocalDateTime;
import java.util.EnumMap;
import java.util.EnumSet;
import java.util.Map;
import java.util.Set;
import java.util.function.Consumer;

/**
 * 资产状态流转引擎
 * 
 * 负责定义和管理资产状态枚举、流转规则、状态变更业务逻辑和事件发布机制。
 * 当前 Phase 1 实现核心状态流转逻辑，审批链功能在 Phase 2 实现，历史记录持久化在 Phase 3 实现。
 * 
 * @since 2024
 * @version 1.0
 */
@Component
public class AssetStatusTransition {

    /**
     * 资产状态枚举定义
     * 包含：正常使用、待报废、已报废、已处置
     */
    public enum AssetStatus {
        /** 正常使用 - 资产处于正常运行状态 */
        IN_SERVICE(0, "正常使用"),
        
        /** 待报废 - 已提交报废申请，等待审批 */
        PENDING_SCRAP(1, "待报废"),
        
        /** 已报废 - 报废申请已批准，资产已停止使用 */
        SCRAPPED(2, "已报废"),
        
        /** 已处置 - 资产已完成实物处置流程 */
        DISPOSED(3, "已处置");

        private final int code;
        private final String description;

        AssetStatus(int code, String description) {
            this.code = code;
            this.description = description;
        }

        /**
         * 获取状态编码
         * @return 状态编码
         */
        public int getCode() {
            return code;
        }

        /**
         * 获取状态描述
         * @return 状态描述
         */
        public String getDescription() {
            return description;
        }

        /**
         * 根据编码获取状态枚举
         * @param code 状态编码
         * @return 对应的资产状态枚举
         * @throws IllegalArgumentException 当编码无效时抛出
         */
        public static AssetStatus fromCode(int code) {
            for (AssetStatus status : AssetStatus.values()) {
                if (status.code == code) {
                    return status;
                }
            }
            throw new IllegalArgumentException("Invalid status code: " + code);
        }

        /**
         * 根据描述获取状态枚举
         * @param description 状态描述
         * @return 对应的资产状态枚举
         * @throws IllegalArgumentException 当描述无效时抛出
         */
        public static AssetStatus fromDescription(String description) {
            for (AssetStatus status : AssetStatus.values()) {
                if (status.description.equals(description)) {
                    return status;
                }
            }
            throw new IllegalArgumentException("Invalid status description: " + description);
        }
    }

    /**
     * 状态变更事件类
     * 记录状态变更的详细信息
     */
    public static class StatusChangedEvent {
        private final String assetId;
        private final AssetStatus fromStatus;
        private final AssetStatus toStatus;
        private final LocalDateTime timestamp;
        private final String operator;
        private final String reason;

        public StatusChangedEvent(String assetId, AssetStatus fromStatus, AssetStatus toStatus,
                                   LocalDateTime timestamp, String operator, String reason) {
            this.assetId = assetId;
            this.fromStatus = fromStatus;
            this.toStatus = toStatus;
            this.timestamp = timestamp;
            this.operator = operator;
            this.reason = reason;
        }

        public String getAssetId() {
            return assetId;
        }

        public AssetStatus getFromStatus() {
            return fromStatus;
        }

        public AssetStatus getToStatus() {
            return toStatus;
        }

        public LocalDateTime getTimestamp() {
            return timestamp;
        }

        public String getOperator() {
            return operator;
        }

        public String getReason() {
            return reason;
        }
    }

    /** 状态流转规则映射表 */
    private final Map<AssetStatus, Set<AssetStatus>> transitionRules;

    /** 事件发布器 */
    private ApplicationEventPublisher eventPublisher;

    /** 状态变更回调函数列表 */
    private final Map<AssetStatus, java.util.List<Consumer<StatusChangedEvent>>> statusChangeListeners;

    /**
     * 默认构造函数
     * 初始化状态流转规则
     */
    public AssetStatusTransition() {
        this.transitionRules = new EnumMap<>(AssetStatus.class);
        this.statusChangeListeners = new EnumMap<>(AssetStatus.class);
        initializeTransitionRules();
    }

    /**
     * 构造函数（带事件发布器）
     * @param eventPublisher 事件发布器
     */
    public AssetStatusTransition(ApplicationEventPublisher eventPublisher) {
        this();
        this.eventPublisher = eventPublisher;
    }

    /**
     * 设置事件发布器
     * @param eventPublisher 事件发布器
     */
    public void setEventPublisher(ApplicationEventPublisher eventPublisher) {
        this.eventPublisher = eventPublisher;
    }

    /**
     * 初始化状态流转规则
     * 定义合法的状态变更路径：
     * - 正常使用 → 待报废
     * - 待报废 → 已报废（审批通过）
     * - 待报废 → 正常使用（审批驳回）
     * - 已报废 → 已处置
     */
    private void initializeTransitionRules() {
        // 正常使用状态：只能流转到待报废
        transitionRules.put(AssetStatus.IN_SERVICE, 
            EnumSet.of(AssetStatus.PENDING_SCRAP));

        // 待报废状态：可以流转到已报废（审批通过）或退回正常使用（驳回）
        transitionRules.put(AssetStatus.PENDING_SCRAP, 
            EnumSet.of(AssetStatus.SCRAPPED, AssetStatus.IN_SERVICE));

        // 已报废状态：只能流转到已处置
        transitionRules.put(AssetStatus.SCRAPPED, 
            EnumSet.of(AssetStatus.DISPOSED));

        // 已处置状态：终止状态，不允许流转
        transitionRules.put(AssetStatus.DISPOSED, EnumSet.noneOf(AssetStatus.class));
    }

    /**
     * 检查状态变更是否合法
     * @param fromStatus 源状态
     * @param toStatus 目标状态
     * @return 是否合法
     */
    public boolean isValidTransition(AssetStatus fromStatus, AssetStatus toStatus) {
        Set<AssetStatus> allowedTransitions = transitionRules.get(fromStatus);
        return allowedTransitions != null && allowedTransitions.contains(toStatus);
    }

    /**
     * 执行状态变更
     * 验证流转规则并发布状态变更事件
     * 
     * @param assetId 资产ID
     * @param fromStatus 源状态
     * @param toStatus 目标状态
     * @param operator 操作人
     * @param reason 变更原因
     * @return 状态变更事件
     * @throws StateTransitionException 当状态变更不合法时抛出
     */
    public StatusChangedEvent transition(String assetId, AssetStatus fromStatus, 
                                         AssetStatus toStatus, String operator, String reason) {
        if (!isValidTransition(fromStatus, toStatus)) {
            throw new StateTransitionException(
                String.format("Invalid state transition from %s to %s", fromStatus, toStatus)
            );
        }

        StatusChangedEvent event = new StatusChangedEvent(
            assetId, fromStatus, toStatus, LocalDateTime.now(), operator, reason
        );

        publishEvent(event);
        notifyListeners(event);
        publishSpringEvent(event);

        return event;
    }

    /**
     * 执行状态变更（简化版，无需提供原因）
     * @param assetId 资产ID
     * @param fromStatus 源状态
     * @param toStatus 目标状态
     * @param operator 操作人
     * @return 状态变更事件
     * @throws StateTransitionException 当状态变更不合法时抛出
     */
    public StatusChangedEvent transition(String assetId, AssetStatus fromStatus,
                                         AssetStatus toStatus, String operator) {
        return transition(assetId, fromStatus, toStatus, operator, null);
    }

    /**
     * 发布内部事件
     * @param event 状态变更事件
     */
    private void publishEvent(StatusChangedEvent event) {
        // 内部事件发布逻辑
    }

    /**
     * 通知所有注册的监听器
     * @param event 状态变更事件
     */
    private void notifyListeners(StatusChangedEvent event) {
        java.util.List<Consumer<StatusChangedEvent>> listeners = statusChangeListeners.get(event.getToStatus());
        if (listeners != null) {
            for (Consumer<StatusChangedEvent> listener : listeners) {
                try {
                    listener.accept(event);
                } catch (Exception e) {
                    // 记录异常但不影响主流程
                }
            }
        }
    }

    /**
     * 发布 Spring ApplicationEvent
     * @param event 状态变更事件
     */
    private void publishSpringEvent(StatusChangedEvent event) {
        if (eventPublisher != null) {
            AssetStatusChangedEvent springEvent = new AssetStatusChangedEvent(
                this, event.getAssetId(), event.getFromStatus(), event.getToStatus(),
                event.getTimestamp(), event.getOperator(), event.getReason()
            );
            eventPublisher.publishEvent(springEvent);
        }
    }

    /**
     * 注册状态变更监听器
     * @param status 监听的目标状态
     * @param listener 监听回调函数
     */
    public void registerListener(AssetStatus status, Consumer<StatusChangedEvent> listener) {
        statusChangeListeners.computeIfAbsent(status, k -> new java.util.ArrayList<>()).add(listener);
    }

    /**
     * 获取指定状态允许的所有目标状态
     * @param fromStatus 源状态
     * @return 允许的目标状态集合
     */
    public Set<AssetStatus> getAllowedTransitions(AssetStatus fromStatus) {
        Set<AssetStatus> allowed = transitionRules.get(fromStatus);
        return allowed != null ? EnumSet.copyOf(allowed) : EnumSet.noneOf(AssetStatus.class);
    }

    /**
     * 获取所有资产状态枚举
     * @return 所有状态列表
     */
    public EnumSet<AssetStatus> getAllStatuses() {
        return EnumSet.allOf(AssetStatus.class);
    }

    /**
     * 验证资产状态是否有效
     * @param statusCode 状态编码
     * @return 是否有效
     */
    public boolean isValidStatusCode(int statusCode) {
        for (AssetStatus status : AssetStatus.values()) {
            if (status.code == statusCode) {
                return true;
            }
        }
        return false;
    }

    /**
     * 检查状态是否为终止状态（不可再流转）
     * @param status 资产状态
     * @return 是否为终止状态
     */
    public boolean isTerminalStatus(AssetStatus status) {
        Set<AssetStatus> allowed = transitionRules.get(status);
        return allowed == null || allowed.isEmpty();
    }

    /**
     * 获取状态流转规则描述
     * @param fromStatus 源状态
     * @return 允许流转的描述信息
     */
    public String getTransitionDescription(AssetStatus fromStatus) {
        Set<AssetStatus> allowed = getAllowedTransitions(fromStatus);
        if (allowed.isEmpty()) {
            return fromStatus.getDescription() + " 是终止状态，不允许流转";
        }

        StringBuilder sb = new StringBuilder();
        sb.append(fromStatus.getDescription()).append(" 可以流转到: ");
        for (AssetStatus status : allowed) {
            sb.append(status.getDescription()).append("、");
        }
        return sb.substring(0, sb.length() - 1);
    }
}