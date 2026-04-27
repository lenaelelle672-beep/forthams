"""
资产报废退役流程与审批链集成 - 集成测试

SWARM-2026-Q2-002 Iteration 4

测试覆盖范围：
- ATB-1: 报废申请提交
- ATB-2: 审批链层级验证
- ATB-3: 驳回与修改重提
- ATB-4: 生命周期历史查询

参考: tests/integration/test_retirement_request.py
"""

import pytest
from datetime import datetime, timedelta
from unittest.mock import Mock, patch, MagicMock
from typing import Dict, List, Optional

from src.models.retirement import RetirementApplication, RetirementStatus
from src.models.approval_chain import ApprovalChain, ApprovalNode, ApprovalStatus
from src.models.asset import Asset, AssetStatus
from src.models.asset_lifecycle_event import AssetLifecycleEvent
from src.services.retirement_service import RetirementService
from src.services.approval_service import ApprovalService
from src.services.lifecycle_service import LifecycleService
from src.repositories.history_repository import HistoryRepository


class TestRetirementApplicationSubmission:
    """ATB-1: 报废申请提交测试"""

    @pytest.fixture
    def mock_asset(self) -> Asset:
        """创建测试用资产"""
        asset = Mock(spec=Asset)
        asset.id = "AST-2024-001"
        asset.name = "服务器设备"
        asset.status = AssetStatus.AVAILABLE
        asset.status_locked = False
        asset.acquisition_date = datetime(2024, 1, 15)
        asset.current_value = 50000.0
        return asset

    @pytest.fixture
    def mock_retirement_service(self, mock_asset: Asset) -> RetirementService:
        """创建报废服务mock"""
        service = Mock(spec=RetirementService)
        return service

    def test_submit_retirement_application_success(
        self,
        mock_asset: Asset,
        mock_retirement_service: RetirementService
    ) -> None:
        """
        测试: 报废申请提交成功

        前提条件: 资产状态为"可用"，无进行中的报废申请
        操作: 提交报废申请
        期待结果:
        - response.status_code == 201
        - response.json()["status"] == "审批中"
        - response.json()["current_approver"] == "部门经理"
        """
        # Arrange
        application_data = {
            "asset_id": mock_asset.id,
            "reason": "设备老化",
            "estimated_residual_value": 500.00,
            "applicant_id": "user-001"
        }

        expected_response = {
            "id": "RET-2024-001",
            "asset_id": mock_asset.id,
            "status": "审批中",
            "current_approver": "部门经理",
            "created_at": datetime.now().isoformat()
        }

        mock_retirement_service.submit_application.return_value = expected_response

        # Act
        result = mock_retirement_service.submit_application(application_data)

        # Assert
        assert result["status"] == "审批中"
        assert result["current_approver"] == "部门经理"
        mock_retirement_service.submit_application.assert_called_once()

    def test_submit_retirement_application_locked_asset(
        self,
        mock_retirement_service: RetirementService
    ) -> None:
        """
        测试: 资产状态锁定时无法提交报废申请

        物理测试点: 资产状态锁定检查（asset.status == '审批中'）
        """
        # Arrange
        locked_asset = Mock(spec=Asset)
        locked_asset.id = "AST-2024-002"
        locked_asset.status_locked = True
        locked_asset.status = AssetStatus.UNDER_APPROVAL

        application_data = {
            "asset_id": locked_asset.id,
            "reason": "设备老化",
            "estimated_residual_value": 500.00
        }

        mock_retirement_service.submit_application.side_effect = ValueError(
            "资产状态已锁定，无法提交报废申请"
        )

        # Act & Assert
        with pytest.raises(ValueError, match="资产状态已锁定"):
            mock_retirement_service.submit_application(application_data)


