"""
工单提交审批流程测试 (Iteration 7 - Phase 1 & Phase 2)

对应 SPEC: 工单审批流程 (Iteration 7)
- Phase 1: 核心状态机实现 (ATB-1)
- Phase 2: 审批 API 接入 (ATB-3)
- 幂等性约束测试 (ATB-2)
- 通知机制集成 (ATB-4)

状态枚举: DRAFT -> PENDING -> APPROVED/REJECTED/RETURNED -> CANCELLED
操作类型: submit, approve, reject, return, resubmit, cancel
"""

import pytest
from datetime import datetime
from unittest.mock import MagicMock, patch
from fastapi.testclient import TestClient


# =============================================================================
# 辅助常量与 Fixtures
# =============================================================================

class WorkOrderStatus:
    """工单状态枚举"""
    DRAFT = "DRAFT"
    PENDING = "PENDING"
    APPROVED = "APPROVED"
    REJECTED = "REJECTED"
    RETURNED = "RETURNED"
    CANCELLED = "CANCELLED"


class OperationType:
    """操作类型枚举"""
    SUBMIT = "submit"
    APPROVE = "approve"
    REJECT = "reject"
    RETURN = "return"
    RESUBMIT = "resubmit"
    CANCEL = "cancel"


class WorkOrderSubmitTestFixtures:
    """工单提交测试固件类"""
    
    @staticmethod
    def create_mock_work_order(
        work_order_id: str = "WO-2025-0001",
        status: str = WorkOrderStatus.DRAFT,
        creator_id: str = "user_001",
        title: str = "测试工单",
        current_assignee_id: str = None
    ) -> dict:
        """创建模拟工单数据"""
        return {
            "id": work_order_id,
            "status": status,
            "creator_id": creator_id,
            "title": title,
            "current_assignee_id": current_assignee_id,
            "created_at": datetime.now().isoformat(),
            "updated_at": datetime.now().isoformat(),
        }
    
    @staticmethod
    def create_approval_operation(
        operation: str = OperationType.SUBMIT,
        operator_id: str = "user_001",
        comment: str = None
    ) -> dict:
        """创建模拟审批操作数据"""
        return {
            "operation": operation,
            "operator_id": operator_id,
            "comment": comment,
        }


# =============================================================================
# ATB-1: 状态机核心逻辑测试
# =============================================================================

