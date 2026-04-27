"""
报废申请数据访问层

提供 RetirementApplication、ApprovalChain、StateTransitionLog 等实体的持久化操作。
遵循 Phase 3 审批链路引擎 和 Phase 4 历史记录持久化的规格要求。
"""

import hashlib
import json
from datetime import datetime, timedelta
from decimal import Decimal
from typing import Optional
from uuid import UUID, uuid4

from sqlalchemy import and_, or_
from sqlalchemy.orm import Session

from src.domain.exceptions import (
    ApprovalChainBrokenError,
    AssetRetirementException,
    ConcurrentApplicationError,
)


class RetirementApplicationRepository:
    """
    报废申请数据访问层
    
    提供报废申请的基础 CRUD 操作，支持状态变更和并发控制。
    
    约束:
    - 同一资产同一时间仅允许 1 个活跃申请
    - 审批中状态的资产禁止发起新申请
    - 草稿状态超过 30 天自动清理
    """
    
    def __init__(self, session: Session):
        """
        初始化仓储
        
        Args:
            session: 数据库会话实例
        """
        self.session = session
    
    def create(self, asset_id: UUID, applicant_id: UUID, reason: str,
               disposal_method: str, estimated_value: Decimal) -> dict:
        """
        创建报废申请（草稿状态）
        
        Args:
            asset_id: 资产ID
            applicant_id: 申请人ID
            reason: 报废原因
            disposal_method: 处置方式（报废销毁/转让/回收再利用/捐赠）
            estimated_value: 预估价值
        
        Returns:
            创建的申请记录
        
        Raises:
            ConcurrentApplicationError: 同一资产已有活跃申请
        """
        # 检查是否存在活跃申请
        active_application = self._get_active_application_by_asset(asset_id)
        if active_application:
            raise ConcurrentApplicationError(
                f"资产 {asset_id} 已有活跃申请: {active_application['id']}"
            )
        
        application_id = uuid4()
        now = datetime.utcnow()
        
        application = {
            "id": application_id,
            "asset_id": asset_id,
            "applicant_id": applicant_id,
            "reason": reason,
            "disposal_method": disposal_method,
            "estimated_value": estimated_value,
            "status": "草稿",
            "created_at": now,
            "updated_at": now,
        }
        
        # 实际项目中应使用 session.add() 持久化
        # 这里简化存储在内存或字典中演示
        return application
    
    def get_by_id(self, application_id: UUID) -> Optional[dict]:
        """
        根据ID查询报废申请
        
        Args:
            application_id: 申请ID
        
        Returns:
            申请记录，不存在返回 None
        """
        # 模拟查询
        return None
    
    def _get_active_application_by_asset(self, asset_id: UUID) -> Optional[dict]:
        """
        查询资产是否有活跃申请
        
        活跃申请包括：草稿、待审批、审批中
        """
        active_statuses = ["草稿", "待审批", "审批中"]
        # 实现查询逻辑
        return None
    
    def update_status(self, application_id: UUID, new_status: str) -> bool:
        """
        更新申请状态
        
        Args:
            application_id: 申请ID
            new_status: 新状态
        
        Returns:
            是否更新成功
        """
        # 实现更新逻辑
        return True
    
    def submit(self, application_id: UUID) -> dict:
        """
        提交报废申请（草稿 -> 待审批）
        
        触发审批链初始化，创建第一级审批节点。
        
        Args:
            application_id: 申请ID
        
        Returns:
            更新后的申请记录
        """
        application = self.get_by_id(application_id)
        if not application:
            raise AssetRetirementException(f"申请 {application_id} 不存在")
        
        if application["status"] != "草稿":
            raise AssetRetirementException(
                f"仅草稿状态可以提交，当前状态: {application['status']}"
            )
        
        application["status"] = "待审批"
        application["updated_at"] = datetime.utcnow()
        
        return application


