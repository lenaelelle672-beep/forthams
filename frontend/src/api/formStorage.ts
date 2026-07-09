import http from '@/utils/http';

export type FormStorageStatus = 'ACTIVE' | 'ARCHIVED' | 'DELETED' | string;

export interface FormStorageFieldInput {
  fieldKey: string;
  fieldLabel?: string;
  valueType?: 'text' | 'number' | 'date' | 'datetime' | 'boolean' | 'select' | 'json' | 'attachment' | string;
  rawValue?: unknown;
  sensitive?: boolean;
}

export interface FormStorageFieldSummary {
  id?: number;
  fieldKey: string;
  fieldLabel?: string;
  valueType?: string;
  sensitive?: boolean;
  maskedValue: string;
  maskedSummary?: string;
}

export interface FormStorageAttachmentInput {
  fileName: string;
  contentType?: string;
  fileSize?: number;
  referenceKey?: string;
  storageKey?: string;
  url?: string;
}

export interface FormStorageAttachmentSummary {
  id?: number;
  instanceId?: number;
  fileName: string;
  contentType?: string;
  fileSize?: number;
  referenceKey?: string;
  maskedStorageKey?: string;
  maskedUrl?: string;
  status?: string;
  auditSummary?: string;
  createTime?: string | null;
  updateTime?: string | null;
}

export interface FormStorageRecord {
  id: number;
  formKey: string;
  definitionVersion: number;
  businessKey?: string | null;
  status: FormStorageStatus;
  fieldSummaries: FormStorageFieldSummary[];
  attachmentSummaries: FormStorageAttachmentSummary[];
  fieldSummary?: string | null;
  attachmentSummary?: string | null;
  auditSummary?: string | null;
  archivedBy?: number | null;
  archivedAt?: string | null;
  archiveReason?: string | null;
  deletedBy?: number | null;
  deletedAt?: string | null;
  deleteReason?: string | null;
  createTime?: string | null;
  updateTime?: string | null;
}

export interface FormStorageSavePayload {
  formKey: string;
  definitionVersion: number;
  businessKey?: string;
  fieldValues: FormStorageFieldInput[];
  attachments?: FormStorageAttachmentInput[];
}

export interface FormStorageQuery {
  formKey?: string;
  definitionVersion?: number;
  status?: FormStorageStatus;
  keyword?: string;
  includeArchived?: boolean;
  pageNum?: number;
  pageSize?: number;
}

export interface FormStorageHighRiskPayload {
  confirmed: true;
  reason?: string;
  auditEvidence?: string;
  impactScope?: string;
  query?: FormStorageQuery;
}

export interface FormStorageExportSnapshot {
  exportId: string;
  exportedAt: string;
  operatorId?: number;
  auditEvidence?: string;
  querySummary: Record<string, unknown>;
  records: FormStorageRecord[];
  maskedFields: FormStorageFieldSummary[];
  maskedAttachments: FormStorageAttachmentSummary[];
  total: number;
}

function getOperatorId(): number | undefined {
  if (typeof window === 'undefined') return undefined;
  const raw = window.sessionStorage.getItem('user_info') || window.localStorage.getItem('user_info');
  if (!raw) return undefined;
  try {
    const user = JSON.parse(raw);
    const id = user.id ?? user.userId ?? user.uid;
    return id != null && id !== '' ? Number(id) : undefined;
  } catch {
    return undefined;
  }
}

const FORM_STORAGE_BASE = '/form-storage';
const formStoragePath = (instanceId: number | string, suffix = '') => `${FORM_STORAGE_BASE}/${encodeURIComponent(String(instanceId))}${suffix}`;

export const formStorageApi = {
  listFormStorageRecords: (query?: FormStorageQuery) =>
    http.get<FormStorageRecord[]>(FORM_STORAGE_BASE, { params: query }),

  getFormStorageRecord: (instanceId: number | string) =>
    http.get<FormStorageRecord>(formStoragePath(instanceId)),

  createFormStorageRecord: (payload: FormStorageSavePayload) =>
    http.post<FormStorageRecord>(FORM_STORAGE_BASE, {
      ...payload,
      operatorId: getOperatorId(),
    }),

  updateFormStorageRecord: (instanceId: number | string, payload: FormStorageSavePayload) =>
    http.put<FormStorageRecord>(formStoragePath(instanceId), {
      ...payload,
      operatorId: getOperatorId(),
    }),

  archiveFormStorageRecord: (instanceId: number | string, payload: FormStorageHighRiskPayload) =>
    http.post<FormStorageRecord>(formStoragePath(instanceId, '/archive'), {
      ...payload,
      operatorId: getOperatorId(),
    }),

  deleteFormStorageRecord: (instanceId: number | string, payload: FormStorageHighRiskPayload) =>
    http.delete<FormStorageRecord>(formStoragePath(instanceId), {
      data: {
        ...payload,
        operatorId: getOperatorId(),
      },
    }),

  listFormStorageAttachments: (instanceId: number | string) =>
    http.get<FormStorageAttachmentSummary[]>(formStoragePath(instanceId, '/attachments')),

  registerFormStorageAttachment: (instanceId: number | string, payload: FormStorageAttachmentInput) =>
    http.post<FormStorageAttachmentSummary>(formStoragePath(instanceId, '/attachments'), {
      ...payload,
      operatorId: getOperatorId(),
    }),

  deleteFormStorageAttachment: (instanceId: number | string, attachmentId: number | string, payload: FormStorageHighRiskPayload) =>
    http.delete<FormStorageAttachmentSummary>(formStoragePath(instanceId, `/attachments/${encodeURIComponent(String(attachmentId))}`), {
      data: {
        ...payload,
        operatorId: getOperatorId(),
      },
    }),

  exportFormStorageRecords: (payload: FormStorageHighRiskPayload) =>
    http.post<FormStorageExportSnapshot>(`${FORM_STORAGE_BASE}/export`, {
      ...payload,
      operatorId: getOperatorId(),
    }),
};
