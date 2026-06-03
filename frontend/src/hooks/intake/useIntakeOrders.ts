/**
 * @file hooks/intake/useIntakeOrders.ts
 * @description 入库验收 TanStack Query hooks
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getIntakeOrders, getIntakeOrder, createIntakeOrder,
  updateIntakeOrder, deleteIntakeOrder, submitIntakeOrder,
  inspectIntakeOrder, acceptIntakeOrder, rejectIntakeOrder,
  cancelIntakeOrder,
} from '@/api/intake';
import type { IntakeOrderListQuery, IntakeCheckItem } from '@/types/intake';
import { toast } from 'sonner';

export const intakeKeys = {
  all:     ['intake-orders'] as const,
  lists:   () => [...intakeKeys.all, 'list'] as const,
  list:    (q: IntakeOrderListQuery) => [...intakeKeys.lists(), q] as const,
  details: () => [...intakeKeys.all, 'detail'] as const,
  detail:  (id: number) => [...intakeKeys.details(), id] as const,
};

export function useIntakeOrders(params: IntakeOrderListQuery) {
  return useQuery({
    queryKey: intakeKeys.list(params),
    queryFn:  () => getIntakeOrders(params),
    staleTime: 1000 * 30,
    placeholderData: (prev) => prev,
  });
}

export function useIntakeOrderDetail(id: number | null) {
  return useQuery({
    queryKey: intakeKeys.detail(id!),
    queryFn:  () => getIntakeOrder(id!),
    enabled:  !!id,
    staleTime: 1000 * 30,
  });
}

export function useCreateIntakeOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: createIntakeOrder,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: intakeKeys.lists() });
      toast.success('验收单创建成功');
    },
    onError: (err: Error) => toast.error(err.message || '创建失败'),
  });
}

export function useUpdateIntakeOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) => updateIntakeOrder(id, data),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: intakeKeys.lists() });
      qc.invalidateQueries({ queryKey: intakeKeys.detail(vars.id) });
      toast.success('验收单更新成功');
    },
    onError: (err: Error) => toast.error(err.message || '更新失败'),
  });
}

export function useDeleteIntakeOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: deleteIntakeOrder,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: intakeKeys.lists() });
      toast.success('验收单已删除');
    },
    onError: (err: Error) => toast.error(err.message || '删除失败'),
  });
}

export function useSubmitIntakeOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: submitIntakeOrder,
    onSuccess: (_, id) => {
      qc.invalidateQueries({ queryKey: intakeKeys.detail(id) });
      qc.invalidateQueries({ queryKey: intakeKeys.lists() });
      toast.success('验收单已提交');
    },
    onError: (err: Error) => toast.error(err.message || '提交失败'),
  });
}

export function useInspectIntakeOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, checkItems }: { id: number; checkItems: IntakeCheckItem[] }) =>
      inspectIntakeOrder(id, checkItems),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: intakeKeys.detail(vars.id) });
      qc.invalidateQueries({ queryKey: intakeKeys.lists() });
      toast.success('检查结果已保存');
    },
    onError: (err: Error) => toast.error(err.message || '保存失败'),
  });
}

export function useAcceptIntakeOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: acceptIntakeOrder,
    onSuccess: (_, id) => {
      qc.invalidateQueries({ queryKey: intakeKeys.detail(id) });
      qc.invalidateQueries({ queryKey: intakeKeys.lists() });
      toast.success('验收通过，资产已创建');
    },
    onError: (err: Error) => toast.error(err.message || '验收失败'),
  });
}

export function useRejectIntakeOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, reason }: { id: number; reason?: string }) => rejectIntakeOrder(id, reason),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: intakeKeys.detail(vars.id) });
      qc.invalidateQueries({ queryKey: intakeKeys.lists() });
      toast.success('验收单已驳回');
    },
    onError: (err: Error) => toast.error(err.message || '驳回失败'),
  });
}

export function useCancelIntakeOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: cancelIntakeOrder,
    onSuccess: (_, id) => {
      qc.invalidateQueries({ queryKey: intakeKeys.detail(id) });
      qc.invalidateQueries({ queryKey: intakeKeys.lists() });
      toast.success('验收单已取消');
    },
    onError: (err: Error) => toast.error(err.message || '取消失败'),
  });
}
