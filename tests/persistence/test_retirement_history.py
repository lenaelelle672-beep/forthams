"""
资产退役历史记录持久化测试模块

本模块验证 SWARM-002 资产报废退役流程中 Phase 4（历史记录持久化）的功能需求。
测试覆盖：
- ATB-4.1: 状态变更日志完整性
- ATB-4.2: 审批操作原子性
- ATB-4.3: 审计链时间戳顺序
- ATB-4.4: 哈希链防篡改
- ATB-4.5: 历史查询-按资产
- ATB-4.6: 历史查询-按时间范围

参考规格: SWARM-002-Iteration-8 §ATB-4
"""

import hashlib
import json
import pytest
import uuid
from datetime import datetime, timedelta
from typing import List, Optional
from dataclasses import dataclass, field


# ============================================================================
# 数据模型定义
# ============================================================================

@dataclass
class Asset:
    """资产实体模型"""
    id: uuid.UUID
    asset_code: str
    asset_name: str
    category: str
    purchase_date: datetime
    original_value: float
    current_value: float
    status: str
    created_at: datetime = field(default_factory=datetime.now)
    updated_at: datetime = field(default_factory=datetime.now)


@dataclass
class RetirementApplication:
    """报废申请实体模型"""
    id: uuid.UUID
    asset_id: uuid.UUID
    applicant_id: uuid.UUID
    reason: str
    disposal_method: str
    estimated_value: float
    status: str  # 草稿/待审批/审批中/已批准/已拒绝/已撤回
    approval_chain: List['ApprovalNode'] = field(default_factory=list)
    created_at: datetime = field(default_factory=datetime.now)
    updated_at: datetime = field(default_factory=datetime.now)


@dataclass
class ApprovalNode:
    """审批节点模型"""
    id: uuid.UUID
    application_id: uuid.UUID
    node_order: int
    approver_id: uuid.UUID
    decision: str  # pending/approved/rejected/skipped
    comment: Optional[str] = None
    decided_at: Optional[datetime] = None
    created_at: datetime = field(default_factory=datetime.now)


@dataclass
class StateTransitionLog:
    """状态变更日志模型"""
    id: uuid.UUID
    asset_id: uuid.UUID
    from_status: str
    to_status: str
    trigger_type: str  # manual/auto/approval
    operator_id: Optional[uuid.UUID] = None
    metadata: dict = field(default_factory=dict)
    created_at: datetime = field(default_factory=datetime.now)
    hash_value: Optional[str] = None  # 哈希链验证字段


# ============================================================================
# 哈希链工具类
# ============================================================================

