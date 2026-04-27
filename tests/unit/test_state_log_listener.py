"""
状态变更日志监听器测试

测试 StateLogListener 对状态变更事件的记录功能，包括：
- ATB-4.1: 状态变更日志完整性验证
- ATB-4.2: 审批操作原子性验证
- ATB-4.3: 哈希链防篡改验证

参考文档: SWARM-002-Iteration-8 Phase 4 历史记录持久化
"""

import pytest
import uuid
import hashlib
import json
from datetime import datetime
from unittest.mock import Mock, MagicMock, patch
from typing import List, Optional

from src.domain.events.listeners.state_log_listener import StateLogListener
from src.domain.events.listeners.base import EventListener
from src.domain.events.state_changed import StateChangedEvent
from src.domain.models.state_transition_log import StateTransitionLog
from src.domain.services.audit_hash_chain import AuditHashChain
from src.domain.exceptions import AuditChainBrokenError


class TestStateLogListener:
    """状态变更日志监听器测试类"""

    @pytest.fixture
    def mock_unit_of_work(self):
        """创建模拟的 UnitOfWork"""
        uow = Mock()
        uow.state_transition_logs = Mock()
        uow.state_transition_logs.add = Mock()
        uow.state_transition_logs.get_by_asset_id = Mock(return_value=[])
        uow.commit = Mock()
        uow.rollback = Mock()
        return uow

    @pytest.fixture
    def mock_hash_chain(self):
        """创建模拟的哈希链工具"""
        chain = Mock(spec=AuditHashChain)
        chain.append_log = Mock(return_value="hash_value_123")
        chain.verify_chain = Mock(return_value=True)
        chain.get_last_hash = Mock(return_value=None)
        return chain

    @pytest.fixture
    def listener(self, mock_unit_of_work, mock_hash_chain):
        """创建 StateLogListener 实例"""
        return StateLogListener(
            unit_of_work=mock_unit_of_work,
            hash_chain=mock_hash_chain
        )

    @pytest.fixture
    def sample_event(self):
        """创建示例状态变更事件"""
        return StateChangedEvent(
            asset_id=uuid.uuid4(),
            from_status="闲置",
            to_status="待审批",
            trigger_type="manual",
            operator_id=uuid.uuid4(),
            metadata={"reason": "test", "application_id": str(uuid.uuid4())}
        )

    def test_listener_implements_event_listener(self, listener):
        """验证 StateLogListener 实现了 EventListener 接口"""
        assert isinstance(listener, EventListener)

    def test_handle_state_changed_creates_log_entry(self, listener, sample_event, mock_unit_of_work):
        """ATB-4.1: 验证状态变更生成完整的日志记录"""
        # Arrange
        asset_id = sample_event.asset_id
        
        # Act
        listener.handle_state_changed(sample_event)
        
        # Assert - 验证日志已添加
        mock_unit_of_work.state_transition_logs.add.assert_called_once()
        call_args = mock_unit_of_work.state_transition_logs.add.call_args
        log_entry = call_args[0][0]
        
        # 验证日志字段完整性
        assert log_entry.asset_id == asset_id
        assert log_entry.from_status == "闲置"
        assert log_entry.to_status == "待审批"
        assert log_entry.trigger_type == "manual"
        assert log_entry.operator_id == sample_event.operator_id
        assert log_entry.metadata == {"reason": "test", "application_id": sample_event.metadata["application_id"]}

    def test_handle_state_changed_commits_transaction(self, listener, sample_event, mock_unit_of_work):
        """ATB-4.2: 验证状态变更与日志写入在同一事务中"""
        # Act
        listener.handle_state_changed(sample_event)
        
        # Assert - 验证事务已提交
        mock_unit_of_work.commit.assert_called_once()

    def test_handle_state_changed_rollback_on_error(self, listener, mock_unit_of_work, mock_hash_chain):
        """ATB-4.2: 验证失败时事务回滚"""
        # Arrange
        mock_unit_of_work.commit.side_effect = Exception("Database error")
        error_event = StateChangedEvent(
            asset_id=uuid.uuid4(),
            from_status="闲置",
            to_status="待审批",
            trigger_type="manual",
            operator_id=None,
            metadata={}
        )
        
        # Act & Assert
        with pytest.raises(Exception):
            listener.handle_state_changed(error_event)
        
        mock_unit_of_work.rollback.assert_called_once()

    def test_hash_chain_appended_on_state_change(self, listener, sample_event, mock_hash_chain):
        """ATB-4.3: 验证状态变更时更新哈希链"""
        # Act
        listener.handle_state_changed(sample_event)
        
        # Assert - 验证哈希链已更新
        mock_hash_chain.append_log.assert_called_once()

    def test_hash_chain_verification_passes_intact(self, listener, mock_unit_of_work, mock_hash_chain):
        """ATB-4.3: 验证完整哈希链校验通过"""
        # Arrange
        logs = [
            StateTransitionLog(
                id=uuid.uuid4(),
                asset_id=uuid.uuid4(),
                from_status="在用",
                to_status="闲置",
                trigger_type="manual",
                operator_id=None,
                metadata={},
                hash_chain="prev_hash",
                created_at=datetime.utcnow()
            ),
            StateTransitionLog(
                id=uuid.uuid4(),
                asset_id=uuid.uuid4(),
                from_status="闲置",
                to_status="待审批",
                trigger_type="manual",
                operator_id=None,
                metadata={},
                hash_chain="hash_1",
                created_at=datetime.utcnow()
            )
        ]
        mock_unit_of_work.state_transition_logs.get_by_asset_id.return_value = logs
        mock_hash_chain.verify_chain.return_value = True
        
        # Act
        result = listener.verify_hash_chain(logs[0].asset_id)
        
        # Assert
        assert result is True
        mock_hash_chain.verify_chain.assert_called_once_with(logs)

    def test_hash_chain_verification_detects_tampering(self, listener, mock_unit_of_work, mock_hash_chain):
        """ATB-4.3: 验证篡改检测 - 修改记录后哈希校验失败"""
        # Arrange
        tampered_logs = [
            StateTransitionLog(
                id=uuid.uuid4(),
                asset_id=uuid.uuid4(),
                from_status="在用",
                to_status="闲置",
                trigger_type="manual",
                operator_id=None,
                metadata={},
                hash_chain="prev_hash",
                created_at=datetime.utcnow()
            ),
            StateTransitionLog(
                id=uuid.uuid4(),
                asset_id=uuid.uuid4(),
                from_status="闲置",
                to_status="待审批",
                trigger_type="manual",
                operator_id=None,
                metadata={"modified": True},  # 已篡改
                hash_chain="wrong_hash",
                created_at=datetime.utcnow()
            )
        ]
        mock_hash_chain.verify_chain.return_value = False
        
        # Act & Assert
        with pytest.raises(AuditChainBrokenError):
            listener.verify_hash_chain(tampered_logs[0].asset_id)

    def test_get_transition_history_returns_ordered_logs(self, listener, mock_unit_of_work):
        """ATB-4.1: 验证历史记录按时间倒序返回"""
        # Arrange
        asset_id = uuid.uuid4()
        now = datetime.utcnow()
        ordered_logs = [
            StateTransitionLog(
                id=uuid.uuid4(),
                asset_id=asset_id,
                from_status="在用",
                to_status="闲置",
                trigger_type="manual",
                operator_id=None,
                metadata={},
                hash_chain=None,
                created_at=now.replace(day=1)
            ),
            StateTransitionLog(
                id=uuid.uuid4(),
                asset_id=asset_id,
                from_status="闲置",
                to_status="待审批",
                trigger_type="manual",
                operator_id=None,
                metadata={},
                hash_chain="hash_1",
                created_at=now.replace(day=15)
            ),
            StateTransitionLog(
                id=uuid.uuid4(),
                asset_id=asset_id,
                from_status="待审批",
                to_status="审批中",
                trigger_type="approval",
                operator_id=uuid.uuid4(),
                metadata={},
                hash_chain="hash_2",
                created_at=now
            )
        ]
        mock_unit_of_work.state_transition_logs.get_by_asset_id.return_value = ordered_logs
        
        # Act
        history = listener.get_transition_history(asset_id)
        
        # Assert - 验证返回顺序
        assert len(history) == 3
        # 最新记录在前
        assert history[0].to_status == "审批中"
        assert history[1].to_status == "待审批"
        assert history[2].to_status == "闲置"

    def test_get_transition_history_by_time_range(self, listener, mock_unit_of_work):
        """ATB-4.1: 验证按时间范围查询历史记录"""
        # Arrange
        asset_id = uuid.uuid4()
        start_time = datetime(2024, 1, 1)
        end_time = datetime(2024, 12, 31)
        
        mock_unit_of_work.state_transition_logs.get_by_asset_id.return_value = []
        
        # Act
        history = listener.get_transition_history(
            asset_id, 
            start_time=start_time, 
            end_time=end_time
        )
        
        # Assert
        mock_unit_of_work.state_transition_logs.get_by_asset_id.assert_called_once()

    def test_metadata_stored_as_json(self, listener, sample_event, mock_unit_of_work):
        """验证元数据以 JSON 格式存储"""
        # Arrange
        complex_metadata = {
            "reason": "设备老化",
            "estimated_value": 15000.00,
            "approval_nodes": [
                {"order": 1, "approver_id": str(uuid.uuid4())},
                {"order": 2, "approver_id": str(uuid.uuid4())}
            ],
            "tags": ["IT设备", "高价值"]
        }
        sample_event.metadata = complex_metadata
        
        # Act
        listener.handle_state_changed(sample_event)
        
        # Assert
        call_args = mock_unit_of_work.state_transition_logs.add.call_args
        log_entry = call_args[0][0]
        
        # 验证 metadata 可以被 JSON 序列化
        serialized = json.dumps(log_entry.metadata)
        assert "设备老化" in serialized
        assert "15000" in serialized

    def test_approval_trigger_records_operator(self, listener, mock_unit_of_work):
        """验证审批触发类型记录审批人信息"""
        # Arrange
        approver_id = uuid.uuid4()
        approval_event = StateChangedEvent(
            asset_id=uuid.uuid4(),
            from_status="待审批",
            to_status="审批中",
            trigger_type="approval",
            operator_id=approver_id,
            metadata={"node_order": 1, "decision": "approved"}
        )
        
        # Act
        listener.handle_state_changed(approval_event)
        
        # Assert
        call_args = mock_unit_of_work.state_transition_logs.add.call_args
        log_entry = call_args[0][0]
        
        assert log_entry.operator_id == approver_id
        assert log_entry.trigger_type == "approval"

    def test_auto_trigger_uses_system_operator(self, listener, mock_unit_of_work):
        """验证自动触发类型记录系统操作者"""
        # Arrange
        auto_event = StateChangedEvent(
            asset_id=uuid.uuid4(),
            from_status="草稿",
            to_status="已撤回",
            trigger_type="auto",
            operator_id=None,
            metadata={"reason": "timeout"}
        )
        
        # Act
        listener.handle_state_changed(auto_event)
        
        # Assert
        call_args = mock_unit_of_work.state_transition_logs.add.call_args
        log_entry = call_args[0][0]
        
        assert log_entry.trigger_type == "auto"
        assert log_entry.operator_id is None

    def test_hash_chain_includes_previous_hash(self, listener, sample_event, mock_hash_chain):
        """验证哈希链包含前一条记录的哈希"""
        # Arrange
        previous_hash = "previous_hash_value_abc"
        mock_hash_chain.get_last_hash.return_value = previous_hash
        
        # Act
        listener.handle_state_changed(sample_event)
        
        # Assert
        call_args = mock_hash_chain.append_log.call_args
        assert call_args[0][0] == previous_hash  # 第一个参数是前一条哈希

    def test_listener_handles_multiple_events_atomically(self, listener, mock_unit_of_work):
        """验证监听器处理多个事件时保持原子性"""
        # Arrange
        events = [
            StateChangedEvent(
                asset_id=uuid.uuid4(),
                from_status="在用",
                to_status="闲置",
                trigger_type="manual",
                operator_id=None,
                metadata={}
            ),
            StateChangedEvent(
                asset_id=uuid.uuid4(),
                from_status="闲置",
                to_status="待审批",
                trigger_type="manual",
                operator_id=None,
                metadata={}
            )
        ]
        
        # Act
        listener.handle_batch_events(events)
        
        # Assert - 验证所有事件都被处理
        assert mock_unit_of_work.state_transition_logs.add.call_count == 2
        assert mock_unit_of_work.commit.call_count == 1

    def test_empty_metadata_handled_gracefully(self, listener, mock_unit_of_work):
        """验证空元数据被正确处理"""
        # Arrange
        event = StateChangedEvent(
            asset_id=uuid.uuid4(),
            from_status="在用",
            to_status="闲置",
            trigger_type="manual",
            operator_id=None,
            metadata=None
        )
        
        # Act - 不应抛出异常
        listener.handle_state_changed(event)
        
        # Assert
        call_args = mock_unit_of_work.state_transition_logs.add.call_args
        log_entry = call_args[0][0]
        assert log_entry.metadata == {}

    def test_invalid_asset_id_raises_error(self, listener, mock_unit_of_work):
        """验证无效资产ID抛出错误"""
        # Arrange
        invalid_event = StateChangedEvent(
            asset_id=None,  # 无效ID
            from_status="在用",
            to_status="闲置",
            trigger_type="manual",
            operator_id=None,
            metadata={}
        )
        
        # Act & Assert
        with pytest.raises(ValueError):
            listener.handle_state_changed(invalid_event)