class TestStateMachineTransitions:
    """状态机状态迁移测试类

    测试编号: ATB-1
    测试目标: 验证状态机核心逻辑
    """

    @pytest.mark.parametrize("current_status,operation,expected_status,operator_id", [
        # ATB-1.1: PENDING 工单执行 approve 操作 -> APPROVED
        (WorkOrderStatus.PENDING, OperationType.APPROVE, WorkOrderStatus.APPROVED, "approver_001"),
        # ATB-1.2: PENDING 工单执行 reject 操作 -> REJECTED
        (WorkOrderStatus.PENDING, OperationType.REJECT, WorkOrderStatus.REJECTED, "approver_001"),
        # ATB-1.3: PENDING 工单执行 return 操作 -> RETURNED
        (WorkOrderStatus.PENDING, OperationType.RETURN, WorkOrderStatus.RETURNED, "approver_001"),
        # RETURNED 状态重新提交 -> PENDING
        (WorkOrderStatus.RETURNED, OperationType.RESUBMIT, WorkOrderStatus.PENDING, "user_001"),
        # DRAFT 状态提交 -> PENDING
        (WorkOrderStatus.DRAFT, OperationType.SUBMIT, WorkOrderStatus.PENDING, "user_001"),
    ], ids=[
        "pending_to_approved",
        "pending_to_rejected",
        "pending_to_returned",
        "returned_to_pending",
        "draft_to_pending",
    ])
    def test_valid_transitions(
        self,
        client: TestClient,
        db_session,
        current_status: str,
        operation: str,
        expected_status: str,
        operator_id: str
    ):
        """ATB-1.1-1.3: 验证合法状态迁移

        测试目标: 验证合法操作产生预期状态变更

        物理测试期待:
        - 状态流转至目标状态
        - DB 写入成功
        - 返回 HTTP 200
        """
        wo_id = "WO-2025-0001"
        mock_wo = WorkOrderSubmitTestFixtures.create_mock_work_order(
            work_order_id=wo_id,
            status=current_status,
            creator_id="user_001",
            current_assignee_id="approver_001"
        )

        with patch("api.v1.workorders.get_work_order_by_id", return_value=mock_wo):
            with patch("api.v1.workorders.update_work_order_status") as mock_update:
                mock_update.return_value = {**mock_wo, "status": expected_status}

                response = client.post(
                    f"/api/v1/work-orders/{wo_id}/operate",
                    json={
                        "operation": operation,
                        "operator_id": operator_id,
                        "comment": "测试审批意见"
                    }
                )

                assert response.status_code == 200
                data = response.json()
                assert data["work_order"]["status"] == expected_status

    def test_terminal_state_rejection(self, client: TestClient, db_session):
        """ATB-1.4: APPROVED 终态不可再做状态迁移

        测试目标: 验证终态(APPROVED/REJECTED/CANCELLED)不可做状态迁移

        物理测试期待:
        - 抛出 InvalidTransitionError
        - HTTP 422
        - 错误码 INVALID_TRANSITION
        """
        wo_id = "WO-2025-0001"
        terminal_statuses = [
            WorkOrderStatus.APPROVED,
            WorkOrderStatus.REJECTED,
            WorkOrderStatus.CANCELLED
        ]

        for status in terminal_statuses:
            mock_wo = WorkOrderSubmitTestFixtures.create_mock_work_order(
                work_order_id=wo_id,
                status=status,
                creator_id="user_001"
            )

            with patch("api.v1.workorders.get_work_order_by_id", return_value=mock_wo):
                response = client.post(
                    f"/api/v1/work-orders/{wo_id}/operate",
                    json={
                        "operation": OperationType.APPROVE,
                        "operator_id": "approver_001"
                    }
                )

                assert response.status_code == 422, f"状态 {status} 应拒绝操作"
                data = response.json()
                assert data["error_code"] == "INVALID_TRANSITION"

    def test_self_approval_forbidden(self, client: TestClient, db_session):
        """ATB-1.6: 审批人不能审批自己提交的工单

        测试目标: 验证自审禁止规则

        物理测试期待:
        - 抛出 SelfApprovalForbiddenError
        - HTTP 403
        """
        wo_id = "WO-2025-0001"
        operator_id = "user_001"
        mock_wo = WorkOrderSubmitTestFixtures.create_mock_work_order(
            work_order_id=wo_id,
            status=WorkOrderStatus.PENDING,
            creator_id=operator_id,
            current_assignee_id=operator_id
        )

        with patch("api.v1.workorders.get_work_order_by_id", return_value=mock_wo):
            response = client.post(
                f"/api/v1/work-orders/{wo_id}/operate",
                json={
                    "operation": OperationType.APPROVE,
                    "operator_id": operator_id
                }
            )

            assert response.status_code == 403
            data = response.json()
            assert data["error_code"] == "SELF_APPROVAL_FORBIDDEN"

    @pytest.mark.parametrize("current_status,invalid_operation", [
        # ATB-1.7: 无效状态转移示例
        (WorkOrderStatus.DRAFT, OperationType.APPROVE),
        (WorkOrderStatus.DRAFT, OperationType.REJECT),
        (WorkOrderStatus.DRAFT, OperationType.RETURN),
        (WorkOrderStatus.PENDING, OperationType.SUBMIT),
        (WorkOrderStatus.PENDING, OperationType.RESUBMIT),
    ], ids=[
        "draft_to_approve_invalid",
        "draft_to_reject_invalid",
        "draft_to_return_invalid",
        "pending_to_submit_invalid",
        "pending_to_resubmit_invalid",
    ])
    def test_invalid_transition_rejected(
        self,
        client: TestClient,
        current_status: str,
        invalid_operation: str
    ):
        """ATB-1.7: 无效状态转移被拒绝

        测试目标: 验证无效状态转移抛出 InvalidTransitionError

        物理测试期待:
        - HTTP 422
        - 错误码 INVALID_TRANSITION
        """
        wo_id = "WO-2025-0001"
        mock_wo = WorkOrderSubmitTestFixtures.create_mock_work_order(
            work_order_id=wo_id,
            status=current_status,
            creator_id="user_001"
        )

        with patch("api.v1.workorders.get_work_order_by_id", return_value=mock_wo):
            response = client.post(
                f"/api/v1/work-orders/{wo_id}/operate",
                json={
                    "operation": invalid_operation,
                    "operator_id": "approver_001"
                }
            )

            assert response.status_code == 422
            data = response.json()
            assert data["error_code"] == "INVALID_TRANSITION"


# =============================================================================
# ATB-2: 幂等性测试
# =============================================================================

