"""
核心异常定义模块

提供系统级基础异常类及审计仪表板（Audit Dashboard）相关的业务异常。
所有异常均携带结构化的 error_code 与 detail 信息，便于 API 层统一拦截
并映射为对应的 HTTP 状态码。
"""

from __future__ import annotations

from typing import Any, Dict, Optional


# ---------------------------------------------------------------------------
# 基础异常体系
# ---------------------------------------------------------------------------

class BaseAppError(Exception):
    """所有应用级异常的基类。

    Attributes:
        error_code: 机器可读的错误标识符，格式为 ``MODULE_SPECIFIC_CODE``。
        detail: 面向开发者的错误详情。
        status_code: 建议映射的 HTTP 状态码，子类可覆盖。
    """

    error_code: str = "INTERNAL_ERROR"
    detail: str = "An unexpected error occurred."
    status_code: int = 500

    def __init__(
        self,
        detail: Optional[str] = None,
        error_code: Optional[str] = None,
        status_code: Optional[int] = None,
        extra: Optional[Dict[str, Any]] = None,
    ) -> None:
        if detail is not None:
            self.detail = detail
        if error_code is not None:
            self.error_code = error_code
        if status_code is not None:
            self.status_code = status_code
        self.extra = extra or {}
        super().__init__(self.detail)

    def to_dict(self) -> Dict[str, Any]:
        """将异常序列化为字典，供 API 响应体使用。"""
        result: Dict[str, Any] = {
            "error_code": self.error_code,
            "detail": self.detail,
        }
        if self.extra:
            result["extra"] = self.extra
        return result


class NotFoundError(BaseAppError):
    """资源未找到异常（HTTP 404）。"""

    error_code = "RESOURCE_NOT_FOUND"
    detail = "The requested resource was not found."
    status_code = 404


class PermissionDeniedError(BaseAppError):
    """权限不足异常（HTTP 403）。"""

    error_code = "PERMISSION_DENIED"
    detail = "You do not have permission to perform this action."
    status_code = 403


class ValidationError(BaseAppError):
    """请求参数校验失败异常（HTTP 422）。

    Attributes:
        field: 出错的字段名（可选）。
    """

    error_code = "VALIDATION_ERROR"
    detail = "Request validation failed."
    status_code = 422

    def __init__(
        self,
        detail: Optional[str] = None,
        field: Optional[str] = None,
        **kwargs: Any,
    ) -> None:
        self.field = field
        extra = kwargs.pop("extra", None) or {}
        if field:
            extra["field"] = field
        super().__init__(detail=detail, extra=extra, **kwargs)


# ---------------------------------------------------------------------------
# 审计仪表板（Audit Dashboard）异常
# ---------------------------------------------------------------------------

class AuditDashboardError(BaseAppError):
    """审计仪表板模块异常基类。

    所有审计仪表板相关的业务异常均继承此类，便于统一拦截与日志记录。
    默认映射为 HTTP 500，子类按需覆盖。
    """

    error_code = "AUDIT_DASHBOARD_ERROR"
    detail = "An error occurred in the audit dashboard service."
    status_code = 500


class TimeRangeExceededError(AuditDashboardError):
    """查询时间跨度超出上限异常（HTTP 400）。

    当请求的时间范围超过系统允许的最大跨度（90 天）时抛出。
    对应 ATB-004 验收测试基准。

    Attributes:
        max_days: 系统允许的最大查询天数。
        requested_days: 实际请求的查询天数。
    """

    error_code = "AUDIT_TIME_RANGE_EXCEEDED"
    detail = "The requested time range exceeds the maximum allowed span."
    status_code = 400

    def __init__(
        self,
        max_days: int = 90,
        requested_days: Optional[int] = None,
        **kwargs: Any,
    ) -> None:
        self.max_days = max_days
        self.requested_days = requested_days
        extra = kwargs.pop("extra", None) or {}
        extra["max_days"] = max_days
        if requested_days is not None:
            extra["requested_days"] = requested_days
        detail = (
            f"查询时间跨度超出上限：最大允许 {max_days} 天"
            + (f"，请求跨度为 {requested_days} 天" if requested_days else "")
            + "。请缩小查询范围后重试。"
        )
        super().__init__(detail=detail, extra=extra, **kwargs)