class TestAuditHashChain:
    """哈希链审计测试类"""

    @pytest.fixture
    def hash_chain(self):
        """创建 AuditHashChain 实例"""
        return AuditHashChain()

    def test_append_log_creates_hash(self, hash_chain):
        """验证追加日志生成哈希"""
        # Arrange
        log = StateTransitionLog(
            id=uuid.uuid4(),
            asset_id=uuid.uuid4(),
            from_status="在用",
            to_status="闲置",
            trigger_type="manual",
            operator_id=None,
            metadata={},
            hash_chain=None,
            created_at=datetime.utcnow()
        )
        
        # Act
        hash_value = hash_chain.append_log(log, previous_hash=None)
        
        # Assert
        assert hash_value is not None
        assert len(hash_value) == 64  # SHA256 哈希长度

    def test_chain_produces_deterministic_hash(self, hash_chain):
        """验证相同数据产生相同哈希"""
        # Arrange
        log = StateTransitionLog(
            id=uuid.uuid4(),
            asset_id=uuid.uuid4(),
            from_status="在用",
            to_status="闲置",
            trigger_type="manual",
            operator_id=None,
            metadata={},
            hash_chain=None,
            created_at=datetime.utcnow()
        )
        
        # Act
        hash1 = hash_chain.append_log(log, previous_hash=None)
        hash2 = hash_chain.append_log(log, previous_hash=None)
        
        # Assert
        assert hash1 == hash2

    def test_different_data_produces_different_hash(self, hash_chain):
        """验证不同数据产生不同哈希"""
        # Arrange
        log1 = StateTransitionLog(
            id=uuid.uuid4(),
            asset_id=uuid.uuid4(),
            from_status="在用",
            to_status="闲置",
            trigger_type="manual",
            operator_id=None,
            metadata={},
            hash_chain=None,
            created_at=datetime.utcnow()
        )
        log2 = StateTransitionLog(
            id=uuid.uuid4(),
            asset_id=uuid.uuid4(),
            from_status="在用",
            to_status="维修中",  # 不同的 to_status
            trigger_type="manual",
            operator_id=None,
            metadata={},
            hash_chain=None,
            created_at=datetime.utcnow()
        )
        
        # Act
        hash1 = hash_chain.append_log(log1, previous_hash=None)
        hash2 = hash_chain.append_log(log2, previous_hash=None)
        
        # Assert
        assert hash1 != hash2

    def test_verify_chain_returns_true_for_valid_chain(self, hash_chain):
        """验证有效链通过校验"""
        # Arrange
        log1 = StateTransitionLog(
            id=uuid.uuid4(),
            asset_id=uuid.uuid4(),
            from_status="在用",
            to_status="闲置",
            trigger_type="manual",
            operator_id=None,
            metadata={},
            hash_chain=None,
            created_at=datetime.utcnow()
        )
        log1_hash = hash_chain.append_log(log1, previous_hash=None)
        log1.hash_chain = log1_hash
        
        log2 = StateTransitionLog(
            id=uuid.uuid4(),
            asset_id=uuid.uuid4(),
            from_status="闲置",
            to_status="待审批",
            trigger_type="manual",
            operator_id=None,
            metadata={},
            hash_chain=log1_hash,
            created_at=datetime.utcnow()
        )
        log2_hash = hash_chain.append_log(log2, previous_hash=log1_hash)
        log2.hash_chain = log2_hash
        
        # Act
        result = hash_chain.verify_chain([log1, log2])
        
        # Assert
        assert result is True

    def test_verify_chain_detects_modification(self, hash_chain):
        """验证链校验检测到数据篡改"""
        # Arrange
        log1 = StateTransitionLog(
            id=uuid.uuid4(),
            asset_id=uuid.uuid4(),
            from_status="在用",
            to_status="闲置",
            trigger_type="manual",
            operator_id=None,
            metadata={},
            hash_chain=None,
            created_at=datetime.utcnow()
        )
        log1_hash = hash_chain.append_log(log1, previous_hash=None)
        log1.hash_chain = log1_hash
        
        # 篡改日志内容
        log2 = StateTransitionLog(
            id=uuid.uuid4(),
            asset_id=uuid.uuid4(),
            from_status="闲置",
            to_status="已报废",  # 原始值应该是"待审批"
            trigger_type="manual",
            operator_id=None,
            metadata={"tampered": True},
            hash_chain=log1_hash,
            created_at=datetime.utcnow()
        )
        # 使用原始内容计算哈希，但实际数据已被篡改
        original_log2 = StateTransitionLog(
            id=log2.id,
            asset_id=log2.asset_id,
            from_status="闲置",
            to_status="待审批",
            trigger_type="manual",
            operator_id=None,
            metadata={},
            hash_chain=log1_hash,
            created_at=log2.created_at
        )
        log2_hash = hash_chain.append_log(original_log2, previous_hash=log1_hash)
        log2.hash_chain = log2_hash
        
        # Act
        result = hash_chain.verify_chain([log1, log2])
        
        # Assert
        assert result is False

    def test_previous_hash_included_in_computation(self, hash_chain):
        """验证前一条哈希被包含在计算中"""
        # Arrange
        previous_hash = "previous_hash_value"
        log = StateTransitionLog(
            id=uuid.uuid4(),
            asset_id=uuid.uuid4(),
            from_status="在用",
            to_status="闲置",
            trigger_type="manual",
            operator_id=None,
            metadata={},
            hash_chain=None,
            created_at=datetime.utcnow()
        )
        
        # Act
        hash_with_prev = hash_chain.append_log(log, previous_hash=previous_hash)
        hash_without_prev = hash_chain.append_log(log, previous_hash=None)
        
        # Assert
        assert hash_with_prev != hash_without_prev


