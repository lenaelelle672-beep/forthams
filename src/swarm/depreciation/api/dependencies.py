from fastapi import Depends

from src.infrastructure.database.repositories import (
    AssetRepository,
    DepreciationRecordRepository,
    RetirementRequestRepository,
)
from src.infrastructure.database.session import get_db


def get_asset_repository(db=Depends(get_db)) -> AssetRepository:
    return AssetRepository(db)


def get_depreciation_record_repository(db=Depends(get_db)) -> DepreciationRecordRepository:
    return DepreciationRecordRepository(db)


def get_retirement_request_repository(db=Depends(get_db)) -> RetirementRequestRepository:
    return RetirementRequestRepository(db)