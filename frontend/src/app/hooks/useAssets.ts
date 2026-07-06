/**
 * useAssets — React hooks for asset CRUD operations with real API integration.
 *
 * SWARM-049: Provides reusable hooks for querying, creating, updating,
 * and deleting assets through the real backend API via assetService.
 *
 * @module hooks/useAssets
 * @since SWARM-049
 */

import { useState, useCallback, useEffect } from 'react';
import {
  assetService,
  type AssetRecord,
  type PagedResult,
  type AssetListQueryParams,
} from '../services/assetService';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * Return type for the useAssetList hook.
 *
 * @interface UseAssetListReturn
 */
export interface UseAssetListReturn {
  /** Current page of asset records */
  assets: AssetRecord[];
  /** Total record count for pagination */
  total: number;
  /** Loading state */
  loading: boolean;
  /** Error message if fetch failed */
  error: string | null;
  /** Fetch assets with given params */
  fetchAssets: (params?: AssetListQueryParams) => Promise<void>;
  /** Refresh with last-used params */
  refresh: () => Promise<void>;
}

/**
 * Return type for the useAssetDetail hook.
 *
 * @interface UseAssetDetailReturn
 */
export interface UseAssetDetailReturn {
  /** Asset record data */
  asset: AssetRecord | null;
  /** Loading state */
  loading: boolean;
  /** Error message if fetch failed */
  error: string | null;
  /** Fetch asset by ID */
  fetchAsset: (id: string | number) => Promise<void>;
  /** Refresh current asset */
  refresh: () => Promise<void>;
}

/**
 * Return type for the useAssetMutation hook.
 *
 * @interface UseAssetMutationReturn
 */
export interface UseAssetMutationReturn {
  /** Loading state for the current mutation */
  loading: boolean;
  /** Error message if mutation failed */
  error: string | null;
  /** Result of the last successful mutation */
  result: AssetRecord | null;
  /** Create a new asset */
  create: (payload: Record<string, unknown>) => Promise<AssetRecord | null>;
  /** Update an existing asset */
  update: (id: string | number, payload: Record<string, unknown>) => Promise<AssetRecord | null>;
  /** Delete an asset */
  remove: (id: string | number) => Promise<boolean>;
  /** Reset mutation state */
  reset: () => void;
}

// ---------------------------------------------------------------------------
// useAssetList
// ---------------------------------------------------------------------------

/**
 * Hook for fetching a paginated, filtered list of assets.
 *
 * Connects to the real backend API via assetService.list().
 *
 * @param initialParams - Initial query parameters (optional)
 * @returns Asset list state and fetch callbacks
 *
 * @example
 * ```tsx
 * const { assets, total, loading, fetchAssets } = useAssetList();
 * useEffect(() => { fetchAssets({ page: 1, pageSize: 20 }); }, []);
 * ```
 */
