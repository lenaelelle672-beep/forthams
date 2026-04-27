"""
Integration tests for Depreciation Report API endpoints.

Tests cover:
- GET /api/v1/assets/{asset_id}/depreciation-detail: Asset depreciation detail query
- GET /api/v1/depreciation/report: Aggregate depreciation report
- GET /api/v1/depreciation/report/export: CSV/Excel export functionality
- POST /api/v1/depreciation/accrue: Manual depreciation accrual trigger
"""

import pytest
from datetime import date, datetime
from decimal import Decimal
from unittest.mock import patch, MagicMock
import io
import csv

from fastapi.testclient import TestClient


# =============================================================================
# Fixtures
# =============================================================================

@pytest.fixture
def mock_depreciation_records():
    """Mock depreciation records for testing."""
    return [
        {
            "id": "dep-001",
            "asset_id": "asset-001",
            "period": "2026-01",
            "monthly_depreciation": Decimal("1583.33"),
            "accumulated_depreciation": Decimal("1583.33"),
            "book_value": Decimal("98416.67"),
            "depreciation_method": "straight_line",
            "created_at": datetime(2026, 1, 31, 0, 0, 0),
        },
        {
            "id": "dep-002",
            "asset_id": "asset-001",
            "period": "2026-02",
            "monthly_depreciation": Decimal("1583.33"),
            "accumulated_depreciation": Decimal("3166.66"),
            "book_value": Decimal("96833.34"),
            "depreciation_method": "straight_line",
            "created_at": datetime(2026, 2, 28, 0, 0, 0),
        },
        {
            "id": "dep-003",
            "asset_id": "asset-001",
            "period": "2026-03",
            "monthly_depreciation": Decimal("1583.33"),
            "accumulated_depreciation": Decimal("4749.99"),
            "book_value": Decimal("95250.01"),
            "depreciation_method": "straight_line",
            "created_at": datetime(2026, 3, 31, 0, 0, 0),
        },
    ]


@pytest.fixture
def mock_depreciation_summary():
    """Mock depreciation summary for aggregate report."""
    return {
        "period": "2026-02",
        "total_assets": 150,
        "total_monthly_depreciation": Decimal("237499.50"),
        "total_accumulated_depreciation": Decimal("4750000.00"),
        "total_book_value": Decimal("15250000.00"),
        "method_breakdown": {
            "straight_line": {"count": 120, "amount": Decimal("190000.00")},
            "double_declining": {"count": 30, "amount": Decimal("47499.50")},
        },
    }


# =============================================================================
# Test Cases: ATB-007 - Depreciation Detail by Asset ID
# =============================================================================

class TestDepreciationDetailReport:
    """ATB-007: Test GET /api/v1/assets/{asset_id}/depreciation-detail endpoint."""

    def test_report_by_asset_id_returns_period_range(
        self, mock_depreciation_records, monkeypatch
    ):
        """
        ATB-007: Verify endpoint returns depreciation records for specified period range.
        
        Test: GET /api/v1/assets/asset-001/depreciation-detail?start_date=2026-01&end_date=2026-03
        Expected: Returns 3 monthly depreciation records (2026-01, 2026-02, 2026-03)
        """
        from src.swarm_003.depreciation.domain.entities import DepreciationRecord
        from src.swarm_003.depreciation.domain.schemas import DepreciationDetailResponse

        # Mock the repository to return test data
        mock_repo = MagicMock()
        mock_records = [
            DepreciationRecord(**record) for record in mock_depreciation_records
        ]
        mock_repo.get_by_asset_and_period.return_value = mock_records

        # Patch the repository dependency
        monkeypatch.setattr(
            "src.swarm_003.depreciation.api.routes.get_depreciation_repository",
            lambda: mock_repo,
        )

        # Import and call the endpoint handler directly
        from src.swarm_003.depreciation.api.routes import get_asset_depreciation_detail

        result = get_asset_depreciation_detail(
            asset_id="asset-001",
            start_date=date(2026, 1, 1),
            end_date=date(2026, 3, 31),
        )

        assert isinstance(result, DepreciationDetailResponse)
        assert result.asset_id == "asset-001"
        assert len(result.records) == 3
        assert result.records[0].period == "2026-01"
        assert result.records[1].period == "2026-02"
        assert result.records[2].period == "2026-03"

    def test_report_by_asset_id_field_completeness(
        self, mock_depreciation_records, monkeypatch
    ):
        """
        ATB-007: Verify response contains all required fields.
        
        Required fields: asset_id, period, monthly_depreciation, accumulated, book_value
        """
        from src.swarm_003.depreciation.domain.entities import DepreciationRecord
        from src.swarm_003.depreciation.domain.schemas import DepreciationDetailResponse

        mock_repo = MagicMock()
        mock_records = [
            DepreciationRecord(**record) for record in [mock_depreciation_records[0]]
        ]
        mock_repo.get_by_asset_and_period.return_value = mock_records

        monkeypatch.setattr(
            "src.swarm_003.depreciation.api.routes.get_depreciation_repository",
            lambda: mock_repo,
        )

        from src.swarm_003.depreciation.api.routes import get_asset_depreciation_detail

        result = get_asset_depreciation_detail(
            asset_id="asset-001",
            start_date=date(2026, 1, 1),
            end_date=date(2026, 1, 31),
        )

        record = result.records[0]
        assert hasattr(record, "asset_id")
        assert hasattr(record, "period")
        assert hasattr(record, "monthly_depreciation")
        assert hasattr(record, "accumulated_depreciation")
        assert hasattr(record, "book_value")
        assert hasattr(record, "depreciation_method")

    def test_report_by_asset_id_empty_result(self, monkeypatch):
        """
        ATB-007: Verify endpoint handles empty results gracefully.
        """
        from src.swarm_003.depreciation.domain.schemas import DepreciationDetailResponse

        mock_repo = MagicMock()
        mock_repo.get_by_asset_and_period.return_value = []

        monkeypatch.setattr(
            "src.swarm_003.depreciation.api.routes.get_depreciation_repository",
            lambda: mock_repo,
        )

        from src.swarm_003.depreciation.api.routes import get_asset_depreciation_detail

        result = get_asset_depreciation_detail(
            asset_id="non-existent-asset",
            start_date=date(2026, 1, 1),
            end_date=date(2026, 3, 31),
        )

        assert isinstance(result, DepreciationDetailResponse)
        assert result.asset_id == "non-existent-asset"
        assert len(result.records) == 0


