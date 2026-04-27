"""
资产状态历史服务模块

本模块实现资产状态流转的历史记录持久化功能，支持：
- 状态变更事件的完整记录
- 审批操作原子性记录
- 审计日志防篡改设计（哈希链）

对应需求：SWARM-002 Iteration 8 - Phase 4 历史记录持久化

架构层级：
- Domain Service Layer
- 依赖：src.domain.entities.history, src.domain.entities.retirement_app
- 被依赖：src.domain.use_cases.retirement_usecase, src.api.routes.retirement
"""

from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from typing import Optional
import hashlib
import json


class TriggerType(str, Enum):
    """
    状态变更触发类型枚举
    
    枚举值：
        MANUAL: 手动触发，如用户主动发起状态变更
        AUTO: 自动触发，如定时任务检测到年限到期
        APPROVAL: 审批触发，如审批通过后自动流转状态
    """
    MANUAL = "manual"
    AUTO = "auto"
    APPROVAL = "approval"


@dataclass
class StateTransitionRecord:
    """
    状态变更记录数据模型
    
    属性：
        id: 记录唯一标识符（UUID）
        asset_id: 资产ID
        from_status: 变更前状态
        to_status: 变更后状态
        trigger_type: 触发类型
        operator_id: 操作人员ID（可为None表示系统操作）
        metadata: 附加元数据（JSON格式）
        created_at: 记录创建时间
        hash_value: 哈希值（用于审计链校验）
        previous_hash: 前一条记录的哈希值
    """
    id: str
    asset_id: str
    from_status: str
    to_status: str
    trigger_type: TriggerType
    operator_id: Optional[str] = None
    metadata: dict = field(default_factory=dict)
    created_at: datetime = field(default_factory=datetime.utcnow)
    hash_value: str = ""
    previous_hash: str = ""
    
    def __post_init__(self):
        """初始化后计算哈希值"""
        if not self.hash_value:
            self.hash_value = self._compute_hash()
    
    def _compute_hash(self) -> str:
        """
        计算当前记录的哈希值
        
        哈希算法：SHA-256
        输入字段：asset_id + from_status + to_status + trigger_type + 
                 operator_id + metadata_json + created_at_iso + previous_hash
        
        Returns:
            str: 十六进制哈希字符串
        """
        content = (
            f"{self.asset_id}"
            f"{self.from_status}"
            f"{self.to_status}"
            f"{self.trigger_type.value if isinstance(self.trigger_type, TriggerType) else self.trigger_type}"
            f"{self.operator_id or ''}"
            f"{json.dumps(self.metadata, sort_keys=True, default=str)}"
            f"{self.created_at.isoformat() if isinstance(self.created_at, datetime) else str(self.created_at)}"
            f"{self.previous_hash}"
        )
        return hashlib.sha256(content.encode('utf-8')).hexdigest()
    
    def to_dict(self) -> dict:
        """
        将记录转换为字典格式
        
        Returns:
            dict: 状态变更记录字典
        """
        return {
            "id": self.id,
            "asset_id": self.asset_id,
            "from_status": self.from_status,
            "to_status": self.to_status,
            "trigger_type": self.trigger_type.value if isinstance(self.trigger_type, TriggerType) else self.trigger_type,
            "operator_id": self.operator_id,
            "metadata": self.metadata,
            "created_at": self.created_at.isoformat() if isinstance(self.created_at, datetime) else str(self.created_at),
            "hash_value": self.hash_value,
            "previous_hash": self.previous_hash,
        }


