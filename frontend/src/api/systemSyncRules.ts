import { api } from '../app/utils/api';

export interface SystemSyncRuleRecord {
  id: number;
  tenantId?: string;
  interfaceId: number;
  ruleName: string;
  triggerType?: string;
  cronExpression?: string;
  retryCount?: number;
  enabled: boolean;
  status?: string;
  lastStatus?: string;
}

export type SystemSyncRulePayload = Omit<SystemSyncRuleRecord, 'id' | 'tenantId' | 'status' | 'lastStatus'>;

export interface SystemSyncRunPayload {
  dryRun?: boolean;
  triggerSource?: string;
  requestId?: string;
  idempotencyKey?: string;
  remark?: string;
}

export interface SystemSyncRunLogRecord {
  id: number;
  ruleId: number;
  status: string;
  triggerSource?: string;
  executionMode: string;
  dryRun: boolean;
  message?: string;
}

export interface SystemSyncQueueSummary {
  pending: number;
  running: number;
  failed: number;
  nextRetry: number;
  queueConsumptionEnabled: boolean;
  mode: string;
}

const SYSTEM_SYNC_RULES_BASE = '/system/sync-rules';

export function listSystemSyncRules() {
  return api.get<SystemSyncRuleRecord[]>(SYSTEM_SYNC_RULES_BASE);
}

export function getSystemSyncRule(id: number) {
  return api.get<SystemSyncRuleRecord>(`${SYSTEM_SYNC_RULES_BASE}/${id}`);
}

export function createSystemSyncRule(payload: SystemSyncRulePayload) {
  return api.post<SystemSyncRuleRecord>(SYSTEM_SYNC_RULES_BASE, payload);
}

export function updateSystemSyncRule(id: number, payload: SystemSyncRulePayload) {
  return api.put<SystemSyncRuleRecord>(`${SYSTEM_SYNC_RULES_BASE}/${id}`, payload);
}

export function updateSystemSyncRuleStatus(id: number, enabled: boolean) {
  return api.put<SystemSyncRuleRecord>(`${SYSTEM_SYNC_RULES_BASE}/${id}/status`, undefined, { params: { enabled } });
}

export function deleteSystemSyncRule(id: number) {
  return api.delete<void>(`${SYSTEM_SYNC_RULES_BASE}/${id}`);
}

export function dryRunSystemSyncRule(id: number, payload: SystemSyncRunPayload = {}) {
  return api.post<SystemSyncRunLogRecord>(`${SYSTEM_SYNC_RULES_BASE}/${id}/dry-run`, { ...payload, dryRun: true });
}

export function listSystemSyncLogs(ruleId: number) {
  return api.get<SystemSyncRunLogRecord[]>(`${SYSTEM_SYNC_RULES_BASE}/${ruleId}/logs`);
}

export function retrySystemSyncLog(logId: number) {
  return api.post<SystemSyncRunLogRecord>(`${SYSTEM_SYNC_RULES_BASE}/logs/${logId}/retry`);
}

export function getSystemSyncQueueSummary() {
  return api.get<SystemSyncQueueSummary>(`${SYSTEM_SYNC_RULES_BASE}/queue/summary`);
}
