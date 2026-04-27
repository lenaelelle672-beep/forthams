"""
Asset Statistics API Tests

This module contains unit tests for the asset statistics endpoints
as defined in SWARM-DASH-001 Iteration 1 specification.

Test coverage includes:
- ATB-001-01: Statistics by category
- ATB-001-02: Statistics by status
- ATB-001-03: Expiring assets list
- ATB-001-04: Combined conditions query
- ATB-001-05: Unauthorized access rejection
- ATB-001-06: Invalid parameters handling

Refer to: SPEC.md Section "验收测试基准 (ATB)"
"""

import pytest
from datetime import date, timedelta
from unittest.mock import Mock, patch
from uuid import uuid4

from fastapi.testclient import TestClient

from app.models.asset import Asset
from app.services.asset_statistics_service import AssetStatisticsService
from app.schemas.asset import AssetStatisticsResponse


class TestAssetStatisticsAPI:
    """
    Test suite for asset statistics API endpoints.
    
    Verifies GET /api/v1/assets/statistics endpoint behavior
    according to acceptance criteria.
    """

    @pytest.fixture
    def sample_assets(self, db_session):
        """
        Create sample test assets for statistics testing.
        
        Sets up a diverse set of assets across different categories
        and statuses with varying expiration dates.
        
        Returns:
            list[Asset]: List of 6 sample Asset instances
        """
        assets = [
            Asset(
                id=uuid4(),
                name="服务器-01",
                category="服务器",
                status="在用",
                purchase_date=date(2022, 1, 1),
                expire_date=date(2024, 12, 31)
            ),
            Asset(
                id=uuid4(),
                name="交换机-01",
                category="网络设备",
                status="在用",
                purchase_date=date(2023, 1, 1),
                expire_date=date(2025, 6, 30)
            ),
            Asset(
                id=uuid4(),
                name="存储阵列-01",
                category="存储设备",
                status="维修中",
                purchase_date=date(2021, 6, 15),
                expire_date=date(2024, 1, 15)
            ),
            Asset(
                id=uuid4(),
                name="许可证-Windows",
                category="软件许可",
                status="在用",
                purchase_date=date(2023, 3, 1),
                expire_date=date(2025, 3, 1)
            ),
            Asset(
                id=uuid4(),
                name="云服务器-测试",
                category="云资源",
                status="闲置",
                purchase_date=date(2023, 8, 1),
                expire_date=None
            ),
            Asset(
                id=uuid4(),
                name="路由器-核心",
                category="网络设备",
                status="已报废",
                purchase_date=date(2020, 1, 1),
                expire_date=date(2023, 1, 1)
            ),
        ]
        db_session.add_all(assets)
        db_session.commit()
        return assets

    @pytest.fixture
    def expiring_assets(self, db_session):
        """
        Create assets expiring within warning window.
        
        Sets up 3 assets that will expire within the next 30 days,
        used for testing expiration warning functionality.
        
        Returns:
            list[Asset]: List of 3 soon-to-expire Asset instances
        """
        today = date.today()
        assets = [
            Asset(
                id=uuid4(),
                name="许可证-数据库",
                category="软件许可",
                status="在用",
                purchase_date=today - timedelta(days=365),
                expire_date=today + timedelta(days=7)
            ),
            Asset(
                id=uuid4(),
                name="云服务-生产",
                category="云资源",
                status="在用",
                purchase_date=today - timedelta(days=180),
                expire_date=today + timedelta(days=14)
            ),
            Asset(
                id=uuid4(),
                name="许可证-开发工具",
                category="软件许可",
                status="在用",
                purchase_date=today - timedelta(days=400),
                expire_date=today + timedelta(days=21)
            ),
        ]
        db_session.add_all(assets)
        db_session.commit()
        return assets

    @pytest.fixture
    def authenticated_client(self, client: TestClient) -> TestClient:
        """
        Provide an authenticated test client.
        
        Sets up Bearer token authentication for API requests.
        
        Args:
            client: Base test client fixture
            
        Returns:
            TestClient: Client with valid authentication header
        """
        client.headers = {
            "Authorization": "Bearer test-token-12345"
        }
        return client

    @pytest.fixture
    def mock_statistics_service(self):
        """
        Mock the AssetStatisticsService for isolated testing.
        
        Returns:
            Mock: Mocked service instance
        """
        return Mock(spec=AssetStatisticsService)


