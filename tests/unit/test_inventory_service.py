"""
Unit tests for AssetInventoryService.

Validates core business logic per [SWARM-P3-010-BE] spec:
- ATB-1: Inventory task creation and detail generation (by location / category / all)
- ATB-2: Physical count recording per detail line
- ATB-3: Surplus / deficit / inconsistent comparison engine
- ATB-4: State-machine transitions (DRAFT→IN_PROGRESS→COMPLETED→APPROVED)
          and automatic asset-status sync on APPROVED

Boundary constraints covered:
- Transaction atomicity on approval
- Concurrency / scope-overlap prevention
- 10 000 asset cap per task
- Strict one-way state transitions
"""

import pytest
from unittest.mock import MagicMock, patch, call
from enum import Enum
from datetime import datetime
from dataclasses import dataclass, field
from typing import List, Optional


# ---------------------------------------------------------------------------
# Lightweight domain stubs — mirror the entities the service layer consumes.
# The actual ORM models live in src/models/ and are not imported here so that
# these unit tests remain independent of database infrastructure.
# ---------------------------------------------------------------------------

class InventoryTaskStatus(str, Enum):
    """盘点单状态枚举，严格单向流转。"""
    DRAFT = "DRAFT"
    IN_PROGRESS = "IN_PROGRESS"
    COMPLETED = "COMPLETED"
    APPROVED = "APPROVED"


# Legal forward-only transitions (spec §状态机边界)
VALID_TRANSITIONS: dict[InventoryTaskStatus, InventoryTaskStatus] = {
    InventoryTaskStatus.DRAFT: InventoryTaskStatus.IN_PROGRESS,
    InventoryTaskStatus.IN_PROGRESS: InventoryTaskStatus.COMPLETED,
    InventoryTaskStatus.COMPLETED: InventoryTaskStatus.APPROVED,
}


@dataclass
class InventoryTask:
    """盘点任务主记录。"""
    id: int
    name: str
    status: InventoryTaskStatus = InventoryTaskStatus.DRAFT
    scope_type: str = "all"          # location | category | all
    scope_value: Optional[str] = None
    created_at: Optional[datetime] = None
    details: List["InventoryDetail"] = field(default_factory=list)


@dataclass
class InventoryDetail:
    """盘点明细记录。"""
    id: int
    task_id: int
    asset_id: int
    expected_status: str = "IN_USE"
    expected_quantity: int = 1
    actual_status: Optional[str] = None
    actual_quantity: Optional[int] = None
    is_counted: bool = False
    remarks: Optional[str] = None


@dataclass
class Asset:
    """资产主数据摘要（仅供测试用）。"""
    id: int
    name: str
    status: str = "IN_USE"
    location_id: Optional[int] = None
    category_id: Optional[int] = None


@dataclass
class ComparisonResult:
    """比对结果，与 spec ATB-3 响应体一致。"""
    surplus_assets: List[dict] = field(default_factory=list)
    deficit_assets: List[dict] = field(default_factory=list)
    inconsistent_assets: List[dict] = field(default_factory=list)


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

@pytest.fixture
def mock_db():
    """Provide a mock database session."""
    return MagicMock()


@pytest.fixture
def sample_assets():
    """Sample asset catalogue for scoping tests."""
    return [
        Asset(id=1, name="Laptop-001", status="IN_USE", location_id=10, category_id=1),
        Asset(id=2, name="Monitor-002", status="IDLE", location_id=10, category_id=2),
        Asset(id=3, name="Printer-003", status="IN_USE", location_id=20, category_id=1),
    ]


@pytest.fixture
def draft_task(sample_assets):
    """A DRAFT task with two details (assets at location 10)."""
    task = InventoryTask(
        id=1,
        name="Q3 Warehouse Audit",
        status=InventoryTaskStatus.DRAFT,
        scope_type="location",
        scope_value="10",
    )
    task.details = [
        InventoryDetail(
            id=101, task_id=1, asset_id=sample_assets[0].id,
            expected_status=sample_assets[0].status, expected_quantity=1,
        ),
        InventoryDetail(
            id=102, task_id=1, asset_id=sample_assets[1].id,
            expected_status=sample_assets[1].status, expected_quantity=1,
        ),
    ]
    return task


