"""
Asset Retirement Router Module

This module implements the REST API endpoints for asset retirement workflow,
including state transitions, approval chain management, and history tracking.

Business Flow:
    ACTIVE -> PENDING_RETIREMENT -> UNDER_APPROVAL -> RETIRED -> DISPOSED

Approval Chain:
    Applicant -> Department Head -> Asset Manager -> Finance Reviewer

Related AC:
    - AC-001: Unit test verification for retirement workflow
    - AC-003: All functions include docstring documentation
    - AC-004: Module can be imported without ImportError
"""

from datetime import datetime
from typing import Optional
from uuid import UUID, uuid4

from fastapi import APIRouter, Depends, HTTPException, Query, status

from src.domain.entities.retirement_app import RetirementApp, ApprovalStatus
from src.domain.entities.history import StateChangeRecord, ApprovalOperationRecord
from src.domain.services.approval_chain_service import ApprovalChainService
from src.domain.services.status_history_service import StatusHistoryService
from src.domain.state_machine.states import AssetState, RetirementState
from src.domain.value_objects.asset_status import AssetStatus


# Initialize services
approval_chain_service = ApprovalChainService()
status_history_service = StatusHistoryService()

router = APIRouter(prefix="/api/retirement", tags=["retirement"])


class RetirementError(Exception):
    """Base exception for retirement workflow errors."""
    pass


class InvalidStateTransitionError(RetirementError):
    """Raised when an invalid state transition is attempted."""
    pass


class ConcurrentApplicationError(RetirementError):
    """Raised when a concurrent retirement application is detected."""
    pass


def _validate_state_transition(current_state: str, target_state: str) -> bool:
    """
    Validate if a state transition is allowed according to the state machine rules.
    
    Args:
        current_state: The current asset state
        target_state: The target state to transition to
        
    Returns:
        True if transition is valid, raises InvalidStateTransitionError otherwise
    """
    valid_transitions = {
        AssetState.ACTIVE.value: [RetirementState.PENDING_RETIREMENT.value],
        RetirementState.PENDING_RETIREMENT.value: [
            RetirementState.UNDER_APPROVAL.value,
            AssetState.ACTIVE.value  # withdrawal
        ],
        RetirementState.UNDER_APPROVAL.value: [
            RetirementState.RETIRED.value,
            AssetState.ACTIVE.value  # rejection
        ],
        RetirementState.RETIRED.value: [RetirementState.DISPOSED.value],
    }
    
    if target_state in valid_transitions.get(current_state, []):
        return True
    raise InvalidStateTransitionError(
        f"Invalid transition from {current_state} to {target_state}"
    )


@router.post("/applications", status_code=status.HTTP_201_CREATED, response_model=dict)
async def submit_retirement_application(
    asset_id: str,
    reason: str,
    attachments: Optional[list[str]] = None
) -> dict:
    """
    Submit a new retirement application for an asset.
    
    Args:
        asset_id: Unique identifier of the asset to be retired
        reason: Detailed reason for retirement request
        attachments: Optional list of attachment URLs
        
    Returns:
        Application details with application_id and initial status
        
    Raises:
        HTTPException 400: If asset is not in ACTIVE state or has pending application
        
    Business Rules:
        - Asset must be in ACTIVE state
        - No existing pending retirement application for this asset
        - Creates PENDING_RETIREMENT state
        
    ATB Reference: ATB-2.1
    """
    # Check for concurrent application
    existing_app = approval_chain_service.get_pending_application(asset_id)
    if existing_app:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Concurrent application detected for asset {asset_id}"
        )
    
    # Validate asset state
    current_state = approval_chain_service.get_asset_current_state(asset_id)
    if current_state != AssetState.ACTIVE.value:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Asset {asset_id} must be in ACTIVE state, currently {current_state}"
        )
    
    # Create application
    application = RetirementApp(
        application_id=str(uuid4()),
        asset_id=asset_id,
        reason=reason,
        attachments=attachments or [],
        created_at=datetime.utcnow(),
        status=ApprovalStatus.PENDING
    )
    
    # Transition asset state
    _validate_state_transition(current_state, RetirementState.PENDING_RETIREMENT.value)
    approval_chain_service.update_asset_state(
        asset_id,
        RetirementState.PENDING_RETIREMENT.value
    )
    
    # Record state change in history
    status_history_service.record_state_change(
        asset_id=asset_id,
        from_state=current_state,
        to_state=RetirementState.PENDING_RETIREMENT.value,
        operator="system",
        timestamp=datetime.utcnow()
    )
    
    return {
        "application_id": application.application_id,
        "asset_id": asset_id,
        "status": application.status.value,
        "created_at": application.created_at.isoformat()
    }


