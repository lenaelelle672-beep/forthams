"""
审计日志 API 集成测试模块。

本模块覆盖 Phase 1 核心审计日志查询与可视化基座的后端 API 验收测试，
对应 ATB-01（多维筛选与分页）、ATB-02（时间跨度越界拦截）、ATB-03（趋势数据聚合），
以及权限约束、分页约束、时区约束、操作类型元数据等边界场景。

测试端点：
  - GET  /api/v1/audit-log/list   — 审计日志列表查询
  - GET  /api/v1/audit-log/trend  — 审计日志趋势聚合
  - GET  /api/v1/audit-log/meta   — 操作类型枚举元数据
"""

from __future__ import annotations

import uuid
from datetime import datetime, timedelta, timezone
from typing import Any

import pytest
from httpx import AsyncClient

# ---------------------------------------------------------------------------
# 常量与辅助工具
# ---------------------------------------------------------------------------

API_LIST = "/api/v1/audit-log/list"
API_TREND = "/api/v1/audit-log/trend"
API_META = "/api/v1/audit-log/meta"

# 合法的操作类型枚举（与后端 /meta 下发保持一致）
VALID_ACTION_TYPES = [
    "LOGIN",
    "LOGOUT",
    "CREATE",
    "UPDATE",
    "DELETE",
    "EXPORT",
    "IMPORT",
    "APPROVE",
    "REJECT",
]

# 角色常量
ROLE_ADMIN = "admin"
ROLE_AUDITOR = "auditor"
ROLE_USER = "user"  # 普通用户，无审计权限

# 分页约束
MAX_PAGE_SIZE = 100
DEFAULT_PAGE_SIZE = 50
MAX_OFFSET = 10000

# 时间跨度约束
MAX_TIME_SPAN_DAYS = 90