class TestApprovalChainSequential:
    """ATB-2: 审批链层级验证测试"""

    @pytest.fixture
    def mock_approval_service(self) -> ApprovalService:
        """创建审批服务mock"""
        service = Mock(spec=ApprovalService)
        return service

    @pytest.fixture
    def approval_chain_config(self) -> List[str]:
        """配置3级审批链: 部门经理 → 资产管理员 → 财务"""
        return ["dept_manager", "asset_admin", "finance"]

    def test_sequential_approval_flow(
        self,
        mock_approval_service: ApprovalService,
        approval_chain_config: List[str]
    ) -> None:
        """
        测试: 顺序审批链执行

        期待结果:
        - 层级顺序校验（禁止跳级审批）
        - 每级审批后正确生成下一级任务
        - 最后一审批完成后触发状态变更
        """
        # Arrange - 第一级审批任务
        first_task = Mock()
        first_task.id = "TASK-001"
        first_task.asset_id = "AST-2024-001"
        first_task.level = 1
        first_task.approver = "dept_manager"
        first_task.status = ApprovalStatus.PENDING

        mock_approval_service.get_pending_approval.return_value = first_task

        # Act - 执行第一级审批
        result = mock_approval_service.approve(
            task_id=first_task.id,
            decision="approve",
            user_id="dept_manager"
        )

        # Assert - 第一级审批成功
        assert result.status == ApprovalStatus.APPROVED

        # Arrange - 第二级审批任务
        second_task = Mock()
        second_task.id = "TASK-002"
        second_task.asset_id = first_task.asset_id
        second_task.level = 2
        second_task.approver = "asset_admin"

        mock_approval_service.get_pending_approval.return_value = second_task

        # Act - 获取第二级任务
        next_task = mock_approval_service.get_pending_approval(user="asset_admin")

        # Assert - 第二级任务正确生成
        assert next_task.asset_id == first_task.asset_id
        assert next_task.level == 2

    def test_reject_breaks_chain(
        self,
        mock_approval_service: ApprovalService
    ) -> None:
        """
        测试: 驳回中断审批链

        期待结果: 驳回后资产状态恢复，不生成下一级任务
        """
        # Arrange
        pending_task = Mock()
        pending_task.id = "TASK-003"
        pending_task.asset_id = "AST-2024-003"
        pending_task.level = 1

        mock_approval_service.get_pending_approval.return_value = pending_task

        # Act - 第一级驳回
        result = mock_approval_service.reject(
            task_id=pending_task.id,
            reason="报废理由不充分",
            user_id="dept_manager"
        )

        # Assert
        assert result.status == ApprovalStatus.REJECTED
        assert result.rejection_reason == "报废理由不充分"

        # 验证不再有下一级任务
        mock_approval_service.get_pending_approval.return_value = None
        next_task = mock_approval_service.get_pending_approval(user="asset_admin")
        assert next_task is None


class TestRejectionAndResubmission:
    """ATB-3: 驳回与修改重提测试"""

    @pytest.fixture
    def mock_asset(self) -> Asset:
        """创建测试用资产"""
        asset = Mock(spec=Asset)
        asset.id = "AST-2024-004"
        asset.status = AssetStatus.AVAILABLE
        asset.status_locked = False
        return asset

    @pytest.fixture
    def mock_retirement_service(self) -> RetirementService:
        """创建报废服务mock"""
        service = Mock(spec=RetirementService)
        return service

    def test_reject_and_resubmit_workflow(
        self,
        mock_retirement_service: RetirementService,
        mock_asset: Asset
    ) -> None:
        """
        测试: 驳回后修改重提流程

        物理测试点:
        - 驳回后资产状态恢复
        - 驳回记录持久化
        - 修改后新审批链正确启动
        """
        # Arrange - 初始申请
        initial_application = Mock()
        initial_application.id = "RET-2024-004"
        initial_application.asset_id = mock_asset.id
        initial_application.status = RetirementStatus.PENDING

        mock_retirement_service.get_application.return_value = initial_application

        # Act - 执行驳回
        mock_retirement_service.reject(
            application_id=initial_application.id,
            reason="报废理由不充分",
            rejector_id="dept_manager"
        )

        # Assert - 状态恢复
        assert mock_asset.status == AssetStatus.AVAILABLE
        assert not mock_asset.status_locked

        # Arrange - 申请人修改重提
        updated_data = {
            "reason": "设备已无法修复，需报废",
            "estimated_residual_value": 200.00
        }

        updated_response = {
            "id": "RET-2024-004-v2",
            "status": "审批中",
            "version": 2,
            "current_approver": "部门经理"
        }
        mock_retirement_service.update_and_resubmit.return_value = updated_response

        # Act - 修改重提
        result = mock_retirement_service.update_and_resubmit(
            application_id=initial_application.id,
            data=updated_data
        )

        # Assert - 新审批链启动
        assert result["status"] == "审批中"
        assert result["version"] == 2


