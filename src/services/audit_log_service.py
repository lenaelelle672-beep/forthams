"""
审计日志服务模块。

提供审计日志的多维筛选查询、趋势聚合及元数据下发能力，
支撑操作日志仪表板的核心数据层需求。

约束：
- 单次查询时间跨度不得超过 90 天
- 列表查询强制分页，单页上限 100 条（默认 50 条）
- 深度分页偏移量不超过 10000（采用 seek 分页策略）
- 后端存储与 API 交互强制使用 UTC 时间（ISO 8601 格式）
- 趋势图表时间粒度根据查询范围自适应：≤7天按小时，8-30天按天，>30天按周
"""

from __future__ import annotations

import logging
from datetime import datetime, timedelta, timezone
from enum import Enum
from typing import Any, Dict, List, Optional, Tuple

from src.repositories.audit_log_repository import AuditLogRepository

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# 常量定义
# ---------------------------------------------------------------------------

MAX_TIME_SPAN_DAYS: int = 90
"""单次查询允许的最大时间跨度（天）。"""

DEFAULT_PAGE_SIZE: int = 50
"""默认分页大小。"""

MAX_PAGE_SIZE: int = 100
"""单页最大记录数。"""

MAX_OFFSET: int = 10000
"""深度分页允许的最大偏移量。"""


# ---------------------------------------------------------------------------
# 操作类型枚举 — 由后端统一下发，前端禁止硬编码
# ---------------------------------------------------------------------------

