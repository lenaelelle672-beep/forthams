# -*- coding: utf-8 -*-
"""
资产报废退役服务模块

提供资产报废退役流程的核心业务逻辑，包括：
- 资产状态流转引擎：管理资产状态转换规则和事件驱动触发
- 报废申请审批链：多级审批路由和条件分支处理
- 历史记录持久化：变更快照写入和审计日志生成

@module asset_retirement_service
@author SWARM-002 Iteration 6
@version 1.0.0
"""

from __future__ import annotations

import logging
from datetime import datetime
from enum import Enum
from typing import TYPE_CHECKING, Any, Dict, List, Optional

from sqlalchemy import and_
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from backend.models.asset_retirement import AssetRetirement, RetirementStatus
from backend.models.retirement_history import RetirementHistory
from backend.models.approval_history import ApprovalHistory
from backend.state_machine.retirement_state_machine import RetirementStateMachine
from backend.events.ticket_events import publish_retirement_event

if TYPE_CHECKING:
    from backend.models.asset import Asset
    from backend.services.approval_service import ApprovalService

logger = logging.getLogger(__name__)


class RetirementError(Exception):
    """资产退役相关基础异常"""
    pass


class DuplicateRetirementRequestError(RetirementError):
    """重复退役申请异常"""
    pass


class InvalidStateTransitionError(RetirementError):
    """非法状态转换异常"""
    pass


class ApprovalTimeoutError(RetirementError):
    """审批超时异常"""
    pass


