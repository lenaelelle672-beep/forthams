import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/utils/http', () => ({
  default: {
    get: vi.fn(),
  },
}));

import http from '@/utils/http';
import {
  getCurrentTenant,
  getTenantDetail,
  getTenantMeta,
  listTenants,
} from '@/api/tenant';

const mockedHttp = vi.mocked(http);

describe('api/tenant（只读 catalog）', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('listTenants 调用 /tenants 并透传查询参数', async () => {
    mockedHttp.get.mockResolvedValue({ records: [], total: 0 });

    await listTenants({ page: 1, pageSize: 20, keyword: 'T00', status: 'ACTIVE' });

    expect(mockedHttp.get).toHaveBeenCalledWith('/tenants', {
      params: { page: 1, pageSize: 20, keyword: 'T00', status: 'ACTIVE' },
    });
  });

  it('getCurrentTenant 调用 /tenants/current', async () => {
    mockedHttp.get.mockResolvedValue({ id: 'T001', name: '默认租户' });

    const result = await getCurrentTenant();

    expect(mockedHttp.get).toHaveBeenCalledWith('/tenants/current');
    expect(result.id).toBe('T001');
  });

  it('getTenantDetail 调用 /tenants/{id}', async () => {
    mockedHttp.get.mockResolvedValue({ id: 'T002' });

    await getTenantDetail('T002');

    expect(mockedHttp.get).toHaveBeenCalledWith('/tenants/T002');
  });

  it('getTenantMeta 调用 /tenants/meta', async () => {
    mockedHttp.get.mockResolvedValue({ plans: ['STANDARD'], statuses: ['ACTIVE'], readOnlyNotice: '只读' });

    await getTenantMeta();

    expect(mockedHttp.get).toHaveBeenCalledWith('/tenants/meta');
  });
});
