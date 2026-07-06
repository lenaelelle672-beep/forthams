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
  createWebhookConfig,
  deleteWebhookConfig,
  listWebhookConfigs,
  updateWebhookConfig,
} from '@/api/webhookConfig';

const mockedHttp = vi.mocked(http);

describe('api/webhookConfig', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('uses unified webhook config paths and relies on the shared http unwrapping contract', async () => {
    const params = { page: 2, pageSize: 10, keyword: 'asset' };
    const payload = {
      name: '资产事件',
      url: 'https://example.com/webhook',
      events: ['asset.created'],
      enabled: 1,
    };

    mockedHttp.get.mockResolvedValue({});
    mockedHttp.post.mockResolvedValue({});
    mockedHttp.put.mockResolvedValue({});
    mockedHttp.delete.mockResolvedValue(undefined);

    await listWebhookConfigs(params);
    await createWebhookConfig(payload);
    await updateWebhookConfig(3, payload);
    await deleteWebhookConfig(3);

    expect(mockedHttp.get).toHaveBeenCalledWith('/webhook-configs', { params });
    expect(mockedHttp.post).toHaveBeenCalledWith('/webhook-configs', payload);
    expect(mockedHttp.put).toHaveBeenCalledWith('/webhook-configs/3', payload);
    expect(mockedHttp.delete).toHaveBeenCalledWith('/webhook-configs/3');
  });
});