@dataclass
class ApprovalActionRecord:
    """
    审批操作记录数据模型
    
    属性：
        id: 记录唯一标识符（UUID）
        application_id: 报废申请ID
        node_order: 审批节点序号
        approver_id: 审批人ID
        decision: 审批决定（approved/rejected/skipped）
        comment: 审批意见
        decided_at: 审批时间
        created_at: 记录创建时间
        hash_value: 哈希值
        previous_hash: 前一条记录的哈希值
    """
    id: str
    application_id: str
    node_order: int
    approver_id: str
    decision: str
    comment: Optional[str] = None
    decided_at: Optional[datetime] = None
    created_at: datetime = field(default_factory=datetime.utcnow)
    hash_value: str = ""
    previous_hash: str = ""
    
    def __post_init__(self):
        """初始化后计算哈希值"""
        if not self.hash_value:
            self.hash_value = self._compute_hash()
    
    def _compute_hash(self) -> str:
        """
        计算当前审批记录的哈希值
        
        Returns:
            str: 十六进制哈希字符串
        """
        content = (
            f"{self.application_id}"
            f"{self.node_order}"
            f"{self.approver_id}"
            f"{self.decision}"
            f"{self.comment or ''}"
            f"{self.decided_at.isoformat() if self.decided_at else ''}"
            f"{self.created_at.isoformat() if isinstance(self.created_at, datetime) else str(self.created_at)}"
            f"{self.previous_hash}"
        )
        return hashlib.sha256(content.encode('utf-8')).hexdigest()
    
    def to_dict(self) -> dict:
        """
        将审批记录转换为字典格式
        
        Returns:
            dict: 审批操作记录字典
        """
        return {
            "id": self.id,
            "application_id": self.application_id,
            "node_order": self.node_order,
            "approver_id": self.approver_id,
            "decision": self.decision,
            "comment": self.comment,
            "decided_at": self.decided_at.isoformat() if self.decided_at else None,
            "created_at": self.created_at.isoformat() if isinstance(self.created_at, datetime) else str(self.created_at),
            "hash_value": self.hash_value,
            "previous_hash": self.previous_hash,
        }


class AuditChainIntegrityError(Exception):
    """
    审计链完整性异常
    
    当检测到审计链被篡改时抛出此异常
    """
    pass


