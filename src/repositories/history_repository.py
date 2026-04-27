"""
资产生命周期历史记录仓储层

提供资产生命周期事件的持久化与查询能力，支持：
- 状态变更历史记录
- 审批流程历史追溯
- 生命周期事件时间轴查询

文档版本: SWARM-2026-Q2-002-iter4
编制日期: 2026-04-20
"""

from datetime import datetime
from enum import Enum
from typing import List, Optional, Dict, Any, Literal

from sqlalchemy import and_, or_, desc, asc
from sqlalchemy.orm import Session

from ..models.asset_lifecycle_event import AssetLifecycleEvent
from ..models.asset import Asset
from ..models.enums import AssetStatus


class OrderType(str, Enum):
    """时间轴排序类型枚举"""
    ASC = "asc"
    DESC = "desc"


class EventType(str, Enum):
    """
    生命周期事件类型枚举
    
    附录 B: 生命周期事件类型定义
    """
    PROCUREMENT = "采购入库"
    ASSIGNMENT = "领用"
    MAINTENANCE = "维修"
    RETIREMENT_APPLICATION = "报废申请"
    APPROVAL_PASS = "审批通过"
    APPROVAL_REJECT = "审批驳回"
    RETIREMENT_COMPLETE = "报废完成"
    STATUS_CHANGE = "状态变更"


