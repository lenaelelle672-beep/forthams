"""
工单审批流程引擎 - 验收测试基准 (ATB)

本模块验证 SWARM-501 工单审批流程引擎的核心验收标准：

状态转换规则:
    - DRAFT → PENDING (submit)
    - PENDING → APPROVED (approve)
    - PENDING → REJECTED (reject)

边界约束:
    - 终态 (APPROVED/REJECTED) 不可逆
    - 非法状态转换抛出 InvalidTransitionError
    - 拒绝操作必须提供原因
    - 重复提交操作幂等

AC 覆盖:
    - AC-001: 工单审批流程引擎状态机驱动
    - AC-002: 前端发起审批申请
    - AC-003: 代码无语法错误 (AST 静态检查)
    - AC-004: 函数包含 docstring 文档注释
    - AC-005: 模块可正常 import

References:
    - SWARM-501 工单审批流程引擎规格文档
    - backend/state_machine/approval_state_machine.py
    - src/api/routes/work_orders.py
"""

import pytest
from unittest.mock import MagicMock, AsyncMock
from uuid import uuid4
from datetime import datetime

from src.models.workorder import WorkOrder, WorkOrderState, WorkOrderEvent
from src.services.work_order_service import WorkOrderService
from src.state_machine.approval_state_machine import ApprovalStateMachine
from src.api.routes.work_orders import validate_workorder_submission


class TestWorkOrderValidation:
    """
    工单字段验证测试套件
    
    验证工单创建和提交时的必填字段校验逻辑
    """

    def setup_method(self):
        """初始化测试 fixture"""
        self.mock_repository = MagicMock()
        self.mock_publisher = MagicMock()
        self.service = WorkOrderService(
            repository=self.mock_repository,
            event_publisher=self.mock_publisher
        )

    def test_submit_validates_required_fields(self):
        """
        [ATB-007] submit 操作校验必填字段
        
        工单提交前必须完成所有必填字段的完整性校验：
        - title: 1-200字符
        - description: 1-2000字符
        - applicant_id: 非空UUID
        - priority: 有效枚举值 [LOW, MEDIUM, HIGH, CRITICAL]
        """
        workorder = WorkOrder(
            id=uuid4(),
            title="",  # 空标题 - 违反校验
            description="Test description",
            applicant_id=uuid4(),
            priority="MEDIUM",
            state=WorkOrderState.DRAFT
        )
        self.mock_repository.get_by_id.return_value = workorder
        
        with pytest.raises(ValidationError) as exc_info:
            self.service.submit_workorder(workorder.id)
        
        assert "title" in str(exc_info.value).lower()

    def test_submit_requires_description(self):
        """
        [ATB-007b] 描述字段不能为空
        
        验证 description 字段为必填项
        """
        workorder = WorkOrder(
            id=uuid4(),
            title="Valid Title",
            description=None,  # 描述为空
            applicant_id=uuid4(),
            priority="MEDIUM",
            state=WorkOrderState.DRAFT
        )
        self.mock_repository.get_by_id.return_value = workorder
        
        with pytest.raises(ValidationError) as exc_info:
            self.service.submit_workorder(workorder.id)
        
        assert "description" in str(exc_info.value).lower()

    def test_submit_requires_applicant_id(self):
        """
        [ATB-007c] 申请人ID不能为空
        
        验证 applicant_id 必须为有效的非空 UUID
        """
        workorder = WorkOrder(
            id=uuid4(),
            title="Valid Title",
            description="Valid description",
            applicant_id=None,  # 申请人为空
            priority="MEDIUM",
            state=WorkOrderState.DRAFT
        )
        self.mock_repository.get_by_id.return_value = workorder
        
        with pytest.raises(ValidationError) as exc_info:
            self.service.submit_workorder(workorder.id)
        
        assert "applicant_id" in str(exc_info.value).lower()

    def test_submit_validates_priority_enum(self):
        """
        [ATB-007d] 优先级枚举值校验
        
        priority 必须是有效枚举值之一：[LOW, MEDIUM, HIGH, CRITICAL]
        """
        workorder = WorkOrder(
            id=uuid4(),
            title="Valid Title",
            description="Valid description",
            applicant_id=uuid4(),
            priority="INVALID",  # 无效枚举值
            state=WorkOrderState.DRAFT
        )
        self.mock_repository.get_by_id.return_value = workorder
        
        with pytest.raises(ValidationError) as exc_info:
            self.service.submit_workorder(workorder.id)
        
        assert "priority" in str(exc_info.value).lower()


