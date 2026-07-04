import { beforeEach, describe, expect, it, vi } from 'vitest';
import { api } from '../app/utils/api';
import {
  createSystemInterface,
  deleteSystemInterface,
  listSystemInterfaces,
  testSystemInterfaceConfig,
  updateSystemInterfaceStatus,
} from '../api/systemInterfaces';

vi.mock('../app/utils/api', () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
}));

const mockedApi = vi.mocked(api);

describe('systemInterfaces API wrapper', () => {
  beforeEach(() => vi.clearAllMocks());

  it('只访问 /system/interfaces 专属契约', async () => {
    mockedApi.get.mockResolvedValueOnce([]);

    await listSystemInterfaces();

    expect(mockedApi.get).toHaveBeenCalledWith('/system/interfaces');
  });

  it('创建接口时不复用其他系统 wrapper', async () => {
    mockedApi.post.mockResolvedValueOnce({ id: 1 });

    await createSystemInterface({ externalSystemId: 1, interfaceName: '接口', method: 'GET', path: '/asset', enabled: true });

    expect(mockedApi.post).toHaveBeenCalledWith('/system/interfaces', expect.objectContaining({ path: '/asset' }));
  });

  it('状态与删除仍停留在接口管理路径', async () => {
    mockedApi.put.mockResolvedValueOnce({ id: 1 });
    mockedApi.delete.mockResolvedValueOnce(undefined);

    await updateSystemInterfaceStatus(1, false);
    await deleteSystemInterface(1);

    expect(mockedApi.put).toHaveBeenCalledWith('/system/interfaces/1/status', undefined, { params: { enabled: false } });
    expect(mockedApi.delete).toHaveBeenCalledWith('/system/interfaces/1');
  });

  it('配置校验端点不提供同步执行能力', async () => {
    mockedApi.post.mockResolvedValueOnce({ valid: true, configOnly: true });

    await testSystemInterfaceConfig(1);

    expect(mockedApi.post).toHaveBeenCalledWith('/system/interfaces/1/test');
  });
});
