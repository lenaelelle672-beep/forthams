/**
 * @module frontend/src/app/services/vendorApi
 * @description Vendor API service layer — real backend integration.
 *
 * Provides typed methods for all Vendor CRUD operations,
 * aligning with backend VendorController.java endpoints:
 *   GET    /api/vendors/list   — fetch all vendors
 *   POST   /api/vendors        — create a new vendor
 *   PUT    /api/vendors/{id}   — update an existing vendor
 *   DELETE /api/vendors/{id}   — delete a vendor
 *
 * The Vendor entity has a strict 5-field boundary (plus id):
 *   name, vendorCode, contactPerson, contactPhone, contactEmail
 *
 * @see backend/src/main/java/com/ams/controller/VendorController.java
 * @see backend/src/main/java/com/ams/service/VendorService.java
 * @see backend/src/main/java/com/ams/entity/Vendor.java
 */

import { api } from "../utils/api";

// ---------------------------------------------------------------------------
// Types — mirror backend Vendor.java entity (5 business fields + id)
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
}

// ---------------------------------------------------------------------------
// API service functions
// ---------------------------------------------------------------------------

/**
 * Fetch all vendors from the backend.
 *
 * Maps to: GET /api/vendors/list
 * Backend: VendorService.list()
 *
 * @returns array of vendor records
 */
export async function getVendors(): Promise<Vendor[]> {
  return api.get<Vendor[]>("/vendors/list");
}

/**
 * Create a new vendor.
 *
 * Maps to: POST /api/vendors
 * Backend: VendorService.createVendor(Vendor vendor)
 *
 * @param data - vendor payload with the 5 business fields
 * @returns the created vendor with server-assigned id
 */
export async function createVendor(data: Omit<Vendor, "id">): Promise<Vendor> {
  return api.post<Vendor>("/vendors", data);
}

/**
 * Update an existing vendor.
 *
 * Maps to: PUT /api/vendors/{id}
 * Backend: VendorService.updateVendor(Long id, Vendor updatedVendor)
 *
 * @param id - vendor ID
 * @param data - vendor payload with updated fields
 * @returns the updated vendor record
 */
export async function updateVendor(
  id: number,
  data: Omit<Vendor, "id">,
): Promise<Vendor> {
  return api.put<Vendor>(`/vendors/${id}`, data);
}

/**
 * Delete a vendor by ID.
 *
 * Maps to: DELETE /api/vendors/{id}
 * Backend: VendorService.deleteVendor(Long id)
 *
 * @param id - vendor ID to delete
 */
export async function deleteVendor(id: number): Promise<void> {
  return api.delete<void>(`/vendors/${id}`);
}
