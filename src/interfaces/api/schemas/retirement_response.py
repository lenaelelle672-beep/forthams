"""
退役申请响应模式模块

定义退役申请相关的 API 响应数据结构，支持资产状态流转引擎与审批链功能。
遵循规格 phase 3：流程引擎与审批链实现。

关键特性：
- 状态流转响应：支持资产退役状态查询与流程追踪
- 审批链响应：包含审批节点、审批历史与审批结果
- 历史记录响应：不可变事件记录，支持溯源查询

Author: Specification Execution Engineer
"""

from datetime import datetime
from enum import Enum
from typing import List, Optional, Any, Dict
from pydantic import BaseModel, Field, ConfigDict


class RetirementStatus(str, Enum):
    """
    退役申请状态枚举
    
    定义资产退役流程的完整生命周期状态。
    确保状态迁移的确定性（给定输入与上下文，输出状态唯一）。
    """
    PENDING = "pending"           # 待审批
    APPROVED_STEP_1 = "approved_step_1"  # 一级审批通过
    APPROVED_STEP_2 = "approved_step_2"  # 二级审批通过
    APPROVED_STEP_3 = "approved_step_3"  # 三级审批通过
    APPROVED_FINAL = "approved_final"    # 最终审批通过（已退役）
    REJECTED = "rejected"         # 已否决
    CANCELLED = "cancelled"       # 已取消
    ON_HOLD = "on_hold"           # 暂停


class ApprovalAction(str, Enum):
    """
    审批动作枚举
    
    定义审批链中的操作类型。
    """
    APPROVE = "approve"           # 批准
    REJECT = "reject"             # 拒绝
    RETURN = "return"             # 退回
    DELEGATE = "delegate"         # 转交


class RetirementAssetResponse(BaseModel):
    """
    退役资产响应模型
    
    包含资产的基本信息与当前退役状态。
    """
    model_config = ConfigDict(serde_default_settings={"by_alias": True})

    asset_id: str = Field(..., description="资产唯一标识")
    asset_name: str = Field(..., description="资产名称")
    asset_code: str = Field(..., description="资产编号")
    current_status: str = Field(..., description="当前资产状态")
    retirement_status: RetirementStatus = Field(..., description="退役申请状态")
    submitted_at: datetime = Field(..., description="申请提交时间")
    submitted_by: str = Field(..., description="申请人")
    submitted_by_dept: Optional[str] = Field(None, description="申请人部门")
    expected_retirement_date: Optional[datetime] = Field(None, description="预计退役日期")


class ApprovalNodeResponse(BaseModel):
    """
    审批节点响应模型
    
    定义审批链中的单个节点结构。
    """
    model_config = ConfigDict(serde_default_settings={"by_alias": True})

    node_id: str = Field(..., description="节点唯一标识")
    node_order: int = Field(..., description="节点顺序（1=申请人, 2=审批人, 3=终审人）")
    approver_id: str = Field(..., description="审批人ID")
    approver_name: str = Field(..., description="审批人姓名")
    approver_role: str = Field(..., description="审批人角色")
    action: Optional[ApprovalAction] = Field(None, description="审批动作")
    action_time: Optional[datetime] = Field(None, description="审批时间")
    comment: Optional[str] = Field(None, description="审批意见")
    status: str = Field(..., description="节点状态：pending/approved/rejected/returned")


class ApprovalChainResponse(BaseModel):
    """
    审批链响应模型
    
    包含完整的审批链结构与状态。
    审批链不可绕过；任一审批拒绝即终止流程并标记为"已否决"。
    """
    model_config = ConfigDict(serde_default_settings={"by_alias": True})

    chain_id: str = Field(..., description="审批链唯一标识")
    current_step: int = Field(..., description="当前审批步骤")
    total_steps: int = Field(..., description="总审批步骤数")
    nodes: List[ApprovalNodeResponse] = Field(..., description="审批节点列表")
    is_completed: bool = Field(..., description="审批链是否完成")
    final_result: Optional[str] = Field(None, description="最终结果：approved/rejected")


