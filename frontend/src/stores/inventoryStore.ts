/**
 * @module inventoryStore
 * @description 盘点管理全局状态 Store (Zustand)
 *
 * 管理范围：
 * - 任务列表的筛选条件和分页参数（按状态筛选、搜索、分页）
 * - 当前选中的盘点任务 ID（用于详情页路由导航）
 * - 新建任务弹窗的开关状态
 * - 盘点执行页面中的行内编辑状态（当前编辑行 ID）
 * - 批量确认操作的选中资产集合
 *
 * 注意：任务数据、资产清单数据、盘盈盘亏汇总等服务端状态
 * 由 React Query hooks（useInventory）管理，不在此 store 中重复维护。
 */

import { create } from 'zustand';

// ---------------------------------------------------------------------------
// 类型定义
// ---------------------------------------------------------------------------

/**
 * 盘点任务状态枚举
 * 与后端 API 契约中的 status 字段对齐
 */
export type InventoryTaskStatus =
  | 'draft'
  | 'in_progress'
  | 'completed'
  | 'submitted';

/**
 * 盘点范围类型
 * 新建盘点任务时选择的范围模式：按位置 / 按分类 / 全部资产
 */
export type InventoryScopeType = 'location' | 'category' | 'all';

/**
 * 实盘状态下拉选项
 * 逐条确认或批量确认时选择的资产实际盘点状态
 */
export type InventoryActualStatus =
  | 'normal'
  | 'surplus'
  | 'deficit'
  | 'damaged'
  | 'other';

/**
 * 盘点任务列表筛选参数
 * 用于任务列表页左侧面板的状态筛选、搜索和分页控制
 */
export interface InventoryTaskFilterParams {
  /** 按状态筛选：草稿 / 进行中 / 已完成 / 已提交，undefined 表示全部 */
  status?: InventoryTaskStatus;
  /** 搜索关键词（模糊匹配任务名称） */
  searchQuery: string;
  /** 当前页码（从 1 开始） */
  page: number;
  /** 每页条数，默认 20（与 ATB-001 分页要求一致） */
  pageSize: number;
}

/**
 * 批量确认操作上限
 * 单次批量确认不超过 100 条（交互约束 #7）
 */
export const BATCH_CONFIRM_LIMIT = 100;

// ---------------------------------------------------------------------------
// Store 状态接口
// ---------------------------------------------------------------------------

/**
 * 盘点管理全局状态接口
 */
export interface InventoryState {
  // ─── 任务列表筛选与分页 ───────────────────────────────────
  /** 当前生效的筛选参数 */
  taskFilter: InventoryTaskFilterParams;

  // ─── 任务选择（详情页路由） ────────────────────────────────
  /** 当前选中的盘点任务 ID，用于路由导航至 `/inventory/tasks/:taskId` */
  selectedTaskId: string | null;

  // ─── 新建任务弹窗 ─────────────────────────────────────────
  /** 新建盘点任务弹窗是否可见 */
  isCreateModalOpen: boolean;

  // ─── 盘点执行页面 UI 状态 ─────────────────────────────────
  /** 当前正在行内编辑的资产行 ID，null 表示无行处于编辑态 */
  editingAssetId: string | null;
  /** 批量确认时选中的资产 ID 列表 */
  selectedAssetIds: string[];

  // ─── Actions ─────────────────────────────────────────────
  /** 浅合并更新筛选条件，更新后自动将 page 重置为 1 */
  setTaskFilter: (patch: Partial<InventoryTaskFilterParams>) => void;
  /** 重置筛选条件为默认值 */
  resetTaskFilter: () => void;
  /** 设置当前选中的任务 ID；切换任务时自动清空编辑和选中状态 */
  setSelectedTaskId: (taskId: string | null) => void;
  /** 控制新建任务弹窗的可见性 */
  setCreateModalOpen: (open: boolean) => void;
  /** 设置当前行内编辑的资产 ID */
  setEditingAssetId: (assetId: string | null) => void;
  /** 切换某个资产在批量选中集合中的选中/取消状态 */
  toggleAssetSelection: (assetId: string) => void;
  /** 根据可见资产 ID 列表执行全选或取消全选 */
  setAllAssetSelection: (visibleAssetIds: string[], selected: boolean) => void;
  /** 清空批量选中集合 */
  clearAssetSelection: () => void;
  /** 重置整个 store 到初始状态（用户离开盘点模块时调用） */
  resetStore: () => void;
}

// ---------------------------------------------------------------------------
// 默认值
// ---------------------------------------------------------------------------

/**
 * 筛选参数默认值
 * - pageSize = 20（ATB-001：每页 20 条）
 * - page = 1
 * - status / searchQuery 不限制
 */
const DEFAULT_FILTER: InventoryTaskFilterParams = {
  status: undefined,
  searchQuery: '',
  page: 1,
  pageSize: 20,
};

/**
 * Store 完整初始状态（不含 actions）
 */
const INITIAL_STATE = {
  taskFilter: { ...DEFAULT_FILTER } as InventoryTaskFilterParams,
  selectedTaskId: null as string | null,
  isCreateModalOpen: false,
  editingAssetId: null as string | null,
  selectedAssetIds: [] as string[],
};

