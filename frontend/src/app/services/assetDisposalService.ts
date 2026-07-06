/**
 * Asset Disposal Service
 *
 * Provides API methods for browsing disposal (retirement) requests,
 * viewing disposal details, and performing approve/reject actions on
 * disposal workflows.
 *
 * Backend endpoints are served by RetirementController under /retirement.
 *
 * @module services/assetDisposalService
 * @since SWARM-028
 */

import { api } from '../utils/api';

// ---------------------------------------------------------------------------
// TypeScript interfaces
// ---------------------------------------------------------------------------

/**
 * Disposal application status values mirroring the backend enum.
 *
 * DRAFT → PENDING → APPROVED → COMPLETED
 *                  → REJECTED
 *         → CANCELLED
 */
export type DisposalStatus =
  | 'DRAFT'
  | 'PENDING'
  | 'APPROVING'
  | 'APPROVED'
  | 'COMPLETED'
  | 'REJECTED'
  | 'CANCELLED';

/**
 * Retirement / disposal type.
 */
export type DisposalType = 'SCRAP' | 'RETIREMENT';

/**
 * Disposal application record returned by the backend.
 *
 * @description Maps to `RetirementApplication` entity from backend.
 */
export interface DisposalApplication {
  /** Application unique ID */
  id: number;
  /** Tenant ID */
  tenantId?: string;
  /** Application number / code */
  applicationNo?: string;
  /** Associated asset ID */
  assetId: number;
  /** Asset display name */
  assetName?: string;
  /** Asset code / number */
  assetCode?: string;
  /** Applicant user ID */
  applicantId?: number;
  /** Applicant display name */
  applicantName?: string;
  /** Department ID */
  deptId?: number;
  /** Department name */
  deptName?: string;
  /** Disposal type: SCRAP or RETIREMENT */
  retirementType?: DisposalType;
  /** Reason for disposal */
  reason?: string;
  /** Estimated residual value */
  estimatedResidualValue?: number;
  /** Current application status */
  status: DisposalStatus;
  /** Current approval step (1-based) */
  currentApprovalStep?: number;
  /** Total approval steps needed */
  totalApprovalSteps?: number;
  /** Attachment URLs (JSON string) */
  attachments?: string;
  /** Remark / notes */
  remark?: string;
  /** Record creation time */
  createTime?: string;
  /** Last update time */
  updateTime?: string;
}

/**
 * Paginated response for disposal application list queries.
 */
export interface DisposalListResponse {
  /** Application records for current page */
  records: DisposalApplication[];
  /** Total record count across all pages */
  total: number;
  /** Current page number */
  current?: number;
  /** Page size */
  size?: number;
}

/**
 * Query parameters for the disposal application list endpoint.
 */
export interface DisposalListParams {
  /** Page number (1-based), defaults to 1 */
  page?: number;
  /** Page size, defaults to 10 */
  pageSize?: number;
  /** Filter by application status */
  status?: DisposalStatus | '';
  /** Filter by asset ID */
  assetId?: number;
}

/**
 * Statistics summary returned by the /statistics endpoint.
 */
export interface DisposalStatistics {
  /** Total applications count */
  total?: number;
  /** Count of pending applications */
  pending?: number;
  /** Count of approved applications */
  approved?: number;
  /** Count of completed applications */
  completed?: number;
  /** Count of rejected applications */
  rejected?: number;
  /** Count of cancelled applications */
  cancelled?: number;
}

// ---------------------------------------------------------------------------
// API methods
// ---------------------------------------------------------------------------

/**
 * Fetch a paginated list of disposal applications.
 *
 * @param params - Query and pagination parameters
 * @returns Paginated disposal application list
 *
 * @example
 * ```ts
 * const { records, total } = await fetchDisposalList({ page: 1, pageSize: 10 });
 * ```
 */
export async function fetchDisposalList(
  params?: DisposalListParams,
): Promise<DisposalListResponse> {
  return api.get<DisposalListResponse>('/retirement/applications', {
    params: {
      page: params?.page ?? 1,
      pageSize: params?.pageSize ?? 10,
      status: params?.status || undefined,
      assetId: params?.assetId || undefined,
    },
  });
}

/**
 * Fetch a single disposal application by ID.
 *
 * @param id - The application ID
 * @returns The disposal application detail
 *
 * @example
 * ```ts
 * const app = await fetchDisposalDetail(42);
 * console.log(app.status); // "PENDING"
 * ```
 */
export async function fetchDisposalDetail(
  id: number,
): Promise<DisposalApplication> {
  return api.get<DisposalApplication>(`/retirement/${id}`);
}

/**
 * Approve a pending disposal application.
 *
 * @param id - The application ID to approve
 * @returns The updated disposal application
 *
 * @example
 * ```ts
 * const result = await approveDisposal(42);
 * expect(result.status).toBe('APPROVED');
 * ```
 */
export async function approveDisposal(
  id: number,
): Promise<DisposalApplication> {
  return api.post<DisposalApplication>(`/retirement/${id}/approve`);
}

/**
 * Reject a pending disposal application.
 *
 * @param id - The application ID to reject
 * @param reason - The rejection reason
 * @returns The updated disposal application
 *
 * @example
 * ```ts
 * const result = await rejectDisposal(42, '资产仍在保固期内');
 * expect(result.status).toBe('REJECTED');
 * ```
 */
export async function rejectDisposal(
  id: number,
  reason?: string,
): Promise<DisposalApplication> {
  return api.post<DisposalApplication>(`/retirement/${id}/reject`, {
    reason,
  });
}

/**
 * Fetch disposal statistics summary.
 *
 * @returns Statistics object with counts per status
 *
 * @example
 * ```ts
 * const stats = await fetchDisposalStatistics();
 * console.log(stats.pending); // 5
 * ```
 */
export async function fetchDisposalStatistics(): Promise<DisposalStatistics> {
  return api.get<DisposalStatistics>('/retirement/statistics');
}

/**
 * Fetch disposal history for a specific asset.
 *
 * @param assetId - The asset ID to query history for
 * @returns List of disposal applications for the asset
 */
export async function fetchAssetDisposalHistory(
  assetId: number,
): Promise<DisposalApplication[]> {
  return api.get<DisposalApplication[]>(`/retirement/asset/${assetId}`);
}

export interface DisposalApprovalRecord {
  id: number;
  applicationId: number;
  stepNo: number;
  operatorId: number;
  operatorName?: string;
  result: string;
  comment?: string;
  operatedAt: string;
}

export async function fetchDisposalApprovalHistory(
  id: number,
): Promise<DisposalApprovalRecord[]> {
  return api.get<DisposalApprovalRecord[]>(`/retirement/${id}/approval-history`);
}

export async function approveDisposalWithComment(
  id: number,
  comment?: string,
): Promise<DisposalApplication> {
  return api.post<DisposalApplication>(`/retirement/${id}/approve`, { comment });
}

export async function rejectDisposalWithReason(
  id: number,
  reason: string,
): Promise<DisposalApplication> {
  return api.post<DisposalApplication>(`/retirement/${id}/reject`, { reason });
}
