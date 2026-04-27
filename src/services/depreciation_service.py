"""
Depreciation Service Module

This module implements the depreciation calculation and tracking service
for asset management. It provides functionality to calculate depreciation
using various methods, track asset values over time, and maintain historical
records of all depreciation calculations.

The service supports:
- Multiple depreciation calculation methods (straight-line, declining balance)
- Asset value tracking and history
- Integration with the retirement workflow engine
- Historical record persistence for audit purposes
"""

from typing import Optional, List, Dict, Any, Union
from datetime import datetime, date
from decimal import Decimal, ROUND_HALF_UP
from enum import Enum
from dataclasses import dataclass, field
import logging

# Configure logging for the depreciation service
logger = logging.getLogger(__name__)


class DepreciationMethod(Enum):
    """
    Enumeration of supported depreciation calculation methods.
    
    Attributes:
        STRAIGHT_LINE: Equal depreciation over useful life
        DOUBLE_DECLINING: Accelerated depreciation (200% of straight-line rate)
        UNITS_OF_PRODUCTION: Depreciation based on production/output
    """
    STRAIGHT_LINE = "straight_line"
    DOUBLE_DECLINING = "double_declining"
    UNITS_OF_PRODUCTION = "units_of_production"


class AssetStatus(Enum):
    """
    Enumeration of possible asset statuses in the lifecycle.
    
    Attributes:
        ACTIVE: Asset is in use and being depreciated
        IN_STORAGE: Asset is stored and not being depreciated
        UNDER_MAINTENANCE: Asset is under repair (partial depreciation)
        RETIRED: Asset has been retired/decommissioned
        DISPOSED: Asset has been disposed of
    """
    ACTIVE = "active"
    IN_STORAGE = "in_storage"
    UNDER_MAINTENANCE = "under_maintenance"
    RETIRED = "retired"
    DISPOSED = "disposed"


class DepreciationRecordStatus(Enum):
    """
    Status of a depreciation record in the system.
    
    Attributes:
        PENDING: Calculation is pending
        CALCULATED: Depreciation has been calculated
        POSTED: Depreciation has been posted to ledger
        REVERSED: Depreciation entry has been reversed
    """
    PENDING = "pending"
    CALCULATED = "calculated"
    POSTED = "posted"
    REVERSED = "reversed"


@dataclass
class DepreciationResult:
    """
    Data class representing the result of a depreciation calculation.
    
    Attributes:
        asset_id: Unique identifier of the asset
        period_start: Start date of the depreciation period
        period_end: End date of the depreciation period
        method: Depreciation method used
        original_value: Original cost of the asset
        accumulated_depreciation: Total depreciation to date
        current_value: Net book value after depreciation
        period_depreciation: Depreciation amount for this period
        useful_life_remaining: Remaining useful life in periods
        status: Status of the depreciation record
        calculated_at: Timestamp of calculation
    """
    asset_id: str
    period_start: date
    period_end: date
    method: DepreciationMethod
    original_value: Decimal
    accumulated_depreciation: Decimal
    current_value: Decimal
    period_depreciation: Decimal
    useful_life_remaining: int
    status: DepreciationRecordStatus = DepreciationRecordStatus.CALCULATED
    calculated_at: datetime = field(default_factory=datetime.now)
    
    def to_dict(self) -> Dict[str, Any]:
        """
        Convert the depreciation result to a dictionary representation.
        
        Returns:
            Dictionary containing all depreciation result fields
        """
        return {
            "asset_id": self.asset_id,
            "period_start": self.period_start.isoformat(),
            "period_end": self.period_end.isoformat(),
            "method": self.method.value,
            "original_value": str(self.original_value),
            "accumulated_depreciation": str(self.accumulated_depreciation),
            "current_value": str(self.current_value),
            "period_depreciation": str(self.period_depreciation),
            "useful_life_remaining": self.useful_life_remaining,
            "status": self.status.value,
            "calculated_at": self.calculated_at.isoformat(),
        }


