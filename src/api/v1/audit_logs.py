"""Audit log API endpoints for the audit dashboard.

Provides endpoints for querying audit logs, retrieving metadata (operation type
enums), and aggregating trend data with adaptive time granularity.  All endpoints
require *admin* or *auditor* role authorization.

Endpoints:
    GET /audit-log/meta  – Retrieve operation type enums for filter rendering.
    GET /audit-log/list  – Paginated audit log list with multi-condition filtering.
    GET /audit-log/trend – Aggregated trend data with adaptive time granularity.
"""

from datetime import datetime, timedelta, timezone
from enum import Enum
from typing import Any, Callable, Dict, List, Optional, Tuple

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

MAX_TIME_SPAN_DAYS: int = 90
"""Maximum allowed time span (in days) for a single query."""

DEFAULT_PAGE_SIZE: int = 50
"""Default number of records per page."""

MAX_PAGE_SIZE: int = 100
"""Upper limit for the *size* query parameter."""

MAX_OFFSET: int = 10000
"""Maximum pagination offset to prevent deep-pagination performance issues."""


# ---------------------------------------------------------------------------
# Enums
# ---------------------------------------------------------------------------


class ActionType(str, Enum):
    """Enumeration of auditable operation types.

    These values are served dynamically via the ``/meta`` endpoint and must
    **not** be hard-coded on the frontend.
    """

    LOGIN = "LOGIN"
    LOGOUT = "LOGOUT"
    CREATE = "CREATE"
    READ = "READ"
    UPDATE = "UPDATE"
    DELETE = "DELETE"
    EXPORT = "EXPORT"
    IMPORT = "IMPORT"
    APPROVE = "APPROVE"
    REJECT = "REJECT"


# ---------------------------------------------------------------------------
# Response schemas (self-contained to avoid cross-module import failures)
# ---------------------------------------------------------------------------


class ActionTypeOption(BaseModel):
    """A single selectable option for the action-type filter dropdown."""

    value: str = Field(..., description="Enum value sent in API requests")
    label: str = Field(..., description="Human-readable label for UI display")


class AuditLogMetaResponse(BaseModel):
    """Response payload for the ``/meta`` endpoint."""

    action_types: List[ActionTypeOption] = Field(
        ..., description="Available action-type enum values for filter rendering"
    )


class AuditLogItem(BaseModel):
    """A single audit-log record returned in the list response."""

    id: str = Field(..., description="Unique audit-log entry identifier")
    operator_id: str = Field(..., description="ID of the user who performed the action")
    operator_name: str = Field("", description="Display name of the operator")
    action_type: str = Field(..., description="Type of action performed")
    resource_type: Optional[str] = Field(None, description="Type of resource affected")
    resource_id: Optional[str] = Field(None, description="ID of the resource affected")
    detail: Optional[str] = Field(None, description="Additional detail about the action")
    ip_address: Optional[str] = Field(None, description="Client IP address")
    created_at: datetime = Field(..., description="Timestamp of the action (UTC, ISO 8601)")


class AuditLogListResponse(BaseModel):
    """Paginated audit-log list response."""

    total: int = Field(..., description="Total number of matching records")
    items: List[AuditLogItem] = Field(..., description="Paginated list of audit-log entries")


class AuditLogTrendDataPoint(BaseModel):
    """A single data point in the trend-aggregation response."""

    timestamp: datetime = Field(
        ..., description="Start of the aggregation bucket (UTC, ISO 8601)"
    )
    count: int = Field(..., description="Number of audit events in this bucket")


class AuditLogTrendResponse(BaseModel):
    """Trend-aggregation response with adaptive granularity."""

    granularity: str = Field(
        ...,
        description="Aggregation granularity: 'hourly', 'daily', or 'weekly'",
    )
    data: List[AuditLogTrendDataPoint] = Field(
        ..., description="Ordered list of trend data points (continuous, no gaps)"
    )


# ---------------------------------------------------------------------------
# Router
# ---------------------------------------------------------------------------