# =============================================================================
# Test Cases: ATB-008 - Aggregate Depreciation Report
# =============================================================================

class TestAggregateDepreciationReport:
    """ATB-008: Test GET /api/v1/depreciation/report endpoint."""

    def test_report_aggregate_returns_period_summary(
        self, mock_depreciation_summary, monkeypatch
    ):
        """
        ATB-008: Verify aggregate report returns correct period summary.
        
        Test: GET /api/v1/depreciation/report?period=2026-02
        Expected: Returns total assets, total monthly depreciation, method breakdown
        """
        from src.swarm_003.depreciation.domain.schemas import DepreciationReportResponse

        mock_repo = MagicMock()
        mock_repo.get_period_summary.return_value = mock_depreciation_summary

        monkeypatch.setattr(
            "src.swarm_003.depreciation.api.routes.get_depreciation_repository",
            lambda: mock_repo,
        )

        from src.swarm_003.depreciation.api.routes import get_depreciation_report

        result = get_depreciation_report(period="2026-02")

        assert isinstance(result, DepreciationReportResponse)
        assert result.period == "2026-02"
        assert result.total_assets == 150
        assert result.total_monthly_depreciation == Decimal("237499.50")

    def test_report_aggregate_method_breakdown(
        self, mock_depreciation_summary, monkeypatch
    ):
        """
        ATB-008: Verify aggregate report includes method breakdown.
        """
        from src.swarm_003.depreciation.domain.schemas import DepreciationReportResponse

        mock_repo = MagicMock()
        mock_repo.get_period_summary.return_value = mock_depreciation_summary

        monkeypatch.setattr(
            "src.swarm_003.depreciation.api.routes.get_depreciation_repository",
            lambda: mock_repo,
        )

        from src.swarm_003.depreciation.api.routes import get_depreciation_report

        result = get_depreciation_report(period="2026-02")

        assert "straight_line" in result.method_breakdown
        assert "double_declining" in result.method_breakdown
        assert result.method_breakdown["straight_line"]["count"] == 120
        assert result.method_breakdown["double_declining"]["count"] == 30


# =============================================================================
# Test Cases: ATB-009 - Report Export CSV
# =============================================================================

