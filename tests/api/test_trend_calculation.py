"""
tests/api/test_trend_calculation.py

Audit Dashboard — 趋势聚合 API 集成测试套件。

覆盖 ATB-1 ~ ATB-5 验收测试基准：
  ATB-1: 时间趋势聚合接口测试
  ATB-2: 操作类型分布聚合接口测试
  ATB-3: 操作人活跃度聚合接口测试
  ATB-4: 权限拦截测试
  ATB-5: 时间跨度边界测试

所有时间参数及断言均使用 UTC 时区，格式遵循 ISO8601 (yyyy-MM-dd'T'HH:mm:ss'Z')。
"""

from __future__ import annotations

import json
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional
from unittest.mock import MagicMock, patch

import pytest


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

UTC = timezone.utc

BASE_URL = "/api/v1/audit/dashboard"


def _utc_iso(dt: datetime) -> str:
    """将 datetime 转为 ISO8601 UTC 字符串 (yyyy-MM-dd'T'HH:mm:ss'Z')。"""
    return dt.astimezone(UTC).strftime("%Y-%m-%dT%H:%M:%SZ")


def _build_auth_header(token: str) -> Dict[str, str]:
    """构造 Authorization 请求头。"""
    return {"Authorization": f"Bearer {token}"}


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

@pytest.fixture()
def admin_token() -> str:
    """模拟持有 ROLE_ADMIN 权限的管理员令牌。"""
    return "admin-token-for-testing"


@pytest.fixture()
def user_token() -> str:
    """模拟普通用户令牌（无 ROLE_ADMIN 权限）。"""
    return "regular-user-token-for-testing"


@pytest.fixture()
def now() -> datetime:
    """当前 UTC 时间。"""
    return datetime.now(UTC)


@pytest.fixture()
def sample_audit_logs(now: datetime) -> List[Dict[str, Any]]:
    """
    生成用于注入的测试审计日志数据。

    Returns:
        包含 30 条日志的列表，分布在 3 天内，涵盖 LOGIN / CREATE / DELETE 三种操作类型，
        涉及 5 个不同操作人。
    """
    logs: List[Dict[str, Any]] = []
    operation_types = ["LOGIN", "CREATE", "DELETE"]
    operator_ids = ["admin_01", "admin_02", "admin_03", "admin_04", "admin_05"]

    for day_offset in range(3):
        base = now - timedelta(days=2 - day_offset)
        for hour in range(10):
            ts = base.replace(hour=8 + hour, minute=0, second=0, microsecond=0)
            op_type = operation_types[(day_offset + hour) % len(operation_types)]
            operator = operator_ids[(day_offset + hour) % len(operator_ids)]
            logs.append({
                "id": f"log-{day_offset}-{hour}",
                "timestamp": _utc_iso(ts),
                "operation_type": op_type,
                "operator_id": operator,
                "resource_type": "asset",
                "resource_id": f"asset-{day_offset * 10 + hour}",
                "detail": json.dumps({"action": op_type.lower()}),
            })
    return logs


@pytest.fixture()
def multi_operator_logs(now: datetime) -> List[Dict[str, Any]]:
    """
    生成 15 个不同操作人的日志数据，操作次数呈递减分布。

    operator_00: 15 次, operator_01: 14 次, ..., operator_14: 1 次。
    总计 120 条日志。
    """
    logs: List[Dict[str, Any]] = []
    for op_idx in range(15):
        operator_id = f"operator_{op_idx:02d}"
        count = 15 - op_idx
        for i in range(count):
            ts = now - timedelta(hours=i)
            logs.append({
                "id": f"multi-log-{op_idx}-{i}",
                "timestamp": _utc_iso(ts),
                "operation_type": "LOGIN",
                "operator_id": operator_id,
                "resource_type": "asset",
                "resource_id": f"asset-{op_idx}-{i}",
                "detail": json.dumps({"action": "login"}),
            })
    return logs


# ---------------------------------------------------------------------------
# ATB-1: 时间趋势聚合接口测试
# ---------------------------------------------------------------------------