class StatusHistoryService:
    """
    资产状态历史服务
    
    核心职责：
    1. 记录所有资产状态变更事件
    2. 记录审批操作原子性
    3. 提供历史查询接口
    4. 验证审计链完整性（防篡改）
    
    使用方式：
    ```python
    service = StatusHistoryService(repository)
    
    # 记录状态变更
    record = service.record_transition(
        asset_id="AST-001",
        from_status="在用",
        to_status="待审批",
        trigger_type=TriggerType.MANUAL,
        operator_id="USER-123"
    )
    
    # 查询历史
    history = service.get_asset_history(asset_id="AST-001")
    
    # 校验完整性
    service.verify_chain_integrity(asset_id="AST-001")
    ```
    """
    
    def __init__(self, repository: 'StateHistoryRepository'):
        """
        初始化状态历史服务
        
        Args:
            repository: 状态历史仓储实例，负责底层数据持久化
        """
        self._repository = repository
    
    def record_transition(
        self,
        asset_id: str,
        from_status: str,
        to_status: str,
        trigger_type: TriggerType,
        operator_id: Optional[str] = None,
        metadata: Optional[dict] = None
    ) -> StateTransitionRecord:
        """
        记录资产状态变更
        
        此方法执行以下操作：
        1. 获取前一条记录的哈希值构建哈希链
        2. 创建新的状态变更记录
        3. 计算当前记录的哈希值
        4. 持久化记录到数据库
        
        Args:
            asset_id: 资产唯一标识符
            from_status: 变更前状态
            to_status: 变更后状态
            trigger_type: 触发类型枚举
            operator_id: 操作人员ID（可选）
            metadata: 附加元数据（可选），如审批备注、设备信息等
        
        Returns:
            StateTransitionRecord: 新创建的状态变更记录
        
        Raises:
            Exception: 当仓储操作失败时抛出
        
        Example:
            >>> service = StatusHistoryService(repo)
            >>> record = service.record_transition(
            ...     asset_id="AST-2024-001",
            ...     from_status="闲置",
            ...     to_status="待审批",
            ...     trigger_type=TriggerType.MANUAL,
            ...     operator_id="USER-001"
            ... )
            >>> print(record.hash_value)
            'a1b2c3d4...'
        """
        # 获取前一条记录以构建哈希链
        last_record = self._repository.get_last_by_asset(asset_id)
        previous_hash = last_record.hash_value if last_record else "genesis"
        
        # 创建新的状态变更记录
        record = StateTransitionRecord(
            id=self._generate_id(),
            asset_id=asset_id,
            from_status=from_status,
            to_status=to_status,
            trigger_type=trigger_type,
            operator_id=operator_id,
            metadata=metadata or {},
            previous_hash=previous_hash,
            created_at=datetime.utcnow()
        )
        
        # 持久化到数据库
        self._repository.save_transition(record)
        
        return record
    
    def record_approval_action(
        self,
        application_id: str,
        node_order: int,
        approver_id: str,
        decision: str,
        comment: Optional[str] = None
    ) -> ApprovalActionRecord:
        """
        记录审批操作
        
        审批操作与状态变更记录必须同事务写入，以保证原子性。
        
        Args:
            application_id: 报废申请ID
            node_order: 审批节点序号
            approver_id: 审批人ID
            decision: 审批决定（approved/rejected/skipped）
            comment: 审批意见（可选）
        
        Returns:
            ApprovalActionRecord: 新创建的审批操作记录
        
        Example:
            >>> record = service.record_approval_action(
            ...     application_id="APP-2024-001",
            ...     node_order=1,
            ...     approver_id="USER-002",
            ...     decision="approved",
            ...     comment="同意报废处理"
            ... )
        """
        # 获取前一条审批记录
        last_record = self._repository.get_last_approval_by_application(application_id)
        previous_hash = last_record.hash_value if last_record else "approval_genesis"
        
        # 创建审批记录
        record = ApprovalActionRecord(
            id=self._generate_id(),
            application_id=application_id,
            node_order=node_order,
            approver_id=approver_id,
            decision=decision,
            comment=comment,
            decided_at=datetime.utcnow(),
            previous_hash=previous_hash,
            created_at=datetime.utcnow()
        )
        
        # 持久化
        self._repository.save_approval_action(record)
        
        return record
    
    def get_asset_history(
        self,
        asset_id: str,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None
    ) -> list[StateTransitionRecord]:
        """
        获取资产完整状态变更历史
        
        Args:
            asset_id: 资产唯一标识符
            start_date: 查询起始时间（可选）
            end_date: 查询结束时间（可选）
        
        Returns:
            list[StateTransitionRecord]: 按时间升序排列的状态变更记录列表
        
        Example:
            >>> history = service.get_asset_history(asset_id="AST-001")
            >>> for record in history:
            ...     print(f"{record.created_at}: {record.from_status} -> {record.to_status}")
        """
        return self._repository.get_transitions_by_asset(
            asset_id=asset_id,
            start_date=start_date,
            end_date=end_date
        )
    
    def get_approval_history(
        self,
        application_id: str
    ) -> list[ApprovalActionRecord]:
        """
        获取申请的全部审批历史
        
        Args:
            application_id: 报废申请ID
        
        Returns:
            list[ApprovalActionRecord]: 按时间升序排列的审批记录列表
        """
        return self._repository.get_approvals_by_application(application_id)
    
    def verify_chain_integrity(
        self,
        asset_id: str
    ) -> bool:
        """
        验证资产状态变更审计链的完整性
        
        通过重新计算每条记录的哈希值并与存储的哈希值对比，
        检测是否存在篡改行为。
        
        算法说明：
        1. 按时间顺序获取所有记录
        2. 对每条记录重新计算哈希值
        3. 验证previous_hash字段是否正确链接
        4. 任意一条记录不匹配则抛出异常
        
        Args:
            asset_id: 资产唯一标识符
        
        Returns:
            bool: 验证通过返回True
        
        Raises:
            AuditChainIntegrityError: 当检测到哈希链断裂或记录被篡改
        
        Example:
            >>> try:
            ...     service.verify_chain_integrity("AST-001")
            ...     print("审计链完整，未被篡改")
            ... except AuditChainIntegrityError:
            ...     print("警告：检测到审计链异常！")
        """
        records = self._repository.get_transitions_by_asset(asset_id)
        
        if not records:
            return True
        
        expected_previous_hash = "genesis"
        
        for record in records:
            # 验证previous_hash链接
            if record.previous_hash != expected_previous_hash:
                raise AuditChainIntegrityError(
                    f"哈希链断裂：资产{asset_id}记录{record.id}的previous_hash不匹配"
                )
            
            # 重新计算并验证哈希值
            computed_hash = record._compute_hash()
            if computed_hash != record.hash_value:
                raise AuditChainIntegrityError(
                    f"记录篡改检测：资产{asset_id}记录{record.id}的哈希值不匹配"
                )
            
            expected_previous_hash = record.hash_value
        
        return True
    
    def verify_approval_chain_integrity(
        self,
        application_id: str
    ) -> bool:
        """
        验证审批操作审计链的完整性
        
        Args:
            application_id: 报废申请ID
        
        Returns:
            bool: 验证通过返回True
        
        Raises:
            AuditChainIntegrityError: 当检测到审批链被篡改
        """
        records = self._repository.get_approvals_by_application(application_id)
        
        if not records:
            return True
        
        expected_previous_hash = "approval_genesis"
        
        for record in records:
            if record.previous_hash != expected_previous_hash:
                raise AuditChainIntegrityError(
                    f"审批哈希链断裂：申请{application_id}记录{record.id}"
                )
            
            computed_hash = record._compute_hash()
            if computed_hash != record.hash_value:
                raise AuditChainIntegrityError(
                    f"审批记录篡改检测：申请{application_id}记录{record.id}"
                )
            
            expected_previous_hash = record.hash_value
        
        return True
    
    def get_transition_statistics(
        self,
        asset_id: Optional[str] = None,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None
    ) -> dict:
        """
        获取状态变更统计信息
        
        Args:
            asset_id: 资产ID（可选，为None则统计所有资产）
            start_date: 统计起始时间
            end_date: 统计结束时间
        
        Returns:
            dict: 统计信息字典，包含总变更次数、各状态转换次数等
        """
        return self._repository.get_statistics(
            asset_id=asset_id,
            start_date=start_date,
            end_date=end_date
        )
    
    def rollback_to_state(
        self,
        asset_id: str,
        target_record_id: str
    ) -> list[StateTransitionRecord]:
        """
        回滚资产状态到指定的历史节点
        
        注意：此操作会生成新的状态变更记录，而不是真正删除历史。
        真正的删除操作需要在合规审批后执行。
        
        Args:
            asset_id: 资产唯一标识符
            target_record_id: 目标回滚节点的记录ID
        
        Returns:
            list[StateTransitionRecord]: 回滚操作产生的新记录列表
        """
        target_record = self._repository.get_transition_by_id(target_record_id)
        
        if not target_record or target_record.asset_id != asset_id:
            raise ValueError(f"无效的回滚目标：记录{target_record_id}不存在或不属于资产{asset_id}")
        
        # 记录回滚操作
        rollback_record = self.record_transition(
            asset_id=asset_id,
            from_status=target_record.to_status,
            to_status=target_record.from_status,
            trigger_type=TriggerType.AUTO,
            metadata={
                "rollback_from_record_id": target_record_id,
                "rollback_reason": "审批拒绝后状态回滚"
            }
        )
        
        return [rollback_record]
    
    def _generate_id(self) -> str:
        """
        生成唯一标识符
        
        使用时间戳 + 随机字符串确保唯一性
        
        Returns:
            str: UUID格式的唯一标识符
        """
        import uuid
        return str(uuid.uuid4())
    
    def search_transitions(
        self,
        from_status: Optional[str] = None,
        to_status: Optional[str] = None,
        trigger_type: Optional[TriggerType] = None,
        operator_id: Optional[str] = None,
        limit: int = 100,
        offset: int = 0
    ) -> list[StateTransitionRecord]:
        """
        高级查询状态变更记录
        
        Args:
            from_status: 起始状态过滤
            to_status: 目标状态过滤
            trigger_type: 触发类型过滤
            operator_id: 操作人员过滤
            limit: 返回记录数量限制
            offset: 分页偏移量
        
        Returns:
            list[StateTransitionRecord]: 符合条件的记录列表
        """
        return self._repository.search_transitions(
            from_status=from_status,
            to_status=to_status,
            trigger_type=trigger_type,
            operator_id=operator_id,
            limit=limit,
            offset=offset
        )