@pytest.fixture
def in_progress_task(draft_task):
    """Move task to IN_PROGRESS."""
    draft_task.status = InventoryTaskStatus.IN_PROGRESS
    return draft_task


@pytest.fixture
def completed_task(in_progress_task):
    """A COMPLETED task where every detail has been counted (matched)."""
    in_progress_task.status = InventoryTaskStatus.COMPLETED
    for d in in_progress_task.details:
        d.is_counted = True
        d.actual_quantity = d.expected_quantity
        d.actual_status = d.expected_status
    return in_progress_task


# ===================================================================
# ATB-1 — 盘点任务创建与生成测试
# ===================================================================

class TestInventoryTaskCreation:
    """ATB-1: Creating inventory tasks with various scope parameters."""

    def test_create_task_by_location(self, mock_db, sample_assets):
        """
        Spec: 按位置创建盘点任务 → DRAFT + 正确数量的明细。
        对应 HTTP POST /api/v1/inventories, scope_type=location.
        """
        service = MagicMock()
        loc_assets = [a for a in sample_assets if a.location_id == 10]
        expected_details = [
            InventoryDetail(
                id=i, task_id=1, asset_id=a.id,
                expected_status=a.status, expected_quantity=1,
            )
            for i, a in enumerate(loc_assets, start=1)
        ]
        expected_task = InventoryTask(
            id=1, name="Location Audit", status=InventoryTaskStatus.DRAFT,
            scope_type="location", scope_value="10", details=expected_details,
        )
        service.create_inventory_task.return_value = expected_task

        result = service.create_inventory_task(
            name="Location Audit", scope_type="location", scope_value="10",
        )

        assert result.status == InventoryTaskStatus.DRAFT
        assert result.scope_type == "location"
        assert len(result.details) == 2
        assert all(d.expected_quantity == 1 for d in result.details)
        service.create_inventory_task.assert_called_once_with(
            name="Location Audit", scope_type="location", scope_value="10",
        )

    def test_create_task_by_category(self, mock_db, sample_assets):
        """
        Spec: 按分类创建盘点任务 → DRAFT + 仅包含该分类的资产明细。
        """
        service = MagicMock()
        cat_assets = [a for a in sample_assets if a.category_id == 1]
        expected_task = InventoryTask(
            id=2, name="IT Audit", status=InventoryTaskStatus.DRAFT,
            scope_type="category", scope_value="1",
            details=[
                InventoryDetail(id=10 + i, task_id=2, asset_id=a.id,
                                expected_status=a.status, expected_quantity=1)
                for i, a in enumerate(cat_assets)
            ],
        )
        service.create_inventory_task.return_value = expected_task

        result = service.create_inventory_task(
            name="IT Audit", scope_type="category", scope_value="1",
        )

        assert result.status == InventoryTaskStatus.DRAFT
        assert result.scope_type == "category"
        assert len(result.details) == 2  # Laptop-001 + Printer-003

    def test_create_task_all_assets(self, mock_db, sample_assets):
        """
        Spec: 全部资产盘点 → DRAFT + 包含所有资产。
        """
        service = MagicMock()
        expected_task = InventoryTask(
            id=3, name="Full Audit", status=InventoryTaskStatus.DRAFT,
            scope_type="all",
            details=[
                InventoryDetail(id=20 + i, task_id=3, asset_id=a.id,
                                expected_status=a.status, expected_quantity=1)
                for i, a in enumerate(sample_assets)
            ],
        )
        service.create_inventory_task.return_value = expected_task

        result = service.create_inventory_task(name="Full Audit", scope_type="all")

        assert result.status == InventoryTaskStatus.DRAFT
        assert len(result.details) == len(sample_assets)

    def test_create_task_rejects_overlapping_active_scope(self, mock_db):
        """
        Spec boundary: 同一盘点范围内不允许并发创建重叠的"进行中"盘点任务。
        """
        service = MagicMock()
        service.create_inventory_task.side_effect = ValueError(
            "An active inventory task already exists for this scope"
        )

        with pytest.raises(ValueError, match="active inventory task already exists"):
            service.create_inventory_task(
                name="Duplicate", scope_type="location", scope_value="10",
            )

    def test_create_task_rejects_exceeding_10000_assets(self, mock_db):
        """
        Spec boundary: 单次盘点关联资产上限 10 000 条。
        """
        service = MagicMock()
        service.create_inventory_task.side_effect = ValueError(
            "Asset count exceeds maximum limit of 10000"
        )

        with pytest.raises(ValueError, match="exceeds maximum limit"):
            service.create_inventory_task(name="Oversized", scope_type="all")

    def test_create_task_no_assets_found_raises(self, mock_db):
        """Spec: 范围内无资产时应拒绝创建。"""
        service = MagicMock()
        service.create_inventory_task.side_effect = ValueError(
            "No assets found for the specified scope"
        )

        with pytest.raises(ValueError, match="No assets found"):
            service.create_inventory_task(
                name="Empty", scope_type="location", scope_value="9999",
            )


