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
  getSamDashboard,
  getSamHistory,
  getSamScanDetails,
  runSamComplianceScan,
} from '@/api/sam';

const mockedHttp = {
  get: vi.mocked(http.get),
  post: vi.mocked(http.post),
  put: vi.mocked(http.put),
  delete: vi.mocked(http.delete),
};

describe('api/sam', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('uses unified SAM paths and relies on the shared http unwrapping contract', async () => {
    mockedHttp.get.mockResolvedValue({});
    mockedHttp.post.mockResolvedValue({});

    await getSamDashboard();
    await getSamHistory({ page: 2, pageSize: 20 });
    await getSamScanDetails(5);
    await runSamComplianceScan();

    expect(mockedHttp.get).toHaveBeenNthCalledWith(1, '/sam/dashboard');
    expect(mockedHttp.get).toHaveBeenNthCalledWith(2, '/sam/history', {
      params: { page: 2, pageSize: 20 },
    });
    expect(mockedHttp.get).toHaveBeenNthCalledWith(3, '/sam/5/details');
    expect(mockedHttp.post).toHaveBeenCalledWith('/sam/scan');
  });
});
