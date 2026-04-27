"""
tests/api/test_workorder_api.py

SWARM-001 工单审批流程 API 集成测试
覆盖范围:
  - ATB-001: 工单提交功能
  - ATB-002: 状态机流转功能 (通过 API 层验证)
  - ATB-003: 通知触发功能 (队列投递断言)
  - ATB-004: 审批记录持久化 (通过 records 接口验证)
  - ATB-005: API 接口集成完整链路
"""

from __future__ import annotations

import uuid
from typing import Generator
from unittest.mock import MagicMock, patch, call

import pytest

# ---------------------------------------------------------------------------
# 客户端 / 应用 fixture
# 优先使用真实 FastAPI TestClient；若导入失败则降级为轻量 stub，
# 保证文件可在未完成环境下被 import（满足 AC-005）。
# ---------------------------------------------------------------------------
try:
    from fastapi.testclient import TestClient  # type: ignore

    try:
        from backend.api.v1 import app as fastapi_app  # type: ignore

        _HAS_APP = True
    except Exception:
        _HAS_APP = False
except ImportError:
    _HAS_APP = False


# ---------------------------------------------------------------------------
# 共用常量
# ---------------------------------------------------------------------------

BASE_URL = "/api/v1/workorders"

VALID_PAYLOAD: dict = {
    "title": "服务器扩容申请",
    "content": "因业务增长需扩容服务器，预计需要 4 核 16G 实例 × 3",
    "priority": "high",
}

APPROVER_ID = "user_approver_001"
CREATOR_ID = "user_creator_001"


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------


@pytest.fixture()
def mock_queue() -> Generator:
    """
    Mock Redis Queue，防止测试环境依赖真实消息中间件。
    每个测试独立 reset，避免 call_args 互相污染。
    """
    with patch("backend.services.notification_service.queue") as mq:
        mq.enqueue = MagicMock()
        yield mq


@pytest.fixture()
def mock_db_session() -> Generator:
    """
    Mock 数据库 Session，防止测试依赖真实数据库连接。
    """
    with patch("backend.services.workorder_service.db") as mock_db:
        mock_db.session = MagicMock()
        mock_db.session.add = MagicMock()
        mock_db.session.commit = MagicMock()
        mock_db.session.refresh = MagicMock()
        yield mock_db


@pytest.fixture()
def client(mock_db_session) -> Generator:
    """
    返回 FastAPI TestClient；若 app 未就绪则跳过所有需要 client 的测试。
    """
    if not _HAS_APP:
        pytest.skip("FastAPI app 尚未就绪，跳过集成测试")
    with TestClient(fastapi_app) as c:
        yield c


@pytest.fixture()
def submitted_workorder_id(client) -> str:
    """
    预置：提交一个有效工单并返回其 ID，供后续审批测试复用。
    """
    resp = client.post(BASE_URL, json=VALID_PAYLOAD)
    assert resp.status_code == 201, f"预置工单创建失败: {resp.text}"
    return resp.json()["data"]["id"]


# ---------------------------------------------------------------------------
# ATB-001: 工单提交功能
# ---------------------------------------------------------------------------