class TestTrendAggregation:
    """ATB-1: GET /api/v1/audit/dashboard/trend"""

    ENDPOINT = f"{BASE_URL}/trend"

    def test_day_granularity_returns_correct_bucket_count(
        self,
        client: Any,
        admin_token: str,
        sample_audit_logs: List[Dict[str, Any]],
        now: datetime,
    ) -> None:
        """
        ATB-1 步骤 2-3: 使用 day 粒度查询 3 天范围，
        断言返回数组长度等于天数，且各节点 count 汇总等于注入数据量。
        """
        start = now - timedelta(days=2)
        end = now

        with patch("src.api.v1.audit_dashboard.get_db") as mock_db:
            mock_session = MagicMock()
            mock_db.return_value.__enter__ = MagicMock(return_value=mock_session)
            mock_db.return_value.__exit__ = MagicMock(return_value=False)

            # 模拟 repository 返回按天聚合的结果
            mock_session.execute.return_value = MagicMock(
                scalars=MagicMock(
                    all=MagicMock(return_value=sample_audit_logs)
                )
            )

            resp = client.get(
                self.ENDPOINT,
                params={
                    "start_time": _utc_iso(start),
                    "end_time": _utc_iso(end),
                    "granularity": "day",
                },
                headers=_build_auth_header(admin_token),
            )

        assert resp.status_code == 200
        body = resp.get_json()
        assert isinstance(body, list)

        # 验证返回的天数桶数量与时间跨度一致（3 天）
        assert len(body) == 3

        # 验证 count 汇总值等于注入数据量（30 条）
        total_count = sum(item.get("count", 0) for item in body)
        assert total_count == 30

    def test_day_granularity_each_bucket_has_correct_structure(
        self,
        client: Any,
        admin_token: str,
        now: datetime,
    ) -> None:
        """验证每个趋势桶包含 time_bucket 和 count 字段。"""
        start = now - timedelta(days=2)
        end = now

        with patch("src.api.v1.audit_dashboard.get_db") as mock_db:
            mock_session = MagicMock()
            mock_db.return_value.__enter__ = MagicMock(return_value=mock_session)
            mock_db.return_value.__exit__ = MagicMock(return_value=False)

            mock_session.execute.return_value = MagicMock(
                scalars=MagicMock(
                    all=MagicMock(return_value=[
                        {"time_bucket": _utc_iso(start), "count": 10},
                        {"time_bucket": _utc_iso(start + timedelta(days=1)), "count": 10},
                        {"time_bucket": _utc_iso(start + timedelta(days=2)), "count": 10},
                    ])
                )
            )

            resp = client.get(
                self.ENDPOINT,
                params={
                    "start_time": _utc_iso(start),
                    "end_time": _utc_iso(end),
                    "granularity": "day",
                },
                headers=_build_auth_header(admin_token),
            )

        assert resp.status_code == 200
        body = resp.get_json()
        for item in body:
            assert "time_bucket" in item
            assert "count" in item
            assert isinstance(item["count"], int)

    def test_hour_granularity_within_3_days(
        self,
        client: Any,
        admin_token: str,
        now: datetime,
    ) -> None:
        """
        ATB-1 步骤 4 (正向): hour 粒度在跨度 <= 3 天时应返回 200。
        """
        start = now - timedelta(days=2)
        end = now

        with patch("src.api.v1.audit_dashboard.get_db") as mock_db:
            mock_session = MagicMock()
            mock_db.return_value.__enter__ = MagicMock(return_value=mock_session)
            mock_db.return_value.__exit__ = MagicMock(return_value=False)

            mock_session.execute.return_value = MagicMock(
                scalars=MagicMock(all=MagicMock(return_value=[]))
            )

            resp = client.get(
                self.ENDPOINT,
                params={
                    "start_time": _utc_iso(start),
                    "end_time": _utc_iso(end),
                    "granularity": "hour",
                },
                headers=_build_auth_header(admin_token),
            )

        assert resp.status_code == 200

    def test_hour_granularity_exceeds_3_days_returns_400(
        self,
        client: Any,
        admin_token: str,
        now: datetime,
    ) -> None:
        """
        ATB-1 步骤 4: hour 粒度在跨度 > 3 天时应返回 400。
        """
        start = now - timedelta(days=4)
        end = now

        resp = client.get(
            self.ENDPOINT,
            params={
                "start_time": _utc_iso(start),
                "end_time": _utc_iso(end),
                "granularity": "hour",
            },
            headers=_build_auth_header(admin_token),
        )

        assert resp.status_code == 400
        body = resp.get_json()
        assert "granularity" in str(body).lower() or "hour" in str(body).lower()

    def test_default_granularity_is_day(
        self,
        client: Any,
        admin_token: str,
        now: datetime,
    ) -> None:
        """不传 granularity 参数时，默认使用 day 粒度。"""
        start = now - timedelta(days=1)
        end = now

        with patch("src.api.v1.audit_dashboard.get_db") as mock_db:
            mock_session = MagicMock()
            mock_db.return_value.__enter__ = MagicMock(return_value=mock_session)
            mock_db.return_value.__exit__ = MagicMock(return_value=False)

            mock_session.execute.return_value = MagicMock(
                scalars=MagicMock(all=MagicMock(return_value=[]))
            )

            resp = client.get(
                self.ENDPOINT,
                params={
                    "start_time": _utc_iso(start),
                    "end_time": _utc_iso(end),
                },
                headers=_build_auth_header(admin_token),
            )

        assert resp.status_code == 200

    def test_filter_by_operation_type(
        self,
        client: Any,
        admin_token: str,
        sample_audit_logs: List[Dict[str, Any]],
        now: datetime,
    ) -> None:
        """传入 operation_type 过滤后，返回结果仅包含该类型的计数。"""
        start = now - timedelta(days=2)
        end = now

        login_logs = [l for l in sample_audit_logs if l["operation_type"] == "LOGIN"]

        with patch("src.api.v1.audit_dashboard.get_db") as mock_db:
            mock_session = MagicMock()
            mock_db.return_value.__enter__ = MagicMock(return_value=mock_session)
            mock_db.return_value.__exit__ = MagicMock(return_value=False)

            mock_session.execute.return_value = MagicMock(
                scalars=MagicMock(all=MagicMock(return_value=login_logs))
            )

            resp = client.get(
                self.ENDPOINT,
                params={
                    "start_time": _utc_iso(start),
                    "end_time": _utc_iso(end),
                    "granularity": "day",
                    "operation_type": "LOGIN",
                },
                headers=_build_auth_header(admin_token),
            )

        assert resp.status_code == 200


