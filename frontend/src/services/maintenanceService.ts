/**
 * @module frontend/src/app/services/maintenanceService
 * @description Maintenance record API service layer — provides typed CRUD
 * operations for maintenance records via the shared `api` utility.
 *
 * API endpoints (proxied via /api):
 *   GET    /maintenance/list              — paginated maintenance record list
 *   GET    /maintenance/{id}              — single maintenance record
 *   POST   /maintenance                   — create a new maintenance record
 *   PUT    /maintenance/{id}              — update an existing record
 *   DELETE /maintenance/{id}              — delete a record
 *   GET    /maintenance/upcoming?days=30  — upcoming maintenance records
 *
 * All endpoints go through the shared `api` util which unwraps the backend
 * `Result<T>` envelope and injects the auth token.
 */

import http from '@/utils/http';
const api = http;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Maintenance type enumeration */
export type MaintenanceType = "preventive" | "corrective" | "emergency" | "routine";

/** Maintenance record returned by the backend API */
export interface MaintenanceRecord {
  /** Unique record ID */
  id: number;
  /** Tenant ID (set by backend) */
  tenantId?: string;
  /** Associated asset ID */
  assetId: number;
  /** Type of maintenance performed */
  maintenanceType: string;
  /** Date the maintenance was performed (ISO 8601) */
  maintenanceDate: string;
  /** Next scheduled maintenance date (ISO 8601) */
  nextMaintenanceDate: string | null;
  /** Cost of the maintenance */
  cost: number | null;
  /** Person who performed the maintenance */
  executor: string | null;
  /** Description of the maintenance content */
  content: string;
  /** Result of the maintenance */
  result: string | null;
  /** Additional remarks */
  remark: string | null;
  /** Creator user ID */
  createBy?: number | null;
  /** Creation timestamp (ISO 8601) */
  createTime?: string;
  /** Last update timestamp (ISO 8601) */
  updateTime?: string;
}

/** Payload for creating a new maintenance record */
export interface CreateMaintenancePayload {
  /** Asset ID to associate with */
  assetId?: number;
  /** Type of maintenance */
  maintenanceType?: string;
  /** Date of maintenance */
  maintenanceDate?: string;
  /** Next scheduled maintenance date */
  nextMaintenanceDate?: string;
  /** Person performing the maintenance */
  executor?: string;
  /** Description of maintenance content */
  content?: string;
  /** Cost of maintenance */
  cost?: number;
  /** Result description */
  result?: string;
  /** Additional remarks */
  remark?: string;
}

/** Payload for updating an existing maintenance record */
export interface UpdateMaintenancePayload {
  maintenanceType?: string;
  maintenanceDate?: string;
  nextMaintenanceDate?: string;
  executor?: string;
  content?: string;
  cost?: number;
  result?: string;
  remark?: string;
}

/** Query parameters for listing maintenance records */
export interface MaintenanceListParams {
  page?: number;
  pageSize?: number;
  assetId?: number;
  maintenanceType?: string;
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

export const maintenanceService = {
  /**
   * Fetch a paginated list of maintenance records.
   * GET /api/maintenance/list
   */
  list(params?: MaintenanceListParams): Promise<PageResponse<MaintenanceRecord>> {
    return api.get<PageResponse<MaintenanceRecord>>("/maintenance/list", { params });
  },

  /**
   * Fetch a single maintenance record by ID.
   * GET /api/maintenance/{id}
   */
  getById(id: number | string): Promise<MaintenanceRecord> {
    return api.get<MaintenanceRecord>(`/maintenance/${id}`);
  },

  /**
   * Create a new maintenance record.
   * POST /api/maintenance
   */
  create(data: CreateMaintenancePayload): Promise<MaintenanceRecord> {
    return api.post<MaintenanceRecord>("/maintenance", data);
  },

  /**
   * Update an existing maintenance record.
   * PUT /api/maintenance/{id}
   */
  update(id: number | string, data: UpdateMaintenancePayload): Promise<MaintenanceRecord> {
    return api.put<MaintenanceRecord>(`/maintenance/${id}`, data);
  },

  /**
   * Delete a maintenance record.
   * DELETE /api/maintenance/{id}
   */
  delete(id: number | string): Promise<void> {
    return api.delete<void>(`/maintenance/${id}`);
  },

  /**
   * Fetch upcoming maintenance records within the given number of days.
   * GET /api/maintenance/upcoming?days={days}
   */
  getUpcoming(days = 30): Promise<MaintenanceRecord[]> {
    return api.get<MaintenanceRecord[]>("/maintenance/upcoming", {
      params: { days },
    });
  },
};
