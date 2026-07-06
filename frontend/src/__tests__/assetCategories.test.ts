import { beforeEach, describe, expect, it, vi } from 'vitest';
import { api } from '../app/utils/api';
import { getAssetCategoryTree, listAssetCategories } from '../api/assetCategories';

vi.mock('../app/utils/api', () => ({
  api: {
    get: vi.fn(),
  },
}));

const mockedApi = vi.mocked(api);

describe('assetCategories API wrapper', () => {
  beforeEach(() => vi.clearAllMocks());

  it('使用 /categories/list 分页查询并传递 keyword', async () => {
    mockedApi.get.mockResolvedValueOnce({ records: [], total: 0, size: 50, current: 1, pages: 0 });

    await listAssetCategories({ page: 2, pageSize: 20, keyword: '  车辆  ' });

    expect(mockedApi.get).toHaveBeenCalledWith('/categories/list', {
      params: { page: 2, pageSize: 20, keyword: '车辆' },
    });
  });

  it('空 keyword 不传给后端，保持只读默认分页', async () => {
    mockedApi.get.mockResolvedValueOnce({ records: [], total: 0, size: 50, current: 1, pages: 0 });

    await listAssetCategories({ keyword: '   ' });

    expect(mockedApi.get).toHaveBeenCalledWith('/categories/list', {
      params: { page: 1, pageSize: 50 },
    });
  });

  it('使用 /categories/tree 加载树，不复用旧分类 service 端点', async () => {
    mockedApi.get.mockResolvedValueOnce([]);

    await getAssetCategoryTree();

    expect(mockedApi.get).toHaveBeenCalledWith('/categories/tree');
    expect(mockedApi.get).not.toHaveBeenCalledWith('/api/v1/asset-categories/tree');
  });
});