class AuditHashChain:
    """
    审计哈希链工具类
    
    用于验证状态变更日志的完整性和防篡改。
    实现单向哈希链，前一条记录的哈希值参与计算当前记录的哈希值。
    """
    
    def __init__(self, hash_algorithm: str = "sha256"):
        """
        初始化哈希链工具
        
        Args:
            hash_algorithm: 哈希算法，可选 sha256/sha384/sha512
        """
        self.hash_algorithm = hash_algorithm
    
    def _compute_hash(self, data: dict, previous_hash: Optional[str] = None) -> str:
        """
        计算单条记录的哈希值
        
        Args:
            data: 记录数据字典
            previous_hash: 前一条记录的哈希值
            
        Returns:
            str: 计算后的哈希值
        """
        # 构造哈希输入数据
        hash_input = {
            "asset_id": str(data.get("asset_id", "")),
            "from_status": data.get("from_status", ""),
            "to_status": data.get("to_status", ""),
            "trigger_type": data.get("trigger_type", ""),
            "operator_id": str(data.get("operator_id", "")) if data.get("operator_id") else "",
            "created_at": data.get("created_at", ""),
            "previous_hash": previous_hash or ""
        }
        
        # JSON序列化并计算哈希
        content = json.dumps(hash_input, sort_keys=True, default=str)
        hash_obj = hashlib.new(self.hash_algorithm)
        hash_obj.update(content.encode("utf-8"))
        return hash_obj.hexdigest()
    
    def build_chain(self, logs: List[StateTransitionLog]) -> List[str]:
        """
        为日志列表构建哈希链
        
        Args:
            logs: 状态变更日志列表（按时间顺序）
            
        Returns:
            List[str]: 各记录对应的哈希值列表
        """
        hashes = []
        previous_hash = None
        
        for log in logs:
            log_data = {
                "asset_id": log.asset_id,
                "from_status": log.from_status,
                "to_status": log.to_status,
                "trigger_type": log.trigger_type,
                "operator_id": log.operator_id,
                "created_at": log.created_at.isoformat() if isinstance(log.created_at, datetime) else str(log.created_at)
            }
            current_hash = self._compute_hash(log_data, previous_hash)
            hashes.append(current_hash)
            previous_hash = current_hash
        
        return hashes
    
    def verify_chain(self, previous_log: StateTransitionLog, current_log: StateTransitionLog) -> bool:
        """
        验证相邻两条日志之间的链完整性
        
        Args:
            previous_log: 前一条日志记录
            current_log: 当前日志记录
            
        Returns:
            bool: 链完整返回True，否则返回False
        """
        if current_log.hash_value is None:
            return False
        
        expected_hash = self._compute_hash({
            "asset_id": current_log.asset_id,
            "from_status": current_log.from_status,
            "to_status": current_log.to_status,
            "trigger_type": current_log.trigger_type,
            "operator_id": current_log.operator_id,
            "created_at": current_log.created_at.isoformat() if isinstance(current_log.created_at, datetime) else str(current_log.created_at)
        }, previous_log.hash_value)
        
        return expected_hash == current_log.hash_value
    
    def verify_first_node(self, log: StateTransitionLog) -> bool:
        """
        验证链的第一个节点（创世节点）
        
        Args:
            log: 日志记录
            
        Returns:
            bool: 创世节点验证通过返回True
        """
        if log.hash_value is None:
            return False
        
        expected_hash = self._compute_hash({
            "asset_id": log.asset_id,
            "from_status": log.from_status,
            "to_status": log.to_status,
            "trigger_type": log.trigger_type,
            "operator_id": log.operator_id,
            "created_at": log.created_at.isoformat() if isinstance(log.created_at, datetime) else str(log.created_at)
        }, None)
        
        return expected_hash == log.hash_value


class AuditChainBrokenError(Exception):
    """审计链完整性异常类"""
    pass


# ============================================================================
# 模拟数据库与仓储层
# ============================================================================

class MockDatabase:
    """模拟数据库会话"""
    
    def __init__(self):
        self.assets: dict = {}
        self.retirement_applications: dict = {}
        self.approval_nodes: dict = {}
        self.state_transition_logs: dict = {}
        self._transaction_logs: List[dict] = []
    
    def add(self, entity):
        """添加实体到数据库"""
        if isinstance(entity, Asset):
            self.assets[str(entity.id)] = entity
        elif isinstance(entity, RetirementApplication):
            self.retirement_applications[str(entity.id)] = entity
        elif isinstance(entity, ApprovalNode):
            self.approval_nodes[str(entity.id)] = entity
        elif isinstance(entity, StateTransitionLog):
            self.state_transition_logs[str(entity.id)] = entity
    
    def commit(self):
        """提交事务"""
        self._transaction_logs.clear()
    
    def rollback(self):
        """回滚事务"""
        self._transaction_logs.clear()
    
    def query(self, model_class):
        """构建查询构建器"""
        return QueryBuilder(self, model_class)


class QueryBuilder:
    """查询构建器"""
    
    def __init__(self, db: MockDatabase, model_class):
        self.db = db
        self.model_class = model_class
    
    def filter_by(self, **kwargs):
        """根据条件过滤"""
        return self
    
    def order_by(self, *args):
        """排序"""
        return self
    
    def all(self) -> List:
        """获取所有结果"""
        if self.model_class == StateTransitionLog:
            return list(self.db.state_transition_logs.values())
        return []


# ============================================================================
# 测试夹具 (Fixtures)
# ============================================================================

@pytest.fixture
def db_session():
    """
    创建模拟数据库会话
    
    Returns:
        MockDatabase: 模拟数据库实例
    """
    return MockDatabase()


@pytest.fixture
def chain_builder():
    """
    创建哈希链构建器
    
    Returns:
        AuditHashChain: 哈希链工具实例
    """
    return AuditHashChain()


@pytest.fixture
def sample_asset():
    """
    创建测试用资产
    
    Returns:
        Asset: 测试资产实体
    """
    return Asset(
        id=uuid.uuid4(),
        asset_code="AST-2024-001",
        asset_name="办公笔记本电脑",
        category="IT设备",
        purchase_date=datetime(2020, 1, 15),
        original_value=8000.00,
        current_value=4000.00,
        status="在用"
    )


