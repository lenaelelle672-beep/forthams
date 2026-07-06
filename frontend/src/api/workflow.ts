import http from '@/utils/http';

export interface WorkflowDefinitionDTO {
  id?: number;
  businessType: string;
  name: string;
  description: string;
  definition: Record<string, unknown>;
  status: 'UNCONFIGURED' | 'DRAFT' | 'PUBLISHED' | 'DISABLED' | 'ENABLED';
  version: number;
  updatedBy?: number;
  publishedBy?: number;
  publishedAt?: string;
  createTime?: string;
  updateTime?: string;
}

export interface WorkflowAssigneePreviewRequest {
  definition: Record<string, unknown>;
  businessData?: Record<string, unknown> | string;
}

export interface WorkflowRuntimeAssigneePreviewRequest {
  businessData?: Record<string, unknown> | string;
  currentStep?: number;
}

export interface WorkflowAssigneePreviewResponse {
  businessType: string;
  calculable: boolean;
  reason?: string;
  missingFields: string[];
  nodes: Array<{
    stepNo: number;
    nodeId: string;
    nodeCode?: string;
    label?: string;
    approverType?: string;
    approverRole?: string;
    approverId?: string;
    resolved: boolean;
    assigneeCount?: number;
    reason?: string;
    assignees: Array<{ userId: string }>;
  }>;
}

export interface WorkflowStartAvailability {
  businessType: string;
  canStart: boolean;
  status: 'UNCONFIGURED' | 'DRAFT' | 'PUBLISHED' | 'DISABLED' | string;
  version: number;
  definitionId?: number | null;
  entryUrl: string;
  blockReason: string;
}

export interface WorkflowDefinitionVersionDTO {
  id: number;
  definitionId: number;
  businessType: string;
  version: number;
  actionType: 'PUBLISH' | 'ROLLBACK' | string;
  status: 'PUBLISHED' | string;
  name: string;
  description?: string;
  definition?: Record<string, unknown>;
  publishNote?: string;
  impactScope?: string;
  rollbackPlan?: string;
  rollbackSourceVersion?: number | null;
  operatorId?: number;
  publishedAt?: string;
  createTime?: string;
}

export interface WorkflowPublishPayload {
  publishNote?: string;
  impactScope?: string;
  rollbackPlan?: string;
}

export interface WorkflowRollbackPayload {
  reason?: string;
  impactScope?: string;
  rollbackPlan?: string;
}

/**
 * 从 localStorage 获取当前登录用户 ID。
 * http.ts 拦截器已解包 response.data，因此此函数不涉及 HTTP。
 */
function getOperatorId(): number | undefined {
  if (typeof window === 'undefined') return undefined;
  const raw = window.sessionStorage.getItem('user_info') || window.localStorage.getItem('user_info');
  if (!raw) return undefined;
  try {
    const user = JSON.parse(raw);
    const id = user.id ?? user.userId ?? user.uid;
    return id != null && id !== '' ? Number(id) : undefined;
  } catch { return undefined; }
}

export const workflowApi = {
  list: () =>
    http.get<WorkflowDefinitionDTO[]>('/workflows'),

  get: (businessType: string) =>
    http.get<WorkflowDefinitionDTO>(`/workflows/${businessType}`),

  saveDraft: (businessType: string, payload: { name: string; description: string; definition: Record<string, unknown> | null }) =>
    http.put<WorkflowDefinitionDTO>(`/workflows/${businessType}/draft`, { ...payload, operatorId: getOperatorId() }),

  publish: (businessType: string, payload: WorkflowPublishPayload = {}) =>
    http.post<WorkflowDefinitionDTO>(`/workflows/${businessType}/publish`, { ...payload, operatorId: getOperatorId() }),

  updateStatus: (businessType: string, status: string) =>
    http.post<WorkflowDefinitionDTO>(`/workflows/${businessType}/status`, { status, operatorId: getOperatorId() }),

  listVersions: (businessType: string) =>
    http.get<WorkflowDefinitionVersionDTO[]>(`/workflows/${businessType}/versions`),

  getVersion: (businessType: string, version: number) =>
    http.get<WorkflowDefinitionVersionDTO>(`/workflows/${businessType}/versions/${version}`),

  rollback: (businessType: string, version: number, payload: WorkflowRollbackPayload = {}) =>
    http.post<WorkflowDefinitionDTO>(`/workflows/${businessType}/versions/${version}/rollback`, { ...payload, operatorId: getOperatorId() }),

  previewAssignees: (businessType: string, payload: WorkflowAssigneePreviewRequest) =>
    http.post<WorkflowAssigneePreviewResponse>(`/workflows/${businessType}/assignees/preview`, payload),

  getStartAvailability: (businessType: string) =>
    http.get<WorkflowStartAvailability>(`/workflow-runtime/${businessType}/start-availability`),

  previewRuntimeAssignees: (businessType: string, payload: WorkflowRuntimeAssigneePreviewRequest = {}) =>
    http.post<WorkflowAssigneePreviewResponse>(`/workflow-runtime/${businessType}/assignees/preview`, payload),

  createCustomWorkflow: (businessType: string, name: string, description: string) =>
    http.post<WorkflowDefinitionDTO>('/workflows/custom', { businessType, name, description, operatorId: getOperatorId() }),

  delete: (businessType: string) =>
    http.delete<void>(`/workflows/${businessType}`),
};

export interface RoleRecord {
  id: number;
  roleCode?: string;
  roleName?: string;
  [key: string]: unknown;
}

export const roleApi = {
  getAll: () =>
    http.get<RoleRecord[]>('/roles/all'),
};

export interface UserRecord {
  id: number;
  username?: string;
  realName?: string;
  phone?: string;
  [key: string]: unknown;
}

export const userApi = {
  search: (keyword?: string) =>
    http.get<UserRecord[]>('/users/search', { params: keyword ? { keyword } : {} }),
  getById: (id: string | number) =>
    http.get<UserRecord>(`/users/${id}`),
};
