"""
历史记录实体模块 - 资产状态流转引擎与事件溯源存储层

提供资产管理全生命周期状态变更的不可变事件记录，
支持状态迁移历史查询与审批链轨迹追踪。

核心功能:
- 状态变更事件的创建与持久化
- 历史记录的时序查询接口
- 事件溯源模式的不可变性保证
"""

from datetime import datetime
from enum import Enum
from typing import Any, Dict, List, Optional
from dataclasses import dataclass, field
import uuid


class EventType(str, Enum):
    """
    事件类型枚举 - 定义所有可追溯的操作类型
    
    状态:
        - SUBMITTED: 退役申请提交
        - APPROVED: 审批通过
        - REJECTED: 审批拒绝
        - REVERTED: 状态回退
        - COMPLETED: 流程完成
        - CANCELLED: 流程取消
    """
    SUBMITTED = "submitted"
    APPROVED = "approved"
    REJECTED = "rejected"
    REVERTED = "reverted"
    COMPLETED = "completed"
    CANCELLED = "cancelled"
    STATUS_CHANGED = "status_changed"


class ApprovalStage(str, Enum):
    """
    审批阶段枚举 - 定义审批链层级
    
    状态:
        - PENDING: 待审批
        - FIRST_APPROVAL: 初审
        - FINAL_APPROVAL: 终审
        - COMPLETED: 审批完成
        - REJECTED: 已否决
    """
    PENDING = "pending"
    FIRST_APPROVAL = "first_approval"
    FINAL_APPROVAL = "final_approval"
    COMPLETED = "completed"
    REJECTED = "rejected"


@dataclass
class Actor:
    """
    操作参与者值对象
    
    属性:
        user_id: 用户ID
        role: 角色 (申请人/审批人/终审人)
        username: 用户名
    """
    user_id: str
    role: str
    username: str
    
    def to_dict(self) -> Dict[str, str]:
        """转换为字典格式"""
        return {
            "user_id": self.user_id,
            "role": self.role,
            "username": self.username
        }


@dataclass
class StateTransition:
    """
    状态迁移记录值对象
    
    属性:
        from_state: 源状态
        to_state: 目标状态
        reason: 迁移原因
        metadata: 附加元数据
    """
    from_state: str
    to_state: str
    reason: str = ""
    metadata: Dict[str, Any] = field(default_factory=dict)
    
    def to_dict(self) -> Dict[str, Any]:
        """转换为字典格式"""
        return {
            "from_state": self.from_state,
            "to_state": self.to_state,
            "reason": self.reason,
            "metadata": self.metadata
        }


@dataclass
class LifecycleEvent:
    """
    生命周期事件 - 不可变的事件记录
    
    这是事件溯源模式的核心数据结构，每次状态变更都会产生
    一个新的事件记录，确保历史可追溯且不可篡改。
    
    属性:
        event_id: 事件唯一标识 (UUID)
        asset_id: 资产ID
        event_type: 事件类型
        timestamp: 事件发生时间
        actor: 操作参与者
        transition: 状态迁移信息
        approval_stage: 当前审批阶段
        workflow_instance_id: 流程实例ID
        payload: 附加数据 payload
        checksum: 数据校验和 (用于不可篡改性验证)
    """
    event_id: str
    asset_id: str
    event_type: EventType
    timestamp: datetime
    actor: Actor
    transition: StateTransition
    approval_stage: ApprovalStage
    workflow_instance_id: Optional[str] = None
    payload: Dict[str, Any] = field(default_factory=dict)
    checksum: Optional[str] = None
    
    def __post_init__(self):
        """初始化后自动生成校验和"""
        if self.checksum is None:
            self.checksum = self._generate_checksum()
    
    def _generate_checksum(self) -> str:
        """
        生成事件校验和
        
        用于验证事件记录的不可篡改性。
        校验和基于事件的关键属性计算。
        
        返回:
            32位 MD5 校验和字符串
        """
        import hashlib
        
        data = (
            f"{self.event_id}"
            f"{self.asset_id}"
            f"{self.event_type.value}"
            f"{self.timestamp.isoformat()}"
            f"{self.actor.user_id}"
            f"{self.transition.from_state}"
            f"{self.transition.to_state}"
        )
        return hashlib.md5(data.encode()).hexdigest()
    
    def verify_integrity(self) -> bool:
        """
        验证事件完整性
        
        重新计算校验和并与存储的校验和对比，
        确保事件数据未被篡改。
        
        返回:
            True 如果校验通过，False 如果数据被篡改
        """
        expected_checksum = self._generate_checksum()
        return self.checksum == expected_checksum
    
    def to_dict(self) -> Dict[str, Any]:
        """
        转换为字典格式
        
        用于序列化存储或 API 响应。
        
        返回:
            事件记录的字典表示
        """
        return {
            "event_id": self.event_id,
            "asset_id": self.asset_id,
            "event_type": self.event_type.value,
            "timestamp": self.timestamp.isoformat(),
            "actor": self.actor.to_dict(),
            "transition": self.transition.to_dict(),
            "approval_stage": self.approval_stage.value,
            "workflow_instance_id": self.workflow_instance_id,
            "payload": self.payload,
            "checksum": self.checksum
        }
    
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "LifecycleEvent":
        """
        从字典创建事件实例
        
        用于反序列化存储的事件记录。
        
        参数:
            data: 事件记录的字典表示
            
        返回:
            LifecycleEvent 实例
        """
        return cls(
            event_id=data["event_id"],
            asset_id=data["asset_id"],
            event_type=EventType(data["event_type"]),
            timestamp=datetime.fromisoformat(data["timestamp"]),
            actor=Actor(
                user_id=data["actor"]["user_id"],
                role=data["actor"]["role"],
                username=data["actor"]["username"]
            ),
            transition=StateTransition(
                from_state=data["transition"]["from_state"],
                to_state=data["transition"]["to_state"],
                reason=data["transition"].get("reason", ""),
                metadata=data["transition"].get("metadata", {})
            ),
            approval_stage=ApprovalStage(data["approval_stage"]),
            workflow_instance_id=data.get("workflow_instance_id"),
            payload=data.get("payload", {}),
            checksum=data.get("checksum")
        )