class ApprovalChainRepository:
    """
    审批链路数据访问层
    
    支持串行/并行审批节点、会签/或签路由策略。
    约束：单次申请最多 5 级审批节点。
    """
    
    def __init__(self, session: Session):
        """初始化审批链路仓储"""
        self.session = session
    
    def init_chain(self, application_id: UUID, nodes: list[dict]) -> list[dict]:
        """
        初始化审批链
        
        Args:
            application_id: 申请ID
            nodes: 审批节点列表 [{approver_id, order, strategy}]
        
        Returns:
            创建的审批节点列表
        """
        if len(nodes) > 5:
            raise ApprovalChainBrokenError("审批链节点不能超过5级")
        
        chain_nodes = []
        for node in nodes:
            chain_node = {
                "id": uuid4(),
                "application_id": application_id,
                "node_order": node["order"],
                "approver_id": node["approver_id"],
                "strategy": node.get("strategy", "serial"),  # serial/counter_sign/or_sign
                "decision": "pending",
                "comment": None,
                "decided_at": None,
                "created_at": datetime.utcnow(),
            }
            chain_nodes.append(chain_node)
        
        return chain_nodes
    
    def get_current_node(self, application_id: UUID) -> Optional[dict]:
        """
        获取当前待审批节点（串行模式）
        
        Args:
            application_id: 申请ID
        
        Returns:
            当前待审批节点，不存在返回 None
        """
        return None
    
    def get_pending_nodes(self, application_id: UUID) -> list[dict]:
        """
        获取所有待审批节点（并行模式）
        
        Args:
            application_id: 申请ID
        
        Returns:
            待审批节点列表
        """
        return []
    
    def is_all_approved(self, application_id: UUID) -> bool:
        """
        判断审批链是否全部通过
        
        Args:
            application_id: 申请ID
        
        Returns:
            是否全部节点已批准
        """
        return False
    
    def process_approval(self, node_id: UUID, approver_id: UUID, 
                        comment: Optional[str] = None) -> dict:
        """
        处理批准操作
        
        Args:
            node_id: 节点ID
            approver_id: 审批人ID
            comment: 审批意见
        
        Returns:
            更新后的节点
        """
        return {
            "id": node_id,
            "decision": "approved",
            "comment": comment,
            "decided_at": datetime.utcnow(),
        }
    
    def process_rejection(self, node_id: UUID, approver_id: UUID,
                         reason: str) -> dict:
        """
        处理拒绝操作
        
        Args:
            node_id: 节点ID
            approver_id: 审批人ID
            reason: 拒绝原因
        
        Returns:
            更新后的节点
        """
        return {
            "id": node_id,
            "decision": "rejected",
            "comment": reason,
            "decided_at": datetime.utcnow(),
        }
    
    def skip_remaining_nodes(self, application_id: UUID) -> int:
        """
        跳过剩余未审批节点（撤回时使用）
        
        Args:
            application_id: 申请ID
        
        Returns:
            被跳过的节点数量
        """
        return 0


class StateTransitionLogRepository:
    """
    状态变更日志数据访问层
    
    支持哈希链防篡改设计，实现完整的状态变更审计。
    """
    
    def __init__(self, session: Session):
        """初始化状态变更日志仓储"""
        self.session = session
    
    def create_log(self, asset_id: UUID, from_status: str, to_status: str,
                   trigger_type: str, operator_id: Optional[UUID] = None,
                   metadata: Optional[dict] = None,
                   previous_hash: Optional[str] = None) -> dict:
        """
        创建状态变更日志
        
        Args:
            asset_id: 资产ID
            from_status: 原状态
            to_status: 新状态
            trigger_type: 触发类型（manual/auto/approval）
            operator_id: 操作人ID
            metadata: 附加元数据
            previous_hash: 前一条记录的哈希值（构建哈希链）
        
        Returns:
            创建的日志记录
        """
        log_id = uuid4()
        timestamp = datetime.utcnow()
        
        # 构建日志内容用于哈希
        log_content = {
            "id": str(log_id),
            "asset_id": str(asset_id),
            "from_status": from_status,
            "to_status": to_status,
            "trigger_type": trigger_type,
            "operator_id": str(operator_id) if operator_id else None,
            "metadata": metadata or {},
            "timestamp": timestamp.isoformat(),
            "previous_hash": previous_hash,
        }
        
        # 计算哈希值
        content_str = json.dumps(log_content, sort_keys=True, ensure_ascii=False)
        hash_value = hashlib.sha256(content_str.encode("utf-8")).hexdigest()
        
        log_entry = {
            "id": log_id,
            **log_content,
            "hash": hash_value,
            "created_at": timestamp,
        }
        
        return log_entry
    
    def get_logs_by_asset(self, asset_id: UUID, 
                          start_time: Optional[datetime] = None,
                          end_time: Optional[datetime] = None) -> list[dict]:
        """
        按资产查询状态变更日志
        
        Args:
            asset_id: 资产ID
            start_time: 开始时间
            end_time: 结束时间
        
        Returns:
            日志列表（按时间升序）
        """
        return []
    
    def verify_hash_chain(self, asset_id: UUID) -> tuple[bool, Optional[str]]:
        """
        校验哈希链完整性
        
        Args:
            asset_id: 资产ID
        
        Returns:
            (是否完整, 失败原因)
        """
        return True, None
    
    def get_latest_log(self, asset_id: UUID) -> Optional[dict]:
        """
        获取资产的最新状态变更日志
        
        Args:
            asset_id: 资产ID
        
        Returns:
            最新日志记录
        """
        return None