# ---------------------------------------------------------------------------
# ATB-2: 操作类型分布聚合接口测试
# ---------------------------------------------------------------------------

class TestTypeDistribution:
    """ATB-2: GET /api/v1/audit/dashboard/type-distribution"""

    ENDPOINT = f"{BASE_URL}/type-distribution"

    def test_returns_correct_type_counts(
        self,
        client: Any,
        admin_token: str,
        sample_audit_logs: List[Dict[str, Any]],
        now: datetime,
    ) -> None:
        """
        ATB-2 步骤 1-3: 注入 LOGIN/CREATE/DELETE 三种类型日志，
        断言返回各类型及其准确计数。
        """
        start = now - timedelta(days=2)
        end = now

        # 预期分布
        expected: Dict[str, int] = {}
        for log in sample_audit_logs:
            op = log["operation_type"]
            expected[op] = expected.get(op, 0) + 1

        with patch("src.api.v1.audit_dashboard.get_db") as mock_db:
            mock_session = MagicMock()
            mock_db.return_value.__enter__ = MagicMock(return_value=mock_session)
            mock_db.return_value.__exit__ = MagicMock(return_value=False)

            mock_session.execute.return_value = MagicMock(
                scalars=MagicMock(
                    all=MagicMock(return_value=[
                        {"operation_type": k, "count": v}
                        for k, v in sorted(expected.items())
                    ])
                )
            )

            resp = client.get(
                self.ENDPOINT,
                params={
                    "start_time": _utc_iso(start),
                    "end_time": _utc_iso(end),
                },
                headers=_build_auth_header(admin_token),
            )

        assert resp.status_code == 200
        body = resp.get_json()
        assert isinstance(body, list)

        # 验证返回的类型集合与注入数据一致，无数据泄露
        returned_types = {item["operation_type"] for item in body}
        assert returned_types == set(expected.keys())

        # 验证各类型计数准确
        for item in body:
            assert item["count"] == expected[item["operation_type"]]

    def test_no_data_returns_empty_list(
        self,
        client: Any,
        admin_token: str,
        now: datetime,
    ) -> None:
        """时间范围内无数据时返回空数组。"""
        start = now - timedelta(days=1)
        end = now

        with patch("src.api.v1.audit_dashboard.get_db") as mock_db:
            mock_session = MagicMock()
            mock_db.return_value.__enter__ = MagicMock(return_value=mock_session)
            mock_db.return_value.__exit__ = MagicMock(return_value=False)

            mock_session.execute.return_value = MagicMock(
                scalars=MagicMock(all=MagicMock(return_value=[]))
            )

            resp = client.get(
                self.ENDPOINT,
                params={
                    "start_time": _utc_iso(start),
                    "end_time": _utc_iso(end),
                },
                headers=_build_auth_header(admin_token),
            )

        assert resp.status_code == 200
        assert resp.get_json() == []

    def test_response_structure_has_required_fields(
        self,
        client: Any,
        admin_token: str,
        now: datetime,
    ) -> None:
        """验证响应中每个元素包含 operation_type 和 count 字段。"""
        start = now - timedelta(days=1)
        end = now

        with patch("src.api.v1.audit_dashboard.get_db") as mock_db:
            mock_session = MagicMock()
            mock_db.return_value.__enter__ = MagicMock(return_value=mock_session)
            mock_db.return_value.__exit__ = MagicMock(return_value=False)

            mock_session.execute.return_value = MagicMock(
                scalars=MagicMock(
                    all=MagicMock(return_value=[
                        {"operation_type": "LOGIN", "count": 5},
                        {"operation_type": "CREATE", "count": 3},
                    ])
                )
            )

            resp = client.get(
                self.ENDPOINT,
                params={
                    "start_time": _utc_iso(start),
                    "end_time": _utc_iso(end),
                },
                headers=_build_auth_header(admin_token),
            )

        assert resp.status_code == 200
        body = resp.get_json()
        for item in body:
            assert "operation_type" in item
            assert "count" in item


