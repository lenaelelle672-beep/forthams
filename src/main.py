"""
Audit Log Dashboard — FastAPI Application Module.

This module implements the Phase 1 core data pipeline and basic dashboard
for the audit log system (SWARM-2025-Q2-P1-005). It provides:

- GET /api/v1/audit-logs         — Cursor-paginated log query with multi-dimensional filtering
- GET /api/v1/audit-logs/trend   — Daily aggregation trend data

Constraints enforced:
- Maximum query time span: 90 days
- Cursor-based pagination: default limit=50, max limit=200
- Structured log metadata only (no request/response payload details)
"""

from __future__ import annotations

import base64
import datetime
import os
from typing import Any, Dict, List, Optional

from fastapi import FastAPI, HTTPException, Query
from pydantic import BaseModel, Field, validator

# ---------------------------------------------------------------------------
# Database setup (SQLAlchemy async-compatible core)
# ---------------------------------------------------------------------------

from sqlalchemy import (
    Column,
    DateTime,
    Index,
    Integer,
    String,
    create_engine,
    func,
    select,
    text,
)
from sqlalchemy.dialects.postgresql import DATE_TRUNC
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker

DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql://postgres:postgres@localhost:5432/audit_db",
)

engine = create_engine(DATABASE_URL, pool_pre_ping=True)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()


# ---------------------------------------------------------------------------
# ORM Model — audit_logs table
# ---------------------------------------------------------------------------

class AuditLog(Base):
    """
    SQLAlchemy ORM model for the audit_logs table.

    Stores structured log metadata: timestamp, operation type, operator,
    source IP, and operation status.  A composite index on
    (created_at, op_type, operator_id) optimises range + filter queries.
    """

    __tablename__ = "audit_logs"

    id = Column(Integer, primary_key=True, autoincrement=True)
    created_at = Column(DateTime(timezone=True), nullable=False, index=True)
    op_type = Column(String(64), nullable=False)
    operator_id = Column(String(128), nullable=False)
    source_ip = Column(String(45), nullable=True)
    status = Column(String(32), nullable=True)

    __table_args__ = (
        Index(
            "ix_audit_logs_composite",
            "created_at",
            "op_type",
            "operator_id",
        ),
    )


# ---------------------------------------------------------------------------
# Pydantic schemas
# ---------------------------------------------------------------------------

class AuditLogItem(BaseModel):
    """Single audit log record returned by the API."""

    id: int
    created_at: datetime.datetime
    op_type: str
    operator_id: str
    source_ip: Optional[str] = None
    status: Optional[str] = None

    class Config:
        """Pydantic model configuration."""

        orm_mode = True


class AuditLogResponse(BaseModel):
    """Paginated response envelope for audit log queries."""

    items: List[AuditLogItem] = Field(default_factory=list)
    next_cursor: Optional[str] = None


class TrendItem(BaseModel):
    """Single day's aggregated count for the trend endpoint."""

    date: str
    count: int


class ErrorResponse(BaseModel):
    """Standard error envelope."""

    detail: str


# ---------------------------------------------------------------------------
# Cursor helpers
# ---------------------------------------------------------------------------

def encode_cursor(log_id: int) -> str:
    """
    Encode a log primary-key into an opaque cursor string.

    The cursor is a URL-safe base64 representation of the integer ID so
    that the pagination token is opaque to API consumers.

    Args:
        log_id: The primary key of the last returned record.

    Returns:
        A base64-encoded cursor string.
    """
    return base64.urlsafe_b64encode(str(log_id).encode()).decode()


def decode_cursor(cursor: str) -> int:
    """
    Decode an opaque cursor string back to the log primary-key.

    Args:
        cursor: The base64-encoded cursor string.

    Returns:
        The integer primary key encoded in the cursor.

    Raises:
        ValueError: If the cursor cannot be decoded.
    """
    try:
        return int(base64.urlsafe_b64decode(cursor.encode()).decode())
    except Exception as exc:
        raise ValueError(f"Invalid cursor: {cursor}") from exc


# ---------------------------------------------------------------------------
# Time-span validation
# ---------------------------------------------------------------------------

MAX_TIME_SPAN_DAYS = 90


