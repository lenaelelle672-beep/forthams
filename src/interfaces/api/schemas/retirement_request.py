"""
报废申请请求模式定义

本模块定义了报废/退役申请相关的数据结构和验证规则，
用于资产状态流转引擎的API接口层。

状态流转：
    申请提交 -> 审批中 -> 已批准/已否决 -> 已退役
    审批链支持多角色（申请人、审批人、终审人）按层级顺序审批与回退

用例：
    - 用户发起退役申请
    - 审批人审批通过/拒绝
    - 历史记录查询与追溯

导出：
    RetirementRequest: 退役申请请求
    RetirementApprovalRequest: 审批请求
    ApprovalAction: 审批操作类型
"""

from datetime import datetime
from enum import Enum
from typing import Optional, List
from pydantic import BaseModel, Field, ConfigDict, field_validator


class ApprovalAction(str, Enum):
    """
    审批操作类型枚举
    
    定义审批链中可执行的操作：
    - APPROVE: 批准当前节点，继续下一审批
    - REJECT: 拒绝申请，终止审批链
    - RETURN: 退回申请人，补充材料或重新评估
    """
    APPROVE = "approve"
    REJECT = "reject"
    RETURN = "return"


class RetirementStatus(str, Enum):
    """
    退役申请状态枚举
    
    状态流转确定性：给定输入与上下文，输出状态唯一
    - PENDING: 待审批
    - APPROVED: 已批准（终审通过，待执行退役）
    - REJECTED: 已否决（任一审批拒绝即终止）
    - RETIRED: 已退役（流程完成）
    - CANCELLED: 已取消（申请人主动撤销）
    """
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"
    RETIRED = "retired"
    CANCELLED = "cancelled"


class RetirementRequest(BaseModel):
    """
    退役申请请求模型
    
    用户发起退役申请时的输入数据结构。
    用于 POST /assets/{id}/retire 接口的请求体。
    
    Attributes:
        asset_id: 资产ID，必填，用于标识退役目标资产
        reason: 退役原因，必填，描述申请退役的业务原因
        expected_date: 预期退役日期，可选，指定希望退役的时间
        attachments: 附件列表，可选，支持上传证明材料
        notes: 备注信息，可选，补充说明
    """
    model_config = ConfigDict(
        str_strip_whitespace=True,
        json_schema_extra={
            "example": {
                "asset_id": "12345",
                "reason": "设备老化严重，已无法修复",
                "expected_date": "2024-12-31",
                "attachments": ["repair_report.pdf", "inspection_cert.pdf"],
                "notes": "已获得部门负责人签字确认"
            }
        }
    )
    
    asset_id: str = Field(
        ...,
        description="资产唯一标识符",
        min_length=1,
        max_length=64
    )
    reason: str = Field(
        ...,
        description="申请退役的详细原因",
        min_length=1,
        max_length=1000
    )
    expected_date: Optional[str] = Field(
        None,
        description="预期的退役日期，格式：YYYY-MM-DD"
    )
    attachments: Optional[List[str]] = Field(
        default_factory=list,
        description="支持材料附件列表"
    )
    notes: Optional[str] = Field(
        None,
        description="补充说明或备注",
        max_length=500
    )

    @field_validator("expected_date")
    @classmethod
    def validate_date_format(cls, v: Optional[str]) -> Optional[str]:
        """
        验证日期格式是否符合 YYYY-MM-DD 标准格式
        
        Args:
            v: 待验证的日期字符串
            
        Returns:
            验证通过的日期字符串
            
        Raises:
            ValueError: 日期格式不符合要求
        """
        if v is None:
            return v
        try:
            datetime.strptime(v, "%Y-%m-%d")
        except ValueError:
            raise ValueError("expected_date must be in YYYY-MM-DD format")
        return v


