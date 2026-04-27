"""
审计日志仪表板 API Schema 定义

本模块定义了审计数据聚合与仪表板支撑所需的全部 Pydantic 请求/响应模型，
涵盖时间趋势、操作类型分布及操作人活跃度三个核心聚合统计端点。

边界约束:
    - 查询时间跨度上限 90 天，超出返回 400 Bad Request
    - 未指定时间范围时默认查询最近 7 天
    - 时间粒度根据跨度自适应（≤1天按小时，≤30天按天，>30天按月）
    - 操作人活跃度默认 Top 20，最大 Top 50
"""

from __future__ import annotations

from datetime import datetime
from enum import Enum
from typing import List, Optional

from pydantic import BaseModel, Field, field_validator, model_validator


# ---------------------------------------------------------------------------
# 常量定义
# ---------------------------------------------------------------------------

"""查询时间跨度上限（天）"""
MAX_TIME_RANGE_DAYS: int = 90

"""默认查询时间跨度（天），当未指定时间范围时使用"""
DEFAULT_TIME_RANGE_DAYS: int = 7

"""操作人活跃度统计默认返回数量"""
DEFAULT_TOP_N: int = 20

"""操作人活跃度统计最大返回数量"""
MAX_TOP_N: int = 50


# ---------------------------------------------------------------------------
# 枚举类型
# ---------------------------------------------------------------------------

class TimeGranularity(str, Enum):
    """时间聚合粒度枚举。

    粒度由后端根据查询跨度自动决定，前端不可指定:
        - hour: 适用于跨度 ≤ 1 天
        - day:  适用于跨度 ≤ 30 天
        - month: 适用于跨度 > 30 天
    """

    HOUR = "hour"
    DAY = "day"
    MONTH = "month"


# ---------------------------------------------------------------------------
# 请求模型
# ---------------------------------------------------------------------------

class AuditDashboardTimeRangeQuery(BaseModel):
    """审计仪表板时间范围查询基础模型。

    提供通用的 start_time / end_time 参数及校验逻辑。
    所有仪表板端点的查询参数均继承或复用此模型。

    Attributes:
        start_time: 查询起始时间（ISO 8601 格式），可选，默认为当前时间减去 DEFAULT_TIME_RANGE_DAYS 天。
        end_time: 查询结束时间（ISO 8601 格式），可选，默认为当前时间。
    """

    start_time: Optional[datetime] = Field(
        default=None,
        description="查询起始时间 (ISO 8601)，默认为当前时间减去 7 天",
        examples=["2025-01-01T00:00:00Z"],
    )
    end_time: Optional[datetime] = Field(
        default=None,
        description="查询结束时间 (ISO 8601)，默认为当前时间",
        examples=["2025-01-08T00:00:00Z"],
    )

    @model_validator(mode="after")
    def validate_time_range(self) -> "AuditDashboardTimeRangeQuery":
        """校验时间范围的有效性。

        规则:
            1. 若 start_time 或 end_time 未指定，自动填充默认值（最近 DEFAULT_TIME_RANGE_DAYS 天）。
            2. start_time 不得晚于 end_time，否则抛出 ValueError。
            3. 时间跨度不得超过 MAX_TIME_RANGE_DAYS 天，否则抛出 ValueError。

        Returns:
            校验通过后的自身实例。

        Raises:
            ValueError: 时间范围无效或超出上限。
        """
        now = datetime.utcnow()

        if self.start_time is None:
            self.start_time = now.replace(
                hour=0, minute=0, second=0, microsecond=0
            ) - __import__("datetime").timedelta(days=DEFAULT_TIME_RANGE_DAYS)

        if self.end_time is None:
            self.end_time = now

        if self.start_time > self.end_time:
            raise ValueError(
                "start_time 不得晚于 end_time"
            )

        delta = (self.end_time - self.start_time).days
        if delta > MAX_TIME_RANGE_DAYS:
            raise ValueError(
                f"查询时间跨度 ({delta} 天) 超过上限 ({MAX_TIME_RANGE_DAYS} 天)，"
                f"请缩小查询范围"
            )

        return self


class AuditTrendQuery(AuditDashboardTimeRangeQuery):
    """时间趋势聚合查询参数。

    继承基础时间范围校验，用于 GET /api/v1/audit/dashboard/trend 端点。
    时间粒度由后端根据跨度自动决定，前端无需指定。

    Attributes:
        start_time: 查询起始时间。
        end_time: 查询结束时间。
    """

    pass


class AuditTypeDistributionQuery(AuditDashboardTimeRangeQuery):
    """操作类型分布聚合查询参数。

    继承基础时间范围校验，用于 GET /api/v1/audit/dashboard/distribution/type 端点。

    Attributes:
        start_time: 查询起始时间。
        end_time: 查询结束时间。
    """

    pass


