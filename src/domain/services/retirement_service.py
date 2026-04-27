"""
资产报废退役服务模块

提供资产报废/退役申请、多级审批链管理、生命周期事件记录等功能。
支持配置化审批流，实现多级主管/部门审批。
完整记录资产从入库到报废的全链路状态变更与审批历史。

Author: SWARM-2026-Q2-002 Team
Iteration: 5
"""

from __future__ import annotations

import logging
from datetime import datetime, timedelta
from enum import Enum
from typing import Optional
from dataclasses import dataclass, field
from uuid import UUID, uuid4

from sqlalchemy import select, update, and_, or_
from sqlalchemy.orm import Session, joinedload
from sqlalchemy.exc import IntegrityError

from src.domain.entities.retirement_application import RetirementApplication
from src.domain.entities.asset import Asset
from src.domain.entities.asset_lifecycle_event import AssetLifecycleEvent
from src.domain.entities.approval_stage import ApprovalStage, ApprovalAction
from src.domain.services.approval_chain_service import ApprovalChainService
from src.domain.events.state_changed import AssetStatusChangedEvent

logger = logging.getLogger(__name__)


class RetirementType(str, Enum):
    """报废类型枚举"""
    SCRAP = "scrap"           # 报废
    RETIREMENT = "retirement" # 退役


class RetirementStatus(str, Enum):
    """报废申请状态枚举"""
    PENDING = "pending"           # 待审批
    APPROVED = "approved"         # 已批准
    REJECTED = "rejected"          # 已驳回
    CANCELLED = "cancelled"        # 已撤销
    COMPLETED = "completed"        # 已完成


class AssetLockStatus(str, Enum):
    """资产锁定状态枚举"""
    LOCKED = "under_retirement"    # 审批中锁定
    UNLOCKED = "active"            # 可用


@dataclass
class RetirementApplicationDTO:
    """报废申请数据传输对象"""
    asset_id: UUID
    application_type: RetirementType
    reason: str
    attachments: list[str] = field(default_factory=list)
    applicant_id: Optional[UUID] = None


@dataclass
class ApprovalResult:
    """审批结果"""
    success: bool
    message: str
    application_id: Optional[UUID] = None
    next_approver_id: Optional[UUID] = None
    is_final: bool = False


class RetirementServiceError(Exception):
    """报废服务基础异常"""
    def __init__(self, code: str, message: str):
        self.code = code
        self.message = message
        super().__init__(message)


class DuplicateApplicationError(RetirementServiceError):
    """重复申请异常"""
    def __init__(self):
        super().__init__("RET_002", "该资产已存在待处理的报废申请")


class AssetLockedError(RetirementServiceError):
    """资产锁定异常"""
    def __init__(self):
        super().__init__("ASSET_LOCKED", "资产正处于审批流程中，禁止操作")


class ConcurrencyConflictError(RetirementServiceError):
    """并发冲突异常"""
    def __init__(self):
        super().__init__("CONFLICT_VERSION", "审批操作冲突，请刷新后重试")


class InsufficientApprovalLevelError(RetirementServiceError):
    """审批权限不足异常"""
    def __init__(self):
        super().__init__("APPROVAL_FORBIDDEN", "您没有该审批环节的操作权限")


