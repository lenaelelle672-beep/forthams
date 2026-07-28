import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/utils/http', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
}));

import http from '@/utils/http';
import {
  commitImport,
  createAsset,
  createCategory,
  deleteAsset,
  deleteCategory,
  getAssetById,
  getAssetList,
  getCategoryTree,
  getDepreciationSchedule,
  getImportTemplate,
  parseImportFile,
  exportAssets,
  updateAsset,
  updateCategory,
} from '@/api/asset';

const mockedHttp = {
  get: vi.mocked(http.get),
  post: vi.mocked(http.post),
  put: vi.mocked(http.put),
  delete: vi.mocked(http.delete),
};

describe('api/asset', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('uses unified asset and category paths and relies on the shared http unwrapping contract', async () => {
    const params = { page: 1, pageSize: 10, keyword: 'printer' };
    const assetPayload = { assetName: '打印机', categoryId: 2 };
    const assetPatch = { id: 8, assetName: '打印机 A' };
    const categoryPayload = { categoryName: '办公设备', parentId: null };
    const categoryPatch = { categoryName: '办公设备-更新' };
    const file = new File(['assetNo,assetName'], 'assets.csv', { type: 'text/csv' });

    mockedHttp.get.mockResolvedValue({});
    mockedHttp.post.mockResolvedValue({});
    mockedHttp.put.mockResolvedValue({});
    mockedHttp.delete.mockResolvedValue(undefined);

    await getAssetList(params);
    await getAssetById(8);
    await createAsset(assetPayload);
    await updateAsset(assetPatch);
    await deleteAsset(8);
    await getImportTemplate();
    await parseImportFile(file);
    await commitImport('parse-1', [{ assetName: '打印机' }]);
    await exportAssets({ keyword: 'printer', status: 'IDLE' });
    await getCategoryTree();
    await createCategory(categoryPayload);
    await updateCategory(2, categoryPatch);
    await deleteCategory(2);
    await getDepreciationSchedule(8);

    expect(mockedHttp.get).toHaveBeenNthCalledWith(1, '/assets', { params });
    expect(mockedHttp.get).toHaveBeenNthCalledWith(2, '/assets/8');
    expect(mockedHttp.post).toHaveBeenNthCalledWith(1, '/assets', assetPayload);
    expect(mockedHttp.put).toHaveBeenNthCalledWith(1, '/assets/8', { assetName: '打印机 A' });
    expect(mockedHttp.delete).toHaveBeenNthCalledWith(1, '/assets/8');
    expect(mockedHttp.get).toHaveBeenNthCalledWith(3, '/assets/import/template', { responseType: 'blob' });
    expect(mockedHttp.post).toHaveBeenNthCalledWith(
      2,
      '/assets/import/parse',
      expect.any(FormData),
      { headers: { 'Content-Type': 'multipart/form-data' } },
    );
    expect(mockedHttp.post).toHaveBeenNthCalledWith(3, '/assets/import/commit', {
      parseId: 'parse-1',
      rows: [{ assetName: '打印机' }],
    });
    expect(mockedHttp.post).toHaveBeenNthCalledWith(
      4,
      '/assets/export',
      { keyword: 'printer', status: 'IDLE' },
      { responseType: 'blob' },
    );
    expect(mockedHttp.get).toHaveBeenNthCalledWith(4, '/categories/tree');
    expect(mockedHttp.post).toHaveBeenNthCalledWith(5, '/categories', categoryPayload);
    expect(mockedHttp.put).toHaveBeenNthCalledWith(2, '/categories/2', categoryPatch);
    expect(mockedHttp.delete).toHaveBeenNthCalledWith(2, '/categories/2');
    expect(mockedHttp.get).toHaveBeenNthCalledWith(5, '/assets/8/depreciation-schedule');
  });
});
