"""
资产状态生命周期历史服务

提供资产生命周期事件的记录与查询功能，支持：
- 状态变更历史记录
- 审批流程生命周期追踪
- 生命周期时间轴查询

参考规格: SWARM-2026-Q2-002-iter4
"""

from datetime import datetime
from typing import List, Optional, Dict, Any
from dataclasses import dataclass, field
from enum import Enum

from src.models.asset_lifecycle_event import AssetLifecycleEvent, EventType
from src.repositories.history_repository import HistoryRepository


class OrderDirection(Enum):
    """查询排序方向枚举"""
    ASC = "asc"
    DESC = "desc"


@dataclass
class LifecycleEventRecord:
    """生命周期事件记录数据类"""
    id: str
    asset_id: str
    event_type: str
    timestamp: datetime
    operator_id: Optional[str] = None
    operator_name: Optional[str] = None
    metadata: Dict[str, Any] = field(default_factory=dict)
    description: Optional[str] = None

    def to_dict(self) -> Dict[str, Any]:
        """转换为字典格式"""
        return {
            "id": self.id,
            "asset_id": self.asset_id,
            "event_type": self.event_type,
            "timestamp": self.timestamp.isoformat(),
            "operator_id": self.operator_id,
            "operator_name": self.operator_name,
            "metadata": self.metadata,
            "description": self.description,
        }


@dataclass
class LifecycleTimeline:
    """生命周期时间轴数据类"""
    asset_id: str
    events: List[LifecycleEventRecord] = field(default_factory=list)
    total_count: int = 0
    order: str = "desc"

    def to_dict(self) -> Dict[str, Any]:
        """转换为字典格式"""
        return {
            "asset_id": self.asset_id,
            "timeline": [event.to_dict() for event in self.events],
            "total_count": self.total_count,
            "order": self.order,
        }


