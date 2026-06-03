import http from '@/utils/http';
import type { CycleCountRule } from '@/types/cycleCount';

export const cycleCountApi = {
  list: (params?: { classification?: string; pageNum?: number; pageSize?: number }) =>
    http.get<any>('/cycle-count/rules', { params }),

  getById: (id: number) =>
    http.get<CycleCountRule>(`/cycle-count/rules/${id}`),

  create: (data: CycleCountRule) =>
    http.post<CycleCountRule>('/cycle-count/rules', data),

  update: (id: number, data: CycleCountRule) =>
    http.put<CycleCountRule>(`/cycle-count/rules/${id}`, data),

  delete: (id: number) =>
    http.delete<void>(`/cycle-count/rules/${id}`),

  triggerGenerate: (classification: string) =>
    http.post<string>('/cycle-count/trigger', null, { params: { classification } })
};