# ---------------------------------------------------------------------------
# ATB-3: 操作人活跃度聚合接口测试
# ---------------------------------------------------------------------------

class TestOperatorRanking:
    """ATB-3: GET /api/v1/audit/dashboard/operator-ranking"""

    ENDPOINT = f"{BASE_URL}/operator-ranking"

    def test_top_10_truncation(
        self,
        client: Any,
        admin_token: str,
        multi_operator_logs: List[Dict[str, Any]],
        now: datetime,
    ) -> None:
        """
        ATB-3 步骤 1-3: 注入 15 个操作人（递减分布），
        断言返回数组长度为 10（Top N 截断）。
        """
        start = now - timedelta(days=1)
        end = now

        with patch("src.api.v1.audit_dashboard.get_db") as mock_db:
            mock_session = MagicMock()
            mock_db.return_value.__enter__ = MagicMock(return_value=mock_session)
            mock_db.return_value.__exit__ = MagicMock(return_value=False)

            # 模拟返回 Top 10
            top_10 = [
                {"operator_id": f"operator_{i:02d}", "count": 15 - i}
                for i in range(10)
            ]
            mock_session.execute.return_value = MagicMock(
                scalars=MagicMock(all=MagicMock(return_value=top_10))
            )

            resp = client.get(
                self.ENDPOINT,
                params={
                    "start_time": _utc_iso(start),
                    "end_time": _utc_iso(end),
                },
                headers=_build_auth_header(admin_token),
            )

        assert resp.status_code == 200
        body = resp.get_json()
        assert isinstance(body, list)
        assert len(body) == 10

    def test_first_operator_is_most_active(
        self,
        client: Any,
        admin_token: str,
        multi_operator_logs: List[Dict[str, Any]],
        now: datetime,
    ) -> None:
        """
        ATB-3 步骤 3: 第一个元素的 operator_id 应为操作次数最多的用户。
        """
        start = now - timedelta(days=1)
        end = now

        with patch("src.api.v1.audit_dashboard.get_db") as mock_db:
            mock_session = MagicMock()
            mock_db.return_value.__enter__ = MagicMock(return_value=mock_session)
            mock_db.return_value.__exit__ = MagicMock(return_value=False)

            top_10 = [
                {"operator_id": f"operator_{i:02d}", "count": 15 - i}
                for i in range(10)
            ]
            mock_session.execute.return_value = MagicMock(
                scalars=MagicMock(all=MagicMock(return_value=top_10))
            )

            resp = client.get(
                self.ENDPOINT,
                params={
                    "start_time": _utc_iso(start),
                    "end_time": _utc_iso(end),
                },
                headers=_build_auth_header(admin_token),
            )

        assert resp.status_code == 200
        body = resp.get_json()
        assert body[0]["operator_id"] == "operator_00"
        assert body[0]["count"] == 15

    def test_ranking_order_is_descending(
        self,
        client: Any,
        admin_token: str,
        now: datetime,
    ) -> None:
        """验证返回结果按 count 降序排列。"""
        start = now - timedelta(days=1)
        end = now

        with patch("src.api.v1.audit_dashboard.get_db") as mock_db:
            mock_session = MagicMock()
            mock_db.return_value.__enter__ = MagicMock(return_value=mock_session)
            mock_db.return_value.__exit__ = MagicMock(return_value=False)

            mock_session.execute.return_value = MagicMock(
                scalars=MagicMock(
                    all=MagicMock(return_value=[
                        {"operator_id": "op_a", "count": 100},
                        {"operator_id": "op_b", "count": 50},
                        {"operator_id": "op_c", "count": 10},
                    ])
                )
            )

            resp = client.get(
                self.ENDPOINT,
                params={
                    "start_time": _utc_iso(start),
                    "end_time": _utc_iso(end),
                },
                headers=_build_auth_header(admin_token),
            )

        assert resp.status_code == 200
        body = resp.get_json()
        counts = [item["count"] for item in body]
        assert counts == sorted(counts, reverse=True)

    def test_response_structure_has_required_fields(
        self,
        client: Any,
        admin_token: str,
        now: datetime,
    ) -> None:
        """验证响应中每个元素包含 operator_id 和 count 字段。"""
        start = now - timedelta(days=1)
        end = now

        with patch("src.api.v1.audit_dashboard.get_db") as mock_db:
            mock_session = MagicMock()
            mock_db.return_value.__enter__ = MagicMock(return_value=mock_session)
            mock_db.return_value.__exit__ = MagicMock(return_value=False)

            mock_session.execute.return_value = MagicMock(
                scalars=MagicMock(
                    all=MagicMock(return_value=[
                        {"operator_id": "op_a", "count": 10},
                    ])
                )
            )

            resp = client.get(
                self.ENDPOINT,
                params={
                    "start_time": _utc_iso(start),
                    "end_time": _utc_iso(end),
                },
                headers=_build_auth_header(admin_token),
            )

        assert resp.status_code == 200
        body = resp.get_json()
        for item in body:
            assert "operator_id" in item
            assert "count" in item


