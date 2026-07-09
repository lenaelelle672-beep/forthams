import { api } from '../app/utils/api';

export interface SystemExternalSystemRecord {
  id: number;
  tenantId?: string;
  systemCode: string;
  systemName: string;
  systemType: string;
  maskedBaseUrl: string;
  authType: string;
  authConfigSummary?: string;
  authConfigured?: boolean;
  configMasked?: boolean;
  maskedSecretSummary?: string;
  enabled: boolean;
  status?: string;
  healthStatus?: string;
  lastValidationStatus?: string;
  lastValidationMessage?: string;
  lastValidationAt?: string;
  lastOperatorId?: number;
  lastOperation?: string;
  lastOperationReason?: string;
  auditEvidenceSummary?: string;
}

export interface SystemExternalSystemPayload {
  systemCode: string;
  systemName: string;
  systemType: string;
  baseUrl: string;
  authType: string;
  authConfig?: Record<string, string>;
  enabled?: boolean;
  operatorId: number;
  reason?: string;
  auditEvidence?: string;
}

export interface SystemExternalSystemOperationPayload {
  confirmed?: boolean;
  operatorId: number;
  reason?: string;
  auditEvidence?: string;
}

export interface SystemExternalSystemValidationResult {
  systemId: number;
  systemCode: string;
  valid: boolean;
  configOnly: boolean;
  noRealExternalCall: boolean;
  targetSummary: string;
  authSummary?: string;
  message: string;
}

export interface SystemExternalSystemListParams {
  keyword?: string;
  systemType?: string;
  status?: string;
}

const SYSTEM_EXTERNAL_SYSTEMS_BASE = '/system/external-systems';

export function listSystemExternalSystems(params?: SystemExternalSystemListParams) {
  return api.get<SystemExternalSystemRecord[]>(SYSTEM_EXTERNAL_SYSTEMS_BASE, { params });
}

export function getSystemExternalSystem(id: number) {
  return api.get<SystemExternalSystemRecord>(`${SYSTEM_EXTERNAL_SYSTEMS_BASE}/${id}`);
}

export function createSystemExternalSystem(payload: SystemExternalSystemPayload) {
  return api.post<SystemExternalSystemRecord>(SYSTEM_EXTERNAL_SYSTEMS_BASE, payload);
}

export function updateSystemExternalSystem(id: number, payload: SystemExternalSystemPayload) {
  return api.put<SystemExternalSystemRecord>(`${SYSTEM_EXTERNAL_SYSTEMS_BASE}/${id}`, payload);
}

export function enableSystemExternalSystem(id: number, payload: SystemExternalSystemOperationPayload) {
  return api.post<SystemExternalSystemRecord>(`${SYSTEM_EXTERNAL_SYSTEMS_BASE}/${id}/enable`, payload);
}

export function disableSystemExternalSystem(id: number, payload: SystemExternalSystemOperationPayload) {
  return api.post<SystemExternalSystemRecord>(`${SYSTEM_EXTERNAL_SYSTEMS_BASE}/${id}/disable`, payload);
}

export function validateSystemExternalSystemConfig(id: number, payload?: SystemExternalSystemOperationPayload) {
  return api.post<SystemExternalSystemValidationResult>(`${SYSTEM_EXTERNAL_SYSTEMS_BASE}/${id}/validate`, payload);
}
