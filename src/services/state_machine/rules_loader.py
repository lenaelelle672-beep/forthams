"""
Rules Loader Module for Asset State Machine.

This module is responsible for loading, validating, and providing access to
state transition rules for the asset retirement workflow engine.

Key Responsibilities:
    - Load state transition rules from configuration
    - Validate transition rules for consistency and determinism
    - Provide guard condition evaluation for transitions
    - Support rule caching and hot-reload for performance

Rules Structure:
    Each transition rule contains:
        - source_state: The originating state
        - target_state: The destination state
        - event: The trigger event
        - guards: Optional condition functions
        - required_permissions: RBAC permissions needed

Usage:
    >>> from src.services.state_machine.rules_loader import RulesLoader
    >>> loader = RulesLoader()
    >>> rules = loader.load_transition_rules()
    >>> loader.validate_rule(rule)
"""

from typing import Dict, List, Optional, Callable, Any, Set
from dataclasses import dataclass, field
from enum import Enum
import logging
import json
import hashlib
from functools import lru_cache

# Configure module logger
logger = logging.getLogger(__name__)


class RuleValidationError(Exception):
    """Exception raised when a rule fails validation."""
    pass


class TransitionEvent(str, Enum):
    """
    Enumeration of valid transition events in the retirement workflow.
    
    Events:
        SUBMIT: Initial retirement application submission
        APPROVE: Approval at any level in the chain
        REJECT: Rejection at any level in the chain
        FINAL_APPROVE: Final approval (end state)
        CANCEL: Application cancellation by applicant
        ESCALATE: Escalation to higher authority
    """
    SUBMIT = "submit_retirement"
    APPROVE = "approve"
    REJECT = "reject"
    FINAL_APPROVE = "final_approve"
    CANCEL = "cancel"
    ESCALATE = "escalate"


@dataclass(frozen=True)
class GuardCondition:
    """
    Represents a guard condition for a state transition.
    
    Guard conditions are predicates that must evaluate to True
    for a transition to be allowed.
    
    Attributes:
        name: Human-readable name for the condition
        description: Detailed explanation of the condition
        predicate: Callable that returns True if condition is met
        priority: Execution priority (lower = earlier)
    """
    name: str
    description: str
    predicate: Callable[[Dict[str, Any]], bool]
    priority: int = 0

    def evaluate(self, context: Dict[str, Any]) -> bool:
        """
        Evaluate the guard condition against the given context.
        
        Args:
            context: Dictionary containing evaluation context (asset data,
                    user permissions, approval state, etc.)
        
        Returns:
            bool: True if condition is satisfied, False otherwise
        """
        try:
            return self.predicate(context)
        except Exception as e:
            logger.error(f"Guard condition '{self.name}' failed: {e}")
            return False


@dataclass
class TransitionRule:
    """
    Defines a valid state transition in the retirement workflow.
    
    This class represents a single possible transition between states,
    including any guard conditions and required permissions.
    
    Attributes:
        source_state: State from which transition originates
        target_state: State to which transition leads
        event: Triggering event for this transition
        guards: List of guard conditions that must pass
        required_permissions: Set of permissions needed to execute
        description: Human-readable transition description
        is_deterministic: Whether transition has predictable outcome
    """
    source_state: str
    target_state: str
    event: str
    guards: List[GuardCondition] = field(default_factory=list)
    required_permissions: Set[str] = field(default_factory=set)
    description: str = ""
    is_deterministic: bool = True

    def __post_init__(self):
        """Validate rule consistency after initialization."""
        if not self.source_state:
            raise RuleValidationError("source_state cannot be empty")
        if not self.target_state:
            raise RuleValidationError("target_state cannot be empty")
        if not self.event:
            raise RuleValidationError("event cannot be empty")

    def can_transition(self, context: Dict[str, Any]) -> bool:
        """
        Check if this transition can execute given the current context.
        
        All guard conditions must evaluate to True for the transition
        to be allowed.
        
        Args:
            context: Evaluation context including asset state, user info, etc.
        
        Returns:
            bool: True if all guards pass, False otherwise
        """
        for guard in sorted(self.guards, key=lambda g: g.priority):
            if not guard.evaluate(context):
                logger.debug(
                    f"Transition {self.source_state} -> {self.target_state} "
                    f"blocked by guard '{guard.name}'"
                )
                return False
        return True

    def get_missing_permissions(self, user_permissions: Set[str]) -> Set[str]:
        """
        Determine which required permissions are missing from user.
        
        Args:
            user_permissions: Set of permissions the user currently has
        
        Returns:
            Set of missing permission names
        """
        return self.required_permissions - user_permissions


