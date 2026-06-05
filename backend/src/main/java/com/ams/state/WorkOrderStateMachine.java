package com.ams.state;

import com.ams.enums.OrderStatus;

import java.util.EnumMap;
import java.util.Map;
import java.util.Objects;

/**
 * Work order state machine implementing the dual-level approval workflow
 * with hold/resume and acceptance/rework support.
 *
 * <p>State flow:</p>
 * <pre>
 *   PENDING ──SUBMIT──▶ APPROVING_LEVEL_1 ──APPROVE_LEVEL_1──▶ APPROVING_LEVEL_2 ──APPROVE_LEVEL_2──▶ APPROVED
 *      │                     │                                      │
 *      │CANCEL              │REJECT                               │REJECT
 *      ▼                     ▼                                      ▼
 *   CANCELLED            REJECTED                               REJECTED
 *
 *   APPROVED ──START──▶ EXECUTING ──COMPLETE──▶ COMPLETED ──SUBMIT_ACCEPTANCE──▶ PENDING_ACCEPTANCE
 *                          │                                                    │
 *                          │PUT_ON_HOLD                                         │ACCEPT
 *                          ▼                                                    ▼
 *                       ON_HOLD ──RESUME──▶ EXECUTING                        ACCEPTED (COMPLETED)
 *                          │                                                    │
 *                          │RESUME (auto)                                      │REJECT_ACCEPTANCE
 *                          ▼                                                    ▼
 *                       EXECUTING                                          ACCEPTANCE_REJECTED
 *                                                                                │
 *                                                                                │RESUME (返工)
 *                                                                                ▼
 *                                                                             EXECUTING
 * </pre>
 */
public class WorkOrderStateMachine {

    /** Minimum length (in non-whitespace characters) required for a rejection reason. */
    static final int MIN_REJECTION_REASON_LENGTH = 10;

    /** The current status of the work order managed by this state machine. */
    private OrderStatus currentStatus;

    /**
     * Events that can trigger state transitions in the work order lifecycle.
     */
    public enum WorkOrderEvent {
        /** Submit a pending work order for level-1 approval. */
        SUBMIT,
        /** Approve at level-1 — transitions from APPROVING_LEVEL_1 to APPROVING_LEVEL_2. */
        APPROVE_LEVEL_1,
        /** Approve at level-2 — transitions from APPROVING_LEVEL_2 to APPROVED. */
        APPROVE_LEVEL_2,
        /** Direct approve from PENDING to APPROVED (single-level, backward compatibility). */
        APPROVE,
        /** Reject the work order at the current approval level — transitions to REJECTED. */
        REJECT,
        /** Cancel the work order — transitions from PENDING/DRAFT to CANCELLED. */
        CANCEL,
        /** Start execution — transitions from APPROVED to EXECUTING. */
        START,
        /** Complete execution — transitions from EXECUTING to COMPLETED. */
        COMPLETE,
        /** Put on hold — transitions from EXECUTING to ON_HOLD. */
        PUT_ON_HOLD,
        /** Resume from hold — transitions from ON_HOLD to EXECUTING, or from ACCEPTANCE_REJECTED to EXECUTING. */
        RESUME,
        /** Submit for acceptance — transitions from COMPLETED to PENDING_ACCEPTANCE. */
        SUBMIT_ACCEPTANCE,
        /** Accept work order — transitions from PENDING_ACCEPTANCE to COMPLETED. */
        ACCEPT,
        /** Reject acceptance — transitions from PENDING_ACCEPTANCE to ACCEPTANCE_REJECTED. */
        REJECT_ACCEPTANCE,
    }

    // ──────────────────────────────────────────────────────────────────────
    // Transition table: source state → (event → target state)
    // ──────────────────────────────────────────────────────────────────────

    private static final Map<OrderStatus, Map<WorkOrderEvent, OrderStatus>> TRANSITION_TABLE;

