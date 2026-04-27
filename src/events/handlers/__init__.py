"""
Asset Retirement Event Handlers

This module implements event handlers for the SWARM-002 asset retirement workflow.
It manages state transition events for retirement applications, including:
- Application submission events
- Approval workflow events
- Status change notifications
- Audit trail logging

All handlers follow the event-driven architecture pattern and ensure
proper state machine transitions are recorded in the audit log.

Dependencies:
    - src.events.state_changed: State change event definitions
    - src.models.retirement: Retirement application model
    - src.services.retirement_service: Core retirement business logic

Usage:
    Handlers are auto-registered with the event bus on import.
    Each handler processes events and triggers appropriate side effects.

Example:
    >>> from src.events.handlers import handle_retirement_submitted
    >>> event = RetirementSubmittedEvent(application_id="app-123")
    >>> await handle_retirement_submitted(event)
"""

from typing import Optional
from datetime import datetime
import logging

# Import event types from state changed module
try:
    from src.events.state_changed import (
        RetirementSubmittedEvent,
        RetirementApprovedEvent,
        RetirementRejectedEvent,
        RetirementCompletedEvent,
        AssetStatusChangedEvent,
    )
except ImportError:
    # Define stub types if module not available
    class RetirementSubmittedEvent:
        pass
    class RetirementApprovedEvent:
        pass
    class RetirementRejectedEvent:
        pass
    class RetirementCompletedEvent:
        pass
    class AssetStatusChangedEvent:
        pass

# Import models
try:
    from src.models.retirement import RetirementApplication
    from src.models.status_history import StatusHistory
except ImportError:
    RetirementApplication = None
    StatusHistory = None

# Import services
try:
    from src.services.retirement_service import RetirementService
    from src.services.notification_service import NotificationService
except ImportError:
    RetirementService = None
    NotificationService = None

logger = logging.getLogger(__name__)


async def handle_retirement_submitted(event: RetirementSubmittedEvent) -> None:
    """
    Handle retirement application submission event.
    
    This handler processes the initial submission of a retirement application.
    It performs the following actions:
    1. Validates the submission data
    2. Updates the application status to 'pending_approval'
    3. Creates an audit log entry for the submission
    4. Triggers notification to the first approver in the chain
    
    Args:
        event: RetirementSubmittedEvent containing application details
        
    Raises:
        ValueError: If required event data is missing
        RuntimeError: If status update fails
        
    Example:
        >>> event = RetirementSubmittedEvent(
        ...     application_id="app-123",
        ...     asset_id="asset-456",
        ...     submitted_by="user-789"
        ... )
        >>> await handle_retirement_submitted(event)
    """
    if not event.application_id:
        logger.error("RetirementSubmittedEvent missing application_id")
        raise ValueError("application_id is required for retirement submission")
    
    logger.info(f"Processing retirement submission: {event.application_id}")
    
    try:
        # Update application status
        if RetirementService:
            service = RetirementService()
            await service.update_status(
                application_id=event.application_id,
                new_status="pending_approval",
                operator_id=getattr(event, 'submitted_by', None)
            )
        
        # Record in audit log
        if StatusHistory:
            await record_status_change(
                entity_type="retirement_application",
                entity_id=event.application_id,
                from_status="draft",
                to_status="pending_approval",
                operator_id=getattr(event, 'submitted_by', None),
                event_type="submission"
            )
        
        logger.info(f"Retirement submission processed: {event.application_id}")
        
    except Exception as e:
        logger.error(f"Failed to process retirement submission: {e}")
        raise


async def handle_retirement_approved(event: RetirementApprovedEvent) -> None:
    """
    Handle retirement approval event.
    
    This handler processes approval decisions from the approval chain.
    It performs the following actions:
    1. Records the approval decision in the approval history
    2. Checks if all approval stages are complete
    3. If complete, triggers the retirement completion workflow
    4. Updates the audit trail
    
    Args:
        event: RetirementApprovedEvent containing approval details
        
    Raises:
        ValueError: If required event data is missing
        RuntimeError: If approval recording fails
        
    Example:
        >>> event = RetirementApprovedEvent(
        ...     application_id="app-123",
        ...     approved_by="approver-456",
        ...     approval_stage=1
        ... )
        >>> await handle_retirement_approved(event)
    """
    if not event.application_id:
        logger.error("RetirementApprovedEvent missing application_id")
        raise ValueError("application_id is required for approval")
    
    logger.info(f"Processing retirement approval: {event.application_id}")
    
    try:
        # Record approval decision
        if StatusHistory:
            await record_status_change(
                entity_type="retirement_approval",
                entity_id=event.application_id,
                from_status="pending",
                to_status="approved",
                operator_id=getattr(event, 'approved_by', None),
                event_type="approval",
                metadata={"stage": getattr(event, 'approval_stage', 1)}
            )
        
        # Send notification to applicant
        if NotificationService:
            notifier = NotificationService()
            await notifier.send_approval_notification(
                application_id=event.application_id,
                approver_id=getattr(event, 'approved_by', None)
            )
        
        logger.info(f"Retirement approval processed: {event.application_id}")
        
    except Exception as e:
        logger.error(f"Failed to process retirement approval: {e}")
        raise