class RetirementApprovalRequest(BaseModel):
    """
    退役申请审批请求模型
    
    审批人在审批链中对退役申请进行操作时的输入数据结构。
    审批操作需基于RBAC校验权限，最小权限原则。
    
    Attributes:
        request_id: 退役申请ID，必填，标识被审批的申请
        action: 审批操作类型，必填，approve/reject/return
        approver_id: 审批人ID，必填，执行审批操作的用户
        comments: 审批意见，可选，描述审批决策依据
        next_approver_id: 下一步审批人ID，可选，仅在approve时有效
    """
    model_config = ConfigDict(
        str_strip_whitespace=True,
        json_schema_extra={
            "example": {
                "request_id": "REQ-2024-001",
                "action": "approve",
                "approver_id": "user_001",
                "comments": "符合退役条件，同意申请",
                "next_approver_id": "user_002"
            }
        }
    )
    
    request_id: str = Field(
        ...,
        description="退役申请唯一标识符",
        min_length=1,
        max_length=64
    )
    action: ApprovalAction = Field(
        ...,
        description="审批操作类型：approve/reject/return"
    )
    approver_id: str = Field(
        ...,
        description="执行审批操作的用户ID",
        min_length=1,
        max_length=64
    )
    comments: Optional[str] = Field(
        None,
        description="审批意见或决策说明",
        max_length=500
    )
    next_approver_id: Optional[str] = Field(
        None,
        description="下一步审批人ID（仅在action为approve时有效）",
        max_length=64
    )

    @field_validator("action", mode="before")
    @classmethod
    def normalize_action(cls, v):
        """
        规范化审批操作类型，兼容大小写
        
        Args:
            v: 操作类型值
            
        Returns:
            标准化的 ApprovalAction 枚举值
        """
        if isinstance(v, str):
            v = v.lower().strip()
            for action in ApprovalAction:
                if action.value == v:
                    return action
        return v


class RetirementHistoryQuery(BaseModel):
    """
    退役申请历史查询请求模型
    
    用于查询指定资产或申请的变更历史记录。
    历史记录需按时间排序，确保可追溯、不可篡改。
    
    Attributes:
        asset_id: 资产ID，可选，用于筛选该资产的所有历史
        request_id: 申请ID，可选，用于筛选该申请的历史
        start_date: 起始日期，可选，筛选指定时间段
        end_date: 结束日期，可选，筛选指定时间段
        limit: 返回条数限制，可选，默认100条
        offset: 偏移量，可选，用于分页
    """
    asset_id: Optional[str] = Field(
        None,
        description="资产唯一标识符"
    )
    request_id: Optional[str] = Field(
        None,
        description="退役申请唯一标识符"
    )
    start_date: Optional[str] = Field(
        None,
        description="查询起始日期（YYYY-MM-DD）"
    )
    end_date: Optional[str] = Field(
        None,
        description="查询结束日期（YYYY-MM-DD）"
    )
    limit: int = Field(
        default=100,
        ge=1,
        le=1000,
        description="返回记录条数上限"
    )
    offset: int = Field(
        default=0,
        ge=0,
        description="分页偏移量"
    )

    @field_validator("start_date", "end_date")
    @classmethod
    def validate_date_range(cls, v: Optional[str]) -> Optional[str]:
        """
        验证日期格式
        
        Args:
            v: 待验证的日期字符串
            
        Returns:
            验证通过的日期字符串
            
        Raises:
            ValueError: 日期格式不符合 YYYY-MM-DD
        """
        if v is None:
            return v
        try:
            datetime.strptime(v, "%Y-%m-%d")
        except ValueError:
            raise ValueError(f"Date must be in YYYY-MM-DD format, got: {v}")
        return v


class RetirementStatusUpdate(BaseModel):
    """
    退役申请状态更新模型
    
    用于内部状态流转时的状态变更请求。
    状态迁移必须满足确定性（给定输入与上下文，输出状态唯一）。
    
    Attributes:
        request_id: 申请ID，必填
        new_status: 新状态，必填
        updated_by: 更新人，必填
        reason: 更新原因，可选
    """
    request_id: str = Field(..., description="退役申请唯一标识符")
    new_status: RetirementStatus = Field(..., description="新的状态值")
    updated_by: str = Field(..., description="执行更新操作的用户ID")
    reason: Optional[str] = Field(None, description="状态变更原因")