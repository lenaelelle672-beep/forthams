package com.ams.state;

import com.ams.enums.OrderStatus;

import java.util.EnumMap;
import java.util.Map;
import java.util.Objects;

/**
 * Work order state machine implementing the dual-level approval workflow.
 *
 * <p>State flow:</p>
 * <pre>
 *   PENDING ──SUBMIT──▶ APPROVING_LEVEL_1 ──APPROVE_LEVEL_1──▶ APPROVING_LEVEL_2 ──APPROVE_LEVEL_2──▶ APPROVED
 *      │                     │                                      │
 *      │CANCEL              │REJECT                               │REJECT
 *      ▼                     ▼                                      ▼
 *   CANCELLED            REJECTED                               REJECTED
 * </pre>
 *
 * <p>APPROVED, REJECTED, and CANCELLED are terminal states — no further
 * transitions are permitted. Cross-level transitions (e.g. PENDING →
 * APPROVING_LEVEL_2) are strictly prohibited and will throw
 * {@link StateTransitionException}.</p>
 *
 * <p>When triggering a {@link WorkOrderEvent#REJECT} event, a rejection reason
 * is mandatory and must contain at least {@value #MIN_REJECTION_REASON_LENGTH}
 * non-whitespace characters.</p>
 */
public class WorkOrderStateMachine {

    /** Minimum length (in non-whitespace characters) required for a rejection reason. */
    static final int MIN_REJECTION_REASON_LENGTH = 10;

    /** The current status of the work order managed by this state machine. */
    private OrderStatus currentStatus;

    /**
     * Events that can trigger state transitions in the work order lifecycle.
     *
     * <p>Each event corresponds to a single, well-defined transition edge in the
     * state diagram. Events are intentionally granular to prevent cross-level
     * approval (e.g. {@code APPROVE_LEVEL_1} can only fire from
     * {@code APPROVING_LEVEL_1}).</p>
     */
    public enum WorkOrderEvent {
        /** Submit a pending work order for level-1 (department supervisor) approval. */
        SUBMIT,

        /** Approve at level-1 — transitions from APPROVING_LEVEL_1 to APPROVING_LEVEL_2. */
        APPROVE_LEVEL_1,

        /** Approve at level-2 — transitions from APPROVING_LEVEL_2 to APPROVED. */
        APPROVE_LEVEL_2,

        /** Reject the work order at the current approval level — transitions to REJECTED. */
        REJECT,

        /** Cancel the work order — transitions from PENDING to CANCELLED. */
        CANCEL
    }

    // ──────────────────────────────────────────────────────────────────────
    // Transition table: source state → (event → target state)
    // ──────────────────────────────────────────────────────────────────────

    private static final Map<OrderStatus, Map<WorkOrderEvent, OrderStatus>> TRANSITION_TABLE;

    static {
        TRANSITION_TABLE = new EnumMap<>(OrderStatus.class);

        // PENDING → SUBMIT → APPROVING_LEVEL_1
        // PENDING → CANCEL → CANCELLED
        Map<WorkOrderEvent, OrderStatus> pendingTransitions = new EnumMap<>(WorkOrderEvent.class);
        pendingTransitions.put(WorkOrderEvent.SUBMIT, OrderStatus.APPROVING_LEVEL_1);
        pendingTransitions.put(WorkOrderEvent.CANCEL, OrderStatus.CANCELLED);
        TRANSITION_TABLE.put(OrderStatus.PENDING, pendingTransitions);

        // APPROVING_LEVEL_1 → APPROVE_LEVEL_1 → APPROVING_LEVEL_2
        // APPROVING_LEVEL_1 → REJECT → REJECTED
        Map<WorkOrderEvent, OrderStatus> l1Transitions = new EnumMap<>(WorkOrderEvent.class);
        l1Transitions.put(WorkOrderEvent.APPROVE_LEVEL_1, OrderStatus.APPROVING_LEVEL_2);
        l1Transitions.put(WorkOrderEvent.REJECT, OrderStatus.REJECTED);
        TRANSITION_TABLE.put(OrderStatus.APPROVING_LEVEL_1, l1Transitions);

        // APPROVING_LEVEL_2 → APPROVE_LEVEL_2 → APPROVED
        // APPROVING_LEVEL_2 → REJECT → REJECTED
        Map<WorkOrderEvent, OrderStatus> l2Transitions = new EnumMap<>(WorkOrderEvent.class);
        l2Transitions.put(WorkOrderEvent.APPROVE_LEVEL_2, OrderStatus.APPROVED);
        l2Transitions.put(WorkOrderEvent.REJECT, OrderStatus.REJECTED);
        TRANSITION_TABLE.put(OrderStatus.APPROVING_LEVEL_2, l2Transitions);

        // APPROVED, REJECTED, CANCELLED are terminal states — no outgoing transitions
    }