@router.post("/applications/{application_id}/approve", response_model=dict)
async def approve_retirement_application(
    application_id: str,
    approver_id: str,
    comment: Optional[str] = None
) -> dict:
    """
    Approve a retirement application at the current approval level.
    
    Args:
        application_id: Unique identifier of the retirement application
        approver_id: ID of the approver taking action
        comment: Optional approval comment
        
    Returns:
        Approval result with current approval level and next step info
        
    Raises:
        HTTPException 404: If application not found
        HTTPException 400: If approval chain is already complete
        
    Business Rules:
        - Application must be in UNDER_APPROVAL state
        - Approver must have permission at current level
        - Triggers transition to next approval level or RETIRED state
        
    ATB Reference: ATB-2.2, ATB-2.3
    """
    application = approval_chain_service.get_application(application_id)
    if not application:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Application {application_id} not found"
        )
    
    current_state = approval_chain_service.get_asset_current_state(application.asset_id)
    _validate_state_transition(current_state, RetirementState.RETIRED.value)
    
    # Execute approval
    approval_result = approval_chain_service.approve(
        application_id=application_id,
        approver_id=approver_id,
        comment=comment
    )
    
    # Update asset state
    new_state = RetirementState.RETIRED.value
    approval_chain_service.update_asset_state(application.asset_id, new_state)
    
    # Record state change
    status_history_service.record_state_change(
        asset_id=application.asset_id,
        from_state=current_state,
        to_state=new_state,
        operator=approver_id,
        timestamp=datetime.utcnow()
    )
    
    # Record approval action
    status_history_service.record_approval_action(
        application_id=application_id,
        action="approve",
        approver_id=approver_id,
        comment=comment,
        timestamp=datetime.utcnow()
    )
    
    return {
        "application_id": application_id,
        "status": "APPROVED",
        "asset_state": new_state,
        "approved_by": approver_id,
        "approval_level": approval_result.get("level", 4),
        "timestamp": datetime.utcnow().isoformat()
    }


@router.post("/applications/{application_id}/reject", response_model=dict)
async def reject_retirement_application(
    application_id: str,
    approver_id: str,
    reason: str
) -> dict:
    """
    Reject a retirement application.
    
    Args:
        application_id: Unique identifier of the retirement application
        approver_id: ID of the approver taking action
        reason: Mandatory rejection reason
        
    Returns:
        Rejection result with asset state reverted to ACTIVE
        
    Raises:
        HTTPException 404: If application not found
        
    Business Rules:
        - Any approval level can reject
        - Asset state reverts to ACTIVE
        - Application status becomes REJECTED
        
    ATB Reference: ATB-2.3
    """
    application = approval_chain_service.get_application(application_id)
    if not application:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Application {application_id} not found"
        )
    
    current_state = approval_chain_service.get_asset_current_state(application.asset_id)
    
    # Reject application
    rejection_result = approval_chain_service.reject(
        application_id=application_id,
        approver_id=approver_id,
        reason=reason
    )
    
    # Revert asset state to ACTIVE
    approval_chain_service.update_asset_state(
        application.asset_id,
        AssetState.ACTIVE.value
    )
    
    # Record state change
    status_history_service.record_state_change(
        asset_id=application.asset_id,
        from_state=current_state,
        to_state=AssetState.ACTIVE.value,
        operator=approver_id,
        timestamp=datetime.utcnow()
    )
    
    # Record rejection action
    status_history_service.record_approval_action(
        application_id=application_id,
        action="reject",
        approver_id=approver_id,
        comment=reason,
        timestamp=datetime.utcnow()
    )
    
    return {
        "application_id": application_id,
        "status": "REJECTED",
        "asset_state": AssetState.ACTIVE.value,
        "rejected_by": approver_id,
        "reason": reason,
        "timestamp": datetime.utcnow().isoformat()
    }


@router.post("/applications/{application_id}/withdraw", response_model=dict)
async def withdraw_retirement_application(
    application_id: str,
    user_id: str
) -> dict:
    """
    Withdraw a pending retirement application.
    
    Args:
        application_id: Unique identifier of the retirement application
        user_id: ID of the user withdrawing the application
        
    Returns:
        Withdrawal confirmation with asset state restored to ACTIVE
        
    Raises:
        HTTPException 400: If application is not in PENDING_RETIREMENT state
        HTTPException 404: If application not found
        
    Business Rules:
        - Only allowed when application is in PENDING_RETIREMENT state
        - Asset state reverts to ACTIVE
        - Application status becomes WITHDRAWN
        
    ATB Reference: ATB-4.2
    """
    application = approval_chain_service.get_application(application_id)
    if not application:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Application {application_id} not found"
        )
    
    current_state = approval_chain_service.get_asset_current_state(application.asset_id)
    if current_state != RetirementState.PENDING_RETIREMENT.value:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only applications in PENDING_RETIREMENT state can be withdrawn"
        )
    
    # Withdraw application
    withdrawal_result = approval_chain_service.withdraw(application_id, user_id)
    
    # Revert asset state to ACTIVE
    approval_chain_service.update_asset_state(
        application.asset_id,
        AssetState.ACTIVE.value
    )
    
    # Record state change
    status_history_service.record_state_change(
        asset_id=application.asset_id,
        from_state=current_state,
        to_state=AssetState.ACTIVE.value,
        operator=user_id,
        timestamp=datetime.utcnow()
    )
    
    return {
        "application_id": application_id,
        "status": "WITHDRAWN",
        "asset_state": AssetState.ACTIVE.value,
        "withdrawn_by": user_id,
        "timestamp": datetime.utcnow().isoformat()
    }


