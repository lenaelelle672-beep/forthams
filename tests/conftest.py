"""
tests/conftest.py — Audit Dashboard 测试共享 Fixtures

为 ATB-001 ~ ATB-006 验收测试基准提供统一的数据库、客户端与种子数据设施。

核心职责:
    1. 创建隔离的测试数据库（SQLite in-memory），自动建表与索引
    2. 提供覆盖不同时间、操作类型、操作人的基准种子数据
    3. 提供异步 HTTP 测试客户端
    4. 提供百万级日志性能基准数据集（ATB-006）
    5. 提供各类时间范围 fixture 供多场景复用

索引依赖:
    audit_log 表必须具备 (created_at, operation_type, operator_id) 索引，
    由 _create_tables 在每次测试会话中自动创建。
"""

from __future__ import annotations

import asyncio
import time
import uuid
from contextlib import asynccontextmanager
from datetime import datetime, timedelta, timezone
from typing import AsyncGenerator, Dict, List, Optional, Tuple

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient

# ---------------------------------------------------------------------------
# 常量定义
# ---------------------------------------------------------------------------

# 时间跨度上限（天）
MAX_TIME_SPAN_DAYS = 90

# 默认查询时间范围（天）
DEFAULT_TIME_SPAN_DAYS = 7

# 操作人维度默认 Top N
DEFAULT_TOP_N = 20

# 操作人维度最大 Top N
MAX_TOP_N = 50

# 种子数据操作类型
OPERATION_TYPES = ["CREATE", "UPDATE", "DELETE", "EXPORT", "IMPORT", "APPROVE", "REJECT"]

# 种子数据操作人
OPERATORS = [f"operator_{i:03d}" for i in range(1, 31)]  # 30 个操作人

# 性能基准数据量
PERF_BENCHMARK_ROW_COUNT = 1_000_000


# ---------------------------------------------------------------------------
# 数据库辅助
# ---------------------------------------------------------------------------

def _get_audit_log_ddl() -> str:
    """返回 audit_log 表的建表 DDL（SQLite 方言）。

    包含 SPEC 要求的联合索引:
        - idx_audit_log_created_at  (created_at)
        - idx_audit_log_operation_type (operation_type)
        - idx_audit_log_operator_id (operator_id)
        - idx_audit_log_composite (created_at, operation_type, operator_id)
    """
    return """
    CREATE TABLE IF NOT EXISTS audit_log (
        id            TEXT PRIMARY KEY,
        operation_type TEXT NOT NULL,
        operator_id   TEXT NOT NULL,
        operator_name TEXT NOT NULL DEFAULT '',
        resource_type TEXT NOT NULL DEFAULT '',
        resource_id   TEXT NOT NULL DEFAULT '',
        detail        TEXT NOT NULL DEFAULT '',
        tenant_id     TEXT NOT NULL DEFAULT '',
        created_at    DATETIME NOT NULL,
        extra         TEXT NOT NULL DEFAULT '{}'
    );

    CREATE INDEX IF NOT EXISTS idx_audit_log_created_at
        ON audit_log (created_at);

    CREATE INDEX IF NOT EXISTS idx_audit_log_operation_type
        ON audit_log (operation_type);

    CREATE INDEX IF NOT EXISTS idx_audit_log_operator_id
        ON audit_log (operator_id);

    CREATE INDEX IF NOT EXISTS idx_audit_log_composite
        ON audit_log (created_at, operation_type, operator_id);
    """


async def _create_tables(db_connection) -> None:
    """在给定数据库连接上执行建表与索引创建。

    Args:
        db_connection: aiosqlite 连接对象
    """
    await db_connection.executescript(_get_audit_log_ddl())
    await db_connection.commit()


# ---------------------------------------------------------------------------
# 种子数据生成
# ---------------------------------------------------------------------------

def _generate_seed_rows(
    start_time: datetime,
    end_time: datetime,
    operation_types: Optional[List[str]] = None,
    operators: Optional[List[str]] = None,
    rows_per_day: int = 10,
) -> List[Tuple]:
    """生成指定时间范围内的审计日志种子行。

    每天为每种操作类型 × 每个操作人生成 rows_per_day 条记录，
    确保数据在时间、类型、操作人三个维度上均有充分覆盖。

    Args:
        start_time: 起始时间（含）
        end_time: 结束时间（含）
        operation_types: 操作类型列表，默认使用全局 OPERATION_TYPES
        operators: 操作人 ID 列表，默认使用全局 OPERATORS 前 10 个
        rows_per_day: 每种组合每天生成的行数

    Returns:
        元组列表，每个元组对应 audit_log 表的一行
    """
    op_types = operation_types or OPERATION_TYPES
    ops = operators or OPERATORS[:10]
    rows: List[Tuple] = []

    current_date = start_time.date()
    end_date = end_time.date()
    day_offset = 0

    while current_date <= end_date:
        for op_type in op_types:
            for operator_id in ops:
                for seq in range(rows_per_day):
                    row_time = datetime(
                        current_date.year,
                        current_date.month,
                        current_date.day,
                        hour=seq % 24,
                        minute=(seq * 7) % 60,
                        second=(seq * 13) % 60,
                        tzinfo=timezone.utc,
                    )
                    rows.append((
                        str(uuid.uuid4()),
                        op_type,
                        operator_id,
                        f"User_{operator_id}",
                        "Asset",
                        str(uuid.uuid4())[:8],
                        f"{op_type} operation by {operator_id}",
                        "tenant_default",
                        row_time.isoformat(),
                        "{}",
                    ))
        current_date += timedelta(days=1)
        day_offset += 1

    return rows


