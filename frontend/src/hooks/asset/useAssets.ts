/**
 * @file hooks/asset/useAssets.ts
 * @description 资产模块 TanStack Query hooks
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getAssetList, getAssetById, createAsset,
  updateAsset, deleteAsset, getCategoryTree,
} from '@/api/asset';
import type { AssetListQuery } from '@/types/asset';

export const assetKeys = {
  all:     ['assets'] as const,
  lists:   () => [...assetKeys.all, 'list'] as const,
  list:    (q: AssetListQuery) => [...assetKeys.lists(), q] as const,
  details: () => [...assetKeys.all, 'detail'] as const,
  detail:  (id: number) => [...assetKeys.details(), id] as const,
  categories: ['asset-categories'] as const,
};

export function useAssetList(params: AssetListQuery) {
  return useQuery({
    queryKey: assetKeys.list(params),
    queryFn:  () => getAssetList(params),
    staleTime: 1000 * 30,
    placeholderData: (prev) => prev,
  });
}

export function useAssetDetail(id: number | null) {
  return useQuery({
    queryKey: assetKeys.detail(id!),
    queryFn:  () => getAssetById(id!),
    enabled:  !!id,
    staleTime: 1000 * 60,
  });
}

export function useCategoryTree() {
  return useQuery({
    queryKey: assetKeys.categories,
    queryFn:  getCategoryTree,
    staleTime: 1000 * 60 * 30,
  });
}

export function useCreateAsset() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: createAsset,
    onSuccess: () => qc.invalidateQueries({ queryKey: assetKeys.lists() }),
  });
}

export function useUpdateAsset() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: updateAsset,
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: assetKeys.lists() });
      qc.invalidateQueries({ queryKey: assetKeys.detail(vars.id) });
    },
  });
}

export function useDeleteAsset() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: deleteAsset,
    onSuccess: () => qc.invalidateQueries({ queryKey: assetKeys.lists() }),
  });
}