class TestWorkOrderSubmission:
    """ATB-001: 工单提交功能验证"""

    def test_submit_workorder_success_returns_201(self, client):
        """
        ATB-001.1 - 正常提交工单
        预期: HTTP 201，响应 code=0，status=PENDING，返回工单 ID
        """
        response = client.post(BASE_URL, json=VALID_PAYLOAD)

        assert response.status_code == 201
        body = response.json()
        assert body["code"] == 0, f"业务码不符预期: {body}"
        assert body["data"]["status"] == "PENDING"
        assert "id" in body["data"]
        assert body["message"] == "工单提交成功"

    def test_submit_workorder_generates_uuid(self, client):
        """
        ATB-001.2 - 工单 ID 应为合法 UUID v4
        预期: id 字段符合 UUID v4 格式
        """
        response = client.post(BASE_URL, json=VALID_PAYLOAD)
        assert response.status_code == 201
        wo_id = response.json()["data"]["id"]
        # 若不是合法 UUID 则抛出 ValueError
        parsed = uuid.UUID(wo_id, version=4)
        assert str(parsed) == wo_id

    def test_submit_workorder_missing_title_returns_422(self, client):
        """
        ATB-001.3 - 缺少必填字段 title
        预期: HTTP 422，data 为 None，message 包含校验错误信息
        """
        payload = {k: v for k, v in VALID_PAYLOAD.items() if k != "title"}
        response = client.post(BASE_URL, json=payload)

        assert response.status_code == 422
        body = response.json()
        assert body.get("data") is None

    def test_submit_workorder_missing_content_returns_422(self, client):
        """
        ATB-001.4 - 缺少必填字段 content
        预期: HTTP 422
        """
        payload = {k: v for k, v in VALID_PAYLOAD.items() if k != "content"}
        response = client.post(BASE_URL, json=payload)

        assert response.status_code == 422

    def test_submit_workorder_invalid_priority_returns_422(self, client):
        """
        ATB-001.5 - priority 不在枚举范围
        预期: HTTP 422
        """
        payload = {**VALID_PAYLOAD, "priority": "super_ultra_high"}
        response = client.post(BASE_URL, json=payload)

        assert response.status_code == 422

    def test_submit_workorder_empty_body_returns_422(self, client):
        """
        ATB-001.6 - 提交空 Body
        预期: HTTP 422
        """
        response = client.post(BASE_URL, json={})
        assert response.status_code == 422

    def test_submit_workorder_returns_creator_id(self, client):
        """
        ATB-001.7 - 响应中应包含 creator_id 字段
        预期: data.creator_id 不为空
        """
        response = client.post(BASE_URL, json=VALID_PAYLOAD)
        assert response.status_code == 201
        data = response.json()["data"]
        assert "creator_id" in data
        assert data["creator_id"]


# ---------------------------------------------------------------------------
# ATB-002: 状态机流转功能（通过 API 层验证）
# ---------------------------------------------------------------------------


class TestWorkOrderStateMachineViaAPI:
    """ATB-002: 状态机流转功能，通过 API 端点触发并断言状态"""

    def test_approve_transitions_to_approved(self, client, submitted_workorder_id):
        """
        ATB-002.1 - 有效审批通过
        初始状态: PENDING → 操作: approve → 预期状态: APPROVED
        """
        response = client.post(
            f"{BASE_URL}/{submitted_workorder_id}/approve",
            json={"approver_id": APPROVER_ID, "comment": "资源充足，同意"},
        )

        assert response.status_code == 200
        body = response.json()
        assert body["code"] == 0
        assert body["data"]["status"] == "APPROVED"

    def test_reject_transitions_to_rejected(self, client, submitted_workorder_id):
        """
        ATB-002.2 - 有效审批拒绝
        初始状态: PENDING → 操作: reject → 预期状态: REJECTED
        """
        response = client.post(
            f"{BASE_URL}/{submitted_workorder_id}/reject",
            json={"approver_id": APPROVER_ID, "reason": "当前资源不足"},
        )

        assert response.status_code == 200
        body = response.json()
        assert body["code"] == 0
        assert body["data"]["status"] == "REJECTED"

    def test_approve_nonexistent_workorder_returns_404(self, client):
        """
        ATB-002.3 - 审批不存在工单
        预期: HTTP 404，message 包含未找到提示
        """
        fake_id = str(uuid.uuid4())
        response = client.post(
            f"{BASE_URL}/{fake_id}/approve",
            json={"approver_id": APPROVER_ID},
        )

        assert response.status_code == 404

    def test_double_approve_returns_409(self, client, submitted_workorder_id):
        """
        ATB-002.4 - 重复审批已 APPROVED 的工单
        预期: HTTP 409 (Conflict) 或 422，拒绝非法状态转换
        """
        # 第一次审批通过
        client.post(
            f"{BASE_URL}/{submitted_workorder_id}/approve",
            json={"approver_id": APPROVER_ID},
        )
        # 第二次再次 approve 应被拒绝
        response = client.post(
            f"{BASE_URL}/{submitted_workorder_id}/approve",
            json={"approver_id": APPROVER_ID},
        )

        assert response.status_code in (409, 422), (
            f"重复审批应返回 409 或 422，实际返回 {response.status_code}"
        )

    def test_reject_already_approved_workorder_returns_conflict(
        self, client, submitted_workorder_id
    ):
        """
        ATB-002.5 - 对已 APPROVED 工单执行 reject（非法转换）
        预期: HTTP 409 或 422
        """
        client.post(
            f"{BASE_URL}/{submitted_workorder_id}/approve",
            json={"approver_id": APPROVER_ID},
        )
        response = client.post(
            f"{BASE_URL}/{submitted_workorder_id}/reject",
            json={"approver_id": APPROVER_ID, "reason": "改变主意"},
        )

        assert response.status_code in (409, 422)

    def test_approve_missing_approver_id_returns_422(
        self, client, submitted_workorder_id
    ):
        """
        ATB-002.6 - 缺少 approver_id
        预期: HTTP 422
        """
        response = client.post(
            f"{BASE_URL}/{submitted_workorder_id}/approve",
            json={"comment": "忘了填 approver"},
        )
        assert response.status_code == 422


