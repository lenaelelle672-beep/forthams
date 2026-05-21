import { api } from "../utils/api";

export interface CategoryRecord {
  id: number;
  name?: string;
  code?: string;
  parentId?: number | null;
  children?: CategoryRecord[];
  [key: string]: unknown;
}

/** 后端树接口节点（GET /categories/tree） */
export interface CategoryTreeNode {
  code: string;
  name: string;
  id?: number;
  children?: CategoryTreeNode[];
}

export const categoryService = {
  list(params?: Record<string, unknown>) {
    return api.get<CategoryRecord[]>("/categories/list", { params });
  },

  getAll() {
    return api.get<CategoryRecord[]>("/categories/all");
  },

  /** 获取分类树（含层级 children） */
  getTree() {
    return api.get<CategoryTreeNode[]>("/categories/tree");
  },

  getById(id: number | string) {
    return api.get<CategoryRecord>(`/categories/${id}`);
  },

  create(data: Record<string, unknown>) {
    return api.post<CategoryRecord>("/categories", data);
  },

  update(id: number | string, data: Record<string, unknown>) {
    return api.put<CategoryRecord>(`/categories/${id}`, data);
  },

  delete(id: number | string) {
    return api.delete<string>(`/categories/${id}`);
  },
};
