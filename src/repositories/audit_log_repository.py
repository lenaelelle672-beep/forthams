"""
Audit Log Repository — 审计日志数据访问层

提供审计日志的聚合统计查询能力，所有聚合计算均在数据库层完成，
禁止全量拉取至内存。支持以下三个核心聚合维度：

1. **时间趋势聚合**：按时间粒度（小时/天/月）统计日志数量
2. **操作类型分布**：按 operation_type 分组统计日志数量
3. **操作人活跃度**：按 operator_id 分组统计并排序

依赖索引：audit_log 表需具备 (created_at, operation_type, operator_id) 联合索引
或相应独立索引，以确保百万级数据量下聚合查询走索引。
"""

from __future__ import annotations

import logging
from datetime import datetime
from enum import Enum
from typing import Any, Dict, List, Optional, Sequence

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

logger = logging.getLogger(__name__)


class TimeGranularity(str, Enum):
    """时间粒度枚举，用于控制 DATE_TRUNC 的截断级别。

    Attributes:
        HOUR: 按小时截断，适用于 ≤1 天的查询跨度。
        DAY: 按天截断，适用于 ≤30 天的查询跨度。
        MONTH: 按月截断，适用于 >30 天的查询跨度。
    """

    HOUR = "hour"
    DAY = "day"
    MONTH = "month"


# ---------------------------------------------------------------------------
# PostgreSQL DATE_TRUNC 格式映射
# ---------------------------------------------------------------------------
_TRUNC_FORMAT_MAP: Dict[TimeGranularity, str] = {
    TimeGranularity.HOUR: "YYYY-MM-DD HH24:00:00",
    TimeGranularity.DAY: "YYYY-MM-DD",
    TimeGranularity.MONTH: "YYYY-MM-01",
}

# SQLAlchemy DATE_TRUNC 调用（PostgreSQL 原生）
_TRUNC_SQL_MAP: Dict[TimeGranularity, str] = {
    TimeGranularity.HOUR: "hour",
    TimeGranularity.DAY: "day",
    TimeGranularity.MONTH: "month",
}


class AuditLogRepository:
    """审计日志仓库，封装所有审计日志的聚合查询方法。

    所有方法均接受 AsyncSession 实例，在数据库层完成聚合计算，
    返回轻量的字典列表，避免 ORM 全表扫描。

    Args:
        session: SQLAlchemy 异步会话实例。
    """

    def __init__(self, session: AsyncSession) -> None:
        """初始化 AuditLogRepository。

        Args:
            session: SQLAlchemy 异步数据库会话。
        """
        self._session = session

    # ------------------------------------------------------------------
    # 公开聚合查询方法
    # ------------------------------------------------------------------

    async def get_trend(
        self,
        start_time: datetime,
        end_time: datetime,
        granularity: TimeGranularity = TimeGranularity.DAY,
    ) -> List[Dict[str, Any]]:
        """按时间粒度聚合审计日志趋势数据。

        使用 PostgreSQL ``DATE_TRUNC`` 在数据库层完成时间截断与分组，
        返回每个时间桶内的日志计数。

        Args:
            start_time: 查询起始时间（含）。
            end_time: 查询结束时间（含）。
            granularity: 时间粒度，决定 DATE_TRUNC 的截断级别。

        Returns:
            字典列表，每个字典包含 ``date``（时间桶标签）与 ``count``（计数）。
            按 ``date`` 升序排列。

        Example::

            results = await repo.get_trend(start, end, TimeGranularity.DAY)
            # [{'date': '2024-01-01', 'count': 42}, ...]
        """
        trunc_unit = _TRUNC_SQL_MAP[granularity]
        sql = text(
            f"""
            SELECT
                TO_CHAR(DATE_TRUNC(:trunc_unit, created_at), :fmt) AS date,
                COUNT(*) AS count
            FROM audit_log
            WHERE created_at >= :start_time
              AND created_at < :end_time
            GROUP BY DATE_TRUNC(:trunc_unit, created_at)
            ORDER BY date
            """
        )
        fmt = _TRUNC_FORMAT_MAP[granularity]
        params: Dict[str, Any] = {
            "trunc_unit": trunc_unit,
            "fmt": fmt,
            "start_time": start_time,
            "end_time": end_time,
        }
        rows: Sequence[Any] = await self._session.execute(sql, params)
        return [dict(row._mapping) for row in rows]

    async def get_type_distribution(
        self,
        start_time: datetime,
        end_time: datetime,
    ) -> List[Dict[str, Any]]:
        """按操作类型聚合审计日志分布数据。

        在数据库层对 ``operation_type`` 字段执行 ``GROUP BY`` 聚合，
        返回每种操作类型的日志计数。

        Args:
            start_time: 查询起始时间（含）。
            end_time: 查询结束时间（含）。

        Returns:
            字典列表，每个字典包含 ``operation_type`` 与 ``count``。
            按 ``count`` 降序排列。

        Example::

            results = await repo.get_type_distribution(start, end)
            # [{'operation_type': 'CREATE', 'count': 120}, ...]
        """
        sql = text(
            """
            SELECT
                operation_type,
                COUNT(*) AS count
            FROM audit_log
            WHERE created_at >= :start_time
              AND created_at < :end_time
            GROUP BY operation_type
            ORDER BY count DESC
            """
        )
        params: Dict[str, Any] = {
            "start_time": start_time,
            "end_time": end_time,
        }
        rows: Sequence[Any] = await self._session.execute(sql, params)
        return [dict(row._mapping) for row in rows]

    async def get_operator_activity(
        self,
        start_time: datetime,
        end_time: datetime,
        top_n: int = 20,
    ) -> List[Dict[str, Any]]:
        """按操作人聚合审计日志活跃度排名。

        在数据库层对 ``operator_id`` 字段执行 ``GROUP BY`` 聚合，
        并按计数降序排列，截取 Top N 结果。

        Args:
            start_time: 查询起始时间（含）。
            end_time: 查询结束时间（含）。
            top_n: 返回的最大操作人数量，默认 20，最大 50。

        Returns:
            字典列表，每个字典包含 ``operator_id`` 与 ``count``。
            按 ``count`` 降序排列，长度 ≤ ``top_n``。

        Example::

            results = await repo.get_operator_activity(start, end, top_n=10)
            # [{'operator_id': 'user_001', 'count': 88}, ...]
        """
        # 强制限制 top_n 上限为 50
        safe_top_n = min(max(1, top_n), 50)
        sql = text(
            """
            SELECT
                operator_id,
                COUNT(*) AS count
            FROM audit_log
            WHERE created_at >= :start_time
              AND created_at < :end_time
            GROUP BY operator_id
            ORDER BY count DESC
            LIMIT :limit
            """
        )
        params: Dict[str, Any] = {
            "start_time": start_time,
            "end_time": end_time,
            "limit": safe_top_n,
        }
        rows: Sequence[Any] = await self._session.execute(sql, params)
        return [dict(row._mapping) for row in rows]