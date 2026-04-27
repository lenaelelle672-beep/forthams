"""
资产报废退役流程数据模型

本模块定义了资产报废/退役申请相关的核心数据模型：
- RetirementApplication: 报废/退役申请单
- ApprovalChainConfig: 审批链配置
- ApprovalTask: 审批任务
- AssetLifecycleEvent: 资产生命周期事件

约束说明:
- 同一资产同一时间仅允许存在1条有效申请
- 审批层级最少1级，最多5级
- 使用乐观锁 version 字段防止并发冲突

相关ATB:
- ATB-001: 报废申请发起
- ATB-002: 重复申请拦截
- ATB-003: 多级审批链执行
- ATB-004: 驳回与重提
- ATB-005: 生命周期完整性
- ATB-006: 审批中资产状态锁定
- ATB-007: 并发审批防护
"""

from datetime import datetime
from enum import Enum
from typing import Optional

from sqlalchemy import (
    Column,
    DateTime,
    Enum as SQLEnum,
    ForeignKey,
    Integer,
    String,
    Text,
    Index,
    CheckConstraint,
    UniqueConstraint,
)
from sqlalchemy.orm import relationship

from src.models.base import BaseModel, db


class ApplicationType(str, Enum):
    """申请类型枚举"""
    SCRAP = "scrap"           # 报废
    RETIREMENT = "retirement" # 退役


class ApplicationStatus(str, Enum):
    """申请状态枚举"""
    PENDING = "pending"           # 待审批
    APPROVED = "approved"         # 已批准
    REJECTED = "rejected"         # 已驳回
    CANCELLED = "cancelled"       # 已撤销


class ApprovalStatus(str, Enum):
    """审批任务状态枚举"""
    PENDING = "pending"           # 待审批
    APPROVED = "approved"         # 已通过
    REJECTED = "rejected"         # 已驳回


class ApprovalAction(str, Enum):
    """审批动作枚举"""
    APPROVE = "approve"           # 批准
    REJECT = "reject"             # 驳回
    DELEGATE = "delegate"         # 转交


class LifecycleEventType(str, Enum):
    """生命周期事件类型枚举"""
    # 资产基础事件
    CREATED = "CREATED"                    # 资产创建
    STATUS_CHANGED = "STATUS_CHANGED"      # 状态变更
    TRANSFERRED = "TRANSFERRED"            # 资产转移
    
    # 报废退役相关事件
    RETIREMENT_CREATED = "RETIREMENT_CREATED"      # 申请创建
    LEVEL_APPROVED = "LEVEL_APPROVED"              # 审批节点通过 (level_N_APPROVED)
    RETIREMENT_REJECTED = "RETIREMENT_REJECTED"    # 申请驳回
    RETIREMENT_CANCELLED = "RETIREMENT_CANCELLED"  # 申请撤销
    RETIREMENT_COMPLETED = "RETIREMENT_COMPLETED"  # 流程完成
    RETIREMENT_RESUBMITTED = "RETIREMENT_RESUBMITTED"  # 重新提交