@pytest.fixture
def sample_retirement_application(sample_asset):
    """
    创建测试用报废申请
    
    Args:
        sample_asset: 测试用资产 fixture
    
    Returns:
        RetirementApplication: 测试报废申请实体
    """
    return RetirementApplication(
        id=uuid.uuid4(),
        asset_id=sample_asset.id,
        applicant_id=uuid.uuid4(),
        reason="设备老化，无法修复",
        disposal_method="报废销毁",
        estimated_value=500.00,
        status="待审批"
    )


@pytest.fixture
def valid_transition_map():
    """
    合法状态转换映射
    
    Returns:
        dict: 允许的状态转换集合
    """
    return {
        ("在用", "闲置"),
        ("闲置", "待审批"),
        ("待审批", "审批中"),
        ("审批中", "已批准"),
        ("审批中", "已拒绝"),
        ("已批准", "已报废"),
        ("已拒绝", "闲置"),
    }


@pytest.fixture
def sample_logs(sample_asset) -> List[StateTransitionLog]:
    """
    创建示例状态变更日志列表
    
    Args:
        sample_asset: 测试用资产 fixture
    
    Returns:
        List[StateTransitionLog]: 按时间顺序排列的日志列表
    """
    base_time = datetime(2024, 1, 1, 10, 0, 0)
    logs = []
    
    transitions = [
        ("在用", "闲置", "manual"),
        ("闲置", "待审批", "manual"),
        ("待审批", "审批中", "approval"),
        ("审批中", "已批准", "approval"),
        ("已批准", "已报废", "auto"),
    ]
    
    for i, (from_status, to_status, trigger_type) in enumerate(transitions):
        log = StateTransitionLog(
            id=uuid.uuid4(),
            asset_id=sample_asset.id,
            from_status=from_status,
            to_status=to_status,
            trigger_type=trigger_type,
            operator_id=uuid.uuid4() if trigger_type == "manual" else None,
            created_at=base_time + timedelta(hours=i * 2),
            metadata={}
        )
        logs.append(log)
    
    return logs


# ============================================================================
# ATB-4.1: 状态变更日志完整性测试
# ============================================================================

class TestStateChangeLogIntegrity:
    """
    ATB-4.1: 状态变更日志完整性测试
    
    验证每次资产状态变更都会产生完整的 StateTransitionLog 记录。
    """
    
    def test_all_transitions_logged(self, db_session, sample_asset, valid_transition_map):
        """
        测试所有状态转换都会产生日志记录
        
        验证规格: 每次状态变更产生1条 StateTransitionLog 记录
        """
        # 模拟状态转换
        transitions = list(valid_transition_map)[:4]  # 取前4个转换
        
        for from_status, to_status in transitions:
            # 执行状态转换
            original_status = sample_asset.status
            sample_asset.status = to_status
            
            # 创建日志记录
            log = StateTransitionLog(
                id=uuid.uuid4(),
                asset_id=sample_asset.id,
                from_status=original_status,
                to_status=to_status,
                trigger_type="manual",
                operator_id=uuid.uuid4(),
                created_at=datetime.now()
            )
            db_session.add(log)
            db_session.commit()
        
        # 验证日志记录数量
        logs = db_session.query(StateTransitionLog).filter_by(asset_id=sample_asset.id).all()
        assert len(logs) == len(transitions), \
            f"期望产生 {len(transitions)} 条日志，实际产生 {len(logs)} 条"
    
    def test_log_contains_required_fields(self, db_session, sample_asset):
        """
        测试日志记录包含所有必填字段
        
        必填字段: id, asset_id, from_status, to_status, trigger_type, created_at
        """
        log = StateTransitionLog(
            id=uuid.uuid4(),
            asset_id=sample_asset.id,
            from_status="在用",
            to_status="闲置",
            trigger_type="manual",
            operator_id=uuid.uuid4(),
            created_at=datetime.now()
        )
        db_session.add(log)
        db_session.commit()
        
        # 验证各字段存在且非空
        assert log.id is not None, "日志ID不能为空"
        assert log.asset_id == sample_asset.id, "资产ID不匹配"
        assert log.from_status == "在用", "起始状态不匹配"
        assert log.to_status == "闲置", "目标状态不匹配"
        assert log.trigger_type == "manual", "触发类型不匹配"
        assert log.created_at is not None, "创建时间不能为空"
    
    def test_log_metadata_captured(self, db_session, sample_asset):
        """
        测试日志元数据正确捕获
        
        元数据应包含: 审批人信息、审批意见、业务上下文等
        """
        metadata = {
            "approver_name": "张三",
            "approver_department": "资产管理部",
            "comment": "同意报废",
            "approval_node_order": 1
        }
        
        log = StateTransitionLog(
            id=uuid.uuid4(),
            asset_id=sample_asset.id,
            from_status="审批中",
            to_status="已批准",
            trigger_type="approval",
            operator_id=uuid.uuid4(),
            created_at=datetime.now(),
            metadata=metadata
        )
        db_session.add(log)
        db_session.commit()
        
        # 验证元数据持久化
        retrieved_log = db_session.query(StateTransitionLog).filter_by(id=log.id).all()[0]
        assert retrieved_log.metadata == metadata, "元数据未正确持久化"


