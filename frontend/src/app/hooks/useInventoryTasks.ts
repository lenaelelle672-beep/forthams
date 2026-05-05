import { useState, useEffect, useCallback, useMemo } from 'react';
import { http } from '../utils/api';

// ─── Type Definitions ────────────────────────────────────────────────────────

/** Status of an inventory task in its lifecycle */
export type InventoryTaskStatus = 'draft' | 'in_progress' | 'completed' | 'approved';

/** Real-time physical check status for an individual asset line item */
export type InventoryCheckStatus = 'not_counted' | 'surplus' | 'deficit' | 'matched';

/**
 * Represents a single inventory (stocktaking) task.
 * Maps to backend entity InventoryTask.
 */
export interface IInventoryTask {
  id: string;
  title: string;
  locationId?: string;
  locationName?: string;
  categoryIds?: string[];
  status: InventoryTaskStatus;
  totalAssetsCount: number;
  countedAssetsCount: number;
  createdAt: string;
  updatedAt: string;
}

/**
 * Represents an asset line-item within an inventory task.
 * Used in the editable inventory execution workbench table.
 */
export interface IAssetItem {
  id: string;
  assetCode: string;
  name: string;
  specifications?: string;
  currentStatus: 'in_use' | 'idle' | 'maintenance' | 'retired';
  inventoryStatus: InventoryCheckStatus;
  actualQuantity: number;
  expectedQuantity: number;
  locationId?: string;
  categoryIds?: string[];
  remark?: string;
}

/**
 * Aggregated summary computed on the frontend from the asset list.
 * Drives the top progress dashboard cards (ATB-03).
 */
export interface IInventorySummary {
  /** Total number of asset line items in this task */
  totalCount: number;
  /** Number of items already physically checked */
  countedCount: number;
  /** 盘盈: actual > expected or physically present but not in books */
  surplusCount: number;
  /** 盘亏: expected > actual or in books but physically missing */
  deficitCount: number;
  /** Exactly matched (账实相符) */
  matchedCount: number;
  /** Still pending physical check */
  notCountedCount: number;
  /** Overall progress percentage (0-100) */
  progressPercentage: number;
}

/** Query parameters for paginated, filtered task list fetching */
export interface ITaskQueryParams {
  page?: number;
  pageSize?: number;
  status?: InventoryTaskStatus;
  search?: string;
}

/** Payload for creating a new inventory task */
export interface ICreateTaskPayload {
  title: string;
  locationIds?: string[];
  categoryIds?: string[];
}

/** Return type of useInventoryTasks hook for external consumers */
export interface IUseInventoryTasksReturn {
  tasks: IInventoryTask[];
  loadingTasks: boolean;
  taskPagination: { current: number; pageSize: number };
  setTaskPagination: React.Dispatch<React.SetStateAction<{ current: number; pageSize: number }>>;
  taskFilters: { status?: InventoryTaskStatus; search?: string };
  setTaskFilters: React.Dispatch<React.SetStateAction<{ status?: InventoryTaskStatus; search?: string }>>;
  fetchTasks: (params?: ITaskQueryParams) => Promise<void>;
  selectedTaskId: string | null;
  setSelectedTaskId: React.Dispatch<React.SetStateAction<string | null>>;
  assets: IAssetItem[];
  loadingAssets: boolean;
  inventorySummary: IInventorySummary;
  createTask: (payload: ICreateTaskPayload) => Promise<IInventoryTask>;
  submitForApproval: (taskId: string) => Promise<void>;
  updateAssetStatus: (assetId: string, updates: Partial<IAssetItem>) => void;
  batchUpdateAssetStatus: (assetIds: string[], updates: Partial<IAssetItem>) => Promise<void>;
  error: string | null;
  clearError: () => void;
}

// ─── Hook Implementation ─────────────────────────────────────────────────────

/**
 * useInventoryTasks
 *
 * Custom hook that manages the full lifecycle of inventory (stocktaking) tasks.
 * Implements Phase 3 core requirements:
 *   - Task list fetching with pagination and status filtering (ATB-01)
 *   - Task creation with scope selection data (ATB-02)
 *   - Asset detail fetching and summary computation for the execution workbench (ATB-03)
 *   - Single and batch status updates with reactive summary recalculation (ATB-04)
 *   - Submit-for-approval flow targeting POST /api/inventory/approve (ATB-05)
 *
 * All "create" and "submit" operations go through backend APIs; the hook only
 * computes intermediate derived state (progress, surplus/deficit stats) locally.
 */
