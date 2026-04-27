"""
Application Type Enumerations.

This module defines the supported application types within the asset lifecycle
management system, including retirement and maintenance workflows.
"""

from enum import Enum
from typing import Final
class ApplicationType(str, Enum):
    """Application type categories."""

    RETIREMENT = "retirement"
    """Asset retirement application."""
    MAINTENANCE = "maintenance"
    """Asset maintenance application."""
    DEPRECIATION = "depreciation"
    """Asset depreciation schedule update application."""
    TRANSFER = "transfer"
    """Asset transfer between departments/locations."""
    DISPOSAL = "disposal"
    """Asset disposal request."""

    @classmethod
    def values(cls) -> Final[list[str]]:
        """Return all enum values as a list of strings."""
        return [item.value for item in cls]

    @classmethod
    def is_valid(cls, value: str) -> bool:
        """Check if a string is a valid ApplicationType."""
        return value in cls._value2member_map_

    def label(self) -> str:
        """Human-readable label for the application type."""
        labels = {
            ApplicationType.RETIREMENT: "Retirement",
            ApplicationType.MAINTENANCE: "Maintenance",
            ApplicationType.DEPRECIATION: "Depreciation",
            ApplicationType.TRANSFER: "Transfer",
            ApplicationType.DISPOSAL: "Disposal",
        }
        return labels.get(self, self.value)