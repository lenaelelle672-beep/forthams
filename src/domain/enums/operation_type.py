"""操作类型枚举模块。

本模块定义了审计日志系统中所有可追踪的操作类型枚举。
操作类型枚举由后端统一下发（/api/v1/audit-log/meta），
前端禁止硬编码，需动态渲染筛选项。

枚举值用于：
- 审计日志列表查询接口的多维筛选（action_type 参数）
- 审计日志趋势聚合接口的分类统计
- 前端仪表板筛选器的动态渲染
"""

from enum import Enum


class OperationType(str, Enum):
    """操作类型枚举。

    定义系统中所有可被审计追踪的操作类型。继承 str 与 Enum，
    确保枚举值可直接序列化为 JSON 字符串，便于 API 交互与前端渲染。

    Attributes:
        LOGIN: 用户登录操作。
        LOGOUT: 用户登出操作。
        CREATE: 资源创建操作。
        READ: 资源读取/查看操作。
        UPDATE: 资源更新操作。
        DELETE: 资源删除操作。
        EXPORT: 数据导出操作。
        IMPORT: 数据导入操作。
        APPROVE: 审批通过操作。
        REJECT: 审批驳回操作。
        TRANSFER: 资产调拨/转移操作。
        RETIRE: 资产退役操作。
        ASSIGN: 资产分配操作。
        SCRAP: 资产报废操作。
    """

    LOGIN = "LOGIN"
    """用户登录操作。"""

    LOGOUT = "LOGOUT"
    """用户登出操作。"""

    CREATE = "CREATE"
    """资源创建操作。"""

    READ = "READ"
    """资源读取/查看操作。"""

    UPDATE = "UPDATE"
    """资源更新操作。"""

    DELETE = "DELETE"
    """资源删除操作。"""

    EXPORT = "EXPORT"
    """数据导出操作。"""

    IMPORT = "IMPORT"
    """数据导入操作。"""

    APPROVE = "APPROVE"
    """审批通过操作。"""

    REJECT = "REJECT"
    """审批驳回操作。"""

    TRANSFER = "TRANSFER"
    """资产调拨/转移操作。"""

    RETIRE = "RETIRE"
    """资产退役操作。"""

    ASSIGN = "ASSIGN"
    """资产分配操作。"""

    SCRAP = "SCRAP"
    """资产报废操作。"""


def get_all_operation_types() -> list[dict[str, str]]:
    """获取所有操作类型枚举的元数据列表。

    返回适用于 /api/v1/audit-log/meta 接口的操作类型元数据，
    供前端动态渲染筛选下拉框使用。

    Returns:
        list[dict[str, str]]: 操作类型元数据列表，
            每个元素包含 value（枚举值）与 label（中文描述）。
    """
    return [
        {"value": op.value, "label": _OPERATION_TYPE_LABELS[op]}
        for op in OperationType
    ]


# 操作类型中文标签映射，用于前端展示。
_OPERATION_TYPE_LABELS: dict[OperationType, str] = {
    OperationType.LOGIN: "登录",
    OperationType.LOGOUT: "登出",
    OperationType.CREATE: "创建",
    OperationType.READ: "查看",
    OperationType.UPDATE: "更新",
    OperationType.DELETE: "删除",
    OperationType.EXPORT: "导出",
    OperationType.IMPORT: "导入",
    OperationType.APPROVE: "审批通过",
    OperationType.REJECT: "审批驳回",
    OperationType.TRANSFER: "调拨",
    OperationType.RETIRE: "退役",
    OperationType.ASSIGN: "分配",
    OperationType.SCRAP: "报废",
}