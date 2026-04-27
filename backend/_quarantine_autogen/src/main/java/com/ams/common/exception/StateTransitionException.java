package com.ams.common.exception;

/**
 * Exception thrown when an invalid state transition is attempted in the work order
 * approval state machine.
 *
 * <p>State transitions are governed by the following rules:</p>
 * <ul>
 *   <li>PENDING → IN_REVIEW (approver claim)</li>
 *   <li>PENDING → CANCELLED (requester cancellation)</li>
 *   <li>IN_REVIEW → APPROVED (approval granted)</li>
 *   <li>IN_REVIEW → REJECTED (approval denied)</li>
 * </ul>
 *
 * <p>Terminal states (APPROVED, REJECTED, CANCELLED) cannot transition to any other state.</p>
 *
 * @author AMS Team
 * @since 1.0
 */
public class StateTransitionException extends BusinessException {

    private static final long serialVersionUID = 1L;

    /**
     * The source state from which the transition was attempted.
     */
    private final String sourceState;

    /**
     * The target state to which the transition was attempted.
     */
    private final String targetState;

    /**
     * The identifier of the entity (e.g., work order) for which the transition failed.
     */
    private final Long entityId;

    /**
     * Constructs a new StateTransitionException with the specified detail message,
     * source state, target state, and entity ID.
     *
     * @param message    the detail message
     * @param sourceState the current state of the entity
     * @param targetState the attempted target state
     * @param entityId    the ID of the entity
     */
    public StateTransitionException(String message, String sourceState,
                                     String targetState, Long entityId) {
        super(message);
        this.sourceState = sourceState;
        this.targetState = targetState;
        this.entityId = entityId;
    }

    /**
     * Constructs a new StateTransitionException with the specified detail message
     * and cause.
     *
     * @param message the detail message
     * @param cause   the cause of this exception
     */
    public StateTransitionException(String message, Throwable cause) {
        super(message, cause);
        this.sourceState = null;
        this.targetState = null;
        this.entityId = null;
    }

    /**
     * Returns the source state from which the transition was attempted.
     *
     * @return the source state, may be null if constructed without state info
     */
    public String getSourceState() {
        return sourceState;
    }

    /**
     * Returns the target state to which the transition was attempted.
     *
     * @return the target state, may be null if constructed without state info
     */
    public String getTargetState() {
        return targetState;
    }

    /**
     * Returns the identifier of the entity for which the transition failed.
     *
     * @return the entity ID, may be null if constructed without entity info
     */
    public Long getEntityId() {
        return entityId;
    }

    /**
     * Creates an exception for attempting to transition from a terminal state.
     *
     * @param entityId    the work order ID
     * @param currentState the current (terminal) state
     * @param targetState  the attempted target state
     * @return a new StateTransitionException instance
     */
    public static StateTransitionException terminalStateImmutable(Long entityId,
                                                                     String currentState,
                                                                     String targetState) {
        return new StateTransitionException(
            String.format("Cannot transition work order %d from terminal state '%s' to '%s'",
                          entityId, currentState, targetState),
            currentState, targetState, entityId
        );
    }

    /**
     * Creates an exception for an invalid state transition path.
     *
     * @param entityId    the work order ID
     * @param currentState the current state
     * @param targetState  the attempted target state
     * @return a new StateTransitionException instance
     */
    public static StateTransitionException invalidTransition(Long entityId,
                                                              String currentState,
                                                              String targetState) {
        return new StateTransitionException(
            String.format("Invalid state transition for work order %d: '%s' → '%s'",
                          entityId, currentState, targetState),
            currentState, targetState, entityId
        );
    }

    /**
     * Creates an exception for attempting a reverse (backward) transition.
     *
     * @param entityId     the work order ID
     * @param currentState the current state
     * @param targetState  the attempted target state
     * @return a new StateTransitionException instance
     */
    public static StateTransitionException reverseTransition(Long entityId,
                                                              String currentState,
                                                              String targetState) {
        return new StateTransitionException(
            String.format("Reverse transition not allowed for work order %d: '%s' → '%s'",
                          entityId, currentState, targetState),
            currentState, targetState, entityId
        );
    }
}