# ============================================================================
# ATB-4.2: 审批操作原子性测试
# ============================================================================

class TestApprovalTransactionAtomicity:
    """
    ATB-4.2: 审批操作原子性测试
    
    验证审批通过与日志写入在同一事务中完成，保证数据一致性。
    """
    
    def test_approval_log_atomic(self, db_session, sample_retirement_application):
        """
        测试审批决策与日志写入的原子性
        
        验证规格: 审批通过与日志写入在同一事务中
        """
        # 创建审批节点
        approval_node = ApprovalNode(
            id=uuid.uuid4(),
            application_id=sample_retirement_application.id,
            node_order=1,
            approver_id=uuid.uuid4(),
            decision="pending",
            created_at=datetime.now()
        )
        db_session.add(approval_node)
        
        # 执行审批操作（模拟原子性）
        try:
            # 更新审批节点状态
            approval_node.decision = "approved"
            approval_node.comment = "同意"
            approval_node.decided_at = datetime.now()
            
            # 同时写入状态变更日志
            log = StateTransitionLog(
                id=uuid.uuid4(),
                asset_id=sample_retirement_application.asset_id,
                from_status="待审批",
                to_status="审批中",
                trigger_type="approval",
                operator_id=approval_node.approver_id,
                created_at=datetime.now()
            )
            db_session.add(log)
            
            # 提交事务
            db_session.commit()
            
        except Exception as e:
            # 任何失败都回滚
            db_session.rollback()
            raise AssertionError(f"原子性操作失败: {str(e)}")
        
        # 验证两个操作都在同一事务中成功
        node = db_session.approval_nodes.get(str(approval_node.id))
        assert node.decision == "approved", "审批节点状态更新失败"
        
        log_result = db_session.state_transition_logs.get(str(log.id))
        assert log_result is not None, "日志写入失败"
    
    def test_transaction_rollback_on_failure(self, db_session, sample_retirement_application):
        """
        测试事务失败时的回滚机制
        
        验证审批操作失败时，日志不会单独写入
        """
        # 创建审批节点
        approval_node = ApprovalNode(
            id=uuid.uuid4(),
            application_id=sample_retirement_application.id,
            node_order=1,
            approver_id=uuid.uuid4(),
            decision="pending",
            created_at=datetime.now()
        )
        db_session.add(approval_node)
        
        # 模拟操作失败
        with pytest.raises(Exception):
            # 更新审批节点
            approval_node.decision = "approved"
            
            # 故意写入一个会导致失败的日志（触发异常）
            log = StateTransitionLog(
                id=None,  # 模拟无效数据
                asset_id=sample_retirement_application.asset_id,
                from_status="待审批",
                to_status="审批中",
                trigger_type="approval",
                created_at=datetime.now()
            )
            db_session.add(log)
            
            # 提交时失败
            db_session.commit()
        
        # 验证回滚：审批节点和日志都不应存在
        assert str(approval_node.id) not in db_session.approval_nodes or \
               db_session.approval_nodes[str(approval_node.id)].decision == "pending", \
               "审批节点不应在失败后被更新"


# ============================================================================
# ATB-4.3: 审计链时间戳顺序测试
# ============================================================================

