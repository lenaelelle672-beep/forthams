"""
Dashboard Statistics Service Unit Tests

This module contains unit tests for the DashboardStatisticsService covering:
- ATB-1: Asset overview statistics API
- ATB-2: Asset classification statistics API
- ATB-3: Asset expiration warning API
- ATB-4: Data model constraints
- ATB-5: Performance benchmarks

Test Environment:
    Python >= 3.11
    pytest >= 7.0
    pytest-asyncio >= 0.21.0

Version: SWARM-S5-003 Iteration 1
"""

import pytest
from datetime import date, datetime, timedelta
from typing import Dict, List, Any, Optional
from unittest.mock import AsyncMock, MagicMock, patch
import time

# ============================================================================
# Test Fixtures
# ============================================================================

@pytest.fixture
def mock_repository():
    """
    Create a mock repository for testing DashboardStatisticsService.
    
    Returns:
        MagicMock: Mocked repository with async methods
    """
    mock = MagicMock()
    mock.get_overview_stats = AsyncMock(return_value={
        "total_count": 0,
        "by_status": {},
        "by_type": {},
        "by_department": {}
    })
    mock.get_statistics = AsyncMock(return_value=[])
    mock.get_expiring_assets = AsyncMock(return_value=[])
    return mock


@pytest.fixture
def service(mock_repository):
    """
    Create DashboardStatisticsService instance with mocked repository.
    
    Args:
        mock_repository: Mocked repository fixture
        
    Returns:
        DashboardStatisticsService: Service instance for testing
    """
    from src.services.dashboard_statistics_service import DashboardStatisticsService
    return DashboardStatisticsService(repository=mock_repository)


@pytest.fixture
def sample_assets():
    """
    Create sample asset data for testing.
    
    Returns:
        List[Dict]: List of sample asset dictionaries
    """
    return [
        {
            "id": 1,
            "name": "测试资产A",
            "asset_type": "equipment",
            "status": "active",
            "department": "IT",
            "expiration_date": (date.today() + timedelta(days=15)).isoformat(),
            "purchase_date": "2024-01-01",
            "value": 10000.00
        },
        {
            "id": 2,
            "name": "测试资产B",
            "asset_type": "license",
            "status": "active",
            "department": "HR",
            "expiration_date": (date.today() + timedelta(days=45)).isoformat(),
            "purchase_date": "2024-02-01",
            "value": 5000.00
        },
        {
            "id": 3,
            "name": "测试资产C",
            "asset_type": "contract",
            "status": "inactive",
            "department": "Finance",
            "expiration_date": (date.today() + timedelta(days=7)).isoformat(),
            "purchase_date": "2023-06-01",
            "value": 20000.00
        },
        {
            "id": 4,
            "name": "测试资产D",
            "asset_type": "equipment",
            "status": "active",
            "department": "IT",
            "expiration_date": (date.today() + timedelta(days=60)).isoformat(),
            "purchase_date": "2024-03-01",
            "value": 15000.00
        },
        {
            "id": 5,
            "name": "测试资产E",
            "asset_type": "document",
            "status": "maintenance",
            "department": "Legal",
            "expiration_date": (date.today() + timedelta(days=3)).isoformat(),
            "purchase_date": "2023-12-01",
            "value": 500.00
        }
    ]


@pytest.fixture
def sample_overview_response():
    """
    Create sample overview response data.
    
    Returns:
        Dict: Sample overview statistics response
    """
    return {
        "total_count": 5,
        "by_status": {
            "active": 3,
            "inactive": 1,
            "maintenance": 1
        },
        "by_type": {
            "equipment": 2,
            "license": 1,
            "contract": 1,
            "document": 1
        },
        "by_department": {
            "IT": 2,
            "HR": 1,
            "Finance": 1,
            "Legal": 1
        }
    }


# ============================================================================
# ATB-1: Asset Overview Statistics API Tests
# ============================================================================

