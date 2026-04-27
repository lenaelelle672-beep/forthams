"""
审计日志中间件模块。

提供审计日志仪表板所需的请求校验、角色鉴权、分页约束及趋势粒度计算等中间件能力，
支撑 Phase 1 核心审计日志查询与可视化基座的接口层需求。
"""

from __future__ import annotations

import logging
from datetime import datetime, timedelta, timezone
from enum import Enum
from functools import wraps
from typing import Any, Callable, Dict, List, Optional, Tuple

from fastapi import HTTPException, Request, status

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# 常量定义
# ---------------------------------------------------------------------------

MAX_TIME_SPAN_DAYS: int = 90
"""单次查询允许的最大时间跨度（天），超出将返回 400。"""

DEFAULT_PAGE_SIZE: int = 50
"""列表查询默认每页条数。"""

MAX_PAGE_SIZE: int = 100
"""列表查询单页上限。"""

MAX_OFFSET: int = 10000
"""深度分页偏移量上限，超过需采用游标/seek 分页策略。"""

ALLOWED_ROLES: Tuple[str, ...] = ("admin", "auditor")
"""允许访问审计日志仪表板及 API 的角色集合。"""


# ---------------------------------------------------------------------------
# 操作类型枚举 — 由后端统一下发，前端禁止硬编码
# ---------------------------------------------------------------------------

