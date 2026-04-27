"""
Integration tests for Depreciation API endpoints.

Test Coverage:
- ATB-007: Get depreciation detail by asset ID
- ATB-008: Aggregate depreciation report
- ATB-009: Depreciation report CSV export
- ATB-010: Report period limit validation
"""

import pytest
import pytest_asyncio
from datetime import datetime, date
from decimal import Decimal
from typing import AsyncGenerator
import io
import csv

from httpx import AsyncClient, ASGITransport
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
from sqlalchemy.orm import declarative_base

# Import application components
from src.swarm_003.depreciation.domain.entities import (
    AssetDepreciation,
    DepreciationRecord,
)
from src.swarm_003.depreciation.domain.schemas import (
    DepreciationMethod,
    DepreciationDetailResponse,
    DepreciationReportResponse,
)
from src.swarm_003.depreciation.api.routes import router as depreciation_router


# ============================================================================
# Test Fixtures
# ============================================================================

Base = declarative_base()


@pytest_asyncio.fixture
async def db_session() -> AsyncGenerator[AsyncSession, None]:
    """Create an in-memory SQLite database session for testing."""
    engine = create_async_engine(
        "sqlite+aiosqlite:///:memory:",
        echo=False,
    )
    
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    
    async_session_maker = async_sessionmaker(
        engine, 
        class_=AsyncSession, 
        expire_on_commit=False
    )
    
    async with async_session_maker() as session:
        yield session
        await session.rollback()
    
    await engine.dispose()


@pytest_asyncio.fixture
async def client(db_session: AsyncSession) -> AsyncGenerator[AsyncClient, None]:
    """Create an async HTTP client for API testing."""
    # Import app module to ensure routes are registered
    from src.main import app
    
    async def override_get_db():
        yield db_session
    
    app.dependency_overrides[get_db_session] = override_get_db
    
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac
    
    app.dependency_overrides.clear()


@pytest.fixture
def sample_asset_id() -> str:
    """Return a sample asset UUID for testing."""
    return "550e8400-e29b-41d4-a716-446655440000"


@pytest.fixture
def sample_depreciation_params() -> dict:
    """Return sample depreciation calculation parameters."""
    return {
        "acquisition_cost": Decimal("100000.00"),
        "useful_life_months": 60,
        "salvage_value": Decimal("5000.00"),
        "depreciation_method": DepreciationMethod.STRAIGHT_LINE,
    }


@pytest_asyncio.fixture
async def populated_db(
    db_session: AsyncSession,
    sample_asset_id: str,
    sample_depreciation_params: dict,
) -> AsyncSession:
    """Populate database with sample depreciation records."""
    from src.swarm_003.depreciation.repositories import (
        DepreciationRepository,
    )
    
    # Create depreciation records for Jan-Mar 2026
    test_records = []
    accumulated = Decimal("0.00")
    
    for month_offset in range(3):
        year = 2026
        month = 1 + month_offset
        
        monthly_amount = (
            sample_depreciation_params["acquisition_cost"] 
            - sample_depreciation_params["salvage_value"]
        ) / sample_depreciation_params["useful_life_months"]
        
        accumulated += monthly_amount
        
        record = DepreciationRecord(
            id=f"rec-{month_offset}",
            asset_id=sample_asset_id,
            period=f"{year}-{month:02d}",
            monthly_depreciation=monthly_amount,
            accumulated_depreciation=accumulated,
            book_value=sample_depreciation_params["acquisition_cost"] - accumulated,
            depreciation_method=sample_depreciation_params["depreciation_method"],
        )
        test_records.append(record)
    
    repo = DepreciationRepository(db_session)
    for record in test_records:
        await repo.create(record)
    
    await db_session.commit()
    return db_session


# ============================================================================
# ATB-007: Get Depreciation Detail by Asset ID
# ============================================================================

