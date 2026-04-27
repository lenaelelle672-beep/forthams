package src.state_machine;

import java.util.EnumMap;
import java.util.Map;
import java.util.Objects;

/**
 * Defines valid state transitions for the asset lifecycle state machine.
 * Supports deterministic mapping from current state + event to next state.
 * All transitions are validated against RBAC-guarded approval events.
 */
public final class Transitions {

  private final Map<State, Map<Event, State>> table;

  public Transitions() {
    table = new EnumMap<>(State.class);
    for (State s : State.values()) {
      table.put(s, new EnumMap<>(Event.class));
    }
    defineDefaultTransitions();
  }

  private void defineDefaultTransitions() {
    // In-use -> Retirement Requested (via submit)
    set(State.InUse, Event.SubmitRetirement, State.RetirementRequested);
    // RetirementRequested -> Under Review (first approval step)
    set(State.RetirementRequested, Event.ApproveStep, State.UnderReview);
    // UnderReview -> Approved (final approval)
    set(State.UnderReview, Event.ApproveStep, State.Approved);
    // UnderReview -> Rejected (any deny)
    set(State.UnderReview, Event.Reject, State.Rejected);
    // UnderReview -> Vetoed (final reviewer deny)
    set(State.UnderReview, Event.Veto, State.Vetoed);
    // Any non-terminal state can be cancelled by applicant
    set(State.InUse, Event.Cancel, State.Cancelled);
    set(State.RetirementRequested, Event.Cancel, State.Cancelled);
    set(State.UnderReview, Event.Cancel, State.Cancelled);
    // Approved -> Retired (completion)
    set(State.Approved, Event.Complete, State.Retired);
    // Approved -> Rejected if post-approval guard fails (safety net)
    set(State.Approved, Event.Reject, State.Rejected);
    // Rejected/Vetoed/Cancelled are terminal
    // No outgoing transitions from terminal states (deterministic sink)
  }

  private void set(State from, Event event, State to) {
    Objects.requireNonNull(from, "from state must not be null");
    Objects.requireNonNull(event, "event must not be null");
    Objects.requireNonNull(to, "to state must not be null");
    table.get(from).put(event, to);
  }

  /**
   * Returns the next state for the given current state and event.
   * Deterministic: given (state, event) pair there is exactly one next state.
   *
   * @param current current asset state
   * @param event triggered event/action
   * @return next state
   * @throws TransitionException if transition is undefined or not allowed
   */
  public State next(State current, Event event) throws TransitionException {
    Objects.requireNonNull(current, "current state must not be null");
    Objects.requireNonNull(event, "event must not be null");
    State next = table.get(current).get(event);
    if (next == null) {
      throw new TransitionException("Invalid transition: " + current + " --" + event + "-->");
    }
    return next;
  }

  /**
   * Enumeration of lifecycle states.
   * Order reflects progression; terminal states have no onward transitions.
   */
  public enum State {
    InUse,
    RetirementRequested,
    UnderReview,
    Approved,
    Retired,
    Rejected,
    Vetoed,
    Cancelled
  }

  /**
   * Enumeration of domain events that trigger transitions.
   * Aligned with approval-chain roles: applicant, approver, end-reviewer.
   */
  public enum Event {
    SubmitRetirement,
    ApproveStep,
    Veto,
    Reject,
    Cancel,
    Complete
  }

  /**
   * Exception raised when a transition is undefined or violates rules.
   * Ensures deterministic failure and preserves state integrity.
   */
  public static final class TransitionException extends RuntimeException {
    public TransitionException(String message) {
      super(message);
    }
  }
}