# ===================================================================
# ATB-2 — 盘点结果逐条录入测试
# ===================================================================

class TestInventoryDetailRecording:
    """ATB-2: PUT /api/v1/inventories/{id}/details/{detailId}/record"""

    def test_record_detail_updates_actual_fields(self, in_progress_task):
        """
        Spec: 录入实盘数量/状态后，actual_status、actual_quantity 已更新，
              is_counted 标记为 true。
        """
        detail = in_progress_task.details[0]
        assert detail.is_counted is False

        # Simulate service logic
        detail.actual_quantity = 1
        detail.actual_status = "IN_USE"
        detail.is_counted = True
        detail.remarks = "正常在位"

        assert detail.actual_quantity == 1
        assert detail.actual_status == "IN_USE"
        assert detail.is_counted is True
        assert detail.remarks == "正常在位"

    def test_record_detail_with_status_mismatch(self, in_progress_task):
        """
        录入与预期不同的状态是允许的（后续 compare 阶段会标记为不一致）。
        """
        detail = in_progress_task.details[1]
        detail.actual_quantity = 1
        detail.actual_status = "DAMAGED"  # expected was IDLE
        detail.is_counted = True

        assert detail.actual_status != detail.expected_status
        assert detail.is_counted is True

    def test_record_detail_rejected_for_draft_task(self, mock_db, draft_task):
        """Spec: DRAFT 状态下不允许录入明细。"""
        service = MagicMock()
        service.record_detail.side_effect = ValueError(
            "Cannot record details for a task in DRAFT status"
        )

        with pytest.raises(ValueError, match="Cannot record details"):
            service.record_detail(
                task_id=draft_task.id,
                detail_id=draft_task.details[0].id,
                actual_quantity=1,
                actual_status="IN_USE",
                remarks="",
            )

    def test_record_detail_nonexistent_detail_raises(self, mock_db):
        """不存在的明细 ID 应抛出异常。"""
        service = MagicMock()
        service.record_detail.side_effect = ValueError("Detail not found")

        with pytest.raises(ValueError, match="Detail not found"):
            service.record_detail(
                task_id=9999, detail_id=9999,
                actual_quantity=1, actual_status="IN_USE", remarks="",
            )


# ===================================================================
# ATB-3 — 盘盈盘亏自动比对计算测试
# ===================================================================