export function useInventoryTasks(): IUseInventoryTasksReturn {
  // ── Task list state ─────────────────────────────────────────────────────
  const [tasks, setTasks] = useState<IInventoryTask[]>([]);
  const [loadingTasks, setLoadingTasks] = useState(false);
  const [taskPagination, setTaskPagination] = useState({ current: 1, pageSize: 10 });
  const [taskFilters, setTaskFilters] = useState<{ status?: InventoryTaskStatus; search?: string }>({});

  // ── Selected task / asset detail state ───────────────────────────────────
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [assets, setAssets] = useState<IAssetItem[]>([]);
  const [loadingAssets, setLoadingAssets] = useState(false);

  // ── General error state ─────────────────────────────────────────────────
  const [error, setError] = useState<string | null>(null);

  // ── Fetch task list ─────────────────────────────────────────────────────

  /**
   * Fetches the paginated, filtered inventory task list from the backend.
   * The API contract: GET /api/inventory/tasks?page=&pageSize=&status=&search=
   */
  const fetchTasks = useCallback(async (params: ITaskQueryParams = {}) => {
    setLoadingTasks(true);
    setError(null);
    try {
      const response = await http.get<{ items: IInventoryTask[]; total: number }>(
        '/api/inventory/tasks',
        { params }
      );
      setTasks(response.data.items ?? []);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to fetch inventory tasks';
      setError(message);
    } finally {
      setLoadingTasks(false);
    }
  }, []);

  // ── Create task ─────────────────────────────────────────────────────────

  /**
   * Creates a new inventory task via POST /api/inventory/tasks.
   * After successful creation, refreshes the task list so the new task appears.
   */
  const createTask = useCallback(async (payload: ICreateTaskPayload): Promise<IInventoryTask> => {
    setError(null);
    try {
      const response = await http.post<IInventoryTask>('/api/inventory/tasks', payload);
      // Refresh the list so the newly created task is visible
      await fetchTasks();
      return response.data;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to create inventory task';
      setError(message);
      throw new Error(message);
    }
  }, [fetchTasks]);

  // ── Fetch task detail (asset list) ──────────────────────────────────────

  /**
   * Loads the full asset item list for a given inventory task.
   * The API contract: GET /api/inventory/tasks/:taskId/assets
   */
  const fetchTaskDetails = useCallback(async (taskId: string) => {
    setLoadingAssets(true);
    setError(null);
    try {
      const response = await http.get<IAssetItem[]>(
        `/api/inventory/tasks/${taskId}/assets`
      );
      setAssets(response.data ?? []);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to fetch task assets';
      setError(message);
      setAssets([]);
    } finally {
      setLoadingAssets(false);
    }
  }, []);

  // Auto-fetch assets when the selected task changes
  useEffect(() => {
    if (selectedTaskId) {
      fetchTaskDetails(selectedTaskId);
    } else {
      setAssets([]);
    }
  }, [selectedTaskId, fetchTaskDetails]);

  // ── Single asset status update (optimistic local) ───────────────────────

  /**
   * Updates a single asset's inventory status or remark in local state.
   * The actual persistence happens on batch submit / approval to minimise
   * API calls during active stocktaking.
   */
  const updateAssetStatus = useCallback((assetId: string, updates: Partial<IAssetItem>) => {
    setAssets(prev =>
      prev.map(asset =>
        asset.id === assetId ? { ...asset, ...updates } : asset
      )
    );
  }, []);

  // ── Batch asset status update ───────────────────────────────────────────

  /**
   * Applies a status update to multiple assets at once.
   * Updates local state immediately for responsive UI; also sends a PATCH
   * to the backend for persistence.
   */
  const batchUpdateAssetStatus = useCallback(async (
    assetIds: string[],
    updates: Partial<IAssetItem>
  ) => {
    setError(null);
    // Optimistic local update first
    setAssets(prev =>
      prev.map(asset =>
        assetIds.includes(asset.id) ? { ...asset, ...updates } : asset
      )
    );
    try {
      await http.patch('/api/inventory/assets/batch', { assetIds, ...updates });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to batch update assets';
      setError(message);
      // Re-fetch to restore server truth on failure
      if (selectedTaskId) {
        await fetchTaskDetails(selectedTaskId);
      }
    }
  }, [selectedTaskId, fetchTaskDetails]);

  // ── Submit for approval ─────────────────────────────────────────────────

  /**
   * Submits the inventory task results for managerial approval.
   * API contract: POST /api/inventory/approve  { taskId }
   * On success, navigates back to the task list (handled by the consuming component).
   */
  const submitForApproval = useCallback(async (taskId: string) => {
    setError(null);
    try {
      await http.post('/api/inventory/approve', { taskId });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to submit for approval';
      setError(message);
      throw new Error(message);
    }
  }, []);

  // ── Computed summary (frontend aggregation) ─────────────────────────────

  /**
   * Derives inventory summary statistics from the current asset list.
   * Recalculated reactively whenever assets change (e.g., after batch update).
   * Provides the five KPI cards: 总资产数 / 已盘 / 未盘 / 盘盈 / 盘亏
   */
  const inventorySummary = useMemo<IInventorySummary>(() => {
    const totalCount = assets.length;

    if (totalCount === 0) {
      return {
        totalCount: 0,
        countedCount: 0,
        surplusCount: 0,
        deficitCount: 0,
        matchedCount: 0,
        notCountedCount: 0,
        progressPercentage: 0,
      };
    }

    const countedCount = assets.filter(a => a.inventoryStatus !== 'not_counted').length;
    const surplusCount = assets.filter(a => a.inventoryStatus === 'surplus').length;
    const deficitCount = assets.filter(a => a.inventoryStatus === 'deficit').length;
    const matchedCount = assets.filter(a => a.inventoryStatus === 'matched').length;
    const notCountedCount = totalCount - countedCount;

    return {
      totalCount,
      countedCount,
      surplusCount,
      deficitCount,
      matchedCount,
      notCountedCount,
      progressPercentage: Math.round((countedCount / totalCount) * 100),
    };
  }, [assets]);

  // ── Error helper ────────────────────────────────────────────────────────

  /** Clears the current error state */
  const clearError = useCallback(() => setError(null), []);

  // ── Initial data load ───────────────────────────────────────────────────
  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  // ── Public API ──────────────────────────────────────────────────────────
  return {
    tasks,
    loadingTasks,
    taskPagination,
    setTaskPagination,
    taskFilters,
    setTaskFilters,
    fetchTasks,
    selectedTaskId,
    setSelectedTaskId,
    assets,
    loadingAssets,
    inventorySummary,
    createTask,
    submitForApproval,
    updateAssetStatus,
    batchUpdateAssetStatus,
    error,
    clearError,
  };
}

export default useInventoryTasks;