/**
 * @module frontend/src/app/services/inventoryService
 * @description Inventory task API service layer for the app/ module.
 * Provides typed CRUD operations for inventory tasks via the shared `api` utility.
 *
 * API endpoints (proxied via /api):
 *   GET    /inventory/tasks              — paginated task list
 *   GET    /inventory/tasks/{id}         — single task with details
 *   POST   /inventory/tasks              — create a new task
 *   PUT    /inventory/tasks/{id}/status  — update task status
 *   POST   /inventory/tasks/{id}/scan    — add a scan result
 *   GET    /inventory/tasks/{id}/details — task detail records
 *
 * All endpoints go through the shared `api` util which unwraps the backend
 * `Result<T>` envelope and injects the auth token.
 */

import { api } from "../utils/api";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Inventory task record from the backend */
export interface InventoryTaskRecord {
  /** Auto-increment ID */
  id: number;
  /** Task number (generated, e.g. INV-20240601-001) */
  taskNo: string;
  /** Task display name */
  taskName: string;
  /** Inventory type */
  inventoryType: string | null;
  /** Tenant ID */
  tenantId?: string;
  /** Task status: PENDING, IN_PROGRESS, COMPLETED, SUBMITTED */
  status: string;
  /** Department IDs */
  deptIds: string | null;
  /** Start date */
  startDate: string | null;
  /** End date */
  endDate: string | null;
  /** Total asset count */
  totalCount: number | null;
  /** Scanned count */
  scannedCount: number | null;
  /** Matched count */
  matchCount: number | null;
  /** Loss count */
  lossCount: number | null;
  /** Executor ID */
  executorId: number | null;
  /** Creator ID */
  createBy: number | null;
  /** Creation timestamp */
  createTime: string | null;
  /** Update timestamp */
  updateTime: string | null;
}

/** Inventory detail record for a task */
export interface InventoryDetailRecord {
  id: number;
  taskId: number;
  tenantId?: string;
  assetId: number;
  rfidTag: string | null;
  status: string | null;
  expectedLocation: string | null;
  actualLocation: string | null;
  scanTime: string | null;
  remark: string | null;
  createTime: string | null;
}

/** Task detail response (task + details map) */
export interface InventoryTaskDetail {
  task: InventoryTaskRecord;
  details: InventoryDetailRecord[];
}

/** Query parameters for task list */
export interface InventoryTaskListParams {
  page?: number;
  pageSize?: number;
  status?: string;
}

/** Payload for creating a task */
export interface InventoryTaskCreatePayload {
  taskName: string;
  inventoryType?: string;
  deptIds?: string;
  location?: string;
  executorId?: number;
  scope?: string;
  description?: string;
  startDate?: string;
  endDate?: string;
  totalCount?: number;
}

/** Paginated response shape from MyBatis-Plus */
interface PageResponse<T> {
  records: T[];
  total: number;
  size: number;
  current: number;
  pages: number;
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

export const inventoryService = {
  /**
   * Fetch a paginated list of inventory tasks.
   * GET /api/inventory/tasks
   */
  listTasks(params?: InventoryTaskListParams): Promise<PageResponse<InventoryTaskRecord>> {
    return api.get<PageResponse<InventoryTaskRecord>>("/inventory/tasks", { params });
  },

  /**
   * Fetch a single inventory task with its details.
   * GET /api/inventory/tasks/{id}
   */
  getTask(id: number | string): Promise<InventoryTaskDetail> {
    return api.get<InventoryTaskDetail>(`/inventory/tasks/${id}`);
  },

  /**
   * Create a new inventory task.
   * POST /api/inventory/tasks
   */
  createTask(data: InventoryTaskCreatePayload): Promise<InventoryTaskRecord> {
    return api.post<InventoryTaskRecord>("/inventory/tasks", data);
  },

  /**
   * Update an inventory task status.
   * PUT /api/inventory/tasks/{id}/status
   */
  updateTaskStatus(id: number | string, status: string): Promise<InventoryTaskRecord> {
    return api.put<InventoryTaskRecord>(`/inventory/tasks/${id}/status`, { status });
  },

  /**
   * Add a scan result for a task.
   * POST /api/inventory/tasks/{taskId}/scan
   */
  addScanResult(taskId: number | string, data: Record<string, unknown>): Promise<InventoryDetailRecord> {
    return api.post<InventoryDetailRecord>(`/inventory/tasks/${taskId}/scan`, data);
  },

  /**
   * Fetch the detail records for a task.
   * GET /api/inventory/tasks/{taskId}/details
   */
  getTaskDetails(taskId: number | string): Promise<InventoryDetailRecord[]> {
    return api.get<InventoryDetailRecord[]>(`/inventory/tasks/${taskId}/details`);
  },
};
