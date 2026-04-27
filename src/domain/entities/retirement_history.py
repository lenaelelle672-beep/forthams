"""
资产报废退役历史记录实体模块。

本模块定义了资产退役流程中各状态变更和操作的历史记录实体，
用于持久化存储资产的完整生命周期变更轨迹，确保审计可追溯性。

主要实体：
- RetirementHistory: 资产退役主记录
- RetirementStateChange: 状态变更记录
- RetirementApprovalRecord: 审批操作记录
"""

from datetime import datetime
from typing import Optional, List
from dataclasses import dataclass, field
from enum import Enum


class RetirementState(str, Enum):
    """
    资产退役状态枚举。
    
    定义了资产从在用到最终处置的完整状态流转。
    """
    
    ACTIVE = "ACTIVE"  # 在用状态
    PENDING_RETIREMENT = "PENDING_RETIREMENT"  # 待退役申请
    UNDER_APPROVAL = "UNDER_APPROVAL"  # 审批中
    RETIRED = "RETIRED"  # 已退役
    DISPOSED = "DISPOSED"  # 已处置
    REJECTED = "REJECTED"  # 申请被拒绝
    WITHDRAWN = "WITHDRAWN"  # 申请人撤回


@dataclass
class RetirementStateChange:
    """
    资产状态变更记录。
    
    记录资产在退役流程中的每一次状态变更，包括变更前后的状态、
    变更时间、操作人及变更原因。
    
    Attributes:
        id: 记录唯一标识
        asset_id: 资产唯一标识
        from_state: 变更前状态
        to_state: 变更后状态
        changed_at: 变更时间
        operator: 操作人ID
        reason: 变更原因
        metadata: 附加元数据
    """
    
    id: str
    asset_id: str
    from_state: RetirementState
    to_state: RetirementState
    changed_at: datetime
    operator: str
    reason: Optional[str] = None
    metadata: dict = field(default_factory=dict)
    
    def to_dict(self) -> dict:
        """
        将状态变更记录转换为字典格式。
        
        Returns:
            dict: 包含所有字段的字典表示
        """
        return {
            'id': self.id,
            'asset_id': self.asset_id,
            'from_state': self.from_state.value if self.from_state else None,
            'to_state': self.to_state.value if self.to_state else None,
            'changed_at': self.changed_at.isoformat() if self.changed_at else None,
            'operator': self.operator,
            'reason': self.reason,
            'metadata': self.metadata
        }


@dataclass
class RetirementApprovalRecord:
    """
    资产退役审批记录。
    
    记录退役申请在审批链中每个节点的审批操作，包括审批人、
    审批时间、审批意见和审批结果。
    
    Attributes:
        id: 记录唯一标识
        application_id: 退役申请ID
        approval_level: 审批层级（1-4）
        approver_id: 审批人ID
        approver_name: 审批人姓名
        action: 审批动作（APPROVE/REJECT）
        comment: 审批意见
        action_at: 审批时间
        timeout: 是否超时
    """
    
    id: str
    application_id: str
    approval_level: int
    approver_id: str
    approver_name: str
    action: str  # APPROVE, REJECT
    comment: Optional[str] = None
    action_at: Optional[datetime] = None
    timeout: bool = False
    
    def is_approved(self) -> bool:
        """
        判断当前审批节点是否通过。
        
        Returns:
            bool: 审批动作是否为APPROVE
        """
        return self.action.upper() == 'APPROVE'
    
    def to_dict(self) -> dict:
        """
        将审批记录转换为字典格式。
        
        Returns:
            dict: 包含所有字段的字典表示
        """
        return {
            'id': self.id,
            'application_id': self.application_id,
            'approval_level': self.approval_level,
            'approver_id': self.approver_id,
            'approver_name': self.approver_name,
            'action': self.action,
            'comment': self.comment,
            'action_at': self.action_at.isoformat() if self.action_at else None,
            'timeout': self.timeout
        }