    // ──────────────────────────────────────────────────────────────────────
    // Constructors
    // ──────────────────────────────────────────────────────────────────────

    /**
     * Construct a state machine with the given initial status.
     *
     * @param initialStatus the starting status of the work order; must not be null
     * @throws NullPointerException if initialStatus is null
     */
    public WorkOrderStateMachine(OrderStatus initialStatus) {
        Objects.requireNonNull(initialStatus, "Initial status must not be null");
        this.currentStatus = initialStatus;
    }

    // ──────────────────────────────────────────────────────────────────────
    // Public API
    // ──────────────────────────────────────────────────────────────────────

    /**
     * Get the current status of the work order.
     *
     * @return the current order status, never null
     */
    public OrderStatus getCurrentStatus() {
        return currentStatus;
    }

    /**
     * Attempt a state transition triggered by the given event, with an optional
     * rejection reason.
     *
     * <p>For {@link WorkOrderEvent#REJECT} events, {@code rejectionReason} is
     * mandatory and must satisfy the business rule (non-blank, at least
     * {@value #MIN_REJECTION_REASON_LENGTH} characters after trimming). For all
     * other events, {@code rejectionReason} must be {@code null}.</p>
     *
     * @param event           the triggering event; must not be null
     * @param rejectionReason the rejection reason (required for REJECT, must be null otherwise)
     * @return the new status after a successful transition
     * @throws NullPointerException       if event is null
     * @throws StateTransitionException   if the transition is invalid, or rejection
     *                                    reason validation fails
     */
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
                String.format("No transitions allowed from terminal state %s", currentStatus));
        }

        OrderStatus targetStatus = allowedTransitions.get(event);
        if (targetStatus == null) {
            throw new StateTransitionException(
                String.format("Invalid transition: cannot apply %s from state %s", event, currentStatus));
        }

        this.currentStatus = targetStatus;
        return this.currentStatus;
    }

    /**
     * Attempt a state transition triggered by the given event (without a
     * rejection reason).
     *
     * <p>This is a convenience overload equivalent to
     * {@code transition(event, null)}.</p>
     *
     * @param event the triggering event; must not be null
     * @return the new status after a successful transition
     * @throws StateTransitionException if the transition is invalid
     */
    public OrderStatus transition(WorkOrderEvent event) {
        return transition(event, null);
    }

    /**
     * Check whether a given event can be applied in the current state without
     * actually performing the transition.
     *
     * @param event the event to check
     * @return {@code true} if the transition is allowed from the current state
     */
    public boolean canTransition(WorkOrderEvent event) {
        Map<WorkOrderEvent, OrderStatus> allowedTransitions = TRANSITION_TABLE.get(currentStatus);
        return allowedTransitions != null && allowedTransitions.containsKey(event);
    }

    /**
     * Check whether the current state is a terminal state (APPROVED, REJECTED,
     * or CANCELLED) from which no further transitions are possible.
     *
     * @return {@code true} if the current state is terminal
     */
    public boolean isTerminalState() {
        return currentStatus == OrderStatus.APPROVED
            || currentStatus == OrderStatus.REJECTED
            || currentStatus == OrderStatus.CANCELLED;
    }

    // ──────────────────────────────────────────────────────────────────────
    // Private helpers
    // ──────────────────────────────────────────────────────────────────────

    /**
     * Validate the rejection reason according to business rules.
     *
     * <p>The reason must be non-null, non-blank, and contain at least
     * {@value #MIN_REJECTION_REASON_LENGTH} non-whitespace characters.</p>
     *
     * @param reason the rejection reason to validate
     * @throws StateTransitionException if the reason is null, blank, or too short
     */
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

    /**
     * Exception thrown when an invalid state transition is attempted on a work
     * order, including rejection-reason validation failures.
     *
     * <p>This is an unchecked exception because invalid transitions represent
     * programming errors or business-rule violations that callers should handle
     * at the application boundary (e.g. translating to HTTP 409 / 400).</p>
     */
    public static class StateTransitionException extends RuntimeException {

        /**
         * Construct a new state transition exception with the given message.
         *
         * @param message the detail message explaining why the transition failed
         */
        public StateTransitionException(String message) {
            super(message);
        }

        /**
         * Construct a new state transition exception with the given message and cause.
         *
         * @param message the detail message
         * @param cause   the underlying cause
         */
        public StateTransitionException(String message, Throwable cause) {
            super(message, cause);
        }
    }
}