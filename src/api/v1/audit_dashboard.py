"""
Audit Dashboard API Controller

审计数据聚合与仪表板支撑控制器，提供时间趋势、操作类型分布及操作人活跃度统计 API 端点。

所有端点均为只读 GET 方法，聚合查询在数据库层完成以确保百万级数据量下的查询性能。
时间跨度上限强制为 90 天，超出返回 400 Bad Request；未指定时间范围时默认查询最近 7 天。
时间粒度根据跨度自动降级：≤1 天按小时，≤30 天按天，>30 天按月。
操作人活跃度统计默认返回 Top 20，最大支持 Top 50。
"""

from datetime import datetime, timedelta, timezone
from typing import AsyncGenerator, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

# ─── 常量定义 ───────────────────────────────────────────────────────────

MAX_TIME_RANGE_DAYS: int = 90
"""查询时间跨度上限（天）"""

DEFAULT_TIME_RANGE_DAYS: int = 7
"""默认查询时间跨度（天）"""

DEFAULT_TOP_N: int = 20
"""操作人活跃度统计默认返回数量"""

MAX_TOP_N: int = 50
"""操作人活跃度统计最大返回数量"""


# ─── 数据库会话依赖 ─────────────────────────────────────────────────────

try:
    from src.api.dependencies.db import get_db as _injected_get_db

    async def get_db() -> AsyncGenerator[AsyncSession, None]:
        """数据库会话依赖，从项目标准位置导入。"""
        async for session in _injected_get_db():
            yield session

except ImportError:
    async def get_db() -> AsyncGenerator[AsyncSession, None]:
        """
        数据库会话依赖占位实现。

        当 src.api.dependencies.db 不可用时提供占位。
        测试时通过 FastAPI dependency_overrides 注入测试会话。
        """
        raise NotImplementedError(
            "数据库依赖未配置，请通过 dependency_overrides 注入测试会话"
        )


# ─── 路由器 ─────────────────────────────────────────────────────────────

router = APIRouter(prefix="/api/v1/audit/dashboard", tags=["audit-dashboard"])


# ─── 响应模型 ───────────────────────────────────────────────────────────

class TrendDataPoint(BaseModel):
    """时间趋势数据点，包含时间标签与对应操作次数。"""

    date: str = Field(..., description="时间标签（格式取决于粒度：hour→YYYY-MM-DD HH:00, day→YYYY-MM-DD, month→YYYY-MM-01）")
    count: int = Field(..., description="该时间段的操作次数")


class TrendResponse(BaseModel):
    """时间趋势聚合响应，包含粒度信息与数据点列表。"""

    granularity: str = Field(..., description="时间粒度: hour / day / month")
    data: List[TrendDataPoint] = Field(default_factory=list, description="趋势数据点列表")


class TypeDistributionItem(BaseModel):
    """操作类型分布统计项，包含操作类型名称与对应日志计数。"""

    operation_type: str = Field(..., description="操作类型")
    count: int = Field(..., description="该类型的操作次数")


class TypeDistributionResponse(BaseModel):
    """操作类型分布响应，返回按操作类型分组的计数值数组。"""

    data: List[TypeDistributionItem] = Field(default_factory=list, description="按操作类型分组的统计数组")


class OperatorActivityItem(BaseModel):
    """操作人活跃度统计项，包含操作人标识与操作次数。"""

    operator_id: str = Field(..., description="操作人ID")
    operator_name: Optional[str] = Field(None, description="操作人姓名")
    count: int = Field(..., description="操作次数")


class OperatorActivityResponse(BaseModel):
    """操作人活跃度响应，返回按操作次数降序排列的操作人排名列表。"""

    data: List[OperatorActivityItem] = Field(default_factory=list, description="操作人活跃度排名列表")


# ─── 内部辅助函数 ───────────────────────────────────────────────────────

def _validate_time_range(
    start_time: Optional[datetime],
    end_time: Optional[datetime],
) -> tuple:
    """
    校验并填充时间范围参数。

    若未指定时间范围，默认查询最近 DEFAULT_TIME_RANGE_DAYS 天。
    时间跨度超过 MAX_TIME_RANGE_DAYS 天则抛出 HTTP 400 异常。

    Args:
        start_time: 查询起始时间（可选，ISO 8601 格式）
        end_time: 查询结束时间（可选，ISO 8601 格式）

    Returns:
        (start_time, end_time) 元组，均为 timezone-aware 的 datetime 对象

    Raises:
        HTTPException: 时间跨度超过 90 天时返回 400 Bad Request，
                       响应体包含 error_code 与 message 字段
    """
    now = datetime.now(timezone.utc)

    if end_time is None:
        end_time = now
    if start_time is None:
        start_time = end_time - timedelta(days=DEFAULT_TIME_RANGE_DAYS)

    # 确保 timezone-aware
    if start_time.tzinfo is None:
        start_time = start_time.replace(tzinfo=timezone.utc)
    if end_time.tzinfo is None:
        end_time = end_time.replace(tzinfo=timezone.utc)

    # 校验时间跨度
    range_days = (end_time - start_time).days
    if range_days > MAX_TIME_RANGE_DAYS:
        raise HTTPException(
            status_code=400,
            detail={
                "error_code": "TIME_RANGE_EXCEEDED",
                "message": (
                    f"查询时间跨度不能超过 {MAX_TIME_RANGE_DAYS} 天，"
                    f"当前跨度为 {range_days} 天"
                ),
            },
        )

    return start_time, end_time


