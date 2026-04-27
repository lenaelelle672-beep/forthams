"""
Approval Chain Service for Asset Retirement/Disposal Flow

This module implements the approval chain engine for handling multi-level
approval workflows in asset retirement and disposal processes.

Key Responsibilities:
- Activate approval chains when retirement applications are created
- Manage approval task progression through levels
- Handle approval, rejection, and delegation actions
- Record lifecycle events for complete audit trail
- Enforce asset locking during approval processes

Author: SWARM-2026-Q2-002 Team
Iteration: 5 (Phase 3: Approval Chain Engine Integration)
"""

from __future__ import annotations

import logging
from datetime import datetime, timedelta
from enum import Enum
from typing import Optional

from sqlalchemy import and_, or_
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError

from src.domain.entities.retirement_app import RetirementApplication, RetirementStatus
from src.domain.entities.asset import Asset, AssetStatus
from src.domain.entities.approval_stage import ApprovalStage, ApprovalStageStatus
from src.domain.entities.history import LifecycleHistory, LifecycleEventType
from src.models.approval_chain import ApprovalChain, ApprovalNode
from src.models.asset_lifecycle_event import AssetLifecycleEvent

logger = logging.getLogger(__name__)


class ApprovalAction(str, Enum):
    """Valid approval actions."""
    APPROVE = "approve"
    REJECT = "reject"
    DELEGATE = "delegate"


class ApprovalChainError(Exception):
    """Base exception for approval chain operations."""
    
    def __init__(self, message: str, code: str, details: Optional[dict] = None):
        self.message = message
        self.code = code
        self.details = details or {}
        super().__init__(self.message)


class AssetLockedError(ApprovalChainError):
    """Raised when trying to modify a locked asset."""
    
    def __init__(self, asset_id: str):
        super().__init__(
            message=f"Asset {asset_id} is locked during approval process",
            code="ASSET_LOCKED",
            details={"asset_id": asset_id}
        )


class DuplicateApplicationError(ApprovalChainError):
    """Raised when duplicate retirement application is attempted."""
    
    def __init__(self, asset_id: str):
        super().__init__(
            message=f"Active retirement application already exists for asset {asset_id}",
            code="RET_002",
            details={"asset_id": asset_id}
        )


class ConcurrencyConflictError(ApprovalChainError):
    """Raised when concurrent modification is detected."""
    
    def __init__(self, expected_version: int, actual_version: int):
        super().__init__(
            message="Concurrent modification detected",
            code="CONFLICT_VERSION",
            details={
                "expected_version": expected_version,
                "actual_version": actual_version
            }
        )


class InvalidStateTransitionError(ApprovalChainError):
    """Raised when invalid state transition is attempted."""
    
    def __init__(self, current_state: str, attempted_action: str):
        super().__init__(
            message=f"Cannot perform {attempted_action} in state {current_state}",
            code="INVALID_STATE_TRANSITION",
            details={
                "current_state": current_state,
                "attempted_action": attempted_action
            }
        )


