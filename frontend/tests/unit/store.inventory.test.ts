/**
 * Unit tests for the Inventory Zustand Store (useInventoryStore)
 *
 * Validates Layer 2 state management per SWARM-P3-010-FE SPEC:
 *   - Task list filter conditions (status filter, pagination)
 *   - Currently selected task ID
 *   - Batch selected asset IDs for bulk confirm operations
 *   - Current editing row ID
 *   - Create-task modal visibility
 *   - Loading / error UI states
 *   - Scope validation helpers (scopeType + scopeIds)
 *   - Progress calculation utility
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useInventoryStore } from '../../src/stores/useInventoryStore';
import type {
  InventoryTaskStatus,
  ScopeType,
} from '../../src/types/inventory';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Return a fresh default state matching the store's initial shape. */
function getDefaultState() {
  return {
    statusFilter: null as InventoryTaskStatus | null,
    currentPage: 1,
    pageSize: 20,
    selectedTaskId: null as string | null,
    selectedAssetIds: [] as string[],
    editingRowId: null as string | null,
    isCreateModalOpen: false,
    loading: false,
    error: null as string | null,
  };
}

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------

describe('useInventoryStore', () => {
  beforeEach(() => {
    // Reset the store to a clean default state before every test.
    useInventoryStore.setState(getDefaultState());
    vi.clearAllMocks();
  });

  // =========================================================================
  // Initial state
  // =========================================================================

  describe('initial state', () => {
    it('should have correct default values', () => {
      const state = useInventoryStore.getState();

      expect(state.statusFilter).toBeNull();
      expect(state.currentPage).toBe(1);
      expect(state.pageSize).toBe(20);
      expect(state.selectedTaskId).toBeNull();
      expect(state.selectedAssetIds).toEqual([]);
      expect(state.editingRowId).toBeNull();
      expect(state.isCreateModalOpen).toBe(false);
      expect(state.loading).toBe(false);
      expect(state.error).toBeNull();
    });
  });

  // =========================================================================
  // Status filter
  // =========================================================================

  describe('setStatusFilter', () => {
    it('should set the status filter to a valid status', () => {
      const store = useInventoryStore.getState();
      store.setStatusFilter('in_progress');

      expect(useInventoryStore.getState().statusFilter).toBe('in_progress');
    });

    it.each([
      'draft' as InventoryTaskStatus,
      'in_progress' as InventoryTaskStatus,
      'completed' as InventoryTaskStatus,
      'submitted' as InventoryTaskStatus,
    ])('should accept status "%s"', (status) => {
      useInventoryStore.getState().setStatusFilter(status);
      expect(useInventoryStore.getState().statusFilter).toBe(status);
    });

    it('should clear the filter when null is passed', () => {
      useInventoryStore.getState().setStatusFilter('draft');
      useInventoryStore.getState().setStatusFilter(null);

      expect(useInventoryStore.getState().statusFilter).toBeNull();
    });

    it('should reset to page 1 when filter changes', () => {
      useInventoryStore.setState({ currentPage: 3 });
      useInventoryStore.getState().setStatusFilter('completed');

      expect(useInventoryStore.getState().currentPage).toBe(1);
    });
  });

  // =========================================================================
  // Pagination
  // =========================================================================

  describe('setPage', () => {
    it('should update the current page number', () => {
      useInventoryStore.getState().setPage(2);
      expect(useInventoryStore.getState().currentPage).toBe(2);
    });

    it('should not set page below 1', () => {
      useInventoryStore.getState().setPage(0);
      expect(useInventoryStore.getState().currentPage).toBe(1);
    });

    it('should not set page below 1 (negative)', () => {
      useInventoryStore.getState().setPage(-1);
      expect(useInventoryStore.getState().currentPage).toBe(1);
    });
  });

  describe('setPageSize', () => {
    it('should update the page size and reset to page 1', () => {
      useInventoryStore.setState({ currentPage: 3, pageSize: 20 });
      useInventoryStore.getState().setPageSize(50);

      expect(useInventoryStore.getState().pageSize).toBe(50);
      expect(useInventoryStore.getState().currentPage).toBe(1);
    });
  });

  // =========================================================================
  // Task selection
  // =========================================================================

  describe('setSelectedTaskId', () => {
    it('should set the selected task ID', () => {
      const taskId = '550e8400-e29b-41d4-a716-446655440000';
      useInventoryStore.getState().setSelectedTaskId(taskId);

      expect(useInventoryStore.getState().selectedTaskId).toBe(taskId);
    });

    it('should clear selection when null is passed', () => {
      useInventoryStore.getState().setSelectedTaskId('task-1');
      useInventoryStore.getState().setSelectedTaskId(null);

      expect(useInventoryStore.getState().selectedTaskId).toBeNull();
    });

    it('should clear asset selection when task changes', () => {
      useInventoryStore.setState({
        selectedTaskId: 'task-1',
        selectedAssetIds: ['asset-1', 'asset-2'],
      });

      useInventoryStore.getState().setSelectedTaskId('task-2');

      expect(useInventoryStore.getState().selectedTaskId).toBe('task-2');
      expect(useInventoryStore.getState().selectedAssetIds).toEqual([]);
    });

    it('should clear editing row when task changes', () => {
      useInventoryStore.setState({
        selectedTaskId: 'task-1',
        editingRowId: 'asset-1',
      });

      useInventoryStore.getState().setSelectedTaskId('task-2');

      expect(useInventoryStore.getState().editingRowId).toBeNull();
    });
  });

  // =========================================================================
  // Asset batch selection
  // =========================================================================

  describe('toggleAssetSelection', () => {
    it('should add an asset ID to the selection', () => {
      useInventoryStore.getState().toggleAssetSelection('asset-1');

      expect(useInventoryStore.getState().selectedAssetIds).toContain('asset-1');
    });

    it('should remove an already-selected asset ID', () => {
      useInventoryStore.setState({ selectedAssetIds: ['asset-1', 'asset-2'] });
      useInventoryStore.getState().toggleAssetSelection('asset-1');

      const ids = useInventoryStore.getState().selectedAssetIds;
      expect(ids).not.toContain('asset-1');
      expect(ids).toContain('asset-2');
    });

    it('should not duplicate an asset ID already in the selection', () => {
      useInventoryStore.setState({ selectedAssetIds: ['asset-1'] });
      useInventoryStore.getState().toggleAssetSelection('asset-1');

      const ids = useInventoryStore.getState().selectedAssetIds;
      expect(ids.filter((id: string) => id === 'asset-1')).toHaveLength(0);
    });
  });

  describe('selectAllAssets', () => {
    it('should replace selection with the provided asset IDs', () => {
      const allIds = ['a-1', 'a-2', 'a-3'];
      useInventoryStore.getState().selectAllAssets(allIds);

      expect(useInventoryStore.getState().selectedAssetIds).toEqual(allIds);
    });

    it('should enforce the 100-item batch limit from the SPEC', () => {
      const ids = Array.from({ length: 150 }, (_, i) => `asset-${i}`);
      useInventoryStore.getState().selectAllAssets(ids);

      expect(useInventoryStore.getState().selectedAssetIds).toHaveLength(100);
    });

    it('should not truncate when within the 100-item limit', () => {
      const ids = Array.from({ length: 99 }, (_, i) => `asset-${i}`);
      useInventoryStore.getState().selectAllAssets(ids);

      expect(useInventoryStore.getState().selectedAssetIds).toHaveLength(99);
    });
  });

  describe('clearAssetSelection', () => {
    it('should remove all selected asset IDs', () => {
      useInventoryStore.setState({ selectedAssetIds: ['a-1', 'a-2', 'a-3'] });
      useInventoryStore.getState().clearAssetSelection();

      expect(useInventoryStore.getState().selectedAssetIds).toEqual([]);
    });
  });

  describe('selectedAssetIdsCount', () => {
    it('should return the number of selected assets', () => {
      useInventoryStore.setState({ selectedAssetIds: ['a-1', 'a-2', 'a-3'] });

      const count = useInventoryStore.getState().getSelectedAssetCount();
      expect(count).toBe(3);
    });

    it('should return 0 when no assets are selected', () => {
      const count = useInventoryStore.getState().getSelectedAssetCount();
      expect(count).toBe(0);
    });
  });

  // =========================================================================
  // Editing row
  // =========================================================================

  describe('setEditingRowId', () => {
    it('should set the editing row ID', () => {
      useInventoryStore.getState().setEditingRowId('asset-42');

      expect(useInventoryStore.getState().editingRowId).toBe('asset-42');
    });

    it('should clear editing row when null is passed', () => {
      useInventoryStore.getState().setEditingRowId('asset-42');
      useInventoryStore.getState().setEditingRowId(null);

      expect(useInventoryStore.getState().editingRowId).toBeNull();
    });
  });

  // =========================================================================
  // Create-task modal
  // =========================================================================

  describe('openCreateModal / closeCreateModal', () => {
    it('should open the create-task modal', () => {
      useInventoryStore.getState().openCreateModal();
      expect(useInventoryStore.getState().isCreateModalOpen).toBe(true);
    });

    it('should close the create-task modal', () => {
      useInventoryStore.getState().openCreateModal();
      useInventoryStore.getState().closeCreateModal();
      expect(useInventoryStore.getState().isCreateModalOpen).toBe(false);
    });
  });

  // =========================================================================
  // Scope validation helpers
  // =========================================================================

  describe('validateScope', () => {
    it('should return valid when scopeType is "all"', () => {
      const result = useInventoryStore.getState().validateScope({
        scopeType: 'all' as ScopeType,
        scopeIds: [],
      });

      expect(result.valid).toBe(true);
      expect(result.error).toBeNull();
    });

    it('should return invalid when scopeType is "location" but no IDs selected', () => {
      const result = useInventoryStore.getState().validateScope({
        scopeType: 'location' as ScopeType,
        scopeIds: [],
      });

      expect(result.valid).toBe(false);
      expect(result.error).toContain('请选择盘点范围');
    });

    it('should return invalid when scopeType is "category" but no IDs selected', () => {
      const result = useInventoryStore.getState().validateScope({
        scopeType: 'category' as ScopeType,
        scopeIds: [],
      });

      expect(result.valid).toBe(false);
      expect(result.error).toContain('请选择盘点范围');
    });

    it('should return valid when scopeType is "location" with at least one ID', () => {
      const result = useInventoryStore.getState().validateScope({
        scopeType: 'location' as ScopeType,
        scopeIds: ['loc-1'],
      });

      expect(result.valid).toBe(true);
    });

    it('should return valid when scopeType is "category" with at least one ID', () => {
      const result = useInventoryStore.getState().validateScope({
        scopeType: 'category' as ScopeType,
        scopeIds: ['cat-1', 'cat-2'],
      });

      expect(result.valid).toBe(true);
    });
  });

  // =========================================================================
  // Task name validation
  // =========================================================================

  describe('validateTaskName', () => {
    it('should reject empty task name', () => {
      const result = useInventoryStore.getState().validateTaskName('');
      expect(result.valid).toBe(false);
    });

    it('should reject whitespace-only task name', () => {
      const result = useInventoryStore.getState().validateTaskName('   ');
      expect(result.valid).toBe(false);
    });

    it('should reject task name exceeding 50 characters', () => {
      const longName = 'a'.repeat(51);
      const result = useInventoryStore.getState().validateTaskName(longName);
      expect(result.valid).toBe(false);
    });

    it('should accept valid task name within 1-50 characters', () => {
      const result = useInventoryStore.getState().validateTaskName('2024Q4办公室盘点');
      expect(result.valid).toBe(true);
    });

    it('should accept task name exactly 50 characters', () => {
      const name50 = 'a'.repeat(50);
      const result = useInventoryStore.getState().validateTaskName(name50);
      expect(result.valid).toBe(true);
    });
  });

  // =========================================================================
  // Progress calculation
  // =========================================================================

  describe('calculateProgress', () => {
    it('should return 0 when total is 0', () => {
      const progress = useInventoryStore.getState().calculateProgress(0, 0);
      expect(progress).toBe(0);
    });

    it('should return 0 when total is negative', () => {
      const progress = useInventoryStore.getState().calculateProgress(5, -1);
      expect(progress).toBe(0);
    });

    it('should calculate progress correctly with 1 decimal place', () => {
      // 60 / 100 = 60.0%
      const progress = useInventoryStore.getState().calculateProgress(60, 100);
      expect(progress).toBeCloseTo(60.0, 1);
    });

    it('should handle fractional percentages', () => {
      // 1 / 3 ≈ 33.3%
      const progress = useInventoryStore.getState().calculateProgress(1, 3);
      expect(progress).toBeGreaterThanOrEqual(33);
      expect(progress).toBeLessThanOrEqual(34);
    });

    it('should cap at 100 when counted exceeds total', () => {
      const progress = useInventoryStore.getState().calculateProgress(110, 100);
      expect(progress).toBeLessThanOrEqual(100);
    });

    it('should return 100 when all assets are counted', () => {
      const progress = useInventoryStore.getState().calculateProgress(50, 50);
      expect(progress).toBe(100);
    });
  });

  // =========================================================================
  // Error & loading state
  // =========================================================================

  describe('setError', () => {
    it('should set an error message', () => {
      useInventoryStore.getState().setError('Network failure');
      expect(useInventoryStore.getState().error).toBe('Network failure');
    });

    it('should clear error when null is passed', () => {
      useInventoryStore.getState().setError('Network failure');
      useInventoryStore.getState().setError(null);
      expect(useInventoryStore.getState().error).toBeNull();
    });
  });

  describe('setLoading', () => {
    it('should set loading to true', () => {
      useInventoryStore.getState().setLoading(true);
      expect(useInventoryStore.getState().loading).toBe(true);
    });

    it('should set loading to false', () => {
      useInventoryStore.setState({ loading: true });
      useInventoryStore.getState().setLoading(false);
      expect(useInventoryStore.getState().loading).toBe(false);
    });
  });

  // =========================================================================
  // Full reset
  // =========================================================================

  describe('reset', () => {
    it('should restore the entire store to its initial state', () => {
      // Mutate state extensively
      useInventoryStore.setState({
        statusFilter: 'in_progress',
        currentPage: 5,
        pageSize: 50,
        selectedTaskId: 'task-x',
        selectedAssetIds: ['a', 'b', 'c'],
        editingRowId: 'row-1',
        isCreateModalOpen: true,
        loading: true,
        error: 'some error',
      });

      useInventoryStore.getState().reset();

      const state = useInventoryStore.getState();
      expect(state.statusFilter).toBeNull();
      expect(state.currentPage).toBe(1);
      expect(state.pageSize).toBe(20);
      expect(state.selectedTaskId).toBeNull();
      expect(state.selectedAssetIds).toEqual([]);
      expect(state.editingRowId).toBeNull();
      expect(state.isCreateModalOpen).toBe(false);
      expect(state.loading).toBe(false);
      expect(state.error).toBeNull();
    });
  });

  // =========================================================================
  // Read-only mode derived state
  // =========================================================================

  describe('isReadOnly', () => {
    it('should return false for "draft" status', () => {
      const readOnly = useInventoryStore.getState().isTaskReadOnly('draft');
      expect(readOnly).toBe(false);
    });

    it('should return false for "in_progress" status', () => {
      const readOnly = useInventoryStore.getState().isTaskReadOnly('in_progress');
      expect(readOnly).toBe(false);
    });

    it('should return true for "completed" status', () => {
      const readOnly = useInventoryStore.getState().isTaskReadOnly('completed');
      expect(readOnly).toBe(true);
    });

    it('should return true for "submitted" status', () => {
      const readOnly = useInventoryStore.getState().isTaskReadOnly('submitted');
      expect(readOnly).toBe(true);
    });
  });

  // =========================================================================
  // Remark validation
  // =========================================================================

  describe('validateRemark', () => {
    it('should accept empty remark', () => {
      const result = useInventoryStore.getState().validateRemark('');
      expect(result.valid).toBe(true);
    });

    it('should accept remark within 200 characters', () => {
      const result = useInventoryStore.getState().validateRemark('设备完好');
      expect(result.valid).toBe(true);
    });

    it('should accept remark exactly 200 characters', () => {
      const remark200 = 'a'.repeat(200);
      const result = useInventoryStore.getState().validateRemark(remark200);
      expect(result.valid).toBe(true);
    });

    it('should reject remark exceeding 200 characters', () => {
      const remark201 = 'a'.repeat(201);
      const result = useInventoryStore.getState().validateRemark(remark201);
      expect(result.valid).toBe(false);
    });
  });
});