class ActionType(str, Enum):
    """审计日志操作类型枚举。

    后端统一下发至 ``/api/v1/audit-log/meta`` 接口，
    前端需动态渲染筛选项，禁止硬编码。
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
# 趋势聚合时间粒度
# ---------------------------------------------------------------------------

class TrendGranularity(str, Enum):
    """趋势聚合时间粒度枚举。

    根据查询时间范围自适应选择：
    - ``HOURLY``：查询范围 ≤ 7 天
    - ``DAILY``：查询范围 8–30 天
    - ``WEEKLY``：查询范围 > 30 天
    """

    HOURLY = "hourly"
    DAILY = "daily"
    WEEKLY = "weekly"


# ---------------------------------------------------------------------------
# 异常定义
# ---------------------------------------------------------------------------

class AuditLogServiceError(Exception):
    """审计日志服务基础异常。"""

    def __init__(self, message: str, status_code: int = 400) -> None:
        """初始化异常。

        Args:
            message: 错误描述信息。
            status_code: HTTP 状态码，默认 400。
        """
        self.message = message
        self.status_code = status_code
        super().__init__(self.message)


class TimeSpanExceededError(AuditLogServiceError):
    """查询时间跨度超过 90 天限制时抛出。"""

    def __init__(self, span_days: float) -> None:
        """初始化时间跨度越界异常。

        Args:
            span_days: 实际查询跨度天数。
        """
        super().__init__(
            message=f"查询时间跨度为 {span_days:.1f} 天，超过最大允许的 {MAX_TIME_SPAN_DAYS} 天限制",
            status_code=400,
        )
        self.span_days = span_days


class PaginationOffsetExceededError(AuditLogServiceError):
    """分页偏移量超过 10000 限制时抛出。"""

    def __init__(self, offset: int) -> None:
        """初始化偏移量越界异常。

        Args:
            offset: 实际请求的偏移量。
        """
        super().__init__(
            message=f"分页偏移量为 {offset}，超过最大允许的 {MAX_OFFSET}，请使用更精确的筛选条件缩小范围",
            status_code=400,
        )
        self.offset = offset


class PermissionDeniedError(AuditLogServiceError):
    """用户无审计日志访问权限时抛出。"""

    def __init__(self, user_roles: List[str]) -> None:
        """初始化权限拒绝异常。

        Args:
            user_roles: 用户当前角色列表。
        """
        super().__init__(
            message=f"用户角色 {user_roles} 无权访问审计日志，需要 admin 或 auditor 角色",
            status_code=403,
        )
        self.user_roles = user_roles


# ---------------------------------------------------------------------------
# 服务实现
# ---------------------------------------------------------------------------

class AuditLogService:
    """审计日志服务。

    提供审计日志的多维筛选查询、趋势聚合及元数据下发能力。
    所有时间参数均使用 UTC（ISO 8601 格式）。
    """

    ALLOWED_ROLES: Tuple[str, ...] = ("admin", "auditor")
    """允许访问审计日志的角色集合。"""

    def __init__(self, repository: Optional[AuditLogRepository] = None) -> None:
        """初始化审计日志服务。

        Args:
            repository: 审计日志数据仓库实例，若为 None 则使用默认实例。
        """
        self._repository = repository or AuditLogRepository()

    # -----------------------------------------------------------------------
    # 权限校验
    # -----------------------------------------------------------------------

    def check_permission(self, user_roles: List[str]) -> bool:
        """校验用户是否具有审计日志访问权限。

        仅具有 ``admin`` 或 ``auditor`` 角色的用户可访问审计日志 API。

        Args:
            user_roles: 用户当前角色列表。

        Returns:
            是否具有访问权限。

        Raises:
            PermissionDeniedError: 用户无访问权限时抛出。
        """
        if not any(role in self.ALLOWED_ROLES for role in user_roles):
            raise PermissionDeniedError(user_roles)
        return True

    # -----------------------------------------------------------------------
    # 元数据接口
    # -----------------------------------------------------------------------

    def get_action_types(self) -> List[Dict[str, str]]:
        """获取操作类型枚举列表。

        供 ``/api/v1/audit-log/meta`` 接口下发，前端需动态渲染筛选项，
        禁止硬编码操作类型。

        Returns:
            操作类型列表，每项包含 ``value`` 和 ``label`` 字段。
        """
        return [
            {"value": action.value, "label": action.name}
            for action in ActionType
        ]

    # -----------------------------------------------------------------------
    # 列表查询
    # -----------------------------------------------------------------------

    def get_audit_logs(
        self,
        start_time: datetime,
        end_time: datetime,
        operator_id: Optional[str] = None,
        action_type: Optional[str] = None,
        page: int = 1,
        size: int = DEFAULT_PAGE_SIZE,
        seek_id: Optional[str] = None,
        user_roles: Optional[List[str]] = None,
    ) -> Dict[str, Any]:
        """多维筛选查询审计日志列表，支持分页。

        支持按时间范围、操作人、操作类型动态组合筛选，强制分页。
        当提供 ``seek_id`` 时采用 seek 分页策略以规避深度分页性能问题。

        约束：
        - 时间跨度不得超过 90 天，否则返回 400
        - 单页上限 100 条，默认 50 条
        - 偏移量不超过 10000，超出需使用 seek 分页

        Args:
            start_time: 查询起始时间（UTC）。
            end_time: 查询结束时间（UTC）。
            operator_id: 操作人 ID，可选。
            action_type: 操作类型枚举值，可选。
            page: 页码，从 1 开始，默认 1。
            size: 每页记录数，默认 50，最大 100。
            seek_id: Seek 分页锚点 ID，提供时忽略 page 参数。
            user_roles: 当前用户角色列表，用于权限校验。

        Returns:
            包含 ``total`` 和 ``items`` 的字典。``items`` 中每条记录
            包含 ``id``, ``operator_id``, ``action_type``, ``target_type``,
            ``target_id``, ``detail``, ``ip_address``, ``created_at`` 等字段。

        Raises:
            TimeSpanExceededError: 时间跨度超过 90 天。
            PaginationOffsetExceededError: 偏移量超过 10000。
            PermissionDeniedError: 用户无访问权限。
            ValueError: 参数校验失败。
        """
        # 权限校验
        if user_roles is not None:
            self.check_permission(user_roles)

        # 参数规范化
        start_time = self._ensure_utc(start_time)
        end_time = self._ensure_utc(end_time)

        # 时间跨度校验
        self._validate_time_span(start_time, end_time)

        # 操作类型校验
        if action_type is not None:
            self._validate_action_type(action_type)

        # 分页参数校验
        size = max(1, min(size, MAX_PAGE_SIZE))
        page = max(1, page)

        # 偏移量校验（非 seek 模式下）
        offset = (page - 1) * size
        if seek_id is None and offset > MAX_OFFSET:
            raise PaginationOffsetExceededError(offset)

        # 构建查询条件
        filters: Dict[str, Any] = {
            "start_time": start_time,
            "end_time": end_time,
        }
        if operator_id is not None:
            filters["operator_id"] = operator_id
        if action_type is not None:
            filters["action_type"] = action_type

        # 执行查询
        if seek_id is not None:
            items, total = self._repository.query_seek(
                filters=filters,
                seek_id=seek_id,
                size=size,
            )
        else:
            items, total = self._repository.query_paginated(
                filters=filters,
                offset=offset,
                size=size,
            )

        logger.debug(
            "审计日志查询完成: total=%d, returned=%d, page=%d, size=%d",
            total,
            len(items),
            page,
            size,
        )

        return {
            "total": total,
            "items": items,
        }

    # -----------------------------------------------------------------------
    # 趋势聚合
    # -----------------------------------------------------------------------

    def get_audit_log_trend(
        self,
        start_time: datetime,
        end_time: datetime,
        operator_id: Optional[str] = None,
        action_type: Optional[str] = None,
        user_roles: Optional[List[str]] = None,
    ) -> Dict[str, Any]:
        """获取审计日志趋势聚合数据。

        根据查询时间范围自适应选择聚合粒度：
        - ≤ 7 天：按小时聚合
        - 8–30 天：按天聚合
        - \> 30 天：按周聚合

        返回时间连续无断点的数据点序列，每个数据点包含
        ``timestamp`` 与 ``count`` 字段。

        Args:
            start_time: 查询起始时间（UTC）。
            end_time: 查询结束时间（UTC）。
            operator_id: 操作人 ID，可选。
            action_type: 操作类型枚举值，可选。
            user_roles: 当前用户角色列表，用于权限校验。

        Returns:
            包含 ``granularity`` 和 ``data_points`` 的字典。
            ``granularity`` 为当前聚合粒度（hourly/daily/weekly），
            ``data_points`` 为 ``[{timestamp, count}, ...]`` 列表。

        Raises:
            TimeSpanExceededError: 时间跨度超过 90 天。
            PermissionDeniedError: 用户无访问权限。
            ValueError: 参数校验失败。
        """
        # 权限校验
        if user_roles is not None:
            self.check_permission(user_roles)

        # 参数规范化
        start_time = self._ensure_utc(start_time)
        end_time = self._ensure_utc(end_time)

        # 时间跨度校验
        self._validate_time_span(start_time, end_time)

        # 操作类型校验
        if action_type is not None:
            self._validate_action_type(action_type)

        # 自适应粒度选择
        granularity = self._determine_granularity(start_time, end_time)

        # 构建查询条件
        filters: Dict[str, Any] = {
            "start_time": start_time,
            "end_time": end_time,
        }
        if operator_id is not None:
            filters["operator_id"] = operator_id
        if action_type is not None:
            filters["action_type"] = action_type

        # 从仓库获取聚合数据
        raw_buckets = self._repository.aggregate_trend(
            filters=filters,
            granularity=granularity.value,
        )

        # 填充断点，确保时间连续
        data_points = self._fill_trend_gaps(
            start_time=start_time,
            end_time=end_time,
            granularity=granularity,
            raw_buckets=raw_buckets,
        )

        logger.debug(
            "审计日志趋势聚合完成: granularity=%s, data_points=%d",
            granularity.value,
            len(data_points),
        )

        return {
            "granularity": granularity.value,
            "data_points": data_points,
        }

    # -----------------------------------------------------------------------
    # 私有辅助方法
    # -----------------------------------------------------------------------

    @staticmethod
    def _ensure_utc(dt: datetime) -> datetime:
        """确保 datetime 对象为 UTC 时区感知。

        若传入 naive datetime，视为 UTC 并附加时区信息；
        若传入非 UTC 时区 datetime，转换为 UTC。

        Args:
            dt: 待转换的 datetime 对象。

        Returns:
            UTC 时区感知的 datetime 对象。
        """
        if dt.tzinfo is None:
            return dt.replace(tzinfo=timezone.utc)
        return dt.astimezone(timezone.utc)

    @staticmethod
    def _validate_time_span(start_time: datetime, end_time: datetime) -> None:
        """校验查询时间跨度是否在 90 天限制内。

        Args:
            start_time: 查询起始时间（UTC）。
            end_time: 查询结束时间（UTC）。

        Raises:
            TimeSpanExceededError: 时间跨度超过 90 天。
            ValueError: 起始时间晚于结束时间。
        """
        if start_time > end_time:
            raise ValueError(
                f"起始时间 {start_time.isoformat()} 晚于结束时间 {end_time.isoformat()}"
            )

        span_days = (end_time - start_time).days
        if span_days > MAX_TIME_SPAN_DAYS:
            raise TimeSpanExceededError(span_days)

    @staticmethod
    def _validate_action_type(action_type: str) -> None:
        """校验操作类型是否为合法枚举值。

        Args:
            action_type: 操作类型字符串。

        Raises:
            ValueError: 操作类型不在枚举范围内。
        """
        valid_values = {at.value for at in ActionType}
        if action_type not in valid_values:
            raise ValueError(
                f"无效的操作类型 '{action_type}'，合法值为: {sorted(valid_values)}"
            )

    @staticmethod
    def _determine_granularity(
        start_time: datetime, end_time: datetime
    ) -> TrendGranularity:
        """根据查询时间范围自适应选择趋势聚合粒度。

        规则：
        - ≤ 7 天：按小时聚合
        - 8–30 天：按天聚合
        - \> 30 天：按周聚合

        Args:
            start_time: 查询起始时间（UTC）。
            end_time: 查询结束时间（UTC）。

        Returns:
            对应的聚合粒度枚举值。
        """
        span_days = (end_time - start_time).days
        if span_days <= 7:
            return TrendGranularity.HOURLY
        elif span_days <= 30:
            return TrendGranularity.DAILY
        else:
            return TrendGranularity.WEEKLY

    @staticmethod
    def _fill_trend_gaps(
        start_time: datetime,
        end_time: datetime,
        granularity: TrendGranularity,
        raw_buckets: Dict[str, int],
    ) -> List[Dict[str, Any]]:
        """填充趋势数据断点，确保时间连续无间断。

        根据粒度生成完整的时间序列，将仓库返回的聚合数据
        映射至对应时间点，缺失点填充 count=0。

        Args:
            start_time: 查询起始时间（UTC）。
            end_time: 查询结束时间（UTC）。
            granularity: 聚合粒度。
            raw_buckets: 仓库返回的原始聚合数据，键为 ISO 8601 时间字符串，
                         值为该时间段的操作计数。

        Returns:
            连续的时间点列表，每项包含 ``timestamp`` 和 ``count`` 字段。
        """
        data_points: List[Dict[str, Any]] = []

        if granularity == TrendGranularity.HOURLY:
            # 按小时生成时间点
            current = start_time.replace(minute=0, second=0, microsecond=0)
            while current <= end_time:
                key = current.isoformat()
                data_points.append({
                    "timestamp": key,
                    "count": raw_buckets.get(key, 0),
                })
                current += timedelta(hours=1)

        elif granularity == TrendGranularity.DAILY:
            # 按天生成时间点
            current = start_time.replace(hour=0, minute=0, second=0, microsecond=0)
            while current <= end_time:
                key = current.isoformat()
                data_points.append({
                    "timestamp": key,
                    "count": raw_buckets.get(key, 0),
                })
                current += timedelta(days=1)

        elif granularity == TrendGranularity.WEEKLY:
            # 按周生成时间点（以周一为起始）
            current = start_time - timedelta(days=start_time.weekday())
            current = current.replace(hour=0, minute=0, second=0, microsecond=0)
            while current <= end_time:
                key = current.isoformat()
                data_points.append({
                    "timestamp": key,
                    "count": raw_buckets.get(key, 0),
                })
                current += timedelta(weeks=1)

        return data_points


# ---------------------------------------------------------------------------
# 便捷函数（供路由层直接调用）
# ---------------------------------------------------------------------------

def get_audit_log_service() -> AuditLogService:
    """获取审计日志服务单例。

    使用工厂函数模式，便于依赖注入与测试替换。

    Returns:
        AuditLogService 实例。
    """
    return AuditLogService()