class HistoryRecord:
    """
    历史记录聚合根
    
    管理单个资产的生命周期事件序列，
    提供事件查询与统计分析接口。
    
    设计原则:
    - 事件仅追加，不修改
    - 保证查询性能的同时维持事件顺序
    - 支持按时间范围、事件类型、参与者等维度查询
    
    属性:
        asset_id: 资产ID
        events: 事件列表 (按时间顺序)
    """
    
    def __init__(self, asset_id: str):
        """
        初始化历史记录
        
        参数:
            asset_id: 资产唯一标识
        """
        self.asset_id = asset_id
        self.events: List[LifecycleEvent] = []
    
    def add_event(self, event: LifecycleEvent) -> None:
        """
        添加新事件
        
        事件一旦添加即不可修改，保证不可篡改性。
        新事件的时间戳必须晚于最后一条记录。
        
        参数:
            event: 要添加的生命周期事件
            
        异常:
            ValueError: 如果事件时间戳早于最后记录
        """
        if self.events and event.timestamp < self.events[-1].timestamp:
            raise ValueError(
                f"事件时间戳必须晚于最后记录: "
                f"最后记录={self.events[-1].timestamp}, "
                f"新事件={event.timestamp}"
            )
        self.events.append(event)
    
    def get_events_by_type(
        self, 
        event_type: EventType
    ) -> List[LifecycleEvent]:
        """
        按事件类型查询
        
        参数:
            event_type: 要查询的事件类型
            
        返回:
            匹配的事件列表
        """
        return [e for e in self.events if e.event_type == event_type]
    
    def get_events_by_stage(
        self, 
        stage: ApprovalStage
    ) -> List[LifecycleEvent]:
        """
        按审批阶段查询
        
        参数:
            stage: 要查询的审批阶段
            
        返回:
            匹配的事件列表
        """
        return [e for e in self.events if e.approval_stage == stage]
    
    def get_events_in_range(
        self,
        start: datetime,
        end: datetime
    ) -> List[LifecycleEvent]:
        """
        按时间范围查询
        
        参数:
            start: 起始时间 (包含)
            end: 结束时间 (包含)
            
        返回:
            时间范围内的所有事件
        """
        return [
            e for e in self.events 
            if start <= e.timestamp <= end
        ]
    
    def get_latest_event(self) -> Optional[LifecycleEvent]:
        """
        获取最新事件
        
        返回:
            最新的事件记录，如果没有记录则返回 None
        """
        return self.events[-1] if self.events else None
    
    def get_current_state(self) -> Optional[str]:
        """
        获取当前状态
        
        基于最后一条状态变更事件确定资产当前状态。
        
        返回:
            当前状态字符串，如果没有状态记录则返回 None
        """
        latest = self.get_latest_event()
        return latest.transition.to_state if latest else None
    
    def get_approval_progress(self) -> Dict[str, Any]:
        """
        获取审批进度信息
        
        返回:
            包含审批阶段、已审批次数、待审批角色等信息的字典
        """
        if not self.events:
            return {
                "current_stage": None,
                "approved_count": 0,
                "rejected": False,
                "pending_roles": []
            }
        
        latest = self.get_latest_event()
        approved_count = len(self.get_events_by_type(EventType.APPROVED))
        
        pending_roles = []
        if latest.approval_stage == ApprovalStage.PENDING:
            pending_roles = ["申请人"]
        elif latest.approval_stage == ApprovalStage.FIRST_APPROVAL:
            pending_roles = ["审批人"]
        elif latest.approval_stage == ApprovalStage.FINAL_APPROVAL:
            pending_roles = ["终审人"]
        
        return {
            "current_stage": latest.approval_stage.value,
            "approved_count": approved_count,
            "rejected": latest.approval_stage == ApprovalStage.REJECTED,
            "pending_roles": pending_roles,
            "workflow_instance_id": latest.workflow_instance_id
        }
    
    def to_dict(self) -> Dict[str, Any]:
        """
        转换为字典格式
        
        返回:
            完整历史记录的字典表示
        """
        return {
            "asset_id": self.asset_id,
            "events": [e.to_dict() for e in self.events],
            "event_count": len(self.events),
            "current_state": self.get_current_state()
        }
    
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "HistoryRecord":
        """
        从字典创建历史记录
        
        参数:
            data: 字典数据
            
        返回:
            HistoryRecord 实例
        """
        record = cls(asset_id=data["asset_id"])
        record.events = [
            LifecycleEvent.from_dict(e) for e in data.get("events", [])
        ]
        return record
    
    def verify_all_events_integrity(self) -> bool:
        """
        验证所有事件的完整性
        
        遍历所有事件，验证每个事件的校验和。
        用于批量数据完整性检查。
        
        返回:
            True 如果所有事件都通过完整性验证
        """
        return all(e.verify_integrity() for e in self.events)