async def _insert_seed_data(db_connection, rows: List[Tuple]) -> None:
    """批量插入种子数据到 audit_log 表。

    使用 executemany 进行批量写入以提升性能。

    Args:
        db_connection: aiosqlite 连接对象
        rows: 由 _generate_seed_rows 生成的行元组列表
    """
    await db_connection.executemany(
        """
        INSERT INTO audit_log
            (id, operation_type, operator_id, operator_name,
             resource_type, resource_id, detail, tenant_id, created_at, extra)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        rows,
    )
    await db_connection.commit()


async def _generate_large_dataset(db_connection, row_count: int = PERF_BENCHMARK_ROW_COUNT) -> None:
    """生成百万级审计日志数据集，用于 ATB-006 性能基准测试。

    数据分布策略:
        - 时间范围: 最近 7 天
        - 操作类型: 均匀分布在 OPERATION_TYPES 中
        - 操作人: 均匀分布在 50 个操作人中
    采用分批插入（每批 50,000 行）以控制内存占用。

    Args:
        db_connection: aiosqlite 连接对象
        row_count: 目标行数，默认 1,000,000
    """
    batch_size = 50_000
    now = datetime.now(timezone.utc)
    seven_days_ago = now - timedelta(days=7)
    total_seconds = 7 * 24 * 3600

    inserted = 0
    while inserted < row_count:
        batch_rows: List[Tuple] = []
        batch_end = min(inserted + batch_size, row_count)
        for i in range(inserted, batch_end):
            offset_seconds = int((i / row_count) * total_seconds)
            row_time = seven_days_ago + timedelta(seconds=offset_seconds)
            op_type = OPERATION_TYPES[i % len(OPERATION_TYPES)]
            operator_id = f"operator_{(i % 50):03d}"
            batch_rows.append((
                str(uuid.uuid4()),
                op_type,
                operator_id,
                f"User_{operator_id}",
                "Asset",
                str(uuid.uuid4())[:8],
                f"{op_type} by {operator_id}",
                "tenant_default",
                row_time.isoformat(),
                "{}",
            ))
        await db_connection.executemany(
            """
            INSERT INTO audit_log
                (id, operation_type, operator_id, operator_name,
                 resource_type, resource_id, detail, tenant_id, created_at, extra)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            batch_rows,
        )
        await db_connection.commit()
        inserted = batch_end


# ---------------------------------------------------------------------------
# Fixtures — 数据库
# ---------------------------------------------------------------------------

@pytest_asyncio.fixture(scope="session")
async def _db_connection():
    """会话级 SQLite 内存数据库连接。

    在整个测试会话中共享同一数据库实例，避免重复建表开销。
    测试会话结束后自动关闭连接。
    """
    import aiosqlite

    db = await aiosqlite.connect(":memory:")
    db.row_factory = aiosqlite.Row
    await _create_tables(db)
    yield db
    await db.close()


@pytest_asyncio.fixture()
async def db(_db_connection):
    """函数级数据库 fixture。

    每个测试函数获得一个干净（已清空 audit_log）的数据库。
    测试结束后回滚或清空数据以保证隔离性。

    Args:
        _db_connection: 会话级共享数据库连接

    Yields:
        aiosqlite 连接对象（audit_log 表已清空）
    """
    await _db_connection.execute("DELETE FROM audit_log")
    await _db_connection.commit()
    yield _db_connection
    # 测试后清理：再次清空以保证下一个测试的隔离
    await _db_connection.execute("DELETE FROM audit_log")
    await _db_connection.commit()


# ---------------------------------------------------------------------------
# Fixtures — 种子数据
# ---------------------------------------------------------------------------