    static {
        TRANSITION_TABLE = new EnumMap<>(OrderStatus.class);

        // DRAFT
        Map<WorkOrderEvent, OrderStatus> draftTransitions = new EnumMap<>(WorkOrderEvent.class);
        draftTransitions.put(WorkOrderEvent.SUBMIT, OrderStatus.PENDING);
        draftTransitions.put(WorkOrderEvent.CANCEL, OrderStatus.CANCELLED);
        TRANSITION_TABLE.put(OrderStatus.DRAFT, draftTransitions);

        // PENDING
        Map<WorkOrderEvent, OrderStatus> pendingTransitions = new EnumMap<>(WorkOrderEvent.class);
        pendingTransitions.put(WorkOrderEvent.SUBMIT, OrderStatus.APPROVING_LEVEL_1);
        pendingTransitions.put(WorkOrderEvent.APPROVE, OrderStatus.APPROVED);
        pendingTransitions.put(WorkOrderEvent.CANCEL, OrderStatus.CANCELLED);
        TRANSITION_TABLE.put(OrderStatus.PENDING, pendingTransitions);

        // APPROVING_LEVEL_1
        Map<WorkOrderEvent, OrderStatus> l1Transitions = new EnumMap<>(WorkOrderEvent.class);
        l1Transitions.put(WorkOrderEvent.APPROVE_LEVEL_1, OrderStatus.APPROVING_LEVEL_2);
        l1Transitions.put(WorkOrderEvent.REJECT, OrderStatus.REJECTED);
        TRANSITION_TABLE.put(OrderStatus.APPROVING_LEVEL_1, l1Transitions);

        // APPROVING_LEVEL_2
        Map<WorkOrderEvent, OrderStatus> l2Transitions = new EnumMap<>(WorkOrderEvent.class);
        l2Transitions.put(WorkOrderEvent.APPROVE_LEVEL_2, OrderStatus.APPROVED);
        l2Transitions.put(WorkOrderEvent.REJECT, OrderStatus.REJECTED);
        TRANSITION_TABLE.put(OrderStatus.APPROVING_LEVEL_2, l2Transitions);

        // APPROVED → EXECUTING
        Map<WorkOrderEvent, OrderStatus> approvedTransitions = new EnumMap<>(WorkOrderEvent.class);
        approvedTransitions.put(WorkOrderEvent.START, OrderStatus.EXECUTING);
        TRANSITION_TABLE.put(OrderStatus.APPROVED, approvedTransitions);

        // EXECUTING → COMPLETED, ON_HOLD, SUBMIT_ACCEPTANCE
        Map<WorkOrderEvent, OrderStatus> executingTransitions = new EnumMap<>(WorkOrderEvent.class);
        executingTransitions.put(WorkOrderEvent.COMPLETE, OrderStatus.COMPLETED);
        executingTransitions.put(WorkOrderEvent.PUT_ON_HOLD, OrderStatus.ON_HOLD);
        executingTransitions.put(WorkOrderEvent.SUBMIT_ACCEPTANCE, OrderStatus.PENDING_ACCEPTANCE);
        TRANSITION_TABLE.put(OrderStatus.EXECUTING, executingTransitions);

        // ON_HOLD → EXECUTING
        Map<WorkOrderEvent, OrderStatus> onHoldTransitions = new EnumMap<>(WorkOrderEvent.class);
        onHoldTransitions.put(WorkOrderEvent.RESUME, OrderStatus.EXECUTING);
        TRANSITION_TABLE.put(OrderStatus.ON_HOLD, onHoldTransitions);

        // COMPLETED → PENDING_ACCEPTANCE
        Map<WorkOrderEvent, OrderStatus> completedTransitions = new EnumMap<>(WorkOrderEvent.class);
        completedTransitions.put(WorkOrderEvent.SUBMIT_ACCEPTANCE, OrderStatus.PENDING_ACCEPTANCE);
        TRANSITION_TABLE.put(OrderStatus.COMPLETED, completedTransitions);

        // PENDING_ACCEPTANCE → COMPLETED (accepted), ACCEPTANCE_REJECTED
        Map<WorkOrderEvent, OrderStatus> pendingAcceptanceTransitions = new EnumMap<>(WorkOrderEvent.class);
        pendingAcceptanceTransitions.put(WorkOrderEvent.ACCEPT, OrderStatus.COMPLETED);
        pendingAcceptanceTransitions.put(WorkOrderEvent.REJECT_ACCEPTANCE, OrderStatus.ACCEPTANCE_REJECTED);
        TRANSITION_TABLE.put(OrderStatus.PENDING_ACCEPTANCE, pendingAcceptanceTransitions);

        // ACCEPTANCE_REJECTED → EXECUTING (rework)
        Map<WorkOrderEvent, OrderStatus> acceptanceRejectedTransitions = new EnumMap<>(WorkOrderEvent.class);
        acceptanceRejectedTransitions.put(WorkOrderEvent.RESUME, OrderStatus.EXECUTING);
        TRANSITION_TABLE.put(OrderStatus.ACCEPTANCE_REJECTED, acceptanceRejectedTransitions);

        // REJECTED, CANCELLED are terminal states — no outgoing transitions
    }

