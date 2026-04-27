package com.ams.state;

import com.ams.common.exception.StateTransitionException;
import com.ams.entity.WorkOrder;
import org.springframework.stereotype.Component;

import java.util.*;

/**
 * Work Order State Machine
 *
 * Manages the state transitions for work order approval workflow.
 *
 * State Diagram:
 *   draft --submit--> pending_approval
 *   pending_approval --approve--> approved (terminal)
 *   pending_approval --reject--> rejected (terminal)
 *   pending_approval --revise--> draft --(resubmit)--> pending_approval
 *
 * Supported actions:
 *   - submit    : draft → pending_approval
 *   - approve   : pending_approval → approved
 *   - reject    : pending_approval → rejected
 *   - revise    : pending_approval → draft
 */
@Component
public class WorkOrderStateMachine {

    /** Terminal states — once entered the work order is no longer modifiable */
    private static final Set<WorkOrderState> TERMINAL_STATES = EnumSet.of(
        WorkOrderState.APPROVED,
        WorkOrderState.REJECTED
    );

    /** Mapping: current state → allowed actions (event → next state) */
    private static final Map<WorkOrderState, Map<String, WorkOrderState>> TRANSITION_TABLE;

    static {
        Map<WorkOrderState, Map<String, WorkOrderState>> table = new EnumMap<>(WorkOrderState.class);

        // draft → pending_approval
        Map<String, WorkOrderState> draftTransitions = new HashMap<>();
        draftTransitions.put("submit", WorkOrderState.PENDING_APPROVAL);
        table.put(WorkOrderState.DRAFT, Collections.unmodifiableMap(draftTransitions));

        // pending_approval → approved / rejected / draft(revise)
        Map<String, WorkOrderState> pendingTransitions = new HashMap<>();
        pendingTransitions.put("approve", WorkOrderState.APPROVED);
        pendingTransitions.put("reject", WorkOrderState.REJECTED);
        pendingTransitions.put("revise",  WorkOrderState.DRAFT);
        table.put(WorkOrderState.PENDING_APPROVAL, Collections.unmodifiableMap(pendingTransitions));

        // Terminal states have no outgoing transitions
        table.put(WorkOrderState.APPROVED,     Collections.emptyMap());
        table.put(WorkOrderState.REJECTED,     Collections.emptyMap());
    }

    /**
     * Attempts to transition a work order from its current state to a new state.
     *
     * @param workOrder the work order entity (state is read from {@code workOrder.status})
     * @param action    the requested action (submit | approve | reject | revise)
     * @return the updated work order entity with its status field mutated
     * @throws StateTransitionException if the transition is invalid
     */
    public WorkOrder transition(WorkOrder workOrder, String action) {
        WorkOrderState current = workOrder.getStatus();
        if (current == null) {
            throw new StateTransitionException("Work order status is null");
        }

        if (TERMINAL_STATES.contains(current)) {
            throw new StateTransitionException(
                "terminal_state_not_modifiable",
                current.name()
            );
        }

        Map<String, WorkOrderState> allowed = TRANSITION_TABLE.get(current);
        if (allowed == null || !allowed.containsKey(action)) {
            throw new StateTransitionException(
                "invalid_state_transition",
                current.name(),
                action
            );
        }

        WorkOrderState next = allowed.get(action);
        workOrder.setStatus(next);
        return workOrder;
    }

    /**
     * Returns whether a given action is valid for the work order's current state.
     *
     * @param workOrder the work order entity
     * @param action    the action to validate
     * @return true if the transition is allowed, false otherwise
     */
    public boolean canTransition(WorkOrder workOrder, String action) {
        WorkOrderState current = workOrder.getStatus();
        if (current == null || TERMINAL_STATES.contains(current)) {
            return false;
        }
        Map<String, WorkOrderState> allowed = TRANSITION_TABLE.get(current);
        return allowed != null && allowed.containsKey(action);
    }

    /**
     * Returns the set of actions that are valid for the work order's current state.
     *
     * @param workOrder the work order entity
     * @return unmodifiable set of allowed action names
     */
    public Set<String> getAllowedActions(WorkOrder workOrder) {
        WorkOrderState current = workOrder.getStatus();
        if (current == null || TERMINAL_STATES.contains(current)) {
            return Collections.emptySet();
        }
        Map<String, WorkOrderState> allowed = TRANSITION_TABLE.get(current);
        if (allowed == null) {
            return Collections.emptySet();
        }
        return Collections.unmodifiableSet(allowed.keySet());
    }

    /**
     * Returns whether the work order is in a terminal state.
     *
     * @param workOrder the work order entity
     * @return true if approved or rejected, false otherwise
     */
    public boolean isTerminal(WorkOrder workOrder) {
        WorkOrderState current = workOrder.getStatus();
        return current != null && TERMINAL_STATES.contains(current);
    }
}