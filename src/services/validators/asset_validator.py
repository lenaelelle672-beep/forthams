"""
资产验证器模块

提供资产状态流转相关的验证逻辑，包括：
- 合法状态迁移路径验证
- 报废申请参数验证
- 审批链权限校验
- 历史记录查询参数验证

该模块是状态流转引擎的守卫层，确保所有状态变更满足业务约束。
"""

from typing import Optional, List, Dict, Any, Tuple
from enum import Enum
from dataclasses import dataclass
from datetime import datetime


class AssetStatus(str, Enum):
    """资产状态枚举"""
    IN_USE = "in_use"           # 在用
    IDLE = "idle"               # 闲置
    MAINTENANCE = "maintenance"  # 维修中
    RETIRED = "retired"         # 已退役
    SCRAPPED = "scrapped"       # 已报废
    PENDING_RETIREMENT = "pending_retirement"  # 待退役审批
    PENDING_SCRAP = "pending_scrap"           # 待报废审批


class RetirementStatus(str, Enum):
    """退役申请状态枚举"""
    PENDING = "pending"          # 待审批
    APPROVED = "approved"        # 已批准
    REJECTED = "rejected"        # 已拒绝
    CANCELLED = "cancelled"      # 已取消


# 定义合法的状态迁移路径
VALID_TRANSITIONS: Dict[str, List[str]] = {
    AssetStatus.IN_USE: [
        AssetStatus.IDLE,
        AssetStatus.MAINTENANCE,
        AssetStatus.PENDING_RETIREMENT,
        AssetStatus.PENDING_SCRAP
    ],
    AssetStatus.IDLE: [
        AssetStatus.IN_USE,
        AssetStatus.PENDING_RETIREMENT,
        AssetStatus.PENDING_SCRAP
    ],
    AssetStatus.MAINTENANCE: [
        AssetStatus.IN_USE,
        AssetStatus.IDLE,
        AssetStatus.PENDING_RETIREMENT
    ],
    AssetStatus.PENDING_RETIREMENT: [
        AssetStatus.RETIRED,
        AssetStatus.IN_USE,  # 审批拒绝回退
        AssetStatus.REJECTED
    ],
    AssetStatus.PENDING_SCRAP: [
        AssetStatus.SCRAPPED,
        AssetStatus.IN_USE,  # 审批拒绝回退
        AssetStatus.REJECTED
    ],
    AssetStatus.RETIRED: [],  # 终态，不可迁移
    AssetStatus.SCRAPPED: [],  # 终态，不可迁移
}

# 定义不可直接退役/报废的资产状态
PROTECTED_STATES: List[str] = [
    AssetStatus.PENDING_RETIREMENT,
    AssetStatus.PENDING_SCRAP,
]


@dataclass
class ValidationResult:
    """验证结果数据类"""
    is_valid: bool
    error_code: Optional[str] = None
    error_message: Optional[str] = None
    details: Optional[Dict[str, Any]] = None

    def __post_init__(self):
        if self.details is None:
            self.details = {}

    @property
    def to_dict(self) -> Dict[str, Any]:
        """转换为字典格式"""
        result = {
            "is_valid": self.is_valid,
        }
        if self.error_code:
            result["error_code"] = self.error_code
        if self.error_message:
            result["error_message"] = self.error_message
        if self.details:
            result["details"] = self.details
        return result


@dataclass
class TransitionContext:
    """状态迁移上下文"""
    asset_id: str
    current_status: str
    target_status: str
    user_id: str
    reason: Optional[str] = None
    metadata: Optional[Dict[str, Any]] = None
    timestamp: Optional[datetime] = None

    def __post_init__(self):
        if self.timestamp is None:
            self.timestamp = datetime.utcnow()
        if self.metadata is None:
            self.metadata = {}


@dataclass
class RetirementApplication:
    """退役申请数据类"""
    asset_id: str
    applicant_id: str
    reason: str
    target_status: str = AssetStatus.RETIRED.value
    expected_completion_date: Optional[datetime] = None
    attachments: Optional[List[str]] = None

    def __post_init__(self):
        if self.attachments is None:
            self.attachments = []


