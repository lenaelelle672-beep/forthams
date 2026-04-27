/**
 * inventoryDetailApi.ts
 *
 * API service layer for the Inventory Detail page
 * (Phase 3: Inventory Execution Workstation).
 *
 * Responsibilities:
 * - Fetch task detail data (asset list + summary statistics)
 * - Update individual asset check status and remarks
 * - Batch-confirmed multiple assets at once
 * - Submit completed inventory for approval workflow
 *
 * All business-primary data is persisted server-side;
 * the frontend only computes intermediate states (progress %, diff summary).
 */

import api from '../../utils/api';
import type { AxiosResponse } from 'axios';

// ---------------------------------------------------------------------------
// TypeScript Interfaces (Phase 3 — data model layer)
// ---------------------------------------------------------------------------

/** Inventory task record, used in the left-side task list and detail header. */
export interface ITask {
  id: string;
  /** System-generated task code, e.g. "INV-20241027-001" */
  taskCode: string;
  /** Human-readable task title */
  title: string;
  /** Inventory range description (location names / category names) */
  scope: string;
  status: 'draft' | 'running' | 'completed' | 'approved' | 'rejected';
  /** ISO-8601 date-time string */
  createdAt: string;
  startTime?: string;
  endTime?: string;
  creatorId: string;
  creatorName: string;
  /** Percentage 0–100, may be 0 for draft tasks */
  progress: number;
}

/** Real-time status of a single asset during inventory execution. */
export type AssetCheckStatus = 'pending' | 'counted' | 'confirmed' | 'surplus' | 'shortage';

/** Single asset row rendered in the middle check-data table. */
export interface IAssetItem {
  id: string;
  assetCode: string;
  assetName: string;
  category: string;
  location: string;
  /** Quantity recorded in the asset register (ledger) */
  bookQuantity: number;
  /** Actual quantity counted by the operator (0 when not yet checked) */
  actualQuantity: number;
  /** Difference = actualQuantity − bookQuantity; positive = surplus, negative = shortage */
  difference: number;
  /** Current check status, drives the StatusDropdown and row highlight */
  checkStatus: AssetCheckStatus;
  /** Operator remark / note, editable inline */
  remark: string;
  /** Unit price for value calculation (optional) */
  unitPrice?: number;
  /** Book net value for financial impact analysis (optional) */
  bookValue?: number;
}

/** Aggregated summary displayed in the top progress dashboard and bottom diff panel. */
export interface IInventorySummary {
  /** Total number of assets in the inventory scope */
  totalAssets: number;
  /** Number of assets that have been physically counted */
  countedAssets: number;
  /** Assets not yet counted = totalAssets − countedAssets */
  uncountedAssets: number;
  /** Number of assets where actualQuantity > bookQuantity (盘盈) */
  surplusCount: number;
  /** Number of assets where actualQuantity < bookQuantity (盘亏) */
  shortageCount: number;
  /** (countedAssets / totalAssets) * 100, clamped to 0–100 */
  progressPercentage: number;
  /** Total financial value of surplus items (optional, for summary panel) */
  surplusValue?: number;
  /** Total financial value of shortage items (optional, for summary panel) */
  shortageValue?: number;
}

/** A single discrepancy row in the bottom diff summary panel. */
export interface IDiffRecord {
  assetId: string;
  assetCode: string;
  assetName: string;
  /** "账面有，实盘无" (shortage) or "账面无，实盘有" (surplus) */
  diffType: 'surplus' | 'shortage';
  bookQuantity: number;
  actualQuantity: number;
  difference: number;
  remark: string;
  bookValue?: number;
}

// ---------------------------------------------------------------------------
// Request / Response Payload Types
// ---------------------------------------------------------------------------

/** Payload for creating a new inventory task (handled by InventoryTasks page). */
export interface ICreateInventoryTaskRequest {
  title: string;
  locationIds: string[];
  categoryIds?: string[];
  startTime: string;
  endTime: string;
}

/** Payload for updating a single asset's check result. */
export interface IUpdateAssetRequest {
  actualQuantity: number;
  checkStatus: AssetCheckStatus;
  remark?: string;
}

/** Payload for batch-confirming multiple assets at once. */
export interface IBatchConfirmRequest {
  taskId: string;
  items: Array<{
    assetId: string;
    actualQuantity: number;
    checkStatus: AssetCheckStatus;
    remark?: string;
  }>;
}

/** Payload for submitting the inventory for approval (ATB-05). */
export interface ISubmitApprovalRequest {
  taskId: string;
  summary: IInventorySummary;
  diffRecords: IDiffRecord[];
  remark?: string;
}