def _determine_granularity(start_time: datetime, end_time: datetime) -> str:
    """
    根据时间跨度自动确定聚合粒度。

    规则：
    - ≤ 1 天 → hour（按小时）
    - ≤ 30 天 → day（按天）
    - > 30 天 → month（按月）

    前端不可指定粒度，由后端根据跨度自动降级。

    Args:
        start_time: 起始时间
        end_time: 结束时间

    Returns:
        粒度字符串: "hour" / "day" / "month"
    """
    delta_days = (end_time - start_time).days
    if delta_days <= 1:
        return "hour"
    elif delta_days <= 30:
        return "day"
    return "month"


def _generate_time_buckets(
    start_time: datetime,
    end_time: datetime,
    granularity: str,
) -> List[str]:
    """
    生成给定时间范围内所有时间桶标签。

    用于确保即使某些时间段无数据，也会返回 count=0 的数据点，
    满足空数据集边缘测试要求（ATB-005）。

    Args:
        start_time: 起始时间
        end_time: 结束时间
        granularity: 时间粒度 ("hour" / "day" / "month")

    Returns:
        时间桶标签字符串列表
    """
    buckets: List[str] = []
    # 统一转为 naive datetime 以简化日期运算
    current = start_time.replace(tzinfo=None) if start_time.tzinfo else start_time
    end_naive = end_time.replace(tzinfo=None) if end_time.tzinfo else end_time

    if granularity == "hour":
        while current < end_naive:
            buckets.append(current.strftime("%Y-%m-%d %H:00"))
            current += timedelta(hours=1)
    elif granularity == "day":
        while current < end_naive:
            buckets.append(current.strftime("%Y-%m-%d"))
            current += timedelta(days=1)
    elif granularity == "month":
        while current < end_naive:
            buckets.append(current.strftime("%Y-%m-01"))
            if current.month == 12:
                current = current.replace(year=current.year + 1, month=1, day=1)
            else:
                current = current.replace(month=current.month + 1, day=1)

    return buckets


def _format_db_date(dt, granularity: str) -> str:
    """
    将数据库返回的日期时间格式化为与时间桶一致的标签字符串。

    Args:
        dt: 数据库返回的日期时间对象
        granularity: 时间粒度

    Returns:
        格式化后的字符串
    """
    if granularity == "hour":
        return dt.strftime("%Y-%m-%d %H:00")
    elif granularity == "day":
        return dt.strftime("%Y-%m-%d")
    elif granularity == "month":
        return dt.strftime("%Y-%m-01")
    return dt.strftime("%Y-%m-%d")


# ─── SQL 构建函数 ───────────────────────────────────────────────────────

def _build_trend_sql(granularity: str) -> str:
    """
    根据粒度构建时间趋势聚合 SQL。

    使用 DATE_TRUNC 函数在数据库层完成时间截断与 GROUP BY 聚合，
    确保百万级数据量下的查询性能（禁止全量拉取至内存计算）。

    Args:
        granularity: 时间粒度 ("hour" / "day" / "month")

    Returns:
        SQL 查询字符串
    """
    trunc_map = {"hour": "hour", "day": "day", "month": "month"}
    trunc_unit = trunc_map.get(granularity, "day")
    return f"""
        SELECT DATE_TRUNC('{trunc_unit}', created_at) AS date, COUNT(*) AS count
        FROM audit_log
        WHERE created_at >= :start_time AND created_at < :end_time
        GROUP BY DATE_TRUNC('{trunc_unit}', created_at)
        ORDER BY date
    """


def _build_type_distribution_sql() -> str:
    """
    构建操作类型分布聚合 SQL。

    在数据库层按 operation_type 分组统计，返回结果按 count 降序排列。

    Returns:
        SQL 查询字符串
    """
    return """
        SELECT operation_type, COUNT(*) AS count
        FROM audit_log
        WHERE created_at >= :start_time AND created_at < :end_time
        GROUP BY operation_type
        ORDER BY count DESC
    """


