import { api } from '../app/utils/api';

export interface SystemWebhookConfigRecord {
  id: number;
  tenantId?: string;
  configName: string;
  eventType: string;
  maskedTargetUrl: string;
  enabled: boolean;
  status?: string;
  signingStrategy: 'NONE' | 'HMAC_SHA256' | string;
  secretConfigured?: boolean;
  signatureConfigured?: boolean;
  maskedHeaders?: Record<string, string>;
}

export interface SystemWebhookConfigPayload {
  configName: string;
  eventType: string;
  targetUrl: string;
  enabled?: boolean;
  signingStrategy?: 'NONE' | 'HMAC_SHA256' | string;
  signingSecret?: string;
  secret?: string;
  headers?: Record<string, string>;
}

export interface SystemWebhookConfigTestResult {
  configId: number;
  valid: boolean;
  configOnly: boolean;
  target: string;
  message: string;
}

const SYSTEM_WEBHOOK_CONFIGS_BASE = '/system/webhook-configs';

export function listSystemWebhookConfigs() {
  return api.get<SystemWebhookConfigRecord[]>(SYSTEM_WEBHOOK_CONFIGS_BASE);
}

export function getSystemWebhookConfig(id: number) {
  return api.get<SystemWebhookConfigRecord>(`${SYSTEM_WEBHOOK_CONFIGS_BASE}/${id}`);
}

export function createSystemWebhookConfig(payload: SystemWebhookConfigPayload) {
  return api.post<SystemWebhookConfigRecord>(SYSTEM_WEBHOOK_CONFIGS_BASE, payload);
}

export function updateSystemWebhookConfig(id: number, payload: SystemWebhookConfigPayload) {
  return api.put<SystemWebhookConfigRecord>(`${SYSTEM_WEBHOOK_CONFIGS_BASE}/${id}`, payload);
}

export function updateSystemWebhookConfigStatus(id: number, enabled: boolean) {
  return api.put<SystemWebhookConfigRecord>(`${SYSTEM_WEBHOOK_CONFIGS_BASE}/${id}/status`, undefined, { params: { enabled } });
}

export function deleteSystemWebhookConfig(id: number) {
  return api.delete<void>(`${SYSTEM_WEBHOOK_CONFIGS_BASE}/${id}`);
}

export function testSystemWebhookConfig(id: number) {
  return api.post<SystemWebhookConfigTestResult>(`${SYSTEM_WEBHOOK_CONFIGS_BASE}/${id}/test`);
}