@pytest_asyncio.fixture()
async def seed_basic(db):
    """基础种子数据：最近 7 天，覆盖所有操作类型与前 10 个操作人。

    每种 (操作类型, 操作人) 组合每天 2 条记录，共:
        7 天 × 7 类型 × 10 操作人 × 2 = 980 条

    适用于 ATB-001, ATB-002, ATB-003, ATB-004, ATB-005。

    Args:
        db: 函数级数据库连接

    Returns:
        dict: 包含 seed metadata（start_time, end_time, total_rows 等）
    """
    now = datetime.now(timezone.utc)
    start_time = now - timedelta(days=7)
    rows = _generate_seed_rows(
        start_time=start_time,
        end_time=now,
        rows_per_day=2,
    )
    await _insert_seed_data(db, rows)
    return {
        "start_time": start_time,
        "end_time": now,
        "total_rows": len(rows),
        "operation_types": OPERATION_TYPES,
        "operators": OPERATORS[:10],
        "rows_per_day_per_combo": 2,
    }


@pytest_asyncio.fixture()
async def seed_3day_trend(db):
    """3 天趋势种子数据：用于 ATB-001 时间趋势聚合测试。

    3 天 × 7 类型 × 5 操作人 × 3 = 315 条
    每天记录数已知，便于断言数据点 count。

    Args:
        db: 函数级数据库连接

    Returns:
        dict: 包含 start_time, end_time, expected_daily_counts 等元数据
    """
    now = datetime.now(timezone.utc)
    start_time = now - timedelta(days=3)
    rows = _generate_seed_rows(
        start_time=start_time,
        end_time=now,
        operators=OPERATORS[:5],
        rows_per_day=3,
    )
    await _insert_seed_data(db, rows)

    # 计算每天的预期记录数
    daily_count = 7 * 5 * 3  # types × operators × rows_per_day
    expected_daily_counts = {}
    current = start_time.date()
    end_date = now.date()
    while current <= end_date:
        expected_daily_counts[current.isoformat()] = daily_count
        current += timedelta(days=1)

    return {
        "start_time": start_time,
        "end_time": now,
        "total_rows": len(rows),
        "expected_daily_counts": expected_daily_counts,
        "days_span": 3,
    }


@pytest_asyncio.fixture()
async def seed_operator_activity(db):
    """操作人活跃度种子数据：用于 ATB-003 操作人活跃度统计测试。

    为不同操作人生成不同数量的记录，确保 Top N 排序可验证。
    operator_001 最多（100条），operator_010 最少（10条）。

    Args:
        db: 函数级数据库连接

    Returns:
        dict: 包含 operator_expected_counts 等元数据
    """
    now = datetime.now(timezone.utc)
    start_time = now - timedelta(days=7)

    operator_expected_counts: Dict[str, int] = {}
    rows: List[Tuple] = []

    for idx, operator_id in enumerate(OPERATORS[:20], start=1):
        count = idx * 10  # operator_001=10, operator_002=20, ..., operator_020=200
        operator_expected_counts[operator_id] = count
        for seq in range(count):
            row_time = start_time + timedelta(
                seconds=int((seq / max(count, 1)) * 7 * 24 * 3600)
            )
            rows.append((
                str(uuid.uuid4()),
                OPERATION_TYPES[seq % len(OPERATION_TYPES)],
                operator_id,
                f"User_{operator_id}",
                "Asset",
                str(uuid.uuid4())[:8],
                f"op by {operator_id}",
                "tenant_default",
                row_time.isoformat(),
                "{}",
            ))

    await _insert_seed_data(db, rows)

    # 按 count 降序排列的预期操作人列表
    sorted_operators = sorted(
        operator_expected_counts.keys(),
        key=lambda op: operator_expected_counts[op],
        reverse=True,
    )

    return {
        "start_time": start_time,
        "end_time": now,
        "total_rows": len(rows),
        "operator_expected_counts": operator_expected_counts,
        "sorted_operators": sorted_operators,
    }


@pytest_asyncio.fixture()
async def seed_large_dataset(db):
    """百万级性能基准数据集：用于 ATB-006 查询性能基准测试。

    生成 1,000,000 条审计日志，时间范围为最近 7 天。
    仅在显式请求时生成，避免拖慢常规测试。

    Args:
        db: 函数级数据库连接

    Returns:
        dict: 包含 row_count, start_time, end_time 等元数据
    """
    now = datetime.now(timezone.utc)
    start_time = now - timedelta(days=7)

    await _generate_large_dataset(db, PERF_BENCHMARK_ROW_COUNT)

    return {
        "start_time": start_time,
        "end_time": now,
        "row_count": PERF_BENCHMARK_ROW_COUNT,
    }


# ---------------------------------------------------------------------------
# Fixtures — 时间范围
# ---------------------------------------------------------------------------