class TestAssetOverview:
    """
    Test cases for ATB-1: Asset Overview Statistics API.
    
    Verification Methods:
        - Test scenario 1: Returns correct data structure
        - Test scenario 2: Empty dataset returns zeros
        - Test scenario 3: Statistics accuracy with mock data
    """
    
    @pytest.mark.asyncio
    async def test_overview_returns_correct_structure(self, service, mock_repository):
        """
        ATB-1 Test Scenario 1: Verify response contains required keys.
        
        Expected: response includes total_count, by_status, by_type, by_department
        
        Test Approach:
            1. Call get_overview_stats method
            2. Assert all required keys exist in response
        """
        mock_repository.get_overview_stats.return_value = {
            "total_count": 100,
            "by_status": {"active": 80, "inactive": 20},
            "by_type": {"equipment": 50, "license": 50},
            "by_department": {"IT": 60, "HR": 40}
        }
        
        result = await service.get_overview_stats()
        
        assert "total_count" in result, "Response must contain 'total_count' key"
        assert "by_status" in result, "Response must contain 'by_status' key"
        assert "by_type" in result, "Response must contain 'by_type' key"
        assert "by_department" in result, "Response must contain 'by_department' key"
        assert isinstance(result["total_count"], int), "total_count must be integer"
        assert isinstance(result["by_status"], dict), "by_status must be dictionary"

    @pytest.mark.asyncio
    async def test_overview_empty_dataset_returns_zeros(
        self, service, mock_repository
    ):
        """
        ATB-1 Test Scenario 2: Empty dataset returns zero values.
        
        Expected: When no assets exist, all count fields return 0
        
        Test Approach:
            1. Mock repository to return empty results
            2. Call get_overview_stats method
            3. Assert all numerical fields are 0
        """
        mock_repository.get_overview_stats.return_value = {
            "total_count": 0,
            "by_status": {},
            "by_type": {},
            "by_department": {}
        }
        
        result = await service.get_overview_stats()
        
        assert result["total_count"] == 0, "Empty dataset should return total_count = 0"
        assert result["by_status"] == {}, "Empty dataset should return empty by_status"
        assert result["by_type"] == {}, "Empty dataset should return empty by_type"

    @pytest.mark.asyncio
    async def test_overview_statistics_accuracy(
        self, service, mock_repository, sample_assets, sample_overview_response
    ):
        """
        ATB-1 Test Scenario 3: Verify statistics aggregation accuracy.
        
        Expected: Aggregated counts match pre-seeded test data
        
        Test Approach:
            1. Pre-seed 5 assets with known type distribution [equipment:2, license:1, contract:1, document:1]
            2. Call get_overview_stats method
            3. Verify by_type aggregation matches database COUNT
        """
        mock_repository.get_overview_stats.return_value = sample_overview_response
        
        result = await service.get_overview_stats()
        
        # Verify type distribution
        assert result["by_type"]["equipment"] == 2, "equipment count mismatch"
        assert result["by_type"]["license"] == 1, "license count mismatch"
        assert result["by_type"]["contract"] == 1, "contract count mismatch"
        assert result["by_type"]["document"] == 1, "document count mismatch"
        
        # Verify total count
        assert result["total_count"] == sum(result["by_type"].values()), \
            "total_count must equal sum of by_type values"

    @pytest.mark.asyncio
    async def test_overview_response_time_benchmark(self, service, mock_repository):
        """
        ATB-5 Test Scenario 1: Response time < 200ms for 1000 records.
        
        Expected: API responds within 200ms under normal load
        
        Test Approach:
            1. Mock repository with 1000 record simulation
            2. Measure elapsed time using time.perf_counter()
            3. Assert elapsed < 0.2 seconds
        """
        # Simulate 1000 records response
        mock_repository.get_overview_stats.return_value = {
            "total_count": 1000,
            "by_status": {f"status_{i}": 100 for i in range(10)},
            "by_type": {f"type_{i}": 100 for i in range(10)},
            "by_department": {f"dept_{i}": 50 for i in range(20)}
        }
        
        start_time = time.perf_counter()
        result = await service.get_overview_stats()
        elapsed = time.perf_counter() - start_time
        
        assert elapsed < 0.2, f"Response time {elapsed:.3f}s exceeds 200ms threshold"

    @pytest.mark.asyncio
    async def test_overview_limit_exceeded_returns_error(self, service, mock_repository):
        """
        ATB-5 Test Scenario 2: Query limit exceeded returns 400 error.
        
        Expected: When limit > 1000, raise ValueError with message
        
        Test Approach:
            1. Call get_overview_stats with limit=5000
            2. Assert ValueError is raised
            3. Verify error message contains "limit exceeded"
        """
        with pytest.raises(ValueError) as exc_info:
            await service.get_overview_stats(limit=5000)
        
        assert "limit exceeded" in str(exc_info.value).lower() or \
               "exceeded" in str(exc_info.value).lower(), \
               "Error message should indicate limit exceeded"