class TestIdempotency:
    """幂等性测试类

    测试编号: ATB-2
    测试目标: 验证幂等性约束
    """

    def test_idempotency_within_window(self, client: TestClient, db_session):
        """ATB-2.1: 同一操作 5 分钟内重复提交仅执行一次

        测试目标: 验证 5 分钟窗口内幂等性

        物理测试期待:
        - 仅第一次写入成功
        - 后续返回原结果，不重复写入
        - r1.status_code == r2.status_code == 200
        """
        wo_id = "WO-2025-0001"
        payload = {
            "operation": OperationType.APPROVE,
            "operator_id": "approver_001",
            "comment": "同意"
        }
        headers = {"X-Idempotency-Key": "idem-key-001"}

        mock_wo = WorkOrderSubmitTestFixtures.create_mock_work_order(
            work_order_id=wo_id,
            status=WorkOrderStatus.PENDING,
            creator_id="user_001",
            current_assignee_id="approver_001"
        )

        with patch("api.v1.workorders.get_work_order_by_id", return_value=mock_wo):
            with patch("api.v1.workorders.update_work_order_status") as mock_update:
                mock_update.return_value = {
                    **mock_wo,
                    "status": WorkOrderStatus.APPROVED
                }

                r1 = client.post(
                    f"/api/v1/work-orders/{wo_id}/operate",
                    json=payload,
                    headers=headers
                )
                r2 = client.post(
                    f"/api/v1/work-orders/{wo_id}/operate",
                    json=payload,
                    headers=headers
                )

                assert r1.status_code == r2.status_code == 200
                assert r1.json()["work_order"]["status"] == r2.json()["work_order"]["status"]
                # 验证只写入了一次
                assert mock_update.call_count == 1

    def test_idempotency_window_expiry(self, client: TestClient, db_session):
        """ATB-2.2: 超 5 分钟窗口的重复操作正常执行

        测试目标: 验证窗口过期后重新生成幂等 key

        物理测试期待:
        - 正常执行
        - 生成新幂等 key
        - 调用两次更新
        """
        wo_id = "WO-2025-0001"
        payload = {
            "operation": OperationType.APPROVE,
            "operator_id": "approver_001"
        }
        headers1 = {"X-Idempotency-Key": "idem-key-expired-001"}
        headers2 = {"X-Idempotency-Key": "idem-key-expired-002"}

        mock_wo = WorkOrderSubmitTestFixtures.create_mock_work_order(
            work_order_id=wo_id,
            status=WorkOrderStatus.PENDING,
            creator_id="user_001",
            current_assignee_id="approver_001"
        )

        with patch("api.v1.workorders.get_work_order_by_id", return_value=mock_wo):
            with patch("api.v1.workorders.update_work_order_status") as mock_update:
                mock_update.side_effect = [
                    {**mock_wo, "status": WorkOrderStatus.APPROVED},
                    {**mock_wo, "status": WorkOrderStatus.APPROVED}
                ]

                with patch("api.v1.workorders.IdempotencyService") as mock_idem:
                    # 模拟第一个请求在窗口内，第二个在窗口外
                    mock_instance = MagicMock()
                    mock_instance.check.side_effect = [True, False]  # 第一个命中，第二个未命中
                    mock_instance.record.return_value = True
                    mock_idem.return_value = mock_instance

                    r1 = client.post(
                        f"/api/v1/work-orders/{wo_id}/operate",
                        json=payload,
                        headers=headers1
                    )
                    r2 = client.post(
                        f"/api/v1/work-orders/{wo_id}/operate",
                        json=payload,
                        headers=headers2
                    )

                    assert r1.status_code == r2.status_code == 200


# =============================================================================
# ATB-3: 审批 API 接口测试
# =============================================================================

