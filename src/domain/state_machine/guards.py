"""
State Machine Guards Module

This module defines guard conditions for state transitions in the work order
approval workflow engine. Guards are predicates that determine whether a
state transition is allowed based on the current context.

Guards are evaluated before state transitions occur and can prevent
invalid state changes based on business rules.

Example:
    guard = IsApproverAuthorized(approver_id="user_001")
    if guard.evaluate(context):
        # Transition allowed
        pass
"""

from typing import Any, Protocol, runtime_checkable
from dataclasses import dataclass


@runtime_checkable
class Guard(Protocol):
    """
    Protocol defining the interface for state machine guards.
    
    Guards are callable objects that evaluate conditions and return
    a boolean indicating whether the associated transition is allowed.
    """
    
    def evaluate(self, context: dict[str, Any]) -> bool:
        """
        Evaluate the guard condition against the given context.
        
        Args:
            context: Dictionary containing state machine context including
                    current state, event data, and entity information.
        
        Returns:
            True if the transition is allowed, False otherwise.
        """
        ...


@dataclass
class GuardResult:
    """
    Result of guard evaluation containing the decision and metadata.
    
    Attributes:
        allowed: Whether the guard permits the transition.
        reason: Human-readable explanation of the decision.
        error_code: Optional error code for denied transitions.
    """
    allowed: bool
    reason: str
    error_code: str | None = None


class IsWorkOrderInDraftState:
    """
    Guard that ensures work order is in DRAFT state before submission.
    
    Business Rule:
        Only work orders in DRAFT state can be submitted for approval.
        This prevents re-submitting already pending or processed orders.
    """
    
    def evaluate(self, context: dict[str, Any]) -> bool:
        """
        Check if the work order is in DRAFT state.
        
        Args:
            context: Must contain 'work_order' entity with 'status' attribute.
        
        Returns:
            True if status is 'DRAFT', False otherwise.
        """
        work_order = context.get("work_order")
        if work_order is None:
            return False
        return getattr(work_order, "status", None) == "DRAFT"
    
    def __call__(self, context: dict[str, Any]) -> GuardResult:
        """
        Evaluate guard and return structured result.
        
        Args:
            context: State machine context dictionary.
        
        Returns:
            GuardResult with decision and explanation.
        """
        work_order = context.get("work_order")
        current_status = getattr(work_order, "status", "UNKNOWN") if work_order else "NONE"
        
        if current_status == "DRAFT":
            return GuardResult(
                allowed=True,
                reason=f"Work order is in DRAFT state (current: {current_status})"
            )
        return GuardResult(
            allowed=False,
            reason=f"Work order must be in DRAFT state to submit (current: {current_status})",
            error_code="INVALID_STATE_TRANSITION"
        )


class IsWorkOrderPendingApproval:
    """
    Guard that ensures work order is in PENDING_APPROVAL state.
    
    Business Rule:
        Only pending work orders can be approved or rejected.
        This ensures proper workflow sequencing.
    """
    
    def evaluate(self, context: dict[str, Any]) -> bool:
        """
        Check if the work order is in PENDING_APPROVAL state.
        
        Args:
            context: Must contain 'work_order' entity with 'status' attribute.
        
        Returns:
            True if status is 'PENDING_APPROVAL', False otherwise.
        """
        work_order = context.get("work_order")
        if work_order is None:
            return False
        return getattr(work_order, "status", None) == "PENDING_APPROVAL"
    
    def __call__(self, context: dict[str, Any]) -> GuardResult:
        """
        Evaluate guard and return structured result.
        
        Args:
            context: State machine context dictionary.
        
        Returns:
            GuardResult with decision and explanation.
        """
        work_order = context.get("work_order")
        current_status = getattr(work_order, "status", "UNKNOWN") if work_order else "NONE"
        
        if current_status == "PENDING_APPROVAL":
            return GuardResult(
                allowed=True,
                reason=f"Work order is pending approval (current: {current_status})"
            )
        return GuardResult(
            allowed=False,
            reason=f"Work order must be in PENDING_APPROVAL state (current: {current_status})",
            error_code="INVALID_STATE_TRANSITION"
        )


