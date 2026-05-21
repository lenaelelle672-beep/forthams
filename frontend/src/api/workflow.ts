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

function getOperatorId() {
  if (typeof window === 'undefined') return undefined;
  const raw = window.localStorage.getItem('ams_auth_user') || window.localStorage.getItem('user_info');
  if (!raw) return undefined;
  try {
    const user = JSON.parse(raw);
    const id = user.id ?? user.userId;
    return id != null && id !== '' ? Number(id) : undefined;
  } catch { return undefined; }
}

function unwrap<T>(res: any): T {
  if (res && typeof res === 'object' && 'code' in res) {
    if (res.code !== 200) throw new Error(res.message || '请求失败');
    return res.data as T;
  }
  return res as T;
}

export const workflowApi = {
  list: () =>
    http.get('/workflows').then(unwrap<WorkflowDefinitionDTO[]>),

  get: (businessType: string) =>
    http.get(`/workflows/${businessType}`).then(unwrap<WorkflowDefinitionDTO>),

  saveDraft: (businessType: string, payload: { name: string; description: string; definition: Record<string, unknown> }) =>
    http.put(`/workflows/${businessType}/draft`, { ...payload, operatorId: getOperatorId() }).then(unwrap<WorkflowDefinitionDTO>),

  publish: (businessType: string) =>
    http.post(`/workflows/${businessType}/publish`, { operatorId: getOperatorId() }).then(unwrap<WorkflowDefinitionDTO>),

  updateStatus: (businessType: string, status: string) =>
    http.post(`/workflows/${businessType}/status`, { status, operatorId: getOperatorId() }).then(unwrap<WorkflowDefinitionDTO>),
};

export interface RoleRecord {
  id: number;
  roleCode?: string;
  roleName?: string;
  [key: string]: unknown;
}

export const roleApi = {
  getAll: () =>
    http.get('/roles/all').then(unwrap<RoleRecord[]>),
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
    http.get('/users/search', { params: keyword ? { keyword } : {} }).then(unwrap<UserRecord[]>),
  getById: (id: string | number) =>
    http.get(`/users/${id}`).then(unwrap<UserRecord>),
};
