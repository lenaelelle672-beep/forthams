/**
 * @file api/webhookConfig.ts
 * @description Webhook 配置 API
 */

import http from '@/utils/http';

export interface WebhookConfig {
  id: number;
  name: string;
  url: string;
  secret?: string;
  events: string[];
  description?: string;
  enabled: number;
}

export interface WebhookConfigList {
  records: WebhookConfig[];
  total: number;
}

export interface WebhookConfigPayload {
  name: string;
  url: string;
  secret?: string;
  events: string[];
  description?: string;
  enabled: number;
}

export const listWebhookConfigs = (params?: { page?: number; pageSize?: number; keyword?: string }) =>
  http.get<WebhookConfigList>('/webhook-configs', { params });

export const createWebhookConfig = (data: WebhookConfigPayload) =>
  http.post<WebhookConfig>('/webhook-configs', data);

export const updateWebhookConfig = (id: number, data: WebhookConfigPayload) =>
  http.put<WebhookConfig>(`/webhook-configs/${id}`, data);

export const deleteWebhookConfig = (id: number) =>
  http.delete<void>(`/webhook-configs/${id}`);