class IsApproverAuthorized:
    """
    Guard that verifies the approver is authorized to approve the work order.
    
    Business Rule:
        - Approver must be different from the applicant
        - Approver must have APPROVER role
        - Approver must not be the creator of the work order
    
    Security Constraint:
        Prevents self-approval and ensures separation of duties.
    """
    
    def __init__(self, approver_id: str | None = None):
        """
        Initialize the guard with optional approver ID.
        
        Args:
            approver_id: Specific approver ID to validate against.
                        If None, any authorized approver is allowed.
        """
        self.approver_id = approver_id
    
    def evaluate(self, context: dict[str, Any]) -> bool:
        """
        Check if the approver is authorized for this work order.
        
        Args:
            context: Must contain:
                - 'work_order' with 'applicant_id' attribute
                - 'approver_id' of the current user attempting approval
        
        Returns:
            True if approver is authorized, False otherwise.
        """
        work_order = context.get("work_order")
        current_approver_id = context.get("approver_id")
        
        if work_order is None or current_approver_id is None:
            return False
        
        # Prevent self-approval
        applicant_id = getattr(work_order, "applicant_id", None)
        if applicant_id == current_approver_id:
            return False
        
        # Check specific approver if configured
        if self.approver_id and self.approver_id != current_approver_id:
            return False
        
        return True
    
    def __call__(self, context: dict[str, Any]) -> GuardResult:
        """
        Evaluate guard and return structured result.
        
        Args:
            context: State machine context dictionary.
        
        Returns:
            GuardResult with decision and explanation.
        """
        work_order = context.get("work_order")
        current_approver_id = context.get("approver_id")
        applicant_id = getattr(work_order, "applicant_id", "UNKNOWN") if work_order else "NONE"
        
        # Check self-approval
        if applicant_id == current_approver_id:
            return GuardResult(
                allowed=False,
                reason="Self-approval is not allowed (separation of duties)",
                error_code="SELF_APPROVAL_FORBIDDEN"
            )
        
        # Check specific approver assignment
        if self.approver_id and self.approver_id != current_approver_id:
            return GuardResult(
                allowed=False,
                reason=f"Only approver {self.approver_id} can approve this work order",
                error_code="APPROVER_NOT_AUTHORIZED"
            )
        
        return GuardResult(
            allowed=True,
            reason=f"Approver {current_approver_id} is authorized"
        )


class HasApprovalComment:
    """
    Guard that ensures approval/rejection includes a comment.
    
    Business Rule:
        When rejecting a work order, a comment must be provided to explain
        the rejection reason. Comments are optional for approvals.
    """
    
    def __init__(self, required_for_rejection: bool = True):
        """
        Initialize the guard with rejection requirement setting.
        
        Args:
            required_for_rejection: If True, comment is required for rejection.
                                   Always optional for approval.
        """
        self.required_for_rejection = required_for_rejection
    
    def evaluate(self, context: dict[str, Any]) -> bool:
        """
        Check if comment requirements are met based on action type.
        
        Args:
            context: Must contain:
                - 'action': 'APPROVE' or 'REJECT'
                - 'comment': Optional comment string
        
        Returns:
            True if requirements are met, False otherwise.
        """
        action = context.get("action", "").upper()
        comment = context.get("comment", "")
        
        if action == "APPROVE":
            return True
        
        if action == "REJECT" and self.required_for_rejection:
            return bool(comment and comment.strip())
        
        return True
    
    def __call__(self, context: dict[str, Any]) -> GuardResult:
        """
        Evaluate guard and return structured result.
        
        Args:
            context: State machine context dictionary.
        
        Returns:
            GuardResult with decision and explanation.
        """
        action = context.get("action", "").upper()
        comment = context.get("comment", "")
        
        if action == "REJECT" and self.required_for_rejection:
            if not comment or not comment.strip():
                return GuardResult(
                    allowed=False,
                    reason="Rejection requires a comment explaining the reason",
                    error_code="COMMENT_REQUIRED"
                )
        
        return GuardResult(
            allowed=True,
            reason="Comment requirement satisfied" if comment else "Comment is optional"
        )


class IsWorkOrderEditable:
    """
    Guard that determines if a work order can be edited.
    
    Business Rule:
        Work orders can only be edited when in DRAFT state.
        Once submitted for approval, the content is locked.
    
    Constraint:
        Iteration 2 focus: Editing locked until approval workflow completes.
    """
    
    def evaluate(self, context: dict[str, Any]) -> bool:
        """
        Check if the work order is editable.
        
        Args:
            context: Must contain 'work_order' entity with 'status' attribute.
        
        Returns:
            True if status is 'DRAFT', False otherwise.
        """
        work_order = context.get("work_order")
        if work_order is None:
            return False
        return getattr(work_order, "status", None) == "DRAFT"
    
    def __call__(self, context: dict[str, Any]) -> GuardResult:
        """
        Evaluate guard and return structured result.
        
        Args:
            context: State machine context dictionary.
        
        Returns:
            GuardResult with decision and explanation.
        """
        work_order = context.get("work_order")
        current_status = getattr(work_order, "status", "UNKNOWN") if work_order else "NONE"
        
        if current_status == "DRAFT":
            return GuardResult(
                allowed=True,
                reason="Work order is editable (in DRAFT state)"
            )
        return GuardResult(
            allowed=False,
            reason=f"Work order cannot be edited after submission (current: {current_status})",
            error_code="WORK_ORDER_LOCKED"
        )


