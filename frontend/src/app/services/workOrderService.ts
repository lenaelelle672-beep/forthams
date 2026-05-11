/**
 * @module frontend/src/app/services/workOrderService
 * @description Work Order API service layer — real backend integration.
 *
 * Provides typed methods for all WorkOrder CRUD and lifecycle operations,
 * aligning with backend WorkOrderController.java and WorkOrderService.java.
 *
 * API endpoints (proxied via /api):
 *   GET    /workorders              — paginated list with status/keyword filters
 *   GET    /workorders/{id}         — fetch single work order by ID
 *   POST   /workorders              — create a new work order (initial status: DRAFT)
 *   PUT    /workorders/{id}         — update a work order (only DRAFT/REJECTED allowed)
 *   DELETE /workorders/{id}         — delete a work order
 *   POST   /workorders/{id}/submit  — submit for approval (DRAFT → PENDING)
 *   POST   /workorders/{id}/operate — lifecycle operations (approve/reject/start/complete/cancel)
 *
 * State machine (backend enforced):
 *   DRAFT → PENDING → APPROVED → EXECUTING → COMPLETED
 *                    ↘ REJECTED                ↘ CANCELLED
 *
 * @see backend/src/main/java/com/ams/controller/WorkOrderController.java
 * @see backend/src/main/java/com/ams/service/WorkOrderService.java
 * @see backend/src/main/java/com/ams/entity/WorkOrder.java
 */

import { api } from "../utils/api";
import type { PagedResult } from "./assetService";

// ---------------------------------------------------------------------------
// Types — mirror backend WorkOrder.java + WorkOrderDTO.java
// ---------------------------------------------------------------------------

/**
 * Work order status enum matching backend status field.
 *
 * The backend constructor defaults to "DRAFT". submitWorkOrder transitions
 * to "PENDING". All transitions are enforced server-side.
 */
export type WorkOrderStatus =
  | "DRAFT"
  | "PENDING"
  | "APPROVED"
  | "EXECUTING"
  | "COMPLETED"
  | "REJECTED"
  | "CANCELLED";

/** Work order priority enum. */
export type WorkOrderPriority = "NORMAL" | "URGENT" | "EMERGENCY";

/**
 * A single work order record as returned by the backend API.
 * Fields align 1:1 with backend WorkOrder.java entity.
 */
export interface WorkOrderRecord {
  id: number;
  workOrderNo?: string;
  title?: string;
  description?: string;
  status?: string;
  priority?: string;
  tenantId?: string;
  assetId?: number;
  assetName?: string;
  assetCode?: string;
  reporterId?: number;
  reporterName?: string;
  assigneeId?: number;
  assigneeName?: string;
  deptId?: number;
  deptName?: string;
  plannedStartDate?: string;
  plannedEndDate?: string;
  actualStartDate?: string;
  actualEndDate?: string;
  estimatedCost?: number;
  actualCost?: number;
  completionNote?: string;
  createTime?: string;
  updateTime?: string;
  deleted?: number;
  [key: string]: unknown;
}

/**
 * Payload for creating or updating a work order.
 * Aligns with backend WorkOrderDTO.java.
 */
export interface WorkOrderDTO {
  id?: number;
  workOrderNo?: string;
  title?: string;
  description?: string;
  status?: string;
  priority?: string;
  assetId?: number;
  assetName?: string;
  assetCode?: string;
  reporterId?: number;
  reporterName?: string;
  assigneeId?: number;
  assigneeName?: string;
  deptId?: number;
  deptName?: string;
  plannedStartDate?: string;
  plannedEndDate?: string;
  actualStartDate?: string;
  actualEndDate?: string;
  estimatedCost?: number;
  actualCost?: number;
  completionNote?: string;
  createTime?: string;
  updateTime?: string;
}

/**
 * Query parameters for the work order list API request.
 * Maps to backend queryWorkOrders(page, pageSize, status, keyword).
 */
export interface WorkOrderListParams {
  /** Current page number (1-based). */
  page?: number;
  /** Number of items per page. */
  pageSize?: number;
  /** Status filter — undefined means "all". */
  status?: string;
  /** Keyword search — fuzzy matches title and workOrderNo. */
  keyword?: string;
}

// ---------------------------------------------------------------------------
// State machine helpers
// ---------------------------------------------------------------------------

/**
 * Check if a work order status is editable (can be updated via PUT).
 *
 * Backend rule (WorkOrderService.isEditableStatus):
 *   Only DRAFT or REJECTED status can be modified.
 *
 * @param status — the current work order status
 * @returns true if the work order can be edited
 */
export function isEditableStatus(status?: string): boolean {
  return status === "DRAFT" || status === "REJECTED";
}

/**
 * Check if a work order status is submittable (can transition to PENDING).
 *
 * @param status — the current work order status
 * @returns true if the work order can be submitted
 */
export function isSubmittableStatus(status?: string): boolean {
  return isEditableStatus(status);
}

/**
 * Check if a work order status is deletable.
 *
 * Backend rule (WorkOrderService.isDeletableStatus):
 *   DRAFT, REJECTED, or CANCELLED can be deleted.
 *
 * @param status — the current work order status
 * @returns true if the work order can be deleted
 */
