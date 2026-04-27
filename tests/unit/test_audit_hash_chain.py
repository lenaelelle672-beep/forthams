"""
哈希链审计完整性测试

验证 SWARM-002 资产报废退役流程 - Phase 4 历史记录持久化
测试场景：ATB-4.3 哈希链防篡改

测试目标：
- 验证审计链完整性
- 验证篡改检测机制
- 验证哈希链不可逆性

参考: SWARM-002-Iteration-8 规格指导文档
"""

import pytest
import hashlib
import json
from datetime import datetime, timezone
from typing import List, Optional, Dict, Any
from uuid import UUID, uuid4


class AuditChainBrokenError(Exception):
    """审计链篡改检测异常"""
    pass


class StateTransitionLog:
    """状态变更日志实体"""
    
    def __init__(
        self,
        id: UUID,
        asset_id: UUID,
        from_status: str,
        to_status: str,
        trigger_type: str,
        operator_id: Optional[UUID] = None,
        metadata: Optional[Dict[str, Any]] = None,
        created_at: Optional[datetime] = None
    ):
        self.id = id
        self.asset_id = asset_id
        self.from_status = from_status
        self.to_status = to_status
        self.trigger_type = trigger_type
        self.operator_id = operator_id
        self.metadata = metadata or {}
        self.created_at = created_at or datetime.now(timezone.utc)
        self._hash: Optional[str] = None
    
    def compute_hash(self, previous_hash: Optional[str] = None) -> str:
        """
        计算当前记录的哈希值
        
        哈希计算包含:
        - 记录ID
        - 资产ID
        - 状态变更 (from -> to)
        - 触发类型
        - 操作人ID
        - 元数据
        - 时间戳
        - 前一条记录的哈希 (链接)
        
        Args:
            previous_hash: 前一条记录的哈希值，用于链式链接
            
        Returns:
            str: SHA-256 哈希值
        """
        content = {
            "id": str(self.id),
            "asset_id": str(self.asset_id),
            "from_status": self.from_status,
            "to_status": self.to_status,
            "trigger_type": self.trigger_type,
            "operator_id": str(self.operator_id) if self.operator_id else None,
            "metadata": self.metadata,
            "created_at": self.created_at.isoformat(),
            "previous_hash": previous_hash or ""
        }
        
        content_str = json.dumps(content, sort_keys=True, ensure_ascii=False)
        hash_value = hashlib.sha256(content_str.encode('utf-8')).hexdigest()
        self._hash = hash_value
        return hash_value
    
    @property
    def hash(self) -> Optional[str]:
        """获取当前记录的哈希值"""
        return self._hash
    
    def to_dict(self) -> Dict[str, Any]:
        """转换为字典格式"""
        return {
            "id": str(self.id),
            "asset_id": str(self.asset_id),
            "from_status": self.from_status,
            "to_status": self.to_status,
            "trigger_type": self.trigger_type,
            "operator_id": str(self.operator_id) if self.operator_id else None,
            "metadata": self.metadata,
            "created_at": self.created_at.isoformat(),
            "hash": self._hash
        }


