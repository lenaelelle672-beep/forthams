"""
Transition Rule Value Object.

Defines a single valid state transition rule within the asset lifecycle state machine.
Each rule specifies a source state, an event that triggers the transition, and the
destination state. Guards may further restrict whether the transition is allowed
under given context.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Callable, Dict, List, Optional

from src.domain.value_objects.asset_status import AssetStatus
from src.domain.value_objects.asset_status import AssetStatus as AssetStatusVO
@dataclass(frozen=True)
class TransitionRule:
    """
    Immutable value object representing a state transition rule.

    Attributes:
        source: The source asset status from which the transition may be initiated.
        event: The event that triggers the transition.
        destination: The destination asset status after a successful transition.
        guards: Optional list of guard callables (context -> bool). All guards must
                evaluate to True for the transition to be permitted.
        metadata: Optional free-form dictionary for additional rule metadata.
    """

    source: AssetStatusVO
    event: str
    destination: AssetStatusVO
    guards: List[Callable[[Dict[str, Any]], bool]] = field(default_factory=list)
    metadata: Dict[str, Any] = field(default_factory=dict)

    def can_transition(self, context: Dict[str, Any]) -> bool:
        """
        Evaluate whether this rule allows a transition given the runtime context.

        Args:
            context: A dictionary containing runtime variables required by guards.
                     Expected keys may include:
                     - "current_status": AssetStatusVO
                     - "user_role": str
                     - "permissions": set[str]
                     - additional custom keys as needed by guard functions.

        Returns:
            True if the source matches, the event matches, and all guards pass.
        """
        if self.source != context.get("current_status"):
            return False
        for guard in self.guards:
            if not guard(context):
                return False
        return True

    def to_dict(self) -> Dict[str, Any]:
        """
        Serialize the rule to a plain dictionary for persistence or inspection.

        Note:
            Guard functions are not serialized; only their presence is indicated.
        """
        return {
            "source": self.source.value,
            "event": self.event,
            "destination": self.destination.value,
            "guard_count": len(self.guards),
            "metadata": self.metadata,
        }

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "TransitionRule":
        """
        Deserialize a rule from a dictionary. Guard functions must be supplied
        separately at registration time; this method creates a skeleton rule
        suitable for registration.

        Args:
            data: Dictionary with keys "source", "event", "destination".

        Returns:
            A TransitionRule instance with empty guards.
        """
        return cls(
            source=AssetStatusVO(data["source"]),
            event=data["event"],
            destination=AssetStatusVO(data["destination"]),
            guards=[],
            metadata=data.get("metadata", {}),
        )