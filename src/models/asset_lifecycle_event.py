"""
资产生命周期事件模型

记录资产从入库到报废的全链路状态变更与审批历史，
用于生命周期追溯与审计合规。

生命周期事件类型:
- ASSET_CREATED: 资产创建
- RETIREMENT_CREATED: 报废/退役申请创建
- LEVEL_N_APPROVED: N级审批通过
- LEVEL_N_REJECTED: N级审批驳回
- RETIREMENT_COMPLETED: 报废/退役流程完成
- RETIREMENT_CANCELLED: 申请撤销
"""

from datetime import datetime
from enum import Enum
from typing import Optional

from sqlalchemy import Column, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import relationship

from src.infrastructure.database.models import Base


class LifecycleEventType(str, Enum):
    """生命周期事件类型枚举"""
    ASSET_CREATED = "ASSET_CREATED"
    ASSET_TRANSFERRED = "ASSET_TRANSFERRED"
    ASSET_MAINTAINED = "ASSET_MAINTAINED"
    RETIREMENT_CREATED = "RETIREMENT_CREATED"
    LEVEL_1_APPROVED = "LEVEL_1_APPROVED"
    LEVEL_2_APPROVED = "LEVEL_2_APPROVED"
    LEVEL_3_APPROVED = "LEVEL_3_APPROVED"
    LEVEL_4_APPROVED = "LEVEL_4_APPROVED"
    LEVEL_5_APPROVED = "LEVEL_5_APPROVED"
    LEVEL_1_REJECTED = "LEVEL_1_REJECTED"
    LEVEL_2_REJECTED = "LEVEL_2_REJECTED"
    LEVEL_3_REJECTED = "LEVEL_3_REJECTED"
    LEVEL_4_REJECTED = "LEVEL_4_REJECTED"
    LEVEL_5_REJECTED = "LEVEL_5_REJECTED"
    RETIREMENT_COMPLETED = "RETIREMENT_COMPLETED"
    RETIREMENT_CANCELLED = "RETIREMENT_CANCELLED"
    APPLICATION_WITHDRAWN = "APPLICATION_WITHDRAWN"


class AssetLifecycleEvent(Base):
    """
    资产生命周期事件表
    
    存储资产所有状态变更事件，支持完整生命周期追溯。
    事件记录永久保留，不可物理删除。
    
    Attributes:
        id: 事件唯一标识
        asset_id: 关联资产ID
        event_type: 事件类型
        event_data: 事件附加数据(JSON)
        operator_id: 操作用户ID
        operator_name: 操作用户姓名
        approval_chain_id: 关联审批链ID(可选)
        approval_node_id: 关联审批节点ID(可选)
        comment: 审批意见/备注
        ip_address: 操作IP地址
        created_at: 事件发生时间
    """
    __tablename__ = "asset_lifecycle_event"
    __table_args__ = (
        {"schema": "public"}
    )

    id = Column(Integer, primary_key=True, autoincrement=True)
    asset_id = Column(Integer, ForeignKey("assets.id", ondelete="RESTRICT"), nullable=False, index=True)
    event_type = Column(String(50), nullable=False, index=True)
    event_data = Column(Text, nullable=True)  # JSON格式存储额外数据
    operator_id = Column(Integer, nullable=True, index=True)
    operator_name = Column(String(100), nullable=True)
    approval_chain_id = Column(Integer, ForeignKey("approval_chains.id", ondelete="SET NULL"), nullable=True)
    approval_node_id = Column(Integer, ForeignKey("approval_nodes.id", ondelete="SET NULL"), nullable=True)
    comment = Column(Text, nullable=True)
    ip_address = Column(String(45), nullable=True)  # 支持IPv6
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False, index=True)

    # 关系定义
    asset = relationship("Asset", back_populates="lifecycle_events", foreign_keys=[asset_id])
    approval_chain = relationship("ApprovalChain", foreign_keys=[approval_chain_id])
    approval_node = relationship("ApprovalNode", foreign_keys=[approval_node_id])

    def __repr__(self) -> str:
        return (
            f"<AssetLifecycleEvent(id={self.id}, asset_id={self.asset_id}, "
            f"event_type={self.event_type}, created_at={self.created_at})>"
        )

    def to_dict(self) -> dict:
        """
        转换为字典格式
        
        Returns:
            包含事件完整信息的字典
        """
        return {
            "id": self.id,
            "asset_id": self.asset_id,
            "event_type": self.event_type,
            "event_data": self.event_data,
            "operator_id": self.operator_id,
            "operator_name": self.operator_name,
            "approval_chain_id": self.approval_chain_id,
            "approval_node_id": self.approval_node_id,
            "comment": self.comment,
            "ip_address": self.ip_address,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }

    @classmethod
    def create_event(
        cls,
        asset_id: int,
        event_type: LifecycleEventType,
        operator_id: Optional[int] = None,
        operator_name: Optional[str] = None,
        comment: Optional[str] = None,
        event_data: Optional[dict] = None,
        approval_chain_id: Optional[int] = None,
        approval_node_id: Optional[int] = None,
        ip_address: Optional[str] = None,
    ) -> "AssetLifecycleEvent":
        """
        创建生命周期事件实例
        
        Args:
            asset_id: 资产ID
            event_type: 事件类型
            operator_id: 操作用户ID
            operator_name: 操作用户姓名
            comment: 审批意见/备注
            event_data: 额外事件数据
            approval_chain_id: 审批链ID
            approval_node_id: 审批节点ID
            ip_address: 操作IP
            
        Returns:
            新的事件实例
        """
        import json
        
        return cls(
            asset_id=asset_id,
            event_type=event_type.value if isinstance(event_type, LifecycleEventType) else event_type,
            operator_id=operator_id,
            operator_name=operator_name,
            comment=comment,
            event_data=json.dumps(event_data) if event_data else None,
            approval_chain_id=approval_chain_id,
            approval_node_id=approval_node_id,
            ip_address=ip_address,
        )