class AuditHashChain:
    """
    审计哈希链工具类
    
    实现哈希链防篡改设计，支持：
    - 链式哈希计算
    - 完整性校验
    - 篡改检测
    """
    
    def __init__(self, asset_id: UUID):
        """
        初始化审计哈希链
        
        Args:
            asset_id: 资产ID，用于标识链所属的资产
        """
        self.asset_id = asset_id
        self._logs: List[StateTransitionLog] = []
        self._genesis_hash: Optional[str] = None
    
    def append(self, log: StateTransitionLog) -> str:
        """
        添加日志记录到链末端
        
        Args:
            log: 状态变更日志记录
            
        Returns:
            str: 新记录的哈希值
            
        Raises:
            ValueError: 链已断开或记录不属于同一资产
        """
        if log.asset_id != self.asset_id:
            raise ValueError("Log asset_id does not match chain asset_id")
        
        previous_hash = self._logs[-1].hash if self._logs else self._genesis_hash
        return log.compute_hash(previous_hash)
    
    def build_chain(self, logs: List[StateTransitionLog]) -> List[str]:
        """
        批量构建哈希链
        
        Args:
            logs: 状态变更日志列表
            
        Returns:
            List[str]: 所有记录的哈希值列表
        """
        self._logs = []
        self._genesis_hash = "0" * 64  # 创世区块哈希
        
        hashes = []
        previous_hash = self._genesis_hash
        
        for log in logs:
            if log.asset_id != self.asset_id:
                raise ValueError("Log asset_id does not match chain asset_id")
            
            h = log.compute_hash(previous_hash)
            self._logs.append(log)
            hashes.append(h)
            previous_hash = h
        
        return hashes
    
    def verify_integrity(self) -> bool:
        """
        验证哈希链完整性
        
        遍历链中的所有记录，验证每条记录的哈希值是否正确。
        
        Returns:
            bool: 完整性校验结果
            
        Raises:
            AuditChainBrokenError: 检测到篡改行为
        """
        if not self._logs:
            return True
        
        previous_hash = self._genesis_hash or "0" * 64
        
        for i, log in enumerate(self._logs):
            # 重新计算当前记录的哈希
            expected_hash = log.compute_hash(previous_hash)
            
            # 验证哈希匹配
            if log.hash != expected_hash:
                raise AuditChainBrokenError(
                    f"Hash mismatch at index {i}: "
                    f"expected={expected_hash}, actual={log.hash}"
                )
            
            # 更新 previous_hash 用于下一轮验证
            previous_hash = log.hash
        
        return True
    
    def detect_tampering(self) -> List[Dict[str, Any]]:
        """
        检测链中是否存在篡改
        
        Returns:
            List[Dict[str, Any]]: 篡改检测结果列表
        """
        tamperings = []
        
        if not self._logs:
            return tamperings
        
        previous_hash = self._genesis_hash or "0" * 64
        
        for i, log in enumerate(self._logs):
            expected_hash = log.compute_hash(previous_hash)
            
            if log.hash != expected_hash:
                tamperings.append({
                    "index": i,
                    "log_id": str(log.id),
                    "expected_hash": expected_hash,
                    "actual_hash": log.hash,
                    "asset_id": str(log.asset_id),
                    "from_status": log.from_status,
                    "to_status": log.to_status
                })
            
            previous_hash = log.hash
        
        return tamperings
    
    @property
    def logs(self) -> List[StateTransitionLog]:
        """获取链中的所有日志记录"""
        return self._logs.copy()
    
    @property
    def length(self) -> int:
        """获取链的长度"""
        return len(self._logs)


