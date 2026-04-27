"""
Audit Dashboard Service — 审计仪表板聚合统计服务

提供审计日志的宏观聚合统计能力，支撑前端仪表板可视化。
所有聚合查询在数据库层完成（通过 Repository 层 SQL 聚合），
禁止全量拉取至内存计算。

核心能力:
- 时间趋势聚合（自适应粒度：小时/天/月）
- 操作类型分布统计
- 操作人活跃度排名（Top N）

边界约束:
- 查询时间跨度上限 90 天
- 未指定时间范围时默认最近 7 天
- 操作人维度默认 Top 20，最大 Top 50
"""

from __future__ import annotations

import enum
from datetime import datetime, timedelta, timezone
from typing import Any, List, Optional

from src.core.exceptions import BusinessError


# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

#: 查询时间跨度上限（天）
MAX_QUERY_SPAN_DAYS: int = 90

#: 默认查询时间跨度（天）
DEFAULT_QUERY_SPAN_DAYS: int = 7

#: 操作人维度默认返回数量
DEFAULT_OPERATOR_TOP_N: int = 20

#: 操作人维度最大返回数量
MAX_OPERATOR_TOP_N: int = 50


# ---------------------------------------------------------------------------
# Enums
# ---------------------------------------------------------------------------

class TimeGranularity(str, enum.Enum):
    """时间趋势聚合粒度枚举。

    粒度由服务端根据查询跨度自动决定，前端不可指定。
    """

    HOUR = "hour"
    DAY = "day"
    MONTH = "month"


# ---------------------------------------------------------------------------
# Service
# ---------------------------------------------------------------------------

