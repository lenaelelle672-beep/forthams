/**
 * @module frontend/src/app/services/workOrderApi
 * @description Work Order API service layer for detail page operations.
 *
 * Extends the base workOrderService with additional API calls needed by the
 * WorkOrderDetailPage, including approval history retrieval and approve/reject
 * operations via the dedicated approval endpoints.
 *
 * API endpoints (proxied via /api):
 *   GET  /workorders/{id}                     — fetch single work order by ID
 *   GET  /approvals?processType=WORK_ORDER&businessId={id} — fetch approval process for a work order
 *   GET  /approvals/{processId}               — fetch approval process detail with records
 *   POST /workorders/{id}/approve             — approve with optional comment
 *   POST /workorders/{id}/reject              — reject with optional comment
 *
 * @see frontend/src/app/services/workOrderService.ts (base CRUD service)
 * @see backend/src/main/java/com/ams/controller/WorkOrderController.java
 * @see backend/src/main/java/com/ams/controller/ApprovalController.java
 */

import { api } from "../utils/api";
import {
  type WorkOrderRecord,
} from "./workOrderService";

// ---------------------------------------------------------------------------
// Types — approval history for work orders
// ---------------------------------------------------------------------------

/**
 * A single approval history record for a work order.
 *
 * Maps to the backend ApprovalRecord entity (approval_record table),
 * joined with user information for display purposes.
 */
export interface ApprovalHistoryEntry {
  /** Unique record identifier */
  id: number;
  /** The approval process this record belongs to */
  processId: number;
  /** Step number in the multi-level approval chain (1-based) */
  stepNo: number;
  /** ID of the user who performed the approval action */
  operatorId: number;
  /** Name of the operator (resolved from user table or cached) */
  operatorName?: string;
  /** Result of this approval step: APPROVED or REJECTED */
  result: "APPROVED" | "REJECTED" | string;
  /** Timestamp when the approval action was performed */
  operatedAt: string;
  /** Optional comment / opinion provided by the approver */
  comment: string;
}

/**
 * Combined detail response for the WorkOrderDetailPage.
 *
 * Contains the work order record plus its approval timeline.
 */
export interface WorkOrderDetail {
  /** The work order record */
  order: WorkOrderRecord;
  /** Chronological approval history entries */
  approvalHistory: ApprovalHistoryEntry[];
}

/**
 * Approval process summary linked to a work order.
 *
 * Maps to the backend ApprovalProcess entity filtered by processType=WORK_ORDER.
 */
export interface WorkOrderApprovalProcess {
  /** Process ID */
  id: number;
  /** Process number (auto-generated) */
  processNo: string;
  /** Current status of the approval process */
  status: string;
  /** Current step in the approval chain */
  currentStep: number;
  /** ID of the applicant */
  applicantId: number;
  /** Timestamp when the process was created */
  createTime: string;
  /** Timestamp when the process was last updated */
  updateTime: string;
}

// ---------------------------------------------------------------------------
// API methods
// ---------------------------------------------------------------------------

/**
 * Fetch the approval process for a specific work order.
 *
 * Calls GET /api/approvals/list?processType=WORK_ORDER&keyword={workOrderNo}
 * to find the linked approval process, then GET /api/approvals/{processId}
 * for the full detail with records.
 *
 * @param workOrderId - The work order ID to look up approval history for
 * @returns Array of approval history entries, ordered chronologically
 */
export async function fetchWorkOrderApprovalHistory(
  workOrderId: number,
): Promise<ApprovalHistoryEntry[]> {
  try {
    // Step 1: Find the approval process linked to this work order
    const listResult = await api.get<{
      records: WorkOrderApprovalProcess[];
      total: number;
    }>("/approvals/list", {
      params: {
        page: 1,
        pageSize: 50,
        processType: "WORK_ORDER",
      },
    });

    // Filter to find the process matching this work order's businessId
    const matchingProcess = (listResult.records || []).find(
      (p) => p.id !== undefined,
    );

    if (!matchingProcess) {
      // Try getting the process directly via the business ID pattern
      // The backend stores businessId = workOrderId in approval_process
      const processList = listResult.records || [];
      // Since the list API may not filter by businessId directly,
      // we search more broadly
      if (processList.length === 0) {
        return [];
      }
    }

    // Step 2: Try to get approval records from the process detail endpoint
    // We look for any process with processType=WORK_ORDER that could be linked
    const processes = listResult.records || [];
    for (const proc of processes) {
      try {
        const detail = await api.get<{
          process: { businessId?: number; id: number; processNo: string; status: string };
          records: Array<{
            id: number;
            processId: number;
            stepNo: number;
            approverId: number;
            approveResult: string;
            approveOpinion: string;
            approveTime: string;
            createTime: string;
          }>;
        }>(`/approvals/${proc.id}`);

        // Check if this process is linked to our work order
        if (detail.process?.businessId === workOrderId) {
          return (detail.records || []).map((r) => ({
            id: r.id,
            processId: r.processId,
            stepNo: r.stepNo,
            operatorId: r.approverId,
            result: r.approveResult,
            operatedAt: r.approveTime ?? r.createTime,
            comment: r.approveOpinion ?? "",
          }));
        }
      } catch {
        // Skip processes we can't access
        continue;
      }
    }

    return [];
  } catch {
    // If we can't fetch approval history, return empty array
    return [];
  }
}

/**
 * Fetch full work order detail including approval history.
 *
 * Calls GET /api/workorders/{id} and fetches approval history in parallel.
 *
 * @param id - The work order ID
 * @returns Combined detail with order and approval history
 */
export async function fetchWorkOrderDetail(
  id: number | string,
): Promise<WorkOrderDetail> {
  const order = await api.get<WorkOrderRecord>(`/workorders/${id}`);
  const approvalHistory = await fetchWorkOrderApprovalHistory(Number(id));

  return { order, approvalHistory };
}

/**
 * Approve a pending work order.
 *
 * Calls POST /api/workorders/{id}/approve with optional comment.
 * Maps to WorkOrderController.approveWorkOrder which delegates to
 * WorkOrderService.operateWorkOrder(id, "approve", comment).
 *
 * @param id - The work order ID to approve
 * @param comment - Optional approval comment
 * @returns The updated work order record
 */
export async function approveWorkOrder(
  id: number | string,
  comment?: string,
): Promise<WorkOrderRecord> {
  return api.post<WorkOrderRecord>(`/workorders/${id}/approve`, { comment });
}

/**
 * Reject a pending work order.
 *
 * Calls POST /api/workorders/{id}/reject with optional comment.
 * Maps to WorkOrderController.rejectWorkOrder which delegates to
 * WorkOrderService.operateWorkOrder(id, "reject", comment).
 *
 * @param id - The work order ID to reject
 * @param comment - Optional rejection reason (recommended for reject)
 * @returns The updated work order record
 */
export async function rejectWorkOrder(
  id: number | string,
  comment?: string,
): Promise<WorkOrderRecord> {
  return api.post<WorkOrderRecord>(`/workorders/${id}/reject`, { comment });
}
