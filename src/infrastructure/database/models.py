"""
Data models for the asset lifecycle management system.

This module defines persistent domain entities used across the application,
including core asset, status history, retirement, approval, and event models.
All models are designed to be compatible with the existing asset directory schema
and support immutable event sourcing for auditability.
"""

from __future__ import annotations

from datetime import datetime
from typing import List, Optional

from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    ForeignKey,
    Integer,
    String,
    Text,
    func,
)
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import Mapped, mapped_column, relationship

Base = declarative_base()
class Asset(Base):
    """Core asset entity representing an asset in the directory."""

    __tablename__ = "assets"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    asset_id: Mapped[str] = mapped_column(String(64), unique=True, nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    category: Mapped[Optional[str]] = mapped_column(String(128))
    status: Mapped[str] = mapped_column(String(64), default="active", nullable=False)
    current_owner: Mapped[Optional[str]] = mapped_column(String(128))
    location: Mapped[Optional[str]] = mapped_column(String(256))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    # Relationships
    status_history: Mapped[List["AssetStatusHistory"]] = relationship(
        "AssetStatusHistory", back_populates="asset", cascade="all, delete-orphan"
    )
    retirement: Mapped[Optional["AssetRetirement"]] = relationship(
        "AssetRetirement", back_populates="asset", uselist=False, cascade="all, delete-orphan"
    )
    events: Mapped[List["AssetStatusChangedEvent"]] = relationship(
        "AssetStatusChangedEvent", back_populates="asset", cascade="all, delete-orphan"
    )
class AssetStatusHistory(Base):
    """
    Immutable history record for every status transition of an asset.

    This table supports the "history persistence" requirement: all state changes
    are stored as append-only records, enabling full traceability and auditability.
    """

    __tablename__ = "asset_status_history"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    asset_id: Mapped[int] = mapped_column(ForeignKey("assets.id", ondelete="CASCADE"), nullable=False, index=True)
    from_status: Mapped[Optional[str]] = mapped_column(String(64))
    to_status: Mapped[str] = mapped_column(String(64), nullable=False)
    transition_reason: Mapped[Optional[str]] = mapped_column(Text)
    triggered_by: Mapped[Optional[str]] = mapped_column(String(128), comment="User or service that triggered the transition")
    metadata: Mapped[Optional[dict]] = mapped_column(Text, comment="JSON-serialized transition metadata")
    occurred_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    # Relationships
    asset: Mapped["Asset"] = relationship("Asset", back_populates="status_history")
class AssetStatusChangedEvent(Base):
    """
    Event-sourcing style event entity for status changes.

    Each status mutation produces an immutable event record, supporting
    the "history persistent and immutable" requirement.
    """

    __tablename__ = "asset_status_changed_events"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    asset_id: Mapped[int] = mapped_column(ForeignKey("assets.id", ondelete="CASCADE"), nullable=False, index=True)
    event_type: Mapped[str] = mapped_column(String(128), nullable=False)
    payload: Mapped[dict] = mapped_column(Text, comment="JSON-serialized event payload")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    # Relationships
    asset: Mapped["Asset"] = relationship("Asset", back_populates="events")
class AssetRetirement(Base):
    """
    Asset retirement application and approval state.

    Stores the lifecycle of a retirement request, including current stage,
    final decision, and timestamps.
    """

    __tablename__ = "asset_retirements"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    asset_id: Mapped[int] = mapped_column(ForeignKey("assets.id", ondelete="CASCADE"), nullable=False, unique=True)
    applicant_id: Mapped[Optional[str]] = mapped_column(String(128))
    requested_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    current_stage: Mapped[Optional[str]] = mapped_column(String(64), default="pending")
    status: Mapped[str] = mapped_column(String(64), default="pending", nullable=False)
    decision_reason: Mapped[Optional[str]] = mapped_column(Text)
    resolved_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    resolved_by: Mapped[Optional[str]] = mapped_column(String(128))

    # Relationships
    asset: Mapped["Asset"] = relationship("Asset", back_populates="retirement")
    approval_chain: Mapped[List["ApprovalRecord"]] = relationship(
        "ApprovalRecord", back_populates="retirement", cascade="all, delete-orphan", order_by="ApprovalRecord.sequence"
    )
class ApprovalRecord(Base):
    """
    Individual step in the approval chain.

    Supports multi-role approval (申请人/审批人/终审人), ordered routing,
    and immediate termination on any rejection ("已否决").
    """

    __tablename__ = "approval_records"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    retirement_id: Mapped[int] = mapped_column(ForeignKey("asset_retirements.id", ondelete="CASCADE"), nullable=False)
    role: Mapped[str] = mapped_column(String(64), nullable=False)  # applicant, reviewer, final_reviewer
    approver_id: Mapped[Optional[str]] = mapped_column(String(128))
    sequence: Mapped[int] = mapped_column(Integer, nullable=False)
    action: Mapped[Optional[str]] = mapped_column(String(32))  # approve, reject, return
    comment: Mapped[Optional[str]] = mapped_column(Text)
    decided_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))

    # Relationships
    retirement: Mapped["AssetRetirement"] = relationship("AssetRetirement", back_populates="approval_chain")
class ApprovalStage(Base):
    """
    Configuration of an approval stage (role + required RBAC permission).

    This table supports the "approval chain configuration & routing" requirement
    and enables RBAC-gated transitions.
    """

    __tablename__ = "approval_stages"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    role: Mapped[str] = mapped_column(String(64), unique=True, nullable=False)
    permission: Mapped[str] = mapped_column(String(256), nullable=False)
    order_index: Mapped[int] = mapped_column(Integer, nullable=False)
    is_final: Mapped[bool] = mapped_column(default=False)
class AssetStatusTransition(Base):
    """
    Deterministic state transition rule definition.

    Encodes valid status flows and guards so the state machine can enforce
    "deterministic (given input & context, output state is unique)" behavior.
    """

    __tablename__ = "asset_status_transitions"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    from_status: Mapped[str] = mapped_column(String(64), nullable=False)
    to_status: Mapped[str] = mapped_column(String(64), nullable=False)
    trigger: Mapped[str] = mapped_column(String(64), nullable=False)
    guard: Mapped[Optional[str]] = mapped_column(String(256), comment="Permission or expression required")
    is_valid: Mapped[bool] = mapped_column(default=True)
class RBACPermission(Base):
    """
    Minimal RBAC permission registry.

    Supports the "approval operations require RBAC checks under least-privilege" requirement.
    """

    __tablename__ = "rbac_permissions"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    role: Mapped[str] = mapped_column(String(64), nullable=False)
    permission: Mapped[str] = mapped_column(String(256), nullable=False)
    resource: Mapped[Optional[str]] = mapped_column(String(128))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())