class TestRejectRequiresReason:
    """
    拒绝操作必须提供原因测试套件
    
    验证 PENDING 状态工单的拒绝操作必须附带拒绝原因
    """

    def setup_method(self):
        """初始化测试 fixture"""
        self.mock_repository = MagicMock()
        self.mock_publisher = MagicMock()
        self.service = WorkOrderService(
            repository=self.mock_repository,
            event_publisher=self.mock_publisher
        )

    def test_reject_requires_reason(self):
        """
        [ATB-008] 拒绝操作必须提供原因
        
        拒绝工单时 reason 参数为必填，不能为空字符串
        """
        workorder = WorkOrder(
            id=uuid4(),
            title="Test WorkOrder",
            description="Test description",
            applicant_id=uuid4(),
            priority="MEDIUM",
            state=WorkOrderState.PENDING
        )
        self.mock_repository.get_by_id.return_value = workorder
        
        with pytest.raises(ValidationError) as exc_info:
            self.service.reject_workorder(workorder.id, reason="")
        
        assert "拒绝原因不能为空" in str(exc_info.value)

    def test_reject_accepts_valid_reason(self):
        """
        [ATB-008b] 有效拒绝原因应该被接受
        
        提供非空拒绝原因时，操作应成功执行
        """
        workorder = WorkOrder(
            id=uuid4(),
            title="Test WorkOrder",
            description="Test description",
            applicant_id=uuid4(),
            priority="MEDIUM",
            state=WorkOrderState.PENDING
        )
        self.mock_repository.get_by_id.return_value = workorder
        self.mock_repository.update.return_value = workorder
        
        result = self.service.reject_workorder(workorder.id, reason="材料不完整")
        
        assert result is not None
        self.mock_repository.update.assert_called_once()


