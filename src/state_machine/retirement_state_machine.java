package src.state_machine;

import src.state_machine.states.RetirementState;
import src.state_machine.transitions.RetirementTransition;
import src.state_machine.guards.RetirementGuard;

/**
 * State machine engine managing the asset retirement lifecycle.
 * Implements deterministic state transitions, approval chain routing,
 * and atomic event persistence for auditability.
 */
public class RetirementStateMachine {

    private RetirementState currentState;
    private final RetirementGuard guard;
    private final RetirementTransition transition;

    /**
     * Constructs a new retirement state machine with initial state PENDING.
     */
    public RetirementStateMachine() {
        this.currentState = RetirementState.PENDING;
        this.guard = new RetirementGuard();
        this.transition = new RetirementTransition();
    }

    /**
     * Attempts to transition the machine to the next state given an event.
     * Enforces approval chain ordering and RBAC checks before applying transition.
     *
     * @param event the retirement event triggering the transition
     * @param userRole the role of the user performing the action
     * @return the new current state
     * @throws StateTransitionException if transition is invalid or unauthorized
     */
    public synchronized RetirementState transition(RetirementEvent event, String userRole) throws StateTransitionException {
        // RBAC permission check (minimal privilege)
        if (!guard.hasPermission(userRole, event, currentState)) {
            throw new StateTransitionException("Unauthorized: role " + userRole + " cannot perform " + event + " in state " + currentState);
        }

        // Deterministic transition validation
        RetirementState nextState = transition.nextState(currentState, event);
        if (nextState == null) {
            throw new StateTransitionException("Invalid transition: " + currentState + " --" + event + "-->");
        }

        // Enforce approval chain: cannot skip or reorder approvals
        if (!guard.validateApprovalSequence(currentState, nextState, event)) {
            throw new StateTransitionException("Approval chain violation: cannot bypass or reorder states");
        }

        // Apply transition atomically (state change + event persistence)
        currentState = nextState;
        persistEvent(event, currentState, userRole);
        return currentState;
    }

    /**
     * Persists an immutable event record for auditability.
     * In a real implementation, this would write to an event store.
     */
    private void persistEvent(RetirementEvent event, RetirementState newState, String userRole) {
        // TODO: integrate with event store / database transaction
        // Ensures atomic write of state change and event log
        System.out.println("[EVENT] " + event + " -> " + newState + " by " + userRole);
    }

    /**
     * Returns the current state of the machine.
     */
    public RetirementState getCurrentState() {
        return currentState;
    }

    /**
     * Resets the machine to initial state (used for testing).
     */
    public void reset() {
        this.currentState = RetirementState.PENDING;
    }
}