# src/domain/events/listeners/state_log_listener.py
"""
状态变更日志监听器

监听资产状态变更事件并记录到 StateTransitionLog 表，
同时维护哈希链以保证审计链的防篡改性。
"""

import hashlib
import json
from datetime import datetime
from typing import Optional
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.domain.events.base import BaseEventListener
from src.domain.events.events import AssetStatusChangedEvent
from src.domain.models.state_transition_log import StateTransitionLog
from src.infrastructure.repositories.state_transition_log_repository import (
    StateTransitionLogRepository,
)


class StateLogListener(BaseEventListener):
    """
    状态变更日志监听器
    
    职责：
    1. 监听 AssetStatusChangedEvent 事件
    2. 将状态变更写入 StateTransitionLog 表
    3. 维护哈希链以支持篡改检测
    
    哈希链设计：
    - 每个日志记录的 hash 字段包含：上一个日志的 hash + 当前记录的的关键字段
    - 通过验证哈希链完整性可以检测历史记录是否被篡改
    """

    def __init__(self, session: AsyncSession):
        """
        初始化状态日志监听器
        
        Args:
            session: 数据库会话，用于持久化操作
        """
        self.session = session
        self.repository = StateTransitionLogRepository(session)

    async def handle(self, event: AssetStatusChangedEvent) -> None:
        """
        处理资产状态变更事件
        
        Args:
            event: 资产状态变更事件对象
        """
        # 获取前一条记录的哈希值（用于构建哈希链）
        previous_hash = await self._get_previous_hash(event.asset_id)
        
        # 创建状态变更日志记录
        log_entry = await self._create_log_entry(event, previous_hash)
        
        # 写入数据库
        await self.repository.create(log_entry)

    async def _get_previous_hash(self, asset_id: UUID) -> Optional[str]:
        """
        获取指定资产的前一条日志记录的哈希值
        
        用于构建哈希链的链头。
        
        Args:
            asset_id: 资产ID
            
        Returns:
            前一条记录的哈希值，如果不存在则返回 None
        """
        query = (
            select(StateTransitionLog)
            .where(StateTransitionLog.asset_id == asset_id)
            .order_by(StateTransitionLog.created_at.desc())
            .limit(1)
        )
        result = await self.session.execute(query)
        last_log = result.scalar_one_or_none()
        
        return last_log.hash if last_log else None

    async def _create_log_entry(
        self, 
        event: AssetStatusChangedEvent, 
        previous_hash: Optional[str]
    ) -> StateTransitionLog:
        """
        创建状态变更日志记录
        
        Args:
            event: 状态变更事件
            previous_hash: 前一条记录的哈希值
            
        Returns:
            创建的 StateTransitionLog 记录
        """
        # 构建元数据 JSON
        metadata = {
            "event_id": str(event.event_id),
            "asset_code": event.asset_code,
            "application_id": str(event.application_id) if event.application_id else None,
            "extra_data": event.metadata or {}
        }
        
        # 计算当前记录的哈希值（用于防篡改）
        current_hash = self._calculate_hash(
            previous_hash=previous_hash,
            asset_id=str(event.asset_id),
            from_status=event.from_status,
            to_status=event.to_status,
            trigger_type=event.trigger_type.value if hasattr(event.trigger_type, 'value') else str(event.trigger_type),
            operator_id=str(event.operator_id) if event.operator_id else None,
            timestamp=event.occurred_at.isoformat()
        )
        
        return StateTransitionLog(
            asset_id=event.asset_id,
            from_status=event.from_status,
            to_status=event.to_status,
            trigger_type=event.trigger_type.value if hasattr(event.trigger_type, 'value') else str(event.trigger_type),
            operator_id=event.operator_id,
            metadata=metadata,
            hash=current_hash,
            previous_hash=previous_hash,
            created_at=event.occurred_at
        )

    def _calculate_hash(
        self,
        previous_hash: Optional[str],
        asset_id: str,
        from_status: str,
        to_status: str,
        trigger_type: str,
        operator_id: Optional[str],
        timestamp: str
    ) -> str:
        """
        计算日志记录的哈希值
        
        使用 SHA-256 算法构建防篡改的哈希链。
        
        Args:
            previous_hash: 前一条记录的哈希值
            asset_id: 资产ID
            from_status: 原状态
            to_status: 新状态
            trigger_type: 触发类型
            operator_id: 操作人ID
            timestamp: 时间戳
            
        Returns:
            计算后的 SHA-256 哈希值（十六进制字符串）
        """
        # 构建哈希输入字符串
        hash_input = "|".join([
            previous_hash or "GENESIS",
            asset_id,
            from_status,
            to_status,
            trigger_type,
            operator_id or "SYSTEM",
            timestamp
        ])
        
        return hashlib.sha256(hash_input.encode('utf-8')).hexdigest()

    async def verify_hash_chain(self, asset_id: UUID) -> bool:
        """
        验证指定资产的哈希链完整性
        
        用于检测历史记录是否被篡改。
        
        Args:
            asset_id: 资产ID
            
        Returns:
            True 表示哈希链完整未被篡改，False 表示检测到篡改
        """
        query = (
            select(StateTransitionLog)
            .where(StateTransitionLog.asset_id == asset_id)
            .order_by(StateTransitionLog.created_at.asc())
        )
        result = await self.session.execute(query)
        logs = result.scalars().all()
        
        if not logs:
            return True
        
        previous_hash = None
        for log in logs:
            # 验证 previous_hash 是否正确
            if log.previous_hash != previous_hash:
                return False
            
            # 重新计算当前记录的哈希并验证
            expected_hash = self._calculate_hash(
                previous_hash=previous_hash,
                asset_id=str(log.asset_id),
                from_status=log.from_status,
                to_status=log.to_status,
                trigger_type=log.trigger_type,
                operator_id=str(log.operator_id) if log.operator_id else None,
                timestamp=log.created_at.isoformat()
            )
            
            if log.hash != expected_hash:
                return False
            
            previous_hash = log.hash
        
        return True