class RetirementEventRecord(BaseModel):
    """
    退役事件记录模型
    
    定义状态变更的不可变事件记录。
    历史记录写入与状态变更需原子化，确保一致性。
    """
    model_config = ConfigDict(serde_default_settings={"by_alias": True})

    event_id: str = Field(..., description="事件唯一标识")
    event_type: str = Field(..., description="事件类型：submit/approve/reject/return/cancel")
    timestamp: datetime = Field(..., description="事件发生时间")
    actor_id: str = Field(..., description="操作人ID")
    actor_name: str = Field(..., description="操作人姓名")
    actor_role: str = Field(..., description="操作人角色")
    from_status: Optional[str] = Field(None, description="变更前状态")
    to_status: str = Field(..., description="变更后状态")
    details: Optional[Dict[str, Any]] = Field(None, description="扩展详情")
    approval_comment: Optional[str] = Field(None, description="审批意见")


class RetirementHistoryResponse(BaseModel):
    """
    退役历史记录响应模型
    
    按时间排序的事件列表，支持历史轨迹溯源。
    """
    model_config = ConfigDict(serde_default_settings={"by_alias": True})

    asset_id: str = Field(..., description="资产唯一标识")
    total_events: int = Field(..., description="事件总数")
    events: List[RetirementEventRecord] = Field(..., description="事件记录列表（按时间倒序）")


class RetirementApplicationResponse(BaseModel):
    """
    退役申请完整响应模型
    
    包含申请详情、资产信息与审批链状态。
    """
    model_config = ConfigDict(serde_default_settings={"by_alias": True})

    application_id: str = Field(..., description="申请唯一标识")
    asset: RetirementAssetResponse = Field(..., description="资产信息")
    retirement_reason: str = Field(..., description="退役原因")
    description: Optional[str] = Field(None, description="详细描述")
    approval_chain: ApprovalChainResponse = Field(..., description="审批链")
    history: RetirementHistoryResponse = Field(..., description="历史记录")
    created_at: datetime = Field(..., description="创建时间")
    updated_at: datetime = Field(..., description="最后更新时间")


class RetirementSubmitResponse(BaseModel):
    """
    退役申请提交响应模型
    
    提交退役申请后返回的信息。
    """
    model_config = ConfigDict(serde_default_settings={"by_alias": True})

    application_id: str = Field(..., description="新生成的申请唯一标识")
    asset_id: str = Field(..., description="资产ID")
    status: RetirementStatus = Field(..., description="申请状态")
    message: str = Field(..., description="提示信息")
    approval_chain_id: Optional[str] = Field(None, description="关联的审批链ID")
    estimated_completion: Optional[datetime] = Field(None, description="预计完成时间")


class RetirementStatusResponse(BaseModel):
    """
    退役状态查询响应模型
    
    用于查询资产当前退役流程状态。
    """
    model_config = ConfigDict(serde_default_settings={"by_alias": True})

    asset_id: str = Field(..., description="资产唯一标识")
    has_active_retirement: bool = Field(..., description="是否有进行中的退役申请")
    current_status: Optional[RetirementStatus] = Field(None, description="当前状态")
    current_step: Optional[int] = Field(None, description="当前审批步骤")
    next_approver: Optional[str] = Field(None, description="下一步审批人")
    can_cancel: bool = Field(..., description="是否可以取消")
    can_modify: bool = Field(..., description="是否可以修改")


class ApprovalResultResponse(BaseModel):
    """
    审批结果响应模型
    
    审批操作完成后返回的结果。
    """
    model_config = ConfigDict(serde_default_settings={"by_alias": True})

    success: bool = Field(..., description="操作是否成功")
    application_id: str = Field(..., description="申请ID")
    previous_status: str = Field(..., description="变更前状态")
    new_status: str = Field(..., description="变更后状态")
    message: str = Field(..., description="结果描述")
    event_id: str = Field(..., description="生成的事件ID")
    is_final: bool = Field(..., description="是否为终态")


class RetirementErrorResponse(BaseModel):
    """
    退役错误响应模型
    
    退役流程中出现错误时返回的信息。
    """
    model_config = ConfigDict(serde_default_settings={"by_alias": True})

    error_code: str = Field(..., description="错误代码")
    error_message: str = Field(..., description="错误描述")
    asset_id: Optional[str] = Field(None, description="相关资产ID")
    application_id: Optional[str] = Field(None, description="相关申请ID")
    suggestions: Optional[List[str]] = Field(None, description="修复建议")