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
import { mailLogApi } from '@/api/mailTemplate';

const mockedHttp = vi.mocked(http);

describe('api/mailLog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('keeps mail log APIs on the backend contract paths', async () => {
    const listParams = {
      page: 2,
      pageSize: 10,
      templateCode: 'ASSET_NOTIFY',
      sendStatus: 'FAILED',
      bizType: 'asset',
      bizId: 18,
    };
    const log = {
      id: 7,
      mailTo: 'ops@example.com',
      sendStatus: 'FAILED',
      retryCount: 1,
      maxRetry: 3,
    };
    const pageResponse = { records: [log], total: 1, size: 10, current: 2, pages: 1 };

    mockedHttp.get
      .mockResolvedValueOnce(pageResponse)
      .mockResolvedValueOnce(log)
      .mockResolvedValueOnce([log]);
    mockedHttp.post.mockResolvedValueOnce(undefined);

    await expect(mailLogApi.list(listParams)).resolves.toBe(pageResponse);
    await expect(mailLogApi.getById(7)).resolves.toBe(log);
    await expect(mailLogApi.getByBiz('asset', 18)).resolves.toEqual([log]);
    await expect(mailLogApi.retry(7)).resolves.toBeUndefined();

    expect(mockedHttp.get).toHaveBeenNthCalledWith(1, '/mail-logs/list', { params: listParams });
    expect(mockedHttp.get).toHaveBeenNthCalledWith(2, '/mail-logs/7');
    expect(mockedHttp.get).toHaveBeenNthCalledWith(3, '/mail-logs/biz', { params: { bizType: 'asset', bizId: 18 } });
    expect(mockedHttp.post).toHaveBeenCalledWith('/mail-logs/7/retry');
  });
});
