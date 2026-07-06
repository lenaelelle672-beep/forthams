import { beforeEach, describe, expect, it, vi } from 'vitest';
import { api } from '../app/utils/api';
import { listVendors } from '../api/vendors';

vi.mock('../app/utils/api', () => ({
  api: {
    get: vi.fn(),
  },
}));

const mockedApi = vi.mocked(api);

describe('vendors API wrapper', () => {
  beforeEach(() => vi.clearAllMocks());

  it('只通过 /vendors/list 读取供应商列表', async () => {
    mockedApi.get.mockResolvedValueOnce([{ id: 1, name: '华北供应商', vendorCode: 'V-001' }]);

    const result = await listVendors();

    expect(mockedApi.get).toHaveBeenCalledWith('/vendors/list');
    expect(result).toEqual([{ id: 1, name: '华北供应商', vendorCode: 'V-001' }]);
  });
});
