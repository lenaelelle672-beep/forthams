import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('axios', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
  },
}));

import axios from 'axios';
import { exportAssets, getImportTemplate, parseImportFile, commitImport } from '@/api/assetImport';

const mockedAxios = vi.mocked(axios);

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
    mockedAxios.get.mockResolvedValue({ data: new Blob() });
    mockedAxios.post.mockResolvedValue({ data: {} });

    await getImportTemplate();
    await parseImportFile(file);
    await commitImport('parse-1', [row]);
    await exportAssets({ categoryCodes: ['3'], statusCodes: ['IDLE', 'IN_USE'], locationCodes: [] });

    expect(mockedAxios.get).toHaveBeenCalledWith('/api/v1/assets/import/template', { responseType: 'blob' });
    expect(mockedAxios.post).toHaveBeenNthCalledWith(
      1,
      '/api/v1/assets/import/parse',
      expect.any(FormData),
      expect.objectContaining({ headers: { 'Content-Type': 'multipart/form-data' } }),
    );
    expect(mockedAxios.post).toHaveBeenNthCalledWith(2, '/api/v1/assets/import/commit', {
      parseId: 'parse-1',
      rows: [row],
    });
    expect(mockedAxios.post).toHaveBeenNthCalledWith(
      3,
      '/api/v1/assets/export',
      { categoryCodes: ['3'], statusCodes: ['IDLE', 'IN_USE'], locationCodes: [] },
      { responseType: 'blob' },
    );
  });
});
