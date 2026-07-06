/**
 * @file api/slaConfig.ts
 * @description SLA 配置 API
 */

import http from '@/utils/http';

export interface SlaConfigItem {
  id: number;
  priority: string;
  responseHours: number;
  resolveHours: number;
  warningRatio: number;
  status: number;
}

export type SlaConfigPayload = Partial<
  Pick<SlaConfigItem, 'responseHours' | 'resolveHours' | 'warningRatio' | 'status'>
>;

export const listSlaConfigs = () =>
  http.get<SlaConfigItem[]>('/sla-config');

export const updateSlaConfig = (id: number, data: SlaConfigPayload) =>
  http.put<SlaConfigItem>(`/sla-config/${id}`, data);
