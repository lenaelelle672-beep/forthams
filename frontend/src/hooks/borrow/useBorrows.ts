/**
 * @file hooks/borrow/useBorrows.ts
 * @description 借用管理 TanStack Query hooks
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getBorrows, getBorrow, createBorrow, updateBorrow,
  deleteBorrow, submitBorrow, approveBorrow, rejectBorrow,
  borrowAsset, returnBorrow, cancelBorrow,
} from '@/api/borrow';
import type { BorrowListQuery } from '@/types/borrow';
import { toast } from 'sonner';

export const borrowKeys = {
  all:     ['borrows'] as const,
  lists:   () => [...borrowKeys.all, 'list'] as const,
  list:    (q: BorrowListQuery) => [...borrowKeys.lists(), q] as const,
  details: () => [...borrowKeys.all, 'detail'] as const,
  detail:  (id: number) => [...borrowKeys.details(), id] as const,
};

export function useBorrows(params: BorrowListQuery) {
  return useQuery({ queryKey: borrowKeys.list(params), queryFn: () => getBorrows(params), staleTime: 1000 * 30, placeholderData: (prev) => prev });
}

export function useBorrowDetail(id: number | null) {
  return useQuery({ queryKey: borrowKeys.detail(id!), queryFn: () => getBorrow(id!), enabled: !!id, staleTime: 1000 * 30 });
}

export function useCreateBorrow() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: createBorrow,
    onSuccess: () => { qc.invalidateQueries({ queryKey: borrowKeys.lists() }); toast.success('借用单创建成功'); },
    onError: (err: Error) => toast.error(err.message || '创建失败'),
  });
}

export function useUpdateBorrow() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) => updateBorrow(id, data),
    onSuccess: (_, vars) => { qc.invalidateQueries({ queryKey: borrowKeys.lists() }); qc.invalidateQueries({ queryKey: borrowKeys.detail(vars.id) }); toast.success('借用单更新成功'); },
    onError: (err: Error) => toast.error(err.message || '更新失败'),
  });
}

export function useDeleteBorrow() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: deleteBorrow,
    onSuccess: () => { qc.invalidateQueries({ queryKey: borrowKeys.lists() }); toast.success('借用单已删除'); },
    onError: (err: Error) => toast.error(err.message || '删除失败'),
  });
}

export function useSubmitBorrow() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: submitBorrow,
    onSuccess: (_, id) => { qc.invalidateQueries({ queryKey: borrowKeys.detail(id) }); qc.invalidateQueries({ queryKey: borrowKeys.lists() }); toast.success('已提交审批'); },
    onError: (err: Error) => toast.error(err.message || '提交失败'),
  });
}

export function useApproveBorrow() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: approveBorrow,
    onSuccess: (_, id) => { qc.invalidateQueries({ queryKey: borrowKeys.detail(id) }); qc.invalidateQueries({ queryKey: borrowKeys.lists() }); toast.success('已审批通过'); },
    onError: (err: Error) => toast.error(err.message || '审批失败'),
  });
}

export function useRejectBorrow() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, reason }: { id: number; reason?: string }) => rejectBorrow(id, reason),
    onSuccess: (_, vars) => { qc.invalidateQueries({ queryKey: borrowKeys.detail(vars.id) }); qc.invalidateQueries({ queryKey: borrowKeys.lists() }); toast.success('已驳回'); },
    onError: (err: Error) => toast.error(err.message || '驳回失败'),
  });
}

export function useBorrowAsset() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: borrowAsset,
    onSuccess: (_, id) => { qc.invalidateQueries({ queryKey: borrowKeys.detail(id) }); qc.invalidateQueries({ queryKey: borrowKeys.lists() }); toast.success('资产已借出'); },
    onError: (err: Error) => toast.error(err.message || '借出失败'),
  });
}

export function useReturnBorrow() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, remark }: { id: number; remark?: string }) => returnBorrow(id, remark),
    onSuccess: (_, vars) => { qc.invalidateQueries({ queryKey: borrowKeys.detail(vars.id) }); qc.invalidateQueries({ queryKey: borrowKeys.lists() }); toast.success('资产已归还'); },
    onError: (err: Error) => toast.error(err.message || '归还失败'),
  });
}

export function useCancelBorrow() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: cancelBorrow,
    onSuccess: (_, id) => { qc.invalidateQueries({ queryKey: borrowKeys.detail(id) }); qc.invalidateQueries({ queryKey: borrowKeys.lists() }); toast.success('借用单已取消'); },
    onError: (err: Error) => toast.error(err.message || '取消失败'),
  });
}