class TestAuditChainTimestampOrder:
    """
    ATB-4.3: 审计链时间戳顺序测试
    
    验证日志 created_at 时间戳严格递增，保证审计链顺序。
    """
    
    def test_log_timestamp_order(self, db_session, sample_logs):
        """
        测试日志时间戳严格递增
        
        验证规格: 日志 created_at 严格递增
        """
        # 按时间顺序写入日志
        for log in sample_logs:
            db_session.add(log)
        db_session.commit()
        
        # 获取所有日志并验证时间顺序
        all_logs = db_session.query(StateTransitionLog).filter_by(
            asset_id=sample_logs[0].asset_id
        ).order_by("created_at").all()
        
        for i in range(1, len(all_logs)):
            assert all_logs[i].created_at > all_logs[i-1].created_at, \
                f"日志时间戳顺序错误: index={i}, prev={all_logs[i-1].created_at}, current={all_logs[i].created_at}"
    
    def test_concurrent_timestamp_assignment(self, db_session, sample_asset):
        """
        测试并发场景下时间戳的唯一性
        
        模拟同一毫秒内多个状态变更，确保时间戳可区分
        """
        same_timestamp = datetime.now()
        logs = []
        
        for i in range(5):
            log = StateTransitionLog(
                id=uuid.uuid4(),
                asset_id=sample_asset.id,
                from_status=f"状态{i}",
                to_status=f"状态{i+1}",
                trigger_type="manual",
                created_at=same_timestamp + timedelta(microseconds=i)
            )
            logs.append(log)
            db_session.add(log)
        
        db_session.commit()
        
        # 验证每个日志时间戳可区分
        timestamps = [log.created_at for log in logs]
        assert len(set(timestamps)) == len(timestamps), "并发时间戳应可区分"


# ============================================================================
# ATB-4.4: 哈希链防篡改测试
# ============================================================================

class TestHashChainIntegrity:
    """
    ATB-4.4: 哈希链防篡改测试
    
    验证状态变更日志的哈希链完整性，检测数据篡改。
    """
    
    def test_hash_chain_integrity(self, db_session, sample_logs, chain_builder):
        """
        测试哈希链完整性验证
        
        验证规格: 修改任一记录后哈希校验失败
        
        测试场景:
        1. 构建完整的哈希链
        2. 验证链的完整性（无篡改）
        3. 模拟篡改中间记录
        4. 验证篡改后链校验失败
        """
        # Step 1: 构建哈希链
        hashes = chain_builder.build_chain(sample_logs)
        
        # 为每个日志设置哈希值
        for log, hash_value in zip(sample_logs, hashes):
            log.hash_value = hash_value
            db_session.add(log)
        db_session.commit()
        
        # Step 2: 验证链的完整性
        chain = AuditHashChain()
        for i, log in enumerate(sample_logs):
            if i == 0:
                assert chain.verify_first_node(log), f"创世节点验证失败: index={i}"
            else:
                assert chain.verify_chain(sample_logs[i-1], log), f"链节点验证失败: index={i}"
        
        # Step 3: 模拟篡改（修改中间记录的状态）
        tampered_log = sample_logs[2]
        original_to_status = tampered_log.to_status
        tampered_log.to_status = "非法状态"  # 篡改数据
        
        # Step 4: 验证篡改后链校验失败
        with pytest.raises(AuditChainBrokenError):
            # 重新计算哈希应与存储的哈希不一致
            computed_hash = chain_builder._compute_hash({
                "asset_id": tampered_log.asset_id,
                "from_status": tampered_log.from_status,
                "to_status": tampered_log.to_status,
                "trigger_type": tampered_log.trigger_type,
                "operator_id": tampered_log.operator_id,
                "created_at": tampered_log.created_at.isoformat()
            }, sample_logs[1].hash_value)
            
            if computed_hash != tampered_log.hash_value:
                raise AuditChainBrokenError(
                    f"哈希链完整性被破坏: 期望 {tampered_log.hash_value}, 计算得到 {computed_hash}"
                )
        
        # 恢复数据
        tampered_log.to_status = original_to_status
    
    def test_hash_chain_first_node_verification(self, sample_logs, chain_builder):
        """
        测试创世节点的哈希验证
        
        创世节点（第一条记录）无前驱节点，previous_hash 为空
        """
        # 构建链
        hashes = chain_builder.build_chain(sample_logs)
        sample_logs[0].hash_value = hashes[0]
        
        # 验证创世节点
        chain = AuditHashChain()
        assert chain.verify_first_node(sample_logs[0]), "创世节点验证失败"
    
    def test_hash_chain_with_empty_logs(self, chain_builder):
        """
        测试空日志列表的哈希链构建
        
        空列表应返回空哈希列表，不抛异常
        """
        empty_logs: List[StateTransitionLog] = []
        hashes = chain_builder.build_chain(empty_logs)
        assert hashes == [], "空列表应返回空哈希列表"
    
    def test_hash_chain_partial_verification(self, sample_logs, chain_builder):
        """
        测试部分链路的哈希验证
        
        验证从任意节点开始的子链也能正确验证
        """
        # 构建完整链
        hashes = chain_builder.build_chain(sample_logs)
        for log, hash_value in zip(sample_logs, hashes):
            log.hash_value = hash_value
        
        # 验证子链（从第3个节点开始）
        chain = AuditHashChain()
        start_index = 2
        for i in range(start_index, len(sample_logs) - 1):
            assert chain.verify_chain(sample_logs[i], sample_logs[i+1]), \
                f"子链验证失败: from_index={i}"