export function useAssetList(
  initialParams?: AssetListQueryParams,
): UseAssetListReturn {
  const [assets, setAssets] = useState<AssetRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastParams, setLastParams] = useState<AssetListQueryParams | undefined>(initialParams);

  /**
   * Fetch assets from the backend API with the given query parameters.
   *
   * @param params - Query parameters for filtering and pagination
   */
  const fetchAssets = useCallback(async (params?: AssetListQueryParams) => {
    const queryParams = params ?? lastParams;
    setLastParams(queryParams);
    setLoading(true);
    setError(null);

    try {
      const paged: PagedResult<AssetRecord> = await assetService.list(
        queryParams as Record<string, unknown>,
      );
      setAssets(paged?.records ?? []);
      setTotal(paged?.total ?? 0);
    } catch (err) {
      const message = err instanceof Error ? err.message : '获取资产列表失败';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [lastParams]);

  /**
   * Refresh the list using the last-used parameters.
   */
  const refresh = useCallback(async () => {
    await fetchAssets(lastParams);
  }, [fetchAssets, lastParams]);

  return {
    assets,
    total,
    loading,
    error,
    fetchAssets,
    refresh,
  };
}

// ---------------------------------------------------------------------------
// useAssetDetail
// ---------------------------------------------------------------------------

/**
 * Hook for fetching a single asset's detail by ID.
 *
 * Connects to the real backend API via assetService.getById().
 *
 * @param assetId - Optional asset ID to fetch on mount
 * @returns Asset detail state and fetch callbacks
 *
 * @example
 * ```tsx
 * const { asset, loading, fetchAsset } = useAssetDetail();
 * useEffect(() => { if (id) fetchAsset(id); }, [id]);
 * ```
 */
export function useAssetDetail(assetId?: string | number | null): UseAssetDetailReturn {
  const [asset, setAsset] = useState<AssetRecord | null>(null);
  const [loading, setLoading] = useState(assetId != null);
  const [error, setError] = useState<string | null>(null);
  const [lastId, setLastId] = useState<string | number | null>(assetId ?? null);

  /**
   * Fetch asset detail from the backend API by ID.
   *
   * @param id - Asset ID to fetch
   */
  const fetchAsset = useCallback(async (id: string | number) => {
    setLoading(true);
    setError(null);
    setLastId(id);

    try {
      const record = await assetService.getById(id);
      setAsset(record);
    } catch (err) {
      const message = err instanceof Error ? err.message : '获取资产详情失败';
      setError(message);
      setAsset(null);
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Refresh the current asset data.
   */
  const refresh = useCallback(async () => {
    if (lastId != null) {
      await fetchAsset(lastId);
    }
  }, [fetchAsset, lastId]);

  // Auto-fetch when assetId is provided
  useEffect(() => {
    if (assetId != null) {
      fetchAsset(assetId);
    }
  }, [assetId, fetchAsset]);

  return {
    asset,
    loading,
    error,
    fetchAsset,
    refresh,
  };
}

// ---------------------------------------------------------------------------
// useAssetMutation
// ---------------------------------------------------------------------------

/**
 * Hook for asset create, update, and delete mutations.
 *
 * Connects to the real backend API via assetService methods.
 * Provides loading, error, and result state for mutation tracking.
 *
 * @returns Mutation state and action callbacks
 *
 * @example
 * ```tsx
 * const { create, update, remove, loading, error } = useAssetMutation();
 * const newAsset = await create({ name: '笔记本电脑', ... });
 * ```
 */
export function useAssetMutation(): UseAssetMutationReturn {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AssetRecord | null>(null);

  /**
   * Create a new asset via the backend API.
   *
   * @param payload - Asset creation data
   * @returns The created asset record, or null on failure
   */
  const create = useCallback(async (payload: Record<string, unknown>): Promise<AssetRecord | null> => {
    setLoading(true);
    setError(null);

    try {
      const created = await assetService.create(payload);
      setResult(created);
      return created;
    } catch (err) {
      const message = err instanceof Error ? err.message : '创建资产失败';
      setError(message);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Update an existing asset via the backend API.
   *
   * @param id - Asset ID to update
   * @param payload - Updated asset data
   * @returns The updated asset record, or null on failure
   */
  const update = useCallback(async (
    id: string | number,
    payload: Record<string, unknown>,
  ): Promise<AssetRecord | null> => {
    setLoading(true);
    setError(null);

    try {
      const updated = await assetService.update(id, payload);
      setResult(updated);
      return updated;
    } catch (err) {
      const message = err instanceof Error ? err.message : '更新资产失败';
      setError(message);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Delete an asset via the backend API.
   *
   * @param id - Asset ID to delete
   * @returns True if deletion succeeded, false otherwise
   */
  const remove = useCallback(async (id: string | number): Promise<boolean> => {
    setLoading(true);
    setError(null);

    try {
      await assetService.delete(id);
      setResult(null);
      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : '删除资产失败';
      setError(message);
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Reset mutation state to initial values.
   */
  const reset = useCallback(() => {
    setLoading(false);
    setError(null);
    setResult(null);
  }, []);

  return {
    loading,
    error,
    result,
    create,
    update,
    remove,
    reset,
  };
}

export default useAssetList;
