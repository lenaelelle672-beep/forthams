"""
History API routes for asset retirement workflow.
Provides endpoints to submit retirement requests, approve workflow steps,
and retrieve immutable event history for an asset.
"""

from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.deps import get_db, get_current_user
from app.application.use_cases.retirement_usecase import RetirementUseCase
from app.application.use_cases.approval_usecase import ApprovalUseCase
from app.domain.entities.history import HistoryEvent
from app.api.schemas.retirement_request import RetirementRequestCreate
from app.api.schemas.history_schemas import (
    EventResponse,
    HistoryListResponse,
    ApprovalRequest,
)

router = APIRouter(prefix="/assets", tags=["history"])


@router.post("/{asset_id}/retire", response_model=EventResponse, status_code=status.HTTP_202_ACCEPTED)
def submit_retirement(
    asset_id: str,
    payload: RetirementRequestCreate,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    """
    Submit a retirement application for an asset.

    - Validates asset existence and RBAC permissions.
    - Creates a workflow instance atomically with the initial event.
    - Returns 202 Accepted with the created event.
    """
    usecase = RetirementUseCase(db=db)
    try:
        event = usecase.submit_retirement(asset_id=asset_id, requester_id=user.id, reason=payload.reason)
        return event
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))


@router.post("/workflow/approve", response_model=EventResponse)
def approve_step(
    payload: ApprovalRequest,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    """
    Approve the next step in the retirement workflow.

    - Enforces RBAC: user must have the required role for the node.
    - Approval/rejection is deterministic and cannot be bypassed.
    - On rejection, workflow state becomes "Rejected" and a final event is recorded.
    """
    usecase = ApprovalUseCase(db=db)
    try:
        event = usecase.process_approval(
            workflow_id=payload.workflow_id,
            actor_id=user.id,
            approved=payload.approved,
            comment=payload.comment,
        )
        return event
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))


@router.get("/{asset_id}/history", response_model=HistoryListResponse)
def get_history(
    asset_id: str,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
    limit: int = 100,
    offset: int = 0,
):
    """
    Retrieve the immutable event history for an asset.

    Events are returned ordered by timestamp ascending (oldest first).
    """
    usecase = RetirementUseCase(db=db)
    try:
        events: List[HistoryEvent] = usecase.get_history(asset_id=asset_id, limit=limit, offset=offset)
        return HistoryListResponse(items=events)
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))