class HistoryRepository:
    """
    历史记录仓储接口
    
    定义历史记录的持久化操作接口。
    具体实现由基础设施层提供。
    
    设计原则:
    - 兼容现有资产目录数据结构
    - 支持原子化写入 (与状态变更事务绑定)
    - 提供高效查询接口
    """
    
    def save(self, event: LifecycleEvent) -> bool:
        """
        保存单个事件
        
        参数:
            event: 要保存的事件
            
        返回:
            True 如果保存成功
        """
        raise NotImplementedError("子类必须实现 save 方法")
    
    def save_batch(self, events: List[LifecycleEvent]) -> bool:
        """
        批量保存事件
        
        用于原子化写入多个相关事件。
        
        参数:
            events: 事件列表
            
        返回:
            True 如果全部保存成功
        """
        raise NotImplementedError("子类必须实现 save_batch 方法")
    
    def find_by_asset_id(
        self,
        asset_id: str
    ) -> List[LifecycleEvent]:
        """
        查询资产的所有历史事件
        
        参数:
            asset_id: 资产ID
            
        返回:
            按时间排序的事件列表
        """
        raise NotImplementedError("子类必须实现 find_by_asset_id 方法")
    
    def find_by_workflow_id(
        self,
        workflow_instance_id: str
    ) -> List[LifecycleEvent]:
        """
        按流程实例ID查询事件
        
        参数:
            workflow_instance_id: 流程实例ID
            
        返回:
            关联的事件列表
        """
        raise NotImplementedError("子类必须实现 find_by_workflow_id 方法")
    
    def find_by_event_type(
        self,
        asset_id: str,
        event_type: EventType
    ) -> List[LifecycleEvent]:
        """
        按事件类型查询
        
        参数:
            asset_id: 资产ID
            event_type: 事件类型
            
        返回:
            匹配的事件列表
        """
        raise NotImplementedError("子类必须实现 find_by_event_type 方法")


class InMemoryHistoryRepository(HistoryRepository):
    """
    内存历史记录仓储 (用于测试)
    
    提供基于内存的简单实现，用于单元测试和演示。
    生产环境应使用数据库仓储实现。
    """
    
    def __init__(self):
        """初始化内存存储"""
        self._events: Dict[str, List[LifecycleEvent]] = {}
    
    def save(self, event: LifecycleEvent) -> bool:
        """保存单个事件"""
        if event.asset_id not in self._events:
            self._events[event.asset_id] = []
        self._events[event.asset_id].append(event)
        return True
    
    def save_batch(self, events: List[LifecycleEvent]) -> bool:
        """批量保存事件"""
        for event in events:
            if not self.save(event):
                return False
        return True
    
    def find_by_asset_id(
        self,
        asset_id: str
    ) -> List[LifecycleEvent]:
        """查询资产的所有历史事件"""
        return sorted(
            self._events.get(asset_id, []),
            key=lambda e: e.timestamp
        )
    
    def find_by_workflow_id(
        self,
        workflow_instance_id: str
    ) -> List[LifecycleEvent]:
        """按流程实例ID查询事件"""
        results = []
        for events in self._events.values():
            results.extend(
                e for e in events
                if e.workflow_instance_id == workflow_instance_id
            )
        return sorted(results, key=lambda e: e.timestamp)
    
    def find_by_event_type(
        self,
        asset_id: str,
        event_type: EventType
    ) -> List[LifecycleEvent]:
        """按事件类型查询"""
        return [
            e for e in self.find_by_asset_id(asset_id)
            if e.event_type == event_type
        ]
    
    def clear(self) -> None:
        """清空所有数据 (用于测试)"""
        self._events.clear()