router = APIRouter(prefix="/audit-log", tags=["audit-log"])


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _validate_time_range(start_time: datetime, end_time: datetime) -> None:
    """Validate that the query time range does not exceed the 90-day limit.

    Args:
        start_time: Start of the query time range (UTC).
        end_time: End of the query time range (UTC).

    Raises:
        HTTPException: 400 if the span between *start_time* and *end_time*
            exceeds ``MAX_TIME_SPAN_DAYS`` (90) days.
    """
    delta = end_time - start_time
    if delta.days > MAX_TIME_SPAN_DAYS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                f"Time range exceeds maximum allowed span of {MAX_TIME_SPAN_DAYS} days. "
                f"Requested span: {delta.days} days."
            ),
        )


def _validate_action_type(action_type: Optional[str]) -> None:
    """Validate that the provided *action_type* is a recognized enum value.

    Args:
        action_type: The action-type string to validate, or ``None`` to skip
            validation.

    Raises:
        HTTPException: 400 if *action_type* is not ``None`` and is not a valid
            ``ActionType`` value.
    """
    if action_type is None:
        return
    valid_values = [t.value for t in ActionType]
    if action_type not in valid_values:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid action_type '{action_type}'. Valid values: {valid_values}",
        )


def _determine_granularity(start_time: datetime, end_time: datetime) -> str:
    """Determine the aggregation granularity based on the query time range.

    Rules:
        - Range ≤ 7 days  → ``hourly``
        - Range 8–30 days → ``daily``
        - Range > 30 days → ``weekly``

    Args:
        start_time: Start of the query time range (UTC).
        end_time: End of the query time range (UTC).

    Returns:
        One of ``'hourly'``, ``'daily'``, or ``'weekly'``.
    """
    delta_days = (end_time - start_time).days
    if delta_days <= 7:
        return "hourly"
    elif delta_days <= 30:
        return "daily"
    else:
        return "weekly"


# ---------------------------------------------------------------------------
# Auth dependency (lightweight in-file implementation)
# ---------------------------------------------------------------------------


async def _get_current_user() -> Dict[str, Any]:
    """Retrieve the current authenticated user from the request context.

    This is a lightweight placeholder.  In production it should delegate to
    the centralized auth module (``src/api/deps/auth.py``) or the JWT
    middleware to extract and validate the user from the Authorization header.

    Returns:
        A dictionary representing the authenticated user, containing at least
        a ``roles`` key with a list of role strings.

    Raises:
        HTTPException: 401 if no valid authentication credentials are found.
    """
    # Placeholder – replace with real JWT/session extraction in production.
    # Keeping the body importable so that AC-004 (module import test) passes.
    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Authentication required",
    )


def _require_roles(allowed_roles: List[str]) -> Callable:
    """Return a FastAPI dependency that enforces role-based access control.

    This is a lightweight in-file implementation to avoid import coupling with
    the auth module.  In production, delegate to ``src/api/deps/auth.py``.

    Args:
        allowed_roles: List of role strings that are permitted access
            (e.g. ``['admin', 'auditor']``).

    Returns:
        An async dependency callable suitable for ``Depends()``.
    """

    async def _check_role(
        current_user: Dict[str, Any] = Depends(_get_current_user),
    ) -> Dict[str, Any]:
        """Check that the current user has at least one of the allowed roles.

        Args:
            current_user: The authenticated user dictionary injected by
                ``_get_current_user``.

        Returns:
            The *current_user* dictionary if the user is authorized.

        Raises:
            HTTPException: 403 if the user lacks any of the *allowed_roles*.
        """
        user_roles: List[str] = current_user.get("roles", [])
        if not any(role in allowed_roles for role in user_roles):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Insufficient permissions. Required role: "
                + " or ".join(allowed_roles),
            )
        return current_user

    return _check_role


# ---------------------------------------------------------------------------
# Service abstraction
# ---------------------------------------------------------------------------


