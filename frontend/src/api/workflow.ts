import http from '@/utils/http';
import type { ApiResponse } from '@/types/common';

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

type MaybeApiResponse<T> = T | ApiResponse<T>;

function unwrapData<T>(response: MaybeApiResponse<T>): T {
  if (
    response &&
    typeof response === 'object' &&
    'code' in response &&
    'data' in response
  ) {
    return (response as ApiResponse<T>).data;
  }
  return response as T;
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
    const id = user.id ?? user.userId;
    return id != null && id !== '' ? Number(id) : undefined;
  } catch { return undefined; }
}

export const workflowApi = {
  list: async () =>
    unwrapData(await http.get<MaybeApiResponse<WorkflowDefinitionDTO[]>>('/workflows')),

  get: async (businessType: string) =>
    unwrapData(await http.get<MaybeApiResponse<WorkflowDefinitionDTO>>(`/workflows/${businessType}`)),

  saveDraft: async (businessType: string, payload: { name: string; description: string; definition: Record<string, unknown> }) =>
    unwrapData(await http.put<MaybeApiResponse<WorkflowDefinitionDTO>>(`/workflows/${businessType}/draft`, { ...payload, operatorId: getOperatorId() })),

  publish: async (businessType: string) =>
    unwrapData(await http.post<MaybeApiResponse<WorkflowDefinitionDTO>>(`/workflows/${businessType}/publish`, { operatorId: getOperatorId() })),

  updateStatus: async (businessType: string, status: string) =>
    unwrapData(await http.post<MaybeApiResponse<WorkflowDefinitionDTO>>(`/workflows/${businessType}/status`, { status, operatorId: getOperatorId() })),
};

export interface RoleRecord {
  id: number;
  roleCode?: string;
  roleName?: string;
  [key: string]: unknown;
}

export const roleApi = {
  getAll: async () =>
    unwrapData(await http.get<MaybeApiResponse<RoleRecord[]>>('/roles/all')),
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
    http.get<MaybeApiResponse<UserRecord[]>>('/users/search', { params: keyword ? { keyword } : {} }).then(unwrapData),
  getById: (id: string | number) =>
    http.get<MaybeApiResponse<UserRecord>>(`/users/${id}`).then(unwrapData),
};