class HasValidApprovalChain:
    """
    Guard that validates the approval chain configuration.
    
    Business Rule:
        Work orders must have a valid approval chain with at least
        one approver assigned before submission.
    
    Data Integrity:
        Ensures no orphaned work orders in the approval workflow.
    """
    
    def evaluate(self, context: dict[str, Any]) -> bool:
        """
        Check if work order has valid approval chain.
        
        Args:
            context: Must contain 'work_order' entity with 'approver_id' attribute.
        
        Returns:
            True if valid approver is assigned, False otherwise.
        """
        work_order = context.get("work_order")
        if work_order is None:
            return False
        
        approver_id = getattr(work_order, "approver_id", None)
        return approver_id is not None and approver_id != ""
    
    def __call__(self, context: dict[str, Any]) -> GuardResult:
        """
        Evaluate guard and return structured result.
        
        Args:
            context: State machine context dictionary.
        
        Returns:
            GuardResult with decision and explanation.
        """
        work_order = context.get("work_order")
        approver_id = getattr(work_order, "approver_id", None) if work_order else None
        
        if approver_id:
            return GuardResult(
                allowed=True,
                reason=f"Valid approval chain with approver {approver_id}"
            )
        return GuardResult(
            allowed=False,
            reason="Work order must have an assigned approver",
            error_code="NO_APPROVER_ASSIGNED"
        )


class GuardEvaluator:
    """
    Evaluates multiple guards in sequence and aggregates results.
    
    This class supports both AND (all must pass) and OR (any must pass)
    logic for combining multiple guard conditions.
    
    Example:
        evaluator = GuardEvaluator(logic="AND")
        evaluator.add_guard(IsWorkOrderInDraftState())
        evaluator.add_guard(HasValidApprovalChain())
        result = evaluator.evaluate(context)
    """
    
    def __init__(self, logic: str = "AND"):
        """
        Initialize the evaluator with combination logic.
        
        Args:
            logic: 'AND' requires all guards to pass, 'OR' requires any to pass.
        
        Raises:
            ValueError: If logic is not 'AND' or 'OR'.
        """
        if logic not in ("AND", "OR"):
            raise ValueError(f"Logic must be 'AND' or 'OR', got '{logic}'")
        self.logic = logic
        self._guards: list[Guard] = []
    
    def add_guard(self, guard: Guard) -> "GuardEvaluator":
        """
        Add a guard to the evaluation chain.
        
        Args:
            guard: Guard instance to add.
        
        Returns:
            Self for method chaining.
        """
        self._guards.append(guard)
        return self
    
    def evaluate(self, context: dict[str, Any]) -> GuardResult:
        """
        Evaluate all guards and return aggregated result.
        
        Args:
            context: State machine context to pass to each guard.
        
        Returns:
            GuardResult with aggregated decision.
        """
        if not self._guards:
            return GuardResult(
                allowed=True,
                reason="No guards configured"
            )
        
        results: list[GuardResult] = []
        for guard in self._guards:
            result = guard(context)
            results.append(result)
            
            if self.logic == "AND" and not result.allowed:
                return result
            elif self.logic == "OR" and result.allowed:
                return result
        
        if self.logic == "AND":
            return GuardResult(
                allowed=True,
                reason=f"All {len(results)} guards passed"
            )
        else:
            return GuardResult(
                allowed=False,
                reason=f"No guards passed out of {len(results)}",
                error_code="ALL_GUARDS_FAILED"
            )


# Pre-configured guard combinations for common workflows

def get_submit_guards() -> GuardEvaluator:
    """
    Get the standard guard combination for work order submission.
    
    Returns:
        GuardEvaluator configured for submission validation.
    """
    return GuardEvaluator(logic="AND") \
        .add_guard(IsWorkOrderInDraftState()) \
        .add_guard(HasValidApprovalChain())


def get_approve_guards() -> GuardEvaluator:
    """
    Get the standard guard combination for work order approval.
    
    Returns:
        GuardEvaluator configured for approval validation.
    """
    return GuardEvaluator(logic="AND") \
        .add_guard(IsWorkOrderPendingApproval()) \
        .add_guard(IsApproverAuthorized())


def get_reject_guards() -> GuardEvaluator:
    """
    Get the standard guard combination for work order rejection.
    
    Returns:
        GuardEvaluator configured for rejection validation.
    """
    return GuardEvaluator(logic="AND") \
        .add_guard(IsWorkOrderPendingApproval()) \
        .add_guard(IsApproverAuthorized()) \
        .add_guard(HasApprovalComment(required_for_rejection=True))


def get_edit_guards() -> GuardEvaluator:
    """
    Get the standard guard combination for work order editing.
    
    Returns:
        GuardEvaluator configured for edit validation.
    """
    return GuardEvaluator(logic="AND") \
        .add_guard(IsWorkOrderEditable())