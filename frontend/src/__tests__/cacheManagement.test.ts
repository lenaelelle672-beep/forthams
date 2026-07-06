import { beforeEach, describe, expect, it, vi } from 'vitest';
import { api } from '../app/utils/api';
import { listCacheNamespaces, refreshAllCacheNamespaces, refreshCacheNamespace } from '../api/cacheManagement';

vi.mock('../app/utils/api', () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
  },
}));

const mockedApi = vi.mocked(api);

describe('cacheManagement API wrapper', () => {
  beforeEach(() => vi.clearAllMocks());

  it('只访问 /system/cache 命名空间列表契约', async () => {
    mockedApi.get.mockResolvedValueOnce([]);

    await listCacheNamespaces();

    expect(mockedApi.get).toHaveBeenCalledWith('/system/cache/namespaces');
  });

  it('封装指定 namespace 与 refreshAll 白名单刷新路径', async () => {
    mockedApi.post.mockResolvedValueOnce({ namespace: 'workbench-v3-menu-metadata', status: 'CLEARED' });
    mockedApi.post.mockResolvedValueOnce([]);

    await refreshCacheNamespace('workbench-v3-menu-metadata');
    await refreshAllCacheNamespaces();

    expect(mockedApi.post).toHaveBeenCalledWith('/system/cache/namespaces/workbench-v3-menu-metadata/refresh');
    expect(mockedApi.post).toHaveBeenCalledWith('/system/cache/refresh');
  });

  it('不包含旧 settings、public mock 或 iframe 边界', () => {
    expect(listCacheNamespaces.toString()).not.toContain('/settings');
    expect(refreshCacheNamespace.toString()).not.toContain('public');
    expect(refreshAllCacheNamespaces.toString()).not.toContain('iframe');
  });
});
