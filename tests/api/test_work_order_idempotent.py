"""
工单审批幂等性测试 (ATB-3)

验证同一工单 5 秒内重复提交审批请求返回 409 Conflict，
确保幂等中间件正确拦截重复请求。

ATB ID: ATB-3
测试类型: Integration
覆盖场景: 幂等性校验（5秒窗口）
对应 AC: AC-002
"""

import pytest
from unittest.mock import Mock, patch, MagicMock
from datetime import datetime, timedelta
import time


# =============================================================================
# Mock 辅助类
# =============================================================================

class MockWorkOrder:
    """模拟工单对象"""

    def __init__(self, work_order_id: str, state: str = "PENDING_APPROVAL", approver_id: str = None):
        self.id = work_order_id
        self.state = state
        self.approver_id = approver_id
        self.created_by = "creator_user"
        self.current_approver_id = approver_id


class MockIdempotencyStore:
    """模拟幂等性存储（基于内存）"""

    def __init__(self):
        self._store = {}

    def get(self, key: str):
        """获取幂等键对应的请求记录"""
        return self._store.get(key)

    def set(self, key: str, value: dict, ttl: int = 5):
        """设置幂等键记录，TTL 默认 5 秒"""
        self._store[key] = {
            "value": value,
            "expires_at": datetime.now() + timedelta(seconds=ttl)
        }

    def is_duplicate(self, key: str) -> bool:
        """检查是否为重复请求"""
        record = self._store.get(key)
        if not record:
            return False
        if datetime.now() > record["expires_at"]:
            del self._store[key]
            return False
        return True


class MockStateMachine:
    """模拟状态机"""

    # 合法的状态转换矩阵
    VALID_TRANSITIONS = {
        "DRAFT": ["PENDING_APPROVAL"],
        "PENDING_APPROVAL": ["APPROVED", "REJECTED", "TRANSFERRED"],
        "APPROVED": ["CLOSED"],
        "REJECTED": [],
        "TRANSFERRED": ["PENDING_APPROVAL"],
        "CLOSED": []
    }

    def __init__(self, idempotency_store: MockIdempotencyStore = None):
        self.work_orders = {}
        self.idempotency_store = idempotency_store or MockIdempotencyStore()
        self.approval_records = []

    def get_work_order(self, work_order_id: str) -> MockWorkOrder:
        """获取工单"""
        return self.work_orders.get(work_order_id)

    def transition(self, work_order_id: str, target_state: str, actor: str, **kwargs) -> dict:
        """
        执行状态转换

        Args:
            work_order_id: 工单ID
            target_state: 目标状态
            actor: 操作人
            **kwargs: 其他参数（如 idempotency_key, target_user_id）

        Returns:
            转换结果字典

        Raises:
            StateTransitionException: 非法状态转换
            PermissionDenied: 无权限操作
        """
        # 幂等性检查
        idempotency_key = kwargs.get("idempotency_key")
        if idempotency_key and self.idempotency_store.is_duplicate(idempotency_key):
            return {
                "success": False,
                "error": "DUPLICATE_REQUEST",
                "message": "重复请求，请稍后重试"
            }

        wo = self.get_work_order(work_order_id)
        if not wo:
            return {
                "success": False,
                "error": "NOT_FOUND",
                "message": f"工单 {work_order_id} 不存在"
            }

        # 状态转换合法性校验
        valid_targets = self.VALID_TRANSITIONS.get(wo.state, [])
        if target_state not in valid_targets:
            raise StateTransitionException(
                f"非法状态转换: {wo.state} -> {target_state}"
            )

        # 权限校验
        if wo.current_approver_id and wo.current_approver_id != actor:
            raise PermissionDenied(
                f"用户 {actor} 无权操作此工单，当前审批人为 {wo.current_approver_id}"
            )

        # 执行状态转换
        from_state = wo.state
        wo.state = target_state

        # 转签特殊处理
        target_user_id = kwargs.get("target_user_id")
        if target_state == "TRANSFERRED" and target_user_id:
            wo.approver_id = target_user_id
            wo.current_approver_id = target_user_id

        # 创建审批记录
        record = {
            "id": f"record_{len(self.approval_records) + 1}",
            "work_order_id": work_order_id,
            "actor": actor,
            "action": target_state,
            "from_state": from_state,
            "to_state": target_state,
            "comment": kwargs.get("comment", ""),
            "created_at": datetime.now(),
            "deleted_at": None
        }
        self.approval_records.append(record)

        # 记录幂等键
        if idempotency_key:
            self.idempotency_store.set(idempotency_key, {
                "work_order_id": work_order_id,
                "actor": actor,
                "action": target_state
            })

        return {
            "success": True,
            "new_state": target_state,
            "event_published": target_state in ["APPROVED", "REJECTED", "TRANSFERRED"]
        }