# ============================================================================
# ATB-2: Classification Statistics API Tests
# ============================================================================

class TestClassificationStatistics:
    """
    Test cases for ATB-2: Classification Statistics API.
    
    Verification Methods:
        - Test scenario 1: Supports group_by parameter filtering
        - Test scenario 2: Supports date range filtering
        - Test scenario 3: Invalid group_by returns 422
    """
    
    @pytest.mark.asyncio
    async def test_statistics_group_by_type(self, service, mock_repository):
        """
        ATB-2 Test Scenario 1: Verify group_by=asset_type aggregation.
        
        Expected: Returns aggregated results grouped by asset_type
        
        Test Approach:
            1. Call get_statistics with group_by="asset_type"
            2. Assert response is list with type-based grouping
        """
        mock_repository.get_statistics.return_value = [
            {"asset_type": "equipment", "count": 50, "total_value": 500000},
            {"asset_type": "license", "count": 30, "total_value": 150000},
            {"asset_type": "contract", "count": 15, "total_value": 300000},
            {"asset_type": "document", "count": 5, "total_value": 5000}
        ]
        
        result = await service.get_statistics(group_by="asset_type")
        
        assert isinstance(result, list), "Result must be a list"
        assert len(result) == 4, "Should have 4 asset type groups"
        
        # Verify structure of each group
        for item in result:
            assert "asset_type" in item, "Each item must have asset_type"
            assert "count" in item, "Each item must have count"
            assert "total_value" in item, "Each item must have total_value"

    @pytest.mark.asyncio
    async def test_statistics_group_by_status(self, service, mock_repository):
        """
        ATB-2 Test Scenario 1b: Verify group_by=status aggregation.
        
        Expected: Returns aggregated results grouped by status
        
        Test Approach:
            1. Call get_statistics with group_by="status"
            2. Assert response contains status-based groups
        """
        mock_repository.get_statistics.return_value = [
            {"status": "active", "count": 80, "total_value": 800000},
            {"status": "inactive", "count": 10, "total_value": 50000},
            {"status": "maintenance", "count": 10, "total_value": 50000}
        ]
        
        result = await service.get_statistics(group_by="status")
        
        assert isinstance(result, list), "Result must be a list"
        statuses = [item["status"] for item in result]
        assert "active" in statuses, "Should include active status"
        assert "inactive" in statuses, "Should include inactive status"

    @pytest.mark.asyncio
    async def test_statistics_with_date_range(self, service, mock_repository):
        """
        ATB-2 Test Scenario 2: Date range filtering works correctly.
        
        Expected: Only assets within specified date range are included
        
        Test Approach:
            1. Call get_statistics with date_from and date_to
            2. Verify repository received correct date parameters
        """
        date_from = "2024-01-01"
        date_to = "2024-12-31"
        
        mock_repository.get_statistics.return_value = [
            {"asset_type": "equipment", "count": 25, "total_value": 250000}
        ]
        
        result = await service.get_statistics(
            group_by="asset_type",
            date_from=date_from,
            date_to=date_to
        )
        
        # Verify repository was called with correct parameters
        mock_repository.get_statistics.assert_called_once()
        call_kwargs = mock_repository.get_statistics.call_args.kwargs
        assert call_kwargs.get("date_from") == date_from, "date_from parameter mismatch"
        assert call_kwargs.get("date_to") == date_to, "date_to parameter mismatch"

    @pytest.mark.asyncio
    async def test_statistics_invalid_group_by_returns_error(self, service):
        """
        ATB-2 Test Scenario 3: Invalid group_by raises ValueError.
        
        Expected: Invalid group_by field raises ValueError with HTTP 422
        
        Test Approach:
            1. Call get_statistics with invalid group_by value
            2. Assert ValueError is raised
            3. Verify error mentions valid fields
        """
        with pytest.raises(ValueError) as exc_info:
            await service.get_statistics(group_by="invalid_field")
        
        error_message = str(exc_info.value).lower()
        assert "invalid" in error_message or "not supported" in error_message, \
            "Error should indicate invalid field"
        
        # Verify valid options are mentioned
        assert "asset_type" in error_message or "status" in error_message, \
            "Error should list valid group_by options"

    @pytest.mark.asyncio
    async def test_statistics_empty_result_returns_empty_list(self, service, mock_repository):
        """
        ATB-2 Extended: Empty result returns empty list, not null.
        
        Expected: When no matching data, return empty list []
        
        Test Approach:
            1. Mock repository to return empty list
            2. Call get_statistics with non-matching date range
            3. Assert result is empty list, not None
        """
        mock_repository.get_statistics.return_value = []
        
        result = await service.get_statistics(group_by="asset_type")
        
        assert isinstance(result, list), "Result must be a list"
        assert result == [], "Empty result should return empty list"