class StatusHistoryService:
    """
    资产状态生命周期历史服务
    
    职责:
    - 记录资产状态变更事件
    - 查询资产生命周期时间轴
    - 支持按时间倒序/正序查询
    - 支持按事件类型过滤
    
    使用场景:
    - 报废申请提交时记录事件
    - 审批链流转时记录审批事件
    - 资产状态变更时记录历史
    - 用户查询资产完整生命周期
    """

    def __init__(self, history_repository: Optional[HistoryRepository] = None):
        """
        初始化状态历史服务
        
        Args:
            history_repository: 历史记录仓储实例，用于数据持久化
        """
        self._history_repo = history_repository or HistoryRepository()

    def record_lifecycle_event(
        self,
        asset_id: str,
        event_type: str,
        operator_id: Optional[str] = None,
        operator_name: Optional[str] = None,
        metadata: Optional[Dict[str, Any]] = None,
        description: Optional[str] = None,
    ) -> LifecycleEventRecord:
        """
        记录资产生命周期事件
        
        在资产状态发生变更时调用此方法，将事件持久化到数据库。
        
        Args:
            asset_id: 资产ID
            event_type: 事件类型，见 EventType 枚举
            operator_id: 操作人ID
            operator_name: 操作人姓名
            metadata: 事件元数据（如审批意见、驳回原因等）
            description: 事件描述
            
        Returns:
            LifecycleEventRecord: 已保存的事件记录
            
        Raises:
            ValueError: 参数校验失败
        """
        # 参数校验
        if not asset_id:
            raise ValueError("asset_id cannot be empty")
        if not event_type:
            raise ValueError("event_type cannot be empty")
        
        # 构建事件记录
        event = AssetLifecycleEvent(
            asset_id=asset_id,
            event_type=event_type,
            timestamp=datetime.utcnow(),
            operator_id=operator_id,
            operator_name=operator_name,
            metadata=metadata or {},
            description=description,
        )
        
        # 持久化事件
        saved_event = self._history_repo.save_event(event)
        
        # 转换为返回对象
        return LifecycleEventRecord(
            id=saved_event.id,
            asset_id=saved_event.asset_id,
            event_type=saved_event.event_type,
            timestamp=saved_event.timestamp,
            operator_id=saved_event.operator_id,
            operator_name=saved_event.operator_name,
            metadata=saved_event.metadata,
            description=saved_event.description,
        )

    def record_retirement_application_event(
        self,
        asset_id: str,
        application_id: str,
        operator_id: str,
        operator_name: str,
        reason: str,
        estimated_residual_value: float,
    ) -> LifecycleEventRecord:
        """
        记录报废申请提交事件
        
        在用户提交报废申请时调用，记录"报废申请"类型事件。
        
        Args:
            asset_id: 资产ID
            application_id: 报废申请ID
            operator_id: 申请人ID
            operator_name: 申请人姓名
            reason: 报废原因
            estimated_residual_value: 预估残值
            
        Returns:
            LifecycleEventRecord: 已保存的事件记录
        """
        metadata = {
            "application_id": application_id,
            "reason": reason,
            "estimated_residual_value": estimated_residual_value,
        }
        description = f"提交报废申请，预估残值: {estimated_residual_value}"
        
        return self.record_lifecycle_event(
            asset_id=asset_id,
            event_type=EventType.RETIREMENT_APPLICATION.value,
            operator_id=operator_id,
            operator_name=operator_name,
            metadata=metadata,
            description=description,
        )

    def record_approval_event(
        self,
        asset_id: str,
        approval_id: str,
        level: int,
        decision: str,
        operator_id: str,
        operator_name: str,
        comment: Optional[str] = None,
    ) -> LifecycleEventRecord:
        """
        记录审批事件（通过/驳回）
        
        在审批人执行审批操作时调用，记录"审批通过"或"审批驳回"类型事件。
        
        Args:
            asset_id: 资产ID
            approval_id: 审批任务ID
            level: 审批层级
            decision: 审批决定（approve/reject）
            operator_id: 审批人ID
            operator_name: 审批人姓名
            comment: 审批意见
            
        Returns:
            LifecycleEventRecord: 已保存的事件记录
        """
        is_approve = decision.lower() == "approve"
        event_type = EventType.APPROVAL_APPROVED.value if is_approve else EventType.APPROVAL_REJECTED.value
        
        metadata = {
            "approval_id": approval_id,
            "level": level,
            "decision": decision,
            "comment": comment,
        }
        description = f"第 {level} 级审批{'通过' if is_approve else '驳回'}"
        if comment:
            description += f"，意见: {comment}"
        
        return self.record_lifecycle_event(
            asset_id=asset_id,
            event_type=event_type,
            operator_id=operator_id,
            operator_name=operator_name,
            metadata=metadata,
            description=description,
        )

    def record_retirement_completed_event(
        self,
        asset_id: str,
        final_status: str,
        operator_id: str,
        operator_name: str,
    ) -> LifecycleEventRecord:
        """
        记录报废完成事件
        
        在审批链全部通过，资产状态变更为"已报废"或"已退役"时调用。
        
        Args:
            asset_id: 资产ID
            final_status: 最终状态（已报废/已退役）
            operator_id: 操作人ID
            operator_name: 操作人姓名
            
        Returns:
            LifecycleEventRecord: 已保存的事件记录
        """
        metadata = {
            "final_status": final_status,
        }
        description = f"报废审批完成，资产状态变更为: {final_status}"
        
        return self.record_lifecycle_event(
            asset_id=asset_id,
            event_type=EventType.RETIREMENT_COMPLETED.value,
            operator_id=operator_id,
            operator_name=operator_name,
            metadata=metadata,
            description=description,
        )

    def record_status_change_event(
        self,
        asset_id: str,
        from_status: str,
        to_status: str,
        operator_id: Optional[str] = None,
        operator_name: Optional[str] = None,
        reason: Optional[str] = None,
    ) -> LifecycleEventRecord:
        """
        记录状态变更事件
        
        在资产状态发生变更时调用，记录通用状态变更事件。
        
        Args:
            asset_id: 资产ID
            from_status: 变更前状态
            to_status: 变更后状态
            operator_id: 操作人ID
            operator_name: 操作人姓名
            reason: 变更原因
            
        Returns:
            LifecycleEventRecord: 已保存的事件记录
        """
        metadata = {
            "from_status": from_status,
            "to_status": to_status,
            "reason": reason,
        }
        description = f"资产状态从 [{from_status}] 变更为 [{to_status}]"
        if reason:
            description += f"，原因: {reason}"
        
        return self.record_lifecycle_event(
            asset_id=asset_id,
            event_type=EventType.STATUS_CHANGED.value,
            operator_id=operator_id,
            operator_name=operator_name,
            metadata=metadata,
            description=description,
        )

    def get_lifecycle_timeline(
        self,
        asset_id: str,
        order: str = "desc",
        event_type: Optional[str] = None,
        page: int = 1,
        page_size: int = 50,
    ) -> LifecycleTimeline:
        """
        获取资产生命周期时间轴
        
        聚合查询资产的所有生命周期事件，按时间倒序排列。
        
        Args:
            asset_id: 资产ID
            order: 排序方向，支持 'asc'（正序）或 'desc'（倒序，默认）
            event_type: 事件类型过滤，可选
            page: 页码，从1开始
            page_size: 每页记录数
            
        Returns:
            LifecycleTimeline: 生命周期时间轴数据
            
        Raises:
            ValueError: 参数校验失败
        """
        # 参数校验
        if not asset_id:
            raise ValueError("asset_id cannot be empty")
        
        # 校验排序方向
        if order not in ["asc", "desc"]:
            order = "desc"
        
        # 校验分页参数
        page = max(1, page)
        page_size = min(max(1, page_size), 100)  # 限制最大100条
        
        # 查询事件
        events_data = self._history_repo.get_events_by_asset_id(
            asset_id=asset_id,
            order=order,
            event_type=event_type,
            page=page,
            page_size=page_size,
        )
        
        # 获取总数
        total_count = self._history_repo.get_event_count(
            asset_id=asset_id,
            event_type=event_type,
        )
        
        # 构建返回对象
        events = [
            LifecycleEventRecord(
                id=e["id"],
                asset_id=e["asset_id"],
                event_type=e["event_type"],
                timestamp=e["timestamp"],
                operator_id=e.get("operator_id"),
                operator_name=e.get("operator_name"),
                metadata=e.get("metadata", {}),
                description=e.get("description"),
            )
            for e in events_data
        ]
        
        return LifecycleTimeline(
            asset_id=asset_id,
            events=events,
            total_count=total_count,
            order=order,
        )

    def get_latest_event(self, asset_id: str) -> Optional[LifecycleEventRecord]:
        """
        获取资产最新生命周期事件
        
        Args:
            asset_id: 资产ID
            
        Returns:
            Optional[LifecycleEventRecord]: 最新事件记录，不存在则返回 None
        """
        if not asset_id:
            raise ValueError("asset_id cannot be empty")
        
        event_data = self._history_repo.get_latest_event(asset_id)
        if not event_data:
            return None
        
        return LifecycleEventRecord(
            id=event_data["id"],
            asset_id=event_data["asset_id"],
            event_type=event_data["event_type"],
            timestamp=event_data["timestamp"],
            operator_id=event_data.get("operator_id"),
            operator_name=event_data.get("operator_name"),
            metadata=event_data.get("metadata", {}),
            description=event_data.get("description"),
        )

    def get_events_by_type(
        self,
        asset_id: str,
        event_type: str,
        limit: int = 10,
    ) -> List[LifecycleEventRecord]:
        """
        获取指定类型的事件列表
        
        Args:
            asset_id: 资产ID
            event_type: 事件类型
            limit: 返回数量限制
            
        Returns:
            List[LifecycleEventRecord]: 事件列表
        """
        if not asset_id or not event_type:
            raise ValueError("asset_id and event_type cannot be empty")
        
        events_data = self._history_repo.get_events_by_asset_id(
            asset_id=asset_id,
            order="desc",
            event_type=event_type,
            page=1,
            page_size=limit,
        )
        
        return [
            LifecycleEventRecord(
                id=e["id"],
                asset_id=e["asset_id"],
                event_type=e["event_type"],
                timestamp=e["timestamp"],
                operator_id=e.get("operator_id"),
                operator_name=e.get("operator_name"),
                metadata=e.get("metadata", {}),
                description=e.get("description"),
            )
            for e in events_data
        ]


# 导出单例实例供全局使用
_default_service: Optional[StatusHistoryService] = None


def get_status_history_service(
    history_repository: Optional[HistoryRepository] = None,
) -> StatusHistoryService:
    """
    获取状态历史服务实例（单例模式）
    
    Args:
        history_repository: 可选的历史记录仓储实例
        
    Returns:
        StatusHistoryService: 服务实例
    """
    global _default_service
    if _default_service is None or history_repository is not None:
        _default_service = StatusHistoryService(history_repository)
    return _default_service


def reset_status_history_service() -> None:
    """重置服务实例（用于测试）"""
    global _default_service
    _default_service = None