@dataclass
class AssetDepreciationConfig:
    """
    Configuration for asset depreciation calculation.
    
    Attributes:
        asset_id: Unique identifier of the asset
        original_cost: Initial cost of the asset
        salvage_value: Expected value at end of useful life
        useful_life_months: Total useful life in months
        depreciation_method: Method to use for calculation
        acquisition_date: Date when asset was acquired
        depreciation_start_date: Date when depreciation begins
        depreciation_rate: Optional custom depreciation rate
        accumulated_depreciation: Pre-existing accumulated depreciation
    """
    asset_id: str
    original_cost: Decimal
    salvage_value: Decimal
    useful_life_months: int
    depreciation_method: DepreciationMethod = DepreciationMethod.STRAIGHT_LINE
    acquisition_date: Optional[date] = None
    depreciation_start_date: Optional[date] = None
    depreciation_rate: Optional[Decimal] = None
    accumulated_depreciation: Decimal = Decimal("0")
    
    def __post_init__(self):
        """
        Validate the configuration after initialization.
        
        Raises:
            ValueError: If configuration values are invalid
        """
        if self.original_cost <= 0:
            raise ValueError("Original cost must be positive")
        if self.salvage_value < 0:
            raise ValueError("Salvage value cannot be negative")
        if self.salvage_value >= self.original_cost:
            raise ValueError("Salvage value must be less than original cost")
        if self.useful_life_months <= 0:
            raise ValueError("Useful life must be positive")


class DepreciationServiceError(Exception):
    """
    Base exception for depreciation service errors.
    """
    pass


class AssetNotFoundError(DepreciationServiceError):
    """
    Exception raised when an asset cannot be found.
    """
    pass


class InvalidDepreciationConfigError(DepreciationServiceError):
    """
    Exception raised when depreciation configuration is invalid.
    """
    pass


class CalculationError(DepreciationServiceError):
    """
    Exception raised when depreciation calculation fails.
    """
    pass


