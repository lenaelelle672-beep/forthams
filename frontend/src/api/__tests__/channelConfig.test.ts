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
import { channelConfigApi } from '@/api/channelConfig';

const mockedHttp = vi.mocked(http);

describe('api/channelConfig', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('uses system channel config paths and relies on the shared http unwrapping contract', async () => {
    const params = { page: 2, pageSize: 10, channelType: 'DINGTALK', keyword: 'ops' };
    const payload = {
      channelType: 'DINGTALK',
      configName: '运维群',
      webhookUrl: 'https://example.com/robot/send',
      enabled: 1,
      description: '测试渠道',
    };
    const listResponse = { records: [], total: 0, page: 2, pageSize: 10 };
    const detailResponse = {
      id: 7,
      channelType: 'DINGTALK',
      configName: '运维群',
      webhookUrlMasked: 'https://example.com/***',
      webhookUrlConfigured: true,
      signatureConfigured: false,
      enabled: 1,
      description: '测试渠道',
      createdAt: '2026-01-01',
      updatedAt: '2026-01-01',
    };

    mockedHttp.get.mockResolvedValueOnce(listResponse).mockResolvedValueOnce(detailResponse);
    mockedHttp.post.mockResolvedValueOnce(detailResponse).mockResolvedValueOnce('ok');
    mockedHttp.put.mockResolvedValueOnce(detailResponse);
    mockedHttp.delete.mockResolvedValueOnce(undefined);

    await expect(channelConfigApi.list(params)).resolves.toBe(listResponse);
    await expect(channelConfigApi.getById(7)).resolves.toBe(detailResponse);
    await expect(channelConfigApi.create(payload)).resolves.toBe(detailResponse);
    await expect(channelConfigApi.update(7, payload)).resolves.toBe(detailResponse);
    await expect(channelConfigApi.delete(7)).resolves.toBeUndefined();
    await expect(channelConfigApi.test('DINGTALK')).resolves.toBe('ok');

    expect(mockedHttp.get).toHaveBeenNthCalledWith(1, '/system/channel-configs', { params });
    expect(mockedHttp.get).toHaveBeenNthCalledWith(2, '/system/channel-configs/7');
    expect(mockedHttp.post).toHaveBeenNthCalledWith(1, '/system/channel-configs', payload);
    expect(mockedHttp.put).toHaveBeenCalledWith('/system/channel-configs/7', payload);
    expect(mockedHttp.delete).toHaveBeenCalledWith('/system/channel-configs/7');
    expect(mockedHttp.post).toHaveBeenNthCalledWith(2, '/system/channel-configs/DINGTALK/test');
  });
});