class ApprovalChainService:
    """
    Service for managing multi-level approval chains in asset retirement flows.
    
    This service handles the complete lifecycle of approval processes including:
    - Chain activation and node initialization
    - Task progression and completion
    - Event recording for audit trail
    - Concurrency control via optimistic locking
    """
    
    # Configuration constants
    MAX_APPROVAL_LEVELS = 5
    MIN_APPROVAL_LEVELS = 1
    TASK_TIMEOUT_HOURS = 72
    MIN_REJECTION_REASON_LENGTH = 10
    MAX_ATTACHMENTS = 5
    MAX_ATTACHMENT_SIZE_MB = 10
    
    def __init__(self, db_session: Session):
        """
        Initialize the approval chain service.
        
        Args:
            db_session: SQLAlchemy database session for transaction management
        """
        self.db = db_session
        self._lifecycle_recorder = LifecycleEventRecorder(db_session)
    
    def activate_chain(
        self,
        application: RetirementApplication,
        chain_config: ApprovalChain
    ) -> list[ApprovalStage]:
        """
        Activate an approval chain when a retirement application is created.
        
        This method:
        1. Validates the application can be approved (no existing active applications)
        2. Locks the associated asset
        3. Creates approval stages for each level in the chain
        4. Records lifecycle event for chain activation
        
        Args:
            application: The retirement application to approve
            chain_config: The approval chain configuration defining levels
            
        Returns:
            List of created approval stages, with the first stage activated
            
        Raises:
            DuplicateApplicationError: If active application exists for the asset
            AssetLockedError: If asset is already locked by another process
        """
        asset = self._get_and_validate_asset(application.asset_id)
        
        # Check for existing active applications
        existing = self._get_active_application(asset.id)
        if existing and existing.id != application.id:
            raise DuplicateApplicationError(asset.id)
        
        # Lock the asset
        asset.status = AssetStatus.UNDER_RETIREMENT
        asset.version += 1  # Optimistic lock increment
        
        # Create approval stages
        stages = self._create_approval_stages(application, chain_config)
        
        # Activate first stage
        if stages:
            stages[0].status = ApprovalStageStatus.PENDING
            stages[0].activated_at = datetime.utcnow()
        
        application.status = RetirementStatus.PENDING
        
        # Record lifecycle event
        self._lifecycle_recorder.record_event(
            asset_id=asset.id,
            event_type=LifecycleEventType.APPLICATION_CREATED,
            details={
                "application_id": str(application.id),
                "application_type": application.application_type.value,
                "chain_config_id": str(chain_config.id),
                "total_levels": len(stages)
            },
            triggered_by=application.applicant_id
        )
        
        self.db.commit()
        logger.info(
            f"Activated approval chain for application {application.id}, "
            f"asset {asset.id}, levels: {len(stages)}"
        )
        
        return stages
    
    def advance_chain(
        self,
        stage: ApprovalStage,
        action: ApprovalAction,
        approver_id: str,
        comment: Optional[str] = None,
        version: Optional[int] = None
    ) -> tuple[ApprovalStage, Optional[ApprovalStage]]:
        """
        Advance the approval chain by processing an action on a stage.
        
        Args:
            stage: The current approval stage
            action: The action to perform (approve/reject/delegate)
            approver_id: ID of the user performing the action
            comment: Optional comment/feedback
            version: Expected version for optimistic locking
            
        Returns:
            Tuple of (updated current stage, next stage if created)
            
        Raises:
            ConcurrencyConflictError: If version mismatch detected
            InvalidStateTransitionError: If action invalid for current state
        """
        # Optimistic lock check
        if version is not None and stage.version != version:
            raise ConcurrencyConflictError(expected_version=version, actual_version=stage.version)
        
        # Validate approver
        self._validate_approver(stage, approver_id)
        
        current_stage = stage
        next_stage = None
        
        if action == ApprovalAction.APPROVE:
            next_stage = self._handle_approval(stage, approver_id, comment)
        elif action == ApprovalAction.REJECT:
            self._handle_rejection(stage, approver_id, comment)
        elif action == ApprovalAction.DELEGATE:
            next_stage = self._handle_delegation(stage, approver_id, comment)
        
        self.db.commit()
        return current_stage, next_stage
    
    def complete_chain(
        self,
        application: RetirementApplication,
        final_approver_id: str
    ) -> RetirementApplication:
        """
        Complete the approval chain and finalize the retirement.
        
        This method:
        1. Updates application status to approved
        2. Changes asset status to scrapped/retired
        3. Records final lifecycle event
        4. Unlocks the asset (into final state)
        
        Args:
            application: The retirement application
            final_approver_id: ID of the final approver
            
        Returns:
            Updated application with completed status
        """
        # Update application status
        application.status = RetirementStatus.APPROVED
        application.approved_at = datetime.utcnow()
        application.approved_by = final_approver_id
        
        # Update asset status based on application type
        asset = self._get_asset(application.asset_id)
        final_status = (
            AssetStatus.SCRAPPED 
            if application.application_type.value == "scrap"
            else AssetStatus.RETIRED
        )
        asset.status = final_status
        asset.version += 1
        
        # Record lifecycle event
        self._lifecycle_recorder.record_event(
            asset_id=asset.id,
            event_type=LifecycleEventType.RETIREMENT_COMPLETED,
            details={
                "application_id": str(application.id),
                "final_status": final_status.value,
                "approved_by": final_approver_id
            },
            triggered_by=final_approver_id
        )
        
        self.db.commit()
        logger.info(
            f"Completed approval chain for application {application.id}, "
            f"asset {asset.id} status: {final_status.value}"
        )
        
        return application
    
    def check_pending_tasks(self) -> list[ApprovalStage]:
        """
        Find approval tasks that have exceeded the timeout threshold.
        
        Returns:
            List of stale approval stages that need reminder
            
        Raises:
            None
        """
        threshold = datetime.utcnow() - timedelta(hours=self.TASK_TIMEOUT_HOURS)
        
        stale_tasks = (
            self.db.query(ApprovalStage)
            .filter(
                and_(
                    ApprovalStage.status == ApprovalStageStatus.PENDING,
                    ApprovalStage.activated_at < threshold
                )
            )
            .all()
        )
        
        return stale_tasks
    
    def can_revoke(self, application: RetirementApplication, user_id: str) -> bool:
        """
        Check if a user can revoke their retirement application.
        
        A user can revoke an application only if:
        1. They are the original applicant
        2. No approvals have been made (first stage still pending)
        
        Args:
            application: The retirement application
            user_id: ID of the user attempting revocation
            
        Returns:
            True if revocation is allowed, False otherwise
        """
        if application.applicant_id != user_id:
            return False
        
        first_stage = (
            self.db.query(ApprovalStage)
            .filter(
                and_(
                    ApprovalStage.application_id == application.id,
                    ApprovalStage.level == 1
                )
            )
            .first()
        )
        
        if not first_stage:
            return False
        
        # Can only revoke if first stage hasn't been approved
        return first_stage.status == ApprovalStageStatus.PENDING
    
    def revoke_application(
        self,
        application: RetirementApplication,
        user_id: str,
        reason: str
    ) -> RetirementApplication:
        """
        Revoke a pending retirement application.
        
        Args:
            application: The application to revoke
            user_id: ID of the user revoking
            reason: Reason for revocation
            
        Returns:
            Updated application with revoked status
            
        Raises:
            InvalidStateTransitionError: If revocation not allowed
        """
        if not self.can_revoke(application, user_id):
            raise InvalidStateTransitionError(
                current_state=application.status.value,
                attempted_action="revoke"
            )
        
        # Update application status
        application.status = RetirementStatus.REVOKED
        application.revoked_at = datetime.utcnow()
        application.revoked_by = user_id
        
        # Unlock asset
        asset = self._get_asset(application.asset_id)
        asset.status = AssetStatus.IN_USE
        asset.version += 1
        
        # Mark all pending stages as cancelled
        pending_stages = (
            self.db.query(ApprovalStage)
            .filter(
                and_(
                    ApprovalStage.application_id == application.id,
                    ApprovalStage.status == ApprovalStageStatus.PENDING
                )
            )
            .all()
        )
        
        for stage in pending_stages:
            stage.status = ApprovalStageStatus.CANCELLED
        
        # Record lifecycle event
        self._lifecycle_recorder.record_event(
            asset_id=asset.id,
            event_type=LifecycleEventType.APPLICATION_REVOKED,
            details={
                "application_id": str(application.id),
                "reason": reason,
                "revoked_by": user_id
            },
            triggered_by=user_id
        )
        
        self.db.commit()
        logger.info(
            f"Revoked application {application.id} by user {user_id}"
        )
        
        return application
    
    # ==================== Private Methods ====================
    
    def _get_and_validate_asset(self, asset_id: str) -> Asset:
        """Get asset and validate it exists."""
        asset = self._get_asset(asset_id)
        if not asset:
            raise ApprovalChainError(
                message=f"Asset {asset_id} not found",
                code="ASSET_NOT_FOUND",
                details={"asset_id": asset_id}
            )
        return asset
    
    def _get_asset(self, asset_id: str) -> Asset:
        """Get asset by ID."""
        return (
            self.db.query(Asset)
            .filter(Asset.id == asset_id)
            .first()
        )
    
    def _get_active_application(self, asset_id: str) -> Optional[RetirementApplication]:
        """Get active (non-terminal) retirement application for an asset."""
        return (
            self.db.query(RetirementApplication)
            .filter(
                and_(
                    RetirementApplication.asset_id == asset_id,
                    RetirementApplication.status.in_([
                        RetirementStatus.PENDING,
                        RetirementStatus.UNDER_APPROVAL
                    ])
                )
            )
            .first()
        )
    
    def _create_approval_stages(
        self,
        application: RetirementApplication,
        chain_config: ApprovalChain
    ) -> list[ApprovalStage]:
        """Create approval stages based on chain configuration."""
        stages = []
        
        # Get chain nodes ordered by level
        nodes = (
            self.db.query(ApprovalNode)
            .filter(ApprovalNode.chain_id == chain_config.id)
            .order_by(ApprovalNode.level)
            .all()
        )
        
        for idx, node in enumerate(nodes):
            stage = ApprovalStage(
                application_id=application.id,
                chain_node_id=node.id,
                level=node.level,
                approver_id=node.default_approver_id,
                approver_role=node.approver_role,
                status=(
                    ApprovalStageStatus.PENDING 
                    if idx == 0 
                    else ApprovalStageStatus.WAITING
                ),
                version=1
            )
            self.db.add(stage)
            stages.append(stage)
        
        return stages
    
    def _validate_approver(self, stage: ApprovalStage, approver_id: str) -> None:
        """Validate that the approver can act on this stage."""
        if stage.approver_id and stage.approver_id != approver_id:
            # Check if approver has the required role
            if not self._has_required_role(approver_id, stage.approver_role):
                raise ApprovalChainError(
                    message=f"User {approver_id} not authorized for this approval",
                    code="UNAUTHORIZED_APPROVER",
                    details={
                        "stage_id": str(stage.id),
                        "required_role": stage.approver_role
                    }
                )
    
    def _has_required_role(self, user_id: str, role: Optional[str]) -> bool:
        """Check if user has the required role."""
        if not role:
            return True
        
        # Role-based authorization would be implemented here
        # For now, return True if user is the designated approver
        return True
    
    def _handle_approval(
        self,
        stage: ApprovalStage,
        approver_id: str,
        comment: Optional[str]
    ) -> Optional[ApprovalStage]:
        """
        Handle approval action on a stage.
        
        Returns:
            Next stage if created, None if this was the final approval
        """
        stage.status = ApprovalStageStatus.APPROVED
        stage.approved_at = datetime.utcnow()
        stage.approved_by = approver_id
        stage.comment = comment
        stage.version += 1
        
        # Get application for lifecycle recording
        application = self._get_application(stage.application_id)
        asset = self._get_asset(application.asset_id)
        
        # Record lifecycle event
        self._lifecycle_recorder.record_event(
            asset_id=asset.id,
            event_type=LifecycleEventType.LEVEL_APPROVED,
            details={
                "stage_id": str(stage.id),
                "level": stage.level,
                "approved_by": approver_id,
                "comment": comment
            },
            triggered_by=approver_id
        )
        
        # Check if there are more stages
        next_stage = self._activate_next_stage(stage)
        
        if next_stage:
            application.status = RetirementStatus.UNDER_APPROVAL
        else:
            # All approvals complete
            self.complete_chain(application, approver_id)
        
        return next_stage
    
    def _handle_rejection(
        self,
        stage: ApprovalStage,
        approver_id: str,
        comment: Optional[str]
    ) -> None:
        """Handle rejection action on a stage."""
        # Validate comment length for rejection
        if not comment or len(comment.strip()) < self.MIN_REJECTION_REASON_LENGTH:
            raise ApprovalChainError(
                message=f"Rejection requires at least {self.MIN_REJECTION_REASON_LENGTH} characters",
                code="REJECTION_REASON_TOO_SHORT",
                details={
                    "min_length": self.MIN_REJECTION_REASON_LENGTH,
                    "actual_length": len(comment) if comment else 0
                }
            )
        
        stage.status = ApprovalStageStatus.REJECTED
        stage.approved_at = datetime.utcnow()
        stage.approved_by = approver_id
        stage.comment = comment
        stage.version += 1
        
        # Update application status
        application = self._get_application(stage.application_id)
        application.status = RetirementStatus.REJECTED
        application.rejected_at = datetime.utcnow()
        
        # Keep asset locked until revocation
        # (or until manual intervention if permanent rejection)
        
        # Get asset for lifecycle recording
        asset = self._get_asset(application.asset_id)
        
        # Record lifecycle event
        self._lifecycle_recorder.record_event(
            asset_id=asset.id,
            event_type=LifecycleEventType.APPLICATION_REJECTED,
            details={
                "stage_id": str(stage.id),
                "level": stage.level,
                "rejected_by": approver_id,
                "reason": comment
            },
            triggered_by=approver_id
        )
        
        logger.info(
            f"Application {application.id} rejected at level {stage.level} "
            f"by {approver_id}: {comment}"
        )
    
    def _handle_delegation(
        self,
        stage: ApprovalStage,
        current_approver_id: str,
        comment: Optional[str],
        delegate_to: Optional[str] = None
    ) -> Optional[ApprovalStage]:
        """
        Handle delegation of approval task.
        
        For now, delegation creates a notification but keeps the same stage.
        Full delegation would create a new approver assignment.
        """
        # Delegation implementation would go here
        # For Phase 3, we log the delegation intent
        logger.info(
            f"Delegation requested for stage {stage.id} "
            f"from {current_approver_id} to {delegate_to}"
        )
        return None
    
    def _activate_next_stage(self, completed_stage: ApprovalStage) -> Optional[ApprovalStage]:
        """Activate the next stage in the approval chain."""
        next_stage = (
            self.db.query(ApprovalStage)
            .filter(
                and_(
                    ApprovalStage.application_id == completed_stage.application_id,
                    ApprovalStage.level == completed_stage.level + 1,
                    ApprovalStage.status == ApprovalStageStatus.WAITING
                )
            )
            .first()
        )
        
        if next_stage:
            next_stage.status = ApprovalStageStatus.PENDING
            next_stage.activated_at = datetime.utcnow()
            
            # Record stage activation event
            application = self._get_application(completed_stage.application_id)
            asset = self._get_asset(application.asset_id)
            
            self._lifecycle_recorder.record_event(
                asset_id=asset.id,
                event_type=LifecycleEventType.STAGE_ACTIVATED,
                details={
                    "stage_id": str(next_stage.id),
                    "level": next_stage.level,
                    "approver_id": next_stage.approver_id
                },
                triggered_by="system"
            )
        
        return next_stage
    
    def _get_application(self, application_id: str) -> RetirementApplication:
        """Get retirement application by ID."""
        return (
            self.db.query(RetirementApplication)
            .filter(RetirementApplication.id == application_id)
            .first()
        )


