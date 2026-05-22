/**
 * useAssetById Hook
 * 
 * SWARM-051: Frontend Integration - Asset Detail Page Development
 * Provides reactive data fetching for individual asset by ID.
 * 
 * @module hooks/useAssetById
 */

import { useQuery } from '@tanstack/react-query';
import { assetService } from '@/services/assetService';
import type { Asset } from '@/types/asset';

/**
 * Query key for asset detail queries
 * @param assetId - The unique identifier of the asset
 * @returns Query key tuple for React Query
 */
export const assetByIdKeys = {
  all: ['assets'] as const,
  details: () => [...assetByIdKeys.all, 'detail'] as const,
  detail: (assetId: string) => [...assetByIdKeys.details(), assetId] as const,
};

/**
 * Hook to fetch asset details by asset ID
 * 
 * SWARM-051: Integrates with AuditService for audit log binding.
 * The returned asset data will be used with audit visualization components.
 * 
 * @param assetId - The unique identifier of the asset to fetch
 * @param options - Query configuration options
 * @returns Query result containing asset data
 * 
 * @example
 * ```tsx
 * const { data: asset, isLoading, error } = useAssetById('asset-123');
 * ```
 */
export function useAssetById(
  assetId: string,
  options?: {
    enabled?: boolean;
    staleTime?: number;
    retry?: boolean;
  }
) {
  const { enabled = true, staleTime = 300000, retry = true } = options ?? {};

  return useQuery({
    queryKey: assetByIdKeys.detail(assetId),
    queryFn: async (): Promise<Asset> => {
      const response = await assetService.getAssetById(assetId);
      return response.data;
    },
    enabled: Boolean(assetId) && enabled,
    staleTime,
    retry: retry ? 2 : false,
  });
}

export default useAssetById;