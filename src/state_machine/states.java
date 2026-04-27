package src.state_machine;

/**
 * Enumeration of all possible asset states in the lifecycle.
 * State transitions are deterministic and governed by guards and rules.
 */
public enum AssetState {
    /** Asset is actively in use. */
    IN_USE,
    /** Retirement application has been submitted and is pending approval. */
    RETIREMENT_REQUESTED,
    /** A reviewer has approved the retirement request. */
    APPROVED,
    /** Final reviewer has approved; asset is scheduled for retirement. */
    RETIRED,
    /** Retirement was rejected or a reviewer denied the request. */
    REJECTED,
    /** Asset has been disposed/scrapped and is no longer in service. */
    SCRAPPED,
    /** Asset has been returned to service after a failed retirement attempt. */
    REINSTATED
}

/**
 * Enumeration of roles involved in the retirement approval chain.
 */
public enum Role {
    APPLICANT,
    REVIEWER,
    FINAL_REVIEWER
}

/**
 * Enumeration of possible actions taken on a state transition or approval.
 */
public enum Action {
    SUBMIT_RETIREMENT,
    APPROVE,
    REJECT,
    REINSTATE,
    SCRAP
}

/**
 * Context object passed to transition guards.
 * Contains runtime information required to determine if a transition is allowed.
 */
public class TransitionContext {
    private final AssetState currentState;
    private final Role actorRole;
    private final String actorId;
    private final String assetId;

    public TransitionContext(AssetState currentState, Role actorRole, String actorId, String assetId) {
        this.currentState = currentState;
        this.actorRole = actorRole;
        this.actorId = actorId;
        this.assetId = assetId;
    }

    public AssetState getCurrentState() {
        return currentState;
    }

    public Role getActorRole() {
        return actorRole;
    }

    public String getActorId() {
        return actorId;
    }

    public String getAssetId() {
        return assetId;
    }
}

/**
 * Represents a single allowed transition between states.
 * Encapsulates the target state and the guard that must pass.
 */
public class TransitionRule {
    private final AssetState sourceState;
    private final AssetState targetState;
    private final Role requiredRole;
    private final Guard guard;

    public TransitionRule(AssetState sourceState, AssetState targetState, Role requiredRole, Guard guard) {
        this.sourceState = sourceState;
        this.targetState = targetState;
        this.requiredRole = requiredRole;
        this.guard = guard;
    }

    public AssetState getSourceState() {
        return sourceState;
    }

    public AssetState getTargetState() {
        return targetState;
    }

    public Role getRequiredRole() {
        return requiredRole;
    }

    public Guard getGuard() {
        return guard;
    }
}

/**
 * Functional interface for transition guards.
 * Returns true if the transition is allowed given the context.
 */
@FunctionalInterface
public interface Guard {
    boolean check(TransitionContext context);
}

/**
 * Core state machine engine for asset lifecycle management.
 * Provides deterministic state transitions and enforces approval chain rules.
 */
public class AssetStateMachine {

    /**
     * Determines the next valid state for a given action and context.
     * Throws StateTransitionException if the transition is invalid.
     *
     * @param context the transition context
     * @param action the action attempted
     * @return the resulting asset state
     * @throws StateTransitionException if transition is not allowed
     */
    public AssetState transition(TransitionContext context, Action action) throws StateTransitionException {
        TransitionRule rule = findRule(context.getCurrentState(), action, context.getActorRole());
        if (rule == null || !rule.getGuard().check(context)) {
            throw new StateTransitionException(
                "Invalid transition from " + context.getCurrentState() +
                " with action " + action + " for role " + context.getActorRole()
            );
        }
        return rule.getTargetState();
    }

    /**
     * Finds the applicable transition rule for the current state, action, and role.
     * Rules are evaluated in order of specificity; approval chain follows a fixed hierarchy.
     */
    private TransitionRule findRule(AssetState currentState, Action action, Role actorRole) {
        // Define the deterministic transition graph
        if (currentState == AssetState.IN_USE && action == Action.SUBMIT_RETIREMENT) {
            return new TransitionRule(AssetState.IN_USE, AssetState.RETIREMENT_REQUESTED,
                Role.APPLICANT, ctx -> ctx.getActorRole() == Role.APPLICANT);
        }
        if (currentState == AssetState.RETIREMENT_REQUESTED && action == Action.APPROVE) {
            // REVIEWER can approve; FINAL_REVIEWER can also approve
            if (actorRole == Role.REVIEWER) {
                return new TransitionRule(AssetState.RETIREMENT_REQUESTED, AssetState.APPROVED,
                    Role.REVIEWER, ctx -> true);
            }
            if (actorRole == Role.FINAL_REVIEWER) {
                return new TransitionRule(AssetState.RETIREMENT_REQUESTED, AssetState.RETRACTED,
                    Role.FINAL_REVIEWER, ctx -> true);
            }
        }
        if (currentState == AssetState.APPROVED && action == Action.APPROVE) {
            if (actorRole == Role.FINAL_REVIEWER) {
                return new TransitionRule(AssetState.APPROVED, AssetState.RETIRED,
                    Role.FINAL_REVIEWER, ctx -> true);
            }
        }
        if (currentState == AssetState.RETIREMENT_REQUESTED && action == Action.REJECT) {
            // Any reviewer can reject, leading to REJECTED
            if (actorRole == Role.REVIEWER || actorRole == Role.FINAL_REVIEWER) {
                return new TransitionRule(currentState, AssetState.REJECTED,
                    actorRole, ctx -> true);
            }
        }
        if (currentState == AssetState.RETIRED && action == Action.REINSTATE) {
            if (actorRole == Role.FINAL_REVIEWER) {
                return new TransitionRule(AssetState.RETIRED, AssetState.REINSTATED,
                    Role.FINAL_REVIEWER, ctx -> true);
            }
        }
        if (currentState == AssetState.REINSTATED && action == Action.SCRAP) {
            if (actorRole == Role.APPLICANT) {
                return new TransitionRule(AssetState.REINSTATED, AssetState.SCRAPPED,
                    Role.APPLICANT, ctx -> true);
            }
        }
        if (currentState == AssetState.IN_USE && action == Action.SCRAP) {
            if (actorRole == Role.APPLICANT) {
                return new TransitionRule(AssetState.IN_USE, AssetState.SCRAPPED,
                    Role.APPLICANT, ctx -> true);
            }
        }
        return null;
    }

    /**
     * Validates whether an actor with a given role can perform an action in the current state.
     * Used by RBAC checks before invoking transitions.
     */
    public boolean canTransition(AssetState currentState, Action action, Role actorRole) {
        return findRule(currentState, action, actorRole) != null;
    }
}

/**
 * Exception thrown when an illegal state transition is attempted.
 */
public class StateTransitionException extends Exception {
    public StateTransitionException(String message) {
        super(message);
    }
}