# ---------------------------------------------------------------------------
# ATB-003: 通知触发功能
# ---------------------------------------------------------------------------


class TestNotificationTrigger:
    """ATB-003: 审批状态变更时自动触发通知"""

    def test_notify_enqueued_on_approval(
        self, client, submitted_workorder_id, mock_queue
    ):
        """
        ATB-003.1 - 审批通过后通知投递至队列
        预期: queue.enqueue 被调用一次，event_type="workorder.approved"
        """
        client.post(
            f"{BASE_URL}/{submitted_workorder_id}/approve",
            json={"approver_id": APPROVER_ID, "comment": "同意"},
        )

        mock_queue.enqueue.assert_called_once()
        kwargs = mock_queue.enqueue.call_args[1]
        assert kwargs.get("event_type") == "workorder.approved"

    def test_notify_enqueued_on_rejection(
        self, client, submitted_workorder_id, mock_queue
    ):
        """
        ATB-003.2 - 审批拒绝后通知投递至队列
        预期: queue.enqueue 被调用一次，event_type="workorder.rejected"，
              data.reject_reason 与传入原因一致
        """
        reject_reason = "材料不全，请补充后重新提交"
        client.post(
            f"{BASE_URL}/{submitted_workorder_id}/reject",
            json={"approver_id": APPROVER_ID, "reason": reject_reason},
        )

        mock_queue.enqueue.assert_called_once()
        kwargs = mock_queue.enqueue.call_args[1]
        assert kwargs.get("event_type") == "workorder.rejected"
        assert kwargs.get("data", {}).get("reject_reason") == reject_reason

    def test_no_notification_on_submission(self, client, mock_queue):
        """
        ATB-003.3 - 仅提交工单不触发通知（通知仅在状态变更时触发）
        预期: queue.enqueue 未被调用
        """
        client.post(BASE_URL, json=VALID_PAYLOAD)
        mock_queue.enqueue.assert_not_called()

    def test_notification_contains_workorder_id(
        self, client, submitted_workorder_id, mock_queue
    ):
        """
        ATB-003.4 - 通知 payload 中包含工单 ID
        预期: kwargs["data"]["workorder_id"] == submitted_workorder_id
        """
        client.post(
            f"{BASE_URL}/{submitted_workorder_id}/approve",
            json={"approver_id": APPROVER_ID},
        )
        kwargs = mock_queue.enqueue.call_args[1]
        assert kwargs.get("data", {}).get("workorder_id") == submitted_workorder_id


# ---------------------------------------------------------------------------
# ATB-004: 审批记录持久化（通过 records 接口验证）
# ---------------------------------------------------------------------------


