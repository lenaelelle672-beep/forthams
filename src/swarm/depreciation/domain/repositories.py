"""
Repository interfaces for depreciation domain.

This module defines the repository contracts for managing depreciation records,
supporting both straight-line and double-declining balance calculation methods.
The repositories provide data access abstraction for the depreciation calculation
engine and report generation services.

Repositories:
    - DepreciationRecordRepository: CRUD operations for individual depreciation records
    - DepreciationReportRepository: Aggregated queries for depreciation reports

See Also:
    - SWARM-2026-Q2-003: Asset Depreciation Calculation Core Module
"""

from abc import ABC, abstractmethod
from dataclasses import dataclass
from datetime import datetime
from decimal import Decimal
from typing import Optional, Protocol


class DepreciationRecordRepository(Protocol):
    """
    Protocol defining the interface for depreciation record data access.
    
    Implementations should handle persistence and retrieval of individual
    depreciation calculation results for each asset per period.
    
    Note:
        Per BC-006 (Idempotency),同一资产同一月份的折旧计算必须幂等，
        不允许重复计提。Repository must ensure idempotent operations.
    """

    def find_by_asset_and_period(
        self, asset_id: str, period: str
    ) -> Optional["DepreciationRecord"]:
        """
        Retrieve a specific depreciation record for an asset in a given period.
        
        Args:
            asset_id: Unique identifier of the asset
            period: Period in YYYY-MM format
            
        Returns:
            DepreciationRecord if found, None otherwise
        """
        ...

    def save(self, record: "DepreciationRecord") -> "DepreciationRecord":
        """
        Persist a depreciation record.
        
        Args:
            record: The depreciation record to save
            
        Returns:
            The saved record with any generated identifiers
        """
        ...

    def find_by_asset_id(self, asset_id: str) -> list["DepreciationRecord"]:
        """
        Retrieve all depreciation records for a specific asset.
        
        Args:
            asset_id: Unique identifier of the asset
            
        Returns:
            List of DepreciationRecord ordered by period
        """
        ...

    def exists_for_asset_and_period(self, asset_id: str, period: str) -> bool:
        """
        Check if a depreciation record exists for given asset and period.
        
        This method supports idempotency check per BC-006.
        
        Args:
            asset_id: Unique identifier of the asset
            period: Period in YYYY-MM format
            
        Returns:
            True if record exists, False otherwise
        """
        ...


class DepreciationReportRepository(Protocol):
    """
    Protocol defining the interface for depreciation report queries.
    
    Provides aggregated data access for generating depreciation reports
    with metrics like accumulated depreciation and book value per asset.
    """

    def find_monthly_depreciation(
        self, asset_id: str, period: str
    ) -> Optional["DepreciationSummary"]:
        """
        Retrieve monthly depreciation summary for an asset in a period.
        
        Args:
            asset_id: Unique identifier of the asset
            period: Period in YYYY-MM format
            
        Returns:
            DepreciationSummary with monthly_depreciation, accumulated_depreciation,
            and book_value fields per ATB-3.1
        """
        ...

    def find_accumulated_depreciation(
        self, asset_id: str, end_period: str
    ) -> Decimal:
        """
        Calculate accumulated depreciation from acquisition to end_period.
        
        Args:
            asset_id: Unique identifier of the asset
            end_period: Period in YYYY-MM format (inclusive)
            
        Returns:
            Total accumulated depreciation amount
        """
        ...

    def find_book_value(self, asset_id: str, period: str) -> Optional[Decimal]:
        """
        Retrieve the book value of an asset at end of a given period.
        
        Args:
            asset_id: Unique identifier of the asset
            period: Period in YYYY-MM format
            
        Returns:
            Book value (original_cost - accumulated_depreciation) or None
        """
        ...

    def batch_query_by_asset_ids(
        self, asset_ids: list[str], period: str
    ) -> list["DepreciationSummary"]:
        """
        Batch query depreciation summaries for multiple assets.
        
        Per ATB-3.3: response time <= 200ms for 10 assets.
        
        Args:
            asset_ids: List of asset identifiers (max 100)
            period: Period in YYYY-MM format
            
        Returns:
            List of DepreciationSummary for each asset
        """
        ...


@dataclass
class DepreciationRecord:
    """
    Entity representing a single depreciation record.
    
    Attributes:
        asset_id: Unique identifier of the asset
        period: Accounting period in YYYY-MM format
        method: Depreciation method ('STRAIGHT_LINE' or 'DECLINING_BALANCE')
        monthly_depreciation: Depreciation amount for this period
        accumulated_depreciation: Cumulative depreciation up to this period
        book_value: Net book value after this period's depreciation
        calculated_at: Timestamp when calculation was performed
    """
    asset_id: str
    period: str
    method: str
    monthly_depreciation: Decimal
    accumulated_depreciation: Decimal
    book_value: Decimal
    calculated_at: datetime


@dataclass
class DepreciationSummary:
    """
    Summary data for depreciation reporting.
    
    This dataclass aggregates depreciation data for query results,
    matching the response schema defined in ATB-3.1.
    
    Attributes:
        asset_id: Unique identifier of the asset
        original_cost: Asset acquisition cost
        period: Reporting period in YYYY-MM format
        monthly_depreciation: Current period depreciation amount
        accumulated_depreciation: Cumulative depreciation
        book_value: Current net book value
    """
    asset_id: str
    original_cost: Decimal
    period: str
    monthly_depreciation: Decimal
    accumulated_depreciation: Decimal
    book_value: Decimal