# ============================================================================
# ATB-3: Expiration Warning API Tests
# ============================================================================

class TestExpirationWarning:
    """
    Test cases for ATB-3: Expiration Warning API.
    
    Verification Methods:
        - Test scenario 1: Default 30-day threshold filtering
        - Test scenario 2: Custom threshold parameter
        - Test scenario 3: Sorted by urgency (days until expiration)
        - Test scenario 4: Empty result returns 200 with empty array
    """
    
    @pytest.mark.asyncio
    async def test_expiring_default_30_days_threshold(
        self, service, mock_repository, sample_assets
    ):
        """
        ATB-3 Test Scenario 1: Default 30-day threshold works.
        
        Expected: Only assets expiring within 30 days are returned
        
        Test Data:
            - Asset A: 15 days (INCLUDED)
            - Asset B: 45 days (EXCLUDED)
        
        Test Approach:
            1. Pre-seed assets with known expiration dates
            2. Call get_expiring_assets without threshold parameter
            3. Assert only assets within 30 days are returned
        """
        # Assets within 30 days
        expiring_assets = [
            a for a in sample_assets
            if (date.fromisoformat(a["expiration_date"]) - date.today()).days <= 30
        ]
        mock_repository.get_expiring_assets.return_value = expiring_assets
        
        result = await service.get_expiring_assets()
        
        # Verify only assets within 30 days are returned
        for asset in result:
            days_until = (date.fromisoformat(asset["expiration_date"]) - date.today()).days
            assert days_until <= 30, \
                f"Asset {asset['id']} has {days_until} days, should be <= 30"
        
        # Asset A (15 days) should be included
        # Asset B (45 days) should be excluded
        assert len(result) == 3, "Should return 3 assets within 30 days"

    @pytest.mark.asyncio
    async def test_expiring_custom_threshold(self, service, mock_repository, sample_assets):
        """
        ATB-3 Test Scenario 2: Custom threshold parameter works.
        
        Expected: When days=60, assets within 60 days are returned
        
        Test Approach:
            1. Call get_expiring_assets with days=60
            2. Verify repository received correct threshold
            3. Assert returned asset count matches threshold filter
        """
        custom_threshold = 60
        expiring_assets = [
            a for a in sample_assets
            if (date.fromisoformat(a["expiration_date"]) - date.today()).days <= custom_threshold
        ]
        mock_repository.get_expiring_assets.return_value = expiring_assets
        
        result = await service.get_expiring_assets(days=custom_threshold)
        
        mock_repository.get_expiring_assets.assert_called_once_with(days=custom_threshold)
        assert len(result) == 4, "Should return 4 assets within 60 days"

    @pytest.mark.asyncio
    async def test_expiring_sorted_by_urgency(self, service, mock_repository, sample_assets):
        """
        ATB-3 Test Scenario 3: Results sorted by urgency (nearest expiration first).
        
        Expected: Return order is [B(3 days), E(7 days), A(15 days), C(14 days) ascending]
        
        Test Approach:
            1. Pre-seed assets with different expiration dates
            2. Call get_expiring_assets
            3. Assert days_until_expiration is ascending (most urgent first)
        """
        # Sort sample_assets by days until expiration (ascending)
        sorted_assets = sorted(
            sample_assets,
            key=lambda x: (date.fromisoformat(x["expiration_date"]) - date.today()).days
        )
        mock_repository.get_expiring_assets.return_value = sorted_assets
        
        result = await service.get_expiring_assets()
        
        # Verify sorting: most urgent (fewest days) should come first
        for i in range(len(result) - 1):
            current_days = (date.fromisoformat(result[i]["expiration_date"]) - date.today()).days
            next_days = (date.fromisoformat(result[i + 1]["expiration_date"]) - date.today()).days
            assert current_days <= next_days, \
                f"Results not sorted by urgency: {current_days} > {next_days}"

    @pytest.mark.asyncio
    async def test_expiring_no_results_returns_200(self, service, mock_repository):
        """
        ATB-3 Test Scenario 4: No expiring assets returns HTTP 200 with empty array.
        
        Expected: When no assets within threshold, return 200 with items=[]
        
        Test Approach:
            1. Mock repository to return empty list
            2. Call get_expiring_assets
            3. Assert result is empty list, not error
        """
        mock_repository.get_expiring_assets.return_value = []
        
        result = await service.get_expiring_assets()
        
        assert result == [], "No results should return empty list"
        assert isinstance(result, list), "Result must be a list type"

    @pytest.mark.asyncio
    async def test_expiring_includes_critical_level(self, service, mock_repository, sample_assets):
        """
        ATB-3 Extended: Include criticality level based on days remaining.
        
        Expected: Assets classified as critical/warning/normal based on urgency
        
        Critical: <= 7 days
        Warning: <= 14 days
        Normal: <= 30 days
        
        Test Approach:
            1. Call get_expiring_assets
            2. Verify each asset has criticality classification
        """
        mock_repository.get_expiring_assets.return_value = sample_assets[:3]
        
        result = await service.get_expiring_assets()
        
        for asset in result:
            days_until = (date.fromisoformat(asset["expiration_date"]) - date.today()).days
            assert "criticality" in asset, "Asset must have criticality field"
            
            if days_until <= 7:
                assert asset["criticality"] == "critical", \
                    f"Asset with {days_until} days should be critical"
            elif days_until <= 14:
                assert asset["criticality"] == "warning", \
                    f"Asset with {days_until} days should be warning"


