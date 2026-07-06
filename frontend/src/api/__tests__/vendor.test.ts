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
  createVendor,
  deleteVendor,
  getVendorDetail,
  getVendorList,
  updateVendor,
} from '@/api/vendor';

const mockedHttp = vi.mocked(http);

describe('api/vendor', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('uses unified vendor paths and relies on the shared http unwrapping contract', async () => {
    const params = { page: 2, pageSize: 20, keyword: 'acme', status: 1 };
    const payload = { name: 'Acme', vendorCode: 'V001' };
    const patch = { contactPerson: 'Lee' };

    mockedHttp.get.mockResolvedValue({});
    mockedHttp.post.mockResolvedValue({});
    mockedHttp.put.mockResolvedValue({});
    mockedHttp.delete.mockResolvedValue(undefined);

    await getVendorList(params);
    await getVendorDetail(7);
    await createVendor(payload);
    await updateVendor(7, patch);
    await deleteVendor(7);

    expect(mockedHttp.get).toHaveBeenNthCalledWith(1, '/vendors', { params });
    expect(mockedHttp.get).toHaveBeenNthCalledWith(2, '/vendors/7');
    expect(mockedHttp.post).toHaveBeenCalledWith('/vendors', payload);
    expect(mockedHttp.put).toHaveBeenCalledWith('/vendors/7', patch);
    expect(mockedHttp.delete).toHaveBeenCalledWith('/vendors/7');
  });
});
