import { api } from '../app/utils/api';

export interface DocArticleRecord {
  id: number;
  title: string;
  category: string;
  categoryLabel: string;
  version: number;
  status: string;
  statusLabel: string;
  authorName?: string;
  attachmentCount: number;
  summary?: string;
  publishedAt?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface DocArticleList {
  records: DocArticleRecord[];
  total: number;
}

export interface DocCenterMeta {
  categories: string[];
  statuses: string[];
  readOnlyNotice: string;
}

export interface DocArticleQuery {
  page?: number;
  pageSize?: number;
  category?: string;
  status?: string;
  keyword?: string;
}

export function listDocArticles(params: DocArticleQuery = {}) {
  return api.get<DocArticleList>('/system/doc-center', { params });
}

export function getDocArticleDetail(id: number) {
  return api.get<DocArticleRecord>(`/system/doc-center/${id}`);
}

export function getDocCenterMeta() {
  return api.get<DocCenterMeta>('/system/doc-center/meta');
}