class TestStatisticsByCategory:
    """
    ATB-001-01: Statistics by asset category
    
    Verify that the API returns correct asset counts grouped by category.
    """

    def test_statistics_by_category(
        self,
        authenticated_client: TestClient,
        sample_assets,
        db_session
    ):
        """
        Test GET /api/v1/assets/statistics returns category breakdown.
        
        Verifies:
        - Response status code 200
        - All 5 categories are represented
        - Asset counts match database records
        
        Expected categories: 服务器, 网络设备, 存储设备, 软件许可, 云资源
        """
        # Arrange: Expected category counts based on sample_assets
        expected_counts = {
            "服务器": 1,
            "网络设备": 2,
            "存储设备": 1,
            "软件许可": 2,
            "云资源": 1,
        }

        # Act: Make request to statistics endpoint
        response = authenticated_client.get("/api/v1/assets/statistics")

        # Assert: Status code
        assert response.status_code == 200

        # Assert: Response structure
        data = response.json()
        assert "categories" in data
        assert isinstance(data["categories"], list)

        # Assert: Category counts match
        category_dict = {item["category"]: item["count"] 
                        for item in data["categories"]}
        for category, count in expected_counts.items():
            assert category in category_dict, f"Missing category: {category}"
            assert category_dict[category] == count, \
                f"Expected {count} assets for {category}, got {category_dict[category]}"


class TestStatisticsByStatus:
    """
    ATB-001-02: Statistics by asset status
    
    Verify that the API returns correct asset distribution by status.
    """

    def test_statistics_by_status(
        self,
        authenticated_client: TestClient,
        sample_assets
    ):
        """
        Test GET /api/v1/assets/statistics returns status distribution.
        
        Verifies:
        - Response includes status breakdown
        - Status values are valid enum values
        - Counts are accurate
        
        Expected statuses: 在用, 闲置, 维修中, 已报废
        """
        response = authenticated_client.get("/api/v1/assets/statistics")

        assert response.status_code == 200
        data = response.json()

        # Verify status distribution exists
        assert "status_distribution" in data
        status_list = data["status_distribution"]

        # Verify all expected statuses present
        expected_statuses = {"在用", "闲置", "维修中", "已报废"}
        actual_statuses = {item["status"] for item in status_list}
        
        assert actual_statuses == expected_statuses, \
            f"Status mismatch. Expected: {expected_statuses}, Got: {actual_statuses}"

        # Verify count totals
        total_from_status = sum(item["count"] for item in status_list)
        total_from_categories = sum(
            item["count"] for item in data["categories"]
        )
        assert total_from_status == total_from_categories, \
            "Status counts must equal category counts"


class TestExpiringAssets:
    """
    ATB-001-03: Expiring assets list
    
    Verify retrieval of assets expiring within configured warning window.
    """

    def test_expiring_assets(
        self,
        authenticated_client: TestClient,
        expiring_assets
    ):
        """
        Test GET /api/v1/assets/statistics?type=expiring returns upcoming expirations.
        
        Verifies:
        - Returns assets expiring within 30 days (default window)
        - Sorted by expiration date ascending (earliest first)
        - Each item includes asset_id, name, expire_date, days_until_expiry
        
        ATB Reference: Section "验收测试基准 > 后端验收测试 > ATB-001-03"
        """
        response = authenticated_client.get(
            "/api/v1/assets/statistics",
            params={"type": "expiring"}
        )

        assert response.status_code == 200
        data = response.json()

        # Verify structure
        assert "expiring_assets" in data
        expiring_list = data["expiring_assets"]
        assert isinstance(expiring_list, list)
        assert len(expiring_list) == 3

        # Verify sorting (ascending by expiration date)
        expiry_dates = [item["expire_date"] for item in expiring_list]
        assert expiry_dates == sorted(expiry_dates), \
            "Expiring assets must be sorted by expiration date ascending"

        # Verify each item structure
        for item in expiring_list:
            assert "asset_id" in item
            assert "name" in item
            assert "expire_date" in item
            assert "days_until_expiry" in item
            assert isinstance(item["days_until_expiry"], int)
            assert 0 <= item["days_until_expiry"] <= 30

    def test_expiring_assets_custom_window(
        self,
        authenticated_client: TestClient,
        expiring_assets
    ):
        """
        Test custom expiration window parameter.
        
        Verifies that days parameter filters results correctly.
        """
        # Request 7-day window - should return only 1 asset
        response = authenticated_client.get(
            "/api/v1/assets/statistics",
            params={"type": "expiring", "days": 7}
        )

        assert response.status_code == 200
        data = response.json()
        
        expiring_list = data["expiring_assets"]
        # Only assets expiring within 7 days should be returned
        for item in expiring_list:
            assert item["days_until_expiry"] <= 7