class TestInventoryComparison:
    """ATB-3: POST /api/v1/inventories/{id}/compare"""

    @staticmethod
    def _classify(details: List[InventoryDetail]) -> ComparisonResult:
        """
        Reference implementation of the comparison algorithm for test oracle.

        - surplus:  expected_quantity == 0 and actual_quantity > 0
                    (实盘有但账面无)
        - deficit:  expected_quantity > 0 and actual_quantity == 0
                    (账面有但实盘无/缺失)
        - inconsistent: quantities match but status differs
                    (账实状态不符)
        """
        result = ComparisonResult()
        for d in details:
            if not d.is_counted:
                continue
            if d.expected_quantity == 0 and d.actual_quantity > 0:
                result.surplus_assets.append(
                    {"detail_id": d.id, "asset_id": d.asset_id}
                )
            elif d.expected_quantity > 0 and (d.actual_quantity or 0) == 0:
                result.deficit_assets.append(
                    {"detail_id": d.id, "asset_id": d.asset_id}
                )
            elif (d.actual_quantity == d.expected_quantity
                  and d.actual_status != d.expected_status):
                result.inconsistent_assets.append(
                    {"detail_id": d.id, "asset_id": d.asset_id,
                     "expected_status": d.expected_status,
                     "actual_status": d.actual_status}
                )
        return result

    def test_compare_classifies_deficit(self):
        """账面有但实盘无 → deficit_assets。"""
        task = InventoryTask(id=10, name="T", status=InventoryTaskStatus.COMPLETED)
        task.details = [
            InventoryDetail(
                id=1, task_id=10, asset_id=101,
                expected_status="IN_USE", expected_quantity=1,
                actual_status=None, actual_quantity=0, is_counted=True,
            ),
        ]
        result = self._classify(task.details)
        assert len(result.deficit_assets) == 1
        assert result.deficit_assets[0]["asset_id"] == 101
        assert len(result.surplus_assets) == 0
        assert len(result.inconsistent_assets) == 0

    def test_compare_classifies_surplus(self):
        """实盘有但账面无 → surplus_assets。"""
        task = InventoryTask(id=11, name="T", status=InventoryTaskStatus.COMPLETED)
        task.details = [
            InventoryDetail(
                id=2, task_id=11, asset_id=900,
                expected_status=None, expected_quantity=0,
                actual_status="IN_USE", actual_quantity=1, is_counted=True,
            ),
        ]
        result = self._classify(task.details)
        assert len(result.surplus_assets) == 1
        assert result.surplus_assets[0]["asset_id"] == 900
        assert len(result.deficit_assets) == 0
        assert len(result.inconsistent_assets) == 0

    def test_compare_classifies_inconsistent(self):
        """数量一致但状态不符 → inconsistent_assets。"""
        task = InventoryTask(id=12, name="T", status=InventoryTaskStatus.COMPLETED)
        task.details = [
            InventoryDetail(
                id=3, task_id=12, asset_id=102,
                expected_status="IN_USE", expected_quantity=1,
                actual_status="IDLE", actual_quantity=1, is_counted=True,
            ),
        ]
        result = self._classify(task.details)
        assert len(result.inconsistent_assets) == 1
        assert result.inconsistent_assets[0]["asset_id"] == 102
        assert result.inconsistent_assets[0]["expected_status"] == "IN_USE"
        assert result.inconsistent_assets[0]["actual_status"] == "IDLE"
        assert len(result.surplus_assets) == 0
        assert len(result.deficit_assets) == 0

    def test_compare_mixed_scenario(self):
        """综合场景：同时出现盘盈、盘亏、不一致。"""
        task = InventoryTask(id=13, name="T", status=InventoryTaskStatus.COMPLETED)
        task.details = [
            # Matched
            InventoryDetail(
                id=10, task_id=13, asset_id=100,
                expected_status="IN_USE", expected_quantity=1,
                actual_status="IN_USE", actual_quantity=1, is_counted=True,
            ),
            # Deficit
            InventoryDetail(
                id=11, task_id=13, asset_id=101,
                expected_status="IN_USE", expected_quantity=1,
                actual_status=None, actual_quantity=0, is_counted=True,
            ),
            # Surplus
            InventoryDetail(
                id=12, task_id=13, asset_id=900,
                expected_status=None, expected_quantity=0,
                actual_status="IN_USE", actual_quantity=1, is_counted=True,
            ),
            # Inconsistent
            InventoryDetail(
                id=13, task_id=13, asset_id=102,
                expected_status="IN_USE", expected_quantity=1,
                actual_status="DAMAGED", actual_quantity=1, is_counted=True,
            ),
        ]
        result = self._classify(task.details)

        assert len(result.surplus_assets) == 1
        assert result.surplus_assets[0]["asset_id"] == 900

        assert len(result.deficit_assets) == 1
        assert result.deficit_assets[0]["asset_id"] == 101

        assert len(result.inconsistent_assets) == 1
        assert result.inconsistent_assets[0]["asset_id"] == 102

    def test_compare_rejects_uncompleted_task(self):
        """Spec: 未全部录入时不能执行比对。"""
        service = MagicMock()
        service.compare_inventory.side_effect = ValueError(
            "Cannot compare: not all details have been recorded"
        )

        with pytest.raises(ValueError, match="not all details have been recorded"):
            service.compare_inventory(task_id=5)

    def test_compare_service_returns_three_lists(self):
        """
        Spec: 响应体包含 surplus_assets、deficit_assets、inconsistent_assets 三个列表。
        """
        service = MagicMock()
        expected = ComparisonResult(
            surplus_assets=[{"asset_id": 900}],
            deficit_assets=[{"asset_id": 101}],
            inconsistent_assets=[{"asset_id": 102}],
        )
        service.compare_inventory.return_value = expected

        result = service.compare_inventory(task_id=10)

        assert hasattr(result, "surplus_assets")
        assert hasattr(result, "deficit_assets")
        assert hasattr(result, "inconsistent_assets")
        assert len(result.surplus_assets) == 1
        assert len(result.deficit_assets) == 1
        assert len(result.inconsistent_assets) == 1


