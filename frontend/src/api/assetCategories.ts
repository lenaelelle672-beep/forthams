import { api } from '../app/utils/api';

export interface AssetCategoryRecord {
  id: number;
  categoryName: string;
  categoryCode: string;
  parentId?: number | null;
  sortOrder?: number | null;
  description?: string | null;
  createTime?: string | null;
  updateTime?: string | null;
}

export interface AssetCategoryTreeNode extends AssetCategoryRecord {
  children?: AssetCategoryTreeNode[];
}

export interface AssetCategoryPage {
  records: AssetCategoryRecord[];
  total: number;
  size: number;
  current: number;
  pages: number;
}

export interface AssetCategoryListParams {
  page?: number;
  pageSize?: number;
  keyword?: string;
}

const ASSET_CATEGORIES_LIST = '/categories/list';
const ASSET_CATEGORIES_TREE = '/categories/tree';

export function listAssetCategories(params: AssetCategoryListParams = {}) {
  const keyword = params.keyword?.trim();
  return api.get<AssetCategoryPage>(ASSET_CATEGORIES_LIST, {
    params: {
      page: params.page ?? 1,
      pageSize: params.pageSize ?? 50,
      ...(keyword ? { keyword } : {}),
    },
  });
}

export function getAssetCategoryTree() {
  return api.get<AssetCategoryTreeNode[]>(ASSET_CATEGORIES_TREE);
}
