"""
Domain entities for the depreciation module.
"""

from dataclasses import dataclass, field
from datetime import date
from decimal import Decimal
from typing import Optional
@dataclass
class Asset:
    """Represents an asset in the system."""
    id: str
    name: str
    description: Optional[str] = None
    acquisition_date: date
    purchase_value: Decimal
    depreciation_method: str = "straight_line"
    useful_life_years: int = 5
    salvage_value: Decimal = Decimal("0.0")
    status: str = "active"
    created_at: date = field(default_factory=date.today)
    updated_at: date = field(default_factory=date.today)
@dataclass
class DepreciationRecord:
    """Represents a single depreciation record for an asset."""
    id: str
    asset_id: str
    period_start: date
    period_end: date
    depreciation_amount: Decimal
    accumulated_depreciation: Decimal
    book_value: Decimal
    calculated_at: date = field(default_factory=date.today)
@dataclass
class DepreciationConfig:
    """Configuration for depreciation calculations."""
    method: str = "straight_line"
    use_half_year_convention: bool = True
    rounding_precision: int = 2
@dataclass
class RetirementApplication:
    """Represents an asset retirement application."""
    id: str
    asset_id: str
    reason: str
    requested_date: date
    status: str = "pending"
    approved_date: Optional[date] = None
    rejected_date: Optional[date] = None
    approver_id: Optional[str] = None
@dataclass
class AuditLog:
    """Represents an audit log entry."""
    id: str
    entity_id: str
    entity_type: str
    action: str
    details: dict
    timestamp: date = field(default_factory=date.today)
    actor_id: Optional[str] = None
# Type aliases for clarity
AssetId = str
DepreciationMethod = str