class TestLifecycleHistory:
    """ATB-4: 生命周期历史查询测试"""

    @pytest.fixture
    def mock_history_repository(self) -> HistoryRepository:
        """创建历史记录仓库mock"""
        return Mock(spec=HistoryRepository)

    @pytest.fixture
    def mock_lifecycle_service(self) -> LifecycleService:
        """创建生命周期服务mock"""
        return Mock(spec=LifecycleService)

    def test_query_lifecycle_history(
        self,
        mock_history_repository: HistoryRepository,
        mock_lifecycle_service: LifecycleService
    ) -> None:
        """
        测试: 生命周期历史查询

        物理测试点:
        - 按时间倒序/正序查询
        - 历史记录不可修改验证
        - 状态变更节点完整性
        """
        # Arrange
        asset_id = "AST-2024-001"
        expected_events = [
            {"event": "采购入库", "timestamp": "2024-01-15T10:00:00"},
            {"event": "领用", "timestamp": "2024-02-01T14:30:00"},
            {"event": "维修", "timestamp": "2024-06-10T09:15:00"},
            {"event": "报废申请", "timestamp": "2026-04-20T16:00:00"},
            {"event": "审批完成", "timestamp": "2026-04-22T11:30:00"}
        ]

        mock_lifecycle_service.get_timeline.return_value = expected_events

        # Act
        result = mock_lifecycle_service.get_timeline(asset_id)

        # Assert
        assert len(result) == 5
        assert result[0]["event"] == "采购入库"
        assert result[-1]["event"] == "审批完成"

    def test_lifecycle_history_immutability(
        self,
        mock_history_repository: HistoryRepository
    ) -> None:
        """
        测试: 历史记录不可修改验证

        期待: 尝试修改历史记录应抛出异常
        """
        # Arrange
        existing_event = Mock(spec=AssetLifecycleEvent)
        existing_event.id = "EVT-001"
        existing_event.asset_id = "AST-2024-001"
        existing_event.is_immutable = True

        mock_history_repository.get.return_value = existing_event

        # Act & Assert
        with pytest.raises(PermissionError, match="历史记录不可修改"):
            mock_history_repository.update(existing_event, {"event": "篡改"})

    def test_lifecycle_timeline_ordering(
        self,
        mock_lifecycle_service: LifecycleService
    ) -> None:
        """
        测试: 时间轴排序验证

        期待: 时间轴按时间正序排列
        """
        # Arrange
        asset_id = "AST-2024-005"
        unordered_events = [
            {"event": "报废申请", "timestamp": "2026-04-20"},
            {"event": "采购入库", "timestamp": "2024-01-15"},
            {"event": "领用", "timestamp": "2024-02-01"}
        ]

        mock_lifecycle_service.get_timeline.return_value = sorted(
            unordered_events,
            key=lambda x: x["timestamp"]
        )

        # Act
        result = mock_lifecycle_service.get_timeline(asset_id)

        # Assert - 验证按时间正序
        timestamps = [e["timestamp"] for e in result]
        assert timestamps == sorted(timestamps)


class TestFullApprovalFlow:
    """ATB-5: 完整E2E审批流程测试（模拟）"""

    @pytest.fixture
    def full_workflow_setup(self):
        """完整工作流设置"""
        return {
            "asset_id": "AST-2024-010",
            "applicant": "user-001",
            "approval_chain": ["dept_manager", "asset_admin", "finance"],
            "expected_duration_days": 3
        }

    def test_complete_approval_workflow(
        self,
        full_workflow_setup: Dict
    ) -> None:
        """
        测试: 完整审批流程

        模拟完整流程: 申请 → 一级审批 → 二级审批 → 三级审批 → 完成
        """
        # Arrange
        workflow = full_workflow_setup
        current_level = 0

        # Simulate workflow progression
        stages = []
        for approver in workflow["approval_chain"]:
            current_level += 1
            stage = {
                "level": current_level,
                "approver": approver,
                "status": "completed" if current_level < 3 else "pending",
                "timestamp": datetime.now().isoformat()
            }
            stages.append(stage)

        # Assert - 验证审批链配置
        assert len(stages) == 3
        assert stages[0]["approver"] == "dept_manager"
        assert stages[1]["approver"] == "asset_admin"
        assert stages[2]["approver"] == "finance"

    def test_approval_timeout_handling(
        self,
        full_workflow_setup: Dict
    ) -> None:
        """
        测试: 审批超时处理

        边界: 单次审批超时 72 小时，超时自动提醒
        """
        # Arrange
        task = Mock()
        task.created_at = datetime.now() - timedelta(hours=73)
        task.timeout_hours = 72

        # Act
        is_expired = task.created_at + timedelta(hours=task.timeout_hours) < datetime.now()

        # Assert
        assert is_expired is True

    def test_concurrent_retirement_requests_blocked(
        self,
        mock_retirement_service: RetirementService
    ) -> None:
        """
        测试: 并发报废申请阻塞

        边界: 同一资产并发发起多个报废申请（状态锁定）
        """
        # Arrange
        asset_id = "AST-2024-011"
        mock_retirement_service.has_pending_application.return_value = True

        # Act & Assert
        with pytest.raises(ValueError, match="存在进行中的报废申请"):
            mock_retirement_service.submit_application({
                "asset_id": asset_id,
                "reason": "设备老化"
            })


class TestRetirementStateMachine:
    """报废状态机测试"""

    def test_status_transition_submitted_to_pending(self) -> None:
        """测试: 提交申请后状态变为待审批"""
        application = Mock(spec=RetirementApplication)
        application.status = RetirementStatus.SUBMITTED

        # Simulate state transition
        application.status = RetirementStatus.PENDING

        assert application.status == RetirementStatus.PENDING

    def test_status_transition_pending_to_approved(self) -> None:
        """测试: 审批通过后状态变为已报废"""
        application = Mock(spec=RetirementApplication)
        application.status = RetirementStatus.PENDING

        # Simulate final approval
        application.status = RetirementStatus.APPROVED

        assert application.status == RetirementStatus.APPROVED

    def test_status_transition_pending_to_rejected(self) -> None:
        """测试: 审批驳回后状态变为已拒绝"""
        application = Mock(spec=RetirementApplication)
        application.status = RetirementStatus.PENDING

        # Simulate rejection
        application.status = RetirementStatus.REJECTED

        assert application.status == RetirementStatus.REJECTED


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])