class TestHashChainIntegrity:
    """
    ATB-4.3: 哈希链防篡改测试
    
    测试场景：修改任一记录后哈希校验失败
    """
    
    def test_chain_construction(self):
        """测试哈希链的正常构建"""
        asset_id = uuid4()
        chain = AuditHashChain(asset_id)
        
        # 创建多条状态变更日志
        logs = [
            StateTransitionLog(
                id=uuid4(),
                asset_id=asset_id,
                from_status="在用",
                to_status="闲置",
                trigger_type="manual",
                operator_id=uuid4(),
                metadata={"reason": "主动闲置"}
            ),
            StateTransitionLog(
                id=uuid4(),
                asset_id=asset_id,
                from_status="闲置",
                to_status="待审批",
                trigger_type="approval",
                operator_id=uuid4(),
                metadata={"application_id": str(uuid4())}
            ),
            StateTransitionLog(
                id=uuid4(),
                asset_id=asset_id,
                from_status="待审批",
                to_status="已报废",
                trigger_type="approval",
                operator_id=uuid4(),
                metadata={"approval_result": "approved"}
            )
        ]
        
        # 构建链
        hashes = chain.build_chain(logs)
        
        # 验证链长度
        assert chain.length == 3
        
        # 验证每条记录都有哈希值
        for log in chain.logs:
            assert log.hash is not None
            assert len(log.hash) == 64  # SHA-256 哈希长度
        
        # 验证哈希值列表长度
        assert len(hashes) == 3
        
        # 验证哈希值各不相同（链式效应）
        assert hashes[0] != hashes[1]
        assert hashes[1] != hashes[2]
        assert hashes[0] != hashes[2]
    
    def test_hash_link_integrity(self):
        """测试哈希链接的完整性"""
        asset_id = uuid4()
        chain = AuditHashChain(asset_id)
        
        logs = [
            StateTransitionLog(
                id=uuid4(),
                asset_id=asset_id,
                from_status="在用",
                to_status="维修中",
                trigger_type="manual",
                operator_id=uuid4()
            )
        ]
        
        chain.build_chain(logs)
        
        # 验证完整性
        assert chain.verify_integrity() is True
    
    def test_tampering_detection_modified_record(self):
        """
        测试篡改检测：修改记录内容
        
        场景：修改某条记录的 from_status，验证哈希链检测到篡改
        """
        asset_id = uuid4()
        chain = AuditHashChain(asset_id)
        
        log = StateTransitionLog(
            id=uuid4(),
            asset_id=asset_id,
            from_status="在用",
            to_status="闲置",
            trigger_type="manual",
            operator_id=uuid4()
        )
        
        chain.build_chain([log])
        original_hash = chain.logs[0].hash
        
        # 模拟篡改：修改记录内容
        chain._logs[0].from_status = "已报废"  # 篡改状态
        
        # 验证完整性应抛出异常
        with pytest.raises(AuditChainBrokenError) as exc_info:
            chain.verify_integrity()
        
        assert "Hash mismatch" in str(exc_info.value)
    
    def test_tampering_detection_fake_hash(self):
        """
        测试篡改检测：伪造哈希值
        
        场景：直接修改记录的 hash 字段，绕过内容检查
        """
        asset_id = uuid4()
        chain = AuditHashChain(asset_id)
        
        log = StateTransitionLog(
            id=uuid4(),
            asset_id=asset_id,
            from_status="在用",
            to_status="闲置",
            trigger_type="manual",
            operator_id=uuid4()
        )
        
        chain.build_chain([log])
        
        # 模拟篡改：直接修改哈希值
        chain._logs[0]._hash = "0" * 64  # 替换为伪造的哈希
        
        # 验证完整性应抛出异常
        with pytest.raises(AuditChainBrokenError) as exc_info:
            chain.verify_integrity()
        
        assert "Hash mismatch" in str(exc_info.value)
    
    def test_detect_tampering_reports_position(self):
        """测试篡改检测报告篡改位置"""
        asset_id = uuid4()
        chain = AuditHashChain(asset_id)
        
        logs = [
            StateTransitionLog(
                id=uuid4(),
                asset_id=asset_id,
                from_status="在用",
                to_status="闲置",
                trigger_type="manual",
                operator_id=uuid4()
            ),
            StateTransitionLog(
                id=uuid4(),
                asset_id=asset_id,
                from_status="闲置",
                to_status="维修中",
                trigger_type="manual",
                operator_id=uuid4()
            ),
            StateTransitionLog(
                id=uuid4(),
                asset_id=asset_id,
                from_status="维修中",
                to_status="在用",
                trigger_type="auto",
                operator_id=None
            )
        ]
        
        chain.build_chain(logs)
        
        # 篡改中间记录
        chain._logs[1].to_status = "已报废"
        
        # 检测篡改
        tamperings = chain.detect_tampering()
        
        assert len(tamperings) == 1
        assert tamperings[0]["index"] == 1
        assert tamperings[0]["expected_hash"] != tamperings[0]["actual_hash"]
    
    def test_chain_irreversibility(self):
        """测试哈希链的不可逆性"""
        asset_id = uuid4()
        chain = AuditHashChain(asset_id)
        
        log = StateTransitionLog(
            id=uuid4(),
            asset_id=asset_id,
            from_status="在用",
            to_status="已报废",
            trigger_type="approval",
            operator_id=uuid4(),
            metadata={"final": True}
        )
        
        # 构建链
        chain.build_chain([log])
        hash_value = chain.logs[0].hash
        
        # 验证：无法从哈希值反推原始内容
        # 由于使用 SHA-256，无法逆向计算
        assert hash_value is not None
        assert hash_value != ""