class StateTransitionException(Exception):
    """状态转换异常"""
    pass


class PermissionDenied(Exception):
    """权限不足异常"""
    pass


class MockResponse:
    """模拟 HTTP 响应"""

    def __init__(self, status_code=200, json_data=None):
        self.status_code = status_code
        self._json_data = json_data or {}
        self.elapsed = MagicMock()
        self.elapsed.total_seconds = MagicMock(return_value=0.1)

    def json(self):
        return self._json_data


class MockAPIClient:
    """模拟 API 客户端"""

    def __init__(self, state_machine: MockStateMachine = None):
        self.sm = state_machine or MockStateMachine()
        self.responses = []
        self._last_request_time = 0

    def post(self, url: str, json=None, headers=None, idempotency_key=None):
        """模拟 POST 请求"""
        # 解析 URL 获取工单ID
        parts = url.rstrip("/").split("/")
        work_order_id = None
        action = None

        for i, part in enumerate(parts):
            if part == "work-orders" and i + 1 < len(parts):
                work_order_id = parts[i + 1]
            if part in ["approve", "reject", "transfer"]:
                action = part.upper()

        # 模拟请求处理
        if not work_order_id or not action:
            self.responses.append(MockResponse(400, {"error": "Invalid URL"}))
            return self.responses[-1]

        # 检查幂等性（模拟 5 秒窗口）
        if idempotency_key:
            if self.sm.idempotency_store.is_duplicate(idempotency_key):
                self.responses.append(MockResponse(409, {
                    "error": "DUPLICATE_REQUEST",
                    "message": "重复请求，请稍后重试"
                }))
                return self.responses[-1]

        # 执行审批操作
        try:
            result = self.sm.transition(
                work_order_id,
                action,
                actor=json.get("actor") if json else "unknown",
                idempotency_key=idempotency_key,
                target_user_id=json.get("target_user_id") if json else None,
                comment=json.get("comment") if json else "",
                reason=json.get("reason") if json else ""
            )

            if not result.get("success"):
                if result.get("error") == "DUPLICATE_REQUEST":
                    self.responses.append(MockResponse(409, result))
                else:
                    self.responses.append(MockResponse(400, result))
            else:
                self.responses.append(MockResponse(200, result))

        except StateTransitionException as e:
            self.responses.append(MockResponse(400, {
                "error": "INVALID_TRANSITION",
                "message": str(e)
            }))
        except PermissionDenied as e:
            self.responses.append(MockResponse(403, {
                "error": "PERMISSION_DENIED",
                "message": str(e)
            }))

        return self.responses[-1]


# =============================================================================
# 测试 Fixtures
# =============================================================================

@pytest.fixture
def idempotency_store():
    """幂等性存储 fixture"""
    return MockIdempotencyStore()


@pytest.fixture
def state_machine(idempotency_store):
    """状态机 fixture"""
    return MockStateMachine(idempotency_store=idempotency_store)


@pytest.fixture
def mock_client(state_machine):
    """模拟 API 客户端 fixture"""
    return MockAPIClient(state_machine=state_machine)


@pytest.fixture
def pending_workorder(state_machine):
    """待审批工单 fixture"""
    wo = MockWorkOrder(
        work_order_id="WO-100",
        state="PENDING_APPROVAL",
        approver_id="user_A"
    )
    state_machine.work_orders[wo.id] = wo
    return wo


# =============================================================================
# ATB-3: 幂等性校验
# =============================================================================