@pytest.mark.asyncio
class TestDepreciationDetailByAssetId:
    """Test cases for ATB-007: Get depreciation detail by asset ID."""
    
    async def test_report_by_asset_id_returns_correct_records(
        self,
        client: AsyncClient,
        populated_db: AsyncSession,
        sample_asset_id: str,
    ):
        """
        ATB-007: Verify GET /api/v1/assets/{asset_id}/depreciation-detail
        returns 3 monthly depreciation records for Jan-Mar 2026.
        
        Expected fields: asset_id, period, monthly_depreciation, 
                        accumulated_depreciation, book_value
        """
        response = await client.get(
            f"/api/v1/assets/{sample_asset_id}/depreciation-detail",
            params={
                "start_date": "2026-01",
                "end_date": "2026-03",
            },
        )
        
        assert response.status_code == 200
        data = response.json()
        
        # Verify response structure
        assert "records" in data
        assert len(data["records"]) == 3
        
        # Verify each record has required fields
        required_fields = [
            "asset_id",
            "period",
            "monthly_depreciation",
            "accumulated_depreciation",
            "book_value",
        ]
        
        for record in data["records"]:
            for field in required_fields:
                assert field in record, f"Missing field: {field}"
        
        # Verify periods are in correct order
        periods = [r["period"] for r in data["records"]]
        assert periods == ["2026-01", "2026-02", "2026-03"]
        
        # Verify accumulated depreciation increases
        accumulated_values = [Decimal(r["accumulated_depreciation"]) for r in data["records"]]
        assert accumulated_values == sorted(accumulated_values)
        
        # Verify book value decreases
        book_values = [Decimal(r["book_value"]) for r in data["records"]]
        assert book_values == sorted(book_values, reverse=True)
    
    async def test_report_by_asset_id_field_completeness(
        self,
        client: AsyncClient,
        populated_db: AsyncSession,
        sample_asset_id: str,
    ):
        """Verify all required fields are present in response."""
        response = await client.get(
            f"/api/v1/assets/{sample_asset_id}/depreciation-detail",
            params={
                "start_date": "2026-01",
                "end_date": "2026-01",
            },
        )
        
        assert response.status_code == 200
        data = response.json()
        
        record = data["records"][0]
        
        # Verify asset_id matches request
        assert record["asset_id"] == sample_asset_id
        
        # Verify period format
        assert record["period"] == "2026-01"
        
        # Verify numeric fields are valid decimals
        assert Decimal(record["monthly_depreciation"]) >= Decimal("0")
        assert Decimal(record["accumulated_depreciation"]) >= Decimal("0")
        assert Decimal(record["book_value"]) >= Decimal("0")
    
    async def test_report_by_asset_id_not_found(
        self,
        client: AsyncClient,
        populated_db: AsyncSession,
    ):
        """Verify 404 response for non-existent asset."""
        non_existent_id = "00000000-0000-0000-0000-000000000000"
        
        response = await client.get(
            f"/api/v1/assets/{non_existent_id}/depreciation-detail",
            params={
                "start_date": "2026-01",
                "end_date": "2026-03",
            },
        )
        
        assert response.status_code == 404
        data = response.json()
        assert "error" in data


# ============================================================================
# ATB-008: Aggregate Depreciation Report
# ============================================================================

@pytest.mark.asyncio
class TestDepreciationAggregateReport:
    """Test cases for ATB-008: Aggregate depreciation report."""
    
    async def test_report_aggregate_returns_period_summary(
        self,
        client: AsyncClient,
        populated_db: AsyncSession,
        sample_asset_id: str,
        sample_depreciation_params: dict,
    ):
        """
        ATB-008: Verify GET /api/v1/depreciation/report returns 
        aggregated depreciation summary for specified period.
        
        Expected: total_depreciation_amount, asset_count
        """
        response = await client.get(
            "/api/v1/depreciation/report",
            params={"period": "2026-02"},
        )
        
        assert response.status_code == 200
        data = response.json()
        
        # Verify response structure
        assert "period" in data
        assert "total_depreciation" in data
        assert "asset_count" in data
        
        assert data["period"] == "2026-02"
        assert data["asset_count"] >= 1
        
        # Verify total is a valid decimal
        assert Decimal(data["total_depreciation"]) >= Decimal("0")
    
    async def test_report_aggregate_multiple_assets(
        self,
        client: AsyncClient,
        db_session: AsyncSession,
        sample_depreciation_params: dict,
    ):
        """Verify aggregation works with multiple assets."""
        from src.swarm_003.depreciation.repositories import DepreciationRepository
        
        # Add second asset
        second_asset_id = "550e8400-e29b-41d4-a716-446655440001"
        
        repo = DepreciationRepository(db_session)
        
        # Create records for both assets in Feb 2026
        for asset_id in [sample_asset_id_fixture := "550e8400-e29b-41d4-a716-446655440000", second_asset_id]:
            record = DepreciationRecord(
                id=f"rec-{asset_id[-4:]}-2026-02",
                asset_id=asset_id,
                period="2026-02",
                monthly_depreciation=Decimal("1500.00"),
                accumulated_depreciation=Decimal("3000.00"),
                book_value=Decimal("97000.00"),
                depreciation_method=DepreciationMethod.STRAIGHT_LINE,
            )
            await repo.create(record)
        
        await db_session.commit()
        
        response = await client.get(
            "/api/v1/depreciation/report",
            params={"period": "2026-02"},
        )
        
        assert response.status_code == 200
        data = response.json()
        
        # Should aggregate both assets
        assert data["asset_count"] >= 2


# ============================================================================
# ATB-009: Depreciation Report CSV Export
# ============================================================================