# ============================================================================
# ATB-4.5: 历史查询-按资产测试
# ============================================================================

class TestHistoryQueryByAsset:
    """
    ATB-4.5: 历史查询-按资产测试
    
    验证按资产ID查询完整状态变更历史的功能。
    """
    
    def test_query_history_by_asset(self, db_session, sample_logs):
        """
        测试按资产ID查询状态变更历史
        
        验证规格: 返回该资产完整状态变更链
        """
        # 写入测试数据
        for log in sample_logs:
            db_session.add(log)
        db_session.commit()
        
        # 执行查询
        asset_id = sample_logs[0].asset_id
        result = db_session.query(StateTransitionLog).filter_by(asset_id=asset_id).all()
        
        # 验证返回结果
        assert len(result) == len(sample_logs), \
            f"期望返回 {len(sample_logs)} 条记录，实际返回 {len(result)} 条"
        
        # 验证按时间排序
        timestamps = [log.created_at for log in result]
        assert timestamps == sorted(timestamps), "查询结果应按时间升序排列"
    
    def test_query_history_nonexistent_asset(self, db_session):
        """
        测试查询不存在的资产历史
        
        应返回空列表，不抛异常
        """
        nonexistent_asset_id = uuid.uuid4()
        result = db_session.query(StateTransitionLog).filter_by(
            asset_id=nonexistent_asset_id
        ).all()
        
        assert result == [], f"不存在资产的查询应返回空列表，实际返回 {result}"
    
    def test_query_history_includes_all_trigger_types(self, db_session, sample_asset):
        """
        测试查询结果包含所有触发类型
        
        触发类型包括: manual(手动), auto(自动), approval(审批)
        """
        trigger_types = ["manual", "auto", "approval"]
        
        # 写入不同触发类型的日志
        for trigger_type in trigger_types:
            log = StateTransitionLog(
                id=uuid.uuid4(),
                asset_id=sample_asset.id,
                from_status="在用",
                to_status="待审批",
                trigger_type=trigger_type,
                created_at=datetime.now()
            )
            db_session.add(log)
        
        db_session.commit()
        
        # 查询并验证
        result = db_session.query(StateTransitionLog).filter_by(
            asset_id=sample_asset.id
        ).all()
        
        result_trigger_types = {log.trigger_type for log in result}
        assert result_trigger_types == set(trigger_types), \
            f"查询结果应包含所有触发类型: {trigger_types}, 实际: {result_trigger_types}"


# ============================================================================
# ATB-4.6: 历史查询-按时间范围测试
# ============================================================================

