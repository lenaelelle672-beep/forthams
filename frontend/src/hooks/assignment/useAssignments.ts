/**
 * @file hooks/assignment/useAssignments.ts
 * @description 领用归还 TanStack Query hooks
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getAssignments, getAssignment, createAssignment,
  updateAssignment, deleteAssignment, submitAssignment,
  approveAssignment, rejectAssignment, checkoutAssignment,
  returnRequestAssignment, approveReturnAssignment, cancelAssignment,
} from '@/api/assignment';
import type { AssignmentListQuery } from '@/types/assignment';
import { toast } from 'sonner';

export const assignmentKeys = {
  all:     ['assignments'] as const,
  lists:   () => [...assignmentKeys.all, 'list'] as const,
  list:    (q: AssignmentListQuery) => [...assignmentKeys.lists(), q] as const,
  details: () => [...assignmentKeys.all, 'detail'] as const,
  detail:  (id: number) => [...assignmentKeys.details(), id] as const,
};

export function useAssignments(params: AssignmentListQuery) {
  return useQuery({
    queryKey: assignmentKeys.list(params),
    queryFn:  () => getAssignments(params),
    staleTime: 1000 * 30,
    placeholderData: (prev) => prev,
  });
}

export function useAssignmentDetail(id: number | null) {
  return useQuery({
    queryKey: assignmentKeys.detail(id!),
    queryFn:  () => getAssignment(id!),
    enabled:  !!id,
    staleTime: 1000 * 30,
  });
}

export function useCreateAssignment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: createAssignment,
    onSuccess: () => { qc.invalidateQueries({ queryKey: assignmentKeys.lists() }); toast.success('领用单创建成功'); },
    onError: (err: Error) => toast.error(err.message || '创建失败'),
  });
}

export function useUpdateAssignment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) => updateAssignment(id, data),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: assignmentKeys.lists() });
      qc.invalidateQueries({ queryKey: assignmentKeys.detail(vars.id) });
      toast.success('领用单更新成功');
    },
    onError: (err: Error) => toast.error(err.message || '更新失败'),
  });
}

export function useDeleteAssignment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: deleteAssignment,
    onSuccess: () => { qc.invalidateQueries({ queryKey: assignmentKeys.lists() }); toast.success('领用单已删除'); },
    onError: (err: Error) => toast.error(err.message || '删除失败'),
  });
}

export function useSubmitAssignment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: submitAssignment,
    onSuccess: (_, id) => { qc.invalidateQueries({ queryKey: assignmentKeys.detail(id) }); qc.invalidateQueries({ queryKey: assignmentKeys.lists() }); toast.success('已提交审批'); },
    onError: (err: Error) => toast.error(err.message || '提交失败'),
  });
}

export function useApproveAssignment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: approveAssignment,
    onSuccess: (_, id) => { qc.invalidateQueries({ queryKey: assignmentKeys.detail(id) }); qc.invalidateQueries({ queryKey: assignmentKeys.lists() }); toast.success('已审批通过'); },
    onError: (err: Error) => toast.error(err.message || '审批失败'),
  });
}

export function useRejectAssignment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, reason }: { id: number; reason?: string }) => rejectAssignment(id, reason),
    onSuccess: (_, vars) => { qc.invalidateQueries({ queryKey: assignmentKeys.detail(vars.id) }); qc.invalidateQueries({ queryKey: assignmentKeys.lists() }); toast.success('已驳回'); },
    onError: (err: Error) => toast.error(err.message || '驳回失败'),
  });
}

export function useCheckoutAssignment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: checkoutAssignment,
    onSuccess: (_, id) => { qc.invalidateQueries({ queryKey: assignmentKeys.detail(id) }); qc.invalidateQueries({ queryKey: assignmentKeys.lists() }); toast.success('已签收领用'); },
    onError: (err: Error) => toast.error(err.message || '签收失败'),
  });
}

export function useReturnRequestAssignment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: returnRequestAssignment,
    onSuccess: (_, id) => { qc.invalidateQueries({ queryKey: assignmentKeys.detail(id) }); qc.invalidateQueries({ queryKey: assignmentKeys.lists() }); toast.success('已申请归还'); },
    onError: (err: Error) => toast.error(err.message || '申请失败'),
  });
}

export function useApproveReturnAssignment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, returnCondition }: { id: number; returnCondition?: string }) => approveReturnAssignment(id, returnCondition),
    onSuccess: (_, vars) => { qc.invalidateQueries({ queryKey: assignmentKeys.detail(vars.id) }); qc.invalidateQueries({ queryKey: assignmentKeys.lists() }); toast.success('归还已审批'); },
    onError: (err: Error) => toast.error(err.message || '审批失败'),
  });
}

export function useCancelAssignment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: cancelAssignment,
    onSuccess: (_, id) => { qc.invalidateQueries({ queryKey: assignmentKeys.detail(id) }); qc.invalidateQueries({ queryKey: assignmentKeys.lists() }); toast.success('已取消'); },
    onError: (err: Error) => toast.error(err.message || '取消失败'),
  });
}