@dataclass
class RetirementHistory:
    """
    资产退役历史主记录。
    
    聚合了资产退役流程中的所有相关信息，包括：
    - 退役申请基本信息
    - 状态变更历史
    - 审批链记录
    - 附件信息
    
    作为资产退役流程的完整审计日志来源。
    
    Attributes:
        id: 历史记录唯一标识
        asset_id: 资产唯一标识
        application_id: 退役申请ID
        current_state: 当前状态
        state_changes: 状态变更记录列表
        approval_records: 审批记录列表
        attachments: 附件列表
        created_at: 创建时间
        updated_at: 更新时间
        is_deleted: 是否已删除（软删除标记）
    """
    
    id: str
    asset_id: str
    application_id: str
    current_state: RetirementState
    state_changes: List[RetirementStateChange] = field(default_factory=list)
    approval_records: List[RetirementApprovalRecord] = field(default_factory=list)
    attachments: List[str] = field(default_factory=list)
    created_at: datetime = field(default_factory=datetime.now)
    updated_at: datetime = field(default_factory=datetime.now)
    is_deleted: bool = False
    
    def add_state_change(self, change: RetirementStateChange) -> None:
        """
        添加状态变更记录。
        
        Args:
            change: 状态变更记录对象
        """
        self.state_changes.append(change)
        self.updated_at = datetime.now()
    
    def add_approval_record(self, record: RetirementApprovalRecord) -> None:
        """
        添加审批记录。
        
        Args:
            record: 审批记录对象
        """
        self.approval_records.append(record)
        self.updated_at = datetime.now()
    
    def get_latest_state(self) -> RetirementState:
        """
        获取最新状态。
        
        Returns:
            RetirementState: 最新的退役状态
        """
        if self.state_changes:
            return self.state_changes[-1].to_state
        return self.current_state
    
    def get_all_transitions(self) -> List[dict]:
        """
        获取所有状态变更记录。
        
        Returns:
            List[dict]: 状态变更记录列表的字典表示
        """
        return [change.to_dict() for change in self.state_changes]
    
    def get_approval_summary(self) -> dict:
        """
        获取审批链摘要信息。
        
        Returns:
            dict: 包含审批层级统计和当前审批进度的字典
        """
        total_levels = 4  # 默认4级审批链
        completed_levels = len(self.approval_records)
        return {
            'total_levels': total_levels,
            'completed_levels': completed_levels,
            'pending_levels': total_levels - completed_levels,
            'is_completed': completed_levels >= total_levels
        }
    
    def soft_delete(self) -> None:
        """
        执行软删除。
        
        将is_deleted标记设为True，记录更新时间。
        注意：历史记录不进行物理删除，仅标记删除状态以满足审计要求。
        """
        self.is_deleted = True
        self.updated_at = datetime.now()
    
    def to_dict(self) -> dict:
        """
        将退役历史记录转换为字典格式。
        
        Returns:
            dict: 包含所有字段的字典表示
        """
        return {
            'id': self.id,
            'asset_id': self.asset_id,
            'application_id': self.application_id,
            'current_state': self.current_state.value if self.current_state else None,
            'state_changes': self.get_all_transitions(),
            'approval_records': [record.to_dict() for record in self.approval_records],
            'attachments': self.attachments,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None,
            'is_deleted': self.is_deleted
        }
    
    @classmethod
    def from_dict(cls, data: dict) -> 'RetirementHistory':
        """
        从字典数据创建退役历史记录实例。
        
        Args:
            data: 包含退役历史字段的字典
            
        Returns:
            RetirementHistory: 构建的退役历史对象
        """
        state_changes = [
            RetirementStateChange(**sc) if isinstance(sc, dict) else sc
            for sc in data.get('state_changes', [])
        ]
        approval_records = [
            RetirementApprovalRecord(**ar) if isinstance(ar, dict) else ar
            for ar in data.get('approval_records', [])
        ]
        
        return cls(
            id=data['id'],
            asset_id=data['asset_id'],
            application_id=data['application_id'],
            current_state=RetirementState(data.get('current_state', 'ACTIVE')),
            state_changes=state_changes,
            approval_records=approval_records,
            attachments=data.get('attachments', []),
            created_at=datetime.fromisoformat(data['created_at']) if data.get('created_at') else datetime.now(),
            updated_at=datetime.fromisoformat(data['updated_at']) if data.get('updated_at') else datetime.now(),
            is_deleted=data.get('is_deleted', False)
        )


def create_retirement_history(
    history_id: str,
    asset_id: str,
    application_id: str,
    initial_state: RetirementState = RetirementState.ACTIVE
) -> RetirementHistory:
    """
    创建新的退役历史记录。
    
    Factory函数，用于实例化包含初始状态的退役历史记录。
    
    Args:
        history_id: 历史记录唯一标识
        asset_id: 资产唯一标识
        application_id: 退役申请ID
        initial_state: 初始状态，默认为ACTIVE
        
    Returns:
        RetirementHistory: 新建的退役历史记录实例
    """
    return RetirementHistory(
        id=history_id,
        asset_id=asset_id,
        application_id=application_id,
        current_state=initial_state
    )


def validate_state_transition(
    from_state: RetirementState,
    to_state: RetirementState
) -> bool:
    """
    验证状态转换是否合法。
    
    根据预定义的状态流转规则，检查两个状态之间的转换是否允许。
    
    合法的状态流转：
    - ACTIVE → PENDING_RETIREMENT
    - PENDING_RETIREMENT → UNDER_APPROVAL
    - PENDING_RETIREMENT → WITHDRAWN (申请人撤回)
    - UNDER_APPROVAL → RETIRED (全部审批通过)
    - UNDER_APPROVAL → REJECTED (任意节点拒绝)
    - RETIRED → DISPOSED (完成处置)
    
    Args:
        from_state: 源状态
        to_state: 目标状态
        
    Returns:
        bool: 转换是否合法
    """
    valid_transitions = {
        RetirementState.ACTIVE: [RetirementState.PENDING_RETIREMENT],
        RetirementState.PENDING_RETIREMENT: [
            RetirementState.UNDER_APPROVAL,
            RetirementState.WITHDRAWN
        ],
        RetirementState.UNDER_APPROVAL: [
            RetirementState.RETIRED,
            RetirementState.REJECTED
        ],
        RetirementState.RETIRED: [RetirementState.DISPOSED],
        RetirementState.REJECTED: [RetirementState.ACTIVE],
        RetirementState.WITHDRAWN: [RetirementState.ACTIVE]
    }
    
    allowed_states = valid_transitions.get(from_state, [])
    return to_state in allowed_states