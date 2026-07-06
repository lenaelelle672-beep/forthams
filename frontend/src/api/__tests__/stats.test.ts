import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/utils/http', () => ({
  default: {
    get: vi.fn(),
  },
}));

import http from '@/utils/http';
import { getStatsOverview } from '@/api/stats';

const mockedHttp = vi.mocked(http);

describe('api/stats', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('uses the stats overview path and relies on the shared http unwrapping contract', async () => {
    const overview = {
      totalUsers: 10,
      totalAssets: 120,
      pendingActions: 5,
      lastUpdated: '2026-06-09T02:00:00',
    };
    mockedHttp.get.mockResolvedValue(overview);

    await expect(getStatsOverview()).resolves.toBe(overview);

    expect(mockedHttp.get).toHaveBeenCalledWith('/stats/overview');
  });
});