/** Paginated query parameters for the asset list. */
export interface IAssetListParams {
  taskId: string;
  page?: number;
  pageSize?: number;
  keyword?: string;
  checkStatus?: AssetCheckStatus | '';
  /** Sort field: 'assetCode' | 'difference' | 'checkStatus' */
  sortBy?: string;
  /** Sort direction: 'asc' | 'desc' */
  sortOrder?: 'asc' | 'desc';
}

/** Standard paginated response wrapper. */
export interface IPaginatedResponse<T> {
  list: T[];
  total: number;
  page: number;
  pageSize: number;
}

/** Standard API response envelope (matches backend `Result<T>` pattern). */
export interface IApiResponse<T> {
  code: number;
  message: string;
  data: T;
}

// ---------------------------------------------------------------------------
// API Service Functions
// ---------------------------------------------------------------------------

/**
 * Fetches the full detail of an inventory task including summary statistics.
 * Used by the top progress dashboard to render progress bar and 5 stat cards.
 *
 * @param taskId - Unique identifier of the inventory task
 * @returns Task detail with current summary statistics
 */
export async function getTaskDetail(
  taskId: string,
): Promise<IApiResponse<{ task: ITask; summary: IInventorySummary }>> {
  const response: AxiosResponse<IApiResponse<{ task: ITask; summary: IInventorySummary }>> =
    await api.get(`/inventory/tasks/${taskId}`);
  return response.data;
}

/**
 * Fetches the paginated asset list for a specific inventory task.
 * Supports keyword search, status filtering, and sorting.
 * Must handle 200+ records without blocking the UI thread.
 *
 * @param params - Pagination and filter parameters
 * @returns Paginated asset list with total count
 */
export async function getAssetList(
  params: IAssetListParams,
): Promise<IApiResponse<IPaginatedResponse<IAssetItem>>> {
  const { taskId, ...queryParams } = params;
  const response: AxiosResponse<IApiResponse<IPaginatedResponse<IAssetItem>>> =
    await api.get(`/inventory/tasks/${taskId}/assets`, { params: queryParams });
  return response.data;
}

/**
 * Updates a single asset's check result (actual quantity, status, remark).
 * Called when the operator changes the StatusDropdown or enters a remark.
 *
 * @param taskId - Inventory task identifier
 * @param assetId - Asset being updated
 * @param payload - New check data
 * @returns Updated asset item
 */
export async function updateAssetCheck(
  taskId: string,
  assetId: string,
  payload: IUpdateAssetRequest,
): Promise<IApiResponse<IAssetItem>> {
  const response: AxiosResponse<IApiResponse<IAssetItem>> =
    await api.patch(`/inventory/tasks/${taskId}/assets/${assetId}`, payload);
  return response.data;
}

/**
 * Batch-confirms multiple assets in a single request.
 * Triggered by the "批量确认" button (ATB-04).
 * Updates frontend store optimistically on success.
 *
 * @param payload - Batch update payload with task ID and array of asset changes
 * @returns Count of successfully updated items
 */
export async function batchConfirmAssets(
  payload: IBatchConfirmRequest,
): Promise<IApiResponse<{ updatedCount: number }>> {
  const response: AxiosResponse<IApiResponse<{ updatedCount: number }>> =
    await api.put('/inventory/tasks/assets/batch-confirm', payload);
  return response.data;
}

/**
 * Fetches the discrepancy (diff) summary for the bottom panel.
 * Returns a list of surplus and shortage records by comparing
 * book quantities with actual counted quantities.
 *
 * @param taskId - Inventory task identifier
 * @returns List of diff records (盘盈 + 盘亏)
 */
export async function getDiffSummary(
  taskId: string,
): Promise<IApiResponse<IDiffRecord[]>> {
  const response: AxiosResponse<IApiResponse<IDiffRecord[]>> =
    await api.get(`/inventory/tasks/${taskId}/diff-summary`);
  return response.data;
}

/**
 * Submits the completed inventory for approval.
 * Triggers `POST /api/inventory/approve` (ATB-05).
 * On success the UI navigates back to the task list.
 *
 * @param payload - Approval submission payload with summary and diff records
 * @returns Approval submission result
 */
export async function submitApproval(
  payload: ISubmitApprovalRequest,
): Promise<IApiResponse<{ approved: boolean; approvalId?: string }>> {
  const response: AxiosResponse<IApiResponse<{ approved: boolean; approvalId?: string }>> =
    await api.post('/api/inventory/approve', payload);
  return response.data;
}

/**
 * Default export aggregating all API functions for convenient consumption
 * by hooks and components.
 */
const inventoryDetailApi = {
  getTaskDetail,
  getAssetList,
  updateAssetCheck,
  batchConfirmAssets,
  getDiffSummary,
  submitApproval,
};

export default inventoryDetailApi;