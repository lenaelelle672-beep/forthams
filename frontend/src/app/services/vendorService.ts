/**
 * @module frontend/src/app/services/vendorService
 * @description Vendor API service layer — real backend integration.
 *
 * Provides typed methods for all Vendor CRUD operations,
 * aligning with backend VendorController.java and VendorService.java.
 *
 * API endpoints (proxied via /api):
 *   GET    /vendors/list   — fetch all vendors
 *   GET    /vendors/{id}   — fetch single vendor by ID
 *   POST   /vendors        — create a new vendor
 *   PUT    /vendors/{id}   — update an existing vendor
 *   DELETE /vendors/{id}   — delete a vendor
 *
 * The Vendor entity has fields:
 *   id, name, vendorCode, contactPerson, contactPhone, contactEmail, address
 *
 * @see backend/src/main/java/com/ams/controller/VendorController.java
 * @see backend/src/main/java/com/ams/service/VendorService.java
 * @see backend/src/main/java/com/ams/entity/Vendor.java
 */

import { api } from "../utils/api";

// ---------------------------------------------------------------------------
// Types — mirror backend Vendor.java entity
// ---------------------------------------------------------------------------

/**
 * Vendor record as returned by the backend API.
 *
 * Fields align 1:1 with backend Vendor.java entity core attributes.
 * The `id` field is optional because it is not present during creation.
 */
export interface Vendor {
  /** 供应商 ID (server-assigned, absent during creation) */
  id?: number;
  /** 供应商名称 */
  name: string;
  /** 供应商编码 */
  vendorCode: string;
  /** 联系人 */
  contactPerson: string;
  /** 联系电话 */
  contactPhone: string;
  /** 联系邮箱 */
  contactEmail: string;
  /** 地址 */
  address?: string;
}

/**
 * Vendor record with optional extended fields from the backend response.
 */
export interface VendorRecord extends Vendor {
  /** 状态 (0=禁用, 1=启用) */
  status?: number;
  /** 创建时间 */
  createTime?: string;
  /** 更新时间 */
  updateTime?: string;
}

// ---------------------------------------------------------------------------
// API Base URL constant
// ---------------------------------------------------------------------------

/** Base URL for vendor API endpoints (relative to /api proxy) */
const BASE_URL = "/vendors";

// ---------------------------------------------------------------------------
// API service methods
// ---------------------------------------------------------------------------

export const vendorService = {
  /**
   * Fetch all vendors from the backend.
   *
   * Maps to: GET /api/vendors/list
   *
   * @returns array of vendor records
   */
  getVendors(): Promise<VendorRecord[]> {
    return api.get<VendorRecord[]>(`${BASE_URL}/list`);
  },

  /**
   * Fetch a single vendor by its ID.
   *
   * Maps to: GET /api/vendors/{id}
   *
   * @param id - vendor ID
   * @returns the vendor record
   */
  getVendorById(id: number | string): Promise<VendorRecord> {
    return api.get<VendorRecord>(`${BASE_URL}/${id}`);
  },

  /**
   * Create a new vendor.
   *
   * Maps to: POST /api/vendors
   *
   * @param payload - vendor data (name is required)
   * @returns the created vendor with server-assigned id
   */
  createVendor(payload: Omit<Vendor, "id">): Promise<VendorRecord> {
    return api.post<VendorRecord>(BASE_URL, payload);
  },

  /**
   * Update an existing vendor.
   *
   * Maps to: PUT /api/vendors/{id}
   *
   * @param id - vendor ID
   * @param payload - complete vendor object with updated fields
   * @returns the updated vendor record
   */
  updateVendor(id: number | string, payload: Omit<Vendor, "id">): Promise<VendorRecord> {
    return api.put<VendorRecord>(`${BASE_URL}/${id}`, payload);
  },

  /**
   * Search vendors by keyword.
   *
   * Maps to: GET /api/vendors?keyword=xxx
   *
   * @param keyword - search keyword to filter by name, vendorCode, etc.
   * @returns array of matching vendor records
   */
  searchVendors(keyword: string): Promise<VendorRecord[]> {
    return api.get<VendorRecord[]>(`${BASE_URL}?keyword=${encodeURIComponent(keyword)}`);
  },

  /**
   * Delete a vendor by ID.
   *
   * Maps to: DELETE /api/vendors/{id}
   *
   * @param id - vendor ID
   */
  deleteVendor(id: number | string): Promise<void> {
    return api.delete<void>(`${BASE_URL}/${id}`);
  },
};
