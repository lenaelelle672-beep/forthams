import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/utils/http', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
  },
}));

import http from '@/utils/http';
import {
  activateTenant,
  createTenant,
  getCurrentTenant,
  listTenants,
  suspendTenant,
  updateTenant,
} from '@/api/tenant';

const mockedHttp = vi.mocked(http);

describe('api/tenant', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('uses unified tenant paths and relies on the shared http unwrapping contract', async () => {
    const payload = {
      id: 'dept:1',
      name: '默认租户',
      plan: 'PRO',
      maxUsers: 100,
      maxAssets: 1000,
      contactName: 'Admin',
      contactPhone: '13800000000',
      contactEmail: 'admin@example.com',
    };

    mockedHttp.get.mockResolvedValue({});
    mockedHttp.post.mockResolvedValue({});
    mockedHttp.put.mockResolvedValue(undefined);

    await listTenants({ pageSize: 100 });
    await getCurrentTenant();
    await createTenant(payload);
    await updateTenant('dept:1', payload);
    await suspendTenant('dept:1');
    await activateTenant('dept:1');

    expect(mockedHttp.get).toHaveBeenCalledWith('/tenants', { params: { pageSize: 100 } });
    expect(mockedHttp.get).toHaveBeenCalledWith('/tenants/current');
    expect(mockedHttp.post).toHaveBeenCalledWith('/tenants', payload);
    expect(mockedHttp.put).toHaveBeenNthCalledWith(1, '/tenants/dept:1', payload);
    expect(mockedHttp.put).toHaveBeenNthCalledWith(2, '/tenants/dept:1/suspend');
    expect(mockedHttp.put).toHaveBeenNthCalledWith(3, '/tenants/dept:1/activate');
  });
});