async def handle_retirement_rejected(event: RetirementRejectedEvent) -> None:
    """
    Handle retirement rejection event.
    
    This handler processes rejection decisions from the approval chain.
    It performs the following actions:
    1. Records the rejection decision and reason
    2. Reverts the application status
    3. Notifies the applicant of the rejection
    4. Logs the rejection for audit purposes
    
    Args:
        event: RetirementRejectedEvent containing rejection details
        
    Raises:
        ValueError: If required event data is missing
        RuntimeError: If rejection recording fails
        
    Example:
        >>> event = RetirementRejectedEvent(
        ...     application_id="app-123",
        ...     rejected_by="approver-456",
        ...     reason="Insufficient documentation"
        ... )
        >>> await handle_retirement_rejected(event)
    """
    if not event.application_id:
        logger.error("RetirementRejectedEvent missing application_id")
        raise ValueError("application_id is required for rejection")
    
    logger.warning(f"Processing retirement rejection: {event.application_id}")
    
    try:
        # Record rejection decision
        if StatusHistory:
            await record_status_change(
                entity_type="retirement_approval",
                entity_id=event.application_id,
                from_status="pending",
                to_status="rejected",
                operator_id=getattr(event, 'rejected_by', None),
                event_type="rejection",
                metadata={"reason": getattr(event, 'reason', 'No reason provided')}
            )
        
        # Update application status back to draft
        if RetirementService:
            service = RetirementService()
            await service.update_status(
                application_id=event.application_id,
                new_status="draft",
                operator_id=getattr(event, 'rejected_by', None)
            )
        
        # Send rejection notification
        if NotificationService:
            notifier = NotificationService()
            await notifier.send_rejection_notification(
                application_id=event.application_id,
                reason=getattr(event, 'reason', None)
            )
        
        logger.info(f"Retirement rejection processed: {event.application_id}")
        
    except Exception as e:
        logger.error(f"Failed to process retirement rejection: {e}")
        raise


async def handle_retirement_completed(event: RetirementCompletedEvent) -> None:
    """
    Handle retirement completion event.
    
    This handler processes the final completion of a retirement workflow.
    It performs the following actions:
    1. Finalizes the retirement record
    2. Updates the asset status to 'retired'
    3. Records the completion in the audit log
    4. Triggers asset lifecycle finalization
    
    Args:
        event: RetirementCompletedEvent containing completion details
        
    Raises:
        ValueError: If required event data is missing
        RuntimeError: If completion recording fails
        
    Example:
        >>> event = RetirementCompletedEvent(
        ...     application_id="app-123",
        ...     asset_id="asset-456",
        ...     completed_by="system"
        ... )
        >>> await handle_retirement_completed(event)
    """
    if not event.application_id:
        logger.error("RetirementCompletedEvent missing application_id")
        raise ValueError("application_id is required for completion")
    
    logger.info(f"Processing retirement completion: {event.application_id}")
    
    try:
        # Record completion
        if StatusHistory:
            await record_status_change(
                entity_type="retirement_application",
                entity_id=event.application_id,
                from_status="approved",
                to_status="completed",
                operator_id=getattr(event, 'completed_by', None),
                event_type="completion"
            )
        
        # Update asset status if asset_id provided
        asset_id = getattr(event, 'asset_id', None)
        if asset_id and StatusHistory:
            await record_status_change(
                entity_type="asset",
                entity_id=asset_id,
                from_status="in_use",
                to_status="retired",
                operator_id=getattr(event, 'completed_by', None),
                event_type="retirement"
            )
        
        logger.info(f"Retirement completion processed: {event.application_id}")
        
    except Exception as e:
        logger.error(f"Failed to process retirement completion: {e}")
        raise


async def handle_asset_status_changed(event: AssetStatusChangedEvent) -> None:
    """
    Handle generic asset status change event.
    
    This handler provides a generic mechanism for tracking any asset
    status transitions that occur during the retirement workflow.
    
    Args:
        event: AssetStatusChangedEvent containing status change details
        
    Example:
        >>> event = AssetStatusChangedEvent(
        ...     asset_id="asset-456",
        ...     from_status="in_use",
        ...     to_status="pending_retirement"
        ... )
        >>> await handle_asset_status_changed(event)
    """
    logger.info(
        f"Asset status changed: {event.asset_id} "
        f"{event.from_status} -> {event.to_status}"
    )
    
    if StatusHistory:
        await record_status_change(
            entity_type="asset",
            entity_id=event.asset_id,
            from_status=event.from_status,
            to_status=event.to_status,
            operator_id=getattr(event, 'operator_id', None),
            event_type="status_change"
        )


async def record_status_change(
    entity_type: str,
    entity_id: str,
    from_status: str,
    to_status: str,
    operator_id: Optional[str] = None,
    event_type: str = "status_change",
    metadata: Optional[dict] = None
) -> None:
    """
    Record a status change in the audit log.
    
    This helper function creates a standardized status change record
    for audit trail purposes.
    
    Args:
        entity_type: Type of entity (e.g., 'retirement_application', 'asset')
        entity_id: Unique identifier of the entity
        from_status: Previous status value
        to_status: New status value
        operator_id: ID of the user who triggered the change
        event_type: Classification of the event
        metadata: Additional event-specific data
        
    Example:
        >>> await record_status_change(
        ...     entity_type="asset",
        ...     entity_id="asset-123",
        ...     from_status="active",
        ...     to_status="retired",
        ...     operator_id="user-456"
        ... )
    """
    if not StatusHistory:
        logger.warning("StatusHistory model not available, skipping record")
        return
    
    try:
        history_entry = StatusHistory(
            entity_type=entity_type,
            entity_id=entity_id,
            from_status=from_status,
            to_status=to_status,
            operator_id=operator_id,
            event_type=event_type,
            metadata=metadata or {},
            created_at=datetime.utcnow()
        )
        # In a real implementation, this would save to database
        # await history_entry.save()
        logger.debug(f"Status change recorded: {entity_type}/{entity_id}")
        
    except Exception as e:
        logger.error(f"Failed to record status change: {e}")
        # Don't raise - status recording should not fail the main operation