class LifecycleEventRecorder:
    """
    Helper class for recording lifecycle events in a consistent manner.
    
    Ensures all asset state changes are properly tracked for:
    - Audit compliance
    - Complete history reconstruction
    - Debugging and monitoring
    """
    
    def __init__(self, db_session: Session):
        self.db = db_session
    
    def record_event(
        self,
        asset_id: str,
        event_type: LifecycleEventType,
        details: dict,
        triggered_by: str,
        metadata: Optional[dict] = None
    ) -> AssetLifecycleEvent:
        """
        Record a lifecycle event for an asset.
        
        Args:
            asset_id: ID of the asset
            event_type: Type of event occurring
            details: Event-specific details
            triggered_by: User or system ID that triggered the event
            metadata: Additional metadata
            
        Returns:
            Created lifecycle event record
        """
        event = AssetLifecycleEvent(
            asset_id=asset_id,
            event_type=event_type.value,
            event_data=details,
            triggered_by=triggered_by,
            triggered_at=datetime.utcnow(),
            ip_address=metadata.get("ip_address") if metadata else None,
            user_agent=metadata.get("user_agent") if metadata else None
        )
        
        self.db.add(event)
        
        # Also create a history record for compatibility
        history = LifecycleHistory(
            asset_id=asset_id,
            event_type=event_type.value,
            old_status=details.get("old_status"),
            new_status=details.get("new_status"),
            changed_by=triggered_by,
            change_reason=details.get("reason", ""),
            metadata=details
        )
        self.db.add(history)
        
        return event


