import { beforeEach, describe, expect, it, vi } from 'vitest';
import { api } from '../app/utils/api';
import { listUserManagement } from '../api/userManagement';

vi.mock('../app/utils/api', () => ({
  api: {
    get: vi.fn(),
  },
}));

const mockedApi = vi.mocked(api);

describe('userManagement API wrapper', () => {
  beforeEach(() => vi.clearAllMocks());

  it('使用 /user-management/list 分页查询并传递 keyword', async () => {
    mockedApi.get.mockResolvedValueOnce({ records: [], total: 0, size: 20, current: 2, pages: 0 });

    await listUserManagement({ page: 2, pageSize: 20, keyword: '  管理员  ' });

    expect(mockedApi.get).toHaveBeenCalledWith('/user-management/list', {
      params: { page: 2, pageSize: 20, keyword: '管理员' },
    });
  });

  it('空 keyword 不传给后端，保持只读默认分页', async () => {
    mockedApi.get.mockResolvedValueOnce({ records: [], total: 0, size: 50, current: 1, pages: 0 });

    await listUserManagement({ keyword: '   ' });

    expect(mockedApi.get).toHaveBeenCalledWith('/user-management/list', {
      params: { page: 1, pageSize: 50 },
    });
  });
});