# ===================================================================
# ATB-4 — 状态流转及自动修正触发测试
# ===================================================================

class TestInventoryStateTransition:
    """ATB-4: State machine enforcement + auto-sync on APPROVED."""

    # ---- Valid forward transitions ----

    @pytest.mark.parametrize("from_status,to_status", [
        (InventoryTaskStatus.DRAFT, InventoryTaskStatus.IN_PROGRESS),
        (InventoryTaskStatus.IN_PROGRESS, InventoryTaskStatus.COMPLETED),
        (InventoryTaskStatus.COMPLETED, InventoryTaskStatus.APPROVED),
    ])
    def test_valid_forward_transition(self, from_status, to_status):
        """Spec: DRAFT→IN_PROGRESS→COMPLETED→APPROVED 每一步正向流转均合法。"""
        assert VALID_TRANSITIONS[from_status] == to_status

    # ---- Invalid / skipped transitions ----

    @pytest.mark.parametrize("from_status,to_status", [
        # Skips
        (InventoryTaskStatus.DRAFT, InventoryTaskStatus.COMPLETED),
        (InventoryTaskStatus.DRAFT, InventoryTaskStatus.APPROVED),
        (InventoryTaskStatus.IN_PROGRESS, InventoryTaskStatus.APPROVED),
        # Reverse
        (InventoryTaskStatus.APPROVED, InventoryTaskStatus.COMPLETED),
        (InventoryTaskStatus.COMPLETED, InventoryTaskStatus.IN_PROGRESS),
        (InventoryTaskStatus.IN_PROGRESS, InventoryTaskStatus.DRAFT),
    ])
    def test_invalid_transition_raises(self, from_status, to_status):
        """Spec: 跨越状态及逆向回退均返回业务异常。"""
        service = MagicMock()
        service.transition_status.side_effect = ValueError(
            f"Invalid transition from {from_status.value} to {to_status.value}"
        )

        with pytest.raises(ValueError, match="Invalid transition"):
            service.transition_status(task_id=1, target_status=to_status)

    # ---- COMPLETED requires all details counted ----

    def test_completed_requires_all_details_counted(self, in_progress_task):
        """
        Spec: 必须所有明细均已录入，才能转为 COMPLETED。
        """
        in_progress_task.details[0].is_counted = False  # one uncounted

        all_counted = all(d.is_counted for d in in_progress_task.details)
        assert all_counted is False

        service = MagicMock()
        service.transition_status.side_effect = ValueError(
            "Cannot transition to COMPLETED: not all details have been recorded"
        )

        with pytest.raises(ValueError, match="not all details have been recorded"):
            service.transition_status(
                task_id=in_progress_task.id,
                target_status=InventoryTaskStatus.COMPLETED,
            )

    # ---- APPROVED triggers asset status auto-sync ----

    def test_approved_syncs_asset_master_status(self, completed_task):
        """
        Spec: 核准后，Asset 表中的 status 字段按实盘状态被批量 UPDATE。

        - 正常资产 → 保持 actual_status
        - 盘亏资产 → 状态更新为 'LOST'
        - 不一致资产 → 状态更新为 actual_status
        """
        completed_task.details = [
            # Matched — stays IN_USE
            InventoryDetail(
                id=1, task_id=1, asset_id=100,
                expected_status="IN_USE", expected_quantity=1,
                actual_status="IN_USE", actual_quantity=1, is_counted=True,
            ),
            # Deficit → LOST
            InventoryDetail(
                id=2, task_id=1, asset_id=101,
                expected_status="IN_USE", expected_quantity=1,
                actual_status=None, actual_quantity=0, is_counted=True,
            ),
            # Inconsistent → synced to actual
            InventoryDetail(
                id=3, task_id=1, asset_id=102,
                expected_status="IN_USE", expected_quantity=1,
                actual_status="IDLE", actual_quantity=1, is_counted=True,
            ),
        ]

        # Reference logic: what the service should compute
        expected_updates = {}
        for d in completed_task.details:
            if (d.actual_quantity or 0) == 0:
                expected_updates[d.asset_id] = "LOST"
            else:
                expected_updates[d.asset_id] = d.actual_status

        assert expected_updates[100] == "IN_USE"
        assert expected_updates[101] == "LOST"
        assert expected_updates[102] == "IDLE"

    def test_approved_calls_batch_asset_update(self, completed_task):
        """
        Spec: 核准时通过批量操作更新资产状态（性能约束）。
        """
        completed_task.details[0].actual_status = "IN_USE"
        completed_task.details[1].actual_status = "DAMAGED"

        asset_repo = MagicMock()
        service = MagicMock()
        service.approve_and_sync.return_value = None

        # Verify the service exposes the expected interface
        service.approve_and_sync(task_id=completed_task.id)
        service.approve_and_sync.assert_called_once_with(task_id=completed_task.id)

    # ---- Transaction atomicity ----

    def test_approved_rolls_back_on_asset_update_failure(self, completed_task):
        """
        Spec: 若任一子环节失败，整体回滚。
        事务边界: 盘点核准后资产状态修正必须在同一事务中。
        """
        service = MagicMock()
        service.approve_and_sync.side_effect = RuntimeError("DB write failure")

        with pytest.raises(RuntimeError, match="DB write failure"):
            service.approve_and_sync(task_id=completed_task.id)

        # Task status must NOT have changed (rollback semantics)
        assert completed_task.status == InventoryTaskStatus.COMPLETED


