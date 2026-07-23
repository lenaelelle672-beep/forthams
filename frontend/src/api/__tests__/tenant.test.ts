import { beforeEach, describe, expect, it, vi } from 'vitest';
import { api } from '../../app/utils/api';
import {
  getCurrentTenant,
  getTenantDetail,
  getTenantMeta,
  listTenants,
} from '@/api/tenant';

vi.mock('../../app/utils/api', () => ({
  api: {
    get: vi.fn(),
  },
}));

const mockedApi = vi.mocked(api);

describe('api/tenant（只读 catalog）', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('listTenants 调用 /tenants 并透传查询参数', async () => {
    mockedApi.get.mockResolvedValue({ records: [], total: 0 });

    await listTenants({ page: 1, pageSize: 20, keyword: 'T00', status: 'ACTIVE' });

    expect(mockedApi.get).toHaveBeenCalledWith('/tenants', {
      params: { page: 1, pageSize: 20, keyword: 'T00', status: 'ACTIVE' },
    });
  });

  it('getCurrentTenant 调用 /tenants/current', async () => {
    mockedApi.get.mockResolvedValue({ id: 'T001', name: '默认租户' });

    const result = await getCurrentTenant();

    expect(mockedApi.get).toHaveBeenCalledWith('/tenants/current');
    expect(result.id).toBe('T001');
  });

  it('getTenantDetail 调用 /tenants/{id}', async () => {
    mockedApi.get.mockResolvedValue({ id: 'T002' });

    await getTenantDetail('T002');

    expect(mockedApi.get).toHaveBeenCalledWith('/tenants/T002');
  });

  it('getTenantMeta 调用 /tenants/meta', async () => {
    mockedApi.get.mockResolvedValue({ plans: ['STANDARD'], statuses: ['ACTIVE'], readOnlyNotice: '只读' });

    await getTenantMeta();

    expect(mockedApi.get).toHaveBeenCalledWith('/tenants/meta');
  });
});