class AssetValidator:
    """
    资产验证器类

    提供资产相关的验证方法，包括状态迁移验证、报废申请验证等。
    """

    def __init__(self, config: Optional[Dict[str, Any]] = None):
        """
        初始化资产验证器

        Args:
            config: 可选的配置字典，用于自定义验证规则
        """
        self.config = config or {}
        self.valid_transitions = self.config.get("valid_transitions", VALID_TRANSITIONS)
        self.protected_states = self.config.get("protected_states", PROTECTED_STATES)

    def validate_state_transition(
        self,
        current_status: str,
        target_status: str,
        context: Optional[TransitionContext] = None
    ) -> ValidationResult:
        """
        验证状态迁移是否合法

        Args:
            current_status: 当前状态
            target_status: 目标状态
            context: 可选的迁移上下文

        Returns:
            ValidationResult: 验证结果

        验证规则：
            1. 状态迁移必须在有效路径中定义
            2. 终态资产不可再迁移（已退役/已报废）
            3. 审批拒绝时允许回退到原状态
            4. 迁移上下文需提供必要的元数据
        """
        # 检查状态是否为有效枚举值
        try:
            current = AssetStatus(current_status)
            target = AssetStatus(target_status)
        except ValueError:
            return ValidationResult(
                is_valid=False,
                error_code="INVALID_STATUS",
                error_message=f"无效的状态值: current={current_status}, target={target_status}",
                details={"current_status": current_status, "target_status": target_status}
            )

        # 检查是否在保护状态中
        if current_status in self.protected_states:
            return ValidationResult(
                is_valid=False,
                error_code="PROTECTED_STATE",
                error_message=f"资产当前处于保护状态 '{current_status}'，需要完成审批流程后才能迁移",
                details={"current_status": current_status, "protected_states": self.protected_states}
            )

        # 检查目标状态是否为终态且存在回退意图
        if target_status in [AssetStatus.RETIRED.value, AssetStatus.SCRAPPED.value]:
            if context and context.reason and "驳回" in context.reason:
                # 驳回情况下的回退是合法的
                pass
            elif current_status not in [AssetStatus.PENDING_RETIREMENT.value, AssetStatus.PENDING_SCRAP.value]:
                return ValidationResult(
                    is_valid=False,
                    error_code="INVALID_TRANSITION",
                    error_message=f"资产必须经过审批流程才能进入终态",
                    details={"current_status": current_status, "target_status": target_status}
                )

        # 检查迁移路径是否合法
        allowed_targets = self.valid_transitions.get(current_status, [])
        if target_status not in allowed_targets:
            return ValidationResult(
                is_valid=False,
                error_code="TRANSITION_NOT_ALLOWED",
                error_message=f"状态 '{current_status}' 不允许迁移到 '{target_status}'",
                details={
                    "current_status": current_status,
                    "target_status": target_status,
                    "allowed_targets": allowed_targets
                }
            )

        return ValidationResult(
            is_valid=True,
            details={
                "current_status": current_status,
                "target_status": target_status,
                "transition_timestamp": datetime.utcnow().isoformat()
            }
        )

    def validate_retirement_application(
        self,
        application: RetirementApplication,
        asset_current_status: str
    ) -> ValidationResult:
        """
        验证退役申请是否有效

        Args:
            application: 退役申请数据
            asset_current_status: 资产当前状态

        Returns:
            ValidationResult: 验证结果

        验证规则：
            1. 资产当前状态必须允许发起退役申请
            2. 申请理由不能为空
            3. 资产不能处于待审批状态
        """
        # 检查资产状态是否允许发起申请
        if asset_current_status not in [
            AssetStatus.IN_USE.value,
            AssetStatus.IDLE.value,
            AssetStatus.MAINTENANCE.value
        ]:
            return ValidationResult(
                is_valid=False,
                error_code="INVALID_ASSET_STATUS",
                error_message=f"资产当前状态 '{asset_current_status}' 不允许发起退役申请",
                details={"current_status": asset_current_status}
            )

        # 检查申请理由
        if not application.reason or len(application.reason.strip()) == 0:
            return ValidationResult(
                is_valid=False,
                error_code="EMPTY_REASON",
                error_message="退役申请理由不能为空",
                details={"reason": application.reason}
            )

        if len(application.reason.strip()) < 10:
            return ValidationResult(
                is_valid=False,
                error_code="REASON_TOO_SHORT",
                error_message="退役申请理由至少需要10个字符",
                details={"reason_length": len(application.reason)}
            )

        return ValidationResult(
            is_valid=True,
            details={
                "asset_id": application.asset_id,
                "target_status": application.target_status,
                "validation_timestamp": datetime.utcnow().isoformat()
            }
        )

    def validate_approval_action(
        self,
        action: str,
        current_status: str,
        user_role: str,
        permission: Optional[str] = None
    ) -> ValidationResult:
        """
        验证审批操作是否合法

        Args:
            action: 审批动作（approve/reject）
            current_status: 当前审批状态
            user_role: 用户角色
            permission: 可选的权限标识

        Returns:
            ValidationResult: 验证结果

        验证规则：
            1. 只有 pending 状态的申请可以被审批
            2. 审批人必须具有相应角色权限
            3. action 必须是有效的审批动作
        """
        valid_actions = ["approve", "reject", "delegate", "return"]
        
        if action not in valid_actions:
            return ValidationResult(
                is_valid=False,
                error_code="INVALID_ACTION",
                error_message=f"无效的审批动作: '{action}'",
                details={"valid_actions": valid_actions}
            )

        if current_status != RetirementStatus.PENDING.value:
            return ValidationResult(
                is_valid=False,
                error_code="INVALID_STATUS_FOR_APPROVAL",
                error_message=f"当前状态 '{current_status}' 不允许进行审批操作",
                details={"current_status": current_status}
            )

        # 角色权限校验
        role_approval_mapping = {
            "approver": ["approve", "reject", "delegate"],
            "final_approver": ["approve", "reject", "delegate", "return"],
            "admin": ["approve", "reject", "delegate", "return"]
        }

        allowed_actions = role_approval_mapping.get(user_role, [])
        if action not in allowed_actions:
            return ValidationResult(
                is_valid=False,
                error_code="INSUFFICIENT_PERMISSION",
                error_message=f"角色 '{user_role}' 没有执行 '{action}' 操作的权限",
                details={"user_role": user_role, "action": action}
            )

        return ValidationResult(
            is_valid=True,
            details={
                "action": action,
                "user_role": user_role,
                "validation_timestamp": datetime.utcnow().isoformat()
            }
        )

    def validate_history_query(
        self,
        asset_id: str,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None,
        event_types: Optional[List[str]] = None
    ) -> ValidationResult:
        """
        验证历史记录查询参数

        Args:
            asset_id: 资产ID
            start_date: 查询起始日期
            end_date: 查询结束日期
            event_types: 事件类型列表

        Returns:
            ValidationResult: 验证结果

        验证规则：
            1. asset_id 不能为空
            2. start_date 必须早于 end_date
            3. event_types 必须为有效的事件类型
        """
        if not asset_id or len(asset_id.strip()) == 0:
            return ValidationResult(
                is_valid=False,
                error_code="EMPTY_ASSET_ID",
                error_message="资产ID不能为空",
                details={"asset_id": asset_id}
            )

        if start_date and end_date and start_date > end_date:
            return ValidationResult(
                is_valid=False,
                error_code="INVALID_DATE_RANGE",
                error_message="查询起始日期必须早于结束日期",
                details={"start_date": start_date, "end_date": end_date}
            )

        if event_types:
            valid_event_types = ["status_change", "approval", "rejection", "creation", "update"]
            invalid_types = [et for et in event_types if et not in valid_event_types]
            if invalid_types:
                return ValidationResult(
                    is_valid=False,
                    error_code="INVALID_EVENT_TYPES",
                    error_message=f"无效的事件类型: {invalid_types}",
                    details={"invalid_types": invalid_types, "valid_types": valid_event_types}
                )

        return ValidationResult(
            is_valid=True,
            details={
                "asset_id": asset_id,
                "start_date": start_date.isoformat() if start_date else None,
                "end_date": end_date.isoformat() if end_date else None,
                "event_types": event_types
            }
        )

    def get_allowed_transitions(self, current_status: str) -> List[str]:
        """
        获取指定状态允许的所有目标状态

        Args:
            current_status: 当前状态

        Returns:
            List[str]: 允许的目标状态列表
        """
        return self.valid_transitions.get(current_status, [])

    def is_final_state(self, status: str) -> bool:
        """
        判断是否为终态

        Args:
            status: 状态值

        Returns:
            bool: 是否为终态
        """
        return status in [AssetStatus.RETIRED.value, AssetStatus.SCRAPPED.value]

    def can_initiate_retirement(self, current_status: str) -> bool:
        """
        判断资产是否可以发起退役申请

        Args:
            current_status: 资产当前状态

        Returns:
            bool: 是否可以发起退役
        """
        return current_status in [
            AssetStatus.IN_USE.value,
            AssetStatus.IDLE.value,
            AssetStatus.MAINTENANCE.value
        ]


