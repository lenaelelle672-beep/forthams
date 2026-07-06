import { beforeEach, describe, expect, it, vi } from 'vitest';
import { api } from '../app/utils/api';
import { getRolePermissionCatalog } from '../api/rolePermissions';

vi.mock('../app/utils/api', () => ({
  api: {
    get: vi.fn(),
  },
}));

const mockedApi = vi.mocked(api);

describe('rolePermissions API wrapper', () => {
  beforeEach(() => vi.clearAllMocks());

  it('只访问角色权限只读目录 GET 契约', async () => {
    mockedApi.get.mockResolvedValueOnce({ roles: [], permissions: [], summary: {}, riskTips: [] });

    await getRolePermissionCatalog();

    expect(mockedApi.get).toHaveBeenCalledWith('/system/role-permissions/catalog');
  });

  it('wrapper 不包含写入方法或其它权限路径', () => {
    expect(getRolePermissionCatalog.toString()).not.toMatch(/api\.(post|put|delete|patch)/);
    expect(getRolePermissionCatalog.toString()).not.toContain('/roles/list');
    expect(getRolePermissionCatalog.toString()).not.toContain('/settings');
  });
});