class DepreciationService:
    """
    Service class for managing asset depreciation calculations and tracking.
    
    This service provides comprehensive functionality for calculating and
    recording asset depreciation using various methods, tracking depreciation
    history, and integrating with the asset retirement workflow.
    
    Attributes:
        _depreciation_cache: Cache for depreciation calculations
        _history_repository: Repository for depreciation history records
    
    Example:
        >>> service = DepreciationService(history_repo)
        >>> config = AssetDepreciationConfig(
        ...     asset_id="AST-001",
        ...     original_cost=Decimal("10000"),
        ...     salvage_value=Decimal("1000"),
        ...     useful_life_months=60
        ... )
        >>> result = service.calculate_depreciation(config)
    """
    
    def __init__(
        self,
        history_repository: Optional[Any] = None,
        asset_repository: Optional[Any] = None
    ) -> None:
        """
        Initialize the depreciation service.
        
        Args:
            history_repository: Repository for storing depreciation history.
                               If None, in-memory storage is used.
            asset_repository: Repository for accessing asset data.
                             If None, basic in-memory storage is used.
        """
        self._depreciation_cache: Dict[str, List[DepreciationResult]] = {}
        self._history_repository = history_repository
        self._asset_repository = asset_repository
        self._depreciation_configs: Dict[str, AssetDepreciationConfig] = {}
        logger.info("DepreciationService initialized")
    
    def register_asset_config(self, config: AssetDepreciationConfig) -> bool:
        """
        Register depreciation configuration for an asset.
        
        Args:
            config: The depreciation configuration to register
        
        Returns:
            True if registration was successful
        
        Raises:
            InvalidDepreciationConfigError: If configuration is invalid
        """
        try:
            self._depreciation_configs[config.asset_id] = config
            logger.info(f"Registered depreciation config for asset {config.asset_id}")
            return True
        except ValueError as e:
            logger.error(f"Invalid config for asset {config.asset_id}: {e}")
            raise InvalidDepreciationConfigError(str(e))
    
    def calculate_depreciation(
        self,
        config: AssetDepreciationConfig,
        period_end: Optional[date] = None
    ) -> DepreciationResult:
        """
        Calculate depreciation for an asset based on its configuration.
        
        This method calculates depreciation using the configured method
        and returns a detailed result including period depreciation,
        accumulated depreciation, and current book value.
        
        Args:
            config: The depreciation configuration for the asset
            period_end: End date of the depreciation period.
                      Defaults to current date if not specified.
        
        Returns:
            DepreciationResult containing detailed depreciation information
        
        Raises:
            InvalidDepreciationConfigError: If configuration is invalid
            CalculationError: If calculation fails
        """
        if period_end is None:
            period_end = date.today()
        
        try:
            # Ensure config is valid
            if config.asset_id not in self._depreciation_configs:
                self.register_asset_config(config)
            
            # Calculate based on method
            if config.depreciation_method == DepreciationMethod.STRAIGHT_LINE:
                result = self._calculate_straight_line(config, period_end)
            elif config.depreciation_method == DepreciationMethod.DOUBLE_DECLINING:
                result = self._calculate_double_declining(config, period_end)
            elif config.depreciation_method == DepreciationMethod.UNITS_OF_PRODUCTION:
                result = self._calculate_units_of_production(config, period_end)
            else:
                raise CalculationError(f"Unknown depreciation method: {config.depreciation_method}")
            
            # Cache the result
            self._cache_depreciation_result(result)
            
            # Persist to history if repository is available
            if self._history_repository:
                self._persist_depreciation_record(result)
            
            logger.info(
                f"Calculated depreciation for asset {config.asset_id}: "
                f"period_depreciation={result.period_depreciation}, "
                f"current_value={result.current_value}"
            )
            
            return result
            
        except ValueError as e:
            logger.error(f"Calculation error for asset {config.asset_id}: {e}")
            raise CalculationError(str(e))
    
    def _calculate_straight_line(
        self,
        config: AssetDepreciationConfig,
        period_end: date
    ) -> DepreciationResult:
        """
        Calculate depreciation using the straight-line method.
        
        The straight-line method evenly distributes depreciation over
        the useful life of the asset.
        
        Formula: (Original Cost - Salvage Value) / Useful Life
        
        Args:
            config: The depreciation configuration
            period_end: End date of the depreciation period
        
        Returns:
            DepreciationResult with calculated values
        """
        depreciable_amount = config.original_cost - config.salvage_value
        monthly_depreciation = depreciable_amount / Decimal(config.useful_life_months)
        
        # Calculate periods since start
        start_date = config.depreciation_start_date or config.acquisition_date or date.today()
        months_elapsed = max(0, (period_end.year - start_date.year) * 12 + 
                            (period_end.month - start_date.month))
        
        accumulated = config.accumulated_depreciation + (monthly_depreciation * Decimal(months_elapsed))
        accumulated = min(accumulated, depreciable_amount)
        
        current_value = config.original_cost - accumulated
        period_depreciation = monthly_depreciation
        remaining = max(0, config.useful_life_months - months_elapsed)
        
        return DepreciationResult(
            asset_id=config.asset_id,
            period_start=start_date,
            period_end=period_end,
            method=DepreciationMethod.STRAIGHT_LINE,
            original_value=config.original_cost,
            accumulated_depreciation=accumulated,
            current_value=current_value,
            period_depreciation=period_depreciation,
            useful_life_remaining=remaining,
        )
    
    def _calculate_double_declining(
        self,
        config: AssetDepreciationConfig,
        period_end: date
    ) -> DepreciationResult:
        """
        Calculate depreciation using the double-declining balance method.
        
        This accelerated method applies twice the straight-line rate
        to the declining book value.
        
        Formula: 2 * (1 / Useful Life) * Book Value
        
        Args:
            config: The depreciation configuration
            period_end: End date of the depreciation period
        
        Returns:
            DepreciationResult with calculated values
        """
        if config.depreciation_rate:
            rate = config.depreciation_rate
        else:
            rate = Decimal("2") / Decimal(config.useful_life_months)
        
        # Calculate periods since start
        start_date = config.depreciation_start_date or config.acquisition_date or date.today()
        months_elapsed = max(0, (period_end.year - start_date.year) * 12 + 
                            (period_end.month - start_date.month))
        
        # Get current book value
        book_value = config.original_cost - config.accumulated_depreciation
        
        # Calculate period depreciation
        period_depreciation = book_value * rate
        
        # Ensure we don't go below salvage value
        if book_value - period_depreciation < config.salvage_value:
            period_depreciation = book_value - config.salvage_value
        
        accumulated = config.accumulated_depreciation + period_depreciation
        current_value = config.original_cost - accumulated
        remaining = max(0, config.useful_life_months - months_elapsed)
        
        return DepreciationResult(
            asset_id=config.asset_id,
            period_start=start_date,
            period_end=period_end,
            method=DepreciationMethod.DOUBLE_DECLINING,
            original_value=config.original_cost,
            accumulated_depreciation=accumulated,
            current_value=current_value,
            period_depreciation=period_depreciation,
            useful_life_remaining=remaining,
        )
    
    def _calculate_units_of_production(
        self,
        config: DepreciationConfig,
        period_end: date
    ) -> DepreciationResult:
        """
        Calculate depreciation using the units of production method.
        
        This method bases depreciation on usage rather than time.
        Requires total_units and units_this_period to be set.
        
        Args:
            config: The depreciation configuration with unit information
            period_end: End date of the depreciation period
        
        Returns:
            DepreciationResult with calculated values
        """
        # This is a simplified implementation; real-world would need unit tracking
        depreciable_amount = config.original_cost - config.salvage_value
        
        # For units of production, we'd need actual usage data
        # Using a placeholder calculation here
        start_date = config.depreciation_start_date or config.acquisition_date or date.today()
        months_elapsed = max(1, (period_end.year - start_date.year) * 12 + 
                            (period_end.month - start_date.month))
        
        # Assume uniform distribution for simplicity
        period_depreciation = depreciable_amount / Decimal(config.useful_life_months)
        accumulated = config.accumulated_depreciation + period_depreciation
        current_value = config.original_cost - accumulated
        remaining = max(0, config.useful_life_months - months_elapsed)
        
        return DepreciationResult(
            asset_id=config.asset_id,
            period_start=start_date,
            period_end=period_end,
            method=DepreciationMethod.UNITS_OF_PRODUCTION,
            original_value=config.original_cost,
            accumulated_depreciation=accumulated,
            current_value=current_value,
            period_depreciation=period_depreciation,
            useful_life_remaining=remaining,
        )
    
    def _cache_depreciation_result(self, result: DepreciationResult) -> None:
        """
        Cache a depreciation result in memory.
        
        Args:
            result: The depreciation result to cache
        """
        if result.asset_id not in self._depreciation_cache:
            self._depreciation_cache[result.asset_id] = []
        self._depreciation_cache[result.asset_id].append(result)
    
    def _persist_depreciation_record(self, result: DepreciationResult) -> bool:
        """
        Persist a depreciation record to the history repository.
        
        Args:
            result: The depreciation result to persist
        
        Returns:
            True if persistence was successful
        """
        try:
            if self._history_repository:
                self._history_repository.save(result.to_dict())
                logger.debug(f"Persisted depreciation record for asset {result.asset_id}")
                return True
        except Exception as e:
            logger.warning(f"Failed to persist depreciation record: {e}")
        return False
    
    def get_asset_depreciation(
        self,
        asset_id: str,
        as_of_date: Optional[date] = None
    ) -> Optional[DepreciationResult]:
        """
        Get the most recent depreciation calculation for an asset.
        
        Args:
            asset_id: The unique identifier of the asset
            as_of_date: Optional date to get depreciation as of that date
        
        Returns:
            The most recent DepreciationResult or None if not found
        """
        if asset_id not in self._depreciation_cache:
            return None
        
        results = self._depreciation_cache[asset_id]
        
        if as_of_date:
            for result in reversed(results):
                if result.period_end <= as_of_date:
                    return result
        
        return results[-1] if results else None
    
    def get_depreciation_history(
        self,
        asset_id: str,
        limit: Optional[int] = None
    ) -> List[DepreciationResult]:
        """
        Get the depreciation history for an asset.
        
        Args:
            asset_id: The unique identifier of the asset
            limit: Optional limit on number of records to return
        
        Returns:
            List of DepreciationResult objects ordered by date
        """
        results = self._depreciation_cache.get(asset_id, [])
        if limit:
            return results[-limit:]
        return results
    
    def calculate_total_depreciation(
        self,
        asset_ids: Optional[List[str]] = None
    ) -> Decimal:
        """
        Calculate total accumulated depreciation for multiple assets.
        
        Args:
            asset_ids: Optional list of asset IDs. If None, calculates for all.
        
        Returns:
            Total accumulated depreciation amount
        """
        total = Decimal("0")
        assets_to_process = asset_ids or list(self._depreciation_cache.keys())
        
        for asset_id in assets_to_process:
            latest = self.get_asset_depreciation(asset_id)
            if latest:
                total += latest.accumulated_depreciation
        
        return total
    
    def get_current_book_value(self, asset_id: str) -> Optional[Decimal]:
        """
        Get the current book value for an asset.
        
        Args:
            asset_id: The unique identifier of the asset
        
        Returns:
            Current book value or None if asset not found
        """
        latest = self.get_asset_depreciation(asset_id)
        return latest.current_value if latest else None
    
    def is_asset_fully_depreciated(self, asset_id: str) -> bool:
        """
        Check if an asset has been fully depreciated.
        
        An asset is considered fully depreciated when its current value
        equals its salvage value.
        
        Args:
            asset_id: The unique identifier of the asset
        
        Returns:
            True if asset is fully depreciated
        """
        latest = self.get_asset_depreciation(asset_id)
        if not latest:
            return False
        
        config = self._depreciation_configs.get(asset_id)
        if not config:
            return False
        
        return latest.current_value <= config.salvage_value
    
    def reverse_depreciation(
        self,
        asset_id: str,
        amount: Decimal,
        reason: str
    ) -> DepreciationResult:
        """
        Reverse a portion of accumulated depreciation.
        
        Args:
            asset_id: The unique identifier of the asset
            amount: Amount of depreciation to reverse
            reason: Reason for the reversal
        
        Returns:
            Updated DepreciationResult
        
        Raises:
            CalculationError: If reversal amount exceeds accumulated depreciation
        """
        latest = self.get_asset_depreciation(asset_id)
        if not latest:
            raise CalculationError(f"No depreciation record found for asset {asset_id}")
        
        if amount > latest.accumulated_depreciation:
            raise CalculationError(
                f"Reversal amount ({amount}) exceeds accumulated depreciation "
                f"({latest.accumulated_depreciation})"
            )
        
        # Create reversed record
        new_accumulated = latest.accumulated_depreciation - amount
        new_current = latest.original_value - new_accumulated
        
        result = DepreciationResult(
            asset_id=asset_id,
            period_start=latest.period_start,
            period_end=date.today(),
            method=latest.method,
            original_value=latest.original_value,
            accumulated_depreciation=new_accumulated,
            current_value=new_current,
            period_depreciation=-amount,
            useful_life_remaining=latest.useful_life_remaining,
            status=DepreciationRecordStatus.REVERSED,
        )
        
        self._cache_depreciation_result(result)
        
        if self._history_repository:
            record = result.to_dict()
            record["reversal_reason"] = reason
            self._persist_depreciation_record(result)
        
        logger.info(
            f"Reversed {amount} depreciation for asset {asset_id}. "
            f"New accumulated: {new_accumulated}"
        )
        
        return result
    
    def bulk_calculate_depreciation(
        self,
        period_end: Optional[date] = None
    ) -> Dict[str, DepreciationResult]:
        """
        Calculate depreciation for all registered assets.
        
        Args:
            period_end: End date of the depreciation period
        
        Returns:
            Dictionary mapping asset IDs to their depreciation results
        """
        results = {}
        
        for asset_id, config in self._depreciation_configs.items():
            try:
                result = self.calculate_depreciation(config, period_end)
                results[asset_id] = result
            except Exception as e:
                logger.error(f"Failed to calculate depreciation for {asset_id}: {e}")
        
        logger.info(f"Bulk depreciation calculation completed: {len(results)} assets")
        return results
    
    def validate_asset_eligibility(self, asset_id: str) -> bool:
        """
        Validate if an asset is eligible for depreciation.
        
        Args:
            asset_id: The unique identifier of the asset
        
        Returns:
            True if asset is eligible for depreciation
        """
        config = self._depreciation_configs.get(asset_id)
        if not config:
            return False
        
        # Check if already fully depreciated
        if self.is_asset_fully_depreciated(asset_id):
            return False
        
        # Check if asset is in retired/disposed status
        # In a real implementation, this would check against asset repository
        
        return True
    
    def generate_depreciation_report(
        self,
        asset_ids: Optional[List[str]] = None,
        start_date: Optional[date] = None,
        end_date: Optional[date] = None
    ) -> Dict[str, Any]:
        """
        Generate a comprehensive depreciation report.
        
        Args:
            asset_ids: Optional list of asset IDs to include
            start_date: Optional start date for the report period
            end_date: Optional end date for the report period
        
        Returns:
            Dictionary containing report data
        """
        assets_to_report = asset_ids or list(self._depreciation_configs.keys())
        
        asset_details = []
        total_original_value = Decimal("0")
        total_accumulated = Decimal("0")
        total_current_value = Decimal("0")
        
        for asset_id in assets_to_report:
            config = self._depreciation_configs.get(asset_id)
            latest = self.get_asset_depreciation(asset_id)
            
            if config and latest:
                asset_details.append({
                    "asset_id": asset_id,
                    "original_value": str(config.original_value),
                    "accumulated_depreciation": str(latest.accumulated_depreciation),
                    "current_value": str(latest.current_value),
                    "method": latest.method.value,
                    "useful_life_remaining": latest.useful_life_remaining,
                    "is_fully_depreciated": self.is_asset_fully_depreciated(asset_id),
                })
                
                total_original_value += config.original_value
                total_accumulated += latest.accumulated_depreciation
                total_current_value += latest.current_value
        
        return {
            "report_date": date.today().isoformat(),
            "period_start": start_date.isoformat() if start_date else None,
            "period_end": end_date.isoformat() if end_date else date.today().isoformat(),
            "total_assets": len(asset_details),
            "total_original_value": str(total_original_value),
            "total_accumulated_depreciation": str(total_accumulated),
            "total_current_value": str(total_current_value),
            "asset_details": asset_details,
        }


