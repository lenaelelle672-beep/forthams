"""
资产报废退役流程 - 审计链哈希校验模块

该模块实现了基于哈希链的防篡改审计机制，用于确保 StateTransitionLog 的完整性。
每次状态变更会产生一条日志记录，记录之间通过哈希值形成链式结构，任何历史记录的
篡改都会导致哈希校验失败，从而实现完整的审计追溯能力。

技术规格：
- 使用 SHA-256 哈希算法
- 链式结构: 每条记录包含前一条记录的哈希值
- 创世块: 第一条记录使用预设盐值作为前驱哈希

使用场景：
- 状态变更日志的完整性校验
- 历史查询时的篡改检测
- 合规审计追溯

相关模块：
- StateTransitionLog: 状态变更日志实体
- AuditChainBrokenError: 审计链篡改异常
"""

import hashlib
import json
from datetime import datetime
from typing import Optional, List, Dict, Any
from dataclasses import dataclass, field
from uuid import UUID

from src.domain.exceptions import AuditChainBrokenError


# 创世块盐值 - 用于第一条记录的哈希计算
GENESIS_SALT = "SWARM-002-AUDIT-CHAIN-GENESIS-2024"


@dataclass
class AuditChainNode:
    """
    审计链节点数据结构
    
    Attributes:
        node_id: 节点唯一标识
        predecessor_hash: 前驱节点的哈希值
        current_hash: 当前节点的哈希值
        asset_id: 资产ID
        from_status: 源状态
        to_status: 目标状态
        trigger_type: 触发类型 (manual/auto/approval)
        operator_id: 操作人ID
        metadata: 附加元数据
        created_at: 创建时间戳
        sequence_number: 序列号（链中位置）
    """
    node_id: UUID
    predecessor_hash: str
    current_hash: str
    asset_id: UUID
    from_status: str
    to_status: str
    trigger_type: str
    operator_id: Optional[UUID] = None
    metadata: Dict[str, Any] = field(default_factory=dict)
    created_at: datetime = field(default_factory=datetime.utcnow)
    sequence_number: int = 0


@dataclass
class ChainIntegrityResult:
    """
    链完整性校验结果
    
    Attributes:
        is_valid: 校验是否通过
        broken_at: 如果失败，断裂的节点位置
        expected_hash: 期望的哈希值
        actual_hash: 实际的哈希值
        error_message: 错误描述信息
        validated_count: 已验证的节点数量
    """
    is_valid: bool
    broken_at: Optional[int] = None
    expected_hash: Optional[str] = None
    actual_hash: Optional[str] = None
    error_message: Optional[str] = None
    validated_count: int = 0


