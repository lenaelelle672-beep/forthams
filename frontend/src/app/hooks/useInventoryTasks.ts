import { useState, useEffect, useCallback, useMemo } from 'react';
import { api } from '../utils/api';

// ─── Type Definitions ────────────────────────────────────────────────────────

/** Status of an inventory task in its lifecycle */
export type InventoryTaskStatus = 'draft' | 'in_progress' | 'completed' | 'approved';

/** Real-time physical check status for an individual asset line item */
export type InventoryCheckStatus = 'not_counted' | 'surplus' | 'deficit' | 'matched';

/** Raw task shape returned by backend Page.records */
interface IInventoryTaskRaw {
  id: number;
  taskNo: string;
  taskName: string;
  status: string;
  totalCount: number | null;
  scannedCount: number | null;
  matchCount: number | null;
  lossCount: number | null;
  createTime: string;
  updateTime: string;
}

/** Page shape returned by MyBatis-Plus selectPage */
interface IPageResponse<T> {
  records: T[];
  total: number;
  size: number;
  current: number;
  pages: number;
}

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

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Map backend status string to frontend InventoryTaskStatus.
 */
function mapStatus(raw: string): InventoryTaskStatus {
  const normalized = raw?.toLowerCase() ?? 'draft';
  switch (normalized) {
    case 'in_progress':
      return 'in_progress';
    case 'completed':
      return 'completed';
    case 'approved':
    case 'submitted':
      return 'approved';
    default:
      return 'draft';
  }
}

/**
 * Transform a raw backend InventoryTask into the frontend IInventoryTask shape.
 */
function transformTask(raw: IInventoryTaskRaw): IInventoryTask {
  return {
    id: String(raw.id),
    title: raw.taskName ?? '',
    status: mapStatus(raw.status),
    totalAssetsCount: raw.totalCount ?? 0,
    countedAssetsCount: (raw.scannedCount ?? 0) + (raw.matchCount ?? 0),
    createdAt: raw.createTime ?? '',
    updatedAt: raw.updateTime ?? '',
  };
}

// ─── Hook Implementation ─────────────────────────────────────────────────────

/**
 * useInventoryTasks
 *
 * Custom hook that manages the full lifecycle of inventory (stocktaking) tasks.
 * All API calls go through the shared `api` utility which unwraps the
 * backend `Result<T>` envelope and injects the auth token.
 *
 * State triad enforced: loading / error / data for every async operation.
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
   * GET /api/inventory/tasks?page=&pageSize=&status=&search=
   *
   * The backend returns Result<Page<InventoryTask>> which the `api` util
   * unwraps to a MyBatis-Plus Page object containing `records` and `total`.
   */
  const fetchTasks = useCallback(async (params: ITaskQueryParams = {}) => {
    setLoadingTasks(true);
    setError(null);
    try {
      const page = await api.get<IPageResponse<IInventoryTaskRaw>>(
        '/inventory/tasks',
        { params },
      );
      const mapped = (page.records ?? []).map(transformTask);
      setTasks(mapped);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to fetch inventory tasks';
      setError(msg);
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
      const created = await api.post<IInventoryTaskRaw>(
        '/inventory/tasks',
        { taskName: payload.title },
      );
      // Refresh the list so the newly created task is visible
      await fetchTasks();
      return transformTask(created);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to create inventory task';
      setError(msg);
      throw new Error(msg);
    }
  }, [fetchTasks]);

  // ── Fetch task detail (asset list) ──────────────────────────────────────

  /**
   * Loads the full asset detail list for a given inventory task.
   * GET /api/inventory/tasks/:taskId/details
   *
   * The backend returns Result<List<InventoryDetail>> which the `api` util
   * unwraps to an array of detail records.
   */
  const fetchTaskDetails = useCallback(async (taskId: string) => {
    setLoadingAssets(true);
    setError(null);
    try {
      const details = await api.get<Array<Record<string, unknown>>>(
        `/inventory/tasks/${taskId}/details`,
      );
      // Map raw detail records to IAssetItem
      const mapped = (details ?? []).map((d): IAssetItem => ({
        id: String(d.id ?? ''),
        assetCode: String(d.rfidTag ?? d.assetId ?? ''),
        name: String(d.remark ?? ''),
        currentStatus: 'in_use',
        inventoryStatus: (d.status === 'MATCH' || d.status === 'match')
          ? 'matched'
          : (d.status === 'LOSS' || d.status === 'loss')
            ? 'deficit'
            : (d.status === 'SURPLUS' || d.status === 'surplus')
              ? 'surplus'
              : 'not_counted',
        actualQuantity: 1,
        expectedQuantity: 1,
        remark: typeof d.remark === 'string' ? d.remark : '',
      }));
      setAssets(mapped);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to fetch task assets';
      setError(msg);
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
      await api.put('/inventory/assets/batch', { assetIds, ...updates });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to batch update assets';
      setError(msg);
      // Re-fetch to restore server truth on failure
      if (selectedTaskId) {
        await fetchTaskDetails(selectedTaskId);
      }
    }
  }, [selectedTaskId, fetchTaskDetails]);

  // ── Submit for approval ─────────────────────────────────────────────────

  /**
   * Submits the inventory task results for managerial approval.
   * POST /api/inventory/approve  { taskId }
   * On success, navigates back to the task list (handled by the consuming component).
   */
  const submitForApproval = useCallback(async (taskId: string) => {
    setError(null);
    try {
      await api.post('/inventory/approve', { taskId });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to submit for approval';
      setError(msg);
      throw new Error(msg);
    }
  }, []);

  // ── Computed summary (frontend aggregation) ─────────────────────────────

  /**
   * Derives inventory summary statistics from the current asset list.
   * Recalculated reactively whenever assets change (e.g., after batch update).
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