def create_submission_event(
    asset_id: str,
    actor: Actor,
    from_state: str,
    to_state: str,
    workflow_instance_id: Optional[str] = None,
    reason: str = ""
) -> LifecycleEvent:
    """
    创建退役申请提交事件
    
    工厂函数，用于创建标准化的提交事件。
    
    参数:
        asset_id: 资产ID
        actor: 操作参与者
        from_state: 源状态
        to_state: 目标状态
        workflow_instance_id: 流程实例ID
        reason: 申请原因
        
    返回:
        新创建的 LifecycleEvent 实例
    """
    return LifecycleEvent(
        event_id=str(uuid.uuid4()),
        asset_id=asset_id,
        event_type=EventType.SUBMITTED,
        timestamp=datetime.utcnow(),
        actor=actor,
        transition=StateTransition(
            from_state=from_state,
            to_state=to_state,
            reason=reason
        ),
        approval_stage=ApprovalStage.PENDING,
        workflow_instance_id=workflow_instance_id
    )


def create_approval_event(
    asset_id: str,
    actor: Actor,
    from_stage: ApprovalStage,
    to_stage: ApprovalStage,
    workflow_instance_id: Optional[str] = None,
    comment: str = ""
) -> LifecycleEvent:
    """
    创建审批通过事件
    
    工厂函数，用于创建标准化的审批事件。
    
    参数:
        asset_id: 资产ID
        actor: 操作参与者
        from_stage: 原审批阶段
        to_stage: 新审批阶段
        workflow_instance_id: 流程实例ID
        comment: 审批意见
        
    返回:
        新创建的 LifecycleEvent 实例
    """
    return LifecycleEvent(
        event_id=str(uuid.uuid4()),
        asset_id=asset_id,
        event_type=EventType.APPROVED,
        timestamp=datetime.utcnow(),
        actor=actor,
        transition=StateTransition(
            from_state=from_stage.value,
            to_state=to_stage.value,
            reason=comment
        ),
        approval_stage=to_stage,
        workflow_instance_id=workflow_instance_id,
        payload={"comment": comment}
    )


def create_rejection_event(
    asset_id: str,
    actor: Actor,
    current_stage: ApprovalStage,
    workflow_instance_id: Optional[str] = None,
    reason: str = ""
) -> LifecycleEvent:
    """
    创建审批拒绝事件
    
    工厂函数，用于创建标准化的拒绝事件。
    拒绝事件会将流程标记为"已否决"。
    
    参数:
        asset_id: 资产ID
        actor: 操作参与者
        current_stage: 当前审批阶段
        workflow_instance_id: 流程实例ID
        reason: 拒绝原因
        
    返回:
        新创建的 LifecycleEvent 实例
    """
    return LifecycleEvent(
        event_id=str(uuid.uuid4()),
        asset_id=asset_id,
        event_type=EventType.REJECTED,
        timestamp=datetime.utcnow(),
        actor=actor,
        transition=StateTransition(
            from_state=current_stage.value,
            to_state=ApprovalStage.REJECTED.value,
            reason=reason
        ),
        approval_stage=ApprovalStage.REJECTED,
        workflow_instance_id=workflow_instance_id,
        payload={"rejection_reason": reason}
    )


def create_completion_event(
    asset_id: str,
    actor: Actor,
    workflow_instance_id: Optional[str] = None
) -> LifecycleEvent:
    """
    创建流程完成事件
    
    工厂函数，用于创建标准化的完成事件。
    表示资产退役流程全部审批通过。
    
    参数:
        asset_id: 资产ID
        actor: 操作参与者
        workflow_instance_id: 流程实例ID
        
    返回:
        新创建的 LifecycleEvent 实例
    """
    return LifecycleEvent(
        event_id=str(uuid.uuid4()),
        asset_id=asset_id,
        event_type=EventType.COMPLETED,
        timestamp=datetime.utcnow(),
        actor=actor,
        transition=StateTransition(
            from_state="in_approval",
            to_state="retired",
            reason="所有审批流程完成"
        ),
        approval_stage=ApprovalStage.COMPLETED,
        workflow_instance_id=workflow_instance_id
    )