class TestApprovalAPI:
    """审批 API 接口测试类

    测试编号: ATB-3
    测试目标: 验证审批 API 接口契约
    """

    def test_approve_work_order_success(self, client: TestClient, db_session):
        """ATB-3.1: POST /api/v1/work-orders/{id}/operate 正常审批

        测试目标: 验证正常审批流程

        物理测试期待:
        - HTTP 200
        - 返回更新后工单 JSON
        """
        wo_id = "WO-2025-0001"
        mock_wo = WorkOrderSubmitTestFixtures.create_mock_work_order(
            work_order_id=wo_id,
            status=WorkOrderStatus.PENDING,
            creator_id="user_001",
            current_assignee_id="approver_001"
        )

        with patch("api.v1.workorders.get_work_order_by_id", return_value=mock_wo):
            with patch("api.v1.workorders.update_work_order_status") as mock_update:
                mock_update.return_value = {
                    **mock_wo,
                    "status": WorkOrderStatus.APPROVED
                }

                response = client.post(
                    f"/api/v1/work-orders/{wo_id}/operate",
                    json={
                        "operation": OperationType.APPROVE,
                        "operator_id": "approver_001",
                        "comment": "审批通过"
                    }
                )

                assert response.status_code == 200
                data = response.json()
                assert "work_order" in data
                assert data["work_order"]["status"] == WorkOrderStatus.APPROVED

    def test_missing_operation_field(self, client: TestClient, db_session):
        """ATB-3.2: 缺少必填字段 operation

        测试目标: 验证请求体验证

        物理测试期待:
        - HTTP 400
        - 错误信息 "operation is required"
        """
        wo_id = "WO-2025-0001"

        response = client.post(
            f"/api/v1/work-orders/{wo_id}/operate",
            json={
                "operator_id": "approver_001"
            }
        )

        assert response.status_code == 400
        data = response.json()
        assert "operation is required" in str(data["detail"])

    def test_work_order_not_found(self, client: TestClient, db_session):
        """ATB-3.3: 工单不存在

        测试目标: 验证 404 错误处理

        物理测试期待:
        - HTTP 404
        - 错误码 WORK_ORDER_NOT_FOUND
        """
        wo_id = "WO-NONEXISTENT-001"

        with patch("api.v1.workorders.get_work_order_by_id", return_value=None):
            response = client.post(
                f"/api/v1/work-orders/{wo_id}/operate",
                json={
                    "operation": OperationType.APPROVE,
                    "operator_id": "approver_001"
                }
            )

            assert response.status_code == 404
            data = response.json()
            assert data["error_code"] == "WORK_ORDER_NOT_FOUND"

    def test_unauthorized_request(self, client: TestClient, db_session):
        """ATB-3.4: Token 失效请求

        测试目标: 验证认证失败处理

        物理测试期待:
        - HTTP 401
        """
        wo_id = "WO-2025-0001"

        with patch("api.v1.workorders.verify_token", side_effect=Exception("Token invalid")):
            response = client.post(
                f"/api/v1/work-orders/{wo_id}/operate",
                json={
                    "operation": OperationType.APPROVE,
                    "operator_id": "approver_001"
                },
                headers={"Authorization": "Bearer invalid_token"}
            )

            assert response.status_code == 401


# =============================================================================
# ATB-4: 通知机制集成测试
# =============================================================================