def _build_operator_activity_sql() -> str:
    """
    构建操作人活跃度聚合 SQL。

    在数据库层按 operator_id 分组统计，返回结果按 count 降序排列，
    通过 LIMIT 子句在数据库层截断 Top N 结果。

    Returns:
        SQL 查询字符串
    """
    return """
        SELECT operator_id, COUNT(*) AS count
        FROM audit_log
        WHERE created_at >= :start_time AND created_at < :end_time
        GROUP BY operator_id
        ORDER BY count DESC
        LIMIT :top_n
    """


# ─── API 端点 ───────────────────────────────────────────────────────────

@router.get("/trend", response_model=TrendResponse)
async def get_audit_trend(
    start_time: Optional[datetime] = Query(None, description="查询起始时间 (ISO 8601)"),
    end_time: Optional[datetime] = Query(None, description="查询结束时间 (ISO 8601)"),
    db: AsyncSession = Depends(get_db),
) -> TrendResponse:
    """
    获取审计日志时间趋势聚合数据。

    时间粒度根据查询跨度自动降级：
    - ≤ 1 天：按小时聚合
    - ≤ 30 天：按天聚合
    - > 30 天：按月聚合

    时间跨度上限为 90 天，超出返回 400 错误。
    未指定时间范围时默认查询最近 7 天。

    聚合查询在数据库层通过 DATE_TRUNC + GROUP BY 完成，
    即使某些时间段无数据也会返回 count=0 的数据点。
    """
    start, end = _validate_time_range(start_time, end_time)
    granularity = _determine_granularity(start, end)

    # 生成完整时间桶（确保空数据集也返回 count=0 的数据点，满足 ATB-005）
    buckets = _generate_time_buckets(start, end, granularity)

    # 执行数据库聚合查询
    sql = _build_trend_sql(granularity)
    result = await db.execute(text(sql), {"start_time": start, "end_time": end})
    rows = result.fetchall()

    # 将数据库结果映射到时间桶
    db_counts: dict = {}
    for row in rows:
        label = _format_db_date(row.date, granularity)
        db_counts[label] = row.count

    # 构建最终数据点列表，无数据的桶填充 count=0
    data_points = [
        TrendDataPoint(date=bucket, count=db_counts.get(bucket, 0))
        for bucket in buckets
    ]

    return TrendResponse(granularity=granularity, data=data_points)


@router.get("/distribution/type", response_model=TypeDistributionResponse)
async def get_type_distribution(
    start_time: Optional[datetime] = Query(None, description="查询起始时间 (ISO 8601)"),
    end_time: Optional[datetime] = Query(None, description="查询结束时间 (ISO 8601)"),
    db: AsyncSession = Depends(get_db),
) -> TypeDistributionResponse:
    """
    获取操作类型分布统计数据。

    返回按操作类型分组的日志计数值数组，
    所有返回项的 count 总和等于该时间范围内的日志总数。
    无数据时返回空数组。

    聚合查询在数据库层通过 GROUP BY operation_type 完成。
    """
    start, end = _validate_time_range(start_time, end_time)

    sql = _build_type_distribution_sql()
    result = await db.execute(text(sql), {"start_time": start, "end_time": end})
    rows = result.fetchall()

    data = [
        TypeDistributionItem(operation_type=row.operation_type, count=row.count)
        for row in rows
    ]

    return TypeDistributionResponse(data=data)


@router.get("/distribution/operator", response_model=OperatorActivityResponse)
async def get_operator_activity(
    start_time: Optional[datetime] = Query(None, description="查询起始时间 (ISO 8601)"),
    end_time: Optional[datetime] = Query(None, description="查询结束时间 (ISO 8601)"),
    top: int = Query(
        DEFAULT_TOP_N,
        ge=1,
        le=MAX_TOP_N,
        description=f"返回 Top N 操作人 (1-{MAX_TOP_N}，默认 {DEFAULT_TOP_N})",
    ),
    db: AsyncSession = Depends(get_db),
) -> OperatorActivityResponse:
    """
    获取操作人活跃度统计数据。

    返回按操作次数降序排列的操作人排名列表。
    默认返回 Top 20，最大支持 Top 50，避免返回超大集合。
    无数据时返回空数组。

    聚合查询在数据库层通过 GROUP BY operator_id + ORDER BY + LIMIT 完成。
    """
    start, end = _validate_time_range(start_time, end_time)

    sql = _build_operator_activity_sql()
    result = await db.execute(
        text(sql),
        {"start_time": start, "end_time": end, "top_n": top},
    )
    rows = result.fetchall()

    data = [
        OperatorActivityItem(operator_id=row.operator_id, count=row.count)
        for row in rows
    ]

    return OperatorActivityResponse(data=data)