class AuditHashChain:
    """
    哈希链审计工具类
    
    实现了状态变更日志的链式存储和完整性校验，确保历史记录不可篡改。
    
    使用方式:
        chain = AuditHashChain()
        
        # 添加新节点
        node = chain.append(
            asset_id=asset_uuid,
            from_status="闲置",
            to_status="待审批",
            trigger_type="manual",
            operator_id=user_uuid,
            metadata={"application_id": app_uuid}
        )
        
        # 校验完整性
        result = chain.verify_chain(nodes)
        if not result.is_valid:
            raise AuditChainBrokenError(f"Chain broken at node {result.broken_at}")
    
    核心算法:
        current_hash = SHA256(
            predecessor_hash + 
            asset_id + 
            from_status + 
            to_status + 
            trigger_type + 
            operator_id + 
            metadata_json + 
            created_at_iso
        )
    """
    
    def __init__(self, genesis_salt: str = GENESIS_SALT):
        """
        初始化审计哈希链
        
        Args:
            genesis_salt: 创世块盐值，用于计算第一条记录的前驱哈希
            
        Returns:
            None
        """
        self.genesis_salt = genesis_salt
    
    def compute_hash(
        self,
        predecessor_hash: str,
        asset_id: UUID,
        from_status: str,
        to_status: str,
        trigger_type: str,
        operator_id: Optional[UUID],
        metadata: Dict[str, Any],
        created_at: datetime
    ) -> str:
        """
        计算单条记录的哈希值
        
        哈希内容包含: 前驱哈希 + 资产ID + 状态变更信息 + 操作人 + 元数据 + 时间戳
        
        Args:
            predecessor_hash: 前驱节点哈希值（创世块使用盐值）
            asset_id: 资产UUID
            from_status: 源状态
            to_status: 目标状态
            trigger_type: 触发类型
            operator_id: 操作人UUID
            metadata: 附加数据字典
            created_at: 创建时间
        
        Returns:
            SHA-256 哈希值（十六进制字符串，64字符）
        """
        # 标准化元数据确保一致的哈希结果
        metadata_json = json.dumps(metadata, sort_keys=True, ensure_ascii=False)
        
        # 构建哈希输入字符串
        hash_input = "|".join([
            predecessor_hash,
            str(asset_id),
            from_status,
            to_status,
            trigger_type,
            str(operator_id) if operator_id else "",
            metadata_json,
            created_at.isoformat()
        ])
        
        # 使用 SHA-256 计算哈希
        return hashlib.sha256(hash_input.encode('utf-8')).hexdigest()
    
    def compute_genesis_hash(self) -> str:
        """
        计算创世块哈希值
        
        创世块是链中的第一个节点，其前驱哈希使用预设盐值计算得出。
        
        Returns:
            创世块哈希值
        """
        return hashlib.sha256(self.genesis_salt.encode('utf-8')).hexdigest()
    
    def append(
        self,
        asset_id: UUID,
        from_status: str,
        to_status: str,
        trigger_type: str,
        operator_id: Optional[UUID] = None,
        metadata: Optional[Dict[str, Any]] = None,
        previous_node: Optional[AuditChainNode] = None,
        sequence_number: int = 0
    ) -> AuditChainNode:
        """
        创建并返回新的审计链节点
        
        根据前驱节点计算当前节点的哈希值，追加到链中。
        
        Args:
            asset_id: 资产UUID
            from_status: 源状态
            to_status: 目标状态
            trigger_type: 触发类型 (manual/auto/approval)
            operator_id: 操作人UUID
            metadata: 附加元数据
            previous_node: 前一个链节点（用于计算前驱哈希）
            sequence_number: 序列号
        
        Returns:
            新创建的 AuditChainNode 实例
        """
        current_time = datetime.utcnow()
        metadata = metadata or {}
        
        # 确定前驱哈希值
        if previous_node is None:
            # 创世块
            predecessor_hash = self.compute_genesis_hash()
        else:
            predecessor_hash = previous_node.current_hash
        
        # 计算当前节点哈希
        current_hash = self.compute_hash(
            predecessor_hash=predecessor_hash,
            asset_id=asset_id,
            from_status=from_status,
            to_status=to_status,
            trigger_type=trigger_type,
            operator_id=operator_id,
            metadata=metadata,
            created_at=current_time
        )
        
        # 生成节点ID
        import uuid
        node_id = uuid.uuid4()
        
        return AuditChainNode(
            node_id=node_id,
            predecessor_hash=predecessor_hash,
            current_hash=current_hash,
            asset_id=asset_id,
            from_status=from_status,
            to_status=to_status,
            trigger_type=trigger_type,
            operator_id=operator_id,
            metadata=metadata,
            created_at=current_time,
            sequence_number=sequence_number
        )
    
    def verify_chain(self, nodes: List[AuditChainNode]) -> ChainIntegrityResult:
        """
        验证审计链的完整性
        
        从链的头部开始，逐个节点验证哈希值的正确性。
        任何一个节点的哈希值与预期不符，即认为链被篡改。
        
        Args:
            nodes: 按时间顺序排列的审计链节点列表
        
        Returns:
            ChainIntegrityResult: 完整性校验结果
            
        Raises:
            AuditChainBrokenError: 当检测到链被篡改时抛出
            
        算法步骤:
            1. 如果链为空，直接通过
            2. 第一节点的 predecessor_hash 应等于创世块哈希
            3. 后续每个节点的 predecessor_hash 应等于前一节点的 current_hash
            4. 每个节点的 current_hash 应等于根据其内容重新计算的哈希
        """
        if not nodes:
            return ChainIntegrityResult(is_valid=True, validated_count=0)
        
        # 验证第一个节点（创世块连接）
        first_node = nodes[0]
        expected_genesis_hash = self.compute_genesis_hash()
        
        if first_node.predecessor_hash != expected_genesis_hash:
            return ChainIntegrityResult(
                is_valid=False,
                broken_at=0,
                expected_hash=expected_genesis_hash,
                actual_hash=first_node.predecessor_hash,
                error_message="Genesis block connection broken",
                validated_count=0
            )
        
        # 验证链的连续性和内容完整性
        for i, node in enumerate(nodes):
            # 计算期望的当前哈希
            expected_hash = self.compute_hash(
                predecessor_hash=node.predecessor_hash,
                asset_id=node.asset_id,
                from_status=node.from_status,
                to_status=node.to_status,
                trigger_type=node.trigger_type,
                operator_id=node.operator_id,
                metadata=node.metadata,
                created_at=node.created_at
            )
            
            if node.current_hash != expected_hash:
                return ChainIntegrityResult(
                    is_valid=False,
                    broken_at=i,
                    expected_hash=expected_hash,
                    actual_hash=node.current_hash,
                    error_message=f"Node {i} content tampered: hash mismatch",
                    validated_count=i
                )
            
            # 验证与前驱节点的连接（除了第一个节点）
            if i > 0:
                previous_node = nodes[i - 1]
                if node.predecessor_hash != previous_node.current_hash:
                    return ChainIntegrityResult(
                        is_valid=False,
                        broken_at=i,
                        expected_hash=previous_node.current_hash,
                        actual_hash=node.predecessor_hash,
                        error_message=f"Chain link broken at node {i}",
                        validated_count=i - 1
                    )
        
        return ChainIntegrityResult(
            is_valid=True,
            validated_count=len(nodes)
        )
    
    def detect_tampering(
        self,
        nodes: List[AuditChainNode],
        target_node_index: int
    ) -> bool:
        """
        检测指定节点是否被篡改
        
        通过重新计算该节点的哈希值与存储值比对来判断。
        
        Args:
            nodes: 审计链节点列表
            target_node_index: 目标节点索引
        
        Returns:
            bool: True 表示被篡改，False 表示正常
            
        Raises:
            IndexError: 当索引超出范围时抛出
        """
        if target_node_index < 0 or target_node_index >= len(nodes):
            raise IndexError(f"Node index {target_node_index} out of range")
        
        node = nodes[target_node_index]
        expected_hash = self.compute_hash(
            predecessor_hash=node.predecessor_hash,
            asset_id=node.asset_id,
            from_status=node.from_status,
            to_status=node.to_status,
            trigger_type=node.trigger_type,
            operator_id=node.operator_id,
            metadata=node.metadata,
            created_at=node.created_at
        )
        
        return node.current_hash != expected_hash
    
    def rebuild_chain(
        self,
        nodes: List[AuditChainNode],
        from_index: int = 0
    ) -> List[AuditChainNode]:
        """
        从指定位置重建链的后续节点
        
        当检测到某节点被篡改但无法恢复时，可从该节点之后重新构建。
        注意：这会导致原始数据的丢失，仅在确认数据不可恢复时使用。
        
        Args:
            nodes: 当前审计链节点列表
            from_index: 重新开始的索引位置
        
        Returns:
            重建后的节点列表
            
        Warning:
            此操作会修改节点的哈希值，可能影响与外部系统的关联。
            仅用于紧急恢复场景。
        """
        if from_index < 0 or from_index >= len(nodes):
            raise IndexError(f"Invalid from_index: {from_index}")
        
        result_nodes = nodes[:from_index]
        
        # 设置新的前驱哈希
        if from_index == 0:
            predecessor_hash = self.compute_genesis_hash()
        else:
            predecessor_hash = nodes[from_index - 1].current_hash
        
        for i in range(from_index, len(nodes)):
            node = nodes[i]
            
            # 重新计算哈希
            new_hash = self.compute_hash(
                predecessor_hash=predecessor_hash,
                asset_id=node.asset_id,
                from_status=node.from_status,
                to_status=node.to_status,
                trigger_type=node.trigger_type,
                operator_id=node.operator_id,
                metadata=node.metadata,
                created_at=node.created_at
            )
            
            node.predecessor_hash = predecessor_hash
            node.current_hash = new_hash
            node.sequence_number = i
            
            result_nodes.append(node)
            predecessor_hash = new_hash
        
        return result_nodes
    
    def export_chain_info(self, nodes: List[AuditChainNode]) -> Dict[str, Any]:
        """
        导出链的基本统计信息
        
        用于日志记录和监控 purposes。
        
        Args:
            nodes: 审计链节点列表
        
        Returns:
            包含链长度、最新哈希、时间范围等信息的字典
        """
        if not nodes:
            return {
                "chain_length": 0,
                "latest_hash": None,
                "oldest_timestamp": None,
                "newest_timestamp": None,
                "asset_id": None
            }
        
        return {
            "chain_length": len(nodes),
            "latest_hash": nodes[-1].current_hash,
            "oldest_timestamp": nodes[0].created_at.isoformat(),
            "newest_timestamp": nodes[-1].created_at.isoformat(),
            "asset_id": str(nodes[0].asset_id),
            "genesis_hash": nodes[0].predecessor_hash,
            "is_valid": self.verify_chain(nodes).is_valid
        }


def create_audit_chain() -> AuditHashChain:
    """
    工厂函数：创建审计哈希链实例
    
    Returns:
        配置好的 AuditHashChain 实例
    """
    return AuditHashChain()


def verify_state_transition_chain(nodes: List[AuditChainNode]) -> None:
    """
    便捷函数：验证状态变更链并在失败时抛出异常
    
    Args:
        nodes: 按时间顺序排列的审计链节点列表
        
    Raises:
        AuditChainBrokenError: 当链完整性校验失败时抛出
    """
    result = AuditHashChain().verify_chain(nodes)
    if not result.is_valid:
        raise AuditChainBrokenError(
            f"Audit chain integrity check failed: {result.error_message} "
            f"at node {result.broken_at}"
        )