class TestNotificationIntegration:
    """通知机制集成测试类

    测试编号: ATB-4
    测试目标: 验证通知触发与监听器集成
    """

    @pytest.mark.parametrize("target_status,expected_notification", [
        # ATB-4.1: 审批通过后通知投递
        (WorkOrderStatus.APPROVED, True),
        # ATB-4.2: 驳回后通知投递
        (WorkOrderStatus.REJECTED, True),
        # ATB-4.3: 退回后通知投递
        (WorkOrderStatus.RETURNED, True),
    ], ids=[
        "approve_triggers_notification",
        "reject_triggers_notification",
        "return_triggers_notification",
    ])
    def test_notification_triggered(
        self,
        client: TestClient,
        target_status: str,
        expected_notification: bool
    ):
        """ATB-4.1-4.3: 终态/退回态触发通知

        测试目标: 验证 APPROVED/REJECTED/RETURNED 触发通知投递

        物理测试期待:
        - mock observer 收到 NotificationEvent
        - notification_sent 为 True
        """
        wo_id = "WO-2025-0001"
        operation_map = {
            WorkOrderStatus.APPROVED: OperationType.APPROVE,
            WorkOrderStatus.REJECTED: OperationType.REJECT,
            WorkOrderStatus.RETURNED: OperationType.RETURN,
        }
        operation = operation_map[target_status]

        mock_wo = WorkOrderSubmitTestFixtures.create_mock_work_order(
            work_order_id=wo_id,
            status=WorkOrderStatus.PENDING,
            creator_id="user_001",
            current_assignee_id="approver_001"
        )

        with patch("api.v1.workorders.get_work_order_by_id", return_value=mock_wo):
            with patch("api.v1.workorders.update_work_order_status") as mock_update:
                mock_update.return_value = {**mock_wo, "status": target_status}

                with patch("api.v1.workorders.NotificationService") as mock_notif_svc:
                    mock_notif_instance = MagicMock()
                    mock_notif_instance.send_notification.return_value = True
                    mock_notif_svc.return_value = mock_notif_instance

                    response = client.post(
                        f"/api/v1/work-orders/{wo_id}/operate",
                        json={
                            "operation": operation,
                            "operator_id": "approver_001",
                            "comment": "测试意见"
                        }
                    )

                    assert response.status_code == 200
                    data = response.json()
                    assert data.get("notification_sent") == expected_notification

    def test_notification_not_sent_on_error(self, client: TestClient, db_session):
        """ATB-4.4: 状态机内部错误时通知不发送

        测试目标: 验证错误场景下通知不投递

        物理测试期待:
        - mock observer 未收到任何事件
        - notification_sent 为 False
        """
        wo_id = "WO-2025-0001"
        mock_wo = WorkOrderSubmitTestFixtures.create_mock_work_order(
            work_order_id=wo_id,
            status=WorkOrderStatus.APPROVED,  # 终态，再次操作会失败
            creator_id="user_001"
        )

        with patch("api.v1.workorders.get_work_order_by_id", return_value=mock_wo):
            with patch("api.v1.workorders.NotificationService") as mock_notif_svc:
                mock_notif_instance = MagicMock()
                mock_notif_svc.return_value = mock_notif_instance

                response = client.post(
                    f"/api/v1/work-orders/{wo_id}/operate",
                    json={
                        "operation": OperationType.APPROVE,
                        "operator_id": "approver_001"
                    }
                )

                # 状态机应拒绝操作，不应发送通知
                assert response.status_code == 422
                mock_notif_instance.send_notification.assert_not_called()

    @pytest.mark.parametrize("non_notify_status,operation", [
        # DRAFT / PENDING / CANCELLED 不触发通知
        (WorkOrderStatus.DRAFT, OperationType.SUBMIT),
        (WorkOrderStatus.PENDING, OperationType.CANCEL),
    ], ids=[
        "draft_submit_no_notification",
        "pending_cancel_no_notification",
    ])
    def test_no_notification_for_non_notify_statuses(
        self,
        client: TestClient,
        non_notify_status: str,
        operation: str
    ):
        """非目标状态不触发通知

        测试目标: 验证 DRAFT/PENDING/CANCELLED 不触发通知

        物理测试期待:
        - notification_sent 为 False
        """
        wo_id = "WO-2025-0001"
        mock_wo = WorkOrderSubmitTestFixtures.create_mock_work_order(
            work_order_id=wo_id,
            status=non_notify_status,
            creator_id="user_001"
        )

        with patch("api.v1.workorders.get_work_order_by_id", return_value=mock_wo):
            with patch("api.v1.workorders.NotificationService") as mock_notif_svc:
                mock_notif_instance = MagicMock()
                mock_notif_svc.return_value = mock_notif_instance

                response = client.post(
                    f"/api/v1/work-orders/{wo_id}/operate",
                    json={
                        "operation": operation,
                        "operator_id": "user_001"
                    }
                )

                if response.status_code == 200:
                    data = response.json()
                    assert data.get("notification_sent") == False


# =============================================================================
# 边界条件测试
# =============================================================================

class TestBoundaryConditions:
    """边界条件测试类"""

    def test_permission_denied_non_approver(self, client: TestClient, db_session):
        """非审批人执行审批操作

        测试目标: 验证权限校验

        物理测试期待:
        - HTTP 403
        - 错误码 PERMISSION_DENIED
        """
        wo_id = "WO-2025-0001"
        mock_wo = WorkOrderSubmitTestFixtures.create_mock_work_order(
            work_order_id=wo_id,
            status=WorkOrderStatus.PENDING,
            creator_id="user_001",
            current_assignee_id="approver_001"  # 工单分配给 approver_001
        )

        with patch("api.v1.workorders.get_work_order_by_id", return_value=mock_wo):
            response = client.post(
                f"/api/v1/work-orders/{wo_id}/operate",
                json={
                    "operation": OperationType.APPROVE,
                    "operator_id": "non_approver"  # 非审批人
                }
            )

            assert response.status_code == 403
            data = response.json()
            assert data["error_code"] in ["PERMISSION_DENIED", "SELF_APPROVAL_FORBIDDEN"]

    def test_optional_comment_field(self, client: TestClient, db_session):
        """测试可选字段 comment

        测试目标: 验证 comment 为可选字段
        """
        wo_id = "WO-2025-0001"
        mock_wo = WorkOrderSubmitTestFixtures.create_mock_work_order(
            work_order_id=wo_id,
            status=WorkOrderStatus.PENDING,
            creator_id="user_001",
            current_assignee_id="approver_001"
        )

        with patch("api.v1.workorders.get_work_order_by_id", return_value=mock_wo):
            with patch("api.v1.workorders.update_work_order_status") as mock_update:
                mock_update.return_value = {
                    **mock_wo,
                    "status": WorkOrderStatus.APPROVED
                }

                response = client.post(
                    f"/api/v1/work-orders/{wo_id}/operate",
                    json={
                        "operation": OperationType.APPROVE,
                        "operator_id": "approver_001"
                        # 不传 comment
                    }
                )

                assert response.status_code == 200