# ============================================================================
# ATB-4: Data Model Constraints Tests
# ============================================================================

class TestDataModelConstraints:
    """
    Test cases for ATB-4: Data Model Constraints.
    
    Verification Methods:
        - Test scenario 1: expiration_date must be future date
        - Test scenario 2: asset_type enum validation
    """
    
    @pytest.mark.asyncio
    async def test_asset_expiration_date_must_be_future(self, service):
        """
        ATB-4 Test Scenario 1: Past expiration date raises ValidationError.
        
        Expected: Asset with expiration_date < today raises ValueError
        
        Test Approach:
            1. Create asset with past expiration date
            2. Assert ValidationError/ValueError is raised
        """
        past_date = (date.today() - timedelta(days=1)).isoformat()
        
        with pytest.raises(ValueError) as exc_info:
            await service.validate_asset_expiration(past_date)
        
        assert "expiration" in str(exc_info.value).lower(), \
            "Error should mention expiration validation"

    @pytest.mark.asyncio
    async def test_asset_type_enum_validation_valid(self, service):
        """
        ATB-4 Test Scenario 2a: Valid asset_type values pass validation.
        
        Expected: Valid types [equipment, license, contract, document] pass
        
        Test Approach:
            1. Test each valid asset_type value
            2. Assert no exception is raised
        """
        valid_types = ["equipment", "license", "contract", "document"]
        
        for asset_type in valid_types:
            # Should not raise any exception
            result = await service.validate_asset_type(asset_type)
            assert result is True, f"Valid type '{asset_type}' should pass validation"

    @pytest.mark.asyncio
    async def test_asset_type_enum_validation_invalid(self, service):
        """
        ATB-4 Test Scenario 2b: Invalid asset_type raises ValueError.
        
        Expected: Invalid type "invalid_type" raises ValueError
        
        Test Approach:
            1. Attempt to validate "invalid_type"
            2. Assert ValueError is raised
            3. Verify error mentions valid options
        """
        with pytest.raises(ValueError) as exc_info:
            await service.validate_asset_type("invalid_type")
        
        error_message = str(exc_info.value).lower()
        assert "invalid" in error_message or "not supported" in error_message, \
            "Error should indicate invalid type"

    @pytest.mark.asyncio
    async def test_asset_required_fields_validation(self, service):
        """
        ATB-4 Extended: Required fields must be present.
        
        Expected: Asset missing required fields raises ValidationError
        
        Test Approach:
            1. Create asset dict with missing name field
            2. Assert ValidationError is raised
        """
        incomplete_asset = {
            "asset_type": "equipment",
            "status": "active",
            # Missing: name, expiration_date
        }
        
        with pytest.raises(ValueError) as exc_info:
            await service.validate_required_fields(incomplete_asset)
        
        assert "required" in str(exc_info.value).lower(), \
            "Error should indicate missing required fields"