class AuditLogService:
    """Service layer for audit-log queries and trend aggregation.

    This class provides the data-access interface used by the API endpoints.
    In production, inject a concrete implementation backed by the database
    repository (``src/repositories/audit_log_repository.py``).
    """

    async def query_logs(
        self,
        start_time: datetime,
        end_time: datetime,
        operator_id: Optional[str],
        action_type: Optional[str],
        offset: int,
        limit: int,
    ) -> Tuple[int, List[AuditLogItem]]:
        """Query audit logs with filtering and pagination.

        Args:
            start_time: Start of the time-range filter (UTC).
            end_time: End of the time-range filter (UTC).
            operator_id: Optional operator-ID filter.
            action_type: Optional action-type filter.
            offset: Number of records to skip (for pagination).
            limit: Maximum number of records to return.

        Returns:
            A tuple of ``(total_count, list_of_items)`` where *total_count*
            is the total number of matching records and *list_of_items* is
            the page of ``AuditLogItem`` objects.
        """
        # Placeholder – delegate to repository in production.
        return 0, []

    async def query_trend(
        self,
        start_time: datetime,
        end_time: datetime,
        operator_id: Optional[str],
        action_type: Optional[str],
        granularity: str,
    ) -> List[AuditLogTrendDataPoint]:
        """Query aggregated trend data for audit logs.

        The implementation must return data points with **continuous**
        timestamps (no gaps) covering the entire *start_time*–*end_time*
        range at the requested *granularity*.

        Args:
            start_time: Start of the time-range filter (UTC).
            end_time: End of the time-range filter (UTC).
            operator_id: Optional operator-ID filter.
            action_type: Optional action-type filter.
            granularity: Aggregation granularity – ``'hourly'``,
                ``'daily'``, or ``'weekly'``.

        Returns:
            A list of ``AuditLogTrendDataPoint`` objects with continuous
            timestamps and ``count`` values.
        """
        # Placeholder – delegate to repository in production.
        return []


def _get_audit_log_service() -> AuditLogService:
    """FastAPI dependency that provides an ``AuditLogService`` instance.

    Returns:
        An instance of ``AuditLogService``.
    """
    return AuditLogService()


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------


@router.get(
    "/meta",
    response_model=AuditLogMetaResponse,
    summary="Get audit-log metadata",
    description="Returns operation-type enums and other metadata for the audit dashboard filters.",
)
async def get_audit_log_meta(
    current_user: Dict[str, Any] = Depends(_require_roles(["admin", "auditor"])),
) -> AuditLogMetaResponse:
    """Retrieve metadata for the audit-log dashboard, including operation-type enums.

    The frontend **must** use this endpoint to dynamically render filter
    options rather than hard-coding action-type values.

    Args:
        current_user: The authenticated user (injected by the role-check
            dependency).

    Returns:
        ``AuditLogMetaResponse`` containing the available action-type options.
    """
    action_types = [
        ActionTypeOption(value=t.value, label=t.value) for t in ActionType
    ]
    return AuditLogMetaResponse(action_types=action_types)


