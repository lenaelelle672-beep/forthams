"""
资产报废退役流程 - Repository 层

本模块提供资产报废相关数据实体的持久化操作，包括：
- 报废申请（RetirementApplication）
- 审批链路（ApprovalChain）
- 状态变更日志（StateTransitionLog）

支撑 Phase 3（审批链路引擎）+ Phase 4（历史记录持久化）的数据访问需求。
"""

from datetime import datetime, timedelta
from decimal import Decimal
from enum import Enum
from typing import Optional, List, Dict, Any, Tuple
from uuid import UUID, uuid4

from sqlalchemy import (
    Column, String, Text, Integer, Enum as SQLEnum, DateTime,
    Numeric, ForeignKey, JSON, Index, and_, or_, func
)
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import relationship, Session, joinedload
from sqlalchemy.exc import IntegrityError

Base = declarative_base()


class AssetStatusEnum(str, Enum):
    """资产状态枚举"""
    IN_USE = "在用"
    IDLE = "闲置"
    MAINTENANCE = "维修中"
    PENDING_APPROVAL = "待审批"
    APPROVAL_IN_PROGRESS = "审批中"
    SCRAPPED = "已报废"
    RECYCLED = "已回收"


class ApplicationStatusEnum(str, Enum):
    """报废申请状态枚举"""
    DRAFT = "草稿"
    PENDING = "待审批"
    APPROVAL_IN_PROGRESS = "审批中"
    APPROVED = "已批准"
    REJECTED = "已拒绝"
    WITHDRAWN = "已撤回"


class DisposalMethodEnum(str, Enum):
    """处置方式枚举"""
    SCRAP_DESTROY = "报废销毁"
    TRANSFER = "转让"
    RECYCLE = "回收再利用"
    DONATE = "捐赠"


class ApprovalDecisionEnum(str, Enum):
    """审批决策枚举"""
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"
    SKIPPED = "skipped"


class TriggerTypeEnum(str, Enum):
    """状态变更触发类型枚举"""
    MANUAL = "manual"
    AUTO = "auto"
    APPROVAL = "approval"


class Asset(Base):
    """资产实体模型"""
    __tablename__ = "assets"

    id = Column(PG_UUID(as_uuid=True), primary_key=True, default=uuid4)
    asset_code = Column(String(64), unique=True, nullable=False, index=True)
    asset_name = Column(String(256), nullable=False)
    category = Column(String(64), nullable=False)
    purchase_date = Column(DateTime, nullable=False)
    original_value = Column(Numeric(15, 2), nullable=False)
    current_value = Column(Numeric(15, 2), nullable=False)
    status = Column(String(32), nullable=False, default=AssetStatusEnum.IN_USE.value)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    retirement_applications = relationship("RetirementApplication", back_populates="asset")


class RetirementApplication(Base):
    """
    报废申请实体模型
    
    存储资产报废申请的核心信息，包括申请原因、处置方式、
    残值评估以及当前审批状态。
    """
    __tablename__ = "retirement_applications"

    id = Column(PG_UUID(as_uuid=True), primary_key=True, default=uuid4)
    asset_id = Column(PG_UUID(as_uuid=True), ForeignKey("assets.id"), nullable=False, index=True)
    applicant_id = Column(PG_UUID(as_uuid=True), nullable=False, index=True)
    reason = Column(Text, nullable=False)
    disposal_method = Column(String(32), nullable=False)
    estimated_value = Column(Numeric(15, 2), nullable=False)
    status = Column(String(32), nullable=False, default=ApplicationStatusEnum.DRAFT.value)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    asset = relationship("Asset", back_populates="retirement_applications")
    approval_chain = relationship("ApprovalChain", back_populates="application", cascade="all, delete-orphan")


class ApprovalChain(Base):
    """
    审批链路节点实体模型
    
    支持多级审批拓扑，记录每个审批节点的处理情况。
    """
    __tablename__ = "approval_chains"

    id = Column(PG_UUID(as_uuid=True), primary_key=True, default=uuid4)
    application_id = Column(PG_UUID(as_uuid=True), ForeignKey("retirement_applications.id"), nullable=False, index=True)
    node_order = Column(Integer, nullable=False)
    approver_id = Column(PG_UUID(as_uuid=True), nullable=False, index=True)
    decision = Column(String(16), nullable=False, default=ApprovalDecisionEnum.PENDING.value)
    comment = Column(Text, nullable=True)
    decided_at = Column(DateTime, nullable=True)
    timeout_flag = Column(String(1), default="N")  # Y/N
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    application = relationship("RetirementApplication", back_populates="approval_chain")

    __table_args__ = (
        Index("idx_approval_chain_app_node", "application_id", "node_order", unique=True),
        Index("idx_approval_chain_approver", "approver_id", "decision"),
    )


