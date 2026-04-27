"""
Depreciation Repository Module.

This module defines the repository interface for depreciation data persistence,
responsible for CRUD operations and queries related to asset depreciation records.
"""

from typing import List, Optional
from datetime import date, datetime
from decimal import Decimal
import uuid

from sqlalchemy.orm import Session
from sqlalchemy import and_, func

from src.domain.depreciation.entities import DepreciationRecord, DepreciationMethod
from src.domain.depreciation.schemas import (
    DepreciationRecordCreate,
    DepreciationRecordUpdate,
    DepreciationReportQuery,
)


class DepreciationRepository:
    """
    Repository class for DepreciationRecord persistence operations.
    
    This class implements the data access layer for depreciation records,
    providing methods to create, read, update, and query depreciation data.
    """

    def __init__(self, session: Session):
        """
        Initialize the repository with a database session.
        
        Args:
            session: SQLAlchemy database session.
        """
        self._session = session

    def create(self, record_data: DepreciationRecordCreate) -> DepreciationRecord:
        """
        Create a new depreciation record.
        
        Args:
            record_data: Depreciation record creation schema.
            
        Returns:
            The created DepreciationRecord entity.
        """
        record = DepreciationRecord(
            id=str(uuid.uuid4()),
            asset_id=record_data.asset_id,
            period=record_data.period,
            method=record_data.method,
            acquisition_cost=record_data.acquisition_cost,
            salvage_value=record_data.salvage_value,
            useful_life_months=record_data.useful_life_months,
            monthly_depreciation=record_data.monthly_depreciation,
            accumulated_depreciation=record_data.accumulated_depreciation,
            book_value=record_data.book_value,
            created_at=datetime.now(),
        )
        self._session.add(record)
        self._session.commit()
        self._session.refresh(record)
        return record

    def get_by_id(self, record_id: str) -> Optional[DepreciationRecord]:
        """
        Retrieve a depreciation record by its ID.
        
        Args:
            record_id: The unique identifier of the record.
            
        Returns:
            The DepreciationRecord if found, otherwise None.
        """
        return self._session.query(DepreciationRecord).filter(
            DepreciationRecord.id == record_id
        ).first()

    def get_by_asset_id(
        self, 
        asset_id: str, 
        start_date: Optional[str] = None,
        end_date: Optional[str] = None
    ) -> List[DepreciationRecord]:
        """
        Retrieve depreciation records for a specific asset.
        
        Args:
            asset_id: The asset identifier.
            start_date: Optional start period filter (YYYY-MM format).
            end_date: Optional end period filter (YYYY-MM format).
            
        Returns:
            List of DepreciationRecord entities matching the criteria.
        """
        query = self._session.query(DepreciationRecord).filter(
            DepreciationRecord.asset_id == asset_id
        )
        
        if start_date:
            query = query.filter(DepreciationRecord.period >= start_date)
        if end_date:
            query = query.filter(DepreciationRecord.period <= end_date)
            
        return query.order_by(DepreciationRecord.period).all()

    def get_report(self, query: DepreciationReportQuery) -> dict:
        """
        Generate a depreciation report based on query parameters.
        
        Args:
            query: Report query parameters including period range and filters.
            
        Returns:
            A dictionary containing report data with totals and records.
        """
        base_query = self._session.query(DepreciationRecord)
        
        filters = []
        if query.asset_id:
            filters.append(DepreciationRecord.asset_id == query.asset_id)
        if query.start_date:
            filters.append(DepreciationRecord.period >= query.start_date)
        if query.end_date:
            filters.append(DepreciationRecord.period <= query.end_date)
        if query.method:
            filters.append(DepreciationRecord.method == query.method)
            
        if filters:
            base_query = base_query.filter(and_(*filters))
            
        records = base_query.order_by(
            DepreciationRecord.period, 
            DepreciationRecord.asset_id
        ).all()
        
        total_monthly = sum(r.monthly_depreciation for r in records)
        total_accumulated = sum(r.accumulated_depreciation for r in records)
        
        return {
            "records": records,
            "summary": {
                "total_assets": len(set(r.asset_id for r in records)),
                "total_periods": len(set(r.period for r in records)),
                "total_monthly_depreciation": total_monthly,
                "total_accumulated_depreciation": total_accumulated,
            }
        }

    def get_latest_by_asset_id(self, asset_id: str) -> Optional[DepreciationRecord]:
        """
        Get the most recent depreciation record for an asset.
        
        Args:
            asset_id: The asset identifier.
            
        Returns:
            The latest DepreciationRecord if exists, otherwise None.
        """
        return self._session.query(DepreciationRecord).filter(
            DepreciationRecord.asset_id == asset_id
        ).order_by(DepreciationRecord.period.desc()).first()

    def update_accumulated_depreciation(
        self, 
        asset_id: str, 
        period: str, 
        new_accumulated: Decimal
    ) -> Optional[DepreciationRecord]:
        """
        Update the accumulated depreciation for a specific record.
        
        Args:
            asset_id: The asset identifier.
            period: The depreciation period (YYYY-MM).
            new_accumulated: The new accumulated depreciation value.
            
        Returns:
            The updated DepreciationRecord if found, otherwise None.
        """
        record = self._session.query(DepreciationRecord).filter(
            and_(
                DepreciationRecord.asset_id == asset_id,
                DepreciationRecord.period == period
            )
        ).first()
        
        if record:
            record.accumulated_depreciation = new_accumulated
            record.book_value = record.acquisition_cost - new_accumulated
            self._session.commit()
            self._session.refresh(record)
            
        return record

    def bulk_create(self, records_data: List[DepreciationRecordCreate]) -> List[DepreciationRecord]:
        """
        Create multiple depreciation records in a single transaction.
        
        Args:
            records_data: List of depreciation record creation schemas.
            
        Returns:
            List of created DepreciationRecord entities.
        """
        records = []
        for data in records_data:
            record = DepreciationRecord(
                id=str(uuid.uuid4()),
                asset_id=data.asset_id,
                period=data.period,
                method=data.method,
                acquisition_cost=data.acquisition_cost,
                salvage_value=data.salvage_value,
                useful_life_months=data.useful_life_months,
                monthly_depreciation=data.monthly_depreciation,
                accumulated_depreciation=data.accumulated_depreciation,
                book_value=data.book_value,
                created_at=datetime.now(),
            )
            records.append(record)
            
        self._session.bulk_save_objects(records)
        self._session.commit()
        return records

    def delete_by_asset_id(self, asset_id: str) -> int:
        """
        Delete all depreciation records for a specific asset.
        
        Args:
            asset_id: The asset identifier.
            
        Returns:
            The number of records deleted.
        """
        count = self._session.query(DepreciationRecord).filter(
            DepreciationRecord.asset_id == asset_id
        ).delete()
        self._session.commit()
        return count

    def exists_for_period(self, asset_id: str, period: str) -> bool:
        """
        Check if a depreciation record exists for a specific asset and period.
        
        Args:
            asset_id: The asset identifier.
            period: The depreciation period (YYYY-MM).
            
        Returns:
            True if record exists, False otherwise.
        """
        return self._session.query(
            self._session.query(DepreciationRecord).filter(
                and_(
                    DepreciationRecord.asset_id == asset_id,
                    DepreciationRecord.period == period
                )
            ).exists()
        ).scalar()