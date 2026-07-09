import http from '@/utils/http';

export type FormDefinitionStatus = 'DRAFT' | 'PUBLISHED' | 'DISABLED' | string;

export interface FormDefinitionFieldOption {
  value: string;
  label: string;
  disabled?: boolean;
}

export interface FormDefinitionField {
  fieldKey: string;
  label: string;
  type: string;
  required?: boolean;
  sensitive?: boolean;
  masked?: boolean;
  defaultValue?: unknown;
  placeholder?: string;
  helpText?: string;
  options?: FormDefinitionFieldOption[];
}

export interface FormDefinitionSection {
  sectionKey: string;
  label: string;
  description?: string;
  fields: FormDefinitionField[];
}

export interface FormDefinitionSchema {
  sections: FormDefinitionSection[];
}

export interface FormDefinitionDTO {
  id?: number;
  formKey: string;
  name: string;
  description?: string | null;
  schema?: FormDefinitionSchema | Record<string, unknown> | null;
  status?: FormDefinitionStatus | null;
  version?: number | null;
  updatedBy?: number | null;
  publishedBy?: number | null;
  publishedAt?: string | null;
  createTime?: string | null;
  updateTime?: string | null;
}

export interface FormDefinitionSavePayload {
  name: string;
  description?: string;
  schema: FormDefinitionSchema | Record<string, unknown>;
}

export interface FormDefinitionOperationPayload {
  confirmed: true;
  reason: string;
  impactScope: string;
  rollbackPlan: string;
  publishNote?: string;
}

export interface FormDefinitionValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  fieldCount: number;
  sensitiveFieldCount: number;
  sanitizedSchema: FormDefinitionSchema | Record<string, unknown>;
}

export interface FormDefinitionVersionDTO {
  id?: number;
  definitionId?: number;
  formKey: string;
  version: number;
  actionType: 'PUBLISH' | 'DISABLE' | 'ROLLBACK' | string;
  status: FormDefinitionStatus;
  name: string;
  description?: string | null;
  schema?: FormDefinitionSchema | Record<string, unknown> | null;
  auditReason?: string | null;
  impactScope?: string | null;
  rollbackPlan?: string | null;
  rollbackSourceVersion?: number | null;
  operatorId?: number | null;
  publishedAt?: string | null;
  createTime?: string | null;
}

export interface FormDefinitionPreviewDTO {
  formKey: string;
  name: string;
  status?: FormDefinitionStatus | null;
  version?: number | null;
  fieldCount: number;
  sensitiveFieldCount: number;
  schema: FormDefinitionSchema | Record<string, unknown>;
  warnings: string[];
}

export interface FormDefinitionReferencesDTO {
  formKey: string;
  referenceCount: number;
  references: Array<Record<string, unknown>>;
  bindingSources?: Array<Record<string, unknown>>;
  note?: string;
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

const FORM_DEFINITIONS_BASE = '/form-definitions';
const formDefinitionPath = (formKey: string, suffix = '') => `${FORM_DEFINITIONS_BASE}/${encodeURIComponent(formKey)}${suffix}`;

export const formDefinitionsApi = {
  listDefinitions: () =>
    http.get<FormDefinitionDTO[]>(FORM_DEFINITIONS_BASE),

  getDefinition: (formKey: string) =>
    http.get<FormDefinitionDTO>(formDefinitionPath(formKey)),

  saveDraft: (formKey: string, payload: FormDefinitionSavePayload) =>
    http.put<FormDefinitionDTO>(formDefinitionPath(formKey, '/draft'), {
      ...payload,
      operatorId: getOperatorId(),
    }),

  validateSchema: (formKey: string, payload: FormDefinitionSavePayload) =>
    http.post<FormDefinitionValidationResult>(formDefinitionPath(formKey, '/schema/validate'), payload),

  publish: (formKey: string, payload: FormDefinitionOperationPayload) =>
    http.post<FormDefinitionDTO>(formDefinitionPath(formKey, '/publish'), {
      ...payload,
      operatorId: getOperatorId(),
    }),

  disable: (formKey: string, payload: FormDefinitionOperationPayload) =>
    http.post<FormDefinitionDTO>(formDefinitionPath(formKey, '/disable'), {
      ...payload,
      operatorId: getOperatorId(),
    }),

  listVersions: (formKey: string) =>
    http.get<FormDefinitionVersionDTO[]>(formDefinitionPath(formKey, '/versions')),

  getVersion: (formKey: string, version: number) =>
    http.get<FormDefinitionVersionDTO>(formDefinitionPath(formKey, `/versions/${encodeURIComponent(String(version))}`)),

  rollback: (formKey: string, version: number, payload: FormDefinitionOperationPayload) =>
    http.post<FormDefinitionDTO>(formDefinitionPath(formKey, `/versions/${encodeURIComponent(String(version))}/rollback`), {
      ...payload,
      operatorId: getOperatorId(),
    }),

  preview: (formKey: string) =>
    http.get<FormDefinitionPreviewDTO>(formDefinitionPath(formKey, '/preview')),

  references: (formKey: string) =>
    http.get<FormDefinitionReferencesDTO>(formDefinitionPath(formKey, '/references')),
};