class RulesLoader:
    """
    Loads and manages state transition rules for the asset retirement workflow.
    
    This class provides the core rules loading functionality, including:
        - Loading rules from various sources (config, database, file)
        - Validating rules for consistency
        - Caching rules for performance
        - Supporting hot-reload of rule configurations
    
    Attributes:
        _rules_cache: Internal cache of loaded transition rules
        _validation_cache: Cache of validation results
        _config_source: Source identifier for rule configuration
    
    Example:
        >>> loader = RulesLoader()
        >>> loader.load_transition_rules()
        >>> rule = loader.get_rule("pending", "approved", "approve")
        >>> if rule and rule.can_transition(context):
        ...     execute_transition(rule)
    """

    # Default states for retirement workflow
    DEFAULT_STATES = frozenset([
        "draft",
        "pending",
        "level1_approving",
        "level2_approving",
        "level3_approving",
        "approved",
        "rejected",
        "cancelled",
        "retired"
    ])

    def __init__(self, config_source: Optional[str] = None):
        """
        Initialize the RulesLoader.
        
        Args:
            config_source: Optional path or identifier for rule configuration.
                         If None, uses default embedded rules.
        """
        self._config_source = config_source
        self._rules_cache: Dict[str, TransitionRule] = {}
        self._validation_cache: Dict[str, bool] = {}
        self._cache_key: Optional[str] = None
        self._logger = logging.getLogger(self.__class__.__name__)

    def _compute_cache_key(self, rules_data: Any) -> str:
        """
        Compute a hash key for the rules data cache.
        
        Args:
            rules_data: The rules data to hash
        
        Returns:
            str: Hexadecimal hash string
        """
        data_str = json.dumps(rules_data, sort_keys=True, default=str)
        return hashlib.sha256(data_str.encode()).hexdigest()[:16]

    def load_transition_rules(self) -> Dict[str, TransitionRule]:
        """
        Load all state transition rules from configuration.
        
        This method loads transition rules from the configured source,
        validates them, and returns a dictionary indexed by rule signature.
        
        Returns:
            Dict mapping rule signatures to TransitionRule objects
        
        Raises:
            RuleValidationError: If any rule fails validation
        """
        self._logger.info("Loading transition rules...")
        
        # Load raw rules data from source
        raw_rules = self._load_raw_rules()
        
        # Compute cache key for this data
        cache_key = self._compute_cache_key(raw_rules)
        
        # Return cached result if available and valid
        if self._cache_key == cache_key and self._rules_cache:
            self._logger.debug("Returning cached rules")
            return self._rules_cache
        
        # Parse and validate rules
        rules = {}
        for idx, raw_rule in enumerate(raw_rules):
            try:
                rule = self._parse_rule(raw_rule, idx)
                self.validate_rule(rule)
                
                # Create unique signature for rule
                signature = self._rule_signature(rule)
                rules[signature] = rule
                
            except (RuleValidationError, ValueError) as e:
                self._logger.error(f"Failed to parse rule {idx}: {e}")
                raise RuleValidationError(f"Rule {idx} invalid: {e}")
        
        # Update cache
        self._rules_cache = rules
        self._cache_key = cache_key
        self._validation_cache.clear()
        
        self._logger.info(f"Loaded {len(rules)} transition rules")
        return rules

    def _load_raw_rules(self) -> List[Dict[str, Any]]:
        """
        Load raw rule data from the configured source.
        
        Returns:
            List of raw rule dictionaries
        """
        # Default retirement workflow transition rules
        default_rules = [
            {
                "source_state": "draft",
                "target_state": "pending",
                "event": TransitionEvent.SUBMIT.value,
                "guards": [
                    {
                        "name": "has_asset_ownership",
                        "description": "User must own or manage the asset",
                        "priority": 1
                    }
                ],
                "required_permissions": ["retirement:submit"],
                "description": "Submit retirement application for review"
            },
            {
                "source_state": "pending",
                "target_state": "level1_approving",
                "event": TransitionEvent.APPROVE.value,
                "guards": [],
                "required_permissions": ["retirement:review"],
                "description": "Initial review and level 1 approval routing"
            },
            {
                "source_state": "level1_approving",
                "target_state": "level2_approving",
                "event": TransitionEvent.APPROVE.value,
                "guards": [
                    {
                        "name": "asset_value_threshold",
                        "description": "High-value assets require level 2 approval",
                        "predicate": "context.get('asset_value', 0) > 50000",
                        "priority": 1
                    }
                ],
                "required_permissions": ["retirement:level1_approve"],
                "description": "Level 1 approval granted, route to level 2"
            },
            {
                "source_state": "level1_approving",
                "target_state": "approved",
                "event": TransitionEvent.APPROVE.value,
                "guards": [
                    {
                        "name": "low_asset_value",
                        "description": "Low-value assets can be approved at level 1",
                        "predicate": "context.get('asset_value', 0) <= 50000",
                        "priority": 1
                    }
                ],
                "required_permissions": ["retirement:level1_approve"],
                "description": "Level 1 approval for low-value asset, final approval"
            },
            {
                "source_state": "level2_approving",
                "target_state": "level3_approving",
                "event": TransitionEvent.APPROVE.value,
                "guards": [
                    {
                        "name": "very_high_asset_value",
                        "description": "Very high-value assets require level 3 approval",
                        "predicate": "context.get('asset_value', 0) > 500000",
                        "priority": 1
                    }
                ],
                "required_permissions": ["retirement:level2_approve"],
                "description": "Level 2 approval granted, route to level 3"
            },
            {
                "source_state": "level2_approving",
                "target_state": "approved",
                "event": TransitionEvent.APPROVE.value,
                "guards": [
                    {
                        "name": "standard_asset_value",
                        "description": "Standard assets can be approved at level 2",
                        "predicate": "context.get('asset_value', 0) <= 500000",
                        "priority": 1
                    }
                ],
                "required_permissions": ["retirement:level2_approve"],
                "description": "Level 2 approval, final approval for standard assets"
            },
            {
                "source_state": "level3_approving",
                "target_state": "approved",
                "event": TransitionEvent.FINAL_APPROVE.value,
                "guards": [],
                "required_permissions": ["retirement:level3_approve"],
                "description": "Final approval granted, asset can be retired"
            },
            {
                "source_state": "pending",
                "target_state": "rejected",
                "event": TransitionEvent.REJECT.value,
                "guards": [
                    {
                        "name": "has_rejection_reason",
                        "description": "Rejection must include a reason",
                        "predicate": "'rejection_reason' in context and context['rejection_reason']",
                        "priority": 1
                    }
                ],
                "required_permissions": ["retirement:reject"],
                "description": "Application rejected during initial review"
            },
            {
                "source_state": "level1_approving",
                "target_state": "rejected",
                "event": TransitionEvent.REJECT.value,
                "guards": [
                    {
                        "name": "has_rejection_reason",
                        "description": "Rejection must include a reason",
                        "predicate": "'rejection_reason' in context and context['rejection_reason']",
                        "priority": 1
                    }
                ],
                "required_permissions": ["retirement:level1_reject"],
                "description": "Application rejected at level 1"
            },
            {
                "source_state": "level2_approving",
                "target_state": "rejected",
                "event": TransitionEvent.REJECT.value,
                "guards": [
                    {
                        "name": "has_rejection_reason",
                        "description": "Rejection must include a reason",
                        "predicate": "'rejection_reason' in context and context['rejection_reason']",
                        "priority": 1
                    }
                ],
                "required_permissions": ["retirement:level2_reject"],
                "description": "Application rejected at level 2"
            },
            {
                "source_state": "level3_approving",
                "target_state": "rejected",
                "event": TransitionEvent.REJECT.value,
                "guards": [
                    {
                        "name": "has_rejection_reason",
                        "description": "Rejection must include a reason",
                        "predicate": "'rejection_reason' in context and context['rejection_reason']",
                        "priority": 1
                    }
                ],
                "required_permissions": ["retirement:level3_reject"],
                "description": "Application rejected at level 3 (final)"
            },
            {
                "source_state": "draft",
                "target_state": "cancelled",
                "event": TransitionEvent.CANCEL.value,
                "guards": [],
                "required_permissions": ["retirement:cancel_own"],
                "description": "Applicant cancels their own draft application"
            },
            {
                "source_state": "pending",
                "target_state": "cancelled",
                "event": TransitionEvent.CANCEL.value,
                "guards": [
                    {
                        "name": "can_cancel_pending",
                        "description": "Pending applications can be cancelled",
                        "predicate": "context.get('current_user_id') == context.get('applicant_id')",
                        "priority": 1
                    }
                ],
                "required_permissions": ["retirement:cancel_own"],
                "description": "Applicant cancels pending application"
            }
        ]
        
        return default_rules

    def _parse_rule(self, raw_rule: Dict[str, Any], index: int) -> TransitionRule:
        """
        Parse a raw rule dictionary into a TransitionRule object.
        
        Args:
            raw_rule: Raw rule dictionary from configuration
            index: Rule index for error reporting
        
        Returns:
            Parsed TransitionRule object
        
        Raises:
            RuleValidationError: If required fields are missing
        """
        required_fields = ["source_state", "target_state", "event"]
        for field_name in required_fields:
            if field_name not in raw_rule:
                raise RuleValidationError(
                    f"Rule {index}: missing required field '{field_name}'"
                )
        
        # Parse guard conditions
        guards = []
        for guard_data in raw_rule.get("guards", []):
            predicate_func = self._create_guard_predicate(guard_data)
            guard = GuardCondition(
                name=guard_data.get("name", "unnamed_guard"),
                description=guard_data.get("description", ""),
                predicate=predicate_func,
                priority=guard_data.get("priority", 0)
            )
            guards.append(guard)
        
        # Parse required permissions
        permissions = set(raw_rule.get("required_permissions", []))
        
        return TransitionRule(
            source_state=raw_rule["source_state"],
            target_state=raw_rule["target_state"],
            event=raw_rule["event"],
            guards=guards,
            required_permissions=permissions,
            description=raw_rule.get("description", ""),
            is_deterministic=raw_rule.get("is_deterministic", True)
        )

    def _create_guard_predicate(self, guard_data: Dict[str, Any]) -> Callable:
        """
        Create a predicate function from guard configuration.
        
        Args:
            guard_data: Guard condition configuration
        
        Returns:
            Callable predicate function
        """
        # Handle inline predicate string
        predicate_expr = guard_data.get("predicate")
        if predicate_expr and isinstance(predicate_expr, str):
            # Use eval in a safe context for simple expressions
            def make_predicate(expr: str) -> Callable[[Dict], bool]:
                def predicate(context: Dict) -> bool:
                    try:
                        # Safe evaluation using context only
                        return bool(eval(expr, {"__builtins__": {}}, context))
                    except Exception:
                        return False
                return predicate
            return make_predicate(predicate_expr)
        
        # Handle predicate function directly
        predicate_func = guard_data.get("predicate_fn")
        if callable(predicate_func):
            return predicate_func
        
        # Default: always pass
        return lambda ctx: True

    def _rule_signature(self, rule: TransitionRule) -> str:
        """
        Generate a unique signature for a transition rule.
        
        Args:
            rule: The transition rule
        
        Returns:
            String signature in format "source->target@event"
        """
        return f"{rule.source_state}->{rule.target_state}@{rule.event}"

    def validate_rule(self, rule: TransitionRule) -> bool:
        """
        Validate a single transition rule for consistency.
        
        Validation checks include:
            - Source and target states are valid
            - Event is recognized
            - All guard conditions are well-formed
            - Required permissions are defined
        
        Args:
            rule: The rule to validate
        
        Returns:
            bool: True if validation passes
        
        Raises:
            RuleValidationError: If validation fails
        """
        cache_key = self._rule_signature(rule)
        
        # Return cached validation result
        if cache_key in self._validation_cache:
            return self._validation_cache[cache_key]
        
        # Validate state names
        if not rule.source_state or not rule.target_state:
            raise RuleValidationError("State names cannot be empty")
        
        # Validate event is not empty
        if not rule.event:
            raise RuleValidationError("Event cannot be empty")
        
        # Validate deterministic flag consistency
        if not rule.is_deterministic and rule.guards:
            self._logger.warning(
                f"Non-deterministic rule has guards: {cache_key}"
            )
        
        # Validate guard priorities are unique per rule
        priorities = [g.priority for g in rule.guards]
        if len(priorities) != len(set(priorities)):
            raise RuleValidationError(
                f"Duplicate guard priorities in rule: {cache_key}"
            )
        
        # Cache successful validation
        self._validation_cache[cache_key] = True
        return True

    def get_rule(
        self,
        source_state: str,
        target_state: str,
        event: str
    ) -> Optional[TransitionRule]:
        """
        Retrieve a specific transition rule by its key components.
        
        Args:
            source_state: The source state
            target_state: The target state
            event: The triggering event
        
        Returns:
            TransitionRule if found, None otherwise
        """
        rules = self.load_transition_rules()
        signature = f"{source_state}->{target_state}@{event}"
        return rules.get(signature)

    def get_valid_transitions(
        self,
        source_state: str,
        event: str,
        context: Dict[str, Any]
    ) -> List[TransitionRule]:
        """
        Get all valid transitions from a state for a given event.
        
        This method evaluates all potential transitions from the source
        state and returns those whose guards all pass.
        
        Args:
            source_state: Current state
            event: Triggering event
            context: Evaluation context for guard conditions
        
        Returns:
            List of valid TransitionRule objects (usually 0 or 1 for deterministic)
        """
        rules = self.load_transition_rules()
        valid_rules = []
        
        for rule in rules.values():
            if rule.source_state == source_state and rule.event == event:
                if rule.can_transition(context):
                    valid_rules.append(rule)
        
        return valid_rules

    def is_transition_allowed(
        self,
        source_state: str,
        target_state: str,
        event: str,
        context: Dict[str, Any]
    ) -> bool:
        """
        Check if a specific transition is allowed.
        
        This is the main entry point for transition validation,
        combining rule lookup with guard evaluation.
        
        Args:
            source_state: Current state
            target_state: Desired target state
            event: Triggering event
            context: Evaluation context
        
        Returns:
            bool: True if transition is allowed, False otherwise
        """
        rule = self.get_rule(source_state, target_state, event)
        if rule is None:
            self._logger.debug(
                f"No rule found for {source_state} -> {target_state} @ {event}"
            )
            return False
        
        return rule.can_transition(context)

    def invalidate_cache(self) -> None:
        """
        Invalidate the internal rules cache.
        
        Call this method after modifying rules configuration
        to ensure fresh rules are loaded on next access.
        """
        self._rules_cache.clear()
        self._validation_cache.clear()
        self._cache_key = None
        self._logger.info("Rules cache invalidated")

    def get_states(self) -> Set[str]:
        """
        Get all unique states referenced in the rules.
        
        Returns:
            Set of state names
        """
        rules = self.load_transition_rules()
        states = set()
        for rule in rules.values():
            states.add(rule.source_state)
            states.add(rule.target_state)
        return states

    def get_events(self) -> Set[str]:
        """
        Get all unique events referenced in the rules.
        
        Returns:
            Set of event names
        """
        rules = self.load_transition_rules()
        return {rule.event for rule in rules.values()}


# Module-level singleton instance for convenience
_default_loader: Optional[RulesLoader] = None


def get_rules_loader() -> RulesLoader:
    """
    Get the default rules loader instance.
    
    Returns:
        RulesLoader singleton instance
    """
    global _default_loader
    if _default_loader is None:
        _default_loader = RulesLoader()
    return _default_loader


def load_transition_rules() -> Dict[str, TransitionRule]:
    """
    Convenience function to load transition rules using default loader.
    
    Returns:
        Dictionary of transition rules
    """
    return get_rules_loader().load_transition_rules()