class TestStateLogListenerIntegration:
    """状态日志监听器集成测试"""

    @pytest.fixture
    def integration_setup(self):
        """集成测试环境设置"""
        # 创建实际的 UnitOfWork（使用内存数据库或模拟）
        uow = Mock()
        logs = []
        
        def add_log(log):
            logs.append(log)
        
        uow.state_transition_logs.add = add_log
        uow.commit = Mock()
        uow.rollback = Mock()
        
        return uow, logs

    def test_full_retirement_flow_logging(self, integration_setup):
        """验证完整退役流程的状态日志记录"""
        # Arrange
        uow, logs = integration_setup
        listener = StateLogListener(unit_of_work=uow, hash_chain=AuditHashChain())
        asset_id = uuid.uuid4()
        
        # 模拟完整流程
        retirement_flow = [
            ("在用", "闲置", "manual", None, {"action": "mark_idle"}),
            ("闲置", "待审批", "manual", uuid.uuid4(), {"reason": "retire", "application_id": str(uuid.uuid4())}),
            ("待审批", "审批中", "approval", uuid.uuid4(), {"node_order": 1}),
            ("审批中", "审批中", "approval", uuid.uuid4(), {"node_order": 2}),
            ("审批中", "已报废", "approval", uuid.uuid4(), {"final_approval": True})
        ]
        
        # Act
        for from_status, to_status, trigger_type, operator_id, metadata in retirement_flow:
            event = StateChangedEvent(
                asset_id=asset_id,
                from_status=from_status,
                to_status=to_status,
                trigger_type=trigger_type,
                operator_id=operator_id,
                metadata=metadata
            )
            listener.handle_state_changed(event)
        
        # Assert
        assert len(logs) == 5
        assert logs[0].from_status == "在用"
        assert logs[0].to_status == "闲置"
        assert logs[4].to_status == "已报废"
        
        # 验证哈希链完整性
        for i, log in enumerate(logs):
            if i == 0:
                assert log.hash_chain is None
            else:
                assert log.hash_chain is not None

    def test_withdrawal_creates_proper_log(self, integration_setup):
        """验证撤回操作创建正确的日志"""
        # Arrange
        uow, logs = integration_setup
        listener = StateLogListener(unit_of_work=uow, hash_chain=AuditHashChain())
        
        # Act
        withdrawal_event = StateChangedEvent(
            asset_id=uuid.uuid4(),
            from_status="审批中",
            to_status="已撤回",
            trigger_type="manual",
            operator_id=uuid.uuid4(),
            metadata={"reason": "applicant_withdrawal", "withdraw_time": datetime.utcnow().isoformat()}
        )
        listener.handle_state_changed(withdrawal_event)
        
        # Assert
        assert len(logs) == 1
        assert logs[0].to_status == "已撤回"
        assert logs[0].trigger_type == "manual"
        assert "applicant_withdrawal" in logs[0].metadata["reason"]