class TestCombinedStatistics:
    """
    ATB-001-04: Combined condition query
    
    Verify that statistics can be filtered by multiple dimensions.
    """

    def test_combined_statistics(
        self,
        authenticated_client: TestClient,
        sample_assets
    ):
        """
        Test statistics with combined category and status filters.
        
        Verifies:
        - Supports filtering by category parameter
        - Supports filtering by status parameter
        - Combined filters work correctly
        - Invalid filter values return 400 error
        
        ATB Reference: Section "验收测试基准 > 后端验收测试 > ATB-001-04"
        """
        # Test: Filter by category only
        response = authenticated_client.get(
            "/api/v1/assets/statistics",
            params={"category": "服务器"}
        )
        assert response.status_code == 200
        data = response.json()
        assert data["filter_applied"] == {"category": "服务器"}

        # Test: Filter by status only
        response = authenticated_client.get(
            "/api/v1/assets/statistics",
            params={"status": "在用"}
        )
        assert response.status_code == 200
        data = response.json()
        assert data["filter_applied"] == {"status": "在用"}

        # Test: Combined filters
        response = authenticated_client.get(
            "/api/v1/assets/statistics",
            params={"category": "软件许可", "status": "在用"}
        )
        assert response.status_code == 200
        data = response.json()
        
        # Verify both filters applied
        filter_applied = data.get("filter_applied", {})
        assert filter_applied.get("category") == "软件许可"
        assert filter_applied.get("status") == "在用"


class TestUnauthorizedAccess:
    """
    ATB-001-05: Unauthorized access rejection
    
    Verify that unauthenticated requests are rejected with HTTP 401.
    """

    def test_unauthorized_access(self, client: TestClient):
        """
        Test that requests without authentication are rejected.
        
        Verifies:
        - Response status code 401 Unauthorized
        - Response follows RFC 7807 Problem Details format
        - Error message indicates authentication required
        
        ATB Reference: Section "验收测试基准 > 后端验收测试 > ATB-001-05"
        """
        # Make request without Authorization header
        response = client.get("/api/v1/assets/statistics")

        assert response.status_code == 401
        data = response.json()

        # Verify RFC 7807 format
        assert "type" in data
        assert "title" in data
        assert "status" in data
        assert data["status"] == 401

        # Verify authentication error message
        assert "认证" in data.get("title", "") or \
               "auth" in data.get("title", "").lower() or \
               "unauthorized" in data.get("title", "").lower()

    def test_invalid_token(self, client: TestClient):
        """
        Test that invalid bearer tokens are rejected.
        """
        client.headers = {"Authorization": "Bearer invalid-token-xyz"}
        response = client.get("/api/v1/assets/statistics")

        assert response.status_code == 401


