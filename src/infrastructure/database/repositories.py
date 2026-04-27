"""
工单仓储层实现

本模块实现工单数据的持久化操作，包括：
- 工单基本 CRUD 操作
- 乐观锁更新（防止并发冲突）
- 审批记录持久化

关联规格: SWARM-2025-Q2-P0-003-Spec-v1.0
"""

from datetime import datetime
from typing import Optional, List
from dataclasses import dataclass, field

from sqlalchemy import select, update as sql_update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.exc import SQLAlchemyError

from src.domain.enums.workorder_status import WorkOrderStatus
from src.domain.entities.work_order import WorkOrder
from src.domain.events.workorder_events import WorkOrderApprovedEvent, WorkOrderRejectedEvent


@dataclass
class ApprovalRecord:
    """
    审批记录数据类
    
    Attributes:
        id: 审批记录唯一标识
        workorder_id: 工单ID
        operator_id: 操作人ID
        action: 操作类型 ('APPROVE' or 'REJECT')
        status_from: 原状态
        status_to: 目标状态
        reject_reason: 驳回原因（仅驳回时填写）
        created_at: 创建时间
    """
    id: str
    workorder_id: str
    operator_id: str
    action: str
    status_from: str
    status_to: str
    reject_reason: Optional[str] = None
    created_at: datetime = field(default_factory=datetime.utcnow)


class WorkOrderRepository:
    """
    工单仓储
    
    职责：
    1. 工单的 CRUD 操作
    2. 使用乐观锁实现并发安全的状态更新
    3. 提供状态转换的原子性保证
    
    异常：
        ConcurrentModificationError: 乐观锁冲突，并发更新被拒绝
        WorkOrderNotFoundError: 工单不存在
    """
    
    def __init__(self, session: AsyncSession):
        """
        初始化仓储
        
        Args:
            session: SQLAlchemy 异步会话
        """
        self.session = session
    
    async def get_by_id(self, workorder_id: str) -> Optional[WorkOrder]:
        """
        根据ID查询工单
        
        Args:
            workorder_id: 工单ID
            
        Returns:
            WorkOrder: 工单实体，如果不存在返回 None
        """
        stmt = select(WorkOrder).where(WorkOrder.id == workorder_id)
        result = await self.session.execute(stmt)
        return result.scalar_one_or_none()
    
    async def update_with_optimistic_lock(
        self,
        workorder_id: str,
        new_status: WorkOrderStatus,
        expected_version: int
    ) -> Optional[WorkOrder]:
        """
        使用乐观锁更新工单状态
        
        乐观锁机制：
        - 仅当当前版本号等于 expected_version 时才更新
        - 更新成功后将 version 字段加 1
        - 若版本不匹配，返回 None 表示冲突
        
        Args:
            workorder_id: 工单ID
            new_status: 新状态
            expected_version: 期望的版本号（用于乐观锁校验）
            
        Returns:
            更新后的工单，None 表示版本冲突（ConcurrentModificationError 情况）
            
        Raises:
            WorkOrderNotFoundError: 工单不存在
        """
        # 先查询工单是否存在
        workorder = await self.get_by_id(workorder_id)
        if not workorder:
            raise WorkOrderNotFoundError(workorder_id)
        
        # 使用乐观锁更新：WHERE id = ? AND version = expected_version
        stmt = (
            sql_update(WorkOrder)
            .where(WorkOrder.id == workorder_id)
            .where(WorkOrder.version == expected_version)
            .values(
                status=new_status.value,
                version=expected_version + 1,
                updated_at=datetime.utcnow()
            )
            .returning(WorkOrder)
        )
        
        result = await self.session.execute(stmt)
        updated_workorder = result.scalar_one_or_none()
        
        if updated_workorder is None:
            # 版本冲突，更新失败
            return None
        
        await self.session.commit()
        return updated_workorder
    
    async def save_approval_record(self, record: ApprovalRecord) -> ApprovalRecord:
        """
        保存审批记录
        
        Args:
            record: 审批记录对象
            
        Returns:
            保存后的审批记录
        """
        try:
            # 实际实现中会写入数据库
            # 这里记录日志表示操作已执行
            self.session.add(record)
            await self.session.commit()
            return record
        except SQLAlchemyError as e:
            await self.session.rollback()
            raise ApprovalRecordSaveError(str(e)) from e
    
    async def find_pending_review_orders(
        self,
        approver_id: Optional[str] = None,
        limit: int = 100
    ) -> List[WorkOrder]:
        """
        查询待审批工单列表
        
        Args:
            approver_id: 审批人ID（可选，传入时只查询该审批人的待审批工单）
            limit: 返回数量限制
            
        Returns:
            待审批工单列表
        """
        stmt = select(WorkOrder).where(
            WorkOrder.status == WorkOrderStatus.PENDING_REVIEW.value
        )
        
        if approver_id:
            stmt = stmt.where(WorkOrder.current_approver_id == approver_id)
        
        stmt = stmt.limit(limit)
        
        result = await self.session.execute(stmt)
        return list(result.scalars().all())


class WorkOrderNotFoundError(Exception):
    """工单不存在异常"""
    
    def __init__(self, workorder_id: str):
        self.workorder_id = workorder_id
        super().__init__(f"Work order not found: {workorder_id}")


class ConcurrentModificationError(Exception):
    """
    并发修改异常
    
    当乐观锁检测到版本冲突时抛出。
    表明该工单正被其他操作处理中。
    """
    
    def __init__(self, workorder_id: str):
        self.workorder_id = workorder_id
        super().__init__(
            f"Concurrent modification detected for work order: {workorder_id}"
        )


class ApprovalRecordSaveError(Exception):
    """审批记录保存失败异常"""
    pass