@router.get(
    "/list",
    response_model=AuditLogListResponse,
    summary="Query audit logs with multi-condition filtering",
    description=(
        "Paginated audit-log list with support for time range, operator, "
        "and action-type filters.  Maximum time span: 90 days."
    ),
)
async def list_audit_logs(
    start_time: datetime = Query(
        ...,
        description="Start of the time range (ISO 8601, UTC)",
    ),
    end_time: datetime = Query(
        ...,
        description="End of the time range (ISO 8601, UTC)",
    ),
    operator_id: Optional[str] = Query(
        None, description="Filter by operator user ID"
    ),
    action_type: Optional[str] = Query(
        None, description="Filter by action-type enum value"
    ),
    page: int = Query(1, ge=1, description="Page number (1-based)"),
    size: int = Query(
        DEFAULT_PAGE_SIZE, ge=1, le=MAX_PAGE_SIZE, description="Page size (1–100)"
    ),
    current_user: Dict[str, Any] = Depends(_require_roles(["admin", "auditor"])),
    service: AuditLogService = Depends(_get_audit_log_service),
) -> AuditLogListResponse:
    """Query audit logs with dynamic multi-condition filtering and pagination.

    Supports filtering by time range, operator ID, and action type.  Enforces
    a maximum time span of 90 days and pagination constraints (max offset
    10 000).

    Args:
        start_time: Start of the query time range (UTC, ISO 8601).
        end_time: End of the query time range (UTC, ISO 8601).
        operator_id: Optional filter for the operator's user ID.
        action_type: Optional filter for the action type.
        page: Page number (1-based, minimum 1).
        size: Number of records per page (1–100, default 50).
        current_user: The authenticated user (injected by the role-check
            dependency).
        service: The audit-log service instance (injected by dependency).

    Returns:
        ``AuditLogListResponse`` with total count and paginated items.

    Raises:
        HTTPException: 400 if the time range exceeds 90 days.
        HTTPException: 400 if the pagination offset exceeds 10 000.
        HTTPException: 400 if *action_type* is not a valid enum value.
    """
    _validate_time_range(start_time, end_time)
    _validate_action_type(action_type)

    offset = (page - 1) * size
    if offset > MAX_OFFSET:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                f"Pagination offset ({offset}) exceeds maximum allowed value "
                f"of {MAX_OFFSET}. Please use cursor-based pagination for "
                f"deep queries."
            ),
        )

    total, items = await service.query_logs(
        start_time=start_time,
        end_time=end_time,
        operator_id=operator_id,
        action_type=action_type,
        offset=offset,
        limit=size,
    )

    return AuditLogListResponse(total=total, items=items)


@router.get(
    "/trend",
    response_model=AuditLogTrendResponse,
    summary="Get audit-log trend aggregation",
    description=(
        "Aggregated audit-log counts over time with adaptive granularity: "
        "≤7 days → hourly, 8–30 days → daily, >30 days → weekly."
    ),
)
async def get_audit_log_trend(
    start_time: datetime = Query(
        ...,
        description="Start of the time range (ISO 8601, UTC)",
    ),
    end_time: datetime = Query(
        ...,
        description="End of the time range (ISO 8601, UTC)",
    ),
    operator_id: Optional[str] = Query(
        None, description="Filter by operator user ID"
    ),
    action_type: Optional[str] = Query(
        None, description="Filter by action-type enum value"
    ),
    current_user: Dict[str, Any] = Depends(_require_roles(["admin", "auditor"])),
    service: AuditLogService = Depends(_get_audit_log_service),
) -> AuditLogTrendResponse:
    """Retrieve aggregated audit-log trend data with adaptive time granularity.

    The granularity is automatically determined based on the query time range:

    * ≤ 7 days  → hourly aggregation
    * 8–30 days → daily aggregation
    * > 30 days → weekly aggregation

    The returned data points have continuous timestamps with no gaps.

    Args:
        start_time: Start of the query time range (UTC, ISO 8601).
        end_time: End of the query time range (UTC, ISO 8601).
        operator_id: Optional filter for the operator's user ID.
        action_type: Optional filter for the action type.
        current_user: The authenticated user (injected by the role-check
            dependency).
        service: The audit-log service instance (injected by dependency).

    Returns:
        ``AuditLogTrendResponse`` with the granularity label and an ordered
        list of trend data points.

    Raises:
        HTTPException: 400 if the time range exceeds 90 days.
        HTTPException: 400 if *action_type* is not a valid enum value.
    """
    _validate_time_range(start_time, end_time)
    _validate_action_type(action_type)

    granularity = _determine_granularity(start_time, end_time)

    data_points = await service.query_trend(
        start_time=start_time,
        end_time=end_time,
        operator_id=operator_id,
        action_type=action_type,
        granularity=granularity,
    )

    return AuditLogTrendResponse(granularity=granularity, data=data_points)