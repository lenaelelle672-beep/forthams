/**
 * @file Unit tests for the inventory Zustand store (useInventoryStore).
 * @description Validates UI-state management: status filter, task selection,
 *   asset batch selection (with 100-item cap per SPEC §交互约束-7), modal
 *   visibility, submit-lock state, pagination, and reset.
 *
 *   Per SPEC SWARM-P3-010-FE Layer 2, the Zustand store manages *only*
 *   client-side UI state.  API interactions are covered in hooks-level and
 *   api-level tests (see hooks.inventory.test.ts / api.inventory.test.ts).
 */
import { describe, it, expect, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Store under test
// ---------------------------------------------------------------------------
import { useInventoryStore } from '../../../src/stores/inventoryStore';

// ---------------------------------------------------------------------------
// Types — aligned with SPEC §数据约束
// ---------------------------------------------------------------------------
type TaskStatus = 'draft' | 'in_progress' | 'completed' | 'submitted';

// ─── Helpers ────────────────────────────────────────────────────────────────

/** Snapshot of the store's pristine initial state, captured once. */
const initialSnapshot = { ...useInventoryStore.getState() };

/** Reset store to initial state before each test. */
function resetStore(): void {
  useInventoryStore.setState(initialSnapshot, true);
}

// ═══════════════════════════════════════════════════════════════════════════
// Test Suite
// ═══════════════════════════════════════════════════════════════════════════

describe('useInventoryStore (Zustand)', () => {
  beforeEach(resetStore);

  // ─── Initial State ─────────────────────────────────────────────────────

  describe('initial state', () => {
    it('should have null statusFilter by default (show all)', () => {
      expect(useInventoryStore.getState().statusFilter).toBeNull();
    });

    it('should have null selectedTaskId by default', () => {
      expect(useInventoryStore.getState().selectedTaskId).toBeNull();
    });

    it('should have empty selectedAssetIds by default', () => {
      expect(useInventoryStore.getState().selectedAssetIds).toEqual([]);
    });

    it('should have isCreateModalOpen false by default', () => {
      expect(useInventoryStore.getState().isCreateModalOpen).toBe(false);
    });

    it('should have isSubmitting false by default', () => {
      expect(useInventoryStore.getState().isSubmitting).toBe(false);
    });

    it('should have default currentPage of 1', () => {
      expect(useInventoryStore.getState().currentPage).toBe(1);
    });

    it('should have default pageSize of 20', () => {
      expect(useInventoryStore.getState().pageSize).toBe(20);
    });
  });

  // ─── Status Filter ─────────────────────────────────────────────────────
  // SPEC §交互约束-1: 按状态筛选（草稿/进行中/已完成/已提交）

  describe('setStatusFilter', () => {
    it.each([
      'draft',
      'in_progress',
      'completed',
      'submitted',
    ] as TaskStatus[])('should accept valid status value: %s', (status) => {
      useInventoryStore.getState().setStatusFilter(status);
      expect(useInventoryStore.getState().statusFilter).toBe(status);
    });

    it('should allow clearing the filter back to null (show all)', () => {
      useInventoryStore.getState().setStatusFilter('in_progress');
      useInventoryStore.getState().setStatusFilter(null);
      expect(useInventoryStore.getState().statusFilter).toBeNull();
    });

    it('should reset currentPage to 1 when filter changes', () => {
      useInventoryStore.getState().setCurrentPage(3);
      useInventoryStore.getState().setStatusFilter('draft');
      expect(useInventoryStore.getState().currentPage).toBe(1);
    });
  });

  // ─── Task Selection ────────────────────────────────────────────────────

  describe('selectTask', () => {
    it('should set selectedTaskId to the provided id', () => {
      useInventoryStore.getState().selectTask('task-uuid-001');
      expect(useInventoryStore.getState().selectedTaskId).toBe('task-uuid-001');
    });

    it('should allow deselecting by passing null', () => {
      useInventoryStore.getState().selectTask('task-uuid-001');
      useInventoryStore.getState().selectTask(null);
      expect(useInventoryStore.getState().selectedTaskId).toBeNull();
    });

    it('should clear selectedAssetIds when selecting a different task', () => {
      useInventoryStore.getState().toggleAssetSelection('asset-1');
      useInventoryStore.getState().toggleAssetSelection('asset-2');

      useInventoryStore.getState().selectTask('task-uuid-999');

      expect(useInventoryStore.getState().selectedAssetIds).toEqual([]);
    });

    it('should preserve selectedAssetIds when re-selecting the same task', () => {
      useInventoryStore.getState().selectTask('task-uuid-001');
      useInventoryStore.getState().toggleAssetSelection('asset-1');

      // Re-select same task
      useInventoryStore.getState().selectTask('task-uuid-001');

      expect(useInventoryStore.getState().selectedAssetIds).toEqual(['asset-1']);
    });
  });

  // ─── Asset Batch Selection ─────────────────────────────────────────────
  // SPEC §交互约束-4: 批量确认需先勾选表格行
  // SPEC §交互约束-7: 单次批量确认上限 100 条

  describe('toggleAssetSelection', () => {
    it('should add asset ID to selection when not already present', () => {
      useInventoryStore.getState().toggleAssetSelection('asset-1');
      expect(useInventoryStore.getState().selectedAssetIds).toContain('asset-1');
    });

    it('should remove asset ID from selection when already present', () => {
      useInventoryStore.getState().toggleAssetSelection('asset-1');
      useInventoryStore.getState().toggleAssetSelection('asset-1');
      expect(useInventoryStore.getState().selectedAssetIds).not.toContain('asset-1');
    });

    it('should maintain insertion order for multiple selections', () => {
      const { toggleAssetSelection } = useInventoryStore.getState();
      toggleAssetSelection('asset-1');
      toggleAssetSelection('asset-2');
      toggleAssetSelection('asset-3');

      expect(useInventoryStore.getState().selectedAssetIds).toEqual([
        'asset-1',
        'asset-2',
        'asset-3',
      ]);
    });

    it('should not produce duplicates when toggling rapidly', () => {
      const { toggleAssetSelection } = useInventoryStore.getState();
      toggleAssetSelection('asset-1');
      toggleAssetSelection('asset-1');
      toggleAssetSelection('asset-1');

      const ids = useInventoryStore.getState().selectedAssetIds;
      const count = ids.filter((id: string) => id === 'asset-1').length;
      // After 3 toggles (add→remove→add), should have exactly 1 occurrence
      expect(count).toBe(1);
    });
  });

  describe('setSelectedAssetIds', () => {
    it('should replace the current selection with provided IDs', () => {
      useInventoryStore.getState().toggleAssetSelection('asset-old');
      useInventoryStore.getState().setSelectedAssetIds(['asset-new-1', 'asset-new-2']);

      expect(useInventoryStore.getState().selectedAssetIds).toEqual([
        'asset-new-1',
        'asset-new-2',
      ]);
    });

    it('should truncate to 100 items when exceeding the batch limit', () => {
      const ids = Array.from({ length: 120 }, (_, i) => `asset-${i + 1}`);
      useInventoryStore.getState().setSelectedAssetIds(ids);

      expect(useInventoryStore.getState().selectedAssetIds).toHaveLength(100);
    });

    it('should accept selections within the 100-item limit without truncation', () => {
      const ids = Array.from({ length: 50 }, (_, i) => `asset-${i + 1}`);
      useInventoryStore.getState().setSelectedAssetIds(ids);

      expect(useInventoryStore.getState().selectedAssetIds).toHaveLength(50);
    });

    it('should accept exactly 100 items without truncation', () => {
      const ids = Array.from({ length: 100 }, (_, i) => `asset-${i + 1}`);
      useInventoryStore.getState().setSelectedAssetIds(ids);

      expect(useInventoryStore.getState().selectedAssetIds).toHaveLength(100);
    });
  });

  describe('clearAssetSelection', () => {
    it('should empty the selectedAssetIds array', () => {
      useInventoryStore.getState().toggleAssetSelection('asset-1');
      useInventoryStore.getState().toggleAssetSelection('asset-2');

      useInventoryStore.getState().clearAssetSelection();

      expect(useInventoryStore.getState().selectedAssetIds).toEqual([]);
    });

    it('should be idempotent on an already-empty selection', () => {
      useInventoryStore.getState().clearAssetSelection();
      expect(useInventoryStore.getState().selectedAssetIds).toEqual([]);
    });
  });

  // ─── Create Modal ──────────────────────────────────────────────────────

  describe('setCreateModalOpen', () => {
    it('should open the create-task modal', () => {
      useInventoryStore.getState().setCreateModalOpen(true);
      expect(useInventoryStore.getState().isCreateModalOpen).toBe(true);
    });

    it('should close the create-task modal', () => {
      useInventoryStore.getState().setCreateModalOpen(true);
      useInventoryStore.getState().setCreateModalOpen(false);
      expect(useInventoryStore.getState().isCreateModalOpen).toBe(false);
    });
  });

  // ─── Submitting State ──────────────────────────────────────────────────
  // SPEC §交互约束-6: 防重复提交（按钮 loading + debounce）

  describe('setSubmitting', () => {
    it('should set isSubmitting to true', () => {
      useInventoryStore.getState().setSubmitting(true);
      expect(useInventoryStore.getState().isSubmitting).toBe(true);
    });

    it('should set isSubmitting back to false', () => {
      useInventoryStore.getState().setSubmitting(true);
      useInventoryStore.getState().setSubmitting(false);
      expect(useInventoryStore.getState().isSubmitting).toBe(false);
    });
  });

  // ─── Pagination ────────────────────────────────────────────────────────
  // SPEC §交互约束-1: 支持分页（每页 20 条）

  describe('setCurrentPage', () => {
    it('should update currentPage', () => {
      useInventoryStore.getState().setCurrentPage(2);
      expect(useInventoryStore.getState().currentPage).toBe(2);
    });

    it('should not set page below 1', () => {
      useInventoryStore.getState().setCurrentPage(0);
      expect(useInventoryStore.getState().currentPage).toBe(1);
    });

    it('should not set negative page', () => {
      useInventoryStore.getState().setCurrentPage(-1);
      expect(useInventoryStore.getState().currentPage).toBe(1);
    });
  });

  // ─── Reset ─────────────────────────────────────────────────────────────

  describe('reset', () => {
    it('should restore every managed field to its initial value', () => {
      const store = useInventoryStore;

      // Mutate all fields
      store.getState().setStatusFilter('in_progress');
      store.getState().selectTask('task-xyz');
      store.getState().toggleAssetSelection('a1');
      store.getState().setCreateModalOpen(true);
      store.getState().setSubmitting(true);
      store.getState().setCurrentPage(5);

      store.getState().reset();

      const state = store.getState();
      expect(state.statusFilter).toBeNull();
      expect(state.selectedTaskId).toBeNull();
      expect(state.selectedAssetIds).toEqual([]);
      expect(state.isCreateModalOpen).toBe(false);
      expect(state.isSubmitting).toBe(false);
      expect(state.currentPage).toBe(1);
    });
  });

  // ─── Computed helpers ──────────────────────────────────────────────────
  // SPEC §交互约束-8: 进度百分比精确到小数点后 1 位

  describe('hasSelectedAssets (derived)', () => {
    it('should return false when nothing is selected', () => {
      expect(useInventoryStore.getState().hasSelectedAssets()).toBe(false);
    });

    it('should return true when at least one asset is selected', () => {
      useInventoryStore.getState().toggleAssetSelection('asset-1');
      expect(useInventoryStore.getState().hasSelectedAssets()).toBe(true);
    });
  });
});