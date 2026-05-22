import http from '@/utils/http';

export interface WorkflowDefinitionDTO {
  id?: number;
  businessType: string;
  name: string;
  description: string;
  definition: Record<string, unknown>;
  status: 'UNCONFIGURED' | 'DRAFT' | 'PUBLISHED' | 'DISABLED';
  version: number;
  updatedBy?: number;
  publishedBy?: number;
  publishedAt?: string;
  createTime?: string;
  updateTime?: string;
}

/**
 * 从 localStorage 获取当前登录用户 ID。
 * http.ts 拦截器已解包 response.data，因此此函数不涉及 HTTP。
 */
function getOperatorId(): number | undefined {
  if (typeof window === 'undefined') return undefined;
  const raw = window.localStorage.getItem('user_info');
  if (!raw) return undefined;
  try {
    const user = JSON.parse(raw);
    const id = user.id ?? user.userId;
    return id != null && id !== '' ? Number(id) : undefined;
  } catch { return undefined; }
}

export const workflowApi = {
  list: () =>
    http.get<WorkflowDefinitionDTO[]>('/workflows'),

  get: (businessType: string) =>
    http.get<WorkflowDefinitionDTO>(`/workflows/${businessType}`),

  saveDraft: (businessType: string, payload: { name: string; description: string; definition: Record<string, unknown> }) =>
    http.put<WorkflowDefinitionDTO>(`/workflows/${businessType}/draft`, { ...payload, operatorId: getOperatorId() }),

  publish: (businessType: string) =>
    http.post<WorkflowDefinitionDTO>(`/workflows/${businessType}/publish`, { operatorId: getOperatorId() }),

  updateStatus: (businessType: string, status: string) =>
    http.post<WorkflowDefinitionDTO>(`/workflows/${businessType}/status`, { status, operatorId: getOperatorId() }),
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