# Standalone calculation functions for simpler use cases

def calculate_straight_line_depreciation(
    original_cost: Union[float, Decimal],
    salvage_value: Union[float, Decimal],
    useful_life_months: int,
    months_elapsed: int = 0
) -> Dict[str, Decimal]:
    """
    Calculate depreciation using the straight-line method.
    
    This is a standalone function for simple depreciation calculations
    without the full service context.
    
    Args:
        original_cost: Initial cost of the asset
        salvage_value: Expected value at end of useful life
        useful_life_months: Total useful life in months
        months_elapsed: Number of months already depreciated
    
    Returns:
        Dictionary containing:
        - monthly_depreciation: Depreciation amount per month
        - accumulated_depreciation: Total depreciation to date
        - current_value: Net book value
        - remaining_life: Months of useful life remaining
    
    Example:
        >>> result = calculate_straight_line_depreciation(10000, 1000, 60, 12)
        >>> print(result['monthly_depreciation'])
        Decimal('150.00')
    """
    original = Decimal(str(original_cost))
    salvage = Decimal(str(salvage_value))
    
    depreciable_amount = original - salvage
    monthly = (depreciable_amount / Decimal(useful_life_months)).quantize(
        Decimal("0.01"), rounding=ROUND_HALF_UP
    )
    
    accumulated = (monthly * Decimal(months_elapsed)).quantize(
        Decimal("0.01"), rounding=ROUND_HALF_UP
    )
    
    current = original - accumulated
    remaining = max(0, useful_life_months - months_elapsed)
    
    return {
        "monthly_depreciation": monthly,
        "accumulated_depreciation": accumulated,
        "current_value": current,
        "remaining_life": remaining,
    }