class InvalidTimeRangeError(AuditDashboardError):
    """无效的时间范围参数异常（HTTP 400）。

    当 start_time / end_time 缺失、格式错误或 start_time > end_time 时抛出。

    Attributes:
        reason: 具体的无效原因描述。
    """

    error_code = "AUDIT_INVALID_TIME_RANGE"
    detail = "The provided time range parameters are invalid."
    status_code = 400

    def __init__(
        self,
        reason: str = "start_time must be earlier than end_time",
        **kwargs: Any,
    ) -> None:
        self.reason = reason
        extra = kwargs.pop("extra", None) or {}
        extra["reason"] = reason
        detail = f"无效的时间范围参数：{reason}"
        super().__init__(detail=detail, extra=extra, **kwargs)


class TopNLimitExceededError(AuditDashboardError):
    """Top N 查询数量超出上限异常（HTTP 400）。

    当操作人活跃度统计请求的 top 参数超过系统允许的最大值（50）时抛出。

    Attributes:
        max_limit: 系统允许的最大 Top N 值。
        requested_limit: 实际请求的 Top N 值。
    """

    error_code = "AUDIT_TOP_N_LIMIT_EXCEEDED"
    detail = "The requested top N limit exceeds the maximum allowed value."
    status_code = 400

    def __init__(
        self,
        max_limit: int = 50,
        requested_limit: Optional[int] = None,
        **kwargs: Any,
    ) -> None:
        self.max_limit = max_limit
        self.requested_limit = requested_limit
        extra = kwargs.pop("extra", None) or {}
        extra["max_limit"] = max_limit
        if requested_limit is not None:
            extra["requested_limit"] = requested_limit
        detail = (
            f"Top N 查询数量超出上限：最大允许 {max_limit}"
            + (f"，请求值为 {requested_limit}" if requested_limit else "")
            + "。请减小 top 参数后重试。"
        )
        super().__init__(detail=detail, extra=extra, **kwargs)


class AuditQueryError(AuditDashboardError):
    """审计聚合查询执行异常（HTTP 500）。

    当数据库聚合查询执行失败（如索引缺失、连接超时等）时抛出。
    用于将底层数据库异常包装为业务友好的错误信息。

    Attributes:
        query_type: 出错的查询类型标识（如 ``trend``, ``type_distribution``, ``operator_ranking``）。
    """

    error_code = "AUDIT_QUERY_ERROR"
    detail = "Failed to execute audit aggregation query."
    status_code = 500

    def __init__(
        self,
        query_type: str = "unknown",
        original_error: Optional[Exception] = None,
        **kwargs: Any,
    ) -> None:
        self.query_type = query_type
        self.original_error = original_error
        extra = kwargs.pop("extra", None) or {}
        extra["query_type"] = query_type
        if original_error is not None:
            extra["original_error"] = str(original_error)
        detail = f"审计聚合查询执行失败（查询类型: {query_type}）。"
        super().__init__(detail=detail, extra=extra, **kwargs)


class AuditIndexMissingError(AuditDashboardError):
    """审计日志表索引缺失异常（HTTP 500）。

    当检测到 ``audit_log`` 表缺少必要的联合索引时抛出，
    提示运维人员补充索引以满足聚合查询性能要求。

    Attributes:
        missing_indexes: 缺失的索引描述列表。
    """

    error_code = "AUDIT_INDEX_MISSING"
    detail = "Required database indexes are missing for audit log table."
    status_code = 500

    def __init__(
        self,
        missing_indexes: Optional[list[str]] = None,
        **kwargs: Any,
    ) -> None:
        self.missing_indexes = missing_indexes or []
        extra = kwargs.pop("extra", None) or {}
        extra["missing_indexes"] = self.missing_indexes
        indexes_str = "、".join(self.missing_indexes) if self.missing_indexes else "未知"
        detail = (
            f"审计日志表缺少必要的数据库索引：{indexes_str}。"
            "请确认 (created_at, operation_type, operator_id) 索引已创建。"
        )
        super().__init__(detail=detail, extra=extra, **kwargs)