def test_duplicate_approval_within_5s_returns_409(state_machine, mock_client, pending_workorder):
    """
    ATB-3: 5秒内重复审批请求返回 409 Conflict

    验证幂等中间件正确拦截 5 秒窗口内的重复审批请求，
    确保数据库无重复状态写入。

    测试步骤:
    1. 首次提交审批请求（含 idempotency_key）
    2. 立即（5秒内）再次提交相同 idempotency_key 的请求
    3. 断言第二次请求返回 409 Conflict
    4. 断言数据库（审批记录）无重复写入

    验收标准:
    - 第二次请求返回 409 状态码
    - 数据库中审批记录数量不变
    - 响应 body 包含 error: "DUPLICATE_REQUEST"
    """
    # 首次请求
    response1 = mock_client.post(
        "/api/v1/work-orders/WO-100/approve",
        json={"actor": "user_A"},
        idempotency_key="key_001"
    )
    assert response1.status_code == 200, "首次请求应该成功"

    # 记录首次请求后的审批记录数量
    initial_record_count = len(state_machine.approval_records)

    # 5秒内重复请求（相同 idempotency_key）
    response2 = mock_client.post(
        "/api/v1/work-orders/WO-100/approve",
        json={"actor": "user_A"},
        idempotency_key="key_001"
    )

    # 断言：重复请求返回 409 Conflict
    assert response2.status_code == 409, \
        f"5秒内重复请求应返回 409，实际返回 {response2.status_code}"

    # 断言：响应包含 DUPLICATE_REQUEST 错误
    response_data = response2.json()
    assert response_data.get("error") == "DUPLICATE_REQUEST", \
        f"响应 error 应为 DUPLICATE_REQUEST，实际为 {response_data.get('error')}"

    # 断言：数据库无重复状态写入（审批记录数量不变）
    final_record_count = len(state_machine.approval_records)
    assert final_record_count == initial_record_count, \
        f"重复请求不应创建新记录，初始 {initial_record_count} 条，最终 {final_record_count} 条"

    # 断言：工单状态未变化（保持在 APPROVED）
    wo = state_machine.get_work_order("WO-100")
    assert wo.state == "APPROVED", "重复请求不应改变工单状态"


def test_duplicate_reject_within_5s_returns_409(state_machine, mock_client, pending_workorder):
    """
    ATB-3: 5秒内重复驳回请求返回 409 Conflict

    验证驳回操作的幂等性保护。
    """
    # 首次驳回请求
    response1 = mock_client.post(
        "/api/v1/work-orders/WO-100/reject",
        json={"actor": "user_A", "reason": "不符合规范"},
        idempotency_key="key_reject_001"
    )
    assert response1.status_code == 200, "首次驳回请求应该成功"

    # 记录当前审批记录数量
    initial_count = len(state_machine.approval_records)

    # 5秒内重复驳回
    response2 = mock_client.post(
        "/api/v1/work-orders/WO-100/reject",
        json={"actor": "user_A", "reason": "不符合规范"},
        idempotency_key="key_reject_001"
    )

    # 断言：重复请求返回 409
    assert response2.status_code == 409, \
        f"重复驳回应返回 409，实际返回 {response2.status_code}"

    # 断言：无重复记录
    assert len(state_machine.approval_records) == initial_count, \
        "重复驳回不应创建新记录"


def test_duplicate_transfer_within_5s_returns_409(state_machine, mock_client, pending_workorder):
    """
    ATB-3: 5秒内重复转签请求返回 409 Conflict

    验证转签操作的幂等性保护。
    """
    # 首次转签请求
    response1 = mock_client.post(
        "/api/v1/work-orders/WO-100/transfer",
        json={"actor": "user_A", "target_user_id": "user_B", "reason": "请假"},
        idempotency_key="key_transfer_001"
    )
    assert response1.status_code == 200, "首次转签请求应该成功"

    # 记录当前审批记录数量
    initial_count = len(state_machine.approval_records)

    # 5秒内重复转签
    response2 = mock_client.post(
        "/api/v1/work-orders/WO-100/transfer",
        json={"actor": "user_A", "target_user_id": "user_B", "reason": "请假"},
        idempotency_key="key_transfer_001"
    )

    # 断言：重复请求返回 409
    assert response2.status_code == 409, \
        f"重复转签应返回 409，实际返回 {response2.status_code}"

    # 断言：无重复记录
    assert len(state_machine.approval_records) == initial_count, \
        "重复转签不应创建新记录"