class StateTransitionLog(Base):
    """
    状态变更日志实体模型
    
    记录资产所有状态变更事件，用于审计追溯。
    支持哈希链防篡改设计。
    """
    __tablename__ = "state_transition_logs"

    id = Column(PG_UUID(as_uuid=True), primary_key=True, default=uuid4)
    asset_id = Column(PG_UUID(as_uuid=True), ForeignKey("assets.id"), nullable=False, index=True)
    from_status = Column(String(32), nullable=False)
    to_status = Column(String(32), nullable=False)
    trigger_type = Column(String(16), nullable=False)
    operator_id = Column(PG_UUID(as_uuid=True), nullable=True, index=True)
    metadata = Column(JSON, nullable=True)
    hash_value = Column(String(64), nullable=True)  # SHA-256 hash for integrity chain
    previous_hash = Column(String(64), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    __table_args__ = (
        Index("idx_state_log_asset_time", "asset_id", "created_at"),
        Index("idx_state_log_time_range", "created_at"),
    )


class RetirementRepository:
    """
    资产报废相关实体的 Repository 封装
    
    提供报废申请、审批链路、状态日志的 CRUD 操作，
    支撑审批链路引擎（Phase 3）和历史记录持久化（Phase 4）。
    """

    def __init__(self, session: Session):
        """
        初始化 Repository 实例。
        
        Args:
            session: SQLAlchemy 数据库会话实例
        """
        self.session = session

    # ==================== 报废申请（RetirementApplication）CRUD ====================

    def create_application(
        self,
        asset_id: UUID,
        applicant_id: UUID,
        reason: str,
        disposal_method: str,
        estimated_value: Decimal,
    ) -> RetirementApplication:
        """
        创建新的报废申请（草稿状态）。
        
        Args:
            asset_id: 资产 ID
            applicant_id: 申请人 ID
            reason: 报废原因
            disposal_method: 处置方式
            estimated_value: 残值评估
        
        Returns:
            新创建的 RetirementApplication 实例
        
        Raises:
            ValueError: 参数校验失败
            IntegrityError: 数据完整性冲突（如资产已有活跃申请）
        """
        if not reason or len(reason.strip()) < 10:
            raise ValueError("报废原因不能少于10个字符")
        
        if estimated_value < 0:
            raise ValueError("残值评估不能为负数")
        
        if disposal_method not in [e.value for e in DisposalMethodEnum]:
            raise ValueError(f"无效的处置方式: {disposal_method}")
        
        # 检查资产是否有活跃申请（状态不为终态）
        active_statuses = [
            ApplicationStatusEnum.PENDING.value,
            ApplicationStatusEnum.APPROVAL_IN_PROGRESS.value,
        ]
        existing = self.session.query(RetirementApplication).filter(
            and_(
                RetirementApplication.asset_id == asset_id,
                RetirementApplication.status.in_(active_statuses)
            )
        ).first()
        
        if existing:
            raise IntegrityError(
                "Active application exists",
                {"asset_id": str(asset_id)},
                "UNIQUE_VIOLATION"
            )
        
        application = RetirementApplication(
            asset_id=asset_id,
            applicant_id=applicant_id,
            reason=reason,
            disposal_method=disposal_method,
            estimated_value=estimated_value,
            status=ApplicationStatusEnum.DRAFT.value,
        )
        
        self.session.add(application)
        self.session.flush()
        
        return application

    def get_application_by_id(self, application_id: UUID) -> Optional[RetirementApplication]:
        """
        根据 ID 查询报废申请详情。
        
        Args:
            application_id: 报废申请 ID
        
        Returns:
            RetirementApplication 实例，未找到返回 None
        """
        return self.session.query(RetirementApplication).options(
            joinedload(RetirementApplication.asset),
            joinedload(RetirementApplication.approval_chain)
        ).filter(
            RetirementApplication.id == application_id
        ).first()

    def get_applications_by_asset(self, asset_id: UUID) -> List[RetirementApplication]:
        """
        查询指定资产的所有报废申请。
        
        Args:
            asset_id: 资产 ID
        
        Returns:
            RetirementApplication 列表，按创建时间降序排列
        """
        return self.session.query(RetirementApplication).filter(
            RetirementApplication.asset_id == asset_id
        ).order_by(
            RetirementApplication.created_at.desc()
        ).all()

    def get_applications_by_applicant(
        self,
        applicant_id: UUID,
        status: Optional[str] = None,
        offset: int = 0,
        limit: int = 20,
    ) -> Tuple[List[RetirementApplication], int]:
        """
        查询指定申请人的报废申请列表（支持分页）。
        
        Args:
            applicant_id: 申请人 ID
            status: 筛选状态（可选）
            offset: 偏移量
            limit: 每页条数限制
        
        Returns:
            (申请列表, 总数) 元组
        """
        query = self.session.query(RetirementApplication).filter(
            RetirementApplication.applicant_id == applicant_id
        )
        
        if status:
            query = query.filter(RetirementApplication.status == status)
        
        total = query.count()
        applications = query.order_by(
            RetirementApplication.created_at.desc()
        ).offset(offset).limit(limit).all()
        
        return applications, total

    def update_application(
        self,
        application_id: UUID,
        reason: Optional[str] = None,
        disposal_method: Optional[str] = None,
        estimated_value: Optional[Decimal] = None,
    ) -> Optional[RetirementApplication]:
        """
        更新报废申请草稿（仅草稿状态可修改）。
        
        Args:
            application_id: 报废申请 ID
            reason: 报废原因（可选）
            disposal_method: 处置方式（可选）
            estimated_value: 残值评估（可选）
        
        Returns:
            更新后的 RetirementApplication 实例
        """
        application = self.get_application_by_id(application_id)
        
        if not application:
            return None
        
        if application.status != ApplicationStatusEnum.DRAFT.value:
            raise ValueError("只有草稿状态的申请可以修改")
        
        if reason is not None:
            if len(reason.strip()) < 10:
                raise ValueError("报废原因不能少于10个字符")
            application.reason = reason
        
        if disposal_method is not None:
            if disposal_method not in [e.value for e in DisposalMethodEnum]:
                raise ValueError(f"无效的处置方式: {disposal_method}")
            application.disposal_method = disposal_method
        
        if estimated_value is not None:
            if estimated_value < 0:
                raise ValueError("残值评估不能为负数")
            application.estimated_value = estimated_value
        
        self.session.flush()
        return application

    def submit_application(self, application_id: UUID) -> Optional[RetirementApplication]:
        """
        提交报废申请（草稿 → 待审批）。
        
        触发审批链初始化、资产状态变更、日志记录。
        
        Args:
            application_id: 报废申请 ID
        
        Returns:
            更新后的 RetirementApplication 实例
        """
        application = self.get_application_by_id(application_id)
        
        if not application:
            return None
        
        if application.status != ApplicationStatusEnum.DRAFT.value:
            raise ValueError("只有草稿状态的申请可以提交")
        
        # 锁定资产状态
        asset = application.asset
        if asset.status not in [AssetStatusEnum.IDLE.value, AssetStatusEnum.IN_USE.value]:
            raise ValueError(f"资产当前状态 [{asset.status}] 不允许发起报废申请")
        
        # 更新申请状态
        application.status = ApplicationStatusEnum.PENDING.value
        
        # 更新资产状态
        asset.status = AssetStatusEnum.PENDING_APPROVAL.value
        
        # 记录状态变更日志
        self._log_state_transition(
            asset_id=asset.id,
            from_status=asset.__dict__.get("_status", asset.status),
            to_status=AssetStatusEnum.PENDING_APPROVAL.value,
            trigger_type=TriggerTypeEnum.MANUAL.value,
            operator_id=application.applicant_id,
            metadata={"application_id": str(application_id)}
        )
        
        self.session.flush()
        return application

    def withdraw_application(self, application_id: UUID, operator_id: UUID) -> Optional[RetirementApplication]:
        """
        撤回报废申请（申请人操作，前提：所有审批人未操作）。
        
        Args:
            application_id: 报废申请 ID
            operator_id: 操作人 ID
        
        Returns:
            更新后的 RetirementApplication 实例
        """
        application = self.get_application_by_id(application_id)
        
        if not application:
            return None
        
        if application.status not in [
            ApplicationStatusEnum.PENDING.value,
            ApplicationStatusEnum.APPROVAL_IN_PROGRESS.value
        ]:
            raise ValueError("当前状态不允许撤回")
        
        # 检查是否有审批人已操作
        pending_decisions = [
            ApprovalDecisionEnum.PENDING.value,
            ApprovalDecisionEnum.SKIPPED.value
        ]
        decided_count = self.session.query(ApprovalChain).filter(
            and_(
                ApprovalChain.application_id == application_id,
                ApprovalChain.decision.notin_(pending_decisions)
            )
        ).count()
        
        if decided_count > 0:
            raise ValueError("已有审批人操作，无法撤回")
        
        # 回滚状态
        asset = application.asset
        old_status = asset.status
        asset.status = AssetStatusEnum.IDLE.value
        
        # 跳过所有审批节点
        self.session.query(ApprovalChain).filter(
            ApprovalChain.application_id == application_id
        ).update({
            ApprovalChain.decision: ApprovalDecisionEnum.SKIPPED.value,
            ApprovalChain.comment: "申请人撤回",
            ApprovalChain.decided_at: datetime.utcnow()
        })
        
        application.status = ApplicationStatusEnum.WITHDRAWN.value
        
        # 记录状态变更日志
        self._log_state_transition(
            asset_id=asset.id,
            from_status=old_status,
            to_status=AssetStatusEnum.IDLE.value,
            trigger_type=TriggerTypeEnum.MANUAL.value,
            operator_id=operator_id,
            metadata={"application_id": str(application_id), "action": "withdraw"}
        )
        
        self.session.flush()
        return application

    # ==================== 审批链路（ApprovalChain）管理 ====================

    def init_approval_chain(
        self,
        application_id: UUID,
        approver_ids: List[UUID],
        chain_type: str = "serial",
    ) -> List[ApprovalChain]:
        """
        初始化审批链路。
        
        Args:
            application_id: 报废申请 ID
            approver_ids: 审批人 ID 列表（顺序即审批顺序）
            chain_type: 链路类型 ("serial" | "counter_sign" | "or_sign")
        
        Returns:
            创建的 ApprovalChain 节点列表
        """
        if len(approver_ids) > 5:
            raise ValueError("单次申请最多支持5级审批节点")
        
        if len(approver_ids) == 0:
            raise ValueError("至少需要一名审批人")
        
        application = self.get_application_by_id(application_id)
        if not application:
            raise ValueError("报废申请不存在")
        
        nodes = []
        for idx, approver_id in enumerate(approver_ids, start=1):
            node = ApprovalChain(
                application_id=application_id,
                node_order=idx,
                approver_id=approver_id,
                decision=ApprovalDecisionEnum.PENDING.value,
                chain_type=chain_type if idx == 1 else chain_type,  # 可扩展
            )
            nodes.append(node)
            self.session.add(node)
        
        application.status = ApplicationStatusEnum.APPROVAL_IN_PROGRESS.value
        
        # 更新资产状态
        asset = application.asset
        asset.status = AssetStatusEnum.APPROVAL_IN_PROGRESS.value
        
        self.session.flush()
        return nodes

    def get_approval_chain(self, application_id: UUID) -> List[ApprovalChain]:
        """
        获取指定申请的审批链路（按节点顺序排列）。
        
        Args:
            application_id: 报废申请 ID
        
        Returns:
            ApprovalChain 节点列表
        """
        return self.session.query(ApprovalChain).filter(
            ApprovalChain.application_id == application_id
        ).order_by(
            ApprovalChain.node_order
        ).all()

    def get_current_node(self, application_id: UUID) -> Optional[ApprovalChain]:
        """
        获取当前待审批节点。
        
        会签模式返回所有待审批节点，串行模式返回第一个待审批节点。
        
        Args:
            application_id: 报废申请 ID
        
        Returns:
            当前待审批的 ApprovalChain 节点，未找到返回 None
        """
        return self.session.query(ApprovalChain).filter(
            and_(
                ApprovalChain.application_id == application_id,
                ApprovalChain.decision == ApprovalDecisionEnum.PENDING.value
            )
        ).order_by(
            ApprovalChain.node_order
        ).first()

    def get_pending_nodes(self, application_id: UUID) -> List[ApprovalChain]:
        """
        获取所有待审批节点（支持并行审批场景）。
        
        Args:
            application_id: 报废申请 ID
        
        Returns:
            待审批节点列表
        """
        return self.session.query(ApprovalChain).filter(
            and_(
                ApprovalChain.application_id == application_id,
                ApprovalChain.decision == ApprovalDecisionEnum.PENDING.value
            )
        ).order_by(
            ApprovalChain.node_order
        ).all()

    def is_all_approved(self, application_id: UUID) -> bool:
        """
        判断审批链路是否全部通过。
        
        Args:
            application_id: 报废申请 ID
        
        Returns:
            全部通过返回 True，否则返回 False
        """
        pending_count = self.session.query(ApprovalChain).filter(
            and_(
                ApprovalChain.application_id == application_id,
                ApprovalChain.decision == ApprovalDecisionEnum.PENDING.value
            )
        ).count()
        
        return pending_count == 0

    def process_approval(
        self,
        application_id: UUID,
        node_order: int,
        approver_id: UUID,
        decision: str,
        comment: Optional[str] = None,
    ) -> Tuple[Optional[ApprovalChain], bool]:
        """
        处理审批决策。
        
        Args:
            application_id: 报废申请 ID
            node_order: 审批节点序号
            approver_id: 审批人 ID
            decision: 决策（"approved" | "rejected"）
            comment: 审批意见（可选）
        
        Returns:
            (更新的节点, 流程是否结束) 元组
        
        Raises:
            ValueError: 无效的决策或越权审批
        """
        if decision not in [ApprovalDecisionEnum.APPROVED.value, ApprovalDecisionEnum.REJECTED.value]:
            raise ValueError(f"无效的审批决策: {decision}")
        
        node = self.session.query(ApprovalChain).filter(
            and_(
                ApprovalChain.application_id == application_id,
                ApprovalChain.node_order == node_order
            )
        ).first()
        
        if not node:
            raise ValueError(f"审批节点不存在: {node_order}")
        
        if node.decision != ApprovalDecisionEnum.PENDING.value:
            raise ValueError("该节点已处理")
        
        if node.approver_id != approver_id:
            raise ValueError("越权审批操作")
        
        # 更新节点
        node.decision = decision
        node.comment = comment
        node.decided_at = datetime.utcnow()
        
        application = self.get_application_by_id(application_id)
        asset = application.asset
        
        if decision == ApprovalDecisionEnum.REJECTED.value:
            # 拒绝：流程终止，状态回滚
            application.status = ApplicationStatusEnum.REJECTED.value
            asset.status = AssetStatusEnum.IDLE.value
            
            # 跳过后续节点
            self.session.query(ApprovalChain).filter(
                and_(
                    ApprovalChain.application_id == application_id,
                    ApprovalChain.node_order > node_order
                )
            ).update({
                ApprovalChain.decision: ApprovalDecisionEnum.SKIPPED.value
            })
            
            self._log_state_transition(
                asset_id=asset.id,
                from_status=AssetStatusEnum.APPROVAL_IN_PROGRESS.value,
                to_status=AssetStatusEnum.IDLE.value,
                trigger_type=TriggerTypeEnum.APPROVAL.value,
                operator_id=approver_id,
                metadata={
                    "application_id": str(application_id),
                    "node_order": node_order,
                    "decision": decision,
                    "comment": comment
                }
            )
            
            return node, True  # 流程结束
        
        # 审批通过：检查是否还有下一节点
        next_node = self.session.query(ApprovalChain).filter(
            and_(
                ApprovalChain.application_id == application_id,
                ApprovalChain.node_order == node_order + 1
            )
        ).first()
        
        self._log_state_transition(
            asset_id=asset.id,
            from_status=AssetStatusEnum.APPROVAL_IN_PROGRESS.value,
            to_status=AssetStatusEnum.APPROVAL_IN_PROGRESS.value,
            trigger_type=TriggerTypeEnum.APPROVAL.value,
            operator_id=approver_id,
            metadata={
                "application_id": str(application_id),
                "node_order": node_order,
                "decision": decision,
                "comment": comment
            }
        )
        
        if next_node:
            return node, False  # 流程继续
        
        # 所有节点通过：进入已批准状态
        application.status = ApplicationStatusEnum.APPROVED.value
        
        self._log_state_transition(
            asset_id=asset.id,
            from_status=AssetStatusEnum.APPROVAL_IN_PROGRESS.value,
            to_status=AssetStatusEnum.SCRAPPED.value,
            trigger_type=TriggerTypeEnum.APPROVAL.value,
            operator_id=approver_id,
            metadata={
                "application_id": str(application_id),
                "decision": "all_approved",
                "final_status": AssetStatusEnum.SCRAPPED.value
            }
        )
        
        asset.status = AssetStatusEnum.SCRAPPED.value
        
        return node, True  # 流程结束

    # ==================== 状态变更日志（StateTransitionLog） ====================

    def _log_state_transition(
        self,
        asset_id: UUID,
        from_status: str,
        to_status: str,
        trigger_type: str,
        operator_id: Optional[UUID] = None,
        metadata: Optional[Dict[str, Any]] = None,
    ) -> StateTransitionLog:
        """
        记录状态变更日志（内部方法，带哈希链校验）。
        
        Args:
            asset_id: 资产 ID
            from_status: 原状态
            to_status: 新状态
            trigger_type: 触发类型
            operator_id: 操作人 ID
            metadata: 附加元数据
        
        Returns:
            创建的 StateTransitionLog 实例
        """
        import hashlib
        
        # 获取上一条日志用于哈希链
        last_log = self.session.query(StateTransitionLog).filter(
            StateTransitionLog.asset_id == asset_id
        ).order_by(
            StateTransitionLog.created_at.desc()
        ).first()
        
        previous_hash = last_log.hash_value if last_log else None
        
        # 构建当前记录的哈希值
        hash_input = f"{asset_id}:{from_status}:{to_status}:{trigger_type}:{datetime.utcnow().isoformat()}"
        hash_value = hashlib.sha256(hash_input.encode()).hexdigest()
        
        log = StateTransitionLog(
            asset_id=asset_id,
            from_status=from_status,
            to_status=to_status,
            trigger_type=trigger_type,
            operator_id=operator_id,
            metadata=metadata,
            hash_value=hash_value,
            previous_hash=previous_hash,
        )
        
        self.session.add(log)
        return log

    def get_state_history(
        self,
        asset_id: UUID,
        start_time: Optional[datetime] = None,
        end_time: Optional[datetime] = None,
    ) -> List[StateTransitionLog]:
        """
        查询资产状态变更历史。
        
        Args:
            asset_id: 资产 ID
            start_time: 查询起始时间（可选）
            end_time: 查询结束时间（可选）
        
        Returns:
            状态变更日志列表，按时间升序排列
        """
        query = self.session.query(StateTransitionLog).filter(
            StateTransitionLog.asset_id == asset_id
        )
        
        if start_time:
            query = query.filter(StateTransitionLog.created_at >= start_time)
        
        if end_time:
            query = query.filter(StateTransitionLog.created_at <= end_time)
        
        return query.order_by(StateTransitionLog.created_at.asc()).all()

    def verify_hash_chain(self, asset_id: UUID) -> bool:
        """
        校验哈希链完整性（防篡改）。
        
        Args:
            asset_id: 资产 ID
        
        Returns:
            哈希链完整返回 True，否则返回 False
        """
        import hashlib
        
        logs = self.session.query(StateTransitionLog).filter(
            StateTransitionLog.asset_id == asset_id
        ).order_by(StateTransitionLog.created_at.asc()).all()
        
        if not logs:
            return True
        
        for i, log in enumerate(logs):
            if i == 0:
                continue
            
            # 验证 previous_hash 指向前一节点的 hash_value
            if log.previous_hash != logs[i - 1].hash_value:
                return False
        
        return True

    # ==================== 辅助查询方法 ====================

    def cleanup_expired_drafts(self, days: int = 30) -> int:
        """
        清理过期的草稿申请（超过指定天数未提交）。
        
        Args:
            days: 保留天数，默认 30 天
        
        Returns:
            清理的记录数
        """
        cutoff_date = datetime.utcnow() - timedelta(days=days)
        
        expired_applications = self.session.query(RetirementApplication).filter(
            and_(
                RetirementApplication.status == ApplicationStatusEnum.DRAFT.value,
                RetirementApplication.created_at < cutoff_date
            )
        ).all()
        
        count = len(expired_applications)
        
        for app in expired_applications:
            self.session.delete(app)
        
        self.session.flush()
        return count

    def mark_timeout_nodes(self, hours: int = 72) -> int:
        """
        标记超时的审批节点。
        
        Args:
            hours: 超时阈值（小时），默认 72 小时
        
        Returns:
            标记的节点数
        """
        cutoff_time = datetime.utcnow() - timedelta(hours=hours)
        
        timeout_count = self.session.query(ApprovalChain).filter(
            and_(
                ApprovalChain.decision == ApprovalDecisionEnum.PENDING.value,
                ApprovalChain.created_at < cutoff_time,
                ApprovalChain.timeout_flag == "N"
            )
        ).update({
            ApprovalChain.timeout_flag: "Y"
        })
        
        self.session.flush()
        return timeout_count