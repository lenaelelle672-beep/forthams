import { api } from '../app/utils/api';

export interface SystemFieldMappingRecord {
  id: number;
  tenantId?: string;
  interfaceId: number;
  mappingName: string;
  sourceField: string;
  targetField: string;
  transformExpression?: string;
  defaultValue?: string;
  enabled: boolean;
  status?: string;
}

export type SystemFieldMappingPayload = Omit<SystemFieldMappingRecord, 'id' | 'tenantId' | 'status'>;

export interface SystemFieldMappingPreviewPayload {
  sourceField: string;
  targetField: string;
  sampleValue?: string;
  transformExpression?: string;
}

export interface SystemFieldMappingPreviewResult extends SystemFieldMappingPreviewPayload {
  transformedValue: string;
  valid: boolean;
  message: string;
}

const SYSTEM_FIELD_MAPPINGS_BASE = '/system/field-mappings';

export function listSystemFieldMappings() {
  return api.get<SystemFieldMappingRecord[]>(SYSTEM_FIELD_MAPPINGS_BASE);
}

export function getSystemFieldMapping(id: number) {
  return api.get<SystemFieldMappingRecord>(`${SYSTEM_FIELD_MAPPINGS_BASE}/${id}`);
}

export function createSystemFieldMapping(payload: SystemFieldMappingPayload) {
  return api.post<SystemFieldMappingRecord>(SYSTEM_FIELD_MAPPINGS_BASE, payload);
}

export function updateSystemFieldMapping(id: number, payload: SystemFieldMappingPayload) {
  return api.put<SystemFieldMappingRecord>(`${SYSTEM_FIELD_MAPPINGS_BASE}/${id}`, payload);
}

export function updateSystemFieldMappingStatus(id: number, enabled: boolean) {
  return api.put<SystemFieldMappingRecord>(`${SYSTEM_FIELD_MAPPINGS_BASE}/${id}/status`, undefined, { params: { enabled } });
}

export function deleteSystemFieldMapping(id: number) {
  return api.delete<void>(`${SYSTEM_FIELD_MAPPINGS_BASE}/${id}`);
}

export function previewSystemFieldMapping(payload: SystemFieldMappingPreviewPayload) {
  return api.post<SystemFieldMappingPreviewResult>(`${SYSTEM_FIELD_MAPPINGS_BASE}/preview`, payload);
}
