"""
Depreciation routes for asset lifecycle management.

Provides API endpoints to initiate, track, and manage asset retirement
workflows, integrating with the state machine and approval chain services.
"""

from typing import Any, Dict

from fastapi import APIRouter, Depends, HTTPException, status

from src.application.commands.create_retirement_application import (
    CreateRetirementApplicationCommand,
)
from src.application.commands.approve_retirement import (
    ApproveRetirementCommand,
)
from src.application.commands.reject_retirement import (
    RejectRetirementCommand,
)
from src.application.services.retirement_service import RetirementService
from src.api.deps.auth import get_current_user
from src.api.schemas.retirement_request import (
    RetirementRequestCreate,
    RetirementRequestResponse,
)
from src.api.schemas.retirement_response import (
    RetirementProcessResponse,
    RetirementHistoryResponse,
)

router = APIRouter(prefix="/assets", tags=["retirement"])


@router.post("/{asset_id}/retire",
             status_code=status.HTTP_202_ACCEPTED,
             summary="Submit a retirement request for an asset",
             response_model=RetirementProcessResponse)
def submit_retirement(
    asset_id: str,
    payload: RetirementRequestCreate,
    service: RetirementService = Depends(RetirementService),
    user: Dict[str, Any] = Depends(get_current_user),
) -> RetirementProcessResponse:
    """
    Initiate a retirement workflow for the specified asset.

    - Verifies RBAC permissions for the requesting user.
    - Creates a workflow instance and persists the initial event.
    - Returns 202 with process instance reference.
    """
    cmd = CreateRetirementApplicationCommand(
        asset_id=asset_id,
        requester_id=user["user_id"],
        requester_role=user.get("role", "requester"),
        reason=payload.reason,
        metadata=payload.metadata,
    )
    try:
        result = service.submit_retirement_application(cmd)
    except PermissionError as exc:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Permission denied: {exc}",
        )
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        )
    return RetirementProcessResponse(
        process_id=result["process_id"],
        asset_id=asset_id,
        status=result["status"],
        current_step=result.get("current_step"),
        created_at=result["created_at"],
    )


@router.post("/workflow/approve",
             summary="Approve the current step of a retirement workflow",
             response_model=RetirementProcessResponse)
def approve_retirement_step(
    payload: RetirementRequestCreate,
    service: RetirementService = Depends(RetirementService),
    user: Dict[str, Any] = Depends(get_current_user),
) -> RetirementProcessResponse:
    """
    Approve the current pending step in a retirement workflow.

    - Enforces RBAC: user must have approval permission for the workflow role.
    - Rejects if any prior step was denied (process already in terminal state).
    - On approval, advances to next approver; on final approval marks as retired.
    """
    cmd = ApproveRetirementCommand(
        process_id=payload.process_id,
        approver_id=user["user_id"],
        approver_role=user.get("role", "approver"),
        approved=payload.approved,
        comment=payload.comment,
    )
    try:
        result = service.approve_retirement_step(cmd)
    except PermissionError as exc:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Approval permission denied: {exc}",
        )
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        )
    return RetirementProcessResponse(
        process_id=result["process_id"],
        asset_id=result["asset_id"],
        status=result["status"],
        current_step=result.get("current_step"),
        created_at=result["created_at"],
    )


@router.post("/workflow/reject",
             summary="Reject the current step of a retirement workflow",
             response_model=RetirementProcessResponse)
def reject_retirement_step(
    payload: RetirementRequestCreate,
    service: RetirementService = Depends(RetirementService),
    user: Dict[str, Any] = Depends(get_current_user),
) -> RetirementProcessResponse:
    """
    Reject the current pending step in a retirement workflow.

    - Any rejection sets the process state to "Rejected" and terminates the chain.
    - Rejection is recorded as an immutable event.
    """
    cmd = RejectRetirementCommand(
        process_id=payload.process_id,
        reviewer_id=user["user_id"],
        reviewer_role=user.get("role", "reviewer"),
        comment=payload.comment,
    )
    try:
        result = service.reject_retirement_step(cmd)
    except PermissionError as exc:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Rejection permission denied: {exc}",
        )
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        )
    return RetirementProcessResponse(
        process_id=result["process_id"],
        asset_id=result["asset_id"],
        status=result["status"],
        current_step=result.get("current_step"),
        created_at=result["created_at"],
    )


@router.get("/{asset_id}/history",
            summary="Retrieve the immutable event history for an asset",
            response_model=RetirementHistoryResponse)
def get_asset_history(
    asset_id: str,
    service: RetirementService = Depends(RetirementService),
) -> RetirementHistoryResponse:
    """
    Return all state-change and approval events for the asset,
    ordered chronologically (oldest first).
    """
    try:
        events = service.get_asset_history(asset_id)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(exc),
        )
    return RetirementHistoryResponse(events=events)