class RetirementService:
    """
    资产报废退役服务
    
    提供以下核心功能:
    - 创建报废/退役申请
    - 多级审批链管理
    - 生命周期事件记录
    - 资产状态锁定/解锁
    - 并发控制与乐观锁
    """

    # 审批超时时间（小时）
    APPROVAL_TIMEOUT_HOURS = 72
    
    # 驳回意见最小长度
    REJECTION_REASON_MIN_LENGTH = 10
    
    # 最大审批层级
    MAX_APPROVAL_LEVELS = 5

    def __init__(
        self,
        db_session: Session,
        approval_chain_service: Optional[ApprovalChainService] = None
    ):
        """
        初始化报废服务
        
        Args:
            db_session: 数据库会话
            approval_chain_service: 审批链服务（可选）
        """
        self.db = db_session
        self.approval_chain_service = approval_chain_service or ApprovalChainService(db_session)

    def create_application(
        self,
        dto: RetirementApplicationDTO,
        applicant_id: UUID
    ) -> RetirementApplication:
        """
        创建报废/退役申请
        
        Args:
            dto: 申请数据
            applicant_id: 申请人ID
            
        Returns:
            创建的申请记录
            
        Raises:
            DuplicateApplicationError: 资产已有待处理申请
            AssetLockedError: 资产已被锁定
        """
        # 检查资产是否存在
        asset = self._get_asset_or_raise(dto.asset_id)
        
        # 检查资产是否已被锁定（审批中）
        if asset.status == AssetLockStatus.LOCKED.value:
            logger.warning(f"Asset {dto.asset_id} is locked during approval")
            raise AssetLockedError()
        
        # 检查是否存在待处理申请
        existing = self._get_pending_application(dto.asset_id)
        if existing:
            logger.warning(f"Duplicate application for asset {dto.asset_id}")
            raise DuplicateApplicationError()
        
        # 创建申请记录
        application = RetirementApplication(
            id=uuid4(),
            asset_id=dto.asset_id,
            application_type=dto.application_type.value,
            reason=dto.reason,
            attachments=dto.attachments,
            applicant_id=applicant_id,
            status=RetirementStatus.PENDING.value,
            version=1,
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow()
        )
        
        try:
            self.db.add(application)
            
            # 锁定资产状态
            asset.status = AssetLockStatus.LOCKED.value
            asset.updated_at = datetime.utcnow()
            
            # 记录生命周期事件
            self._record_lifecycle_event(
                asset_id=dto.asset_id,
                event_type="RETIREMENT_CREATED",
                operator_id=applicant_id,
                details={
                    "application_id": str(application.id),
                    "application_type": dto.application_type.value,
                    "reason": dto.reason
                }
            )
            
            self.db.commit()
            self.db.refresh(application)
            
            # 激活审批链
            self.approval_chain_service.activate_chain(
                application_id=application.id,
                asset_id=dto.asset_id,
                application_type=dto.application_type.value
            )
            
            logger.info(f"Retirement application {application.id} created for asset {dto.asset_id}")
            return application
            
        except IntegrityError as e:
            self.db.rollback()
            logger.error(f"Database integrity error: {e}")
            raise DuplicateApplicationError()

    def approve(
        self,
        application_id: UUID,
        approver_id: UUID,
        comment: Optional[str] = None,
        expected_version: int = None
    ) -> ApprovalResult:
        """
        审批通过当前环节
        
        Args:
            application_id: 申请ID
            approver_id: 审批人ID
            comment: 审批意见
            expected_version: 期望版本号（乐观锁）
            
        Returns:
            审批结果
            
        Raises:
            ConcurrencyConflictError: 并发冲突
            InsufficientApprovalLevelError: 权限不足
        """
        application = self._get_application_or_raise(application_id)
        
        # 乐观锁检查
        if expected_version is not None and application.version != expected_version:
            raise ConcurrencyConflictError()
        
        # 获取当前审批任务
        current_task = self.approval_chain_service.get_current_task(application_id)
        if not current_task:
            raise RetirementServiceError("NO_TASK", "当前没有待审批的任务")
        
        # 验证审批人权限
        if not self._can_approve(current_task, approver_id):
            raise InsufficientApprovalLevelError()
        
        try:
            # 执行审批
            result = self.approval_chain_service.advance_chain(
                task_id=current_task.id,
                action=ApprovalAction.APPROVE,
                approver_id=approver_id,
                comment=comment
            )
            
            # 更新申请版本
            application.version += 1
            application.updated_at = datetime.utcnow()
            
            # 记录生命周期事件
            self._record_lifecycle_event(
                asset_id=application.asset_id,
                event_type=f"LEVEL_{current_task.level}_APPROVED",
                operator_id=approver_id,
                details={
                    "application_id": str(application_id),
                    "task_id": str(current_task.id),
                    "comment": comment,
                    "new_status": result.get("status", "pending")
                }
            )
            
            # 检查是否全部审批完成
            if result.get("is_final", False):
                application.status = RetirementStatus.APPROVED.value
                self._complete_retirement(application, approver_id)
            
            self.db.commit()
            
            return ApprovalResult(
                success=True,
                message="审批通过",
                application_id=application_id,
                next_approver_id=result.get("next_approver_id"),
                is_final=result.get("is_final", False)
            )
            
        except Exception as e:
            self.db.rollback()
            logger.error(f"Approval error: {e}")
            raise

    def reject(
        self,
        application_id: UUID,
        approver_id: UUID,
        reason: str,
        expected_version: int = None
    ) -> ApprovalResult:
        """
        驳回报废申请
        
        Args:
            application_id: 申请ID
            approver_id: 审批人ID
            reason: 驳回原因（必填，最少10字符）
            expected_version: 期望版本号（乐观锁）
            
        Returns:
            审批结果
            
        Raises:
            ConcurrencyConflictError: 并发冲突
            InsufficientApprovalLevelError: 权限不足
            RetirementServiceError: 驳回原因过短
        """
        # 验证驳回原因长度
        if len(reason.strip()) < self.REJECTION_REASON_MIN_LENGTH:
            raise RetirementServiceError(
                "REASON_TOO_SHORT",
                f"驳回原因至少需要{self.REJECTION_REASON_MIN_LENGTH}个字符"
            )
        
        application = self._get_application_or_raise(application_id)
        
        # 乐观锁检查
        if expected_version is not None and application.version != expected_version:
            raise ConcurrencyConflictError()
        
        # 获取当前审批任务
        current_task = self.approval_chain_service.get_current_task(application_id)
        if not current_task:
            raise RetirementServiceError("NO_TASK", "当前没有待审批的任务")
        
        # 验证审批人权限
        if not self._can_approve(current_task, approver_id):
            raise InsufficientApprovalLevelError()
        
        try:
            # 执行驳回
            self.approval_chain_service.advance_chain(
                task_id=current_task.id,
                action=ApprovalAction.REJECT,
                approver_id=approver_id,
                comment=reason
            )
            
            # 更新申请状态
            application.status = RetirementStatus.REJECTED.value
            application.version += 1
            application.updated_at = datetime.utcnow()
            
            # 解锁资产
            self._unlock_asset(application.asset_id)
            
            # 记录生命周期事件
            self._record_lifecycle_event(
                asset_id=application.asset_id,
                event_type="APPLICATION_REJECTED",
                operator_id=approver_id,
                details={
                    "application_id": str(application_id),
                    "task_id": str(current_task.id),
                    "reason": reason
                }
            )
            
            self.db.commit()
            
            return ApprovalResult(
                success=True,
                message="申请已驳回",
                application_id=application_id,
                is_final=True
            )
            
        except Exception as e:
            self.db.rollback()
            logger.error(f"Rejection error: {e}")
            raise

    def cancel(
        self,
        application_id: UUID,
        user_id: UUID
    ) -> ApprovalResult:
        """
        撤销报废申请（仅申请人可在首级审批前撤销）
        
        Args:
            application_id: 申请ID
            user_id: 用户ID
            
        Returns:
            撤销结果
        """
        application = self._get_application_or_raise(application_id)
        
        # 验证是否为申请人
        if application.applicant_id != user_id:
            raise RetirementServiceError(
                "FORBIDDEN",
                "只有申请人可以撤销申请"
            )
        
        # 验证状态
        if application.status != RetirementStatus.PENDING.value:
            raise RetirementServiceError(
                "INVALID_STATUS",
                "只有待审批状态的申请可以撤销"
            )
        
        # 检查首级审批是否已开始
        current_task = self.approval_chain_service.get_current_task(application_id)
        if current_task and current_task.level > 1:
            raise RetirementServiceError(
                "APPROVAL_STARTED",
                "审批流程已开始，无法撤销"
            )
        
        try:
            # 更新申请状态
            application.status = RetirementStatus.CANCELLED.value
            application.updated_at = datetime.utcnow()
            
            # 解锁资产
            self._unlock_asset(application.asset_id)
            
            # 取消审批链
            self.approval_chain_service.cancel_chain(application_id)
            
            # 记录生命周期事件
            self._record_lifecycle_event(
                asset_id=application.asset_id,
                event_type="APPLICATION_CANCELLED",
                operator_id=user_id,
                details={
                    "application_id": str(application_id)
                }
            )
            
            self.db.commit()
            
            return ApprovalResult(
                success=True,
                message="申请已撤销",
                application_id=application_id,
                is_final=True
            )
            
        except Exception as e:
            self.db.rollback()
            logger.error(f"Cancel error: {e}")
            raise

    def get_lifecycle_history(
        self,
        asset_id: UUID
    ) -> list[AssetLifecycleEvent]:
        """
        获取资产生命周期历史记录
        
        Args:
            asset_id: 资产ID
            
        Returns:
            生命周期事件列表（按时间顺序）
        """
        stmt = (
            select(AssetLifecycleEvent)
            .where(AssetLifecycleEvent.asset_id == asset_id)
            .order_by(AssetLifecycleEvent.created_at.asc())
        )
        result = self.db.execute(stmt)
        return result.scalars().all()

    def check_asset_locked(self, asset_id: UUID) -> bool:
        """
        检查资产是否被锁定
        
        Args:
            asset_id: 资产ID
            
        Returns:
            是否被锁定
        """
        asset = self._get_asset_or_raise(asset_id)
        return asset.status == AssetLockStatus.LOCKED.value

    def _get_asset_or_raise(self, asset_id: UUID) -> Asset:
        """获取资产或抛出异常"""
        stmt = select(Asset).where(Asset.id == asset_id)
        asset = self.db.execute(stmt).scalar_one_or_none()
        if not asset:
            raise RetirementServiceError("ASSET_NOT_FOUND", f"资产 {asset_id} 不存在")
        return asset

    def _get_application_or_raise(self, application_id: UUID) -> RetirementApplication:
        """获取申请或抛出异常"""
        stmt = (
            select(RetirementApplication)
            .where(RetirementApplication.id == application_id)
        )
        app = self.db.execute(stmt).scalar_one_or_none()
        if not app:
            raise RetirementServiceError(
                "APPLICATION_NOT_FOUND",
                f"申请 {application_id} 不存在"
            )
        return app

    def _get_pending_application(self, asset_id: UUID) -> Optional[RetirementApplication]:
        """获取资产待处理的申请"""
        stmt = (
            select(RetirementApplication)
            .where(
                and_(
                    RetirementApplication.asset_id == asset_id,
                    RetirementApplication.status == RetirementStatus.PENDING.value
                )
            )
        )
        return self.db.execute(stmt).scalar_one_or_none()

    def _can_approve(self, task: ApprovalStage, approver_id: UUID) -> bool:
        """检查用户是否有审批权限"""
        return task.approver_id == approver_id or task.delegated_to == approver_id

    def _unlock_asset(self, asset_id: UUID):
        """解锁资产"""
        stmt = (
            update(Asset)
            .where(Asset.id == asset_id)
            .values(
                status=AssetLockStatus.UNLOCKED.value,
                updated_at=datetime.utcnow()
            )
        )
        self.db.execute(stmt)

    def _complete_retirement(
        self,
        application: RetirementApplication,
        operator_id: UUID
    ):
        """完成报废/退役流程"""
        # 确定最终状态
        final_status = "scrapped" if application.application_type == RetirementType.SCRAP.value else "retired"
        
        # 更新资产状态
        stmt = (
            update(Asset)
            .where(Asset.id == application.asset_id)
            .values(
                status=final_status,
                updated_at=datetime.utcnow()
            )
        )
        self.db.execute(stmt)
        
        # 更新申请状态
        application.status = RetirementStatus.COMPLETED.value
        
        # 记录生命周期完成事件
        self._record_lifecycle_event(
            asset_id=application.asset_id,
            event_type="RETIREMENT_COMPLETED",
            operator_id=operator_id,
            details={
                "application_id": str(application.id),
                "final_status": final_status,
                "application_type": application.application_type
            }
        )
        
        logger.info(
            f"Retirement completed for asset {application.asset_id}, "
            f"status: {final_status}"
        )

    def _record_lifecycle_event(
        self,
        asset_id: UUID,
        event_type: str,
        operator_id: UUID,
        details: dict = None
    ):
        """
        记录生命周期事件
        
        Args:
            asset_id: 资产ID
            event_type: 事件类型
            operator_id: 操作人ID
            details: 事件详情
        """
        event = AssetLifecycleEvent(
            id=uuid4(),
            asset_id=asset_id,
            event_type=event_type,
            operator_id=operator_id,
            details=details or {},
            created_at=datetime.utcnow()
        )
        self.db.add(event)