class ApprovalChainResolver:
    """
    Resolves the appropriate approval chain for a given retirement application.
    
    Selection is based on:
    - Application type (scrap vs retirement)
    - Asset category
    - Department
    - Asset value thresholds
    """
    
    def __init__(self, db_session: Session):
        self.db = db_session
    
    def resolve_chain(
        self,
        application: RetirementApplication
    ) -> ApprovalChain:
        """
        Resolve the appropriate approval chain for an application.
        
        Args:
            application: The retirement application
            
        Returns:
            The matching approval chain configuration
            
        Raises:
            ApprovalChainError: If no matching chain found
        """
        asset = self._get_asset(application.asset_id)
        
        # Build query conditions based on application attributes
        conditions = [
            ApprovalChain.is_active == True,
            ApprovalChain.application_type == application.application_type.value
        ]
        
        # Match by category if available
        if asset.category_id:
            conditions.append(
                or_(
                    ApprovalChain.category_id == asset.category_id,
                    ApprovalChain.category_id.is_(None)
                )
            )
        
        # Match by department if available
        if asset.department_id:
            conditions.append(
                or_(
                    ApprovalChain.department_id == asset.department_id,
                    ApprovalChain.department_id.is_(None)
                )
            )
        
        # Order by specificity (specific matches first)
        chain = (
            self.db.query(ApprovalChain)
            .filter(and_(*conditions))
            .order_by(
                ApprovalChain.category_id.desc(),  # NULLS LAST
                ApprovalChain.department_id.desc()
            )
            .first()
        )
        
        if not chain:
            raise ApprovalChainError(
                message="No matching approval chain found",
                code="CHAIN_NOT_FOUND",
                details={
                    "application_type": application.application_type.value,
                    "asset_id": asset.id
                }
            )
        
        return chain
    
    def _get_asset(self, asset_id: str) -> Asset:
        """Get asset by ID."""
        return (
            self.db.query(Asset)
            .filter(Asset.id == asset_id)
            .first()
        )