# 导出单例实例供外部使用
_default_validator: Optional[AssetValidator] = None


def get_validator(config: Optional[Dict[str, Any]] = None) -> AssetValidator:
    """
    获取资产验证器实例

    Args:
        config: 可选的配置字典

    Returns:
        AssetValidator: 验证器实例
    """
    global _default_validator
    if _default_validator is None or config is not None:
        _default_validator = AssetValidator(config)
    return _default_validator


def validate_transition(
    current_status: str,
    target_status: str,
    context: Optional[TransitionContext] = None
) -> ValidationResult:
    """
    便捷函数：验证状态迁移

    Args:
        current_status: 当前状态
        target_status: 目标状态
        context: 可选的迁移上下文

    Returns:
        ValidationResult: 验证结果
    """
    return get_validator().validate_state_transition(current_status, target_status, context)


def validate_retirement(
    application: RetirementApplication,
    asset_current_status: str
) -> ValidationResult:
    """
    便捷函数：验证退役申请

    Args:
        application: 退役申请数据
        asset_current_status: 资产当前状态

    Returns:
        ValidationResult: 验证结果
    """
    return get_validator().validate_retirement_application(application, asset_current_status)


# Re-export for backward compatibility
StateTransitionError = type("StateTransitionError", (Exception,), {
    "__init__": lambda self, msg="State transition validation failed": super(type(self), self).__init__(msg)
})