class TestStateTransitionValidation:
    """
    状态转换验证测试套件
    
    验证状态机的合法性转换规则
    """

    def setup_method(self):
        """初始化状态机"""
        self.state_machine = ApprovalStateMachine()

    def test_draft_to_pending_submit(self):
        """
        [ATB-001] 草稿状态提交后变为待审批
        
        验证合法的状态转换：DRAFT → PENDING (submit 事件)
        """
        workorder = WorkOrder(
            id=uuid4(),
            title="Valid Title",
            description="Valid description",
            applicant_id=uuid4(),
            priority="MEDIUM",
            state=WorkOrderState.DRAFT
        )
        
        new_state = self.state_machine.transition(workorder, WorkOrderEvent.SUBMIT)
        
        assert new_state == WorkOrderState.PENDING

    def test_pending_to_approved(self):
        """
        [ATB-002] 待审批状态审批通过
        
        验证合法的状态转换：PENDING → APPROVED (approve 事件)
        """
        workorder = WorkOrder(
            id=uuid4(),
            title="Valid Title",
            description="Valid description",
            applicant_id=uuid4(),
            priority="MEDIUM",
            state=WorkOrderState.PENDING
        )
        
        new_state = self.state_machine.transition(workorder, WorkOrderEvent.APPROVE)
        
        assert new_state == WorkOrderState.APPROVED

    def test_pending_to_rejected(self):
        """
        [ATB-003] 待审批状态审批拒绝
        
        验证合法的状态转换：PENDING → REJECTED (reject 事件)
        """
        workorder = WorkOrder(
            id=uuid4(),
            title="Valid Title",
            description="Valid description",
            applicant_id=uuid4(),
            priority="MEDIUM",
            state=WorkOrderState.PENDING
        )
        
        new_state = self.state_machine.transition(workorder, WorkOrderEvent.REJECT)
        
        assert new_state == WorkOrderState.REJECTED

    def test_illegal_transition_raises(self):
        """
        [ATB-004] 非法状态转换抛出 InvalidTransitionError
        
        验证以下非法转换被正确拒绝：
        - DRAFT → APPROVED (跳过 PENDING)
        - APPROVED → any (终态不可逆)
        - REJECTED → any (终态不可逆)
        """
        workorder = WorkOrder(
            id=uuid4(),
            title="Valid Title",
            description="Valid description",
            applicant_id=uuid4(),
            priority="MEDIUM",
            state=WorkOrderState.DRAFT
        )
        
        with pytest.raises(InvalidTransitionError):
            self.state_machine.transition(workorder, WorkOrderEvent.APPROVE)

    def test_terminal_state_immutable(self):
        """
        [ATB-005] 终态（APPROVED/REJECTED）不可变更
        
        验证终态工单不能接受任何状态变更事件
        """
        for terminal_state in [WorkOrderState.APPROVED, WorkOrderState.REJECTED]:
            workorder = WorkOrder(
                id=uuid4(),
                title="Valid Title",
                description="Valid description",
                applicant_id=uuid4(),
                priority="MEDIUM",
                state=terminal_state
            )
            
            for event in WorkOrderEvent:
                with pytest.raises(InvalidTransitionError):
                    self.state_machine.transition(workorder, event)

    def test_submit_idempotent(self):
        """
        [ATB-006] 重复 submit 幂等
        
        对已处于 PENDING 状态的工单执行 submit 操作，
        应保持状态不变，不抛出异常
        """
        workorder = WorkOrder(
            id=uuid4(),
            title="Valid Title",
            description="Valid description",
            applicant_id=uuid4(),
            priority="MEDIUM",
            state=WorkOrderState.PENDING
        )
        
        result = self.state_machine.transition(workorder, WorkOrderEvent.SUBMIT)
        
        assert result == WorkOrderState.PENDING  # 状态保持


class TestAPISubmissionValidation:
    """
    API 层提交验证测试套件
    
    验证 REST API 端点的请求参数校验逻辑
    """

    @pytest.mark.asyncio
    async def test_submit_endpoint_validates_payload(self):
        """
        [ATB-010] API 端点验证必填字段
        
        POST /api/v1/workorders/{id}/submit 端点应验证工单字段完整性
        """
        mock_request = MagicMock()
        mock_request.state = MagicMock()
        mock_request.state.workorder = WorkOrder(
            id=uuid4(),
            title="",  # 缺失必填字段
            description="Test",
            applicant_id=uuid4(),
            priority="MEDIUM",
            state=WorkOrderState.DRAFT
        )
        
        with pytest.raises(ValidationError):
            await validate_workorder_submission(mock_request)


class TestCreateWorkorderInitialState:
    """
    工单创建初始状态测试套件
    """

    def test_create_workorder_initial_state(self):
        """
        [ATB-009] 创建工单初始状态为 DRAFT
        
        验证新创建的工单状态自动设置为 DRAFT
        """
        mock_repository = MagicMock()
        mock_publisher = MagicMock()
        service = WorkOrderService(
            repository=mock_repository,
            event_publisher=mock_publisher
        )
        
        mock_repository.create.return_value = WorkOrder(
            id=uuid4(),
            title="Test",
            description="Test description",
            applicant_id=uuid4(),
            priority="MEDIUM",
            state=WorkOrderState.DRAFT
        )
        
        workorder = service.create_workorder(
            title="Test",
            description="Test description",
            applicant_id=uuid4(),
            priority="MEDIUM"
        )
        
        assert workorder.state == WorkOrderState.DRAFT


# 辅助类和异常定义

class ValidationError(Exception):
    """字段校验异常"""
    pass


class InvalidTransitionError(Exception):
    """非法状态转换异常"""
    pass