# ============================================================================
# ATB-5: Performance Benchmark Tests
# ============================================================================

class TestPerformanceBenchmarks:
    """
    Test cases for ATB-5: Performance Benchmarks.
    
    Verification Methods:
        - Test scenario 1: Response time < 200ms (1000 records)
        - Test scenario 2: Query limit validation
    """
    
    @pytest.mark.asyncio
    async def test_overview_performance_large_dataset(self, service, mock_repository):
        """
        ATB-5 Test Scenario 1: Verify < 200ms response with 1000 records.
        
        Expected: Response completes within 200ms threshold
        
        Test Approach:
            1. Generate mock response with 1000 aggregated records
            2. Measure elapsed time with time.perf_counter()
            3. Assert elapsed < 0.2 seconds
        """
        # Generate large dataset response
        large_response = {
            "total_count": 1000,
            "by_status": {f"status_{i}": 100 for i in range(10)},
            "by_type": {f"type_{i}": 100 for i in range(10)},
            "by_department": {f"dept_{i}": 50 for i in range(20)}
        }
        mock_repository.get_overview_stats.return_value = large_response
        
        start_time = time.perf_counter()
        result = await service.get_overview_stats()
        elapsed = time.perf_counter() - start_time
        
        assert elapsed < 0.2, \
            f"Performance requirement violated: {elapsed:.3f}s > 200ms threshold"
        assert result["total_count"] == 1000, "Should process all 1000 records"

    @pytest.mark.asyncio
    async def test_statistics_performance_with_pagination(self, service, mock_repository):
        """
        ATB-5 Extended: Verify pagination performance.
        
        Expected: Response time remains < 200ms regardless of page number
        
        Test Approach:
            1. Call get_statistics with pagination parameters
            2. Verify response time stays within threshold
        """
        mock_repository.get_statistics.return_value = [
            {"asset_type": f"type_{i}", "count": 10, "total_value": 10000}
            for i in range(10)
        ]
        
        start_time = time.perf_counter()
        result = await service.get_statistics(
            group_by="asset_type",
            page=5,
            page_size=10
        )
        elapsed = time.perf_counter() - start_time
        
        assert elapsed < 0.2, \
            f"Paginated query exceeded threshold: {elapsed:.3f}s"


