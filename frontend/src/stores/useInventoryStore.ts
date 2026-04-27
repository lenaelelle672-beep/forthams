/**
 * useInventoryStore.ts
 *
 * Zustand store for managing client-side UI state of the Asset Inventory
 * Management module (SWARM-P3-010-FE).
 *
 * Responsibilities (client UI state only):
 *   - Task list filter conditions (status filter, pagination)
 *   - Currently selected task ID
 *   - Batch-selected asset IDs for bulk confirm operations
 *   - UI modal / dialog visibility flags
 *   - Inline editing state for asset rows
 *
 * Server-side state (task data, asset lists, summaries) is managed by
 * React Query hooks — see `src/hooks/useInventory.ts` and related files.
 *
 * @module stores/useInventoryStore
 */

import { create } from 'zustand';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** 盘点任务状态 */
export type InventoryTaskStatus =
  | 'draft'
  | 'in_progress'
  | 'completed'
  | 'submitted';

/** 任务列表状态筛选值（'all' 表示不筛选） */
export type StatusFilter = InventoryTaskStatus | 'all';

/** 分页状态 */
export interface PaginationState {
  /** 当前页码，从 1 开始 */
  currentPage: number;
  /** 每页条数，默认 20 */
  pageSize: number;
  /** 总记录数，由 API 响应填充 */
  total: number;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** 单次批量确认上限 (spec 交互约束 7) */
export const BATCH_CONFIRM_LIMIT = 100;

/** 默认每页条数 (spec 交互约束 1) */
export const DEFAULT_PAGE_SIZE = 20;

// ---------------------------------------------------------------------------
// Initial state factory
// ---------------------------------------------------------------------------

const createInitialState = () => ({
  statusFilter: 'all' as StatusFilter,
  pagination: {
    currentPage: 1,
    pageSize: DEFAULT_PAGE_SIZE,
    total: 0,
  },
  selectedTaskId: null as string | null,
  selectedAssetIds: [] as string[],
  createModalOpen: false,
  batchConfirmDialogOpen: false,
  submitConfirmDialogOpen: false,
  editingRowId: null as string | null,
});

// ---------------------------------------------------------------------------
// Store interface
// ---------------------------------------------------------------------------

export interface InventoryState {
  // ---- Task list filters ----
  /** 状态筛选条件 */
  statusFilter: StatusFilter;
  /** 分页状态 */
  pagination: PaginationState;

  // ---- Task selection ----
  /** 当前选中的盘点任务 ID */
  selectedTaskId: string | null;

  // ---- Asset batch selection ----
  /** 批量选中的资产 ID 列表 */
  selectedAssetIds: string[];

  // ---- UI flags ----
  /** 新建盘点任务弹窗是否打开 */
  createModalOpen: boolean;
  /** 批量确认对话框是否打开 */
  batchConfirmDialogOpen: boolean;
  /** 提交核准二次确认对话框是否打开 */
  submitConfirmDialogOpen: boolean;

  // ---- Inline editing ----
  /** 当前正在编辑的资产行 ID */
  editingRowId: string | null;

  // ---- Actions: Filters ----
  /** 设置状态筛选条件并重置页码 */
  setStatusFilter: (filter: StatusFilter) => void;
  /** 设置当前页码 */
  setCurrentPage: (page: number) => void;
  /** 设置每页条数并重置页码 */
  setPageSize: (size: number) => void;
  /** 设置分页总数（由 API 响应更新） */
  setPaginationTotal: (total: number) => void;
  /** 重置筛选条件为默认值 */
  resetFilters: () => void;

  // ---- Actions: Task selection ----
  /** 设置当前选中的任务；切换任务时自动清空资产选择和编辑状态 */
  setSelectedTaskId: (id: string | null) => void;

