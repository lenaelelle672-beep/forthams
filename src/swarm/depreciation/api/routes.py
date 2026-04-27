import logging

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from ...domain.entities import Asset, DepreciationRecord
from ...domain.services import DepreciationService
from ...infrastructure.database.repositories import DepreciationRepository
from ...infrastructure.database.session import get_db

router = APIRouter(prefix="/depreciation", tags=["depreciation"])

logger = logging.getLogger(__name__)
@router.get("/")
def list_depreciation_records(
    db: Session = Depends(get_db),
    skip: int = 0,
    limit: int = 100,
) -> dict:
    """List depreciation records with pagination."""
    repository = DepreciationRepository(db)
    records = repository.list(skip=skip, limit=limit)
    return {"records": [r.model_dump() for r in records]}
@router.post("/")
def create_depreciation_record(
    *,
    db: Session = Depends(get_db),
    payload: dict,
) -> dict:
    """Create a new depreciation record."""
    service = DepreciationService(DepreciationRepository(db))
    try:
        result = service.calculate(payload)
        return {"status": "ok", "result": result.model_dump()}
    except ValueError as exc:
        logger.warning("Failed to calculate depreciation: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        )
@router.get("/{record_id}")
def get_depreciation_record(
    record_id: int,
    db: Session = Depends(get_db),
) -> dict:
    """Get a single depreciation record by ID."""
    repository = DepreciationRepository(db)
    record = repository.get(record_id)
    if record is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Depreciation record not found",
        )
    return record.model_dump()