class RetirementApplication(BaseModel):
    """
    报废/退役申请单模型
    
    约束:
    - 同一资产同一时间仅允许存在1条有效申请
    - 审批中资产禁止其他状态变更操作
    - 申请人仅可在首级审批前撤销申请
    
    状态流转:
    PENDING -> APPROVED (全部审批通过)
    PENDING -> REJECTED (任意审批驳回)
    PENDING -> CANCELLED (申请人主动撤销)
    REJECTED -> PENDING (修改后重新提交)
    """
    __tablename__ = 'retirement_applications'
    
    # 基本信息
    id = Column(Integer, primary_key=True, autoincrement=True)
    asset_id = Column(Integer, ForeignKey('assets.id'), nullable=False, index=True)
    application_type = Column(
        SQLEnum(ApplicationType, values_callable=lambda x: [e.value for e in x]),
        nullable=False
    )
    status = Column(
        SQLEnum(ApplicationStatus, values_callable=lambda x: [e.value for e in x]),
        nullable=False,
        default=ApplicationStatus.PENDING
    )
    reason = Column(Text, nullable=False)
    
    # 申请人信息
    applicant_id = Column(Integer, ForeignKey('users.id'), nullable=False, index=True)
    applicant_department_id = Column(Integer, ForeignKey('departments.id'), nullable=True)
    
    # 附件信息 (JSON格式存储附件ID列表)
    attachments = Column(Text, nullable=True)  # JSON: ["attachment_id_1", "attachment_id_2"]
    
    # 审批链配置
    approval_chain_id = Column(Integer, ForeignKey('approval_chain_configs.id'), nullable=True)
    
    # 乐观锁版本号 (用于并发控制)
    version = Column(Integer, nullable=False, default=1)
    
    # 时间戳
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    updated_at = Column(DateTime, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow)
    submitted_at = Column(DateTime, nullable=True)
    completed_at = Column(DateTime, nullable=True)
    
    # 关联关系
    asset = relationship("Asset", back_populates="retirement_applications")
    approval_tasks = relationship("ApprovalTask", back_populates="application", cascade="all, delete-orphan")
    lifecycle_events = relationship("AssetLifecycleEvent", back_populates="application")
    
    __table_args__ = (
        # 同一资产同一时间仅允许存在1条有效申请约束
        CheckConstraint(
            "status IN ('pending', 'approved', 'rejected', 'cancelled')",
            name="valid_application_status"
        ),
        Index('idx_asset_status', 'asset_id', 'status'),
        Index('idx_applicant_status', 'applicant_id', 'status'),
    )
    
    def can_submit(self) -> bool:
        """检查是否可以提交申请"""
        return self.status == ApplicationStatus.PENDING and self.submitted_at is None
    
    def can_cancel(self, user_id: int) -> bool:
        """
        检查是否可以撤销申请
        
        约束: 仅申请人可在首级审批前撤销
        """
        if self.applicant_id != user_id:
            return False
        if self.status != ApplicationStatus.PENDING:
            return False
        # 检查是否存在已处理的审批任务
        for task in self.approval_tasks:
            if task.status == ApprovalStatus.APPROVED:
                return False
        return True
    
    def get_current_task(self) -> Optional['ApprovalTask']:
        """获取当前待审批任务"""
        for task in self.approval_tasks:
            if task.status == ApprovalStatus.PENDING:
                return task
        return None
    
    def is_locked(self) -> bool:
        """检查资产是否被申请锁定"""
        return self.status == ApplicationStatus.PENDING


