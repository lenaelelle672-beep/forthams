/**
 * @file hooks/asset/useAssetRelations.ts
 * @description 资产父子关系 TanStack Query hooks — 查询/添加/删除 with 缓存失效
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getRelations,
  addRelation,
  removeRelation,
  getRelationTree,
} from '@/api/asset';
import type { AddRelationRequest, RelationVO, RelationTreeNode } from '@/types/asset';
import { toast } from 'sonner';

export const relationKeys = {
  all:     ['asset-relations'] as const,
  list:    (assetId: number) => [...relationKeys.all, 'list', assetId] as const,
  tree:    (assetId: number) => [...relationKeys.all, 'tree', assetId] as const,
};

/**
 * 获取子资产关联列表。
 */
export function useAssetRelations(assetId: number | null) {
  return useQuery({
    queryKey: relationKeys.list(assetId!),
    queryFn:  () => getRelations(assetId!),
    enabled:  !!assetId,
    staleTime: 1000 * 30,
  });
}

/**
 * 获取父子关系树。
 */
export function useRelationTree(assetId: number | null) {
  return useQuery({
    queryKey: relationKeys.tree(assetId!),
    queryFn:  () => getRelationTree(assetId!),
    enabled:  !!assetId,
    staleTime: 1000 * 30,
  });
}

/**
 * 添加父子关系。
 */
export function useAddRelation(assetId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: AddRelationRequest) => addRelation(assetId, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: relationKeys.list(assetId) });
      qc.invalidateQueries({ queryKey: relationKeys.tree(assetId) });
      toast.success('父子关系添加成功');
    },
    onError: (err: Error) => {
      toast.error(err.message || '添加父子关系失败');
    },
  });
}

/**
 * 删除父子关系。
 */
export function useRemoveRelation(assetId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (relationId: number) => removeRelation(assetId, relationId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: relationKeys.list(assetId) });
      qc.invalidateQueries({ queryKey: relationKeys.tree(assetId) });
      toast.success('父子关系删除成功');
    },
    onError: (err: Error) => {
      toast.error(err.message || '删除父子关系失败');
    },
  });
}