def validate_time_span(
    start_time: Optional[datetime.datetime],
    end_time: Optional[datetime.datetime],
) -> None:
    """
    Validate that the requested time span does not exceed 90 days.

    If both *start_time* and *end_time* are provided and the difference
    exceeds ``MAX_TIME_SPAN_DAYS``, an ``HTTPException`` with status 400
    is raised.

    Args:
        start_time: Start of the query window (inclusive).
        end_time: End of the query window (inclusive).

    Raises:
        HTTPException: When the time span exceeds the 90-day limit.
    """
    if start_time is not None and end_time is not None:
        delta = end_time - start_time
        if delta.days > MAX_TIME_SPAN_DAYS:
            raise HTTPException(
                status_code=400,
                detail=(
                    f"Time span exceeds maximum of {MAX_TIME_SPAN_DAYS} days. "
                    f"Requested span is {delta.days} days."
                ),
            )


# ---------------------------------------------------------------------------
# FastAPI application
# ---------------------------------------------------------------------------

app = FastAPI(
    title="Audit Log Dashboard API",
    version="1.0.0",
    description="Phase 1 — Core data pipeline & basic dashboard for audit logs.",
)


# ---------------------------------------------------------------------------
# GET /api/v1/audit-logs
# ---------------------------------------------------------------------------

@app.get(
    "/api/v1/audit-logs",
    response_model=AuditLogResponse,
    responses={400: {"model": ErrorResponse}},
    summary="Query audit logs with cursor-based pagination",
)
def get_audit_logs(
    start_time: Optional[str] = Query(
        None,
        description="Start of time window (ISO 8601, inclusive)",
    ),
    end_time: Optional[str] = Query(
        None,
        description="End of time window (ISO 8601, inclusive)",
    ),
    op_type: Optional[str] = Query(
        None,
        description="Operation type filter (e.g. LOGIN, DELETE)",
    ),
    operator_id: Optional[str] = Query(
        None,
        description="Operator identifier filter",
    ),
    cursor: Optional[str] = Query(
        None,
        description="Opaque pagination cursor from previous response",
    ),
    limit: int = Query(
        50,
        ge=1,
        le=200,
        description="Number of records to return (1–200, default 50)",
    ),
) -> AuditLogResponse:
    """
    Retrieve audit log entries with multi-dimensional filtering and
    cursor-based pagination.

    Supported filters:
    - **start_time / end_time** — time range (max 90-day span)
    - **op_type** — exact match on operation type
    - **operator_id** — exact match on operator identifier

    Pagination uses an opaque cursor derived from the last record's
    primary key.  Pass the ``next_cursor`` value from a response as the
    ``cursor`` query parameter on the next request.

    Returns:
        An ``AuditLogResponse`` containing a list of log items and an
        optional ``next_cursor`` for fetching the subsequent page.
    """
    # Parse datetime strings
    parsed_start: Optional[datetime.datetime] = None
    parsed_end: Optional[datetime.datetime] = None

    if start_time is not None:
        try:
            parsed_start = datetime.datetime.fromisoformat(start_time)
        except ValueError:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid start_time format: {start_time}",
            )

    if end_time is not None:
        try:
            parsed_end = datetime.datetime.fromisoformat(end_time)
        except ValueError:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid end_time format: {end_time}",
            )

    # Validate time span constraint
    validate_time_span(parsed_start, parsed_end)

    # Build query
    session = SessionLocal()
    try:
        stmt = select(AuditLog).order_by(AuditLog.id.asc())

        # Cursor filter — only return records with id > decoded cursor
        if cursor is not None:
            try:
                cursor_id = decode_cursor(cursor)
            except ValueError:
                raise HTTPException(
                    status_code=400,
                    detail=f"Invalid cursor value: {cursor}",
                )
            stmt = stmt.where(AuditLog.id > cursor_id)

        # Dimension filters
        if parsed_start is not None:
            stmt = stmt.where(AuditLog.created_at >= parsed_start)
        if parsed_end is not None:
            stmt = stmt.where(AuditLog.created_at <= parsed_end)
        if op_type is not None:
            stmt = stmt.where(AuditLog.op_type == op_type)
        if operator_id is not None:
            stmt = stmt.where(AuditLog.operator_id == operator_id)

        # Apply limit + 1 to detect next page existence
        stmt = stmt.limit(limit + 1)

        rows = session.execute(stmt).scalars().all()

        has_next = len(rows) > limit
        items = rows[:limit]

        next_cursor_val: Optional[str] = None
        if has_next and items:
            next_cursor_val = encode_cursor(items[-1].id)

        return AuditLogResponse(
            items=[AuditLogItem.from_orm(r) for r in items],
            next_cursor=next_cursor_val,
        )
    finally:
        session.close()


