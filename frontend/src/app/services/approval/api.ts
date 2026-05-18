/**
 * @module frontend/src/app/services/approval/api
 * @description Approval Service API layer.
 *
 * Provides typed API methods for the approval workflow using the
 * shared `api` utility (Axios-based with auth interceptors).
 *
 * Base URL: /api/approval (proxied to backend /approvals via Vite dev server).
 *
 * Methods:
 * - fetchPendingApprovals: GET /approvals/pending
 * - approve: POST /approvals/{id}/approve
 * - reject: POST /approvals/{id}/approve (with result=REJECTED)
 * - getApprovalHistory: GET /approvals/{id}
 * - getApprovalList: GET /approvals/list
 * - getPendingCount: GET /approvals/pending/count
 * - createProcess: POST /approvals
 */

import { api } from '../../utils/api';
import type {
  ApprovalItem,
  ApprovalHistoryItem,
  ApprovalListParams,
  ApprovalDetailResponse,
  ApprovalResult,
} from './types';
import { ApprovalServiceError, createNetworkError } from './errors';

// ---------------------------------------------------------------------------
// Raw backend response mappers
// ---------------------------------------------------------------------------

/**
 * Raw approval process shape returned by the backend.
 * Uses snake_case fields matching the Java entity ApprovalProcess.
 */
interface RawApprovalProcess {
  id: number;
  processNo: string;
  processType: string;
  businessId: number | null;
  businessData: string | null;
  tenantId: string;
  status: string;
  currentStep: number;
  applicantId: number;
  applyTime: string;
  createTime: string;
  updateTime: string;
}

