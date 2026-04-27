package com.ams.state;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * Exception thrown when a state transition in the work order state machine
 * is invalid or not permitted.
 *
 * <p>This exception is triggered in the following scenarios:</p>
 * <ul>
 *   <li>The current state does not permit the requested event</li>
 *   <li>The transition target state is unreachable from the current state</li>
 *   <li>An event is applied to a terminal state (e.g., CLOSED)</li>
 * </ul>
 *
 * <p>Example: Triggering SUBMIT on a PENDING work order will raise this
 * exception because DRAFT → PENDING is the only valid SUBMIT path.</p>
 *
 * <p>See {@link WorkOrderStateMachine} for the complete transition rules.</p>
 *
 * @see WorkOrderStateMachine
 * @see WorkOrderState
 */
public class StateTransitionException extends RuntimeException {

    private static final Logger logger = LoggerFactory.getLogger(StateTransitionException.class);

    private final WorkOrderState currentState;
    private final WorkOrderState attemptedState;
    private final String event;

    /**
     * Constructs a new StateTransitionException with detail message.
     *
     * @param message the detail message describing the invalid transition
     */
    public StateTransitionException(String message) {
        super(message);
        this.currentState = null;
        this.attemptedState = null;
        this.event = null;
    }

    /**
     * Constructs a new StateTransitionException with detail message and cause.
     *
     * @param message the detail message describing the invalid transition
     * @param cause   the cause of this exception
     */
    public StateTransitionException(String message, Throwable cause) {
        super(message, cause);
        this.currentState = null;
        this.attemptedState = null;
        this.event = null;
    }

    /**
     * Constructs a new StateTransitionException with full transition context.
     *
     * <p>This constructor records the current state, the attempted transition,
     * and the event name for debugging and audit purposes.</p>
     *
     * @param currentState  the current state of the work order
     * @param attemptedState the state that was attempted to transition to
     * @param event         the event that triggered the transition attempt
     */
    public StateTransitionException(WorkOrderState currentState,
                                    WorkOrderState attemptedState,
                                    String event) {
        super(buildMessage(currentState, attemptedState, event));
        this.currentState = currentState;
        this.attemptedState = attemptedState;
        this.event = event;
        logger.error("StateTransitionException: Invalid transition attempted — currentState={}, "
                     + "attemptedState={}, event={}",
                     currentState, attemptedState, event);
    }

    /**
     * Constructs a new StateTransitionException with full context and cause.
     *
     * @param currentState   the current state of the work order
     * @param attemptedState the state that was attempted to transition to
     * @param event          the event that triggered the transition attempt
     * @param cause          the cause of this exception
     */
    public StateTransitionException(WorkOrderState currentState,
                                    WorkOrderState attemptedState,
                                    String event,
                                    Throwable cause) {
        super(buildMessage(currentState, attemptedState, event), cause);
        this.currentState = currentState;
        this.attemptedState = attemptedState;
        this.event = event;
        logger.error("StateTransitionException: Invalid transition attempted — currentState={}, "
                     + "attemptedState={}, event={}",
                     currentState, attemptedState, event, cause);
    }

    /**
     * Returns the current state at the time of the exception.
     *
     * @return the current {@link WorkOrderState}, or null if not set
     */
    public WorkOrderState getCurrentState() {
        return currentState;
    }

    /**
     * Returns the attempted (invalid) state.
     *
     * @return the attempted {@link WorkOrderState}, or null if not set
     */
    public WorkOrderState getAttemptedState() {
        return attemptedState;
    }

    /**
     * Returns the event that triggered the invalid transition.
     *
     * @return the event name, or null if not set
     */
    public String getEvent() {
        return event;
    }

    /**
     * Builds a human-readable error message for the invalid transition.
     *
     * @param currentState  the current state
     * @param attemptedState the attempted state
     * @param event         the triggering event
     * @return a formatted error message string
     */
    private static String buildMessage(WorkOrderState currentState,
                                       WorkOrderState attemptedState,
                                       String event) {
        if (currentState == WorkOrderState.CLOSED) {
            return String.format(
                "Invalid transition: CLOSED is a terminal state and cannot receive any event '%s'",
                event
            );
        }
        return String.format(
            "Invalid state transition: cannot move from '%s' to '%s' via event '%s'",
            currentState,
            attemptedState,
            event
        );
    }
}