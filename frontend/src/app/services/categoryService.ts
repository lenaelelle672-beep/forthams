import { api } from "../utils/api";

/* ------------------------------------------------------------------ */
/*  Types — aligning with backend AssetCategory entity                 */
/* ------------------------------------------------------------------ */

/** 资产分类实体（对应后端 AssetCategory） */
export interface AssetCategoryEntity {
  id: number;
  categoryName: string;
  categoryCode: string;
  parentId?: number | null;
  sortOrder?: number;
  description?: string;
  createTime?: string;
  updateTime?: string;
}

/** 树形节点（对应后端 CategoryTreeDTO） */
export interface CategoryTreeNode {
  id: number;
  categoryName: string;
  categoryCode: string;
  parentId?: number | null;
  sortOrder?: number;
  children?: CategoryTreeNode[];
}

/** 分页响应 */
export interface PageResult<T> {
  records: T[];
  total: number;
  size: number;
  current: number;
  pages: number;
}

/** 创建/更新请求体 */
export interface CategoryFormData {
  categoryName: string;
  categoryCode: string;
  parentId?: number | null;
  sortOrder?: number;
  description?: string;
}

/* ------------------------------------------------------------------ */
/*  Service                                                            */
/* ------------------------------------------------------------------ */

export const categoryService = {
  /** 分页列表 */
  list(params?: Record<string, unknown>) {
    return api.get<PageResult<AssetCategoryEntity>>("/categories/list", { params });
  },

  /** 获取所有分类（无分页） */
  getAll() {
    return api.get<AssetCategoryEntity[]>("/categories/all");
  },

  /** 获取分类树（含层级 children） */
  getTree() {
    return api.get<CategoryTreeNode[]>("/categories/tree");
  },

  /** 获取单个分类 */
  getById(id: number | string) {
    return api.get<AssetCategoryEntity>(`/categories/${id}`);
  },

  /** 创建分类 */
  create(data: CategoryFormData) {
    return api.post<AssetCategoryEntity>("/categories", data);
  },

  /** 更新分类 */
  update(id: number | string, data: Partial<CategoryFormData>) {
    return api.put<AssetCategoryEntity>(`/categories/${id}`, data);
  },

  /** 删除分类 */
  delete(id: number | string) {
    return api.delete<string>(`/categories/${id}`);
  },
};