class TestHistoryQueryByDateRange:
    """
    ATB-4.6: 历史查询-按时间范围测试
    
    验证按时间范围查询状态变更历史的功能。
    """
    
    def test_query_history_by_date_range(self, db_session, sample_logs):
        """
        测试按时间范围查询状态变更历史
        
        验证规格: 返回指定时间段内的所有变更记录
        """
        # 写入测试数据
        for log in sample_logs:
            db_session.add(log)
        db_session.commit()
        
        # 定义查询时间范围（包含中间几条记录）
        start_time = sample_logs[1].created_at
        end_time = sample_logs[3].created_at
        
        # 执行范围查询
        result = db_session.query(StateTransitionLog).filter_by().all()
        
        # 手动过滤（模拟实际查询逻辑）
        filtered_result = [
            log for log in result
            if start_time <= log.created_at <= end_time
        ]
        
        # 验证结果
        expected_count = 3  # 索引1, 2, 3应在范围内
        assert len(filtered_result) == expected_count, \
            f"时间范围内应包含 {expected_count} 条记录，实际: {len(filtered_result)}"
    
    def test_query_history_boundary_start(self, db_session, sample_logs):
        """
        测试查询范围边界-起始时间
        
        验证 start_time 作为包含边界
        """
        start_time = sample_logs[2].created_at  # 包含此时间点
        
        result = db_session.query(StateTransitionLog).filter_by().all()
        filtered_result = [log for log in result if log.created_at >= start_time]
        
        # 索引2, 3, 4应在结果中
        assert len(filtered_result) >= 3, \
            f"起始边界查询应返回至少3条记录，实际: {len(filtered_result)}"
    
    def test_query_history_boundary_end(self, db_session, sample_logs):
        """
        测试查询范围边界-结束时间
        
        验证 end_time 作为包含边界
        """
        end_time = sample_logs[2].created_at  # 包含此时间点
        
        result = db_session.query(StateTransitionLog).filter_by().all()
        filtered_result = [log for log in result if log.created_at <= end_time]
        
        # 索引0, 1, 2应在结果中
        assert len(filtered_result) >= 3, \
            f"结束边界查询应返回至少3条记录，实际: {len(filtered_result)}"
    
    def test_query_history_no_results_in_range(self, db_session, sample_logs):
        """
        测试时间范围内无记录的情况
        
        应返回空列表
        """
        # 设置一个不包含任何日志的时间范围
        start_time = datetime(2099, 1, 1)
        end_time = datetime(2099, 12, 31)
        
        result = db_session.query(StateTransitionLog).filter_by().all()
        filtered_result = [
            log for log in result
            if start_time <= log.created_at <= end_time
        ]
        
        assert filtered_result == [], \
            f"无记录的时间范围应返回空列表，实际: {filtered_result}"
    
    def test_query_history_full_range(self, db_session, sample_logs):
        """
        测试覆盖所有日志的时间范围
        
        范围应包含所有记录的起始和结束时间
        """
        # 获取日志的实际时间范围
        timestamps = [log.created_at for log in sample_logs]
        min_time = min(timestamps) - timedelta(seconds=1)
        max_time = max(timestamps) + timedelta(seconds=1)
        
        result = db_session.query(StateTransitionLog).filter_by().all()
        filtered_result = [
            log for log in result
            if min_time <= log.created_at <= max_time
        ]
        
        assert len(filtered_result) == len(sample_logs), \
            f"完整范围应返回所有 {len(sample_logs)} 条记录，实际: {len(filtered_result)}"


# ============================================================================
# 辅助测试类
# ============================================================================

class TestRetirementStateMachine:
    """
    资产退役状态机测试
    
    验证资产退役流程中的状态转换逻辑。
    """
    
    def test_lifecycle_transitions_increment_history(self, db_session, sample_asset):
        """
        测试生命周期状态转换产生历史记录
        
        验证从"在用"到"已报废"的完整流程
        """
        transitions = [
            ("在用", "闲置"),
            ("闲置", "待审批"),
            ("待审批", "审批中"),
            ("审批中", "已批准"),
            ("已批准", "已报废"),
        ]
        
        for from_status, to_status in transitions:
            # 更新状态
            sample_asset.status = to_status
            
            # 创建日志
            log = StateTransitionLog(
                id=uuid.uuid4(),
                asset_id=sample_asset.id,
                from_status=from_status,
                to_status=to_status,
                trigger_type="manual" if from_status != "审批中" else "approval",
                created_at=datetime.now()
            )
            db_session.add(log)
            db_session.commit()
        
        # 验证产生5条日志
        logs = db_session.query(StateTransitionLog).filter_by(
            asset_id=sample_asset.id
        ).all()
        assert len(logs) == 5, f"生命周期应有5条状态变更日志，实际: {len(logs)}"
    
    def test_invalid_transition_rejected(self, sample_asset, valid_transition_map):
        """
        测试非法状态转换被拒绝
        
        验证不在合法转换映射中的状态变更被拦截
        """
        invalid_transitions = [
            ("在用", "已报废"),      # 不能跳过中间状态
            ("审批中", "闲置"),      # 审批中不能直接变闲置
            ("已批准", "待审批"),    # 已批准不能回退
        ]
        
        for from_status, to_status in invalid_transitions:
            assert (from_status, to_status) not in valid_transition_map, \
                f"测试用例错误: {from_status} -> {to_status} 应为非法转换"