class TestInvalidParameters:
    """
    ATB-001-06: Invalid parameters handling
    
    Verify that malformed requests return proper error responses.
    """

    def test_invalid_category_value(self, authenticated_client: TestClient):
        """
        Test that invalid category value returns HTTP 400.
        
        Verifies:
        - Response status code 400
        - Error message indicates parameter validation failure
        - Response follows RFC 7807 format
        
        ATB Reference: Section "验收测试基准 > 后端验收测试 > ATB-001-06"
        """
        response = authenticated_client.get(
            "/api/v1/assets/statistics",
            params={"category": "非法分类名称"}
        )

        assert response.status_code == 400
        data = response.json()

        # Verify RFC 7807 format
        assert data["status"] == 400
        assert "detail" in data

    def test_invalid_status_value(self, authenticated_client: TestClient):
        """
        Test that invalid status value returns HTTP 400.
        """
        response = authenticated_client.get(
            "/api/v1/assets/statistics",
            params={"status": "invalid_status"}
        )

        assert response.status_code == 400

    def test_negative_days_parameter(self, authenticated_client: TestClient):
        """
        Test that negative days parameter returns HTTP 400.
        """
        response = authenticated_client.get(
            "/api/v1/assets/statistics",
            params={"days": -5}
        )

        assert response.status_code == 400

    def test_non_integer_days_parameter(self, authenticated_client: TestClient):
        """
        Test that non-integer days parameter returns HTTP 400.
        """
        response = authenticated_client.get(
            "/api/v1/assets/statistics",
            params={"days": "thirty"}
        )

        assert response.status_code == 400

    def test_days_exceeds_maximum(self, authenticated_client: TestClient):
        """
        Test that days parameter exceeding maximum returns HTTP 400.
        
        Maximum allowed days is 365.
        """
        response = authenticated_client.get(
            "/api/v1/assets/statistics",
            params={"days": 400}
        )

        assert response.status_code == 400


class TestStatisticsServiceIntegration:
    """
    Integration tests for AssetStatisticsService.
    
    Verifies service layer behavior when called from API endpoints.
    """

    def test_service_returns_correct_statistics(
        self,
        db_session,
        sample_assets
    ):
        """
        Test that AssetStatisticsService returns accurate statistics.
        
        Verifies:
        - Category counts are accurate
        - Status distribution is correct
        - Empty results handled properly
        """
        service = AssetStatisticsService(db_session)

        # Test category statistics
        category_stats = service.get_category_statistics()
        assert len(category_stats) == 5
        
        # Verify counts
        category_counts = {s["category"]: s["count"] for s in category_stats}
        assert category_counts["服务器"] == 1
        assert category_counts["网络设备"] == 2

    def test_service_handles_empty_database(self, db_session):
        """
        Test that service handles empty database gracefully.
        """
        service = AssetStatisticsService(db_session)

        category_stats = service.get_category_statistics()
        assert category_stats == []

    def test_service_expiring_assets_sorted(
        self,
        db_session,
        expiring_assets
    ):
        """
        Test that expiring assets are returned sorted by date.
        """
        service = AssetStatisticsService(db_session)

        expiring = service.get_expiring_assets(days=30)
        
        # Verify sorting
        dates = [asset.expire_date for asset in expiring]
        assert dates == sorted(dates)


class TestResponseSchema:
    """
    Verify response schema conforms to API specification.
    """

    def test_response_contains_all_required_fields(
        self,
        authenticated_client: TestClient,
        sample_assets
    ):
        """
        Test that response includes all required fields.
        
        Required fields:
        - categories: list of category statistics
        - status_distribution: list of status counts
        - total_count: total number of assets
        - generated_at: timestamp of generation
        """
        response = authenticated_client.get("/api/v1/assets/statistics")

        assert response.status_code == 200
        data = response.json()

        # Required top-level fields
        assert "categories" in data
        assert "status_distribution" in data
        assert "total_count" in data
        assert "generated_at" in data

        # Verify types
        assert isinstance(data["total_count"], int)
        assert isinstance(data["generated_at"], str)

    def test_category_item_structure(
        self,
        authenticated_client: TestClient,
        sample_assets
    ):
        """
        Test that category items have correct structure.
        """
        response = authenticated_client.get("/api/v1/assets/statistics")

        data = response.json()
        categories = data["categories"]

        for item in categories:
            assert "category" in item
            assert "count" in item
            assert isinstance(item["category"], str)
            assert isinstance(item["count"], int)
            assert item["count"] >= 0