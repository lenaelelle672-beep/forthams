package com.ams.event;

import com.ams.entity.WorkOrder;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Component;

/**
 * EventPublisher - 工单审批流程事件发布器
 * 
 * 负责在工作单状态变更时发布相应的事件，触发通知机制。
 * 支持状态机流转的各个关键节点的事件发布。
 * 
 * @since Iteration 1
 * @see WorkOrderApprovalEvent
 * @see WorkOrderStateChangeEvent
 */
@Slf4j
@Component
public class EventPublisher {

    private final ApplicationEventPublisher eventPublisher;

    /**
     * 构造函数
     * 
     * 注入Spring的事件发布器，用于发布领域事件
     * 
     * @param eventPublisher Spring应用事件发布器
     */
    public EventPublisher(ApplicationEventPublisher eventPublisher) {
        this.eventPublisher = eventPublisher;
    }

    /**
     * 发布工单审批通过事件
     * 
     * 当工单审批流程完成且审批通过时，调用此方法发布事件。
     * 通知服务将监听此事件并发送审批通过通知。
     * 
     * @param workOrder 工单实体
     * @param approverId 审批人ID
     * @param comment 审批意见
     * @throws IllegalArgumentException 当workOrder为null时抛出
     */
    public void publishApprovalSuccessEvent(WorkOrder workOrder, String approverId, String comment) {
        if (workOrder == null) {
            throw new IllegalArgumentException("WorkOrder cannot be null");
        }
        log.info("Publishing approval success event for workOrder: {}", workOrder.getId());
        WorkOrderApprovalEvent event = new WorkOrderApprovalEvent(
            this,
            workOrder.getId(),
            approverId,
            comment,
            WorkOrderApprovalEvent.EventType.APPROVED
        );
        eventPublisher.publishEvent(event);
    }

    /**
     * 发布工单驳回事件
     * 
     * 当工单审批被驳回时，调用此方法发布事件。
     * 通知服务将监听此事件并发送驳回通知，包含驳回原因。
     * 
     * @param workOrder 工单实体
     * @param rejecterId 驳回人ID
     * @param rejectReason 驳回原因
     * @throws IllegalArgumentException 当workOrder为null时抛出
     */
    public void publishRejectionEvent(WorkOrder workOrder, String rejecterId, String rejectReason) {
        if (workOrder == null) {
            throw new IllegalArgumentException("WorkOrder cannot be null");
        }
        log.info("Publishing rejection event for workOrder: {}, reason: {}", workOrder.getId(), rejectReason);
        WorkOrderApprovalEvent event = new WorkOrderApprovalEvent(
            this,
            workOrder.getId(),
            rejecterId,
            rejectReason,
            WorkOrderApprovalEvent.EventType.REJECTED
        );
        eventPublisher.publishEvent(event);
    }

    /**
     * 发布工单状态变更事件
     * 
     * 通用状态变更事件发布方法，用于追踪工单状态流转。
     * 适用于所有状态变更场景，包括提交、审批、归档等。
     * 
     * @param workOrder 工单实体
     * @param previousState 变更前状态
     * @param newState 变更后状态
     * @param operatorId 操作人ID
     * @throws IllegalArgumentException 当参数不合法时抛出
     */
    public void publishStateChangeEvent(WorkOrder workOrder, String previousState, String newState, String operatorId) {
        if (workOrder == null || previousState == null || newState == null) {
            throw new IllegalArgumentException("WorkOrder, previousState, and newState cannot be null");
        }
        log.info("Publishing state change event for workOrder: {}, from {} to {}", 
            workOrder.getId(), previousState, newState);
        WorkOrderStateChangeEvent event = new WorkOrderStateChangeEvent(
            this,
            workOrder.getId(),
            previousState,
            newState,
            operatorId
        );
        eventPublisher.publishEvent(event);
    }

    /**
     * 发布工单提交事件
     * 
     * 当工单从草稿状态提交进入待审批流程时，调用此方法。
     * 通知审批人员有新工单需要审批。
     * 
     * @param workOrder 工单实体
     * @param submitterId 提交人ID
     */
    public void publishSubmissionEvent(WorkOrder workOrder, String submitterId) {
        if (workOrder == null) {
            throw new IllegalArgumentException("WorkOrder cannot be null");
        }
        log.info("Publishing submission event for workOrder: {}", workOrder.getId());
        WorkOrderStateChangeEvent event = new WorkOrderStateChangeEvent(
            this,
            workOrder.getId(),
            "DRAFT",
            "PENDING_APPROVAL",
            submitterId
        );
        eventPublisher.publishEvent(event);
    }

    /**
     * 发布工单归档完成事件
     * 
     * 当工单审批流程完成并归档时，调用此方法。
     * 用于通知相关人员审批流程已全部完成。
     * 
     * @param workOrder 工单实体
     * @param operatorId 操作人ID
     */
    public void publishArchiveEvent(WorkOrder workOrder, String operatorId) {
        if (workOrder == null) {
            throw new IllegalArgumentException("WorkOrder cannot be null");
        }
        log.info("Publishing archive event for workOrder: {}", workOrder.getId());
        WorkOrderStateChangeEvent event = new WorkOrderStateChangeEvent(
            this,
            workOrder.getId(),
            "APPROVED",
            "ARCHIVED",
            operatorId
        );
        eventPublisher.publishEvent(event);
    }

    /**
     * 异步发布事件（用于高并发场景）
     * 
     * 在高并发场景下，为避免阻塞主流程，可使用异步方式发布事件。
     * 注意：异步事件的处理顺序不保证。
     * 
     * @param event 工单审批事件
     */
    public void publishEventAsync(WorkOrderApprovalEvent event) {
        log.debug("Async publishing event for workOrder: {}", event.getWorkOrderId());
        eventPublisher.publishEvent(event);
    }
}