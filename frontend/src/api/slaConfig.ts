/**
 * @file api/slaConfig.ts
 * @description SLA 配置 API
 */

import http from '@/utils/http';

export interface SlaConfigItem {
  id: number;
  processKey?: string | null;
  businessType?: string | null;
  nodeKey?: string | null;
  priority: string;
  responseHours: number;
  resolveHours: number;
  warningRatio: number;
  escalationRatio?: number | null;
  status: number;
  statusText?: 'ACTIVE' | 'DISABLED' | string;
  enabled?: boolean;
  notificationTargets?: SlaNotificationTarget[];
  notificationTargetSummary?: string | null;
  contactMasked?: string | null;
  variablePreviewMasked?: string | null;
  applicableProcessSummary?: string | null;
  auditSummary?: string | null;
  enabledAt?: string | null;
  disabledAt?: string | null;
  disabledReason?: string | null;
}

export interface SlaNotificationTarget {
  targetType: string;
  targetNameMasked?: string;
  contactMasked?: string;
}

export type SlaConfigPayload = Partial<Pick<SlaConfigItem, 'processKey' | 'businessType' | 'nodeKey' | 'priority' | 'responseHours' | 'resolveHours' | 'warningRatio' | 'escalationRatio' | 'status' | 'enabled' | 'notificationTargets'>> & {
  reason?: string;
  auditEvidence?: string;
};

export interface SlaConfigOperationPayload {
  confirmed: true;
  reason?: string;
  auditEvidence?: string;
  impactScope?: string;
}

export interface SlaConfigSimulationPayload {
  processKey: string;
  businessType?: string;
  nodeKey: string;
  priority?: string;
  variables?: Record<string, unknown>;
  confirmed: true;
  reason?: string;
  auditEvidence?: string;
}

export interface SlaConfigSimulationResult {
  processKey: string;
  businessType?: string;
  nodeKey: string;
  priority?: string;
  matchedConfigId?: number | null;
  policySummary?: string | null;
  responseHours?: number | null;
  resolveHours?: number | null;
  responseDueAt?: string | null;
  resolveDueAt?: string | null;
  warningAt?: string | null;
  escalationAt?: string | null;
  remainingMinutes?: number | null;
  reminders?: string[];
  escalationSuggestions?: string[];
  notificationTargets?: SlaNotificationTarget[];
  variablePreviewMasked?: string | null;
  safeExplanation?: string | null;
  auditSummary?: string | null;
  tenantScoped?: boolean;
  simulatedAt?: string | null;
  warnings?: string[];
}

export interface SlaTimeoutRecord {
  id: number;
  configId?: number | null;
  processInstanceId?: string | null;
  processKey?: string | null;
  businessType?: string | null;
  nodeKey?: string | null;
  nodeName?: string | null;
  priority?: string | null;
  responseDueAt?: string | null;
  resolveDueAt?: string | null;
  timeoutAt?: string | null;
  timeoutMinutes?: number | null;
  riskLevel?: string | null;
  status?: string | null;
  maskedBusinessSummary?: string | null;
  applicantMasked?: string | null;
  assigneeMasked?: string | null;
  auditSummary?: string | null;
  masked?: boolean;
}

export interface SlaRuntimeSummary {
  totalConfigs: number;
  activeConfigs: number;
  overdueCount: number;
  warningCount: number;
  criticalCount: number;
  timeoutRecordCount: number;
  riskCounts?: Record<string, number>;
  nodeDurationSummary?: string[];
  abnormalTraceSummary?: string[];
  recentTimeoutRecords?: SlaTimeoutRecord[];
  exportMaskingNotice?: string | null;
  readOnly?: boolean;
  tenantScoped?: boolean;
  generatedAt?: string | null;
}

export interface SlaTimeoutRecordQuery {
  processKey?: string;
  nodeKey?: string;
  status?: string;
  riskLevel?: string;
}

export interface SlaTimeoutExportPayload extends SlaTimeoutRecordQuery {
  confirmed: true;
  reason?: string;
  auditEvidence?: string;
}

export interface SlaTimeoutExportResult extends SlaTimeoutExportPayload {
  masked: boolean;
  exportedBy?: string | null;
  exportedAt?: string | null;
  filterSummary?: string | null;
  fieldMaskingPolicy?: string | null;
  recordCount?: number | null;
  records?: SlaTimeoutRecord[];
  configs?: SlaConfigItem[];
  contentSummary?: string | null;
}

function getOperatorId(): number | undefined {
  if (typeof window === 'undefined') return undefined;
  const raw = window.sessionStorage.getItem('user_info') || window.localStorage.getItem('user_info') || window.localStorage.getItem('ams_auth_user');
  if (!raw) return undefined;
  try {
    const user = JSON.parse(raw);
    const id = user.id ?? user.userId ?? user.uid;
    return id != null && id !== '' ? Number(id) : undefined;
  } catch {
    return undefined;
  }
}

const SLA_CONFIG_BASE = '/sla-config';
const slaConfigPath = (id: number | string, suffix = '') => `${SLA_CONFIG_BASE}/${encodeURIComponent(String(id))}${suffix}`;

export const listSlaConfigs = () =>
  http.get<SlaConfigItem[]>(SLA_CONFIG_BASE);

export const updateSlaConfig = (id: number, data: SlaConfigPayload) =>
  http.put<SlaConfigItem>(slaConfigPath(id), data);

export const getSlaConfig = (id: number | string) =>
  http.get<SlaConfigItem>(slaConfigPath(id));

export const enableSlaConfig = (id: number | string, payload: SlaConfigOperationPayload) =>
  http.post<SlaConfigItem>(slaConfigPath(id, '/enable'), {
    ...payload,
    operatorId: getOperatorId(),
  });

export const disableSlaConfig = (id: number | string, payload: SlaConfigOperationPayload) =>
  http.post<SlaConfigItem>(slaConfigPath(id, '/disable'), {
    ...payload,
    operatorId: getOperatorId(),
  });

export const simulateSlaConfig = (payload: SlaConfigSimulationPayload) =>
  http.post<SlaConfigSimulationResult>(`${SLA_CONFIG_BASE}/simulate`, {
    ...payload,
    operatorId: getOperatorId(),
  });

export const getSlaRuntimeSummary = () =>
  http.get<SlaRuntimeSummary>(`${SLA_CONFIG_BASE}/runtime-summary`);

export const listSlaTimeoutRecords = (query?: SlaTimeoutRecordQuery) =>
  http.get<SlaTimeoutRecord[]>(`${SLA_CONFIG_BASE}/timeout-records`, { params: query });

export const exportSlaTimeoutRecords = (payload: SlaTimeoutExportPayload) =>
  http.post<SlaTimeoutExportResult>(`${SLA_CONFIG_BASE}/export`, {
    ...payload,
    operatorId: getOperatorId(),
  });

export const slaConfigApi = {
  listSlaConfigs,
  getSlaConfig,
  updateSlaConfig,
  enableSlaConfig,
  disableSlaConfig,
  simulateSlaConfig,
  getSlaRuntimeSummary,
  listSlaTimeoutRecords,
  exportSlaTimeoutRecords,
};
