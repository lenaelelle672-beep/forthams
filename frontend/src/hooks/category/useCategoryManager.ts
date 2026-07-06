/**
 * @file hooks/category/useCategoryManager.ts
 * @description 分类管理 TanStack Query hooks — CRUD + 树形数据
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getCategoryTree,
  createCategory,
  updateCategory,
  deleteCategory,
} from '@/api/asset';
import type { AssetCategory } from '@/types/asset';

export const categoryKeys = {
  all:        ['asset-categories'] as const,
  tree:       () => [...categoryKeys.all, 'tree'] as const,
  list:       () => [...categoryKeys.all, 'list'] as const,
};

export function useCategoryTreeData() {
  return useQuery({
    queryKey: categoryKeys.tree(),
    queryFn:  getCategoryTree,
    staleTime: 1000 * 60 * 30,
  });
}

export function useCreateCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: createCategory,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: categoryKeys.tree() });
      qc.invalidateQueries({ queryKey: categoryKeys.list() });
    },
  });
}

export function useUpdateCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<AssetCategory> }) =>
      updateCategory(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: categoryKeys.tree() });
      qc.invalidateQueries({ queryKey: categoryKeys.list() });
    },
  });
}

export function useDeleteCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: deleteCategory,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: categoryKeys.tree() });
      qc.invalidateQueries({ queryKey: categoryKeys.list() });
    },
  });
}