# ---------------------------------------------------------------------------
# GET /api/v1/audit-logs/trend
# ---------------------------------------------------------------------------

@app.get(
    "/api/v1/audit-logs/trend",
    response_model=List[TrendItem],
    responses={400: {"model": ErrorResponse}},
    summary="Daily aggregated audit log trend",
)
def get_audit_log_trend(
    start_time: str = Query(
        ...,
        description="Start of time window (ISO 8601, inclusive)",
    ),
    end_time: str = Query(
        ...,
        description="End of time window (ISO 8601, inclusive)",
    ),
    op_type: Optional[str] = Query(
        None,
        description="Optional operation type filter",
    ),
    operator_id: Optional[str] = Query(
        None,
        description="Optional operator identifier filter",
    ),
) -> List[TrendItem]:
    """
    Return daily aggregated counts of audit log entries within the
    specified time window.

    The aggregation uses PostgreSQL ``DATE_TRUNC('day', created_at)`` to
    group records by calendar date.  Each element of the returned array
    contains a ``date`` string (YYYY-MM-DD) and a ``count`` integer.

    The same 90-day maximum span constraint applies.

    Args:
        start_time: ISO 8601 start timestamp (required).
        end_time: ISO 8601 end timestamp (required).
        op_type: Optional operation type filter.
        operator_id: Optional operator identifier filter.

    Returns:
        A list of ``TrendItem`` objects, one per day in the requested
        range, even if the count for a day is zero.
    """
    # Parse datetime strings
    try:
        parsed_start = datetime.datetime.fromisoformat(start_time)
    except ValueError:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid start_time format: {start_time}",
        )

    try:
        parsed_end = datetime.datetime.fromisoformat(end_time)
    except ValueError:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid end_time format: {end_time}",
        )

    # Validate time span
    validate_time_span(parsed_start, parsed_end)

    session = SessionLocal()
    try:
        # Build aggregation query using DATE_TRUNC
        day_col = func.DATE_TRUNC("day", AuditLog.created_at).label("day")
        count_col = func.count(AuditLog.id).label("count")

        stmt = select(day_col, count_col).group_by(day_col).order_by(day_col)

        if parsed_start is not None:
            stmt = stmt.where(AuditLog.created_at >= parsed_start)
        if parsed_end is not None:
            stmt = stmt.where(AuditLog.created_at <= parsed_end)
        if op_type is not None:
            stmt = stmt.where(AuditLog.op_type == op_type)
        if operator_id is not None:
            stmt = stmt.where(AuditLog.operator_id == operator_id)

        results = session.execute(stmt).all()

        # Build a lookup from date string -> count
        count_map: Dict[str, int] = {}
        for row in results:
            day_str = row.day.strftime("%Y-%m-%d") if row.day else ""
            count_map[day_str] = row.count

        # Fill in missing days with count=0
        trend_items: List[TrendItem] = []
        current = parsed_start.date()
        end_date = parsed_end.date()
        while current <= end_date:
            day_str = current.isoformat()
            trend_items.append(
                TrendItem(date=day_str, count=count_map.get(day_str, 0))
            )
            current += datetime.timedelta(days=1)

        return trend_items
    finally:
        session.close()


# ---------------------------------------------------------------------------
# Health check
# ---------------------------------------------------------------------------

@app.get("/health", summary="Health check endpoint")
def health_check() -> Dict[str, Any]:
    """
    Return a simple health status payload.

    Returns:
        A dictionary with status and timestamp fields.
    """
    return {
        "status": "ok",
        "timestamp": datetime.datetime.utcnow().isoformat(),
    }


# ---------------------------------------------------------------------------
# Application lifecycle — create tables on startup (dev convenience)
# ---------------------------------------------------------------------------

@app.on_event("startup")
def on_startup() -> None:
    """
    Create database tables on application startup if they do not exist.

    This is a development convenience; in production, migrations should
    be managed by Alembic or an equivalent tool.
    """
    Base.metadata.create_all(bind=engine)


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=int(os.getenv("PORT", "8000")),
        reload=True,
    )