class HistoryRepository:
    """
    资产生命周期历史记录仓储
    
    负责管理资产全生命周期的事件记录，支持：
    - 事件持久化（状态变更自动落库）
    - 时间轴查询（倒序/正序）
    - 按事件类型过滤
    - 历史只读查询（禁止修改/删除）
    
    性能约束:
        - 历史查询响应时间 ≤ 500ms
        - 单次操作响应时间 ≤ 200ms
    """
    
    def __init__(self, db: Session):
        """
        初始化历史记录仓储
        
        Args:
            db: 数据库会话实例
        """
        self.db = db
    
    def record_event(
        self,
        asset_id: str,
        event_type: EventType,
        operator_id: str,
        metadata: Optional[Dict[str, Any]] = None,
        timestamp: Optional[datetime] = None
    ) -> AssetLifecycleEvent:
        """
        记录生命周期事件
        
        触发时机：资产状态变更时自动落库
        
        Args:
            asset_id: 资产ID
            event_type: 事件类型 (EventType枚举)
            operator_id: 操作人ID
            metadata: 事件元数据（如审批意见、变更前后状态等）
            timestamp: 事件时间戳，默认当前时间
        
        Returns:
            AssetLifecycleEvent: 新创建的生命周期事件记录
        
        Raises:
            ValueError: 无效的事件类型或资产ID
        """
        if not asset_id:
            raise ValueError("资产ID不能为空")
        
        if not isinstance(event_type, EventType):
            raise ValueError(f"无效的事件类型: {event_type}")
        
        event = AssetLifecycleEvent(
            asset_id=asset_id,
            event_type=event_type.value,
            event_time=timestamp or datetime.utcnow(),
            operator_id=operator_id,
            metadata=metadata or {}
        )
        
        self.db.add(event)
        self.db.commit()
        self.db.refresh(event)
        
        return event
    
    def record_status_change(
        self,
        asset_id: str,
        from_status: AssetStatus,
        to_status: AssetStatus,
        operator_id: str,
        reason: Optional[str] = None
    ) -> AssetLifecycleEvent:
        """
        记录资产状态变更事件
        
        Args:
            asset_id: 资产ID
            from_status: 变更前状态
            to_status: 变更后状态
            operator_id: 操作人ID
            reason: 变更原因
        
        Returns:
            AssetLifecycleEvent: 状态变更事件记录
        """
        metadata = {
            "from_status": from_status.value if hasattr(from_status, 'value') else str(from_status),
            "to_status": to_status.value if hasattr(to_status, 'value') else str(to_status),
            "reason": reason
        }
        
        return self.record_event(
            asset_id=asset_id,
            event_type=EventType.STATUS_CHANGE,
            operator_id=operator_id,
            metadata=metadata
        )
    
    def record_retirement_application(
        self,
        asset_id: str,
        application_id: str,
        operator_id: str,
        reason: Optional[str] = None,
        estimated_value: Optional[float] = None
    ) -> AssetLifecycleEvent:
        """
        记录报废申请提交事件
        
        Args:
            asset_id: 资产ID
            application_id: 报废申请ID
            operator_id: 申请人ID
            reason: 报废原因
            estimated_value: 预估残值
        
        Returns:
            AssetLifecycleEvent: 报废申请事件记录
        """
        metadata = {
            "application_id": application_id,
            "reason": reason,
            "estimated_residual_value": estimated_value
        }
        
        return self.record_event(
            asset_id=asset_id,
            event_type=EventType.RETIREMENT_APPLICATION,
            operator_id=operator_id,
            metadata=metadata
        )
    
    def record_approval_action(
        self,
        asset_id: str,
        decision: Literal["approve", "reject"],
        approver_id: str,
        approval_level: int,
        comment: Optional[str] = None,
        rejection_reason: Optional[str] = None
    ) -> AssetLifecycleEvent:
        """
        记录审批动作事件（通过/驳回）
        
        Args:
            asset_id: 资产ID
            decision: 审批决定 (approve/reject)
            approver_id: 审批人ID
            approval_level: 审批层级
            comment: 审批意见
            rejection_reason: 驳回原因
        
        Returns:
            AssetLifecycleEvent: 审批动作事件记录
        """
        event_type = EventType.APPROVAL_PASS if decision == "approve" else EventType.APPROVAL_REJECT
        
        metadata = {
            "approval_level": approval_level,
            "decision": decision,
            "comment": comment,
            "rejection_reason": rejection_reason
        }
        
        return self.record_event(
            asset_id=asset_id,
            event_type=event_type,
            operator_id=approver_id,
            metadata=metadata
        )
    
    def record_retirement_complete(
        self,
        asset_id: str,
        operator_id: str,
        final_status: Literal["已报废", "已退役"],
        details: Optional[Dict[str, Any]] = None
    ) -> AssetLifecycleEvent:
        """
        记录报废完成事件
        
        Args:
            asset_id: 资产ID
            operator_id: 操作人ID
            final_status: 最终状态 (已报废/已退役)
            details: 报废详情
        
        Returns:
            AssetLifecycleEvent: 报废完成事件记录
        """
        metadata = {
            "final_status": final_status,
            "details": details or {}
        }
        
        return self.record_event(
            asset_id=asset_id,
            event_type=EventType.RETIREMENT_COMPLETE,
            operator_id=operator_id,
            metadata=metadata
        )
    
    def get_lifecycle_timeline(
        self,
        asset_id: str,
        order: OrderType = OrderType.DESC,
        event_type_filter: Optional[EventType] = None,
        limit: Optional[int] = None,
        offset: int = 0
    ) -> List[AssetLifecycleEvent]:
        """
        获取资产生命周期时间轴
        
        验收标准 (ATB-4):
            - 返回完整生命周期事件列表
            - 按时间倒序/正序排列
            - 性能要求: 响应时间 ≤ 500ms
        
        Args:
            asset_id: 资产ID
            order: 排序类型 (asc/desc)，默认倒序
            event_type_filter: 事件类型过滤条件
            limit: 返回记录数限制
            offset: 查询偏移量
        
        Returns:
            List[AssetLifecycleEvent]: 生命周期事件列表
        
        Raises:
            ValueError: 无效的资产ID
        """
        if not asset_id:
            raise ValueError("资产ID不能为空")
        
        query = self.db.query(AssetLifecycleEvent).filter(
            AssetLifecycleEvent.asset_id == asset_id
        )
        
        # 按事件类型过滤
        if event_type_filter and isinstance(event_type_filter, EventType):
            query = query.filter(
                AssetLifecycleEvent.event_type == event_type_filter.value
            )
        
        # 排序
        if order == OrderType.DESC:
            query = query.order_by(desc(AssetLifecycleEvent.event_time))
        else:
            query = query.order_by(asc(AssetLifecycleEvent.event_time))
        
        # 分页
        if offset:
            query = query.offset(offset)
        
        if limit:
            query = query.limit(limit)
        
        return query.all()
    
    def get_lifecycle_by_asset_id(
        self,
        asset_id: str,
        order: Literal["asc", "desc"] = "desc"
    ) -> Dict[str, Any]:
        """
        获取资产完整生命周期时间轴（API 返回格式）
        
        对应接口: GET /api/v1/assets/{id}/lifecycle
        
        Args:
            asset_id: 资产ID
            order: 排序方式 (asc/desc)
        
        Returns:
            Dict: 包含 timeline 列表的响应数据
                {
                    "asset_id": str,
                    "timeline": List[Dict],
                    "total": int
                }
        
        Raises:
            ValueError: 无效的资产ID
        """
        order_type = OrderType.DESC if order == "desc" else OrderType.ASC
        
        events = self.get_lifecycle_timeline(
            asset_id=asset_id,
            order=order_type
        )
        
        timeline = [
            {
                "id": event.id,
                "event_type": event.event_type,
                "event_time": event.event_time.isoformat() if event.event_time else None,
                "operator_id": event.operator_id,
                "metadata": event.metadata
            }
            for event in events
        ]
        
        return {
            "asset_id": asset_id,
            "timeline": timeline,
            "total": len(timeline)
        }
    
    def get_events_by_type(
        self,
        asset_id: str,
        event_type: EventType
    ) -> List[AssetLifecycleEvent]:
        """
        按事件类型查询历史记录
        
        验收标准 (ATB-4):
            - 支持 ?event_type=报废申请 过滤
        
        Args:
            asset_id: 资产ID
            event_type: 事件类型
        
        Returns:
            List[AssetLifecycleEvent]: 符合条件的事件列表
        """
        return self.get_lifecycle_timeline(
            asset_id=asset_id,
            event_type_filter=event_type
        )
    
    def get_recent_events(
        self,
        asset_id: str,
        hours: int = 72,
        limit: int = 10
    ) -> List[AssetLifecycleEvent]:
        """
        获取最近的事件记录（用于超时提醒）
        
        Args:
            asset_id: 资产ID
            hours: 时间范围（小时）
            limit: 返回记录数
        
        Returns:
            List[AssetLifecycleEvent]: 最近的事件列表
        """
        from datetime import timedelta
        
        cutoff_time = datetime.utcnow() - timedelta(hours=hours)
        
        return self.db.query(AssetLifecycleEvent).filter(
            and_(
                AssetLifecycleEvent.asset_id == asset_id,
                AssetLifecycleEvent.event_time >= cutoff_time
            )
        ).order_by(desc(AssetLifecycleEvent.event_time)).limit(limit).all()
    
    def get_approval_history(
        self,
        asset_id: str
    ) -> List[Dict[str, Any]]:
        """
        获取审批历史记录
        
        包含所有审批通过/驳回的事件
        
        Args:
            asset_id: 资产ID
        
        Returns:
            List[Dict]: 审批历史列表
        """
        approval_events = self.db.query(AssetLifecycleEvent).filter(
            and_(
                AssetLifecycleEvent.asset_id == asset_id,
                or_(
                    AssetLifecycleEvent.event_type == EventType.APPROVAL_PASS.value,
                    AssetLifecycleEvent.event_type == EventType.APPROVAL_REJECT.value
                )
            )
        ).order_by(asc(AssetLifecycleEvent.event_time)).all()
        
        return [
            {
                "level": event.metadata.get("approval_level"),
                "decision": event.metadata.get("decision"),
                "comment": event.metadata.get("comment"),
                "rejection_reason": event.metadata.get("rejection_reason"),
                "approver_id": event.operator_id,
                "event_time": event.event_time.isoformat() if event.event_time else None
            }
            for event in approval_events
        ]
    
    def count_events_by_type(
        self,
        asset_id: str,
        event_type: EventType
    ) -> int:
        """
        统计指定类型事件的数量
        
        Args:
            asset_id: 资产ID
            event_type: 事件类型
        
        Returns:
            int: 事件数量
        """
        return self.db.query(AssetLifecycleEvent).filter(
            and_(
                AssetLifecycleEvent.asset_id == asset_id,
                AssetLifecycleEvent.event_type == event_type.value
            )
        ).count()
    
    def validate_no_pending_retirement(self, asset_id: str) -> bool:
        """
        验证资产无进行中的报废申请（用于并发控制）
        
        禁止：同一资产并发发起多个报废申请
        
        Args:
            asset_id: 资产ID
        
        Returns:
            bool: True 表示无进行中的申请，False 表示存在进行中的申请
        """
        pending_count = self.db.query(AssetLifecycleEvent).filter(
            and_(
                AssetLifecycleEvent.asset_id == asset_id,
                AssetLifecycleEvent.event_type == EventType.RETIREMENT_APPLICATION.value,
                AssetLifecycleEvent.event_time >= datetime.utcnow()
            )
        ).count()
        
        return pending_count == 0
    
    def get_asset_status_at_time(
        self,
        asset_id: str,
        timestamp: datetime
    ) -> Optional[str]:
        """
        查询资产在指定时刻的状态
        
        Args:
            asset_id: 资产ID
            timestamp: 查询时间点
        
        Returns:
            Optional[str]: 当时的资产状态，如果无法确定则返回None
        """
        event = self.db.query(AssetLifecycleEvent).filter(
            and_(
                AssetLifecycleEvent.asset_id == asset_id,
                AssetLifecycleEvent.event_type == EventType.STATUS_CHANGE.value,
                AssetLifecycleEvent.event_time <= timestamp
            )
        ).order_by(desc(AssetLifecycleEvent.event_time)).first()
        
        if event and event.metadata:
            return event.metadata.get("to_status")
        
        return None