class AuditDashboardService:
    """审计仪表板聚合统计服务。

    负责处理时间粒度自适应逻辑、Top N 截断逻辑及时间跨度校验，
    并委托 Repository 层执行数据库聚合查询。

    Attributes:
        audit_log_repo: 审计日志仓储实例，负责执行 SQL 聚合查询。
    """

    def __init__(self, audit_log_repo: Any) -> None:
        """初始化审计仪表板服务。

        Args:
            audit_log_repo: 审计日志仓储/DAO 实例，
                需提供 ``get_trend``, ``get_type_distribution``,
                ``get_operator_ranking`` 三个聚合查询方法。
        """
        self._repo = audit_log_repo

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    async def get_time_trend(
        self,
        start_time: Optional[datetime] = None,
        end_time: Optional[datetime] = None,
    ) -> List[dict]:
        """获取审计日志时间趋势聚合数据。

        根据查询跨度自动选择时间粒度：
        - ≤ 1 天 → 按小时聚合
        - ≤ 30 天 → 按天聚合
        - \> 30 天 → 按月聚合

        Args:
            start_time: 查询起始时间（含），为 None 时取默认值。
            end_time: 查询结束时间（含），为 None 时取当前时间。

        Returns:
            趋势数据点列表，每个元素包含 ``date``（时间标签）与
            ``count``（该时段日志数量）字段。

        Raises:
            BusinessError: 时间跨度超过 90 天上限时抛出。
        """
        start_time, end_time = self._resolve_time_range(start_time, end_time)
        self._validate_span(start_time, end_time)
        granularity = self._determine_granularity(start_time, end_time)

        rows = await self._repo.get_trend(
            start_time=start_time,
            end_time=end_time,
            granularity=granularity.value,
        )

        # 确保返回空结果时也是列表
        return rows if rows is not None else []

    async def get_type_distribution(
        self,
        start_time: Optional[datetime] = None,
        end_time: Optional[datetime] = None,
    ) -> List[dict]:
        """获取审计日志按操作类型的分布统计。

        Args:
            start_time: 查询起始时间（含），为 None 时取默认值。
            end_time: 查询结束时间（含），为 None 时取当前时间。

        Returns:
            按操作类型分组的计数值数组，每个元素包含
            ``operation_type`` 与 ``count`` 字段。

        Raises:
            BusinessError: 时间跨度超过 90 天上限时抛出。
        """
        start_time, end_time = self._resolve_time_range(start_time, end_time)
        self._validate_span(start_time, end_time)

        rows = await self._repo.get_type_distribution(
            start_time=start_time,
            end_time=end_time,
        )

        return rows if rows is not None else []

    async def get_operator_ranking(
        self,
        start_time: Optional[datetime] = None,
        end_time: Optional[datetime] = None,
        top: int = DEFAULT_OPERATOR_TOP_N,
    ) -> List[dict]:
        """获取操作人活跃度排名统计。

        Args:
            start_time: 查询起始时间（含），为 None 时取默认值。
            end_time: 查询结束时间（含），为 None 时取当前时间。
            top: 返回排名数量，默认 20，最大 50。

        Returns:
            按操作日志数量降序排列的操作人数组，每个元素包含
            ``operator_id``、``operator_name``（可选）与 ``count`` 字段。
            数组长度 ≤ ``top``。

        Raises:
            BusinessError: 时间跨度超过 90 天上限时抛出，
                或 ``top`` 参数超出允许范围时抛出。
        """
        start_time, end_time = self._resolve_time_range(start_time, end_time)
        self._validate_span(start_time, end_time)
        top = self._clamp_top_n(top)

        rows = await self._repo.get_operator_ranking(
            start_time=start_time,
            end_time=end_time,
            limit=top,
        )

        return rows if rows is not None else []

    # ------------------------------------------------------------------
    # Private helpers
    # ------------------------------------------------------------------

    @staticmethod
    def _resolve_time_range(
        start_time: Optional[datetime],
        end_time: Optional[datetime],
    ) -> tuple[datetime, datetime]:
        """解析并补全时间范围。

        若未指定 ``start_time``，则取当前时间减去默认跨度天数；
        若未指定 ``end_time``，则取当前时间。

        Args:
            start_time: 用户传入的起始时间。
            end_time: 用户传入的结束时间。

        Returns:
            元组 ``(start_time, end_time)``，均为 timezone-aware UTC 时间。
        """
        now = datetime.now(timezone.utc)

        if end_time is None:
            end_time = now
        else:
            # 确保 timezone-aware
            if end_time.tzinfo is None:
                end_time = end_time.replace(tzinfo=timezone.utc)

        if start_time is None:
            start_time = end_time - timedelta(days=DEFAULT_QUERY_SPAN_DAYS)
        else:
            if start_time.tzinfo is None:
                start_time = start_time.replace(tzinfo=timezone.utc)

        return start_time, end_time

    @staticmethod
    def _validate_span(start_time: datetime, end_time: datetime) -> None:
        """校验时间跨度是否超过上限。

        Args:
            start_time: 查询起始时间。
            end_time: 查询结束时间。

        Raises:
            BusinessError: 跨度超过 ``MAX_QUERY_SPAN_DAYS`` 时抛出，
                错误码为 ``TIME_RANGE_EXCEEDED``。
        """
        span_days = (end_time - start_time).total_seconds() / 86400.0
        if span_days > MAX_QUERY_SPAN_DAYS:
            raise BusinessError(
                code="TIME_RANGE_EXCEEDED",
                message=(
                    f"查询时间跨度 {span_days:.1f} 天超过上限 "
                    f"{MAX_QUERY_SPAN_DAYS} 天，请缩小查询范围。"
                ),
                status_code=400,
            )

    @staticmethod
    def _determine_granularity(
        start_time: datetime,
        end_time: datetime,
    ) -> TimeGranularity:
        """根据查询跨度自动选择时间粒度。

        规则:
        - 跨度 ≤ 1 天 → ``HOUR``
        - 跨度 ≤ 30 天 → ``DAY``
        - 跨度 \> 30 天 → ``MONTH``

        Args:
            start_time: 查询起始时间。
            end_time: 查询结束时间。

        Returns:
            适配的时间粒度枚举值。
        """
        span_days = (end_time - start_time).total_seconds() / 86400.0

        if span_days <= 1:
            return TimeGranularity.HOUR
        elif span_days <= 30:
            return TimeGranularity.DAY
        else:
            return TimeGranularity.MONTH

    @staticmethod
    def _clamp_top_n(top: int) -> int:
        """将 Top N 参数约束在合法范围内。

        Args:
            top: 用户请求的 Top N 值。

        Returns:
            被截断到 ``[1, MAX_OPERATOR_TOP_N]`` 范围内的整数值。

        Raises:
            BusinessError: ``top`` 小于 1 时抛出。
        """
        if top < 1:
            raise BusinessError(
                code="INVALID_TOP_N",
                message=f"top 参数必须 ≥ 1，当前值: {top}",
                status_code=400,
            )
        if top > MAX_OPERATOR_TOP_N:
            top = MAX_OPERATOR_TOP_N
        return top