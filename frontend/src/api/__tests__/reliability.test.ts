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
  getReliabilityByAsset,
  getReliabilityRanking,
  getReliabilitySummary,
  getReliabilityTrend,
} from '@/api/reliability';

const mockedHttp = {
  get: vi.mocked(http.get),
  post: vi.mocked(http.post),
  put: vi.mocked(http.put),
  delete: vi.mocked(http.delete),
};

describe('api/reliability', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('uses unified reliability paths and relies on the shared http unwrapping contract', async () => {
    mockedHttp.get.mockResolvedValue({});

    await getReliabilitySummary({ assetId: 7, startDate: '2026-01-01', endDate: '2026-01-31' });
    await getReliabilityTrend({ period: 'MONTH' });
    await getReliabilityRanking({ sortBy: 'MTBF', limit: 10 });
    await getReliabilityByAsset(7);

    expect(mockedHttp.get).toHaveBeenNthCalledWith(1, '/reliability/summary', {
      params: { assetId: 7, startDate: '2026-01-01', endDate: '2026-01-31' },
    });
    expect(mockedHttp.get).toHaveBeenNthCalledWith(2, '/reliability/trend', {
      params: { period: 'MONTH' },
    });
    expect(mockedHttp.get).toHaveBeenNthCalledWith(3, '/reliability/ranking', {
      params: { sortBy: 'MTBF', limit: 10 },
    });
    expect(mockedHttp.get).toHaveBeenNthCalledWith(4, '/reliability/asset/7');
  });
});
