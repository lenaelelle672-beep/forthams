import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/utils/http', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
  },
}));

import http from '@/utils/http';
import { exportAssets, getImportTemplate, parseImportFile, commitImport } from '@/api/assetImport';

const mockedHttp = vi.mocked(http);

describe('api/assetImport', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('uses the backend asset import/export contract', async () => {
    const file = new File(['assetNo,assetName'], 'assets.csv', { type: 'text/csv' });
    const row = {
      rowNumber: 2,
      assetNo: 'AST-1',
      assetName: '测试资产',
      name: '测试资产',
      categoryCode: '3',
      statusCode: 'IDLE',
      locationCode: 'LOC-1',
      purchaseDate: '2026-06-09',
      originalValue: 1000,
    };
    mockedHttp.get.mockResolvedValue(new Blob());
    mockedHttp.post.mockResolvedValue({});

    await getImportTemplate();
    await parseImportFile(file);
    await commitImport('parse-1', [row]);
    await exportAssets({ categoryCodes: ['3'], statusCodes: ['IDLE', 'IN_USE'], locationCodes: [] });

    expect(mockedHttp.get).toHaveBeenCalledWith('/assets/import/template', { responseType: 'blob' });
    expect(mockedHttp.post).toHaveBeenNthCalledWith(
      1,
      '/assets/import/parse',
      expect.any(FormData),
      expect.objectContaining({ headers: { 'Content-Type': 'multipart/form-data' } }),
    );
    expect(mockedHttp.post).toHaveBeenNthCalledWith(2, '/assets/import/commit', {
      parseId: 'parse-1',
      rows: [row],
    });
    expect(mockedHttp.post).toHaveBeenNthCalledWith(
      3,
      '/assets/export',
      { categoryId: 3, status: 'IDLE,IN_USE', keyword: undefined },
      { responseType: 'blob' },
    );
  });
});