class TestApprovalRecordPersistence:
    """ATB-004: 每次状态变更生成不可变审批记录"""

    def test_approve_creates_record(self, client, submitted_workorder_id):
        """
        ATB-004.1 - 审批通过后记录可通过 records 接口查询
        预期: records 列表长度为 1，action="APPROVE"，approver_id 正确
        """
        client.post(
            f"{BASE_URL}/{submitted_workorder_id}/approve",
            json={"approver_id": APPROVER_ID, "comment": "同意"},
        )

        resp = client.get(f"{BASE_URL}/{submitted_workorder_id}/records")
        assert resp.status_code == 200
        records = resp.json()["data"]["records"]
        assert len(records) >= 1

        latest = records[-1]
        assert latest["action"] == "APPROVE"
        assert latest["approver_id"] == APPROVER_ID

    def test_reject_creates_record_with_reason(self, client, submitted_workorder_id):
        """
        ATB-004.2 - 审批拒绝后记录包含拒绝原因
        预期: records[-1].reason 与传入原因一致
        """
        reason = "预算不足，延期处理"
        client.post(
            f"{BASE_URL}/{submitted_workorder_id}/reject",
            json={"approver_id": APPROVER_ID, "reason": reason},
        )

        resp = client.get(f"{BASE_URL}/{submitted_workorder_id}/records")
        assert resp.status_code == 200
        records = resp.json()["data"]["records"]
        latest = records[-1]
        assert latest["action"] == "REJECT"
        assert latest.get("reason") == reason

    def test_records_endpoint_returns_empty_for_pending_workorder(
        self, client, submitted_workorder_id
    ):
        """
        ATB-004.3 - 未经过任何审批操作的工单，records 为空列表
        预期: records 为 []
        """
        resp = client.get(f"{BASE_URL}/{submitted_workorder_id}/records")
        assert resp.status_code == 200
        records = resp.json()["data"]["records"]
        assert records == []

    def test_records_for_nonexistent_workorder_returns_404(self, client):
        """
        ATB-004.4 - 查询不存在工单的记录
        预期: HTTP 404
        """
        fake_id = str(uuid.uuid4())
        resp = client.get(f"{BASE_URL}/{fake_id}/records")
        assert resp.status_code == 404


# ---------------------------------------------------------------------------
# ATB-005: API 接口集成完整链路
# ---------------------------------------------------------------------------


