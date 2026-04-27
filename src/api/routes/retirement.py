"""
Retirement API Routes

Provides endpoints for initiating, approving, and tracking asset retirement
applications. Implements the workflow layer for the asset status lifecycle
engine.
"""

from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import JSONResponse

from src.application.commands.create_retirement_application import (
    CreateRetirementApplicationCommand,
)
from src.application.commands.approve_retirement import (
    ApproveRetirementCommand,
)
from src.application.commands.reject_retirement import (
    RejectRetirementCommand,
)
from src.application.use_cases.retirement_usecase import RetirementUseCase
from src.api.deps.auth import get_current_user, rbac_required
from src.api.schemas.retirement_request import (
    RetirementRequestCreate,
    RetirementRequestResponse,
    RetirementRequestHistory,
    ApprovalStepRequest,
)
from src.api.schemas.responses import (
    OperationResult,
    PaginatedList,
)

router = APIRouter(prefix="/assets", tags=["retirement"])


@router.post(
    "/{asset_id}/retire",
    summary="Submit a retirement application for an asset",
    response_model=OperationResult,
    status_code=status.HTTP_202_ACCEPTED,
)
async def submit_retirement(
    asset_id: str,
    payload: RetirementRequestCreate,
    current_user=Depends(get_current_user),
) -> JSONResponse:
    """
    Initiate a retirement workflow for the specified asset.

    Security: RBAC required – caller must have 'retire:submit' permission
    on the asset's department.
    """
    use_case = RetirementUseCase()
    result = await use_case.submit_retirement(
        command=CreateRetirementApplicationCommand(
            asset_id=asset_id,
            applicant_id=current_user.id,
            reason=payload.reason,
            metadata=payload.metadata,
        )
    )
    if not result.success:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=result.error,
        )
    return JSONResponse(
        status_code=status.HTTP_202_ACCEPTED,
        content=result.model_dump(),
    )


@router.post(
    "/workflow/approve",
    summary="Approve the next step of a retirement workflow",
    response_model=OperationResult,
)
async def approve_retirement_step(
    payload: ApprovalStepRequest,
    current_user=Depends(get_current_user),
) -> JSONResponse:
    """
    Approve or reject the current pending approval step.

    Security: RBAC required – caller must have 'retire:approve' permission
    on the workflow.
    """
    use_case = RetirementUseCase()
    if payload.action == "approve":
        command = ApproveRetirementCommand(
            workflow_id=payload.workflow_id,
            approver_id=current_user.id,
            comment=payload.comment,
        )
    else:
        command = RejectRetirementCommand(
            workflow_id=payload.workflow_id,
            approver_id=current_user.id,
            comment=payload.comment,
        )
    result = await use_case.process_approval_step(command)
    if not result.success:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=result.error,
        )
    return JSONResponse(
        status_code=status.HTTP_200_OK,
        content=result.model_dump(),
    )


@router.get(
    "/{asset_id}/history",
    summary="Retrieve the event history for an asset's retirement workflow",
    response_model=PaginatedList[RetirementRequestHistory],
)
async def get_retirement_history(
    asset_id: str,
    offset: int = 0,
    limit: Optional[int] = 100,
    current_user=Depends(get_current_user),
) -> PaginatedList[RetirementRequestHistory]:
    """
    Return chronological event records for the asset's retirement workflow.

    Security: RBAC required – caller must have 'retire:view' permission
    on the asset.
    """
    use_case = RetirementUseCase()
    events = await use_case.get_history(
        asset_id=asset_id,
        offset=offset,
        limit=limit,
    )
    return PaginatedList[
        RetirementRequestHistory
    ](
        total=events.total,
        offset=events.offset,
        limit=events.limit,
        items=events.items,
    )