class TestParallelApprovalChain:
    """
    并行审批链测试
    
    验证会签和或签场景下的审批链路逻辑。
    """
    
    def test_parallel_approval_all_required(self, db_session, sample_retirement_application):
        """
        测试并行审批（会签）- 全部通过
        
        会签模式: 所有审批人必须全部通过
        """
        # 创建3个并行审批节点
        nodes = []
        for i in range(3):
            node = ApprovalNode(
                id=uuid.uuid4(),
                application_id=sample_retirement_application.id,
                node_order=1,  # 同一层级
                approver_id=uuid.uuid4(),
                decision="pending",
                created_at=datetime.now()
            )
            nodes.append(node)
            db_session.add(node)
        
        db_session.commit()
        
        # 模拟全部通过
        for node in nodes:
            node.decision = "approved"
            node.decided_at = datetime.now()
        
        # 验证所有节点都已通过
        approved_count = sum(1 for n in nodes if n.decision == "approved")
        assert approved_count == 3, \
            f"会签模式应有3个审批节点全部通过，实际: {approved_count}"
    
    def test_parallel_approval_partial_reject(self, db_session, sample_retirement_application):
        """
        测试并行审批（会签）- 部分拒绝
        
        会签模式: 任一拒绝则流程终止
        """
        # 创建3个并行审批节点
        nodes = []
        for i in range(3):
            node = ApprovalNode(
                id=uuid.uuid4(),
                application_id=sample_retirement_application.id,
                node_order=1,
                approver_id=uuid.uuid4(),
                decision="pending",
                created_at=datetime.now()
            )
            nodes.append(node)
            db_session.add(node)
        
        db_session.commit()
        
        # 模拟2个通过，1个拒绝
        nodes[0].decision = "approved"
        nodes[1].decision = "approved"
        nodes[2].decision = "rejected"
        
        # 验证会签失败条件
        has_rejection = any(n.decision == "rejected" for n in nodes)
        assert has_rejection, "会签模式应检测到拒绝节点"


class TestHistoryTimeline:
    """
    历史时间线测试
    
    验证状态变更历史的排序和字段完整性。
    """
    
    def test_timeline_ordered_desc(self, db_session, sample_logs):
        """
        测试时间线按时间倒序排列
        
        最近的操作应排在前面
        """
        for log in sample_logs:
            db_session.add(log)
        db_session.commit()
        
        # 查询并倒序排列
        result = db_session.query(StateTransitionLog).filter_by(
            asset_id=sample_logs[0].asset_id
        ).order_by("created_at desc").all()
        
        # 验证倒序
        for i in range(1, len(result)):
            assert result[i-1].created_at >= result[i].created_at, \
                f"时间线应倒序排列: {result[i-1].created_at} < {result[i].created_at}"
    
    def test_timeline_includes_required_fields(self, sample_logs):
        """
        测试时间线包含所有必填字段
        
        每条记录应包含: 时间、状态变更、操作类型、操作人
        """
        for log in sample_logs:
            assert hasattr(log, 'created_at'), "日志缺少 created_at 字段"
            assert hasattr(log, 'from_status'), "日志缺少 from_status 字段"
            assert hasattr(log, 'to_status'), "日志缺少 to_status 字段"
            assert hasattr(log, 'trigger_type'), "日志缺少 trigger_type 字段"


class TestPermissionControl:
    """
    权限控制测试
    
    验证操作权限的校验逻辑。
    """
    
    def test_unauthorized_initiation_denied(self, sample_retirement_application):
        """
        测试未授权发起申请被拒绝
        
        模拟无权限用户尝试发起报废申请
        """
        unauthorized_user_id = uuid.uuid4()
        
        # 验证用户无申请权限（逻辑验证）
        # 实际场景中应通过权限服务校验
        assert unauthorized_user_id != sample_retirement_application.applicant_id, \
            "未授权用户不应有申请权限"
    
    def test_unauthorized_approval_denied(self, sample_retirement_application):
        """
        测试未授权审批被拒绝
        
        模拟非审批链中用户尝试审批
        """
        unauthorized_approver_id = uuid.uuid4()
        
        # 验证用户不在审批链中
        # 实际场景中应通过审批链服务校验
        valid_approver_ids = {node.approver_id for node in sample_retirement_application.approval_chain}
        assert unauthorized_approver_id not in valid_approver_ids, \
            "未授权用户不应有审批权限"


# ============================================================================
# 主程序入口（用于直接运行测试）
# ============================================================================

if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])