  // ---- Actions: Asset selection ----
  /** 切换单个资产的选中状态；已满 100 条时忽略新增 */
  toggleAssetSelection: (assetId: string) => void;
  /** 全选指定资产列表（受 BATCH_CONFIRM_LIMIT 限制自动截断） */
  selectAllAssets: (allAssetIds: string[]) => void;
  /** 清空所有已选资产 */
  clearAssetSelection: () => void;
  /** 批量添加资产到已选列表（受 BATCH_CONFIRM_LIMIT 限制） */
  addToSelection: (assetIds: string[]) => void;
  /** 从已选列表批量移除资产 */
  removeFromSelection: (assetIds: string[]) => void;

  // ---- Actions: UI toggles ----
  /** 切换新建任务弹窗可见性 */
  setCreateModalOpen: (open: boolean) => void;
  /** 切换批量确认对话框可见性 */
  setBatchConfirmDialogOpen: (open: boolean) => void;
  /** 切换提交核准确认对话框可见性 */
  setSubmitConfirmDialogOpen: (open: boolean) => void;

  // ---- Actions: Editing ----
  /** 设置当前正在编辑的资产行 ID */
  setEditingRowId: (id: string | null) => void;

  // ---- Actions: Reset ----
  /** 重置整个 store 到初始状态 */
  resetStore: () => void;
}

// ---------------------------------------------------------------------------
// Store implementation
// ---------------------------------------------------------------------------

export const useInventoryStore = create<InventoryState>((set, get) => ({
  ...createInitialState(),

  // ---- Filters ----

  /** 设置状态筛选条件并重置页码到第一页 */
  setStatusFilter: (filter) =>
    set({
      statusFilter: filter,
      pagination: { ...get().pagination, currentPage: 1 },
    }),

  /** 设置当前页码 */
  setCurrentPage: (page) =>
    set({ pagination: { ...get().pagination, currentPage: page } }),

  /** 设置每页条数并重置页码到第一页 */
  setPageSize: (size) =>
    set({
      pagination: { ...get().pagination, pageSize: size, currentPage: 1 },
    }),

  /** 设置分页总数（由 API 响应更新） */
  setPaginationTotal: (total) =>
    set({ pagination: { ...get().pagination, total } }),

  /** 重置筛选条件为默认值 */
  resetFilters: () =>
    set({
      statusFilter: 'all',
      pagination: {
        currentPage: 1,
        pageSize: DEFAULT_PAGE_SIZE,
        total: 0,
      },
    }),

  // ---- Task selection ----

  /**
   * 设置当前选中的任务 ID。
   * 切换任务时自动清空资产批量选择和编辑行状态，避免残留脏数据。
   */
  setSelectedTaskId: (id) =>
    set({
      selectedTaskId: id,
      selectedAssetIds: [],
      editingRowId: null,
    }),

  // ---- Asset selection ----

  /**
   * 切换单个资产的选中状态。
   * 如果当前已选数量达到 BATCH_CONFIRM_LIMIT (100) 则忽略新增操作。
   */
  toggleAssetSelection: (assetId) => {
    const current = get().selectedAssetIds;
    const isSelected = current.includes(assetId);

    if (isSelected) {
      set({ selectedAssetIds: current.filter((id) => id !== assetId) });
    } else {
      if (current.length >= BATCH_CONFIRM_LIMIT) {
        return;
      }
      set({ selectedAssetIds: [...current, assetId] });
    }
  },

  /**
   * 全选指定资产列表。
   * 受 BATCH_CONFIRM_LIMIT 限制，超出部分自动截断（交互约束 7）。
   */
  selectAllAssets: (allAssetIds) => {
    const capped = allAssetIds.slice(0, BATCH_CONFIRM_LIMIT);
    set({ selectedAssetIds: capped });
  },

  /** 清空所有已选资产 */
  clearAssetSelection: () => set({ selectedAssetIds: [] }),

  /**
   * 批量添加资产到已选列表。
   * 受 BATCH_CONFIRM_LIMIT 限制，只添加未超限的部分。
   */
  addToSelection: (assetIds) => {
    const current = get().selectedAssetIds;
    const currentSet = new Set(current);
    const remaining = BATCH_CONFIRM_LIMIT - current.length;
    const toAdd: string[] = [];

    for (const id of assetIds) {
      if (toAdd.length >= remaining) break;
      if (!currentSet.has(id)) {
        toAdd.push(id);
      }
    }

    if (toAdd.length > 0) {
      set({ selectedAssetIds: [...current, ...toAdd] });
    }
  },

  /** 从已选列表批量移除资产 */
  removeFromSelection: (assetIds) => {
    const removeSet = new Set(assetIds);
    set({
      selectedAssetIds: get().selectedAssetIds.filter(
        (id) => !removeSet.has(id),
      ),
    });
  },

  // ---- UI toggles ----

  /** 切换新建任务弹窗可见性 */
  setCreateModalOpen: (open) => set({ createModalOpen: open }),

  /** 切换批量确认对话框可见性 */
  setBatchConfirmDialogOpen: (open) => set({ batchConfirmDialogOpen: open }),

  /** 切换提交核准确认对话框可见性 */
  setSubmitConfirmDialogOpen: (open) =>
    set({ submitConfirmDialogOpen: open }),

  // ---- Editing ----

  /** 设置当前正在编辑的资产行 ID */
  setEditingRowId: (id) => set({ editingRowId: id }),

  // ---- Reset ----

  /** 重置整个 store 到初始状态 */
  resetStore: () => set({ ...createInitialState() }),
}));

// ---------------------------------------------------------------------------
// Selectors (composable, each returns a stable reference for shallow compare)
// ---------------------------------------------------------------------------

/** 获取当前任务列表查询参数对象（用于 React Query queryKey / params） */
export const selectTaskListParams = (state: InventoryState) => ({
  status: state.statusFilter === 'all' ? undefined : state.statusFilter,
  page: state.pagination.currentPage,
  pageSize: state.pagination.pageSize,
});

/** 获取已选资产 ID 列表 */
export const selectSelectedAssetIds = (state: InventoryState) =>
  state.selectedAssetIds;

/** 获取已选资产数量 */
export const selectSelectedAssetCount = (state: InventoryState) =>
  state.selectedAssetIds.length;

/** 判断是否已达到批量确认上限 */
export const selectIsAtBatchLimit = (state: InventoryState) =>
  state.selectedAssetIds.length >= BATCH_CONFIRM_LIMIT;

/** 获取当前选中的任务 ID */
export const selectSelectedTaskId = (state: InventoryState) =>
  state.selectedTaskId;

/** 获取当前分页状态 */
export const selectPagination = (state: InventoryState) => state.pagination;

/** 获取状态筛选值 */
export const selectStatusFilter = (state: InventoryState) =>
  state.statusFilter;

// ---------------------------------------------------------------------------
// Utility helpers (pure functions, not hooks)
// ---------------------------------------------------------------------------

/**
 * 判断给定任务状态是否为只读模式。
 * 仅 'in_progress' 状态允许编辑操作 (交互约束 3)。
 *
 * @param status - 盘点任务状态
 * @returns true 表示只读，false 表示可编辑
 */
export const isTaskReadOnly = (
  status: InventoryTaskStatus | undefined,
): boolean => {
  if (status === undefined) return true;
  return status !== 'in_progress';
};

/**
 * 计算盘点进度百分比，精确到小数点后 1 位。
 * 公式: 已盘数 / 总资产数 × 100% (交互约束 8)
 *
 * @param counted - 已盘点资产数
 * @param total   - 总资产数
 * @returns 0.0 ~ 100.0 的进度百分比
 */
export const calculateProgress = (counted: number, total: number): number => {
  if (total <= 0) return 0;
  const raw = (counted / total) * 100;
  return Math.min(Math.round(raw * 10) / 10, 100);
};