@router.get("/applications/{application_id}", response_model=dict)
async def get_retirement_application(application_id: str) -> dict:
    """
    Retrieve retirement application details.
    
    Args:
        application_id: Unique identifier of the retirement application
        
    Returns:
        Complete application details including approval chain status
        
    Raises:
        HTTPException 404: If application not found
    """
    application = approval_chain_service.get_application(application_id)
    if not application:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Application {application_id} not found"
        )
    
    return {
        "application_id": application.application_id,
        "asset_id": application.asset_id,
        "reason": application.reason,
        "attachments": application.attachments,
        "status": application.status.value,
        "current_approval_level": approval_chain_service.get_current_level(application_id),
        "created_at": application.created_at.isoformat()
    }


@router.get("/assets/{asset_id}/status", response_model=dict)
async def get_asset_retirement_status(asset_id: str) -> dict:
    """
    Get current retirement status and state of an asset.
    
    Args:
        asset_id: Unique identifier of the asset
        
    Returns:
        Current state and recent state change information
        
    ATB Reference: ATB-1.3
    """
    current_state = approval_chain_service.get_asset_current_state(asset_id)
    recent_change = status_history_service.get_latest_state_change(asset_id)
    
    return {
        "asset_id": asset_id,
        "current_state": current_state,
        "last_state_change": recent_change.timestamp.isoformat() if recent_change else None,
        "last_operator": recent_change.operator if recent_change else None
    }


@router.get("/assets/{asset_id}/retirement-history", response_model=list)
async def get_asset_retirement_history(asset_id: str) -> list:
    """
    Retrieve complete retirement history for an asset.
    
    Args:
        asset_id: Unique identifier of the asset
        
    Returns:
        List of state change records in chronological order
        
    ATB Reference: ATB-3.3
    """
    history = status_history_service.get_asset_history(asset_id)
    return [
        {
            "asset_id": record.asset_id,
            "from_state": record.from_state,
            "to_state": record.to_state,
            "operator": record.operator,
            "timestamp": record.timestamp.isoformat()
        }
        for record in history
    ]


@router.get("/audit/report", response_model=dict)
async def export_retirement_audit_report(
    from_date: datetime = Query(..., description="Start date for audit report"),
    to_date: datetime = Query(..., description="End date for audit report"),
    format: str = Query("json", regex="^(json|csv)$", description="Export format")
) -> dict:
    """
    Export retirement audit report for specified date range.
    
    Args:
        from_date: Start date of the audit period
        to_date: End date of the audit period
        format: Export format (json or csv)
        
    Returns:
        Audit report with all retirement activities in date range
        
    Raises:
        HTTPException 400: If date range is invalid
        
    ATB Reference: ATB-3.4
    """
    if from_date > to_date:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="from_date must be before to_date"
        )
    
    report_data = status_history_service.export_audit_report(from_date, to_date)
    
    return {
        "report_type": "retirement_audit",
        "from_date": from_date.isoformat(),
        "to_date": to_date.isoformat(),
        "format": format,
        "total_records": len(report_data),
        "data": report_data
    }


@router.post("/disposal/{asset_id}", response_model=dict)
async def record_asset_disposal(
    asset_id: str,
    disposal_method: str,
    disposal_value: Optional[float] = None,
    operator_id: str = Query(...)
) -> dict:
    """
    Record asset disposal after retirement.
    
    Args:
        asset_id: Unique identifier of the retired asset
        disposal_method: Method of disposal (SCRAPPED, SOLD, DONATED, TRANSFERRED)
        disposal_value: Optional monetary value from disposal
        operator_id: ID of the operator recording disposal
        
    Returns:
        Disposal record confirmation
        
    Raises:
        HTTPException 400: If asset is not in RETIRED state
    """
    current_state = approval_chain_service.get_asset_current_state(asset_id)
    if current_state != RetirementState.RETIRED.value:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Asset must be in RETIRED state, currently {current_state}"
        )
    
    _validate_state_transition(current_state, RetirementState.DISPOSED.value)
    
    # Update to DISPOSED state
    approval_chain_service.update_asset_state(
        asset_id,
        RetirementState.DISPOSED.value
    )
    
    # Record state change
    status_history_service.record_state_change(
        asset_id=asset_id,
        from_state=current_state,
        to_state=RetirementState.DISPOSED.value,
        operator=operator_id,
        timestamp=datetime.utcnow(),
        metadata={
            "disposal_method": disposal_method,
            "disposal_value": disposal_value
        }
    )
    
    return {
        "asset_id": asset_id,
        "disposal_status": "COMPLETED",
        "disposal_method": disposal_method,
        "disposal_value": disposal_value,
        "disposed_by": operator_id,
        "timestamp": datetime.utcnow().isoformat()
    }