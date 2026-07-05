import { beforeEach, describe, expect, it, vi } from 'vitest';
import { api } from '../app/utils/api';
import {
  createSystemWebhookConfig,
  deleteSystemWebhookConfig,
  getSystemWebhookConfig,
  listSystemWebhookConfigs,
  testSystemWebhookConfig,
  updateSystemWebhookConfig,
  updateSystemWebhookConfigStatus,
} from '../api/systemWebhookConfigs';

vi.mock('../app/utils/api', () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
}));

const mockedApi = vi.mocked(api);

describe('systemWebhookConfigs API wrapper', () => {
  beforeEach(() => vi.clearAllMocks());

  it('只访问 /system/webhook-configs 专属契约', async () => {
    mockedApi.get.mockResolvedValueOnce([]);

    await listSystemWebhookConfigs();

    expect(mockedApi.get).toHaveBeenCalledWith('/system/webhook-configs');
  });

  it('封装 get/create/update/status/delete 全部 V3 路径', async () => {
    mockedApi.get.mockResolvedValueOnce({ id: 1 });
    mockedApi.post.mockResolvedValueOnce({ id: 1 });
    mockedApi.put.mockResolvedValueOnce({ id: 1 });
    mockedApi.put.mockResolvedValueOnce({ id: 1 });
    mockedApi.delete.mockResolvedValueOnce(undefined);

    await getSystemWebhookConfig(1);
    await createSystemWebhookConfig({ configName: 'Webhook', eventType: 'ASSET_SYNC', targetUrl: 'https://hooks.example.com/asset', signingStrategy: 'NONE', enabled: true });
    await updateSystemWebhookConfig(1, { configName: 'Webhook', eventType: 'ASSET_SYNC', targetUrl: 'https://hooks.example.com/asset', signingStrategy: 'NONE', enabled: true });
    await updateSystemWebhookConfigStatus(1, false);
    await deleteSystemWebhookConfig(1);

    expect(mockedApi.get).toHaveBeenCalledWith('/system/webhook-configs/1');
    expect(mockedApi.post).toHaveBeenCalledWith('/system/webhook-configs', expect.objectContaining({ eventType: 'ASSET_SYNC' }));
    expect(mockedApi.put).toHaveBeenCalledWith('/system/webhook-configs/1', expect.objectContaining({ targetUrl: 'https://hooks.example.com/asset' }));
    expect(mockedApi.put).toHaveBeenCalledWith('/system/webhook-configs/1/status', undefined, { params: { enabled: false } });
    expect(mockedApi.delete).toHaveBeenCalledWith('/system/webhook-configs/1');
  });

  it('配置校验端点只做 config-only 测试', async () => {
    mockedApi.post.mockResolvedValueOnce({ valid: true, configOnly: true });

    await testSystemWebhookConfig(1);

    expect(mockedApi.post).toHaveBeenCalledWith('/system/webhook-configs/1/test');
  });
});