def calculate_double_declining_depreciation(
    original_cost: Union[float, Decimal],
    salvage_value: Union[float, Decimal],
    useful_life_months: int,
    months_elapsed: int = 0,
    rate_multiplier: float = 2.0
) -> Dict[str, Decimal]:
    """
    Calculate depreciation using the double-declining balance method.
    
    Args:
        original_cost: Initial cost of the asset
        salvage_value: Expected value at end of useful life
        useful_life_months: Total useful life in months
        months_elapsed: Number of months already depreciated
        rate_multiplier: Multiplier for the base rate (default 2.0 for double)
    
    Returns:
        Dictionary containing:
        - period_depreciation: Depreciation for current period
        - accumulated_depreciation: Total depreciation to date
        - current_value: Net book value
        - remaining_life: Months of useful life remaining
    """
    original = Decimal(str(original_cost))
    salvage = Decimal(str(salvage_value))
    
    base_rate = Decimal("1") / Decimal(useful_life_months)
    rate = base_rate * Decimal(str(rate_multiplier))
    
    # Calculate accumulated depreciation through elapsed periods
    accumulated = Decimal("0")
    current_book = original
    
    for _ in range(min(months_elapsed, useful_life_months)):
        period_dep = current_book * rate
        # Don't depreciate below salvage value
        if current_book - period_dep < salvage:
            period_dep = current_book - salvage
        accumulated += period_dep
        current_book -= period_dep
    
    current_value = original - accumulated
    remaining = max(0, useful_life_months - months_elapsed)
    
    return {
        "period_depreciation": current_value * rate if remaining > 0 else Decimal("0"),
        "accumulated_depreciation": accumulated.quantize(Decimal("0.01")),
        "current_value": current_value.quantize(Decimal("0.01")),
        "remaining_life": remaining,
    }