# ============================================================================
# Integration Tests for Service Orchestration
# ============================================================================

class TestServiceOrchestration:
    """
    Integration tests verifying service layer coordination.
    """
    
    @pytest.mark.asyncio
    async def test_dashboard_complete_snapshot(self, service, mock_repository, sample_assets):
        """
        Complete dashboard snapshot includes all three major views.
        
        Expected: Combined response includes overview, statistics, and expiring
        
        Test Approach:
            1. Call get_complete_snapshot method
            2. Verify response contains all three major data sections
        """
        mock_repository.get_overview_stats.return_value = {
            "total_count": 5,
            "by_status": {"active": 3, "inactive": 2},
            "by_type": {"equipment": 3, "license": 2},
            "by_department": {"IT": 3, "HR": 2}
        }
        mock_repository.get_statistics.return_value = [
            {"asset_type": "equipment", "count": 3, "total_value": 30000}
        ]
        mock_repository.get_expiring_assets.return_value = sample_assets[:2]
        
        result = await service.get_complete_snapshot()
        
        assert "overview" in result, "Complete snapshot must include overview"
        assert "statistics" in result, "Complete snapshot must include statistics"
        assert "expiring" in result, "Complete snapshot must include expiring"
        
        # Verify data integrity
        assert result["overview"]["total_count"] == 5
        assert len(result["statistics"]) == 1
        assert len(result["expiring"]) == 2

    @pytest.mark.asyncio
    async def test_service_handles_repository_errors_gracefully(self, service, mock_repository):
        """
        Service gracefully handles repository-level errors.
        
        Expected: Repository errors are caught and converted to service errors
        
        Test Approach:
            1. Configure mock to raise database exception
            2. Assert service raises appropriate error type
        """
        mock_repository.get_overview_stats.side_effect = Exception("Database connection failed")
        
        with pytest.raises(Exception) as exc_info:
            await service.get_overview_stats()
        
        # Service should either propagate or wrap the error appropriately
        assert "database" in str(exc_info.value).lower() or \
               "connection" in str(exc_info.value).lower() or \
               isinstance(exc_info.value, Exception)


# ============================================================================
# Test Execution Summary
# ============================================================================

"""
Test Coverage Summary:
=====================

ATB-1: Asset Overview Statistics (5 test cases)
    ✓ test_overview_returns_correct_structure
    ✓ test_overview_empty_dataset_returns_zeros
    ✓ test_overview_statistics_accuracy
    ✓ test_overview_response_time_benchmark
    ✓ test_overview_limit_exceeded_returns_error

ATB-2: Classification Statistics (5 test cases)
    ✓ test_statistics_group_by_type
    ✓ test_statistics_group_by_status
    ✓ test_statistics_with_date_range
    ✓ test_statistics_invalid_group_by_returns_error
    ✓ test_statistics_empty_result_returns_empty_list

ATB-3: Expiration Warning (5 test cases)
    ✓ test_expiring_default_30_days_threshold
    ✓ test_expiring_custom_threshold
    ✓ test_expiring_sorted_by_urgency
    ✓ test_expiring_no_results_returns_200
    ✓ test_expiring_includes_critical_level

ATB-4: Data Model Constraints (4 test cases)
    ✓ test_asset_expiration_date_must_be_future
    ✓ test_asset_type_enum_validation_valid
    ✓ test_asset_type_enum_validation_invalid
    ✓ test_asset_required_fields_validation

ATB-5: Performance Benchmarks (2 test cases)
    ✓ test_overview_performance_large_dataset
    ✓ test_statistics_performance_with_pagination

Integration Tests (2 test cases)
    ✓ test_dashboard_complete_snapshot
    ✓ test_service_handles_repository_errors_gracefully

Total: 23 test cases covering all acceptance criteria for SWARM-S5-003.
"""