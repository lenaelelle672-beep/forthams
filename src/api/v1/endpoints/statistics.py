"""
Statistics API endpoints for asset lifecycle and retirement workflow.
Provides aggregated views and health metrics for the asset management system.
"""

from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.deps import get_db, get_current_user
from app.api.schemas.statistics_schemas import (
    AssetStatusCount,
    RetirementRequestDetail,
    RetirementRequestList,
    WorkflowHealth,
)
from app.application.services.retirement_usecase import RetirementUseCase
from app.domain.entities.asset import Asset
from app.domain.entities.retirement_request import RetirementRequest
from app.domain.value_objects.asset_status import AssetStatus

router = APIRouter(prefix="/statistics", tags=["statistics"])


@router.get("/assets/status", response_model=List[AssetStatusCount])
def get_asset_status_counts(
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
) -> List[AssetStatusCount]:
    """
    Retrieve aggregated counts of assets per status.

    Requires read permission on asset statistics.
    """
    # TODO: integrate with RBAC guard once permissions are defined
    # Example guard: ensure_user_has_permission(user, "asset:statistics:read")
    result = RetirementUseCase(db).get_asset_status_counts()
    return result


@router.get("/retirement/requests", response_model=RetirementRequestList)
def list_retirement_requests(
    status: Optional[AssetStatus] = None,
    limit: int = 20,
    offset: int = 0,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
) -> RetirementRequestList:
    """
    List retirement requests with optional status filter.

    Supports pagination and status filtering. Requires read permission
    on retirement requests.
    """
    # TODO: integrate with RBAC guard once permissions are defined
    return RetirementUseCase(db).list_retirement_requests(
        status_filter=status, limit=limit, offset=offset
    )


@router.get("/retirement/requests/{request_id}", response_model=RetirementRequestDetail)
def get_retirement_request(
    request_id: str,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
) -> RetirementRequestDetail:
    """
    Retrieve a specific retirement request with full detail.

    Includes current state, approval chain, and event history.
    Requires read permission on the specific request.
    """
    # TODO: integrate with RBAC guard: ensure_user_can_view_request(user, request_id)
    usecase = RetirementUseCase(db)
    detail = usecase.get_retirement_request_detail(request_id)
    if detail is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Retirement request not found",
        )
    return detail


@router.get("/health", response_model=WorkflowHealth)
def get_workflow_health(
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
) -> WorkflowHealth:
    """
    Provide a high-level health snapshot of the retirement workflow.

    Includes counts by status, recent events, and any blockers.
    """
    # TODO: integrate with RBAC guard once permissions are defined
    usecase = RetirementUseCase(db)
    return usecase.get_workflow_health()