class ActionType(str, Enum):
    """审计日志操作类型枚举。

    后端统一定义所有合法操作类型，前端通过 ``/api/v1/audit-log/meta`` 接口
    动态获取并渲染筛选项，禁止前端硬编码。
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
    ASSIGN = "ASSIGN"
    TRANSFER = "TRANSFER"
    RETIRE = "RETIRE"
    DEPRECIATE = "DEPRECIATE"


# ---------------------------------------------------------------------------
# 趋势图表时间粒度
# ---------------------------------------------------------------------------

class TrendGranularity(str, Enum):
    """趋势图表聚合粒度枚举。

    根据查询时间范围自适应选择：
    - ``HOUR``: 查询范围 ≤ 7 天
    - ``DAY``: 查询范围 8–30 天
    - ``WEEK``: 查询范围 > 30 天
    """

    HOUR = "hour"
    DAY = "day"
    WEEK = "week"


# ---------------------------------------------------------------------------
# 工具函数
# ---------------------------------------------------------------------------

def parse_utc_iso8601(value: str) -> datetime:
    """将 ISO 8601 格式字符串解析为 UTC 时区的 datetime 对象。

    Args:
        value: ISO 8601 格式的时间字符串，例如 ``2024-01-01T00:00:00Z``。

    Returns:
        带有 UTC 时区信息的 datetime 对象。

    Raises:
        HTTPException: 当字符串无法解析为合法时间时返回 400。
    """
    try:
        dt = datetime.fromisoformat(value.replace("Z", "+00:00"))
    except (ValueError, TypeError) as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid ISO 8601 datetime: {value}",
        ) from exc

    if dt.tzinfo is None:
        # 无时区信息视为 UTC
        dt = dt.replace(tzinfo=timezone.utc)
    else:
        dt = dt.astimezone(timezone.utc)
    return dt


def compute_time_span_days(start_time: datetime, end_time: datetime) -> int:
    """计算两个 UTC 时间之间的天数差（向上取整）。

    Args:
        start_time: 起始时间（UTC）。
        end_time: 结束时间（UTC）。

    Returns:
        天数差，至少为 0。
    """
    delta = end_time - start_time
    return max(0, int(delta.total_seconds() / 86400) + (1 if delta.total_seconds() % 86400 else 0))


def resolve_trend_granularity(start_time: datetime, end_time: datetime) -> TrendGranularity:
    """根据查询时间范围自适应确定趋势聚合粒度。

    规则：
    - ≤ 7 天 → ``HOUR``
    - 8–30 天 → ``DAY``
    - > 30 天 → ``WEEK``

    Args:
        start_time: 查询起始时间（UTC）。
        end_time: 查询结束时间（UTC）。

    Returns:
        对应的 :class:`TrendGranularity` 枚举值。
    """
    span_days = compute_time_span_days(start_time, end_time)
    if span_days <= 7:
        return TrendGranularity.HOUR
    elif span_days <= 30:
        return TrendGranularity.DAY
    else:
        return TrendGranularity.WEEK


def generate_trend_buckets(
    start_time: datetime,
    end_time: datetime,
    granularity: TrendGranularity,
) -> List[datetime]:
    """生成趋势聚合的时间桶边界列表，确保时间连续无断点。

    Args:
        start_time: 起始时间（UTC）。
        end_time: 结束时间（UTC）。
        granularity: 聚合粒度。

    Returns:
        时间桶起始时刻列表，按升序排列，覆盖 [start_time, end_time)。
    """
    buckets: List[datetime] = []
    cursor = start_time
    delta_map: Dict[TrendGranularity, timedelta] = {
        TrendGranularity.HOUR: timedelta(hours=1),
        TrendGranularity.DAY: timedelta(days=1),
        TrendGranularity.WEEK: timedelta(weeks=1),
    }
    step = delta_map[granularity]
    while cursor < end_time:
        buckets.append(cursor)
        cursor += step
    return buckets


# ---------------------------------------------------------------------------
# 角色鉴权
# ---------------------------------------------------------------------------

def extract_user_roles(request: Request) -> List[str]:
    """从请求上下文中提取当前用户的角色列表。

    优先从 ``request.state.user_roles`` 获取（由上游 JWT 中间件注入），
    若不存在则回退到 ``request.state.user`` 的 ``roles`` 属性。

    Args:
        request: FastAPI 请求对象。

    Returns:
        角色字符串列表，可能为空。
    """
    roles: Optional[List[str]] = getattr(request.state, "user_roles", None)
    if roles is not None:
        return roles
    user_obj = getattr(request.state, "user", None)
    if user_obj is not None and hasattr(user_obj, "roles"):
        return list(user_obj.roles)
    return []


def require_audit_role(request: Request) -> None:
    """校验当前用户是否具有审计日志访问权限。

    仅 ``admin`` 或 ``auditor`` 角色可访问审计日志仪表板及对应 API。

    Args:
        request: FastAPI 请求对象。

    Raises:
        HTTPException: 当用户角色不在允许列表中时返回 403。
    """
    roles = extract_user_roles(request)
    if not any(role in ALLOWED_ROLES for role in roles):
        logger.warning(
            "Audit log access denied for roles=%s on path=%s",
            roles,
            request.url.path,
        )
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Insufficient permissions: admin or auditor role required.",
        )


# ---------------------------------------------------------------------------
# 时间范围校验
# ---------------------------------------------------------------------------

def validate_time_range(start_time: datetime, end_time: datetime) -> None:
    """校验查询时间范围是否满足约束。

    约束：
    - ``start_time`` 不得晚于 ``end_time``。
    - 单次查询时间跨度不得超过 90 天。

    Args:
        start_time: 查询起始时间（UTC）。
        end_time: 查询结束时间（UTC）。

    Raises:
        HTTPException: 当时间范围不合法或跨度超限时返回 400。
    """
    if start_time > end_time:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="start_time must not be later than end_time.",
        )
    span_days = compute_time_span_days(start_time, end_time)
    if span_days > MAX_TIME_SPAN_DAYS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                f"Time span exceeds the maximum allowed {MAX_TIME_SPAN_DAYS} days "
                f"(requested: {span_days} days). Please narrow the query range."
            ),
        )


# ---------------------------------------------------------------------------
# 分页参数校验
# ---------------------------------------------------------------------------

def validate_pagination(page: int, size: int) -> Tuple[int, int]:
    """校验并规范化分页参数。

    规则：
    - ``page`` 最小为 1。
    - ``size`` 最小为 1，最大为 100，默认 50。
    - 偏移量 (page-1)*size 不得超过 10000。

    Args:
        page: 请求的页码。
        size: 请求的每页条数。

    Returns:
        规范化后的 ``(page, size)`` 元组。

    Raises:
        HTTPException: 当偏移量超过上限时返回 400。
    """
    page = max(1, page)
    size = max(1, min(size, MAX_PAGE_SIZE))
    offset = (page - 1) * size
    if offset > MAX_OFFSET:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                f"Pagination offset {offset} exceeds the maximum allowed {MAX_OFFSET}. "
                "Please use cursor-based pagination for deep queries."
            ),
        )
    return page, size


# ---------------------------------------------------------------------------
# 请求参数解析与校验（列表查询）
# ---------------------------------------------------------------------------

class AuditLogQueryParams:
    """审计日志列表查询参数的解析与校验结果。

    Attributes:
        start_time: 查询起始时间（UTC）。
        end_time: 查询结束时间（UTC）。
        operator_id: 操作人 ID 筛选（可选）。
        action_type: 操作类型筛选（可选）。
        page: 规范化后的页码。
        size: 规范化后的每页条数。
    """

    def __init__(
        self,
        start_time: datetime,
        end_time: datetime,
        operator_id: Optional[str],
        action_type: Optional[str],
        page: int,
        size: int,
    ) -> None:
        """初始化查询参数对象。

        Args:
            start_time: 查询起始时间（UTC）。
            end_time: 查询结束时间（UTC）。
            operator_id: 操作人 ID 筛选。
            action_type: 操作类型筛选。
            page: 页码。
            size: 每页条数。
        """
        self.start_time = start_time
        self.end_time = end_time
        self.operator_id = operator_id
        self.action_type = action_type
        self.page = page
        self.size = size

    def to_filter_dict(self) -> Dict[str, Any]:
        """将查询参数转换为数据库筛选字典。

        Returns:
            包含所有非空筛选条件的字典。
        """
        result: Dict[str, Any] = {
            "start_time": self.start_time,
            "end_time": self.end_time,
        }
        if self.operator_id is not None:
            result["operator_id"] = self.operator_id
        if self.action_type is not None:
            result["action_type"] = self.action_type
        return result


def parse_audit_log_query(request: Request) -> AuditLogQueryParams:
    """从请求中解析并校验审计日志列表查询参数。

    执行以下校验步骤：
    1. 角色鉴权（admin/auditor）。
    2. 解析 start_time / end_time 为 UTC datetime。
    3. 校验时间范围（≤ 90 天）。
    4. 校验并规范化分页参数。
    5. 可选筛选参数 action_type 合法性校验。

    Args:
        request: FastAPI 请求对象。

    Returns:
        校验通过的 :class:`AuditLogQueryParams` 实例。

    Raises:
        HTTPException: 校验失败时返回对应错误码。
    """
    # 1. 角色鉴权
    require_audit_role(request)

    params = request.query_params

    # 2. 解析时间参数
    start_str = params.get("start_time")
    end_str = params.get("end_time")
    if not start_str or not end_str:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Both start_time and end_time are required.",
        )
    start_time = parse_utc_iso8601(start_str)
    end_time = parse_utc_iso8601(end_str)

    # 3. 时间范围校验
    validate_time_range(start_time, end_time)

    # 4. 分页参数
    page = int(params.get("page", 1))
    size = int(params.get("size", DEFAULT_PAGE_SIZE))
    page, size = validate_pagination(page, size)

    # 5. 可选筛选参数
    operator_id = params.get("operator_id")
    action_type = params.get("action_type")
    if action_type is not None:
        valid_types = {e.value for e in ActionType}
        if action_type not in valid_types:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=(
                    f"Invalid action_type '{action_type}'. "
                    f"Valid values: {sorted(valid_types)}"
                ),
            )

    return AuditLogQueryParams(
        start_time=start_time,
        end_time=end_time,
        operator_id=operator_id,
        action_type=action_type,
        page=page,
        size=size,
    )


# ---------------------------------------------------------------------------
# 请求参数解析与校验（趋势查询）
# ---------------------------------------------------------------------------

class AuditLogTrendParams:
    """审计日志趋势查询参数的解析与校验结果。

    Attributes:
        start_time: 查询起始时间（UTC）。
        end_time: 查询结束时间（UTC）。
        granularity: 自适应确定的聚合粒度。
        action_type: 操作类型筛选（可选）。
        operator_id: 操作人 ID 筛选（可选）。
    """

    def __init__(
        self,
        start_time: datetime,
        end_time: datetime,
        granularity: TrendGranularity,
        action_type: Optional[str] = None,
        operator_id: Optional[str] = None,
    ) -> None:
        """初始化趋势查询参数对象。

        Args:
            start_time: 查询起始时间（UTC）。
            end_time: 查询结束时间（UTC）。
            granularity: 聚合粒度。
            action_type: 操作类型筛选。
            operator_id: 操作人 ID 筛选。
        """
        self.start_time = start_time
        self.end_time = end_time
        self.granularity = granularity
        self.action_type = action_type
        self.operator_id = operator_id


def parse_audit_log_trend(request: Request) -> AuditLogTrendParams:
    """从请求中解析并校验审计日志趋势查询参数。

    执行以下校验步骤：
    1. 角色鉴权（admin/auditor）。
    2. 解析 start_time / end_time 为 UTC datetime。
    3. 校验时间范围（≤ 90 天）。
    4. 自适应计算趋势聚合粒度。
    5. 可选筛选参数 action_type 合法性校验。

    Args:
        request: FastAPI 请求对象。

    Returns:
        校验通过的 :class:`AuditLogTrendParams` 实例。

    Raises:
        HTTPException: 校验失败时返回对应错误码。
    """
    # 1. 角色鉴权
    require_audit_role(request)

    params = request.query_params

    # 2. 解析时间参数
    start_str = params.get("start_time")
    end_str = params.get("end_time")
    if not start_str or not end_str:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Both start_time and end_time are required.",
        )
    start_time = parse_utc_iso8601(start_str)
    end_time = parse_utc_iso8601(end_str)

    # 3. 时间范围校验
    validate_time_range(start_time, end_time)

    # 4. 自适应粒度
    granularity = resolve_trend_granularity(start_time, end_time)

    # 5. 可选筛选参数
    action_type = params.get("action_type")
    operator_id = params.get("operator_id")
    if action_type is not None:
        valid_types = {e.value for e in ActionType}
        if action_type not in valid_types:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=(
                    f"Invalid action_type '{action_type}'. "
                    f"Valid values: {sorted(valid_types)}"
                ),
            )

    return AuditLogTrendParams(
        start_time=start_time,
        end_time=end_time,
        granularity=granularity,
        action_type=action_type,
        operator_id=operator_id,
    )


# ---------------------------------------------------------------------------
# 元数据接口辅助
# ---------------------------------------------------------------------------

def get_audit_meta() -> Dict[str, Any]:
    """获取审计日志元数据，供 ``/api/v1/audit-log/meta`` 接口返回。

    返回操作类型枚举列表，前端据此动态渲染筛选项，禁止硬编码。

    Returns:
        包含 ``action_types`` 列表的字典。
    """
    return {
        "action_types": [item.value for item in ActionType],
    }


# ---------------------------------------------------------------------------
# FastAPI 依赖注入快捷函数
# ---------------------------------------------------------------------------

def audit_log_query_dependency(request: Request) -> AuditLogQueryParams:
    """FastAPI 依赖项：解析并校验审计日志列表查询参数。

    用法::

        @router.get("/api/v1/audit-log/list")
        async def list_audit_logs(query: AuditLogQueryParams = Depends(audit_log_query_dependency)):
            ...

    Args:
        request: FastAPI 请求对象。

    Returns:
        校验通过的 :class:`AuditLogQueryParams` 实例。
    """
    return parse_audit_log_query(request)


def audit_log_trend_dependency(request: Request) -> AuditLogTrendParams:
    """FastAPI 依赖项：解析并校验审计日志趋势查询参数。

    用法::

        @router.get("/api/v1/audit-log/trend")
        async def trend_audit_logs(trend: AuditLogTrendParams = Depends(audit_log_trend_dependency)):
            ...

    Args:
        request: FastAPI 请求对象。

    Returns:
        校验通过的 :class:`AuditLogTrendParams` 实例。
    """
    return parse_audit_log_trend(request)


def audit_role_dependency(request: Request) -> None:
    """FastAPI 依赖项：校验审计日志访问角色权限。

    用法::

        @router.get("/api/v1/audit-log/meta")
        async def audit_meta(_: None = Depends(audit_role_dependency)):
            ...

    Args:
        request: FastAPI 请求对象。

    Raises:
        HTTPException: 当用户角色不在允许列表中时返回 403。
    """
    require_audit_role(request)