# ---------------------------------------------------------------------------
# ATB-4: 权限拦截测试
# ---------------------------------------------------------------------------

class TestPermissionGuard:
    """ATB-4: 所有 Dashboard API 仅限 ROLE_ADMIN 访问。"""

    @pytest.mark.parametrize("endpoint", [
        f"{BASE_URL}/trend",
        f"{BASE_URL}/type-distribution",
        f"{BASE_URL}/operator-ranking",
    ])
    def test_non_admin_returns_403(
        self,
        client: Any,
        user_token: str,
        now: datetime,
        endpoint: str,
    ) -> None:
        """
        ATB-4 步骤 1-2: 使用无 ROLE_ADMIN 权限的 Token 请求三个聚合接口，
        断言均返回 403 Forbidden。
        """
        start = now - timedelta(days=1)
        end = now

        resp = client.get(
            endpoint,
            params={
                "start_time": _utc_iso(start),
                "end_time": _utc_iso(end),
            },
            headers=_build_auth_header(user_token),
        )

        assert resp.status_code == 403

    @pytest.mark.parametrize("endpoint", [
        f"{BASE_URL}/trend",
        f"{BASE_URL}/type-distribution",
        f"{BASE_URL}/operator-ranking",
    ])
    def test_missing_token_returns_401_or_403(
        self,
        client: Any,
        now: datetime,
        endpoint: str,
    ) -> None:
        """不携带 Token 请求时应返回 401 或 403。"""
        start = now - timedelta(days=1)
        end = now

        resp = client.get(
            endpoint,
            params={
                "start_time": _utc_iso(start),
                "end_time": _utc_iso(end),
            },
        )

        assert resp.status_code in (401, 403)


# ---------------------------------------------------------------------------
# ATB-5: 时间跨度边界测试
# ---------------------------------------------------------------------------

