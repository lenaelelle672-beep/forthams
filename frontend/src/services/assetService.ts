/**
 * Asset Service Module
 * 
 * Provides API methods for asset management operations including:
 * - Asset CRUD operations
 * - Asset detail retrieval
 * - Asset search and filtering
 * - Asset status management
 * 
 * @module services/assetService
 * @version 1.0.0
 */

import { apiClient } from '@/app/utils/api';
import type { Asset, AssetDetail, AssetQuery, AssetListResponse } from '@/types/asset.types';

/**
 * Query parameters for asset listing
 * 
 * @interface AssetListParams
 */
export interface AssetListParams {
  page?: number;
  pageSize?: number;
  categoryId?: string;
  status?: string;
  keyword?: string;
  departmentId?: string;
}

/**
 * Retrieves a list of assets with optional filtering
 * 
 * @param params - Query parameters for filtering assets
 * @returns Promise resolving to paginated asset list
 * @throws {ApiError} When API request fails
 * 
 * @example
 * ```ts
 * const assets = await getAssetList({ page: 1, pageSize: 20 });
 * ```
 */
export async function getAssetList(params: AssetListParams = {}): Promise<AssetListResponse> {
  const { page = 1, pageSize = 20, ...filters } = params;
  
  return apiClient.get<AssetListResponse>('/api/assets', {
    params: {
      page,
      pageSize,
      ...filters,
    },
  });
}

/**
 * Retrieves detailed information for a specific asset
 * 
 * @param assetId - Unique identifier of the asset
 * @returns Promise resolving to asset details
 * @throws {ApiError} When asset not found or API fails
 * 
 * @example
 * ```ts
 * const detail = await getAssetDetail('asset-123');
 * ```
 */
export async function getAssetDetail(assetId: string): Promise<AssetDetail> {
  return apiClient.get<AssetDetail>(`/api/assets/${assetId}`);
}

/**
 * Creates a new asset record
 * 
 * @param assetData - Asset creation payload
 * @returns Promise resolving to created asset
 * @throws {ApiError} When validation fails or API errors
 */
export async function createAsset(assetData: Partial<Asset>): Promise<AssetDetail> {
  return apiClient.post<AssetDetail>('/api/assets', assetData);
}

/**
 * Updates an existing asset
 * 
 * @param assetId - Unique identifier of the asset to update
 * @param updates - Partial asset data for update
 * @returns Promise resolving to updated asset
 * @throws {ApiError} When asset not found or validation fails
 */
export async function updateAsset(assetId: string, updates: Partial<Asset>): Promise<AssetDetail> {
  return apiClient.put<AssetDetail>(`/api/assets/${assetId}`, updates);
}

/**
 * Deletes an asset (soft delete)
 * 
 * @param assetId - Unique identifier of the asset to delete
 * @returns Promise resolving to deletion confirmation
 * @throws {ApiError} When asset not found or deletion fails
 */
export async function deleteAsset(assetId: string): Promise<void> {
  return apiClient.delete<void>(`/api/assets/${assetId}`);
}

/**
 * Transfers asset to another department
 * 
 * @param assetId - Unique identifier of the asset
 * @param targetDepartmentId - Target department ID
 * @param reason - Transfer reason
 * @returns Promise resolving to transfer result
 */
export async function transferAsset(
  assetId: string,
  targetDepartmentId: string,
  reason?: string
): Promise<AssetDetail> {
  return apiClient.post<AssetDetail>(`/api/assets/${assetId}/transfer`, {
    targetDepartmentId,
    reason,
  });
}

/**
 * Retrieves audit logs for a specific asset
 * 
 * @param assetId - Unique identifier of the asset
 * @param params - Optional query parameters for filtering logs
 * @returns Promise resolving to audit log entries
 */
export async function getAssetAuditLogs(
  assetId: string,
  params?: { page?: number; pageSize?: number; operation?: string }
): Promise<{ data: any[]; total: number }> {
  return apiClient.get(`/api/assets/${assetId}/audit-logs`, { params });
}

/**
 * Exports asset data in specified format
 * 
 * @param assetIds - Array of asset IDs to export
 * @param format - Export format (csv, excel, pdf)
 * @returns Promise resolving to download URL
 */
export async function exportAssets(
  assetIds: string[],
  format: 'csv' | 'excel' | 'pdf' = 'csv'
): Promise<{ downloadUrl: string }> {
  return apiClient.post('/api/assets/export', {
    assetIds,
    format,
  });
}

/**
 * Asset Service class for managing asset operations
 * 
 * @class AssetService
 * @description Centralized service for all asset-related API operations
 */
export class AssetService {
  /**
   * Retrieves asset by ID with full details
   * 
   * @param assetId - Asset unique identifier
   * @returns Asset detail with relationships
   */
  static async getById(assetId: string): Promise<AssetDetail> {
    return getAssetDetail(assetId);
  }

  /**
   * Retrieves paginated asset list
   * 
   * @param params - Query parameters
   * @returns Paginated asset response
   */
  static async list(params: AssetListParams): Promise<AssetListResponse> {
    return getAssetList(params);
  }

  /**
   * Creates new asset
   * 
   * @param data - Asset creation data
   * @returns Created asset detail
   */
  static async create(data: Partial<Asset>): Promise<AssetDetail> {
    return createAsset(data);
  }

  /**
   * Updates existing asset
   * 
   * @param assetId - Asset ID
   * @param data - Update data
   * @returns Updated asset detail
   */
  static async update(assetId: string, data: Partial<Asset>): Promise<AssetDetail> {
    return updateAsset(assetId, data);
  }

  /**
   * Removes asset (soft delete)
   * 
   * @param assetId - Asset ID
   */
  static async remove(assetId: string): Promise<void> {
    return deleteAsset(assetId);
  }

  /**
   * Transfers asset to department
   * 
   * @param assetId - Asset ID
   * @param deptId - Target department ID
   * @param reason - Transfer reason
   * @returns Updated asset detail
   */
  static async transfer(
    assetId: string,
    deptId: string,
    reason?: string
  ): Promise<AssetDetail> {
    return transferAsset(assetId, deptId, reason);
  }

  /**
   * Gets audit history for asset
   * 
   * @param assetId - Asset ID
   * @param options - Query options
   * @returns Audit log entries
   */
  static async getAuditHistory(
    assetId: string,
    options?: { page?: number; pageSize?: number; operation?: string }
  ): Promise<{ data: any[]; total: number }> {
    return getAssetAuditLogs(assetId, options);
  }

  /**
   * Exports assets
   * 
   * @param ids - Asset IDs
   * @param format - Export format
   * @returns Download URL
   */
  static async export(ids: string[], format: 'csv' | 'excel' | 'pdf' = 'csv'): Promise<{ downloadUrl: string }> {
    return exportAssets(ids, format);
  }
}

export default AssetService;