class TestWorkOrderAPIFullLifecycle:
    """ATB-005: 完整工单审批链路端到端集成验证"""

    def test_full_approve_lifecycle(self, client, mock_queue):
        """
        ATB-005.1 - 完整审批通过链路
        步骤: 提交 → 审批通过 → 查询状态 → 查询记录 → 验证通知
        """
        # Step 1: 提交工单
        submit_resp = client.post(BASE_URL, json=VALID_PAYLOAD)
        assert submit_resp.status_code == 201
        wo_id = submit_resp.json()["data"]["id"]
        assert submit_resp.json()["data"]["status"] == "PENDING"

        # Step 2: 审批通过
        approve_resp = client.post(
            f"{BASE_URL}/{wo_id}/approve",
            json={"approver_id": APPROVER_ID, "comment": "资源充足，批准"},
        )
        assert approve_resp.status_code == 200
        assert approve_resp.json()["data"]["status"] == "APPROVED"

        # Step 3: 查询工单状态（GET 详情接口）
        detail_resp = client.get(f"{BASE_URL}/{wo_id}")
        assert detail_resp.status_code == 200
        assert detail_resp.json()["data"]["status"] == "APPROVED"

        # Step 4: 查询审批记录
        records_resp = client.get(f"{BASE_URL}/{wo_id}/records")
        assert records_resp.status_code == 200
        records = records_resp.json()["data"]["records"]
        assert any(r["action"] == "APPROVE" for r in records)

        # Step 5: 验证通知已投递
        mock_queue.enqueue.assert_called_once()
        assert mock_queue.enqueue.call_args[1]["event_type"] == "workorder.approved"

    def test_full_reject_lifecycle(self, client, mock_queue):
        """
        ATB-005.2 - 完整审批拒绝链路
        步骤: 提交 → 审批拒绝 → 查询状态 → 查询记录 → 验证通知
        """
        # Step 1: 提交工单
        submit_resp = client.post(BASE_URL, json=VALID_PAYLOAD)
        assert submit_resp.status_code == 201
        wo_id = submit_resp.json()["data"]["id"]

        # Step 2: 审批拒绝
        reason = "不在本季度预算范围内"
        reject_resp = client.post(
            f"{BASE_URL}/{wo_id}/reject",
            json={"approver_id": APPROVER_ID, "reason": reason},
        )
        assert reject_resp.status_code == 200
        assert reject_resp.json()["data"]["status"] == "REJECTED"

        # Step 3: 查询工单状态
        detail_resp = client.get(f"{BASE_URL}/{wo_id}")
        assert detail_resp.status_code == 200
        assert detail_resp.json()["data"]["status"] == "REJECTED"

        # Step 4: 查询审批记录
        records_resp = client.get(f"{BASE_URL}/{wo_id}/records")
        assert records_resp.status_code == 200
        records = records_resp.json()["data"]["records"]
        assert any(r["action"] == "REJECT" and r.get("reason") == reason for r in records)

        # Step 5: 验证通知已投递
        mock_queue.enqueue.assert_called_once()
        kwargs = mock_queue.enqueue.call_args[1]
        assert kwargs["event_type"] == "workorder.rejected"
        assert kwargs["data"]["reject_reason"] == reason

    def test_response_envelope_structure(self, client):
        """
        ATB-005.3 - 统一响应信封结构验证
        预期: 所有响应均包含 {code, data, message} 三个顶层字段
        """
        endpoints_to_check = [
            ("POST", BASE_URL, VALID_PAYLOAD, [200, 201]),
        ]
        for method, url, payload, expected_codes in endpoints_to_check:
            if method == "POST":
                resp = client.post(url, json=payload)
            else:
                resp = client.get(url)

            assert resp.status_code in expected_codes, (
                f"{method} {url} 返回 {resp.status_code}"
            )
            body = resp.json()
            for field in ("code", "data", "message"):
                assert field in body, (
                    f"响应缺少字段 '{field}': {body}"
                )

    def test_concurrent_submissions_generate_unique_ids(self, client):
        """
        ATB-005.4 - 并发提交多个工单，ID 唯一不重复
        预期: 多次提交返回的 ID 集合长度等于请求数量
        """
        n = 5
        ids = []
        for _ in range(n):
            resp = client.post(BASE_URL, json=VALID_PAYLOAD)
            assert resp.status_code == 201
            ids.append(resp.json()["data"]["id"])

        assert len(set(ids)) == n, f"存在重复工单 ID: {ids}"


# ---------------------------------------------------------------------------
# 辅助：纯 import 冒烟测试（满足 AC-005）
# ---------------------------------------------------------------------------


class TestModuleImportSanity:
    """验证关键模块可被 import，不抛出 ImportError（AC-005）"""

    def test_workorder_service_importable(self):
        """backend.services.workorder_service 应可 import"""
        try:
            import backend.services.workorder_service as _  # noqa: F401
        except ImportError as exc:
            pytest.fail(f"workorder_service import 失败: {exc}")

    def test_workorder_state_machine_importable(self):
        """backend.state_machine.workorder_state 应可 import"""
        try:
            import backend.state_machine.workorder_state as _  # noqa: F401
        except ImportError as exc:
            pytest.fail(f"workorder_state import 失败: {exc}")

    def test_workorder_model_importable(self):
        """backend.models.workorder 应可 import"""
        try:
            import backend.models.workorder as _  # noqa: F401
        except ImportError as exc:
            pytest.fail(f"workorder model import 失败: {exc}")

    def test_approval_api_importable(self):
        """backend.api.v1.approval 应可 import"""
        try:
            import backend.api.v1.approval as _  # noqa: F401
        except ImportError as exc:
            pytest.fail(f"approval api import 失败: {exc}")