function parseBusinessSummary(businessData: string | null): string | undefined {
  if (!businessData) {
    return undefined;
  }

  try {
    const parsed = JSON.parse(businessData) as Record<string, unknown>;
    const payload = (parsed._approvalPayload && typeof parsed._approvalPayload === 'object')
      ? parsed._approvalPayload as Record<string, unknown>
      : parsed;
    const summary = payload.reason ?? payload.description ?? payload.lossDescription;
    return typeof summary === 'string' && summary.trim() ? summary : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Raw approval record shape returned by the backend.
 * Uses snake_case fields matching the Java entity ApprovalRecord.
 */
interface RawApprovalRecord {
  id: number;
  processId: number;
  tenantId: string;
  stepNo: number;
  approverId: number;
  approveResult: string;
  approveOpinion: string;
  approveTime: string;
  createTime: string;
}

// ---------------------------------------------------------------------------
// Mappers: raw backend data → typed frontend models
// ---------------------------------------------------------------------------

/**
 * Map a raw approval record to the frontend ApprovalHistoryItem type.
 */
function mapRecord(raw: RawApprovalRecord): ApprovalHistoryItem {
  return {
    id: raw.id,
    processId: raw.processId,
    stepNo: raw.stepNo,
    operator: raw.approverId,
    status: raw.approveResult as ApprovalResult,
    operatedAt: raw.approveTime ?? raw.createTime,
    comment: raw.approveOpinion ?? '',
  };
}

/**
 * Map a raw approval process to the frontend ApprovalItem type.
 * History is populated separately (empty array by default).
 */
function mapProcess(raw: RawApprovalProcess, history?: ApprovalHistoryItem[]): ApprovalItem {
  return {
    id: raw.id,
    processNo: raw.processNo,
    type: raw.processType as ApprovalItem['type'],
    businessId: raw.businessId,
    businessData: raw.businessData,
    businessSummary: parseBusinessSummary(raw.businessData),
    applicant: raw.applicantId,
    status: raw.status as ApprovalItem['status'],
    currentStep: raw.currentStep,
    createdAt: raw.createTime ?? raw.applyTime,
    updatedAt: raw.updateTime ?? raw.createTime ?? raw.applyTime,
    history: history ?? [],
  };
}

// ---------------------------------------------------------------------------
// API Methods
// ---------------------------------------------------------------------------

/**
 * Fetch the list of pending approvals for the current user.
 *
 * Calls GET /approvals/pending.
 *
 * @returns Array of ApprovalItem (without history populated)
 */
export async function fetchPendingApprovals(): Promise<ApprovalItem[]> {
  try {
    const rawList = await api.get<RawApprovalProcess[]>('/approvals/pending');
    if (!Array.isArray(rawList)) {
      return [];
    }
    return rawList.map((raw) => mapProcess(raw));
  } catch (err) {
    throw err instanceof ApprovalServiceError
      ? err
      : createNetworkError(err);
  }
}

/**
 * Approve an approval process.
 *
 * Calls POST /approvals/{processId}/approve with result='APPROVED'.
 *
 * @param processId - The approval process ID to approve
 * @param opinion   - Optional approval comment
 * @returns The updated ApprovalItem
 */
export async function approve(processId: number, opinion: string = ''): Promise<ApprovalItem> {
  try {
    const raw = await api.post<RawApprovalProcess>(`/approvals/${processId}/approve`, {
      result: 'APPROVED',
      opinion,
    });
    return mapProcess(raw);
  } catch (err) {
    throw err instanceof ApprovalServiceError
      ? err
      : createNetworkError(err);
  }
}

/**
 * Reject an approval process.
 *
 * Calls POST /approvals/{processId}/approve with result='REJECTED'.
 * The backend requires a non-empty opinion for rejections.
 *
 * @param processId - The approval process ID to reject
 * @param opinion   - Mandatory rejection reason
 * @returns The updated ApprovalItem
 */
export async function reject(processId: number, opinion: string): Promise<ApprovalItem> {
  try {
    const raw = await api.post<RawApprovalProcess>(`/approvals/${processId}/approve`, {
      result: 'REJECTED',
      opinion,
    });
    return mapProcess(raw);
  } catch (err) {
    throw err instanceof ApprovalServiceError
      ? err
      : createNetworkError(err);
  }
}

/**
 * Get the full approval history for a specific process.
 *
 * Calls GET /approvals/{processId} which returns { process, records }.
 *
 * @param processId - The approval process ID
 * @returns The process detail including its full approval history
 */
export async function getApprovalHistory(processId: number): Promise<ApprovalDetailResponse> {
  try {
    const raw = await api.get<{
      process: RawApprovalProcess;
      records: RawApprovalRecord[];
    }>(`/approvals/${processId}`);

    const history: ApprovalHistoryItem[] = Array.isArray(raw.records)
      ? raw.records.map(mapRecord)
      : [];

    return {
      process: mapProcess(raw.process, history),
      records: history,
    };
  } catch (err) {
    throw err instanceof ApprovalServiceError
      ? err
      : createNetworkError(err);
  }
}

/**
 * List approval processes with pagination and optional filters.
 *
 * Calls GET /approvals/list with query parameters.
 *
 * @param params - Pagination and filter parameters
 * @returns Paginated list of approval processes (without history)
 */
export async function getApprovalList(
  params?: ApprovalListParams,
): Promise<{ records: ApprovalItem[]; total: number }> {
  try {
    const result = await api.get<{
      records: RawApprovalProcess[];
      total: number;
      current: number;
      size: number;
    }>('/approvals/list', {
      params: {
        page: params?.page ?? 1,
        pageSize: params?.pageSize ?? 10,
        status: params?.status,
        processType: params?.processType,
        keyword: params?.keyword,
      },
    });

    const items = Array.isArray(result.records)
      ? result.records.map((raw) => mapProcess(raw))
      : [];

    return {
      records: items,
      total: result.total ?? 0,
    };
  } catch (err) {
    throw err instanceof ApprovalServiceError
      ? err
      : createNetworkError(err);
  }
}

/**
 * Get the count of pending approvals.
 *
 * Calls GET /approvals/pending/count.
 *
 * @returns The number of pending approvals
 */
export async function getPendingCount(): Promise<number> {
  try {
    return await api.get<number>('/approvals/pending/count');
  } catch (err) {
    throw err instanceof ApprovalServiceError
      ? err
      : createNetworkError(err);
  }
}

/**
 * Cancel an approval process.
 *
 * Calls POST /approvals/{processId}/cancel.
 *
 * @param processId - The approval process ID to cancel
 * @returns The updated ApprovalItem with CANCELLED status
 */
export async function cancelProcess(processId: number): Promise<ApprovalItem> {
  try {
    const raw = await api.post<RawApprovalProcess>(`/approvals/${processId}/cancel`);
    return mapProcess(raw);
  } catch (err) {
    throw err instanceof ApprovalServiceError
      ? err
      : createNetworkError(err);
  }
}

/**
 * Create a new approval process.
 *
 * Calls POST /approvals with the given data.
 *
 * @param data - The approval process creation payload
 * @returns The newly created ApprovalItem
 */
export async function createProcess(data: {
  processType: string;
  businessId?: number;
  businessData?: string;
}): Promise<ApprovalItem> {
  try {
    const raw = await api.post<RawApprovalProcess>('/approvals', data);
    return mapProcess(raw);
  } catch (err) {
    throw err instanceof ApprovalServiceError
      ? err
      : createNetworkError(err);
  }
}