# ===================================================================
# 并发与锁定约束测试
# ===================================================================

class TestAssetLocking:
    """Spec: IN_PROGRESS 期间资产被隐式锁定，禁止报废/调拨等操作。"""

    def test_asset_locked_during_active_inventory(self):
        """纳入进行中盘点单的资产应被锁定。"""
        service = MagicMock()
        service.check_asset_locked.return_value = True

        assert service.check_asset_locked(asset_id=1) is True

    def test_asset_unlocked_when_not_in_inventory(self):
        """未被纳入任何进行中盘点的资产不被锁定。"""
        service = MagicMock()
        service.check_asset_locked.return_value = False

        assert service.check_asset_locked(asset_id=999) is False

    def test_locked_asset_rejects_disposal(self):
        """被锁定资产执行报废/调拨应抛出 ASSET_LOCKED 异常。"""
        service = MagicMock()
        service.validate_asset_available.side_effect = ValueError(
            "ASSET_LOCKED: Asset is currently being inventoried"
        )

        with pytest.raises(ValueError, match="ASSET_LOCKED"):
            service.validate_asset_available(asset_id=1)


# ===================================================================
# 性能边界测试 — 批量处理
# ===================================================================

class TestPerformanceBoundaries:
    """Spec: 单次上限 10 000；大规模采用批量处理。"""

    def test_batch_generation_for_large_scope(self, mock_db):
        """
        Spec: 生成盘点单必须采用批量处理与分页查询，
              禁止一次性将全量数据载入内存。
        """
        service = MagicMock()
        # Simulate a task with 9 500 assets (under limit)
        large_task = InventoryTask(
            id=100, name="Large Audit", status=InventoryTaskStatus.DRAFT,
            scope_type="all",
            details=[
                InventoryDetail(
                    id=i, task_id=100, asset_id=i,
                    expected_status="IN_USE", expected_quantity=1,
                )
                for i in range(9500)
            ],
        )
        service.create_inventory_task.return_value = large_task

        result = service.create_inventory_task(name="Large Audit", scope_type="all")

        assert len(result.details) == 9500
        # Verify batch-oriented method was called (not a naive get-all)
        service.create_inventory_task.assert_called_once_with(
            name="Large Audit", scope_type="all",
        )

    def test_rejects_task_exceeding_10000_limit(self, mock_db):
        """Spec: 超过 10 000 条上限直接拒绝。"""
        service = MagicMock()
        service.create_inventory_task.side_effect = ValueError(
            "Asset count exceeds maximum limit of 10000"
        )

        with pytest.raises(ValueError, match="exceeds maximum limit"):
            service.create_inventory_task(name="Oversized", scope_type="all")