class TestDepreciationReportExport:
    """ATB-009: Test GET /api/v1/depreciation/report/export endpoint."""

    def test_report_export_csv_content_type(self, mock_depreciation_records, monkeypatch):
        """
        ATB-009: Verify CSV export returns correct Content-Type and Content-Disposition.
        
        Expected: Content-Type: text/csv, Content-Disposition: attachment; filename=depreciation_2026-02.csv
        """
        from src.swarm_003.depreciation.domain.entities import DepreciationRecord
        from src.swarm_003.depreciation.domain.schemas import ExportFormat

        mock_repo = MagicMock()
        mock_records = [
            DepreciationRecord(**record) for record in mock_depreciation_records
        ]
        mock_repo.get_by_period.return_value = mock_records

        monkeypatch.setattr(
            "src.swarm_003.depreciation.api.routes.get_depreciation_repository",
            lambda: mock_repo,
        )

        from src.swarm_003.depreciation.api.routes import export_depreciation_report

        result = export_depreciation_report(period="2026-02", format=ExportFormat.CSV)

        # Verify response structure
        assert result.media_type == "text/csv"
        assert "depreciation_2026-02.csv" in result.headers["content-disposition"]

    def test_report_export_csv_content_structure(
        self, mock_depreciation_records, monkeypatch
    ):
        """
        ATB-009: Verify CSV export contains correct data structure and headers.
        """
        from src.swarm_003.depreciation.domain.entities import DepreciationRecord
        from src.swarm_003.depreciation.domain.schemas import ExportFormat

        mock_repo = MagicMock()
        mock_records = [
            DepreciationRecord(**record) for record in mock_depreciation_records
        ]
        mock_repo.get_by_period.return_value = mock_records

        monkeypatch.setattr(
            "src.swarm_003.depreciation.api.routes.get_depreciation_repository",
            lambda: mock_repo,
        )

        from src.swarm_003.depreciation.api.routes import export_depreciation_report

        result = export_depreciation_report(period="2026-02", format=ExportFormat.CSV)

        # Parse CSV content
        csv_content = result.body.decode("utf-8")
        reader = csv.DictReader(io.StringIO(csv_content))
        rows = list(reader)

        # Verify header
        expected_headers = [
            "asset_id",
            "period",
            "monthly_depreciation",
            "accumulated_depreciation",
            "book_value",
            "depreciation_method",
        ]
        assert reader.fieldnames == expected_headers

        # Verify data rows
        assert len(rows) == 3
        assert rows[0]["period"] == "2026-01"
        assert rows[1]["period"] == "2026-02"
        assert rows[2]["period"] == "2026-03"

    def test_report_export_excel_format(self, mock_depreciation_records, monkeypatch):
        """
        ATB-009: Verify Excel export returns correct content type.
        """
        from src.swarm_003.depreciation.domain.entities import DepreciationRecord
        from src.swarm_003.depreciation.domain.schemas import ExportFormat

        mock_repo = MagicMock()
        mock_records = [
            DepreciationRecord(**record) for record in mock_depreciation_records
        ]
        mock_repo.get_by_period.return_value = mock_records

        monkeypatch.setattr(
            "src.swarm_003.depreciation.api.routes.get_depreciation_repository",
            lambda: mock_repo,
        )

        from src.swarm_003.depreciation.api.routes import export_depreciation_report

        result = export_depreciation_report(period="2026-02", format=ExportFormat.EXCEL)

        assert result.media_type == "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        assert "depreciation_2026-02.xlsx" in result.headers["content-disposition"]


# =============================================================================
# Test Cases: ATB-010 - Report Period Limit
# =============================================================================

class TestDepreciationReportPeriodLimit:
    """ATB-010: Test period range validation."""

    def test_report_period_limit_exceeded(self):
        """
        ATB-010: Verify HTTP 400 response when period range exceeds 36 months.
        
        Test: GET /api/v1/depreciation/report?start_date=2024-01&end_date=2027-06
        Expected: HTTP 400, error_code="PERIOD_EXCEEDS_LIMIT"
        """
        from src.swarm_003.depreciation.domain.schemas import PeriodRangeError

        # Calculate months between 2024-01 and 2027-06 = 41 months, exceeds 36
        start = date(2024, 1, 1)
        end = date(2027, 6, 30)

        with pytest.raises(PeriodRangeError) as exc_info:
            from src.swarm_003.depreciation.api.routes import validate_period_range
            validate_period_range(start, end)

        assert exc_info.value.error_code == "PERIOD_EXCEEDS_LIMIT"
        assert "36 months" in str(exc_info.value.detail)

    def test_report_period_within_limit(self):
        """
        ATB-010: Verify no error when period range is within 36 months.
        """
        from src.swarm_003.depreciation.api.routes import validate_period_range

        start = date(2026, 1, 1)
        end = date(2026, 12, 31)  # 12 months, within limit

        # Should not raise exception
        validate_period_range(start, end)

    def test_report_period_exact_limit(self):
        """
        ATB-010: Verify 36 months is acceptable (boundary test).
        """
        from src.swarm_003.depreciation.api.routes import validate_period_range

        start = date(2024, 1, 1)
        end = date(2026, 12, 31)  # Exactly 36 months

        # Should not raise exception
        validate_period_range(start, end)