def _utc_iso(dt: datetime) -> str:
    """将 datetime 转换为 UTC ISO 8601 字符串。"""
    return dt.astimezone(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def _make_audit_log(
    operator_id: str = "U001",
    action_type: str = "LOGIN",
    created_at: datetime | None = None,
    **extra: Any,
) -> dict[str, Any]:
    """
    构造一条审计日志记录的字典表示。

    Args:
        operator_id: 操作人 ID
        action_type: 操作类型
        created_at: 创建时间（UTC）
        **extra: 额外字段

    Returns:
        审计日志字典
    """
    return {
        "id": str(uuid.uuid4()),
        "operator_id": operator_id,
        "operator_name": f"User-{operator_id}",
        "action_type": action_type,
        "resource_type": extra.get("resource_type", "asset"),
        "resource_id": extra.get("resource_id", "RES-001"),
        "detail": extra.get("detail", {}),
        "ip_address": extra.get("ip_address", "127.0.0.1"),
        "created_at": _utc_iso(created_at or datetime.now(timezone.utc)),
    }


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------


@pytest.fixture
def admin_headers() -> dict[str, str]:
    """构造 admin 角色的请求头。"""
    return {"X-User-Role": ROLE_ADMIN, "X-User-Id": "ADMIN-001"}


@pytest.fixture
def auditor_headers() -> dict[str, str]:
    """构造 auditor 角色的请求头。"""
    return {"X-User-Role": ROLE_AUDITOR, "X-User-Id": "AUDITOR-001"}


@pytest.fixture
def user_headers() -> dict[str, str]:
    """构造普通用户角色的请求头（无审计权限）。"""
    return {"X-User-Role": ROLE_USER, "X-User-Id": "USER-001"}


@pytest.fixture
def now_utc() -> datetime:
    """返回当前 UTC 时间。"""
    return datetime.now(timezone.utc)


@pytest.fixture
def seed_audit_logs(db_session):
    """
    向数据库插入一批审计日志种子数据，覆盖多种操作类型与操作人。

    Args:
        db_session: 数据库会话

    Returns:
        插入的日志记录列表
    """
    records = []
    base_time = datetime.now(timezone.utc) - timedelta(days=3)

    # 为 U001 创建 LOGIN 类型记录
    for i in range(25):
        records.append(
            _make_audit_log(
                operator_id="U001",
                action_type="LOGIN",
                created_at=base_time + timedelta(hours=i),
            )
        )

    # 为 U002 创建 DELETE 类型记录
    for i in range(15):
        records.append(
            _make_audit_log(
                operator_id="U002",
                action_type="DELETE",
                created_at=base_time + timedelta(hours=i),
            )
        )

    # 为 U001 创建 UPDATE 类型记录
    for i in range(10):
        records.append(
            _make_audit_log(
                operator_id="U001",
                action_type="UPDATE",
                created_at=base_time + timedelta(hours=i),
            )
        )

    # 批量插入（假设使用 SQLAlchemy 风格）
    for rec in records:
        db_session.execute(
            """
            INSERT INTO audit_logs
                (id, operator_id, operator_name, action_type, resource_type,
                 resource_id, detail, ip_address, created_at)
            VALUES
                (:id, :operator_id, :operator_name, :action_type, :resource_type,
                 :resource_id, :detail, :ip_address, :created_at)
            """,
            rec,
        )
    db_session.commit()
    return records


# ===========================================================================
# ATB-01: 后端 API 多维筛选与分页
# ===========================================================================


class TestAuditLogListMultiFilter:
    """
    ATB-01: 后端 API 多维筛选与分页。

    验证 /api/v1/audit-log/list 支持多条件动态组合筛选与分页，
    包括 operator_id、action_type、时间范围等维度的精确过滤。
    """

    @pytest.mark.asyncio
    async def test_list_with_operator_and_action_filter(
        self, client: AsyncClient, admin_headers: dict, seed_audit_logs
    ):
        """
        同时按 operator_id=U001 和 action_type=LOGIN 筛选。

        期待：所有返回记录的 operator_id 均为 U001 且 action_type 均为 LOGIN。
        """
        now = datetime.now(timezone.utc)
        start = _utc_iso(now - timedelta(days=7))
        end = _utc_iso(now)

        resp = await client.get(
            API_LIST,
            params={
                "start_time": start,
                "end_time": end,
                "operator_id": "U001",
                "action_type": "LOGIN",
                "page": 1,
                "size": 20,
            },
            headers=admin_headers,
        )

        assert resp.status_code == 200, f"期望 200，实际 {resp.status_code}: {resp.text}"
        body = resp.json()

        # 返回结构包含 total 与 items
        assert "total" in body, "返回体缺少 total 字段"
        assert "items" in body, "返回体缺少 items 字段"

        items = body["items"]
        assert len(items) <= 20, f"单页记录数应 ≤ 20，实际 {len(items)}"

        # 所有记录满足筛选条件
        for item in items:
            assert item["operator_id"] == "U001", (
                f"记录 {item['id']} 的 operator_id 应为 U001，实际为 {item['operator_id']}"
            )
            assert item["action_type"] == "LOGIN", (
                f"记录 {item['id']} 的 action_type 应为 LOGIN，实际为 {item['action_type']}"
            )

    @pytest.mark.asyncio
    async def test_list_filter_by_operator_only(
        self, client: AsyncClient, admin_headers: dict, seed_audit_logs
    ):
        """
        仅按 operator_id 筛选。

        期待：所有返回记录的 operator_id 均为指定值，action_type 不受限。
        """
        now = datetime.now(timezone.utc)
        start = _utc_iso(now - timedelta(days=7))
        end = _utc_iso(now)

        resp = await client.get(
            API_LIST,
            params={
                "start_time": start,
                "end_time": end,
                "operator_id": "U002",
                "page": 1,
                "size": 50,
            },
            headers=admin_headers,
        )

        assert resp.status_code == 200
        body = resp.json()
        for item in body["items"]:
            assert item["operator_id"] == "U002"

    @pytest.mark.asyncio
    async def test_list_filter_by_action_type_only(
        self, client: AsyncClient, admin_headers: dict, seed_audit_logs
    ):
        """
        仅按 action_type 筛选。

        期待：所有返回记录的 action_type 均为指定值。
        """
        now = datetime.now(timezone.utc)
        start = _utc_iso(now - timedelta(days=7))
        end = _utc_iso(now)

        resp = await client.get(
            API_LIST,
            params={
                "start_time": start,
                "end_time": end,
                "action_type": "DELETE",
                "page": 1,
                "size": 50,
            },
            headers=admin_headers,
        )

        assert resp.status_code == 200
        body = resp.json()
        for item in body["items"]:
            assert item["action_type"] == "DELETE"

    @pytest.mark.asyncio
    async def test_list_pagination_default_size(
        self, client: AsyncClient, admin_headers: dict, seed_audit_logs
    ):
        """
        不指定 size 时默认分页大小为 50。

        期待：返回记录数 ≤ 50。
        """
        now = datetime.now(timezone.utc)
        start = _utc_iso(now - timedelta(days=7))
        end = _utc_iso(now)

        resp = await client.get(
            API_LIST,
            params={
                "start_time": start,
                "end_time": end,
                "page": 1,
            },
            headers=admin_headers,
        )

        assert resp.status_code == 200
        body = resp.json()
        assert len(body["items"]) <= DEFAULT_PAGE_SIZE

    @pytest.mark.asyncio
    async def test_list_pagination_max_size(
        self, client: AsyncClient, admin_headers: dict, seed_audit_logs
    ):
        """
        请求 size 超过上限 100 时应被截断为 100。

        期待：返回记录数 ≤ 100。
        """
        now = datetime.now(timezone.utc)
        start = _utc_iso(now - timedelta(days=7))
        end = _utc_iso(now)

        resp = await client.get(
            API_LIST,
            params={
                "start_time": start,
                "end_time": end,
                "page": 1,
                "size": 200,
            },
            headers=admin_headers,
        )

        assert resp.status_code == 200
        body = resp.json()
        assert len(body["items"]) <= MAX_PAGE_SIZE

    @pytest.mark.asyncio
    async def test_list_deep_pagination_offset_limit(
        self, client: AsyncClient, admin_headers: dict, seed_audit_logs
    ):
        """
        深度分页偏移量超过 10000 时应被拒绝。

        期待：HTTP 400 或返回错误提示。
        """
        now = datetime.now(timezone.utc)
        start = _utc_iso(now - timedelta(days=7))
        end = _utc_iso(now)

        # page=101, size=100 → offset=10000，刚好在边界
        # page=102, size=100 → offset=10100，超出限制
        resp = await client.get(
            API_LIST,
            params={
                "start_time": start,
                "end_time": end,
                "page": 102,
                "size": 100,
            },
            headers=admin_headers,
        )

        assert resp.status_code == 400, (
            f"深度分页偏移量超限应返回 400，实际 {resp.status_code}"
        )

    @pytest.mark.asyncio
    async def test_list_time_range_filter(
        self, client: AsyncClient, admin_headers: dict, seed_audit_logs
    ):
        """
        按时间范围筛选，所有返回记录的 created_at 应在范围内。

        期待：记录的 created_at 均处于 [start_time, end_time] 区间内。
        """
        now = datetime.now(timezone.utc)
        start_dt = now - timedelta(days=2)
        end_dt = now - timedelta(days=1)
        start = _utc_iso(start_dt)
        end = _utc_iso(end_dt)

        resp = await client.get(
            API_LIST,
            params={
                "start_time": start,
                "end_time": end,
                "page": 1,
                "size": 50,
            },
            headers=admin_headers,
        )

        assert resp.status_code == 200
        body = resp.json()
        for item in body["items"]:
            item_time = datetime.fromisoformat(
                item["created_at"].replace("Z", "+00:00")
            )
            assert start_dt <= item_time <= end_dt, (
                f"记录 {item['id']} 的 created_at {item['created_at']} 不在范围内"
            )

    @pytest.mark.asyncio
    async def test_list_returns_utc_iso8601(
        self, client: AsyncClient, admin_headers: dict, seed_audit_logs
    ):
        """
        返回的时间字段应为 UTC ISO 8601 格式。

        期待：created_at 以 'Z' 或 '+00:00' 结尾。
        """
        now = datetime.now(timezone.utc)
        start = _utc_iso(now - timedelta(days=7))
        end = _utc_iso(now)

        resp = await client.get(
            API_LIST,
            params={
                "start_time": start,
                "end_time": end,
                "page": 1,
                "size": 10,
            },
            headers=admin_headers,
        )

        assert resp.status_code == 200
        body = resp.json()
        for item in body["items"]:
            created_at = item["created_at"]
            assert created_at.endswith("Z") or "+00:00" in created_at, (
                f"时间 {created_at} 不符合 UTC ISO 8601 格式"
            )

    @pytest.mark.asyncio
    async def test_list_empty_result(
        self, client: AsyncClient, admin_headers: dict
    ):
        """
        筛选条件无匹配时返回空列表。

        期待：total=0, items=[]。
        """
        now = datetime.now(timezone.utc)
        start = _utc_iso(now - timedelta(days=1))
        end = _utc_iso(now)

        resp = await client.get(
            API_LIST,
            params={
                "start_time": start,
                "end_time": end,
                "operator_id": "NONEXISTENT-USER",
                "page": 1,
                "size": 50,
            },
            headers=admin_headers,
        )

        assert resp.status_code == 200
        body = resp.json()
        assert body["total"] == 0
        assert body["items"] == []


# ===========================================================================
# ATB-02: 后端 API 时间跨度越界拦截
# ===========================================================================


class TestAuditLogTimeSpanValidation:
    """
    ATB-02: 后端 API 时间跨度越界拦截。

    验证单次查询时间跨度不得超过 90 天，超出范围返回 400 Bad Request
    并包含明确的跨度超限提示信息。
    """

    @pytest.mark.asyncio
    async def test_time_span_exceeds_90_days(
        self, client: AsyncClient, admin_headers: dict
    ):
        """
        start_time 与 end_time 间隔超过 90 天。

        期待：HTTP 400，错误体包含跨度超限提示。
        """
        now = datetime.now(timezone.utc)
        start = _utc_iso(now - timedelta(days=91))
        end = _utc_iso(now)

        resp = await client.get(
            API_LIST,
            params={
                "start_time": start,
                "end_time": end,
                "page": 1,
                "size": 50,
            },
            headers=admin_headers,
        )

        assert resp.status_code == 400, (
            f"时间跨度超过 90 天应返回 400，实际 {resp.status_code}"
        )
        body = resp.json()
        # 错误体应包含明确的跨度超限提示
        error_msg = body.get("detail", "") or body.get("message", "") or str(body)
        assert any(
            keyword in error_msg for keyword in ["90", "跨度", "超限", "exceed", "span"]
        ), f"错误信息应包含跨度超限提示，实际: {error_msg}"

    @pytest.mark.asyncio
    async def test_time_span_exactly_90_days(
        self, client: AsyncClient, admin_headers: dict, seed_audit_logs
    ):
        """
        start_time 与 end_time 间隔恰好 90 天（边界值）。

        期待：HTTP 200，请求被正常处理。
        """
        now = datetime.now(timezone.utc)
        start = _utc_iso(now - timedelta(days=90))
        end = _utc_iso(now)

        resp = await client.get(
            API_LIST,
            params={
                "start_time": start,
                "end_time": end,
                "page": 1,
                "size": 50,
            },
            headers=admin_headers,
        )

        assert resp.status_code == 200, (
            f"时间跨度恰好 90 天应返回 200，实际 {resp.status_code}"
        )

    @pytest.mark.asyncio
    async def test_time_span_89_days(
        self, client: AsyncClient, admin_headers: dict, seed_audit_logs
    ):
        """
        start_time 与 end_time 间隔 89 天（边界内）。

        期待：HTTP 200，请求被正常处理。
        """
        now = datetime.now(timezone.utc)
        start = _utc_iso(now - timedelta(days=89))
        end = _utc_iso(now)

        resp = await client.get(
            API_LIST,
            params={
                "start_time": start,
                "end_time": end,
                "page": 1,
                "size": 50,
            },
            headers=admin_headers,
        )

        assert resp.status_code == 200

    @pytest.mark.asyncio
    async def test_time_span_exceeds_90_days_on_trend(
        self, client: AsyncClient, admin_headers: dict
    ):
        """
        趋势 API 同样受 90 天时间跨度约束。

        期待：HTTP 400，错误体包含跨度超限提示。
        """
        now = datetime.now(timezone.utc)
        start = _utc_iso(now - timedelta(days=100))
        end = _utc_iso(now)

        resp = await client.get(
            API_TREND,
            params={
                "start_time": start,
                "end_time": end,
            },
            headers=admin_headers,
        )

        assert resp.status_code == 400, (
            f"趋势 API 时间跨度超过 90 天应返回 400，实际 {resp.status_code}"
        )

    @pytest.mark.asyncio
    async def test_missing_start_time(
        self, client: AsyncClient, admin_headers: dict
    ):
        """
        缺少 start_time 参数。

        期待：HTTP 422（参数校验失败）。
        """
        now = datetime.now(timezone.utc)
        end = _utc_iso(now)

        resp = await client.get(
            API_LIST,
            params={
                "end_time": end,
                "page": 1,
                "size": 50,
            },
            headers=admin_headers,
        )

        assert resp.status_code == 422, (
            f"缺少 start_time 应返回 422，实际 {resp.status_code}"
        )

    @pytest.mark.asyncio
    async def test_missing_end_time(
        self, client: AsyncClient, admin_headers: dict
    ):
        """
        缺少 end_time 参数。

        期待：HTTP 422（参数校验失败）。
        """
        now = datetime.now(timezone.utc)
        start = _utc_iso(now - timedelta(days=7))

        resp = await client.get(
            API_LIST,
            params={
                "start_time": start,
                "page": 1,
                "size": 50,
            },
            headers=admin_headers,
        )

        assert resp.status_code == 422, (
            f"缺少 end_time 应返回 422，实际 {resp.status_code}"
        )

    @pytest.mark.asyncio
    async def test_start_after_end(
        self, client: AsyncClient, admin_headers: dict
    ):
        """
        start_time 晚于 end_time。

        期待：HTTP 400，返回时间范围无效提示。
        """
        now = datetime.now(timezone.utc)
        start = _utc_iso(now)
        end = _utc_iso(now - timedelta(days=7))

        resp = await client.get(
            API_LIST,
            params={
                "start_time": start,
                "end_time": end,
                "page": 1,
                "size": 50,
            },
            headers=admin_headers,
        )

        assert resp.status_code == 400, (
            f"start_time 晚于 end_time 应返回 400，实际 {resp.status_code}"
        )


# ===========================================================================
# ATB-03: 后端 API 趋势数据聚合
# ===========================================================================


class TestAuditLogTrendAggregation:
    """
    ATB-03: 后端 API 趋势数据聚合。

    验证 /api/v1/audit-log/trend 返回按时间粒度聚合的操作频次数据，
    粒度规则：≤7天按小时，8-30天按天，>30天按周。
    """

    @pytest.mark.asyncio
    async def test_trend_hourly_granularity_within_7_days(
        self, client: AsyncClient, admin_headers: dict, seed_audit_logs
    ):
        """
        时间范围 ≤ 7 天时按小时粒度聚合。

        期待：HTTP 200；数据点按小时聚合；每个数据点包含 timestamp 与 count；
              时间连续无断点。
        """
        now = datetime.now(timezone.utc)
        start = _utc_iso(now - timedelta(days=7))
        end = _utc_iso(now)

        resp = await client.get(
            API_TREND,
            params={
                "start_time": start,
                "end_time": end,
            },
            headers=admin_headers,
        )

        assert resp.status_code == 200, f"期望 200，实际 {resp.status_code}: {resp.text}"
        body = resp.json()

        # 返回数据点列表
        assert "data" in body or "items" in body, (
            f"趋势响应应包含 data 或 items 字段，实际: {list(body.keys())}"
        )
        data_points = body.get("data") or body.get("items")
        assert isinstance(data_points, list), "数据点应为列表"

        # 每个数据点包含 timestamp 与 count
        for point in data_points:
            assert "timestamp" in point, f"数据点缺少 timestamp 字段: {point}"
            assert "count" in point, f"数据点缺少 count 字段: {point}"
            assert isinstance(point["count"], int), f"count 应为整数，实际: {type(point['count'])}"

        # 时间连续无断点（按小时粒度，7天 = 168 小时）
        if len(data_points) > 1:
            timestamps = [
                datetime.fromisoformat(
                    p["timestamp"].replace("Z", "+00:00")
                )
                for p in data_points
            ]
            for i in range(1, len(timestamps)):
                diff = timestamps[i] - timestamps[i - 1]
                # 按小时粒度，间隔应为 1 小时
                assert diff == timedelta(hours=1), (
                    f"小时粒度数据点间隔应为 1 小时，实际: {diff}"
                )

    @pytest.mark.asyncio
    async def test_trend_daily_granularity_8_to_30_days(
        self, client: AsyncClient, admin_headers: dict, seed_audit_logs
    ):
        """
        时间范围 8-30 天时按天粒度聚合。

        期待：数据点按天聚合，相邻点间隔为 1 天。
        """
        now = datetime.now(timezone.utc)
        start = _utc_iso(now - timedelta(days=15))
        end = _utc_iso(now)

        resp = await client.get(
            API_TREND,
            params={
                "start_time": start,
                "end_time": end,
            },
            headers=admin_headers,
        )

        assert resp.status_code == 200
        body = resp.json()
        data_points = body.get("data") or body.get("items")
        assert isinstance(data_points, list)

        for point in data_points:
            assert "timestamp" in point
            assert "count" in point

        # 验证按天粒度
        if len(data_points) > 1:
            timestamps = [
                datetime.fromisoformat(
                    p["timestamp"].replace("Z", "+00:00")
                )
                for p in data_points
            ]
            for i in range(1, len(timestamps)):
                diff = timestamps[i] - timestamps[i - 1]
                assert diff == timedelta(days=1), (
                    f"天粒度数据点间隔应为 1 天，实际: {diff}"
                )

    @pytest.mark.asyncio
    async def test_trend_weekly_granularity_over_30_days(
        self, client: AsyncClient, admin_headers: dict, seed_audit_logs
    ):
        """
        时间范围 > 30 天时按周粒度聚合。

        期待：数据点按周聚合，相邻点间隔为 7 天。
        """
        now = datetime.now(timezone.utc)
        start = _utc_iso(now - timedelta(days=60))
        end = _utc_iso(now)

        resp = await client.get(
            API_TREND,
            params={
                "start_time": start,
                "end_time": end,
            },
            headers=admin_headers,
        )

        assert resp.status_code == 200
        body = resp.json()
        data_points = body.get("data") or body.get("items")
        assert isinstance(data_points, list)

        for point in data_points:
            assert "timestamp" in point
            assert "count" in point

        # 验证按周粒度
        if len(data_points) > 1:
            timestamps = [
                datetime.fromisoformat(
                    p["timestamp"].replace("Z", "+00:00")
                )
                for p in data_points
            ]
            for i in range(1, len(timestamps)):
                diff = timestamps[i] - timestamps[i - 1]
                assert diff == timedelta(weeks=1), (
                    f"周粒度数据点间隔应为 7 天，实际: {diff}"
                )

    @pytest.mark.asyncio
    async def test_trend_timestamps_in_utc(
        self, client: AsyncClient, admin_headers: dict, seed_audit_logs
    ):
        """
        趋势数据点的时间戳应为 UTC ISO 8601 格式。

        期待：timestamp 以 'Z' 或 '+00:00' 结尾。
        """
        now = datetime.now(timezone.utc)
        start = _utc_iso(now - timedelta(days=7))
        end = _utc_iso(now)

        resp = await client.get(
            API_TREND,
            params={
                "start_time": start,
                "end_time": end,
            },
            headers=admin_headers,
        )

        assert resp.status_code == 200
        body = resp.json()
        data_points = body.get("data") or body.get("items")

        for point in data_points:
            ts = point["timestamp"]
            assert ts.endswith("Z") or "+00:00" in ts, (
                f"趋势时间戳 {ts} 不符合 UTC ISO 8601 格式"
            )

    @pytest.mark.asyncio
    async def test_trend_with_action_type_filter(
        self, client: AsyncClient, admin_headers: dict, seed_audit_logs
    ):
        """
        趋势 API 支持 action_type 筛选。

        期待：HTTP 200，返回数据点仅统计指定操作类型。
        """
        now = datetime.now(timezone.utc)
        start = _utc_iso(now - timedelta(days=7))
        end = _utc_iso(now)

        resp = await client.get(
            API_TREND,
            params={
                "start_time": start,
                "end_time": end,
                "action_type": "LOGIN",
            },
            headers=admin_headers,
        )

        assert resp.status_code == 200
        body = resp.json()
        data_points = body.get("data") or body.get("items")
        assert isinstance(data_points, list)
        # 数据点应存在且结构正确
        for point in data_points:
            assert "timestamp" in point
            assert "count" in point

    @pytest.mark.asyncio
    async def test_trend_boundary_7_days_exactly(
        self, client: AsyncClient, admin_headers: dict, seed_audit_logs
    ):
        """
        时间范围恰好 7 天应按小时粒度。

        期待：数据点间隔为 1 小时。
        """
        now = datetime.now(timezone.utc)
        start = _utc_iso(now - timedelta(days=7))
        end = _utc_iso(now)

        resp = await client.get(
            API_TREND,
            params={
                "start_time": start,
                "end_time": end,
            },
            headers=admin_headers,
        )

        assert resp.status_code == 200
        body = resp.json()
        data_points = body.get("data") or body.get("items")

        if len(data_points) > 1:
            timestamps = [
                datetime.fromisoformat(
                    p["timestamp"].replace("Z", "+00:00")
                )
                for p in data_points
            ]
            diff = timestamps[1] - timestamps[0]
            assert diff == timedelta(hours=1), (
                f"恰好 7 天应按小时粒度，实际间隔: {diff}"
            )

    @pytest.mark.asyncio
    async def test_trend_boundary_8_days(
        self, client: AsyncClient, admin_headers: dict, seed_audit_logs
    ):
        """
        时间范围 8 天应按天粒度。

        期待：数据点间隔为 1 天。
        """
        now = datetime.now(timezone.utc)
        start = _utc_iso(now - timedelta(days=8))
        end = _utc_iso(now)

        resp = await client.get(
            API_TREND,
            params={
                "start_time": start,
                "end_time": end,
            },
            headers=admin_headers,
        )

        assert resp.status_code == 200
        body = resp.json()
        data_points = body.get("data") or body.get("items")

        if len(data_points) > 1:
            timestamps = [
                datetime.fromisoformat(
                    p["timestamp"].replace("Z", "+00:00")
                )
                for p in data_points
            ]
            diff = timestamps[1] - timestamps[0]
            assert diff == timedelta(days=1), (
                f"8 天应按天粒度，实际间隔: {diff}"
            )

    @pytest.mark.asyncio
    async def test_trend_boundary_30_days(
        self, client: AsyncClient, admin_headers: dict, seed_audit_logs
    ):
        """
        时间范围恰好 30 天应按天粒度。

        期待：数据点间隔为 1 天。
        """
        now = datetime.now(timezone.utc)
        start = _utc_iso(now - timedelta(days=30))
        end = _utc_iso(now)

        resp = await client.get(
            API_TREND,
            params={
                "start_time": start,
                "end_time": end,
            },
            headers=admin_headers,
        )

        assert resp.status_code == 200
        body = resp.json()
        data_points = body.get("data") or body.get("items")

        if len(data_points) > 1:
            timestamps = [
                datetime.fromisoformat(
                    p["timestamp"].replace("Z", "+00:00")
                )
                for p in data_points
            ]
            diff = timestamps[1] - timestamps[0]
            assert diff == timedelta(days=1), (
                f"30 天应按天粒度，实际间隔: {diff}"
            )

    @pytest.mark.asyncio
    async def test_trend_boundary_31_days(
        self, client: AsyncClient, admin_headers: dict, seed_audit_logs
    ):
        """
        时间范围 31 天应按周粒度。

        期待：数据点间隔为 7 天。
        """
        now = datetime.now(timezone.utc)
        start = _utc_iso(now - timedelta(days=31))
        end = _utc_iso(now)

        resp = await client.get(
            API_TREND,
            params={
                "start_time": start,
                "end_time": end,
            },
            headers=admin_headers,
        )

        assert resp.status_code == 200
        body = resp.json()
        data_points = body.get("data") or body.get("items")

        if len(data_points) > 1:
            timestamps = [
                datetime.fromisoformat(
                    p["timestamp"].replace("Z", "+00:00")
                )
                for p in data_points
            ]
            diff = timestamps[1] - timestamps[0]
            assert diff == timedelta(weeks=1), (
                f"31 天应按周粒度，实际间隔: {diff}"
            )


# ===========================================================================
# 权限约束测试
# ===========================================================================


class TestAuditLogPermission:
    """
    验证仅 admin/auditor 角色可访问审计日志 API，
    普通用户应被拒绝（403 Forbidden）。
    """

    @pytest.mark.asyncio
    async def test_admin_can_access_list(
        self, client: AsyncClient, admin_headers: dict, seed_audit_logs
    ):
        """admin 角色可访问列表 API。"""
        now = datetime.now(timezone.utc)
        start = _utc_iso(now - timedelta(days=7))
        end = _utc_iso(now)

        resp = await client.get(
            API_LIST,
            params={
                "start_time": start,
                "end_time": end,
                "page": 1,
                "size": 10,
            },
            headers=admin_headers,
        )

        assert resp.status_code == 200

    @pytest.mark.asyncio
    async def test_auditor_can_access_list(
        self, client: AsyncClient, auditor_headers: dict, seed_audit_logs
    ):
        """auditor 角色可访问列表 API。"""
        now = datetime.now(timezone.utc)
        start = _utc_iso(now - timedelta(days=7))
        end = _utc_iso(now)

        resp = await client.get(
            API_LIST,
            params={
                "start_time": start,
                "end_time": end,
                "page": 1,
                "size": 10,
            },
            headers=auditor_headers,
        )

        assert resp.status_code == 200

    @pytest.mark.asyncio
    async def test_normal_user_forbidden_list(
        self, client: AsyncClient, user_headers: dict
    ):
        """普通用户无权访问列表 API，应返回 403。"""
        now = datetime.now(timezone.utc)
        start = _utc_iso(now - timedelta(days=7))
        end = _utc_iso(now)

        resp = await client.get(
            API_LIST,
            params={
                "start_time": start,
                "end_time": end,
                "page": 1,
                "size": 10,
            },
            headers=user_headers,
        )

        assert resp.status_code == 403, (
            f"普通用户应被拒绝访问，期望 403，实际 {resp.status_code}"
        )

    @pytest.mark.asyncio
    async def test_normal_user_forbidden_trend(
        self, client: AsyncClient, user_headers: dict
    ):
        """普通用户无权访问趋势 API，应返回 403。"""
        now = datetime.now(timezone.utc)
        start = _utc_iso(now - timedelta(days=7))
        end = _utc_iso(now)

        resp = await client.get(
            API_TREND,
            params={
                "start_time": start,
                "end_time": end,
            },
            headers=user_headers,
        )

        assert resp.status_code == 403

    @pytest.mark.asyncio
    async def test_normal_user_forbidden_meta(
        self, client: AsyncClient, user_headers: dict
    ):
        """普通用户无权访问元数据 API，应返回 403。"""
        resp = await client.get(API_META, headers=user_headers)
        assert resp.status_code == 403

    @pytest.mark.asyncio
    async def test_unauthenticated_forbidden(
        self, client: AsyncClient
    ):
        """未认证用户无权访问，应返回 401。"""
        now = datetime.now(timezone.utc)
        start = _utc_iso(now - timedelta(days=7))
        end = _utc_iso(now)

        resp = await client.get(
            API_LIST,
            params={
                "start_time": start,
                "end_time": end,
                "page": 1,
                "size": 10,
            },
        )

        assert resp.status_code in (401, 403), (
            f"未认证用户应被拒绝，期望 401/403，实际 {resp.status_code}"
        )


# ===========================================================================
# 操作类型元数据 API 测试
# ===========================================================================


class TestAuditLogMeta:
    """
    验证 /api/v1/audit-log/meta 下发操作类型枚举，
    前端应动态渲染筛选项，禁止硬编码。
    """

    @pytest.mark.asyncio
    async def test_meta_returns_action_types(
        self, client: AsyncClient, admin_headers: dict
    ):
        """
        元数据接口返回操作类型枚举列表。

        期待：HTTP 200；返回结构包含 action_types 字段，为字符串数组。
        """
        resp = await client.get(API_META, headers=admin_headers)

        assert resp.status_code == 200
        body = resp.json()

        # 应包含 action_types 字段
        assert "action_types" in body, (
            f"元数据响应应包含 action_types 字段，实际: {list(body.keys())}"
        )
        action_types = body["action_types"]
        assert isinstance(action_types, list), "action_types 应为列表"

        # 每个元素应为非空字符串
        for at in action_types:
            assert isinstance(at, str) and len(at) > 0, (
                f"操作类型应为非空字符串，实际: {at}"
            )

    @pytest.mark.asyncio
    async def test_meta_includes_known_action_types(
        self, client: AsyncClient, admin_headers: dict
    ):
        """
        元数据应包含系统已知的操作类型。

        期待：LOGIN、DELETE 等核心操作类型存在于枚举中。
        """
        resp = await client.get(API_META, headers=admin_headers)

        assert resp.status_code == 200
        body = resp.json()
        action_types = body["action_types"]

        for expected_type in ["LOGIN", "DELETE", "UPDATE", "CREATE"]:
            assert expected_type in action_types, (
                f"操作类型 {expected_type} 应存在于元数据枚举中"
            )

    @pytest.mark.asyncio
    async def test_meta_action_types_unique(
        self, client: AsyncClient, admin_headers: dict
    ):
        """
        操作类型枚举不应有重复项。

        期待：action_types 列表无重复元素。
        """
        resp = await client.get(API_META, headers=admin_headers)

        assert resp.status_code == 200
        body = resp.json()
        action_types = body["action_types"]

        assert len(action_types) == len(set(action_types)), (
            "操作类型枚举存在重复项"
        )


# ===========================================================================
# 综合边界与异常场景测试
# ===========================================================================


class TestAuditLogEdgeCases:
    """
    综合边界与异常场景测试，覆盖无效参数、格式错误等。
    """

    @pytest.mark.asyncio
    async def test_invalid_start_time_format(
        self, client: AsyncClient, admin_headers: dict
    ):
        """
        start_time 格式非法。

        期待：HTTP 422（参数校验失败）。
        """
        now = datetime.now(timezone.utc)
        end = _utc_iso(now)

        resp = await client.get(
            API_LIST,
            params={
                "start_time": "not-a-date",
                "end_time": end,
                "page": 1,
                "size": 50,
            },
            headers=admin_headers,
        )

        assert resp.status_code == 422

    @pytest.mark.asyncio
    async def test_invalid_action_type(
        self, client: AsyncClient, admin_headers: dict, seed_audit_logs
    ):
        """
        action_type 不在合法枚举中。

        期待：HTTP 422 或 400，返回参数校验错误。
        """
        now = datetime.now(timezone.utc)
        start = _utc_iso(now - timedelta(days=7))
        end = _utc_iso(now)

        resp = await client.get(
            API_LIST,
            params={
                "start_time": start,
                "end_time": end,
                "action_type": "INVALID_ACTION",
                "page": 1,
                "size": 50,
            },
            headers=admin_headers,
        )

        assert resp.status_code in (400, 422), (
            f"非法 action_type 应返回 400/422，实际 {resp.status_code}"
        )

    @pytest.mark.asyncio
    async def test_negative_page_number(
        self, client: AsyncClient, admin_headers: dict
    ):
        """
        page 参数为负数。

        期待：HTTP 422（参数校验失败）。
        """
        now = datetime.now(timezone.utc)
        start = _utc_iso(now - timedelta(days=7))
        end = _utc_iso(now)

        resp = await client.get(
            API_LIST,
            params={
                "start_time": start,
                "end_time": end,
                "page": -1,
                "size": 50,
            },
            headers=admin_headers,
        )

        assert resp.status_code == 422

    @pytest.mark.asyncio
    async def test_zero_page_size(
        self, client: AsyncClient, admin_headers: dict
    ):
        """
        size 参数为 0。

        期待：HTTP 422（参数校验失败）。
        """
        now = datetime.now(timezone.utc)
        start = _utc_iso(now - timedelta(days=7))
        end = _utc_iso(now)

        resp = await client.get(
            API_LIST,
            params={
                "start_time": start,
                "end_time": end,
                "page": 1,
                "size": 0,
            },
            headers=admin_headers,
        )

        assert resp.status_code == 422

    @pytest.mark.asyncio
    async def test_list_response_structure(
        self, client: AsyncClient, admin_headers: dict, seed_audit_logs
    ):
        """
        验证列表 API 返回的完整数据结构。

        期待：每条记录包含 id, operator_id, operator_name, action_type,
              resource_type, resource_id, detail, ip_address, created_at 字段。
        """
        now = datetime.now(timezone.utc)
        start = _utc_iso(now - timedelta(days=7))
        end = _utc_iso(now)

        resp = await client.get(
            API_LIST,
            params={
                "start_time": start,
                "end_time": end,
                "page": 1,
                "size": 10,
            },
            headers=admin_headers,
        )

        assert resp.status_code == 200
        body = resp.json()
        assert "total" in body
        assert "items" in body

        required_fields = [
            "id",
            "operator_id",
            "operator_name",
            "action_type",
            "resource_type",
            "resource_id",
            "detail",
            "ip_address",
            "created_at",
        ]

        for item in body["items"]:
            for field in required_fields:
                assert field in item, (
                    f"记录缺少必要字段 {field}，可用字段: {list(item.keys())}"
                )

    @pytest.mark.asyncio
    async def test_trend_with_operator_id_filter(
        self, client: AsyncClient, admin_headers: dict, seed_audit_logs
    ):
        """
        趋势 API 支持 operator_id 筛选。

        期待：HTTP 200，返回数据点仅统计指定操作人。
        """
        now = datetime.now(timezone.utc)
        start = _utc_iso(now - timedelta(days=7))
        end = _utc_iso(now)

        resp = await client.get(
            API_TREND,
            params={
                "start_time": start,
                "end_time": end,
                "operator_id": "U001",
            },
            headers=admin_headers,
        )

        assert resp.status_code == 200
        body = resp.json()
        data_points = body.get("data") or body.get("items")
        assert isinstance(data_points, list)