import http from '@/utils/http';

export type SystemPost = {
  id: number;
  postCode: string;
  postName: string;
  sortOrder: number;
  status: string;
  remark?: string;
  createdAt?: string;
  updatedAt?: string;
  tenantScoped?: boolean;
  readOnly?: boolean;
  readonlyBoundary?: string;
  referenceCountMasked?: string;
  impactSummary?: string;
};

export type SystemPostPage = {
  records: SystemPost[];
  total: number;
  page: number;
  pageSize: number;
  pages: number;
  tenantScoped: boolean;
  readOnly: boolean;
  readonlyBoundary: string;
};

export type SystemPostQuery = {
  page?: number;
  pageSize?: number;
  keyword?: string;
  status?: string;
};

export type SystemPostMeta = {
  statuses: Array<{ value: string; label: string }>;
  allowedPreviewFields: string[];
  previewPolicy: {
    tenantScoped: boolean;
    noPersistence: boolean;
    noAssignment: boolean;
    noPermissionEffect: boolean;
    runtimeEffect: boolean;
    cacheRefreshed: boolean;
    readonlyBoundary?: string;
    rejectedInputFields?: string[];
  };
  tenantScoped: boolean;
  readOnly: boolean;
  noPersistencePreview: boolean;
  noAssignment: boolean;
  noPermissionEffect: boolean;
  runtimeEffect: boolean;
  cacheRefreshed: boolean;
  readonlyBoundary: string;
  nonGoals: string[];
};

export type SystemPostPreviewRequest = {
  postCode?: string;
  postName?: string;
  sortOrder?: number;
  status?: string;
  remark?: string;
};

export type SystemPostPreviewResponse = {
  previewAccepted: boolean;
  duplicateRisk: boolean;
  referenceImpact: string;
  acceptedFields: string[];
  rejectedInputs: Array<{ field: string; reason: string }>;
  warnings: string[];
  tenantScoped: boolean;
  readOnly: boolean;
  noPersistence: boolean;
  noAssignment: boolean;
  noPermissionEffect: boolean;
  runtimeEffect: boolean;
  cacheRefreshed: boolean;
  readonlyBoundary: string;
};

export const systemPostApi = {
  list(params?: SystemPostQuery) {
    return http.get<SystemPostPage>('/system/posts', { params });
  },
  all(params?: SystemPostQuery) {
    return http.get<SystemPost[]>('/system/posts/all', { params });
  },
  getById(id: number) {
    return http.get<SystemPost>(`/system/posts/${id}`);
  },
  meta() {
    return http.get<SystemPostMeta>('/system/posts/meta');
  },
  preview(data: SystemPostPreviewRequest) {
    return http.post<SystemPostPreviewResponse>('/system/posts/preview', data);
  },
};