export function isDeletableStatus(status?: string): boolean {
  return isEditableStatus(status) || status === "CANCELLED";
}

/**
 * Check if a work order can be cancelled.
 *
 * Backend rule (WorkOrderService.isCancellableStatus):
 *   DRAFT, PENDING, or APPROVED can be cancelled.
 *
 * @param status — the current work order status
 * @returns true if the work order can be cancelled
 */
export function isCancellableStatus(status?: string): boolean {
  return status === "DRAFT" || status === "PENDING" || status === "APPROVED";
}

// ---------------------------------------------------------------------------
// Status label mapping
// ---------------------------------------------------------------------------

/**
 * Map backend status enum to Chinese display label.
 *
 * @param status — the backend status string
 * @returns human-readable Chinese label
 */
export function getWorkOrderStatusLabel(status?: string): string {
  const labels: Record<string, string> = {
    DRAFT: "草稿",
    PENDING: "待审批",
    APPROVED: "待派工",
    EXECUTING: "处理中",
    COMPLETED: "已完成",
    REJECTED: "已驳回",
    CANCELLED: "已取消",
  };
  return labels[status || ""] || status || "-";
}

/**
 * Map backend priority enum to Chinese display label.
 *
 * @param priority — the backend priority string
 * @returns human-readable Chinese label
 */
export function getPriorityLabel(priority?: string): string {
  const labels: Record<string, string> = {
    NORMAL: "中",
    URGENT: "高",
    EMERGENCY: "紧急",
  };
  return labels[priority || ""] || priority || "-";
}

// ---------------------------------------------------------------------------
// API service methods
// ---------------------------------------------------------------------------

export const workOrderService = {
  /**
   * Fetch a paginated list of work orders with optional filters.
   *
   * Maps to: GET /api/workorders?page=&pageSize=&status=&keyword=
   * Backend: WorkOrderService.queryWorkOrders
   *
   * @param params — query parameters (page, pageSize, status, keyword)
   * @returns paginated result with records and total
   */
  list(params?: WorkOrderListParams) {
    return api.get<PagedResult<WorkOrderRecord>>("/workorders", { params });
  },

  /**
   * Fetch a single work order by its ID.
   *
   * Maps to: GET /api/workorders/{id}
   * Backend: WorkOrderService.getWorkOrderById
   *
   * @param id — work order ID
   * @returns the work order record
   */
  getById(id: number | string) {
    return api.get<WorkOrderRecord>(`/workorders/${id}`);
  },

  /**
   * Create a new work order.
   *
   * Maps to: POST /api/workorders
   * Backend: WorkOrderService.createWorkOrder
   * Initial status: DRAFT (server-assigned)
   *
   * @param payload — work order data (title is required)
   * @returns the created work order with server-assigned id and workOrderNo
   */
  create(payload: WorkOrderDTO) {
    return api.post<WorkOrderRecord>("/workorders", payload);
  },

  /**
   * Update an existing work order.
   *
   * Maps to: PUT /api/workorders/{id}
   * Backend: WorkOrderService.updateWorkOrder
   * Constraint: Only DRAFT or REJECTED status can be updated.
   *
   * @param id — work order ID
   * @param payload — fields to update
   * @returns the updated work order record
   */
  update(id: number | string, payload: WorkOrderDTO) {
    return api.put<WorkOrderRecord>(`/workorders/${id}`, payload);
  },

  /**
   * Delete a work order.
   *
   * Maps to: DELETE /api/workorders/{id}
   * Backend: WorkOrderService.deleteWorkOrder
   * Constraint: Only DRAFT, REJECTED, or CANCELLED can be deleted.
   *
   * @param id — work order ID
   */
  delete(id: number | string) {
    return api.delete<void>(`/workorders/${id}`);
  },

  /**
   * Submit a work order for approval.
   *
   * Maps to: POST /api/workorders/{id}/submit
   * Backend: WorkOrderService.submitWorkOrder
   * Transition: DRAFT/REJECTED → PENDING
   *
   * @param id — work order ID
   * @returns the updated work order with PENDING status
   */
  submit(id: number | string) {
    return api.post<WorkOrderRecord>(`/workorders/${id}/submit`);
  },

  /**
   * Execute a lifecycle operation on a work order.
   *
   * Maps to: POST /api/workorders/{id}/operate
   * Backend: WorkOrderService.operateWorkOrder
   * Operation is normalized to lowercase by backend (case-tolerant).
   *
   * Supported operations:
   *   "approve"  — PENDING → APPROVED
   *   "reject"   — PENDING → REJECTED
   *   "start"    — APPROVED → EXECUTING
   *   "complete" — EXECUTING → COMPLETED
   *   "cancel"   — DRAFT/PENDING/APPROVED → CANCELLED
   *
   * @param id — work order ID
   * @param operation — lifecycle operation string
   * @param comment — optional comment/note
   * @returns the updated work order record
   */
  operate(id: number | string, operation: string, comment?: string) {
    return api.post<WorkOrderRecord>(`/workorders/${id}/operate`, {
      operation,
      comment,
    });
  },
};
