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
  createFaultCode,
  deleteFaultCode,
  getFaultCodeByLevel,
  getFaultCodeChildren,
  getFaultCodeDetail,
  getFaultCodeTree,
  updateFaultCode,
} from '@/api/faultCode';

const mockedHttp = {
  get: vi.mocked(http.get),
  post: vi.mocked(http.post),
  put: vi.mocked(http.put),
  delete: vi.mocked(http.delete),
};

describe('api/faultCode', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('uses unified fault code paths and relies on the shared http unwrapping contract', async () => {
    const payload = {
      code: 'P001',
      faultPhenomenon: '异响',
      sortOrder: 1,
    };

    mockedHttp.get.mockResolvedValue({});
    mockedHttp.post.mockResolvedValue({});
    mockedHttp.put.mockResolvedValue({});
    mockedHttp.delete.mockResolvedValue(undefined);

    await getFaultCodeTree();
    await getFaultCodeByLevel(1);
    await getFaultCodeChildren(9);
    await getFaultCodeDetail(9);
    await createFaultCode(payload);
    await updateFaultCode(9, { ...payload, status: 'ACTIVE' });
    await deleteFaultCode(9);

    expect(mockedHttp.get).toHaveBeenNthCalledWith(1, '/fault-codes/tree');
    expect(mockedHttp.get).toHaveBeenNthCalledWith(2, '/fault-codes/level/1');
    expect(mockedHttp.get).toHaveBeenNthCalledWith(3, '/fault-codes/9/children');
    expect(mockedHttp.get).toHaveBeenNthCalledWith(4, '/fault-codes/9');
    expect(mockedHttp.post).toHaveBeenCalledWith('/fault-codes', payload);
    expect(mockedHttp.put).toHaveBeenCalledWith('/fault-codes/9', { ...payload, status: 'ACTIVE' });
    expect(mockedHttp.delete).toHaveBeenCalledWith('/fault-codes/9');
  });
});
