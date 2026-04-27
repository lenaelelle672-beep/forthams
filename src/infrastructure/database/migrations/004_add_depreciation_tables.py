"""
Migration 004: Add depreciation-related tables and support structures.

This migration extends the asset lifecycle management schema with tables
required for depreciation calculation, scheduling, and integration with
the retirement/workflow engine.  All changes are backward compatible
with existing asset directory data.
"""

from datetime import datetime
from typing import Optional

from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    UniqueConstraint,
    event,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.ext.declarative import declared_attr
from sqlalchemy.orm import Mapped, mapped_column, relationship

from src.infrastructure.database.models import (
    Asset,
    Base,
    ApprovalProcess,
    AuditLog,
)
class DepreciationConfig(Base):
    """
    Holds depreciation policy configuration per asset category.
    Enables deterministic, rule-driven calculation methods (SLM, DDB, etc.).
    """

    __tablename__ = "depreciation_config"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    category_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("asset_category.id", ondelete="SET NULL"),
        nullable=True,
        doc="Asset category this configuration applies to.",
    )
    method: Mapped[str] = mapped_column(
        String(32),
        nullable=False,
        doc="Depreciation calculation method: straight_line, double_declining, etc.",
    )
    useful_life_months: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        doc="Expected useful life in months.",
    )
    salvage_value: Mapped[Optional[float]] = mapped_column(
        nullable=True,
        doc="Estimated residual value at end of useful life.",
    )
    is_active: Mapped[bool] = mapped_column(
        Boolean,
        default=True,
        nullable=False,
        doc="Whether this configuration is currently active.",
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=datetime.utcnow,
        nullable=False,
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=datetime.utcnow,
        onupdate=datetime.utcnow,
        nullable=False,
    )

    # Relationships
    category: Mapped["AssetCategory"] = relationship(
        back_populates="depreciation_configs"
    )
    depreciation_records: Mapped[list["DepreciationRecord"]] = relationship(
        back_populates="config", cascade="all, delete-orphan"
    )

    @declared_attr
    def __table_args__(cls):
        return (
            Index("ix_depreciation_config_category_id", "category_id"),
            Index("ix_depreciation_config_method", "method"),
        )
class DepreciationRecord(Base):
    """
    Immutable snapshot of a depreciation calculation for a specific period.
    Supports auditability and event sourcing for retirement workflows.
    """

    __tablename__ = "depreciation_record"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    asset_id: Mapped[int] = mapped_column(
        ForeignKey("asset.id", ondelete="CASCADE"),
        nullable=False,
        doc="Asset being depreciated.",
    )
    config_id: Mapped[int] = mapped_column(
        ForeignKey("depreciation_config.id", ondelete="RESTRICT"),
        nullable=False,
        doc="Configuration used for this calculation.",
    )
    period_start: Mapped[datetime] = mapped_column(
        DateTime,
        nullable=False,
        doc="Start of the depreciation period.",
    )
    period_end: Mapped[datetime] = mapped_column(
        DateTime,
        nullable=False,
        doc="End of the depreciation period.",
    )
    amount: Mapped[float] = mapped_column(
        nullable=False,
        doc="Depreciation amount for this period.",
    )
    book_value_start: Mapped[float] = mapped_column(
        nullable=False,
        doc="Book value at period start.",
    )
    book_value_end: Mapped[float] = mapped_column(
        nullable=False,
        doc="Book value at period end.",
    )
    notes: Mapped[Optional[str]] = mapped_column(
        Text,
        nullable=True,
        doc="Optional notes for this depreciation entry.",
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=datetime.utcnow,
        nullable=False,
    )

    # Relationships
    asset: Mapped["Asset"] = relationship(back_populates="depreciation_records")
    config: Mapped["DepreciationConfig"] = relationship(back_populates="depreciation_records")

    __table_args__ = (
        Index("ix_depreciation_record_asset_id_period_start", "asset_id", "period_start"),
        Index("ix_depreciation_record_period_end", "period_end"),
    )
class AssetDepreciation(Base):
    """
    Links an asset to its current active depreciation configuration.
    Enables quick lookup for depreciation scheduling and workflow integration.
    """

    __tablename__ = "asset_depreciation"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    asset_id: Mapped[int] = mapped_column(
        ForeignKey("asset.id", ondelete="CASCADE"),
        nullable=False,
    )
    config_id: Mapped[int] = mapped_column(
        ForeignKey("depreciation_config.id", ondelete="RESTRICT"),
        nullable=False,
    )
    effective_from: Mapped[datetime] = mapped_column(
        DateTime,
        default=datetime.utcnow,
        nullable=False,
    )
    effective_to: Mapped[Optional[datetime]] = mapped_column(
        nullable=True,
        doc="When this link was superseded (null = current).",
    )
    is_active: Mapped[bool] = mapped_column(
        Boolean,
        default=True,
        nullable=False,
    )

    __table_args__ = (
        UniqueConstraint("asset_id", "effective_from", name="uq_asset_effective_from"),
        Index("ix_asset_depreciation_active", "asset_id", "is_active"),
    )

    # Relationships
    asset: Mapped["Asset"] = relationship(back_populates="active_depreciation")
    config: Mapped["DepreciationConfig"] = relationship()
@event.listens_for(DepreciationRecord, "before_insert")
def validate_depreciation_period(mapper, connection, target):
    """
    Deterministic guard: ensure period_start < period_end and book values are non-negative.
    """
    if target.period_start >= target.period_end:
        raise ValueError("period_start must be before period_end")
    if target.book_value_start < 0 or target.book_value_end < 0:
        raise ValueError("book_value must be non-negative")
    if target.amount < 0:
        raise ValueError("depreciation amount must be non-negative")
# vim: set filetype=python ts=4 sw=4 et: