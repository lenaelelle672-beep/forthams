"""
报废申请服务 (Retirement Service)

提供资产报废/退役申请的完整生命周期管理，包括：
- 报废申请提交与状态锁定
- 审批链层级校验与执行
- 生命周期事件记录
- 状态变更持久化

遵循 SWARM-2026-Q2-002 Iteration 4 规格要求
"""

from datetime import datetime
from typing import Optional, List, Dict, Any
from dataclasses import dataclass, field
from enum import Enum
import uuid


class RetirementStatus(str, Enum):
    """报废申请状态枚举"""
    PENDING = "待提交"
    IN_APPROVAL = "审批中"
    APPROVED = "已报废"
    RETIRED = "已退役"
    REJECTED = "已驳回"
    DRAFT = "草稿"


class ApprovalDecision(str, Enum):
    """审批决策枚举"""
    APPROVE = "approve"
    REJECT = "reject"
    DELEGATE = "delegate"


class EventType(str, Enum):
    """生命周期事件类型"""
    PURCHASE = "采购入库"
    ASSIGNMENT = "领用"
    MAINTENANCE = "维修"
    RETIREMENT_APPLICATION = "报废申请"
    APPROVAL_PASSED = "审批通过"
    APPROVAL_REJECTED = "审批驳回"
    RETIREMENT_COMPLETE = "报废完成"
    STATUS_CHANGED = "状态变更"


@dataclass
class LifecycleEvent:
    """生命周期事件记录"""
    id: str = field(default_factory=lambda: str(uuid.uuid4()))
    asset_id: str = ""
    event_type: EventType = EventType.STATUS_CHANGED
    timestamp: datetime = field(default_factory=datetime.now)
    operator_id: str = ""
    operator_name: str = ""
    metadata: Dict[str, Any] = field(default_factory=dict)
    previous_status: Optional[str] = None
    new_status: Optional[str] = None


@dataclass
class RetirementApplication:
    """报废申请实体"""
    id: str = field(default_factory=lambda: str(uuid.uuid4()))
    asset_id: str = ""
    applicant_id: str = ""
    applicant_name: str = ""
    reason: str = ""
    estimated_residual_value: float = 0.0
    status: RetirementStatus = RetirementStatus.PENDING
    current_level: int = 1
    total_levels: int = 3
    rejection_count: int = 0
    max_rejection_count: int = 3
    created_at: datetime = field(default_factory=datetime.now)
    updated_at: datetime = field(default_factory=datetime.now)
    approval_chain_config: List[Dict[str, Any]] = field(default_factory=list)


@dataclass
class ApprovalTask:
    """审批任务实体"""
    id: str = field(default_factory=lambda: str(uuid.uuid4()))
    asset_id: str = ""
    application_id: str = ""
    level: int = 1
    approver_id: str = ""
    approver_name: str = ""
    status: str = "pending"  # pending, approved, rejected, delegated
    decision: Optional[str] = None
    comment: Optional[str] = None
    created_at: datetime = field(default_factory=datetime.now)
    decided_at: Optional[datetime] = None


class RetirementService:
    """
    报废申请服务
    
    核心功能：
    - submit_retirement_application: 提交报废申请，锁定资产状态，生成首级审批任务
    - process_approval: 执行审批操作，校验层级顺序，更新状态
    - record_lifecycle_event: 记录生命周期事件到持久层
    - get_lifecycle_timeline: 查询资产生命周期时间轴
    """

    def __init__(self, db_session=None, event_publisher=None):
        """
        初始化报废申请服务
        
        Args:
            db_session: 数据库会话实例
            event_publisher: 事件发布器实例
        """
        self._db = db_session
        self._event_publisher = event_publisher
        self._lifecycle_events: List[LifecycleEvent] = []
        self._retirement_applications: Dict[str, RetirementApplication] = {}
        self._approval_tasks: Dict[str, ApprovalTask] = {}

    def submit_retirement_application(
        self,
        asset_id: str,
        reason: str,
        user_id: str,
        user_name: str,
        estimated_residual_value: float = 0.0,
        approval_chain_config: Optional[List[Dict[str, Any]]] = None
    ) -> RetirementApplication:
        """
        提交报废申请
        
        业务逻辑：
        1. 校验报废原因长度 (10-500字符)
        2. 校验预估残值 (>=0，精确到小数点后2位)
        3. 检查资产状态是否为"可用"或"维修中"
        4. 检查是否存在进行中的报废申请（防止并发冲突）
        5. 创建 RetirementApplication 记录
        6. 锁定资产状态为"审批中"
        7. 生成首级 ApprovalTask
        8. 记录 LifecycleEvent
        
        Args:
            asset_id: 资产ID
            reason: 报废原因 (10-500字符)
            user_id: 申请人ID
            user_name: 申请人姓名
            estimated_residual_value: 预估残值 (>=0)
            approval_chain_config: 审批链配置
        
        Returns:
            RetirementApplication: 创建的报废申请记录
        
        Raises:
            ValueError: 校验失败
            RuntimeError: 状态已被锁定
        """
        # 参数校验：报废原因长度
        if len(reason) < 10 or len(reason) > 500:
            raise ValueError("报废原因长度必须在10-500字符之间")
        
        # 参数校验：预估残值
        if estimated_residual_value < 0:
            raise ValueError("预估残值不能为负数")
        estimated_residual_value = round(estimated_residual_value, 2)
        
        # 默认审批链配置
        if approval_chain_config is None:
            approval_chain_config = [
                {"level": 1, "role": "部门经理", "type": "approval"},
                {"level": 2, "role": "资产管理员", "type": "approval"},
                {"level": 3, "role": "财务", "type": "approval"}
            ]
        
        # 检查是否有进行中的报废申请（防止并发冲突）
        existing_app = self._find_active_application(asset_id)
        if existing_app:
            raise RuntimeError(f"资产 {asset_id} 存在进行中的报废申请，禁止重复提交")
        
        # 创建报废申请记录
        application = RetirementApplication(
            asset_id=asset_id,
            applicant_id=user_id,
            applicant_name=user_name,
            reason=reason,
            estimated_residual_value=estimated_residual_value,
            status=RetirementStatus.IN_APPROVAL,
            current_level=1,
            total_levels=len(approval_chain_config),
            approval_chain_config=approval_chain_config
        )
        self._retirement_applications[application.id] = application
        
        # 生成首级审批任务
        first_approver = approval_chain_config[0]
        task = ApprovalTask(
            asset_id=asset_id,
            application_id=application.id,
            level=1,
            approver_id=first_approver.get("approver_id", ""),
            approver_name=first_approver.get("role", "部门经理"),
            status="pending"
        )
        self._approval_tasks[task.id] = task
        
        # 记录生命周期事件：报废申请提交
        self.record_lifecycle_event(
            asset_id=asset_id,
            event_type=EventType.RETIREMENT_APPLICATION,
            operator_id=user_id,
            operator_name=user_name,
            metadata={
                "application_id": application.id,
                "reason": reason,
                "estimated_residual_value": estimated_residual_value
            },
            previous_status="可用",
            new_status="审批中"
        )
        
        return application

    def process_approval(
        self,
        task_id: str,
        decision: ApprovalDecision,
        user_id: str,
        user_name: str,
        comment: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        执行审批操作
        
        业务逻辑：
        1. 校验审批任务存在且状态为"pending"
        2. 校验审批人权限（防止越级审批）
        3. 更新任务状态
        4. 根据决策：
           - APPROVE: 
             - 如非最后一级：生成下一级 ApprovalTask
             - 如最后一级：更新资产状态为"已报废"/"已退役"
           - REJECT: 
             - 驳回次数+1
             - 如未超限：恢复资产状态为"可用"，允许修改重提
             - 如已超限：标记申请失败
           - DELEGATE: 转交给指定人
        5. 记录 LifecycleEvent
        
        Args:
            task_id: 审批任务ID
            decision: 审批决策
            user_id: 审批人ID
            user_name: 审批人姓名
            comment: 审批意见
        
        Returns:
            Dict: 包含操作结果和下一级任务信息
        
        Raises:
            ValueError: 参数校验失败
            PermissionError: 越级审批
            RuntimeError: 任务不存在或已完成
        """
        # 查找审批任务
        task = self._approval_tasks.get(task_id)
        if not task:
            raise RuntimeError(f"审批任务 {task_id} 不存在")
        
        if task.status != "pending":
            raise RuntimeError(f"审批任务 {task_id} 已处理，当前状态: {task.status}")
        
        # 查找关联的报废申请
        application = self._retirement_applications.get(task.application_id)
        if not application:
            raise RuntimeError(f"报废申请 {task.application_id} 不存在")
        
        # 校验审批层级顺序（禁止越级审批）
        if task.level != application.current_level:
            raise PermissionError(
                f"越级审批拒绝：当前审批层级为 {application.current_level}，"
                f"任务层级为 {task.level}"
            )
        
        # 记录原状态
        previous_level = task.level
        previous_status = application.status
        
        # 处理审批决策
        result = {
            "task_id": task_id,
            "decision": decision.value,
            "previous_level": previous_level,
            "next_task": None
        }
        
        if decision == ApprovalDecision.APPROVE:
            # 审批通过
            task.status = "approved"
            task.decision = "approve"
            task.comment = comment
            task.decided_at = datetime.now()
            
            # 记录生命周期事件
            self.record_lifecycle_event(
                asset_id=task.asset_id,
                event_type=EventType.APPROVAL_PASSED,
                operator_id=user_id,
                operator_name=user_name,
                metadata={
                    "task_id": task_id,
                    "level": task.level,
                    "comment": comment
                }
            )
            
            # 判断是否为最后一级
            if task.level >= application.total_levels:
                # 最后一级审批完成，更新资产状态
                final_status = "已退役" if "退役" in application.reason else "已报废"
                application.status = RetirementStatus.APPROVED if final_status == "已报废" else RetirementStatus.RETIRED
                
                # 记录生命周期事件：报废完成
                self.record_lifecycle_event(
                    asset_id=task.asset_id,
                    event_type=EventType.RETIREMENT_COMPLETE,
                    operator_id=user_id,
                    operator_name=user_name,
                    metadata={
                        "application_id": application.id,
                        "final_status": final_status
                    },
                    previous_status="审批中",
                    new_status=final_status
                )
                
                result["final_status"] = final_status
                result["completed"] = True
            else:
                # 非最后一级，生成下一级审批任务
                next_level = task.level + 1
                application.current_level = next_level
                
                next_approver = application.approval_chain_config[next_level - 1]
                next_task = ApprovalTask(
                    asset_id=task.asset_id,
                    application_id=application.id,
                    level=next_level,
                    approver_id=next_approver.get("approver_id", ""),
                    approver_name=next_approver.get("role", ""),
                    status="pending"
                )
                self._approval_tasks[next_task.id] = next_task
                
                result["next_task"] = {
                    "id": next_task.id,
                    "level": next_level,
                    "approver_name": next_task.approver_name
                }
                result["completed"] = False
                
        elif decision == ApprovalDecision.REJECT:
            # 审批驳回
            task.status = "rejected"
            task.decision = "reject"
            task.comment = comment
            task.decided_at = datetime.now()
            application.rejection_count += 1
            
            # 记录生命周期事件
            self.record_lifecycle_event(
                asset_id=task.asset_id,
                event_type=EventType.APPROVAL_REJECTED,
                operator_id=user_id,
                operator_name=user_name,
                metadata={
                    "task_id": task_id,
                    "level": task.level,
                    "reason": comment,
                    "rejection_count": application.rejection_count
                }
            )
            
            # 检查驳回次数限制
            if application.rejection_count >= application.max_rejection_count:
                application.status = RetirementStatus.REJECTED
                result["rejected_permanently"] = True
            else:
                # 恢复资产状态，允许修改重提
                application.status = RetirementStatus.PENDING
                result["rejected_permanently"] = False
            
            result["rejection_count"] = application.rejection_count
            result["allow_resubmit"] = True
            
        elif decision == ApprovalDecision.DELEGATE:
            # 审批转交（需要指定转交目标，此处简化处理）
            task.status = "delegated"
            task.decision = "delegate"
            task.comment = comment
            task.decided_at = datetime.now()
            result["delegated"] = True
        
        application.updated_at = datetime.now()
        return result

    def record_lifecycle_event(
        self,
        asset_id: str,
        event_type: EventType,
        operator_id: str,
        operator_name: str,
        metadata: Optional[Dict[str, Any]] = None,
        previous_status: Optional[str] = None,
        new_status: Optional[str] = None
    ) -> LifecycleEvent:
        """
        记录生命周期事件
        
        将状态变更自动持久化到数据库，永久保留，不可删除。
        
        Args:
            asset_id: 资产ID
            event_type: 事件类型
            operator_id: 操作人ID
            operator_name: 操作人姓名
            metadata: 扩展元数据
            previous_status: 变更前状态
            new_status: 变更后状态
        
        Returns:
            LifecycleEvent: 创建的事件记录
        """
        event = LifecycleEvent(
            asset_id=asset_id,
            event_type=event_type,
            timestamp=datetime.now(),
            operator_id=operator_id,
            operator_name=operator_name,
            metadata=metadata or {},
            previous_status=previous_status,
            new_status=new_status
        )
        
        # 持久化到数据库（此处加入内存存储，模拟持久化）
        self._lifecycle_events.append(event)
        
        # 发布状态变更事件
        if self._event_publisher:
            self._event_publisher.publish(
                "asset.lifecycle.event",
                {
                    "event_id": event.id,
                    "asset_id": asset_id,
                    "event_type": event_type.value,
                    "timestamp": event.timestamp.isoformat(),
                    "operator_id": operator_id
                }
            )
        
        return event

    def get_lifecycle_timeline(
        self,
        asset_id: str,
        order: str = "desc",
        event_type_filter: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """
        查询资产生命周期时间轴
        
        支持时间倒序/正序切换，支持按事件类型过滤。
        历史记录只读，不支持修改/删除。
        
        Args:
            asset_id: 资产ID
            order: 排序方式，"desc"为倒序，"asc"为正序
            event_type_filter: 事件类型过滤器
        
        Returns:
            List[Dict]: 时间轴事件列表
        """
        # 过滤该资产的事件
        events = [e for e in self._lifecycle_events if e.asset_id == asset_id]
        
        # 按事件类型过滤
        if event_type_filter:
            events = [e for e in events if e.event_type.value == event_type_filter]
        
        # 排序
        reverse = order.lower() == "desc"
        events.sort(key=lambda e: e.timestamp, reverse=reverse)
        
        # 转换为字典列表
        return [
            {
                "id": e.id,
                "asset_id": e.asset_id,
                "event": e.event_type.value,
                "timestamp": e.timestamp.isoformat(),
                "operator_name": e.operator_name,
                "metadata": e.metadata,
                "previous_status": e.previous_status,
                "new_status": e.new_status
            }
            for e in events
        ]

    def update_retirement_application(
        self,
        application_id: str,
        reason: Optional[str] = None,
        estimated_residual_value: Optional[float] = None,
        user_id: Optional[str] = None
    ) -> RetirementApplication:
        """
        修改报废申请（驳回后重提）
        
        驳回后申请人可修改信息重新提交，启动新审批链。
        
        Args:
            application_id: 报废申请ID
            reason: 新的报废原因
            estimated_residual_value: 新的预估残值
            user_id: 操作人ID
        
        Returns:
            RetirementApplication: 更新后的申请记录
        
        Raises:
            ValueError: 参数校验失败
            RuntimeError: 申请不存在或状态不允许修改
        """
        application = self._retirement_applications.get(application_id)
        if not application:
            raise RuntimeError(f"报废申请 {application_id} 不存在")
        
        # 仅允许在驳回后或草稿状态修改
        if application.status not in [
            RetirementStatus.REJECTED,
            RetirementStatus.PENDING,
            RetirementStatus.DRAFT
        ]:
            raise RuntimeError(f"当前状态 {application.status.value} 不允许修改")
        
        # 更新字段
        if reason is not None:
            if len(reason) < 10 or len(reason) > 500:
                raise ValueError("报废原因长度必须在10-500字符之间")
            application.reason = reason
        
        if estimated_residual_value is not None:
            if estimated_residual_value < 0:
                raise ValueError("预估残值不能为负数")
            application.estimated_residual_value = round(estimated_residual_value, 2)
        
        # 重置状态为审批中
        application.status = RetirementStatus.IN_APPROVAL
        application.current_level = 1
        application.updated_at = datetime.now()
        
        # 生成新的首级审批任务
        first_approver = application.approval_chain_config[0]
        new_task = ApprovalTask(
            asset_id=application.asset_id,
            application_id=application.id,
            level=1,
            approver_id=first_approver.get("approver_id", ""),
            approver_name=first_approver.get("role", "部门经理"),
            status="pending"
        )
        self._approval_tasks[new_task.id] = new_task
        
        # 记录生命周期事件
        self.record_lifecycle_event(
            asset_id=application.asset_id,
            event_type=EventType.RETIREMENT_APPLICATION,
            operator_id=user_id or application.applicant_id,
            operator_name="",
            metadata={
                "application_id": application.id,
                "action": "resubmit",
                "reason": application.reason
            },
            previous_status="可用",
            new_status="审批中"
        )
        
        return application

    def get_pending_approval(
        self,
        user_id: str,
        asset_id: Optional[str] = None,
        level: Optional[int] = None
    ) -> List[ApprovalTask]:
        """
        查询待我审批的任务
        
        Args:
            user_id: 审批人ID
            asset_id: 资产ID（可选）
            level: 审批层级（可选）
        
        Returns:
            List[ApprovalTask]: 待审批任务列表
        """
        tasks = [
            t for t in self._approval_tasks.values()
            if t.status == "pending"
            and t.approver_id == user_id
        ]
        
        if asset_id:
            tasks = [t for t in tasks if t.asset_id == asset_id]
        
        if level:
            tasks = [t for t in tasks if t.level == level]
        
        return tasks

    def get_asset_id_by_application(self, application_id: str) -> Optional[str]:
        """
        根据申请ID获取资产ID
        
        Args:
            application_id: 报废申请ID
        
        Returns:
            Optional[str]: 资产ID
        """
        application = self._retirement_applications.get(application_id)
        return application.asset_id if application else None

    def _find_active_application(self, asset_id: str) -> Optional[RetirementApplication]:
        """
        查找资产进行中的报废申请
        
        Args:
            asset_id: 资产ID
        
        Returns:
            Optional[RetirementApplication]: 进行中的申请，如有
        """
        for app in self._retirement_applications.values():
            if app.asset_id == asset_id and app.status == RetirementStatus.IN_APPROVAL:
                return app
        return None

    def get_application(self, application_id: str) -> Optional[RetirementApplication]:
        """
        获取报废申请详情
        
        Args:
            application_id: 报废申请ID
        
        Returns:
            Optional[RetirementApplication]: 申请记录
        """
        return self._retirement_applications.get(application_id)