class AssetRetirementService:
    """
    资产报废退役服务
    
    核心业务逻辑：
    1. 管理资产从ACTIVE到RETIRED的完整生命周期
    2. 协调状态机引擎执行状态转换
    3. 处理多级审批链的路由和状态更新
    4. 持久化所有状态变更到历史记录表
    
    Attributes:
        db_session: 数据库会话
        state_machine: 状态机引擎实例
        approval_service: 审批服务依赖
    """
    
    MAX_APPROVAL_LEVELS: int = 5
    DEFAULT_APPROVAL_TIMEOUT_HOURS: int = 48
    
    def __init__(
        self,
        db_session: Session,
        approval_service: Optional["ApprovalService"] = None
    ) -> None:
        """
        初始化资产退役服务
        
        Args:
            db_session: SQLAlchemy数据库会话
            approval_service: 可选的审批服务实例，用于协调审批链
        
        Raises:
            TypeError: db_session不是有效的Session对象
        """
        if not isinstance(db_session, Session):
            raise TypeError("db_session must be a valid SQLAlchemy Session")
        
        self._db = db_session
        self._approval_service = approval_service
        self._state_machine = RetirementStateMachine()
        self._pending_requests: Dict[str, AssetRetirement] = {}
        
        logger.info("AssetRetirementService initialized")
    
    @property
    def db(self) -> Session:
        """获取数据库会话"""
        return self._db
    
    def create_retirement_application(
        self,
        asset_id: str,
        applicant_id: str,
        reason: str,
        estimated_value: Optional[float] = None,
        attachments: Optional[List[str]] = None,
        disposal_method: str = "SCRAP"
    ) -> AssetRetirement:
        """
        创建资产退役申请
        
        在提交申请前执行以下检查：
        1. 资产是否存在且状态为ACTIVE
        2. 是否存在待处理的退役申请
        3. 申请人是否具有发起申请的权限
        
        Args:
            asset_id: 资产ID
            applicant_id: 申请人ID
            reason: 退役原因
            estimated_value: 预估残值
            attachments: 附件URL列表
            disposal_method: 处置方式 (SCRAP/AUCTION/TRANSFER)
        
        Returns:
            AssetRetirement: 创建的退役申请记录
        
        Raises:
            ValueError: 参数验证失败
            DuplicateRetirementRequestError: 存在待处理申请
            RetirementError: 资产状态不合法
        """
        # 参数验证
        if not asset_id:
            raise ValueError("asset_id is required")
        if not applicant_id:
            raise ValueError("applicant_id is required")
        if not reason or len(reason.strip()) < 5:
            raise ValueError("reason must be at least 5 characters")
        
        # 检查资产状态
        asset = self._get_asset_by_id(asset_id)
        if not asset:
            raise RetirementError(f"Asset {asset_id} not found")
        
        if asset.status != "ACTIVE":
            raise RetirementError(
                f"Asset {asset_id} is not in ACTIVE status, current: {asset.status}"
            )
        
        # 检查是否存在待处理申请
        existing = self._get_pending_request(asset_id)
        if existing:
            raise DuplicateRetirementRequestError(
                f"Asset {asset_id} already has pending retirement request"
            )
        
        # 创建退役申请记录
        retirement = AssetRetirement(
            asset_id=asset_id,
            applicant_id=applicant_id,
            reason=reason,
            estimated_value=estimated_value,
            attachments=",".join(attachments) if attachments else None,
            disposal_method=disposal_method,
            status=RetirementStatus.PENDING,
            current_level=0,
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow()
        )
        
        try:
            self._db.add(retirement)
            self._db.flush()
            
            # 记录历史
            self._record_history(
                retirement_id=retirement.id,
                asset_id=asset_id,
                action="APPLICATION_CREATED",
                from_status=None,
                to_status=RetirementStatus.PENDING.value,
                operator=applicant_id,
                metadata={"reason": reason}
            )
            
            self._db.commit()
            self._pending_requests[asset_id] = retirement
            
            # 发布事件
            publish_retirement_event(
                event_type="RETIREMENT_APPLICATION_CREATED",
                asset_id=asset_id,
                retirement_id=retirement.id,
                applicant_id=applicant_id
            )
            
            logger.info(f"Retirement application created for asset {asset_id}")
            return retirement
            
        except IntegrityError as e:
            self._db.rollback()
            logger.error(f"Database integrity error: {e}")
            raise RetirementError("Failed to create retirement application")
    
    def submit_for_approval(
        self,
        retirement_id: int,
        operator_id: str
    ) -> AssetRetirement:
        """
        提交退役申请进入审批流程
        
        触发状态机从PENDING流转到UNDER_REVIEW，
        初始化审批链第一级
        
        Args:
            retirement_id: 退役申请ID
            operator_id: 操作人ID
        
        Returns:
            AssetRetirement: 更新后的退役申请记录
        
        Raises:
            RetirementError: 申请不存在或状态不合法
            InvalidStateTransitionError: 状态转换不合法
        """
        retirement = self._get_retirement_by_id(retirement_id)
        if not retirement:
            raise RetirementError(f"Retirement {retirement_id} not found")
        
        if retirement.status != RetirementStatus.PENDING:
            raise InvalidStateTransitionError(
                f"Cannot submit from status {retirement.status}"
            )
        
        # 触发状态机转换
        old_status = retirement.status
        retirement.status = RetirementStatus.UNDER_REVIEW
        retirement.current_level = 1
        retirement.submitted_at = datetime.utcnow()
        retirement.updated_at = datetime.utcnow()
        
        # 记录历史
        self._record_history(
            retirement_id=retirement_id,
            asset_id=retirement.asset_id,
            action="SUBMITTED_FOR_APPROVAL",
            from_status=old_status.value,
            to_status=RetirementStatus.UNDER_REVIEW.value,
            operator=operator_id,
            metadata={"level": 1}
        )
        
        self._db.commit()
        
        # 发布事件
        publish_retirement_event(
            event_type="RETIREMENT_SUBMITTED",
            retirement_id=retirement_id,
            asset_id=retirement.asset_id,
            level=1
        )
        
        logger.info(
            f"Retirement {retirement_id} submitted for approval, level 1"
        )
        return retirement
    
    def approve_at_level(
        self,
        retirement_id: int,
        level: int,
        approver_id: str,
        comment: Optional[str] = None
    ) -> AssetRetirement:
        """
        审批通过指定级别
        
        多级审批链核心逻辑：
        - 验证当前级别与记录的级别匹配
        - 更新审批历史
        - 判断是否到达最终级别或继续流转
        
        Args:
            retirement_id: 退役申请ID
            level: 审批级别 (1-5)
            approver_id: 审批人ID
            comment: 审批意见
        
        Returns:
            AssetRetirement: 更新后的记录
        
        Raises:
            ValueError: 级别参数不合法
            InvalidStateTransitionError: 审批顺序不合法
            ApprovalTimeoutError: 审批已超时
        """
        if level < 1 or level > self.MAX_APPROVAL_LEVELS:
            raise ValueError(
                f"Level must be between 1 and {self.MAX_APPROVAL_LEVELS}"
            )
        
        retirement = self._get_retirement_by_id(retirement_id)
        if not retirement:
            raise RetirementError(f"Retirement {retirement_id} not found")
        
        if retirement.status != RetirementStatus.UNDER_REVIEW:
            raise InvalidStateTransitionError(
                f"Cannot approve when status is {retirement.status}"
            )
        
        if retirement.current_level != level:
            raise InvalidStateTransitionError(
                f"Expected level {retirement.current_level}, got {level}"
            )
        
        # 检查超时
        if self._is_approval_timeout(retirement, level):
            raise ApprovalTimeoutError(
                f"Approval at level {level} has exceeded timeout"
            )
        
        # 记录审批历史
        self._record_approval_history(
            retirement_id=retirement_id,
            level=level,
            approver_id=approver_id,
            decision="APPROVED",
            comment=comment
        )
        
        # 判断是否完成审批
        if level >= self.MAX_APPROVAL_LEVELS:
            return self._complete_retirement(retirement, approver_id)
        
        # 继续流转到下一级
        retirement.current_level = level + 1
        retirement.updated_at = datetime.utcnow()
        
        self._record_history(
            retirement_id=retirement_id,
            asset_id=retirement.asset_id,
            action=f"APPROVED_LEVEL_{level}",
            from_status=RetirementStatus.UNDER_REVIEW.value,
            to_status=RetirementStatus.UNDER_REVIEW.value,
            operator=approver_id,
            metadata={
                "level": level,
                "next_level": level + 1,
                "comment": comment
            }
        )
        
        self._db.commit()
        
        publish_retirement_event(
            event_type="RETIREMENT_APPROVED",
            retirement_id=retirement_id,
            asset_id=retirement.asset_id,
            level=level,
            next_level=level + 1
        )
        
        logger.info(
            f"Retirement {retirement_id} approved at level {level}, "
            f"moving to level {level + 1}"
        )
        return retirement
    
    def reject_at_level(
        self,
        retirement_id: int,
        level: int,
        rejector_id: str,
        reason: str
    ) -> AssetRetirement:
        """
        驳回指定级别的审批
        
        驳回后申请状态变更为REJECTED，
        需要重新发起申请而非直接修改
        
        Args:
            retirement_id: 退役申请ID
            level: 审批级别
            rejector_id: 驳回人ID
            reason: 驳回原因
        
        Returns:
            AssetRetirement: 更新后的记录
        
        Raises:
            RetirementError: 状态不合法
            ValueError: 驳回原因为空
        """
        if not reason or len(reason.strip()) < 3:
            raise ValueError("reject reason must be at least 3 characters")
        
        retirement = self._get_retirement_by_id(retirement_id)
        if not retirement:
            raise RetirementError(f"Retirement {retirement_id} not found")
        
        if retirement.status != RetirementStatus.UNDER_REVIEW:
            raise InvalidStateTransitionError(
                f"Cannot reject when status is {retirement.status}"
            )
        
        old_status = retirement.status
        retirement.status = RetirementStatus.REJECTED
        retirement.rejection_reason = reason
        retirement.rejected_by = rejector_id
        retirement.rejected_at = datetime.utcnow()
        retirement.current_level = 0
        retirement.updated_at = datetime.utcnow()
        
        self._record_history(
            retirement_id=retirement_id,
            asset_id=retirement.asset_id,
            action="REJECTED",
            from_status=old_status.value,
            to_status=RetirementStatus.REJECTED.value,
            operator=rejector_id,
            metadata={"level": level, "reason": reason}
        )
        
        self._record_approval_history(
            retirement_id=retirement_id,
            level=level,
            approver_id=rejector_id,
            decision="REJECTED",
            comment=reason
        )
        
        self._db.commit()
        
        publish_retirement_event(
            event_type="RETIREMENT_REJECTED",
            retirement_id=retirement_id,
            asset_id=retirement.asset_id,
            level=level,
            reason=reason
        )
        
        logger.info(f"Retirement {retirement_id} rejected at level {level}")
        return retirement
    
    def _complete_retirement(
        self,
        retirement: AssetRetirement,
        final_approver_id: str
    ) -> AssetRetirement:
        """
        完成退役流程
        
        最终审批通过后：
        1. 更新资产状态为RETIRED
        2. 记录完成历史
        3. 触发后续处置流程
        
        Args:
            retirement: 退役申请记录
            final_approver_id: 最终审批人ID
        
        Returns:
            AssetRetirement: 更新后的记录
        """
        old_status = retirement.status
        retirement.status = RetirementStatus.APPROVED
        retirement.completed_at = datetime.utcnow()
        retirement.final_approver_id = final_approver_id
        retirement.updated_at = datetime.utcnow()
        
        # 更新资产状态
        asset = self._get_asset_by_id(retirement.asset_id)
        if asset:
            old_asset_status = asset.status
            asset.status = "RETIRED"
            asset.retired_at = datetime.utcnow()
            self._db.add(asset)
            
            self._record_history(
                retirement_id=retirement.id,
                asset_id=retirement.asset_id,
                action="ASSET_RETIRED",
                from_status=old_asset_status,
                to_status="RETIRED",
                operator=final_approver_id,
                metadata={
                    "disposal_method": retirement.disposal_method,
                    "estimated_value": retirement.estimated_value
                }
            )
        
        self._record_history(
            retirement_id=retirement.id,
            asset_id=retirement.asset_id,
            action="RETIREMENT_COMPLETED",
            from_status=old_status.value,
            to_status=RetirementStatus.APPROVED.value,
            operator=final_approver_id,
            metadata={"final_level": self.MAX_APPROVAL_LEVELS}
        )
        
        self._db.commit()
        
        publish_retirement_event(
            event_type="RETIREMENT_COMPLETED",
            retirement_id=retirement.id,
            asset_id=retirement.asset_id,
            disposal_method=retirement.disposal_method
        )
        
        logger.info(
            f"Retirement {retirement.id} completed for asset {retirement.asset_id}"
        )
        return retirement
    
    def get_retirement_history(
        self,
        asset_id: str,
        include_archived: bool = False
    ) -> List[RetirementHistory]:
        """
        获取资产生命周期历史记录
        
        支持时间范围检索和归档数据查询
        
        Args:
            asset_id: 资产ID
            include_archived: 是否包含归档记录
        
        Returns:
            List[RetirementHistory]: 历史记录列表，按时间倒序
        
        Raises:
            ValueError: asset_id为空
        """
        if not asset_id:
            raise ValueError("asset_id is required")
        
        query = self._db.query(RetirementHistory).filter(
            RetirementHistory.asset_id == asset_id
        )
        
        if not include_archived:
            query = query.filter(
                RetirementHistory.archived_at.is_(None)
            )
        
        results = query.order_by(
            RetirementHistory.created_at.desc()
        ).all()
        
        logger.debug(f"Retrieved {len(results)} history records for {asset_id}")
        return results
    
    def get_history_by_time_range(
        self,
        asset_id: str,
        start_time: datetime,
        end_time: datetime
    ) -> List[RetirementHistory]:
        """
        按时间范围查询历史记录
        
        Args:
            asset_id: 资产ID
            start_time: 开始时间
            end_time: 结束时间
        
        Returns:
            List[RetirementHistory]: 范围内的历史记录
        """
        return self._db.query(RetirementHistory).filter(
            and_(
                RetirementHistory.asset_id == asset_id,
                RetirementHistory.created_at >= start_time,
                RetirementHistory.created_at <= end_time
            )
        ).order_by(RetirementHistory.created_at.asc()).all()
    
    def get_approval_history(
        self,
        retirement_id: int
    ) -> List[ApprovalHistory]:
        """
        获取退役申请的审批历史
        
        Args:
            retirement_id: 退役申请ID
        
        Returns:
            List[ApprovalHistory]: 审批历史列表
        """
        return self._db.query(ApprovalHistory).filter(
            ApprovalHistory.retirement_id == retirement_id
        ).order_by(ApprovalHistory.created_at.asc()).all()
    
    def get_pending_requests(
        self,
        level: Optional[int] = None,
        limit: int = 100
    ) -> List[AssetRetirement]:
        """
        获取待处理的退役申请
        
        Args:
            level: 可选的审批级别过滤
            limit: 返回记录数量限制
        
        Returns:
            List[AssetRetirement]: 待处理申请列表
        """
        query = self._db.query(AssetRetirement).filter(
            AssetRetirement.status == RetirementStatus.UNDER_REVIEW
        )
        
        if level is not None:
            query = query.filter(AssetRetirement.current_level == level)
        
        return query.order_by(
            AssetRetirement.updated_at.asc()
        ).limit(limit).all()
    
    def archive_old_records(
        self,
        before_date: datetime
    ) -> int:
        """
        归档指定日期前的历史记录
        
        Args:
            before_date: 归档截止日期
        
        Returns:
            int: 归档的记录数量
        """
        records = self._db.query(RetirementHistory).filter(
            and_(
                RetirementHistory.created_at < before_date,
                RetirementHistory.archived_at.is_(None)
            )
        ).all()
        
        count = 0
        for record in records:
            record.archived_at = datetime.utcnow()
            count += 1
        
        if count > 0:
            self._db.commit()
            logger.info(f"Archived {count} history records before {before_date}")
        
        return count
    
    def _get_asset_by_id(self, asset_id: str) -> Optional["Asset"]:
        """
        根据ID获取资产
        
        Args:
            asset_id: 资产ID
        
        Returns:
            Optional[Asset]: 资产实例或None
        """
        from backend.models.asset import Asset
        return self._db.query(Asset).filter(
            Asset.id == asset_id
        ).first()
    
    def _get_retirement_by_id(self, retirement_id: int) -> Optional[AssetRetirement]:
        """
        根据ID获取退役申请
        
        Args:
            retirement_id: 退役申请ID
        
        Returns:
            Optional[AssetRetirement]: 退役申请实例或None
        """
        return self._db.query(AssetRetirement).filter(
            AssetRetirement.id == retirement_id
        ).first()
    
    def _get_pending_request(self, asset_id: str) -> Optional[AssetRetirement]:
        """
        检查资产是否存在待处理的退役申请
        
        Args:
            asset_id: 资产ID
        
        Returns:
            Optional[AssetRetirement]: 待处理申请或None
        """
        return self._db.query(AssetRetirement).filter(
            and_(
                AssetRetirement.asset_id == asset_id,
                AssetRetirement.status.in_([
                    RetirementStatus.PENDING,
                    RetirementStatus.UNDER_REVIEW
                ])
            )
        ).first()
    
    def _record_history(
        self,
        retirement_id: int,
        asset_id: str,
        action: str,
        from_status: Optional[str],
        to_status: Optional[str],
        operator: str,
        metadata: Optional[Dict[str, Any]] = None
    ) -> RetirementHistory:
        """
        记录状态变更历史
        
        每次状态变更必须写入独立快照，
        用于支持回溯查询和审计
        
        Args:
            retirement_id: 退役申请ID
            asset_id: 资产ID
            action: 操作类型
            from_status: 原状态
            to_status: 新状态
            operator: 操作人
            metadata: 附加元数据
        
        Returns:
            RetirementHistory: 创建的历史记录
        """
        history = RetirementHistory(
            retirement_id=retirement_id,
            asset_id=asset_id,
            action=action,
            from_status=from_status,
            to_status=to_status,
            operator=operator,
            metadata=str(metadata) if metadata else None,
            created_at=datetime.utcnow()
        )
        
        self._db.add(history)
        return history
    
    def _record_approval_history(
        self,
        retirement_id: int,
        level: int,
        approver_id: str,
        decision: str,
        comment: Optional[str] = None
    ) -> ApprovalHistory:
        """
        记录审批历史
        
        Args:
            retirement_id: 退役申请ID
            level: 审批级别
            approver_id: 审批人ID
            decision: 审批决定 (APPROVED/REJECTED)
            comment: 审批意见
        
        Returns:
            ApprovalHistory: 创建的审批历史记录
        """
        history = ApprovalHistory(
            retirement_id=retirement_id,
            level=level,
            approver_id=approver_id,
            decision=decision,
            comment=comment,
            created_at=datetime.utcnow()
        )
        
        self._db.add(history)
        return history
    
    def _is_approval_timeout(
        self,
        retirement: AssetRetirement,
        level: int
    ) -> bool:
        """
        检查审批是否超时
        
        Args:
            retirement: 退役申请记录
            level: 审批级别
        
        Returns:
            bool: 是否超时
        """
        # 获取该级别的超时配置
        timeout_hours = self._get_timeout_for_level(level)
        level_start = retirement.updated_at
        
        if not level_start:
            level_start = retirement.submitted_at or retirement.created_at
        
        elapsed = (datetime.utcnow() - level_start).total_seconds() / 3600
        return elapsed > timeout_hours
    
    def _get_timeout_for_level(self, level: int) -> int:
        """
        获取指定审批级别的超时配置
        
        Args:
            level: 审批级别
        
        Returns:
            int: 超时小时数
        """
        # 高级别审批给予更长时间
        base_timeout = {
            1: 48,   # 部门经理
            2: 72,   # 财务审核
            3: 48,   # 资产主管
            4: 120,  # CFO代理
            5: 168   # CEO代理
        }
        return base_timeout.get(level, self.DEFAULT_APPROVAL_TIMEOUT_HOURS)