def calculate_units_of_production_depreciation(
    original_cost: Union[float, Decimal],
    salvage_value: Union[float, Decimal],
    total_units: int,
    units_this_period: int,
    units_produced_to_date: int = 0
) -> Dict[str, Decimal]:
    """
    Calculate depreciation using the units of production method.
    
    Args:
        original_cost: Initial cost of the asset
        salvage_value: Expected value at end of useful life
        total_units: Total estimated units over useful life
        units_this_period: Units produced in current period
        units_produced_to_date: Total units produced to date
    
    Returns:
        Dictionary containing depreciation calculation
    """
    original = Decimal(str(original_cost))
    salvage = Decimal(str(salvage_value))
    
    depreciable_amount = original - salvage
    depreciation_per_unit = depreciable_amount / Decimal(total_units)
    
    accumulated = depreciation_per_unit * Decimal(units_produced_to_date)
    period_depreciation = depreciation_per_unit * Decimal(units_this_period)
    current_value = original - accumulated - period_depreciation
    
    return {
        "depreciation_per_unit": depreciation_per_unit.quantize(Decimal("0.01")),
        "period_depreciation": period_depreciation.quantize(Decimal("0.01")),
        "accumulated_depreciation": accumulated.quantize(Decimal("0.01")),
        "current_value": current_value.quantize(Decimal("0.01")),
    }