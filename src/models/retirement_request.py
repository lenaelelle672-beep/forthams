"""
资产报废/退役申请数据模型

本模块定义了资产报废/退役流程的核心实体：
- AssetRetirementRequest: 报废申请主表
- RetirementStatus: 申请状态枚举
- RetirementDisposalMethod: 处置方式枚举

与审批链(ApprovalChain)和生命周期事件(AssetLifecycleEvent)协同工作，
支持多级审批流程和完整的状态流转历史记录。

Phase: SWARM-2026-Q2-002 (流程引擎与审批链)
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
    Numeric,
    String,
    Text,
    JSON,
)
from sqlalchemy.orm import relationship, Mapped, mapped_column

from src.models.base import Base


class RetirementStatus(str, Enum):
    """
    报废申请状态枚举
    
    状态流转规则:
    - PENDING -> APPROVED (所有审批节点通过)
    - PENDING -> REJECTED (任一审批节点驳回)
    - APPROVED -> EXECUTED (执行报废操作)
    
    注意: EXECUTED 状态为终态，不可逆向回滚
    """
    PENDING = "PENDING"           # 待审批
    APPROVED = "APPROVED"          # 已批准
    REJECTED = "REJECTED"          # 已驳回
    EXECUTED = "EXECUTED"          # 已执行（终态）
    CANCELLED = "CANCELLED"        # 已取消


class RetirementDisposalMethod(str, Enum):
    """
    资产处置方式枚举
    
    定义资产报废后的处置途径
    """
    SCRAP = "SCRAP"               # 直接报废/销毁
    RECYCLE = "RECYCLE"           # 回收再利用
    RESALE = "RESALE"             # 变卖
    DONATION = "DONATION"         # 捐赠
    STORAGE = "STORAGE"           # 入库封存


class AssetRetirementRequest(Base):
    """
    资产报废/退役申请主表
    
    存储资产报废申请的核心信息，包括申请人、申请原因、
    预估残值、处置方式及当前审批状态。
    
    Attributes:
        id: 主键
        asset_id: 关联资产ID (外键)
        applicant_id: 申请人用户ID
        reason: 报废申请原因
        estimated_residual_value: 预估残值（元）
        disposal_method: 处置方式 (见 RetirementDisposalMethod)
        status: 当前状态 (见 RetirementStatus)
        approval_chain_id: 使用的审批链ID
        current_approval_step: 当前审批步骤索引 (0-based)
        metadata: 扩展元数据 (JSON类型，存储审批意见等)
        created_at: 创建时间
        updated_at: 更新时间
        decided_at: 审批完成时间
        decided_by: 最终审批人ID
    """
    
    __tablename__ = "asset_retirement_requests"
    
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    
    # 关联资产
    asset_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("assets.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
        comment="关联资产ID"
    )
    
    # 申请人信息
    applicant_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("users.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
        comment="申请人用户ID"
    )
    
    # 申请详情
    reason: Mapped[str] = mapped_column(
        Text,
        nullable=False,
        comment="报废申请原因"
    )
    
    estimated_residual_value: Mapped[Optional[float]] = mapped_column(
        Numeric(12, 2),
        nullable=True,
        comment="预估残值（元）"
    )
    
    disposal_method: Mapped[RetirementDisposalMethod] = mapped_column(
        SQLEnum(RetirementDisposalMethod, native_enum=True),
        nullable=False,
        default=RetirementDisposalMethod.SCRAP,
        comment="处置方式"
    )
    
    # 审批状态
    status: Mapped[RetirementStatus] = mapped_column(
        SQLEnum(RetirementStatus, native_enum=True),
        nullable=False,
        default=RetirementStatus.PENDING,
        index=True,
        comment="当前状态"
    )
    
    # 审批链关联
    approval_chain_id: Mapped[Optional[int]] = mapped_column(
        Integer,
        ForeignKey("approval_chains.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
        comment="使用的审批链ID"
    )
    
    current_approval_step: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        default=0,
        comment="当前审批步骤索引 (0-based)"
    )
    
    # 扩展数据
    metadata: Mapped[Optional[dict]] = mapped_column(
        JSON,
        nullable=True,
        comment="扩展元数据 (存储审批意见、驳回原因等)"
    )
    
    # 时间戳
    created_at: Mapped[datetime] = mapped_column(
        DateTime,
        nullable=False,
        default=datetime.utcnow,
        comment="创建时间"
    )
    
    updated_at: Mapped[datetime] = mapped_column(
        DateTime,
        nullable=False,
        default=datetime.utcnow,
        onupdate=datetime.utcnow,
        comment="更新时间"
    )
    
    decided_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime,
        nullable=True,
        comment="审批完成时间"
    )
    
    decided_by: Mapped[Optional[int]] = mapped_column(
        Integer,
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        comment="最终审批人ID"
    )
    
    # 关系
    asset = relationship("Asset", back_populates="retirement_requests")
    applicant = relationship("User", foreign_keys=[applicant_id])
    decided_by_user = relationship("User", foreign_keys=[decided_by])
    approval_chain = relationship("ApprovalChain", foreign_keys=[approval_chain_id])
    
    # 审批记录关联 (反向引用)
    approval_records: Mapped[list["ApprovalRecord"]] = relationship(
        "ApprovalRecord",
        back_populates="retirement_request",
        order_by="ApprovalRecord.step_index",
        lazy="selectin"
    )
    
    def __repr__(self) -> str:
        return (
            f"<AssetRetirementRequest(id={self.id}, "
            f"asset_id={self.asset_id}, status={self.status.value})>"
        )
    
    @property
    def is_terminal(self) -> bool:
        """判断是否为终态（不可变更）"""
        return self.status in (RetirementStatus.EXECUTED, RetirementStatus.CANCELLED)
    
    @property
    def is_approved(self) -> bool:
        """判断是否已批准"""
        return self.status == RetirementStatus.APPROVED
    
    @property
    def is_rejected(self) -> bool:
        """判断是否被驳回"""
        return self.status == RetirementStatus.REJECTED
    
    def to_dict(self) -> dict:
        """
        转换为字典格式
        
        Returns:
            dict: 包含所有字段的字典
        """
        return {
            "id": self.id,
            "asset_id": self.asset_id,
            "applicant_id": self.applicant_id,
            "reason": self.reason,
            "estimated_residual_value": float(self.estimated_residual_value) if self.estimated_residual_value else None,
            "disposal_method": self.disposal_method.value if self.disposal_method else None,
            "status": self.status.value if self.status else None,
            "approval_chain_id": self.approval_chain_id,
            "current_approval_step": self.current_approval_step,
            "metadata": self.metadata,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
            "decided_at": self.decided_at.isoformat() if self.decided_at else None,
            "decided_by": self.decided_by,
        }