// ---------------------------------------------------------------------------
// Store 创建
// ---------------------------------------------------------------------------

/**
 * 盘点管理全局 Zustand Store
 *
 * 使用方式：
 * ```tsx
 * const { taskFilter, setTaskFilter, selectedAssetIds } = useInventoryStore();
 * ```
 *
 * 设计原则：
 * 1. 仅存放客户端 UI 状态（筛选、选中、弹窗开关等），不缓存服务端数据
 * 2. 服务端数据（任务列表、资产清单、汇总）由 React Query hooks 管理
 * 3. 确认操作后通过 React Query cache invalidation 刷新数据，不在此 store 维护
 */
export const useInventoryStore = create<InventoryState>()((set) => ({
  ...INITIAL_STATE,

  /**
   * 浅合并更新筛选条件
   * 当筛选字段变化时自动将 page 重置为 1，避免空页问题
   *
   * @param patch - 需要更新的筛选字段（浅合并）
   */
  setTaskFilter: (patch) =>
    set((state) => ({
      taskFilter: {
        ...state.taskFilter,
        ...patch,
        // 筛选条件变化时自动回到第 1 页（仅当非显式设置 page 时）
        ...(patch.page === undefined ? { page: 1 } : {}),
      },
    })),

  /**
   * 重置筛选条件为默认值
   */
  resetTaskFilter: () =>
    set({
      taskFilter: { ...DEFAULT_FILTER },
    }),

  /**
   * 设置当前选中的任务 ID
   * 切换任务时自动清空执行页面的编辑行 ID 和批量选中集合，
   * 避免上一个任务的编辑状态残留到新任务
   *
   * @param taskId - 任务 UUID，传 null 表示取消选中
   */
  setSelectedTaskId: (taskId) =>
    set({
      selectedTaskId: taskId,
      editingAssetId: null,
      selectedAssetIds: [],
    }),

  /**
   * 控制新建盘点任务弹窗的可见性
   *
   * @param open - true 打开弹窗，false 关闭弹窗
   */
  setCreateModalOpen: (open) => set({ isCreateModalOpen: open }),

  /**
   * 设置当前行内编辑的资产行 ID
   * 同一时刻仅允许一行处于编辑态
   *
   * @param assetId - 资产 UUID，传 null 表示退出编辑态
   */
  setEditingAssetId: (assetId) => set({ editingAssetId: assetId }),

  /**
   * 切换某个资产在批量选中集合中的状态
   * 已选中则移除，未选中则追加
   *
   * @param assetId - 要切换选中状态的资产 UUID
   */
  toggleAssetSelection: (assetId) =>
    set((state) => {
      const current = state.selectedAssetIds;
      const index = current.indexOf(assetId);
      if (index >= 0) {
        return {
          selectedAssetIds: [
            ...current.slice(0, index),
            ...current.slice(index + 1),
          ],
        };
      }
      // 检查批量上限（交互约束 #7：单次不超过 100 条）
      if (current.length >= BATCH_CONFIRM_LIMIT) {
        return state;
      }
      return { selectedAssetIds: [...current, assetId] };
    }),

  /**
   * 根据当前可见资产 ID 列表执行全选或取消全选
   * 全选时受 BATCH_CONFIRM_LIMIT (100) 限制，超出部分截断
   *
   * @param visibleAssetIds - 当前页面可见的所有资产 ID 列表
   * @param selected - true 表示全选，false 表示取消全选
   */
  setAllAssetSelection: (visibleAssetIds, selected) =>
    set({
      selectedAssetIds: selected
        ? visibleAssetIds.slice(0, BATCH_CONFIRM_LIMIT)
        : [],
    }),

  /**
   * 清空批量选中集合
   */
  clearAssetSelection: () => set({ selectedAssetIds: [] }),

  /**
   * 重置整个 store 到初始状态
   * 通常在用户离开盘点管理模块（路由切换）时调用
   */
  resetStore: () =>
    set({
      ...INITIAL_STATE,
      taskFilter: { ...DEFAULT_FILTER },
    }),
}));

// ---------------------------------------------------------------------------
// 选择器（Selectors）
// ---------------------------------------------------------------------------

/**
 * 查询指定资产是否在批量选中集合中
 *
 * @param assetId - 资产 UUID
 * @returns Zustand selector 函数，返回该资产是否已被选中
 */
export const selectIsAssetSelected = (assetId: string) => (
  state: InventoryState,
): boolean => state.selectedAssetIds.includes(assetId);

/**
 * 查询当前批量选中的资产数量
 *
 * @returns Zustand selector 函数，返回选中数量
 */
export const selectSelectedCount = (state: InventoryState): number =>
  state.selectedAssetIds.length;

/**
 * 判断任务详情页是否为只读模式
 * 仅「进行中」状态允许编辑操作，「草稿」「已完成」「已提交」为只读
 *
 * @param status - 当前任务的状态
 * @returns true 表示页面应为只读模式
 */
export const isReadOnlyStatus = (
  status: InventoryTaskStatus | undefined | null,
): boolean => {
  if (!status) return true;
  return status !== 'in_progress';
};