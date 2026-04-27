"""
Dashboard router for forthAMS Asset Management System.

Provides REST endpoints for dashboard statistics, asset overviews,
and retirement request status.
"""

from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.api.dependencies.db import get_db
from app.services.dashboard_service import DashboardService
from app.schemas.dashboard import (
    DashboardStatsResponse,
    AssetOverviewResponse,
    RetirementStatusSummary,
)

router = APIRouter(prefix="/dashboard", tags=["dashboard"])


@router.get("/stats", response_model=DashboardStatsResponse)
def get_dashboard_stats(
    db: Session = Depends(get_db),
    skip: int = Query(0, ge=0, description="Number of records to skip"),
    limit: int = Query(100, ge=1, le=1000, description="Max records to return"),
) -> DashboardStatsResponse:
    """
    Retrieve aggregated dashboard statistics.

    Returns:
        DashboardStatsResponse: Aggregated KPIs for the dashboard.
    """
    try:
        return DashboardService.get_stats(db, skip=skip, limit=limit)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/assets/overview", response_model=List[AssetOverviewResponse])
def get_asset_overview(
    db: Session = Depends(get_db),
    status: Optional[str] = Query(None, description="Filter by asset status"),
    category: Optional[str] = Query(None, description="Filter by asset category"),
    skip: int = Query(0, ge=0, description="Number of records to skip"),
    limit: int = Query(50, ge=1, le=500, description="Max records to return"),
) -> List[AssetOverviewResponse]:
    """
    Retrieve asset overview with optional filters.

    Args:
        status: Optional asset status filter.
        category: Optional asset category filter.
        skip: Pagination offset.
        limit: Pagination limit.

    Returns:
        List[AssetOverviewResponse]: List of asset overview items.
    """
    try:
        return DashboardService.get_asset_overview(
            db, status=status, category=category, skip=skip, limit=limit
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/retirement/summary", response_model=RetirementStatusSummary)
def get_retirement_status_summary(
    db: Session = Depends(get_db),
) -> RetirementStatusSummary:
    """
    Retrieve retirement request status summary.

    Returns:
        RetirementStatusSummary: Counts per status.
    """
    try:
        return DashboardService.get_retirement_status_summary(db)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))