    // ──────────────────────────────────────────────────────────────────────
    // Constructors
    // ──────────────────────────────────────────────────────────────────────

    public WorkOrderStateMachine(OrderStatus initialStatus) {
        Objects.requireNonNull(initialStatus, "Initial status must not be null");
        this.currentStatus = initialStatus;
    }

    // ──────────────────────────────────────────────────────────────────────
    // Public API
    // ──────────────────────────────────────────────────────────────────────

    public OrderStatus getCurrentStatus() {
        return currentStatus;
    }

    public OrderStatus transition(WorkOrderEvent event, String rejectionReason) {
        Objects.requireNonNull(event, "Event must not be null");

        // ── Rejection-reason validation ──
        if (event == WorkOrderEvent.REJECT) {
            validateRejectionReason(rejectionReason);
        } else if (rejectionReason != null) {
            throw new StateTransitionException(
                String.format("Rejection reason must not be provided for event %s", event));
        }

        // ── Transition lookup ──
        Map<WorkOrderEvent, OrderStatus> allowedTransitions = TRANSITION_TABLE.get(currentStatus);
        if (allowedTransitions == null) {
            throw new StateTransitionException(
                String.format("No transitions allowed from state %s", currentStatus));
        }

        OrderStatus targetStatus = allowedTransitions.get(event);
        if (targetStatus == null) {
            throw new StateTransitionException(
                String.format("Invalid transition: cannot apply %s from state %s", event, currentStatus));
        }

        this.currentStatus = targetStatus;
        return this.currentStatus;
    }

    public OrderStatus transition(WorkOrderEvent event) {
        return transition(event, null);
    }

    public boolean canTransition(WorkOrderEvent event) {
        Map<WorkOrderEvent, OrderStatus> allowedTransitions = TRANSITION_TABLE.get(currentStatus);
        return allowedTransitions != null && allowedTransitions.containsKey(event);
    }

    public boolean isTerminalState() {
        return currentStatus == OrderStatus.REJECTED
            || currentStatus == OrderStatus.CANCELLED;
    }

    // ──────────────────────────────────────────────────────────────────────
    // Private helpers
    // ──────────────────────────────────────────────────────────────────────

    private void validateRejectionReason(String reason) {
        if (reason == null || reason.isBlank()) {
            throw new StateTransitionException(
                "Rejection reason is required when rejecting a work order");
        }
        int trimmedLength = reason.trim().length();
        if (trimmedLength < MIN_REJECTION_REASON_LENGTH) {
            throw new StateTransitionException(
                String.format(
                    "Rejection reason must be at least %d characters long, but was %d",
                    MIN_REJECTION_REASON_LENGTH, trimmedLength));
        }
    }

    // ──────────────────────────────────────────────────────────────────────
    // Nested exception
    // ──────────────────────────────────────────────────────────────────────

    public static class StateTransitionException extends RuntimeException {

        public StateTransitionException(String message) {
            super(message);
        }

        public StateTransitionException(String message, Throwable cause) {
            super(message, cause);
        }
    }
}
