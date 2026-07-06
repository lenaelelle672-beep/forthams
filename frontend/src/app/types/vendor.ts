/**
 * @module types/vendor
 * @description Shared vendor type definitions for the frontend.
 *
 * Types strictly align with backend Vendor.java entity core fields.
 *
 * @see backend/src/main/java/com/ams/entity/Vendor.java
 */

/**
 * Vendor record matching the backend Vendor.java entity core attributes.
 *
 * The `id` field is absent during creation and server-assigned otherwise.
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

/**
 * Vendor record with optional extended fields from the backend response.
 *
 * The backend may return additional fields that are not part of the core
 * 6-tuple but may appear in the API response.
 */
export interface VendorRecord extends Vendor {
  /** 地址 */
  address?: string;
  /** 状态 (0=禁用, 1=启用) */
  status?: number;
  /** 创建时间 */
  createTime?: string;
  /** 更新时间 */
  updateTime?: string;
}

/**
 * Form data for creating or editing a vendor.
 *
 * Excludes `id` as it is not part of user-editable form fields.
 */
export interface VendorFormData {
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
