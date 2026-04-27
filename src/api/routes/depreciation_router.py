"""
Depreciation router for asset retirement workflow.
Provides endpoints to initiate, approve, and query asset retirement processes.
"""

from typing import Any, Dict, List, Optional

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, status
from pydantic import BaseModel, Field, validator

from application.commands.approve_retirement import ApproveRetirementCommand
from application.commands.create_retirement_application import CreateRetirementApplicationCommand
from application.commands.reject_retirement import RejectRetirementCommand
from application.services.retirement_service import RetirementService
from common.dependencies import get_current_user, get_permission_service
from common.exceptions import BusinessException
from domain.entities.asset import Asset
from domain.entities.retirement_request import RetirementRequest
from domain.value_objects.asset_status import AssetStatus
from domain.value_objects.transition_rule import TransitionRule

router = APIRouter(prefix="/assets", tags=["depreciation"])
class RetirementRequestIn(BaseModel):
    """Payload for initiating a retirement request."""
    asset_id: str = Field(..., description="Asset identifier")
    reason: str = Field(..., min_length=1, description="Retirement reason")

    @validator("asset_id")
    def validate_asset_id(cls, v: str) -> str:
        if not v or not v.strip():
            raise ValueError("asset_id must not be empty")
        return v.strip()
class RetirementRequestOut(BaseModel):
    """Response model for a created retirement request."""
    request_id: str
    asset_id: str
    status: str
    created_at: str
    current_step: Optional[str] = None
    approvers: List[str] = Field(default_factory=list)
    history: List[Dict[str, Any]] = Field(default_factory=list)
class ApprovalStepIn(BaseModel):
    """Payload for advancing or rolling back an approval step."""
    request_id: str
    decision: str = Field(..., description="approve, reject, or return")
    comment: Optional[str] = Field(None, description="Optional comment for the decision")
    reviewer_id: Optional[str] = Field(None, description="ID of the reviewer performing the action")
@router.post("/{asset_id}/retire", response_model=RetirementRequestOut, status_code=status.HTTP_202_ACCEPTED)
async def submit_retirement_request(
    asset_id: str,
    payload: RetirementRequestIn,
    background_tasks: BackgroundTasks,
    current_user: Dict[str, Any] = Depends(get_current_user),
    permission_service: Any = Depends(get_permission_service),
) -> RetirementRequestOut:
    """
    Initiate a retirement request for an asset.
    - Validates asset existence and RBAC permissions.
    - Creates a workflow instance atomically with the first event.
    - Returns 202 Accepted with process metadata.
    """
    # RBAC: ensure the caller has rights to retire assets
    if not permission_service.can_request_retirement(user_id=current_user["id"], asset_id=asset_id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Insufficient permissions to request retirement for this asset.",
        )

    command = CreateRetirementApplicationCommand(
        asset_id=asset_id,
        requested_by=current_user["id"],
        reason=payload.reason,
    )
    result = await RetirementService.create_retirement_application(command)

    if not result.success:
        raise BusinessException(message=result.message or "Failed to create retirement request")

    instance = result.instance
    return RetirementRequestOut(
        request_id=instance.request_id,
        asset_id=instance.asset_id,
        status=instance.status.value,
        created_at=instance.created_at.isoformat(),
        current_step=instance.current_step,
        approvers=instance.approvers,
        history=instance.history,
    )
@router.post("/workflow/approve", response_model=RetirementRequestOut)
async def approve_step(
    payload: ApprovalStepIn,
    current_user: Dict[str, Any] = Depends(get_current_user),
    permission_service: Any = Depends(get_permission_service),
) -> RetirementRequestOut:
    """
    Process an approval/return/reject decision for a retirement request.
    - Enforces RBAC for the specific request.
    - Reject or return immediately terminates the chain with appropriate status.
    - Advances to next approver when approved.
    """
    if not permission_service.can_review_request(user_id=current_user["id"], request_id=payload.request_id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not authorized to review this request.",
        )

    if payload.decision == "approve":
        command = ApproveRetirementCommand(
            request_id=payload.request_id,
            reviewer_id=current_user["id"],
            comment=payload.comment,
        )
        result = await RetirementService.approve_step(command)
    elif payload.decision == "reject":
        command = RejectRetirementCommand(
            request_id=payload.request_id,
            reviewer_id=current_user["id"],
            reason=payload.comment or "Rejected by reviewer",
        )
        result = await RetirementService.reject_request(command)
    else:
        # "return" or any other value triggers return-to-previous
        command = RejectRetirementCommand(
            request_id=payload.request_id,
            reviewer_id=current_user["id"],
            reason=payload.comment or "Returned to previous step",
        )
        result = await RetirementService.return_step(command)

    if not result.success:
        raise BusinessException(message=result.message or "Failed to process approval step")

    instance = result.instance
    return RetirementRequestOut(
        request_id=instance.request_id,
        asset_id=instance.asset_id,
        status=instance.status.value,
        created_at=instance.created_at.isoformat(),
        current_step=instance.current_step,
        approvers=instance.approvers,
        history=instance.history,
    )
@router.get("/{asset_id}/history", response_model=List[Dict[str, Any]])
async def get_retirement_history(
    asset_id: str,
    current_user: Dict[str, Any] = Depends(get_current_user),
    permission_service: Any = Depends(get_permission_service),
) -> List[Dict[str, Any]]:
    """
    Retrieve the immutable event history for an asset's retirement workflow.
    - Requires read permission on the asset.
    - Returns events sorted by timestamp ascending.
    """
    if not permission_service.can_view_asset(user_id=current_user["id"], asset_id=asset_id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Insufficient permissions to view asset history.",
        )

    result = await RetirementService.get_history(asset_id)
    if not result.success:
        raise BusinessException(message=result.message or "Failed to retrieve history")

    # Ensure deterministic ordering
    return sorted(result.events, key=lambda e: e["occurred_at"])