@pytest.mark.asyncio
class TestDepreciationReportExport:
    """Test cases for ATB-009: Depreciation report CSV export."""
    
    async def test_report_export_csv_content_type(
        self,
        client: AsyncClient,
        populated_db: AsyncSession,
        sample_asset_id: str,
    ):
        """
        ATB-009: Verify CSV export endpoint returns correct headers.
        
        Expected: Content-Type: text/csv
        Expected: Content-Disposition: attachment; filename=depreciation_YYYY-MM.csv
        """
        response = await client.get(
            "/api/v1/depreciation/report/export",
            params={
                "format": "csv",
                "period": "2026-02",
            },
        )
        
        assert response.status_code == 200
        assert response.headers["content-type"] == "text/csv"
        assert "attachment" in response.headers["content-disposition"]
        assert "depreciation_2026-02.csv" in response.headers["content-disposition"]
    
    async def test_report_export_csv_structure(
        self,
        client: AsyncClient,
        populated_db: AsyncSession,
        sample_asset_id: str,
    ):
        """Verify CSV file content has correct structure."""
        response = await client.get(
            "/api/v1/depreciation/report/export",
            params={
                "format": "csv",
                "period": "2026-02",
            },
        )
        
        assert response.status_code == 200
        
        # Parse CSV content
        content = response.text
        reader = csv.DictReader(io.StringIO(content))
        rows = list(reader)
        
        # Verify header row
        expected_headers = [
            "asset_id",
            "period",
            "monthly_depreciation",
            "accumulated_depreciation",
            "book_value",
            "depreciation_method",
        ]
        
        assert reader.fieldnames is not None
        for header in expected_headers:
            assert header in reader.fieldnames
        
        # Verify at least one data row
        assert len(rows) >= 1
    
    async def test_report_export_csv_data_correctness(
        self,
        client: AsyncClient,
        populated_db: AsyncSession,
        sample_asset_id: str,
    ):
        """Verify CSV data values are correct."""
        response = await client.get(
            "/api/v1/depreciation/report/export",
            params={
                "format": "csv",
                "period": "2026-02",
            },
        )
        
        assert response.status_code == 200
        
        content = response.text
        reader = csv.DictReader(io.StringIO(content))
        rows = list(reader)
        
        # Find the row for our sample asset
        matching_rows = [r for r in rows if r["asset_id"] == sample_asset_id]
        assert len(matching_rows) >= 1
        
        row = matching_rows[0]
        
        # Verify numeric parsing
        assert float(row["monthly_depreciation"]) >= 0
        assert float(row["accumulated_depreciation"]) >= 0
        assert float(row["book_value"]) >= 0


# ============================================================================
# ATB-010: Report Period Limit Validation
# ============================================================================

@pytest.mark.asyncio
class TestReportPeriodLimit:
    """Test cases for ATB-010: Report period limit validation."""
    
    async def test_report_period_limit_exceeded(
        self,
        client: AsyncClient,
        populated_db: AsyncSession,
    ):
        """
        ATB-010: Verify request exceeds 36-month limit returns HTTP 400.
        
        Request: start_date=2024-01, end_date=2027-06 (41 months)
        Expected: HTTP 400, error_code="PERIOD_EXCEEDS_LIMIT"
        """
        response = await client.get(
            "/api/v1/depreciation/report",
            params={
                "start_date": "2024-01",
                "end_date": "2027-06",
            },
        )
        
        assert response.status_code == 400
        data = response.json()
        
        assert data["error_code"] == "PERIOD_EXCEEDS_LIMIT"
        assert "36" in data.get("message", "")
    
    async def test_report_period_at_limit(
        self,
        client: AsyncClient,
        populated_db: AsyncSession,
    ):
        """Verify 36-month period is accepted."""
        response = await client.get(
            "/api/v1/depreciation/report",
            params={
                "start_date": "2026-01",
                "end_date": "2028-12",  # Exactly 36 months
            },
        )
        
        # Should succeed (or return empty results, not 400)
        assert response.status_code in [200, 204]
    
    async def test_report_period_exceeds_by_one_month(
        self,
        client: AsyncClient,
        populated_db: AsyncSession,
    ):
        """Verify 37-month period is rejected."""
        response = await client.get(
            "/api/v1/depreciation/report",
            params={
                "start_date": "2026-01",
                "end_date": "2029-01",  # 37 months
            },
        )
        
        assert response.status_code == 400
        data = response.json()
        assert data["error_code"] == "PERIOD_EXCEEDS_LIMIT"
    
    async def test_export_period_limit_exceeded(
        self,
        client: AsyncClient,
        populated_db: AsyncSession,
    ):
        """Verify CSV export also enforces period limit."""
        response = await client.get(
            "/api/v1/depreciation/report/export",
            params={
                "format": "csv",
                "start_date": "2024-01",
                "end_date": "2027-06",
            },
        )
        
        assert response.status_code == 400
        data = response.json()
        assert data["error_code"] == "PERIOD_EXCEEDS_LIMIT"


# ============================================================================
# Helper Functions
# ============================================================================

def get_db_session():
    """Dependency injection for database session."""
    from src.main import get_db_session
    return get_db_session()