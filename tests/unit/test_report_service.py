"""
ATB-3.1 & ATB-3.2: Test ReportService for depreciation report generation.

This module tests the ReportService class which handles aggregation of depreciation
data for monthly reporting and filtering of asset statuses.

Test Strategy:
- Mock the repository layer to return test data
- Validate report aggregation logic
- Verify asset status filtering
"""

import pytest
from datetime import datetime
from decimal import Decimal
from unittest.mock import Mock, patch


class TestDepreciationReportService:
    """
    ATB-ID: ATB-3.1
    Verification Target: Depreciation monthly report data aggregation correctness
    
    Physical Test Expectation:
    - Prepare: 3 asset records with different depreciation methods
    - Execute: generate_monthly_report(period='2026-04')
    - Verify:
      1. Return record count = 3
      2. Each record contains fields: asset_id, method, original_value,
         monthly_depreciation, accumulated_depreciation, net_book_value
      3. Straight-line method verification: monthly depreciation = (original - residual) / usage months
      4. Double declining balance method verification: monthly depreciation = beginning net value × (2 / expected years / 12)
    """

    @pytest.fixture
    def mock_repository(self):
        """Create a mock repository for asset data."""
        return Mock()

    @pytest.fixture
    def report_service(self, mock_repository):
        """Create a ReportService instance with mocked dependencies."""
        from app.services.report_service import ReportService
        return ReportService(asset_repository=mock_repository)

    @pytest.fixture
    def sample_assets(self):
        """Create sample asset data for testing."""
        return [
            {
                "asset_id": "AST-2026-001",
                "asset_name": "服务器设备 A",
                "original_value": Decimal("100000.00"),
                "residual_value": Decimal("5000.00"),
                "useful_life_months": 60,
                "method": "STRAIGHT_LINE",
                "status": "active",
                "purchase_date": datetime(2024, 1, 1),
                "accumulated_depreciation": Decimal("9500.00"),
            },
            {
                "asset_id": "AST-2026-002",
                "asset_name": "办公设备 B",
                "original_value": Decimal("50000.00"),
                "residual_value": Decimal("2500.00"),
                "useful_life_months": 60,
                "method": "DOUBLE_DECLINING",
                "status": "active",
                "purchase_date": datetime(2024, 1, 1),
                "accumulated_depreciation": Decimal("8333.33"),
            },
            {
                "asset_id": "AST-2026-003",
                "asset_name": "生产设备 C",
                "original_value": Decimal("200000.00"),
                "residual_value": Decimal("10000.00"),
                "useful_life_months": 120,
                "method": "STRAIGHT_LINE",
                "status": "active",
                "purchase_date": datetime(2025, 1, 1),
                "accumulated_depreciation": Decimal("15833.33"),
            },
        ]

    def test_generate_monthly_report_aggregates_correctly(self, report_service, mock_repository, sample_assets):
        """
        Test that monthly report correctly aggregates data from multiple assets.
        
        Validates:
        - Correct record count
        - Required fields present in each record
        - Straight-line calculation: (original - residual) / useful_life_months
        - Double declining calculation: beginning_net_value × (2 / useful_years / 12)
        """
        # Arrange: Mock repository returns sample assets
        mock_repository.get_active_assets.return_value = sample_assets
        mock_repository.get_depreciation_records.return_value = []
        
        # Act: Generate monthly report for period 2026-04
        result = report_service.generate_monthly_report(period="2026-04")
        
        # Assert 1: Return record count = 3
        assert len(result["items"]) == 3, f"Expected 3 records, got {len(result['items'])}"
        
        # Assert 2: Each record contains required fields
        required_fields = [
            "asset_id", "method", "original_value",
            "monthly_depreciation", "accumulated_depreciation", "net_book_value"
        ]
        for item in result["items"]:
            for field in required_fields:
                assert field in item, f"Missing required field: {field}"
        
        # Assert 3: Straight-line method calculation verification
        # For AST-2026-001: (100000 - 5000) / 60 = 1583.33
        straight_line_asset = next(
            item for item in result["items"] if item["asset_id"] == "AST-2026-001"
        )
        expected_straight_line = (Decimal("100000.00") - Decimal("5000.00")) / 60
        assert abs(straight_line_asset["monthly_depreciation"] - expected_straight_line) < Decimal("0.01"), \
            f"Straight-line calculation incorrect: expected {expected_straight_line}"
        
        # Assert 4: Double declining balance method verification
        # For AST-2026-002: beginning_net_value × (2 / 5 years / 12) = 4166.67
        double_declining_asset = next(
            item for item in result["items"] if item["asset_id"] == "AST-2026-002"
        )
        beginning_net_value = Decimal("50000.00") - Decimal("8333.33")
        expected_ddb = beginning_net_value * (Decimal("2") / Decimal("5") / Decimal("12"))
        assert abs(double_declining_asset["monthly_depreciation"] - expected_ddb) < Decimal("0.01"), \
            f"Double declining calculation incorrect: expected {expected_ddb}"

    def test_report_excludes_scrapped_assets(self, report_service, mock_repository):
        """
        ATB-ID: ATB-3.2
        Physical Test Expectation:
        - Prepare: 5 assets, 2 of which are in 'scrapped' status
        - Execute: generate_monthly_report()
        - Verify: Return record count = 3
        """
        # Arrange: Create 5 assets, 2 with 'scrapped' status
        mixed_status_assets = [
            {"asset_id": "AST-001", "status": "active", "method": "STRAIGHT_LINE",
             "original_value": Decimal("10000.00"), "residual_value": Decimal("500.00"),
             "useful_life_months": 60, "accumulated_depreciation": Decimal("0.00")},
            {"asset_id": "AST-002", "status": "active", "method": "STRAIGHT_LINE",
             "original_value": Decimal("20000.00"), "residual_value": Decimal("1000.00"),
             "useful_life_months": 60, "accumulated_depreciation": Decimal("0.00")},
            {"asset_id": "AST-003", "status": "scrapped", "method": "STRAIGHT_LINE",
             "original_value": Decimal("15000.00"), "residual_value": Decimal("750.00"),
             "useful_life_months": 60, "accumulated_depreciation": Decimal("0.00")},
            {"asset_id": "AST-004", "status": "active", "method": "DOUBLE_DECLINING",
             "original_value": Decimal("30000.00"), "residual_value": Decimal("1500.00"),
             "useful_life_months": 60, "accumulated_depreciation": Decimal("0.00")},
            {"asset_id": "AST-005", "status": "scrapped", "method": "STRAIGHT_LINE",
             "original_value": Decimal("25000.00"), "residual_value": Decimal("1250.00"),
             "useful_life_months": 60, "accumulated_depreciation": Decimal("0.00")},
        ]
        
        mock_repository.get_active_assets.return_value = mixed_status_assets
        mock_repository.get_depreciation_records.return_value = []
        
        # Act: Generate report without specifying period (uses current period)
        result = report_service.generate_monthly_report()
        
        # Assert: Return record count = 3 (only active assets)
        assert len(result["items"]) == 3, \
            f"Expected 3 records (excluding 2 scrapped), got {len(result['items'])}"
        
        # Verify no scrapped assets in results
        asset_ids = [item["asset_id"] for item in result["items"]]
        assert "AST-003" not in asset_ids, "Scrapped asset AST-003 should be excluded"
        assert "AST-005" not in asset_ids, "Scrapped asset AST-005 should be excluded"
        
        # Verify all returned assets are active
        for item in result["items"]:
            assert item["asset_id"] in ["AST-001", "AST-002", "AST-004"], \
                f"Unexpected asset found: {item['asset_id']}"