class AuditOperatorDistributionQuery(AuditDashboardTimeRangeQuery):
    """操作人活跃度聚合查询参数。

    继承基础时间范围校验，并增加 top_n 参数控制返回数量。
    用于 GET /api/v1/audit/dashboard/distribution/operator 端点。

    Attributes:
        start_time: 查询起始时间。
        end_time: 查询结束时间。
        top_n: 返回最活跃操作人的数量，默认 DEFAULT_TOP_N，最大 MAX_TOP_N。
    """

    top_n: int = Field(
        default=DEFAULT_TOP_N,
        ge=1,
        le=MAX_TOP_N,
        description=f"返回最活跃操作人数量，默认 {DEFAULT_TOP_N}，最大 {MAX_TOP_N}",
        examples=[10, 20, 50],
    )


# ---------------------------------------------------------------------------
# 响应模型
# ---------------------------------------------------------------------------

class TrendDataPoint(BaseModel):
    """单个时间趋势数据点。

    每个数据点代表一个时间桶内的审计日志计数。

    Attributes:
        date: 时间桶标识，格式取决于粒度（hour: 'YYYY-MM-DDTHH:00', day: 'YYYY-MM-DD', month: 'YYYY-MM'）。
        count: 该时间桶内的审计日志数量。
    """

    date: str = Field(
        ...,
        description="时间桶标识，格式取决于粒度",
        examples=["2025-01-01", "2025-01-01T08:00", "2025-01"],
    )
    count: int = Field(
        ...,
        ge=0,
        description="该时间桶内的审计日志数量",
        examples=[42],
    )


class AuditTrendResponse(BaseModel):
    """时间趋势聚合响应。

    包含按时间粒度分组的审计日志计数序列。

    Attributes:
        granularity: 实际使用的时间粒度。
        data_points: 趋势数据点列表，按时间升序排列。
        total_count: 时间范围内的日志总数。
    """

    granularity: TimeGranularity = Field(
        ...,
        description="实际使用的时间聚合粒度",
    )
    data_points: List[TrendDataPoint] = Field(
        default_factory=list,
        description="趋势数据点列表，按时间升序排列",
    )
    total_count: int = Field(
        default=0,
        ge=0,
        description="时间范围内的审计日志总数",
    )


class TypeDistributionItem(BaseModel):
    """单个操作类型分布项。

    Attributes:
        operation_type: 操作类型标识。
        count: 该操作类型的日志数量。
    """

    operation_type: str = Field(
        ...,
        description="操作类型标识",
        examples=["CREATE", "UPDATE", "DELETE", "LOGIN"],
    )
    count: int = Field(
        ...,
        ge=0,
        description="该操作类型的日志数量",
        examples=[128],
    )


class AuditTypeDistributionResponse(BaseModel):
    """操作类型分布聚合响应。

    包含按操作类型分组的审计日志计数。

    Attributes:
        items: 操作类型分布项列表。
        total_count: 时间范围内的日志总数（所有 count 之和）。
    """

    items: List[TypeDistributionItem] = Field(
        default_factory=list,
        description="按操作类型分组的计数值数组",
    )
    total_count: int = Field(
        default=0,
        ge=0,
        description="时间范围内的审计日志总数",
    )


class OperatorActivityItem(BaseModel):
    """单个操作人活跃度项。

    Attributes:
        operator_id: 操作人唯一标识。
        operator_name: 操作人显示名称。
        count: 该操作人的日志数量。
    """

    operator_id: str = Field(
        ...,
        description="操作人唯一标识",
        examples=["user_001"],
    )
    operator_name: str = Field(
        ...,
        description="操作人显示名称",
        examples=["张三"],
    )
    count: int = Field(
        ...,
        ge=0,
        description="该操作人的审计日志数量",
        examples=[256],
    )


class AuditOperatorDistributionResponse(BaseModel):
    """操作人活跃度聚合响应。

    包含按操作人维度统计的最活跃用户列表，按 count 降序排列。

    Attributes:
        items: 操作人活跃度列表，按 count 降序排列，长度 ≤ top_n。
        total_count: 时间范围内的日志总数。
    """

    items: List[OperatorActivityItem] = Field(
        default_factory=list,
        description="操作人活跃度列表，按 count 降序排列",
    )
    total_count: int = Field(
        default=0,
        ge=0,
        description="时间范围内的审计日志总数",
    )


# ---------------------------------------------------------------------------
# 错误响应模型
# ---------------------------------------------------------------------------

class AuditDashboardErrorResponse(BaseModel):
    """审计仪表板错误响应模型。

    当请求参数校验失败或服务端处理异常时返回。

    Attributes:
        error_code: 机器可读的错误码。
        message: 人类可读的错误描述。
        details: 可选的附加错误详情。
    """

    error_code: str = Field(
        ...,
        description="机器可读的错误码",
        examples=["TIME_RANGE_EXCEEDED", "INVALID_TIME_RANGE"],
    )
    message: str = Field(
        ...,
        description="人类可读的错误描述",
        examples=["查询时间跨度 (91 天) 超过上限 (90 天)，请缩小查询范围"],
    )
    details: Optional[str] = Field(
        default=None,
        description="可选的附加错误详情",
    )