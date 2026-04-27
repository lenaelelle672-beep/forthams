"""
StateTransitionLog Model - 状态变更日志

记录资产状态变更历史，支持哈希链防篡改设计。
用于 SWARM-002 资产报废退役流程 - Phase 4 历史记录持久化

Author: SWARM Team
Version: 1.0
"""

from datetime import datetime
from typing import Optional
from uuid import UUID, uuid4
import hashlib
import json

from sqlalchemy import Column, String, DateTime, ForeignKey, Enum, Index, Text
from sqlalchemy.dialects.postgresql import UUID as PG_UUID, JSONB
from sqlalchemy.orm import relationship

from src.infrastructure.database.base import Base


class TriggerType(str):
    """触发类型枚举"""
    MANUAL = "manual"
    AUTO = "auto"
    APPROVAL = "approval"


class StateTransitionLog(Base):
    """
    资产状态变更日志模型
    
    记录每次资产状态的完整变更轨迹，包含哈希链实现防篡改审计。
    
    Attributes:
        id: 唯一标识符 (UUID)
        asset_id: 关联资产ID
        from_status: 原状态
        to_status: 新状态
        trigger_type: 触发类型 (manual/auto/approval)
        operator_id: 操作人ID (可为NULL表示系统操作)
        metadata: 扩展元数据 (JSON格式)
        hash: 哈希值 (用于链式校验)
        previous_hash: 前一条记录的哈希值
        created_at: 创建时间戳
    """
    
    __tablename__ = "state_transition_logs"
    
    id = Column(PG_UUID(as_uuid=True), primary_key=True, default=uuid4)
    asset_id = Column(
        PG_UUID(as_uuid=True), 
        ForeignKey("assets.id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )
    from_status = Column(String(32), nullable=False)
    to_status = Column(String(32), nullable=False)
    trigger_type = Column(
        Enum(TriggerType, name="trigger_type_enum", create_constraint=True),
        nullable=False,
        default=TriggerType.MANUAL
    )
    operator_id = Column(
        PG_UUID(as_uuid=True), 
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True
    )
    metadata = Column(JSONB, nullable=True, default=dict)
    hash = Column(String(64), nullable=False)
    previous_hash = Column(String(64), nullable=True)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    
    # 关系定义
    asset = relationship("Asset", back_populates="state_transitions")
    operator = relationship("User", foreign_keys=[operator_id])
    
    # 索引定义
    __table_args__ = (
        Index("ix_state_transition_logs_asset_created", "asset_id", "created_at"),
        Index("ix_state_transition_logs_created_at", "created_at"),
        Index("ix_state_transition_logs_from_to_status", "from_status", "to_status"),
    )
    
    def __init__(self, **kwargs):
        """
        初始化状态转换日志
        
        Args:
            asset_id: 资产ID
            from_status: 原状态
            to_status: 新状态
            trigger_type: 触发类型
            operator_id: 操作人ID (可选)
            metadata: 扩展数据 (可选)
            previous_hash: 前一条哈希值 (可选)
        """
        super().__init__(**kwargs)
        if not self.id:
            self.id = uuid4()
        if not self.created_at:
            self.created_at = datetime.utcnow()
        if not self.metadata:
            self.metadata = {}
        # 生成哈希值
        self._compute_hash()
    
    def _compute_hash(self) -> None:
        """
        计算当前记录的哈希值
        
        哈希内容包含: asset_id, from_status, to_status, trigger_type, 
                     operator_id, metadata, previous_hash, created_at
        """
        hash_content = self._get_hash_content()
        self.hash = hashlib.sha256(hash_content.encode('utf-8')).hexdigest()
    
    def _get_hash_content(self) -> str:
        """
        获取用于哈希计算的内容字符串
        
        Returns:
            JSON格式的哈希源数据
        """
        content = {
            "asset_id": str(self.asset_id),
            "from_status": self.from_status,
            "to_status": self.to_status,
            "trigger_type": self.trigger_type,
            "operator_id": str(self.operator_id) if self.operator_id else None,
            "metadata": self.metadata,
            "previous_hash": self.previous_hash,
            "created_at": self.created_at.isoformat() if self.created_at else None
        }
        return json.dumps(content, sort_keys=True, ensure_ascii=False)
    
    def verify_chain_integrity(self, previous_log: Optional['StateTransitionLog'] = None) -> bool:
        """
        验证哈希链完整性
        
        Args:
            previous_log: 前一条日志记录 (可选)
            
        Returns:
            校验结果: True=完整, False=可能篡改
        """
        # 验证previous_hash
        if previous_log:
            if self.previous_hash != previous_log.hash:
                return False
        
        # 重新计算当前哈希并比对
        expected_hash = self._get_hash_content()
        expected_hash = hashlib.sha256(expected_hash.encode('utf-8')).hexdigest()
        return self.hash == expected_hash
    
    def to_dict(self) -> dict:
        """
        转换为字典格式
        
        Returns:
            包含所有字段的字典
        """
        return {
            "id": str(self.id),
            "asset_id": str(self.asset_id),
            "from_status": self.from_status,
            "to_status": self.to_status,
            "trigger_type": self.trigger_type,
            "operator_id": str(self.operator_id) if self.operator_id else None,
            "metadata": self.metadata,
            "hash": self.hash,
            "previous_hash": self.previous_hash,
            "created_at": self.created_at.isoformat() if self.created_at else None
        }
    
    def __repr__(self) -> str:
        """字符串表示"""
        return (
            f"<StateTransitionLog(id={self.id}, "
            f"asset_id={self.asset_id}, "
            f"{self.from_status} -> {self.to_status}, "
            f"trigger={self.trigger_type})>"
        )


def create_transition_log(
    asset_id: UUID,
    from_status: str,
    to_status: str,
    trigger_type: str = TriggerType.MANUAL,
    operator_id: Optional[UUID] = None,
    metadata: Optional[dict] = None,
    previous_hash: Optional[str] = None
) -> StateTransitionLog:
    """
    工厂函数: 创建状态转换日志记录
    
    Args:
        asset_id: 资产ID
        from_status: 原状态
        to_status: 新状态
        trigger_type: 触发类型
        operator_id: 操作人ID
        metadata: 扩展数据
        previous_hash: 前一条哈希值
        
    Returns:
        新创建的 StateTransitionLog 实例
    """
    log = StateTransitionLog(
        asset_id=asset_id,
        from_status=from_status,
        to_status=to_status,
        trigger_type=trigger_type,
        operator_id=operator_id,
        metadata=metadata or {},
        previous_hash=previous_hash
    )
    return log