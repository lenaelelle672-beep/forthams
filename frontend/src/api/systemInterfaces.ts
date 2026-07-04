import { api } from '../app/utils/api';

export interface SystemInterfaceRecord {
  id: number;
  tenantId?: string;
  externalSystemId: number;
  interfaceName: string;
  method: string;
  path: string;
  requestSchema?: string;
  responseSchema?: string;
  enabled: boolean;
  status?: string;
  configMasked?: boolean;
}

export type SystemInterfacePayload = Omit<SystemInterfaceRecord, 'id' | 'tenantId' | 'status' | 'configMasked'>;

export interface SystemInterfaceTestResult {
  interfaceId: number;
  valid: boolean;
  configOnly: boolean;
  target: string;
  message: string;
}

const SYSTEM_INTERFACES_BASE = '/system/interfaces';

export function listSystemInterfaces() {
  return api.get<SystemInterfaceRecord[]>(SYSTEM_INTERFACES_BASE);
}

export function getSystemInterface(id: number) {
  return api.get<SystemInterfaceRecord>(`${SYSTEM_INTERFACES_BASE}/${id}`);
}

export function createSystemInterface(payload: SystemInterfacePayload) {
  return api.post<SystemInterfaceRecord>(SYSTEM_INTERFACES_BASE, payload);
}

export function updateSystemInterface(id: number, payload: SystemInterfacePayload) {
  return api.put<SystemInterfaceRecord>(`${SYSTEM_INTERFACES_BASE}/${id}`, payload);
}

export function updateSystemInterfaceStatus(id: number, enabled: boolean) {
  return api.put<SystemInterfaceRecord>(`${SYSTEM_INTERFACES_BASE}/${id}/status`, undefined, { params: { enabled } });
}

export function deleteSystemInterface(id: number) {
  return api.delete<void>(`${SYSTEM_INTERFACES_BASE}/${id}`);
}

export function testSystemInterfaceConfig(id: number) {
  return api.post<SystemInterfaceTestResult>(`${SYSTEM_INTERFACES_BASE}/${id}/test`);
}