@pytest.fixture()
def time_range_3day():
    """3 天时间范围 fixture，用于 ATB-001。

    Returns:
        dict: 包含 start_time 和 end_time（datetime 对象）
    """
    now = datetime.now(timezone.utc)
    return {
        "start_time": now - timedelta(days=3),
        "end_time": now,
    }


@pytest.fixture()
def time_range_7day():
    """7 天时间范围 fixture，用于 ATB-002。

    Returns:
        dict: 包含 start_time 和 end_time（datetime 对象）
    """
    now = datetime.now(timezone.utc)
    return {
        "start_time": now - timedelta(days=7),
        "end_time": now,
    }


@pytest.fixture()
def time_range_91day():
    """91 天时间范围 fixture，用于 ATB-004 时间边界拦截测试。

    跨度超过 90 天上限，预期返回 400 Bad Request。

    Returns:
        dict: 包含 start_time 和 end_time（datetime 对象）
    """
    now = datetime.now(timezone.utc)
    return {
        "start_time": now - timedelta(days=91),
        "end_time": now,
    }


@pytest.fixture()
def time_range_future():
    """未来时间范围 fixture，用于 ATB-005 空数据集边缘测试。

    确保该范围内无任何日志写入。

    Returns:
        dict: 包含 start_time 和 end_time（datetime 对象）
    """
    now = datetime.now(timezone.utc)
    return {
        "start_time": now + timedelta(days=365),
        "end_time": now + timedelta(days=372),
    }


# ---------------------------------------------------------------------------
# Fixtures — HTTP 测试客户端
# ---------------------------------------------------------------------------

@pytest_asyncio.fixture()
async def client(db):
    """异步 HTTP 测试客户端 fixture。

    创建一个指向 FastAPI 应用的异步客户端，注入测试数据库依赖。
    每个测试函数获得独立的客户端实例。

    Args:
        db: 函数级数据库连接

    Yields:
        httpx.AsyncClient 实例
    """
    # 延迟导入，避免模块级别 ImportError
    try:
        from src.main import app
        from src.api.dependencies.db import get_db
    except ImportError:
        # 如果主应用结构不同，尝试备选导入路径
        try:
            from src.main import app
            # 如果没有显式的 get_db 依赖，直接使用 app
            get_db = None
        except ImportError:
            # 最终回退：创建一个最小 FastAPI 应用用于测试
            from fastapi import FastAPI
            app = FastAPI()
            get_db = None

    # 覆盖数据库依赖，使测试使用内存数据库
    if get_db is not None:
        app.dependency_overrides[get_db] = lambda: db

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://testserver") as ac:
        yield ac

    # 清理依赖覆盖
    if get_db is not None:
        app.dependency_overrides.clear()


# ---------------------------------------------------------------------------
# Fixtures — 性能计时
# ---------------------------------------------------------------------------

@pytest.fixture()
def timer():
    """高精度计时器 fixture，用于 ATB-006 性能基准测试。

    使用方式::

        def test_something(timer):
            with timer:
                ...  # 执行待测代码
            assert timer.elapsed < 0.5  # 500ms

    Returns:
        Timer 上下文管理器实例
    """

    class Timer:
        """简单的上下文管理器计时器。"""

        def __init__(self) -> None:
            """初始化计时器。"""
            self.elapsed: float = 0.0
            self._start: float = 0.0

        def __enter__(self) -> "Timer":
            """进入上下文，记录开始时间。

            Returns:
                Timer 实例自身
            """
            self._start = time.perf_counter()
            return self

        def __exit__(self, *args) -> None:
            """退出上下文，计算经过时间。"""
            self.elapsed = time.perf_counter() - self._start

    return Timer()


# ---------------------------------------------------------------------------
# Fixtures — 事件循环配置
# ---------------------------------------------------------------------------

@pytest.fixture(scope="session")
def event_loop():
    """会话级事件循环，确保所有异步 fixture 共享同一循环。

    Returns:
        asyncio 事件循环
    """
    loop = asyncio.new_event_loop()
    yield loop
    loop.close()


# ---------------------------------------------------------------------------
# pytest 配置钩子
# ---------------------------------------------------------------------------

def pytest_configure(config):
    """注册自定义标记。

    Args:
        config: pytest Config 对象
    """
    config.addinivalue_line(
        "markers", "benchmark: 性能基准测试标记（ATB-006），可能耗时较长"
    )
    config.addinivalue_line(
        "markers", "audit_dashboard: 审计仪表板相关测试标记"
    )


def pytest_collection_modifyitems(config, items):
    """为审计仪表板测试自动添加标记。

    Args:
        config: pytest Config 对象
        items: 收集到的测试项列表
    """
    for item in items:
        if "audit_dashboard" in item.nodeid or "audit" in item.nodeid.lower():
            item.add_marker(pytest.mark.audit_dashboard)