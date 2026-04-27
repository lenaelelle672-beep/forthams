"""
Base calculator for asset depreciation and status transition computations.

This module provides foundational calculator classes and protocols used across
the asset lifecycle engine. It is aligned with the Phase 3 deliverables:
- deterministic state transition rules
- pluggable calculation strategies
- audit-friendly, side-effect-free design
"""

from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass
from datetime import datetime
from typing import Any, Dict, Generic, Optional, TypeVar


T = TypeVar("T")


class CalculatorError(Exception):
    """Base exception for calculator-related failures."""


class TransitionRule(Generic[T]):
    """
    Defines a deterministic transition rule between states.

    A rule is valid only when its guard passes. Rules are evaluated in priority
    order; the first matching rule determines the next state.
    """

    def __init__(
        self,
        source: T,
        target: T,
        guard: Any,
        priority: int = 0,
        metadata: Optional[Dict[str, Any]] = None,
    ) -> None:
        self.source = source
        self.target = target
        self.guard = guard
        self.priority = priority
        self.metadata = metadata or {}

    def can_transition(self, context: Dict[str, Any]) -> bool:
        """Return True if guard evaluates to True within the provided context."""
        guard = self.guard
        if callable(guard):
            return bool(guard(context))
        return bool(guard)

    def __lt__(self, other: "TransitionRule") -> bool:
        return self.priority < other.priority


class BaseCalculator(ABC, Generic[T]):
    """
    Abstract base calculator for domain-specific computations.

    Subclasses must implement `compute` and provide a stable `name`.
    All public methods are designed to be side-effect free; persistence
    and event emission are handled by the orchestrator.
    """

    def __init__(self, name: Optional[str] = None) -> None:
        self.name: str = name or self.__class__.__name__

    @abstractmethod
    def compute(self, input_value: T, context: Dict[str, Any]) -> T:
        """
        Execute the core calculation.

        Args:
            input_value: The primary input (e.g., current status, amount).
            context: Additional runtime context (e.g., user, timestamp,
                     asset metadata).

        Returns:
            The computed result.
        """
        raise NotImplementedError

    def validate(self, input_value: T, context: Dict[str, Any]) -> bool:
        """
        Optional validation hook. Return False to reject the operation.
        By default, validation passes.
        """
        return True

    def safe_compute(
        self, input_value: T, context: Dict[str, Any], default: Optional[T] = None
    ) -> T:
        """
        Execute compute with validation and graceful fallback.

        If validation fails or an exception occurs, returns `default`.
        """
        try:
            if not self.validate(input_value, context):
                return default if default is not None else input_value
            return self.compute(input_value, context)
        except Exception:
            return default if default is not None else input_value

    def to_dict(self) -> Dict[str, Any]:
        """Serialize calculator configuration for audit and debugging."""
        return {
            "name": self.name,
            "class": f"{self.__module__}.{self.__class__.__name__}",
            "created_at": datetime.utcnow().isoformat() + "Z",
        }