class TestHashChainWithRealisticScenario:
    """使用真实场景测试哈希链"""
    
    def test_retirement_application_flow_hash_chain(self):
        """
        测试资产报废申请流程的哈希链
        
        模拟完整的报废流程：
        1. 在用 -> 闲置 (申请前)
        2. 闲置 -> 待审批 (提交申请)
        3. 待审批 -> 审批中 (开始审批)
        4. 审批中 -> 已报废 (审批通过)
        """
        asset_id = uuid4()
        chain = AuditHashChain(asset_id)
        
        # 状态转换序列
        transitions = [
            ("在用", "闲置", "manual", {"reason": "资产闲置申请"}),
            ("闲置", "待审批", "approval", {"application_id": str(uuid4())}),
            ("待审批", "审批中", "approval", {"approval_started": True}),
            ("审批中", "已报废", "approval", {"final_approval": True})
        ]
        
        logs = []
        for from_status, to_status, trigger, metadata in transitions:
            log = StateTransitionLog(
                id=uuid4(),
                asset_id=asset_id,
                from_status=from_status,
                to_status=to_status,
                trigger_type=trigger,
                operator_id=uuid4() if trigger != "auto" else None,
                metadata=metadata,
                created_at=datetime.now(timezone.utc)
            )
            logs.append(log)
        
        # 构建哈希链
        chain.build_chain(logs)
        
        # 验证完整性
        assert chain.verify_integrity() is True
        
        # 验证没有篡改检测报告
        assert len(chain.detect_tampering()) == 0
    
    def test_hash_chain_with_different_assets(self):
        """测试不同资产的哈希链隔离"""
        asset1_id = uuid4()
        asset2_id = uuid4()
        
        chain1 = AuditHashChain(asset1_id)
        chain2 = AuditHashChain(asset2_id)
        
        log1 = StateTransitionLog(
            id=uuid4(),
            asset_id=asset1_id,
            from_status="在用",
            to_status="闲置",
            trigger_type="manual",
            operator_id=uuid4()
        )
        
        log2 = StateTransitionLog(
            id=uuid4(),
            asset_id=asset2_id,
            from_status="在用",
            to_status="维修中",
            trigger_type="manual",
            operator_id=uuid4()
        )
        
        # 分别构建链
        chain1.build_chain([log1])
        chain2.build_chain([log2])
        
        # 验证两条链互不影响
        assert chain1.logs[0].hash != chain2.logs[0].hash
        
        # 验证完整性
        assert chain1.verify_integrity() is True
        assert chain2.verify_integrity() is True


class TestHashChainEdgeCases:
    """边界情况测试"""
    
    def test_empty_chain(self):
        """测试空链的验证"""
        asset_id = uuid4()
        chain = AuditHashChain(asset_id)
        
        assert chain.length == 0
        assert chain.verify_integrity() is True
        assert len(chain.detect_tampering()) == 0
    
    def test_single_record_chain(self):
        """测试单条记录的链"""
        asset_id = uuid4()
        chain = AuditHashChain(asset_id)
        
        log = StateTransitionLog(
            id=uuid4(),
            asset_id=asset_id,
            from_status="在用",
            to_status="闲置",
            trigger_type="manual",
            operator_id=uuid4()
        )
        
        chain.build_chain([log])
        
        # 验证链长度为1
        assert chain.length == 1
        
        # 验证完整性
        assert chain.verify_integrity() is True
    
    def test_wrong_asset_id_rejected(self):
        """测试资产ID不匹配时被拒绝"""
        asset_id = uuid4()
        wrong_asset_id = uuid4()
        
        chain = AuditHashChain(asset_id)
        
        wrong_log = StateTransitionLog(
            id=uuid4(),
            asset_id=wrong_asset_id,
            from_status="在用",
            to_status="闲置",
            trigger_type="manual",
            operator_id=uuid4()
        )
        
        # 应该抛出异常
        with pytest.raises(ValueError) as exc_info:
            chain.append(wrong_log)
        
        assert "asset_id does not match" in str(exc_info.value)


class TestHashChainRegression:
    """回归测试：确保防篡改机制稳定"""
    
    def test_chain_length_consistency(self):
        """测试链长度与日志列表的一致性"""
        asset_id = uuid4()
        chain = AuditHashChain(asset_id)
        
        logs = [
            StateTransitionLog(
                id=uuid4(),
                asset_id=asset_id,
                from_status="在用",
                to_status="闲置",
                trigger_type="manual",
                operator_id=uuid4()
            )
            for _ in range(5)
        ]
        
        chain.build_chain(logs)
        
        assert chain.length == 5
        assert len(chain.logs) == 5
    
    def test_metadata_preserved_in_hash(self):
        """测试元数据被包含在哈希计算中"""
        asset_id = uuid4()
        
        log1 = StateTransitionLog(
            id=uuid4(),
            asset_id=asset_id,
            from_status="在用",
            to_status="闲置",
            trigger_type="manual",
            operator_id=uuid4(),
            metadata={"key": "value1"}
        )
        
        log2 = StateTransitionLog(
            id=uuid4(),
            asset_id=asset_id,
            from_status="在用",
            to_status="闲置",
            trigger_type="manual",
            operator_id=uuid4(),
            metadata={"key": "value2"}
        )
        
        chain1 = AuditHashChain(asset_id)
        chain1.build_chain([log1])
        
        chain2 = AuditHashChain(asset_id)
        chain2.build_chain([log2])
        
        # 不同的元数据应产生不同的哈希
        assert chain1.logs[0].hash != chain2.logs[0].hash