import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/utils/http', () => ({
  default: {
    get: vi.fn(),
    put: vi.fn(),
  },
}));

import http from '@/utils/http';
import { listSlaConfigs, updateSlaConfig } from '@/api/slaConfig';

const mockedHttp = vi.mocked(http);

describe('api/slaConfig', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('uses unified SLA config paths and relies on the shared http unwrapping contract', async () => {
    const payload = {
      responseHours: 2,
      resolveHours: 8,
      warningRatio: 0.75,
    };

    mockedHttp.get.mockResolvedValue([]);
    mockedHttp.put.mockResolvedValue({
      id: 1,
      priority: 'HIGH',
      responseHours: 2,
      resolveHours: 8,
      warningRatio: 0.75,
      status: 1,
    });

    await listSlaConfigs();
    await updateSlaConfig(1, payload);

    expect(mockedHttp.get).toHaveBeenCalledWith('/sla-config');
    expect(mockedHttp.put).toHaveBeenCalledWith('/sla-config/1', payload);
  });
});