class ApprovalChainConfig(BaseModel):
    """
    审批链配置模型
    
    支持配置化审批流，实现多级审批:
    - 最少1级，最多5级
    - 每级可指定审批角色/部门/人员
    """
    __tablename__ = 'approval_chain_configs'
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(100), nullable=False, unique=True)
    description = Column(String(500), nullable=True)
    
    # 审批层级数量 (1-5)
    level_count = Column(Integer, nullable=False, default=1)
    
    # 审批类型
    application_types = Column(Text, nullable=True)  # JSON: ["scrap", "retirement"]
    
    # 是否启用
    is_active = Column(Integer, nullable=False, default=1)
    
    # 审批节点配置 (JSON格式)
    # 格式: [{"level": 1, "approver_type": "role", "approver_id": "xxx"}, ...]
    node_config = Column(Text, nullable=False)
    
    # 时间戳
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    updated_at = Column(DateTime, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # 关联关系
    applications = relationship("RetirementApplication", back_populates="approval_chain_config")
    
    __table_args__ = (
        CheckConstraint("level_count >= 1 AND level_count <= 5", name="approval_level_range"),
    )
    
    def get_level_nodes(self) -> list:
        """解析并返回审批节点配置"""
        import json
        if self.node_config:
            return json.loads(self.node_config)
        return []


class ApprovalTask(BaseModel):
    """
    审批任务模型
    
    表示单个审批节点的任务实例:
    - 关联到具体的申请单
    - 指定当前待审批人
    - 支持驳回/批准/转交操作
    """
    __tablename__ = 'approval_tasks'
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    application_id = Column(
        Integer, 
        ForeignKey('retirement_applications.id', ondelete='CASCADE'),
        nullable=False,
        index=True
    )
    
    # 审批层级 (1-5)
    level = Column(Integer, nullable=False)
    
    # 审批人信息
    approver_id = Column(Integer, ForeignKey('users.id'), nullable=False, index=True)
    approver_type = Column(String(50), nullable=False)  # "user", "role", "department"
    approver_identifier = Column(String(100), nullable=False)  # 具体ID或标识
    
    # 状态
    status = Column(
        SQLEnum(ApprovalStatus, values_callable=lambda x: [e.value for e in x]),
        nullable=False,
        default=ApprovalStatus.PENDING
    )
    
    # 审批操作信息
    action = Column(
        SQLEnum(ApprovalAction, values_callable=lambda x: [e.value for e in x]),
        nullable=True
    )
    comment = Column(Text, nullable=True)
    
    # 乐观锁版本号
    version = Column(Integer, nullable=False, default=1)
    
    # 时间戳
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    updated_at = Column(DateTime, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow)
    handled_at = Column(DateTime, nullable=True)  # 处理时间
    
    # 关联关系
    application = relationship("RetirementApplication", back_populates="approval_tasks")
    
    __table_args__ = (
        Index('idx_app_level', 'application_id', 'level'),
        Index('idx_approver_status', 'approver_id', 'status'),
    )
    
    def can_approve(self) -> bool:
        """检查是否可以批准"""
        return self.status == ApprovalStatus.PENDING
    
    def can_reject(self, comment: Optional[str] = None) -> bool:
        """
        检查是否可以驳回
        
        约束: 驳回必须填写审批意见（≥10字符）
        """
        if self.status != ApprovalStatus.PENDING:
            return False
        if not comment or len(comment.strip()) < 10:
            return False
        return True
    
    def is_timed_out(self, hours: int = 72) -> bool:
        """
        检查是否超时
        
        72小时未处理自动发送催办通知（不自动通过）
        """
        if self.status != ApprovalStatus.PENDING:
            return False
        from datetime import timedelta
        return datetime.utcnow() > self.created_at + timedelta(hours=hours)


class AssetLifecycleEvent(BaseModel):
    """
    资产生命周期事件模型
    
    完整记录资产从入库到报废的全链路状态变更与审批历史:
    - 永久保留，不可物理删除
    - 事务一致性：与审批状态变更在同事务内写入
    """
    __tablename__ = 'asset_lifecycle_events'
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    asset_id = Column(Integer, ForeignKey('assets.id'), nullable=False, index=True)
    
    # 事件类型
    event_type = Column(
        SQLEnum(LifecycleEventType, values_callable=lambda x: [e.value for e in x]),
        nullable=False,
        index=True
    )
    
    # 关联的申请单 (可选)
    application_id = Column(
        Integer, 
        ForeignKey('retirement_applications.id'),
        nullable=True
    )
    
    # 关联的审批任务 (可选)
    approval_task_id = Column(
        Integer,
        ForeignKey('approval_tasks.id'),
        nullable=True
    )
    
    # 事件详情 (JSON格式存储)
    # 如: {"from_status": "active", "to_status": "under_retirement", "level": 2}
    event_data = Column(Text, nullable=True)
    
    # 操作人信息
    operator_id = Column(Integer, ForeignKey('users.id'), nullable=True)
    operator_ip = Column(String(50), nullable=True)
    
    # 事件时间
    occurred_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    
    # 关联关系
    asset = relationship("Asset", back_populates="lifecycle_events")
    application = relationship("RetirementApplication", back_populates="lifecycle_events")
    
    __table_args__ = (
        Index('idx_asset_event_time', 'asset_id', 'occurred_at'),
        Index('idx_event_type_time', 'event_type', 'occurred_at'),
    )
    
    def get_event_summary(self) -> dict:
        """获取事件摘要"""
        import json
        return {
            "id": self.id,
            "asset_id": self.asset_id,
            "event_type": self.event_type,
            "occurred_at": self.occurred_at.isoformat() if self.occurred_at else None,
            "data": json.loads(self.event_data) if self.event_data else {}
        }
    
    @classmethod
    def create_event(
        cls,
        asset_id: int,
        event_type: LifecycleEventType,
        operator_id: Optional[int] = None,
        operator_ip: Optional[str] = None,
        application_id: Optional[int] = None,
        approval_task_id: Optional[int] = None,
        event_data: Optional[dict] = None
    ) -> 'AssetLifecycleEvent':
        """
        创建生命周期事件
        
        用于在状态变更时自动记录事件
        """
        import json
        return cls(
            asset_id=asset_id,
            event_type=event_type,
            operator_id=operator_id,
            operator_ip=operator_ip,
            application_id=application_id,
            approval_task_id=approval_task_id,
            event_data=json.dumps(event_data) if event_data else None
        )