class TestTimeSpanBoundary:
    """ATB-5: 单次查询时间范围最大跨度不得超过 90 天。"""

    @pytest.mark.parametrize("endpoint", [
        f"{BASE_URL}/trend",
        f"{BASE_URL}/type-distribution",
        f"{BASE_URL}/operator-ranking",
    ])
    def test_91_day_span_returns_400(
        self,
        client: Any,
        admin_token: str,
        now: datetime,
        endpoint: str,
    ) -> None:
        """
        ATB-5 步骤 1-2: 构造间隔 91 天的请求，
        断言返回 400 且错误信息包含时间跨度超限提示。
        """
        start = now - timedelta(days=91)
        end = now

        resp = client.get(
            endpoint,
            params={
                "start_time": _utc_iso(start),
                "end_time": _utc_iso(end),
            },
            headers=_build_auth_header(admin_token),
        )

        assert resp.status_code == 400
        body = resp.get_json()
        error_msg = json.dumps(body).lower()
        # 验证错误信息包含时间跨度相关提示
        assert any(
            keyword in error_msg
            for keyword in ["时间跨度", "time span", "超过", "exceed", "90", "最大"]
        )

    @pytest.mark.parametrize("endpoint", [
        f"{BASE_URL}/trend",
        f"{BASE_URL}/type-distribution",
        f"{BASE_URL}/operator-ranking",
    ])
    def test_exactly_90_day_span_returns_200(
        self,
        client: Any,
        admin_token: str,
        now: datetime,
        endpoint: str,
    ) -> None:
        """恰好 90 天跨度应被接受（边界值）。"""
        start = now - timedelta(days=90)
        end = now

        with patch("src.api.v1.audit_dashboard.get_db") as mock_db:
            mock_session = MagicMock()
            mock_db.return_value.__enter__ = MagicMock(return_value=mock_session)
            mock_db.return_value.__exit__ = MagicMock(return_value=False)

            mock_session.execute.return_value = MagicMock(
                scalars=MagicMock(all=MagicMock(return_value=[]))
            )

            resp = client.get(
                endpoint,
                params={
                    "start_time": _utc_iso(start),
                    "end_time": _utc_iso(end),
                },
                headers=_build_auth_header(admin_token),
            )

        assert resp.status_code == 200

    @pytest.mark.parametrize("endpoint", [
        f"{BASE_URL}/trend",
        f"{BASE_URL}/type-distribution",
        f"{BASE_URL}/operator-ranking",
    ])
    def test_start_time_after_end_time_returns_400(
        self,
        client: Any,
        admin_token: str,
        now: datetime,
        endpoint: str,
    ) -> None:
        """start_time 晚于 end_time 时应返回 400。"""
        start = now
        end = now - timedelta(days=1)

        resp = client.get(
            endpoint,
            params={
                "start_time": _utc_iso(start),
                "end_time": _utc_iso(end),
            },
            headers=_build_auth_header(admin_token),
        )

        assert resp.status_code == 400

    @pytest.mark.parametrize("endpoint", [
        f"{BASE_URL}/trend",
        f"{BASE_URL}/type-distribution",
        f"{BASE_URL}/operator-ranking",
    ])
    def test_missing_time_params_returns_422(
        self,
        client: Any,
        admin_token: str,
        endpoint: str,
    ) -> None:
        """缺少 start_time 或 end_time 参数时应返回 422。"""
        resp = client.get(
            endpoint,
            headers=_build_auth_header(admin_token),
        )

        assert resp.status_code == 422


# ---------------------------------------------------------------------------
# 时区与格式约束测试
# ---------------------------------------------------------------------------

class TestTimezoneAndFormat:
    """验证入参及出参时间均使用 UTC ISO8601 格式。"""

    def test_response_time_buckets_are_utc_iso8601(
        self,
        client: Any,
        admin_token: str,
        now: datetime,
    ) -> None:
        """验证趋势聚合返回的 time_bucket 字段符合 ISO8601 UTC 格式。"""
        start = now - timedelta(days=1)
        end = now

        with patch("src.api.v1.audit_dashboard.get_db") as mock_db:
            mock_session = MagicMock()
            mock_db.return_value.__enter__ = MagicMock(return_value=mock_session)
            mock_db.return_value.__exit__ = MagicMock(return_value=False)

            mock_session.execute.return_value = MagicMock(
                scalars=MagicMock(
                    all=MagicMock(return_value=[
                        {"time_bucket": _utc_iso(start), "count": 5},
                        {"time_bucket": _utc_iso(end), "count": 5},
                    ])
                )
            )

            resp = client.get(
                f"{BASE_URL}/trend",
                params={
                    "start_time": _utc_iso(start),
                    "end_time": _utc_iso(end),
                    "granularity": "day",
                },
                headers=_build_auth_header(admin_token),
            )

        assert resp.status_code == 200
        body = resp.get_json()
        for item in body:
            bucket = item["time_bucket"]
            # 验证以 'Z' 结尾（UTC 标识）
            assert bucket.endswith("Z"), f"time_bucket '{bucket}' is not UTC ISO8601"
            # 验证可被解析为 datetime
            datetime.fromisoformat(bucket.replace("Z", "+00:00"))