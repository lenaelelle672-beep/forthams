"""
创建工单命令模块。

该模块实现了工单创建的核心业务逻辑，包括：
- 工单数据验证
- 状态机初始化（pending）
- 审批流程触发
- 通知机制集成
"""
from datetime import datetime
from typing import Optional
from uuid import uuid4

from src.application.services.notification_service import NotificationService
from src.domain.entities.work_order import WorkOrder, WorkOrderStatus
from src.domain.events.state_changed import StateChangedEvent
from src.domain.services.notification_service import NotificationService as DomainNotificationService
from src.infrastructure.database.repositories import WorkOrderRepository
from src.models.workorder import WorkOrder as WorkOrderModel
from src.state_machine.retirement_state_machine import RetirementStateMachine


def validate_work_order_data(data: dict) -> tuple[bool, Optional[str]]:
    """
    验证工单数据完整性。
    
    Args:
        data: 工单数据字典
        
    Returns:
        tuple: (验证是否通过, 错误信息)
    """
    required_fields = ['title', 'asset_id', 'applicant_id']
    
    for field in required_fields:
        if field not in data or not data[field]:
            return False, f"Missing required field: {field}"
    
    if 'title' in data and len(data['title']) > 200:
        return False, "Title exceeds maximum length of 200 characters"
    
    if 'description' in data and len(data.get('description', '')) > 2000:
        return False, "Description exceeds maximum length of 2000 characters"
    
    return True, None


def create_work_order(
    title: str,
    asset_id: str,
    applicant_id: str,
    description: Optional[str] = None,
    priority: str = "normal",
    expected_completion_date: Optional[datetime] = None,
) -> WorkOrder:
    """
    创建新的工单。
    
    工单创建后状态为 pending，需要经过审批流程才能完成。
    创建成功后会自动触发审批通知。
    
    Args:
        title: 工单标题
        asset_id: 资产ID
        applicant_id: 申请人ID
        description: 工单描述
        priority: 优先级 (normal/high/critical)
        expected_completion_date: 期望完成日期
        
    Returns:
        WorkOrder: 创建的工单实体
        
    Raises:
        ValueError: 数据验证失败时抛出
    """
    # 验证数据
    data = {
        'title': title,
        'asset_id': asset_id,
        'applicant_id': applicant_id,
        'description': description,
    }
    
    is_valid, error_message = validate_work_order_data(data)
    if not is_valid:
        raise ValueError(error_message)
    
    # 生成工单ID
    work_order_id = str(uuid4())
    now = datetime.utcnow()
    
    # 创建工单实体
    work_order = WorkOrder(
        id=work_order_id,
        title=title,
        asset_id=asset_id,
        applicant_id=applicant_id,
        description=description,
        priority=priority,
        status=WorkOrderStatus.PENDING,
        created_at=now,
        updated_at=now,
        expected_completion_date=expected_completion_date,
    )
    
    # 保存到数据库
    repository = WorkOrderRepository()
    repository.save(work_order)
    
    # 发布状态变更事件
    event = StateChangedEvent(
        entity_type="work_order",
        entity_id=work_order_id,
        old_status=None,
        new_status=WorkOrderStatus.PENDING,
        timestamp=now,
        actor=applicant_id,
    )
    event.publish()
    
    # 发送通知给审批人
    try:
        notification_service = NotificationService()
        notification_service.send_work_order_created_notification(work_order)
    except Exception as e:
        # 通知失败不应影响工单创建
        pass
    
    return work_order


def get_work_order_by_id(work_order_id: str) -> Optional[WorkOrder]:
    """
    根据ID获取工单。
    
    Args:
        work_order_id: 工单ID
        
    Returns:
        WorkOrder: 找到的工单，未找到返回 None
    """
    repository = WorkOrderRepository()
    return repository.find_by_id(work_order_id)


def list_work_orders_by_applicant(
    applicant_id: str,
    status: Optional[WorkOrderStatus] = None,
) -> list[WorkOrder]:
    """
    获取申请人的工单列表。
    
    Args:
        applicant_id: 申请人ID
        status: 按状态过滤（可选）
        
    Returns:
        list[WorkOrder]: 工单列表
    """
    repository = WorkOrderRepository()
    return repository.find_by_applicant(applicant_id, status)