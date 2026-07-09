import http from '@/utils/http';

export interface TodoFieldConfig {
  id?: number;
  fieldKey: string;
  fieldLabel?: string;
  visible?: boolean;
  sortOrder: number;
  sensitive?: boolean;
  defaultField?: boolean;
  roleCode?: string;
  overrideVisible?: boolean;
  overrideSortOrder?: number;
  source?: 'default' | 'inherited' | 'overridden' | 'custom' | string;
  explanation?: string;
  maskedLabel?: string;
  maskedValue?: string;
  auditSummary?: string | null;
}

export interface TodoFieldSavePayload {
  confirmed: true;
  reason?: string;
  auditEvidence?: string;
  fields: TodoFieldConfig[];
}

export interface TodoFieldRoleOverridePayload extends TodoFieldSavePayload {
  explanation?: string;
}

export interface TodoFieldOperationPayload {
  confirmed: true;
  reason?: string;
  auditEvidence?: string;
  roleCode?: string;
}

export interface TodoFieldPreview {
  roleCode: string;
  visibleFields: TodoFieldConfig[];
  maskedFields: TodoFieldConfig[];
  totalVisible: number;
  readOnly?: boolean;
  tenantScoped?: boolean;
  auditSummary?: string | null;
  previewedAt?: string | null;
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

const TODO_FIELDS_BASE = '/todo-fields';

export const todoFieldsApi = {
  listTodoFields: (roleCode?: string) =>
    http.get<TodoFieldConfig[]>(TODO_FIELDS_BASE, { params: roleCode ? { roleCode } : undefined }),

  saveTodoFields: (payload: TodoFieldSavePayload) =>
    http.put<TodoFieldConfig[]>(TODO_FIELDS_BASE, {
      ...payload,
      operatorId: getOperatorId(),
    }),

  saveTodoFieldSortOrder: (payload: TodoFieldSavePayload) =>
    http.put<TodoFieldConfig[]>(`${TODO_FIELDS_BASE}/sort-order`, {
      ...payload,
      operatorId: getOperatorId(),
    }),

  saveTodoFieldRoleOverride: (roleCode: string, payload: TodoFieldRoleOverridePayload) =>
    http.put<TodoFieldConfig[]>(`${TODO_FIELDS_BASE}/role-overrides/${encodeURIComponent(roleCode)}`, {
      ...payload,
      operatorId: getOperatorId(),
    }),

  resetTodoFieldDefaults: (payload: TodoFieldOperationPayload) =>
    http.post<TodoFieldConfig[]>(`${TODO_FIELDS_BASE}/reset-defaults`, {
      ...payload,
      operatorId: getOperatorId(),
    }),

  previewTodoFields: (roleCode?: string) =>
    http.get<TodoFieldPreview>(`${TODO_FIELDS_BASE}/preview`, { params: roleCode ? { roleCode } : undefined }),
};
