"""
历史记录查询 Schema 模块。

提供退役申请流程、历史事件查询的数据结构和验证逻辑，
支持按资产、时间范围、状态变更类型等维度进行历史追溯。
"""

from datetime import datetime
from enum import Enum
from typing import List, Optional

from pydantic import BaseModel, Field, field_validator


class EventType(str, Enum):
    """历史事件类型枚举。"""
    STATE_CHANGE = "state_change"           # 状态变更事件
    APPROVAL_ACTION = "approval_action"      # 审批动作事件
    SUBMISSION = "submission"                # 申请提交事件
    REJECTION = "rejection"                  # 驳回事件
    APPROVAL = "approval"                    # 批准事件
    FINAL_APPROVAL = "final_approval"        # 终审通过事件


class ApprovalStage(str, Enum):
    """审批阶段枚举。"""
    INITIAL = "initial"                      # 初始阶段
    FIRST_APPROVER = "first_approver"        # 第一审批人
    FINAL_APPROVER = "final_approver"        # 终审人
    COMPLETED = "completed"                  # 流程完成
    REJECTED = "rejected"                    # 已否决


class HistoryQueryParams(BaseModel):
    """
    历史记录查询参数。
    
    用于分页和过滤历史事件查询请求。
    """
    asset_id: Optional[str] = Field(
        default=None,
        description="资产唯一标识符"
    )
    retirement_id: Optional[str] = Field(
        default=None,
        description="退役申请唯一标识符"
    )
    event_types: Optional[List[EventType]] = Field(
        default=None,
        description="事件类型过滤列表"
    )
    start_time: Optional[datetime] = Field(
        default=None,
        description="查询起始时间"
    )
    end_time: Optional[datetime] = Field(
        default=None,
        description="查询结束时间"
    )
    page: int = Field(
        default=1,
        ge=1,
        description="页码，从1开始"
    )
    page_size: int = Field(
        default=20,
        ge=1,
        le=100,
        description="每页记录数"
    )
    
    @field_validator("start_time", "end_time")
    @classmethod
    def validate_time_range(cls, v: Optional[datetime], info) -> Optional[datetime]:
        """验证时间范围的合理性。"""
        if v is not None:
            if v.year < 2000 or v.year > 2100:
                raise ValueError("时间必须在合理范围内")
        return v


class StateChangeRecord(BaseModel):
    """
    状态变更记录模型。
    
    记录单次状态变更的详细信息。
    """
    previous_state: str = Field(
        description="变更前状态"
    )
    current_state: str = Field(
        description="变更后状态"
    )
    triggered_by: str = Field(
        description="触发操作的用户ID"
    )
    transition_reason: Optional[str] = Field(
        default=None,
        description="状态变更原因"
    )


class ApprovalActionRecord(BaseModel):
    """
    审批动作记录模型。
    
    记录单次审批操作的详细信息。
    """
    approver_id: str = Field(
        description="审批人ID"
    )
    approver_name: str = Field(
        description="审批人姓名"
    )
    approval_stage: ApprovalStage = Field(
        description="审批阶段"
    )
    action: str = Field(
        description="审批动作（approve/reject）"
    )
    comment: Optional[str] = Field(
        default=None,
        description="审批意见"
    )
    approved_at: datetime = Field(
        description="审批时间"
    )


class HistoryEvent(BaseModel):
    """
    历史事件模型。
    
    表示一条完整的不可变历史记录。
    """
    event_id: str = Field(
        description="事件唯一标识符"
    )
    event_type: EventType = Field(
        description="事件类型"
    )
    asset_id: str = Field(
        description="关联资产ID"
    )
    retirement_id: Optional[str] = Field(
        default=None,
        description="关联退役申请ID"
    )
    timestamp: datetime = Field(
        description="事件发生时间"
    )
    actor_id: str = Field(
        description="操作者ID"
    )
    actor_name: str = Field(
        description="操作者姓名"
    )
    state_change: Optional[StateChangeRecord] = Field(
        default=None,
        description="状态变更信息"
    )
    approval_action: Optional[ApprovalActionRecord] = Field(
        default=None,
        description="审批动作信息"
    )
    metadata: dict = Field(
        default_factory=dict,
        description="额外元数据"
    )
    
    def model_post_init(self, __context) -> None:
        """验证事件数据完整性。"""
        if self.event_type == EventType.STATE_CHANGE and not self.state_change:
            raise ValueError("状态变更事件必须包含state_change字段")
        if self.event_type in (EventType.APPROVAL, EventType.REJECTION, EventType.APPROVAL_ACTION) \
                and not self.approval_action:
            raise ValueError("审批事件必须包含approval_action字段")


class HistoryQueryResponse(BaseModel):
    """
    历史记录查询响应模型。
    
    包含分页信息和事件列表。
    """
    total: int = Field(
        ge=0,
        description="总记录数"
    )
    page: int = Field(
        ge=1,
        description="当前页码"
    )
    page_size: int = Field(
        ge=1,
        description="每页记录数"
    )
    total_pages: int = Field(
        ge=0,
        description="总页数"
    )
    events: List[HistoryEvent] = Field(
        description="历史事件列表（按时间倒序排列）"
    )
    
    def model_post_init(self, __context) -> None:
        """计算总页数。"""
        if self.page_size > 0:
            object.__setattr__(
                self,
                'total_pages',
                (self.total + self.page_size - 1) // self.page_size
            )


class RetirementFlowStatus(BaseModel):
    """
    退役申请流程状态模型。
    
    表示当前流程的整体状态和进度。
    """
    retirement_id: str = Field(
        description="退役申请ID"
    )
    asset_id: str = Field(
        description="资产ID"
    )
    current_state: str = Field(
        description="当前流程状态"
    )
    current_stage: ApprovalStage = Field(
        description="当前审批阶段"
    )
    submitted_by: str = Field(
        description="申请人ID"
    )
    submitted_at: datetime = Field(
        description="申请提交时间"
    )
    updated_at: datetime = Field(
        description="最后更新时间"
    )
    is_completed: bool = Field(
        description="流程是否已完成"
    )
    is_rejected: bool = Field(
        description="流程是否已驳回"
    )
    approval_chain: List[ApprovalStage] = Field(
        default_factory=list,
        description="审批链路阶段列表"
    )