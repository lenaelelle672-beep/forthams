import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/utils/http', () => ({
  default: {
    get: vi.fn(),
  },
}));

import http from '@/utils/http';
import { globalSearch } from '@/api/search';

const mockedHttp = vi.mocked(http);

describe('api/search', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('uses the unified search path and relies on the shared http unwrapping contract', async () => {
    mockedHttp.get.mockResolvedValue([]);

    await globalSearch('打印机', 'asset', 5);

    expect(mockedHttp.get).toHaveBeenCalledWith('/search', {
      params: { keyword: '打印机', type: 'asset', limit: 5 },
    });
  });
});