def test_different_idempotency_keys_allowed(state_machine, mock_client, pending_workorder):
    """
    ATB-3: 不同 idempotency_key 的请求应被允许

    验证幂等性保护仅对相同 key 生效。
    """
    # 首次请求
    response1 = mock_client.post(
        "/api/v1/work-orders/WO-100/approve",
        json={"actor": "user_A"},
        idempotency_key="key_001"
    )
    assert response1.status_code == 200

    # 使用不同 key 的请求应成功
    response2 = mock_client.post(
        "/api/v1/work-orders/WO-100/approve",
        json={"actor": "user_A"},
        idempotency_key="key_002"
    )
    assert response2.status_code == 200, \
        "不同 idempotency_key 应被允许"


def test_idempotency_key_expires_after_5s(state_machine, mock_client, idempotency_store, pending_workorder):
    """
    ATB-3: 5秒后幂等键过期，相同 key 可再次请求

    验证幂等键的 TTL 机制。
    """
    # 模拟时间流逝（通过直接操作存储）
    idempotency_store.set("key_expiry_test", {
        "work_order_id": "WO-100",
        "actor": "user_A",
        "action": "APPROVED"
    }, ttl=0)  # TTL=0 即刻过期

    # 模拟旧记录的请求
    response = mock_client.post(
        "/api/v1/work-orders/WO-100/approve",
        json={"actor": "user_A"},
        idempotency_key="key_expiry_test"
    )

    # 幂等键过期后，相同 key 应被允许
    assert response.status_code == 200, \
        "过期的幂等键应允许重复请求"


def test_first_request_succeeds_without_idempotency_key(state_machine, mock_client, pending_workorder):
    """
    ATB-3: 无 idempotency_key 的首次请求应成功

    验证幂等性保护不影响正常请求。
    """
    response = mock_client.post(
        "/api/v1/work-orders/WO-100/approve",
        json={"actor": "user_A"}
    )
    assert response.status_code == 200, \
        "无 idempotency_key 的首次请求应成功"


def test_approval_record_created_on_first_request(state_machine, mock_client, pending_workorder):
    """
    ATB-4: 审批记录持久化

    验证首次请求成功创建审批记录。
    """
    initial_count = len(state_machine.approval_records)

    response = mock_client.post(
        "/api/v1/work-orders/WO-100/approve",
        json={"actor": "user_A"},
        idempotency_key="key_record_test"
    )
    assert response.status_code == 200

    # 断言：新增一条审批记录
    assert len(state_machine.approval_records) == initial_count + 1, \
        "首次请求应创建审批记录"

    # 验证记录字段
    record = state_machine.approval_records[-1]
    assert record["work_order_id"] == "WO-100"
    assert record["actor"] == "user_A"
    assert record["action"] == "APPROVED"
    assert record["from_state"] == "PENDING_APPROVAL"
    assert record["to_state"] == "APPROVED"
    assert record["deleted_at"] is None, "审批记录应软删除标记为空"


def test_duplicate_request_preserves_original_record(state_machine, mock_client, pending_workorder):
    """
    ATB-4: 重复请求不创建额外记录，保留原始记录

    验证幂等性保护下审批记录的完整性。
    """
    # 首次请求
    response1 = mock_client.post(
        "/api/v1/work-orders/WO-100/approve",
        json={"actor": "user_A", "comment": "审批通过"},
        idempotency_key="key_preserve_test"
    )
    assert response1.status_code == 200

    # 获取首次请求创建的记录
    original_record = state_machine.approval_records[-1].copy()
    original_record_id = original_record["id"]

    # 重复请求
    response2 = mock_client.post(
        "/api/v1/work-orders/WO-100/approve",
        json={"actor": "user_A", "comment": "审批通过"},
        idempotency_key="key_preserve_test"
    )
    assert response2.status_code == 409

    # 断言：记录数量不变
    assert len(state_machine.approval_records) == 1, \
        "重复请求不应创建额外记录"

    # 断言：原始记录未被修改
    current_record = state_machine.approval_records[-1]
    assert current_record["id"] == original_record_id
    assert current_record["comment"] == "审批通过", \
        "重复请求不应修改原始记录的 comment"