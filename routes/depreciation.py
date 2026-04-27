"""Depreciation calculation routes."""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.dependencies import get_db
from app.services.depreciation_service import (
    calculate_straight_line_depreciation,
    calculate_double_declining_balance,
    get_asset_depreciation,
    update_depreciation_schedule,
)
from app.schemas.depreciation import (
    DepreciationCalculateRequest,
    DepreciationCalculateResponse,
    DepreciationScheduleResponse,
)

router = APIRouter(prefix="/depreciation", tags=["depreciation"])


@router.post("/calculate", response_model=DepreciationCalculateResponse)
async def calculate_depreciation(
    request: DepreciationCalculateRequest,
    db: Session = Depends(get_db),
):
    """
    Calculate depreciation for a given asset using the selected method.

    Supported methods:
    - straight_line
    - double_declining_balance
    """
    if request.method == "straight_line":
        result = calculate_straight_line_depreciation(
            asset_id=request.asset_id,
            start_date=request.start_date,
            useful_life=request.useful_life,
            db=db,
        )
    elif request.method == "double_declining_balance":
        result = calculate_double_declining_balance(
            asset_id=request.asset_id,
            start_date=request.start_date,
            useful_life=request.useful_life,
            db=db,
        )
    else:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unsupported depreciation method: {request.method}",
        )
    return DepreciationCalculateResponse.from_calculation_result(result)


@router.get("/asset/{asset_id}/schedule", response_model=DepreciationScheduleResponse)
async def get_depreciation_schedule(
    asset_id: int,
    db: Session = Depends(get_db),
):
    """Retrieve the depreciation schedule for an asset."""
    schedule = get_asset_depreciation(asset_id=asset_id, db=db)
    if schedule is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Asset or depreciation schedule not found",
        )
    return DepreciationScheduleResponse.from_orm(schedule)


@router.put("/schedule/update")
async def update_depreciation(
    asset_id: int,
    period_months: int,
    db: Session = Depends(get_db),
):
    """Trigger re-calculation and update of depreciation schedule."""
    updated = update_depreciation_schedule(
        asset_id=asset_id,
        period_months=period_months,
        db=db,
    )
    if not updated:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Asset or depreciation schedule not found",
        )
    return {"message": "Depreciation schedule updated successfully"}