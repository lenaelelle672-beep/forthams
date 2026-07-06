import { beforeEach, describe, expect, it, vi } from 'vitest';
import { api } from '../app/utils/api';
import { getDeptTree, listDepts } from '../api/depts';

vi.mock('../app/utils/api', () => ({
  api: {
    get: vi.fn(),
  },
}));

const mockedApi = vi.mocked(api);

describe('depts API wrapper', () => {
  beforeEach(() => vi.clearAllMocks());

  it('使用 /depts/list 查询部门列表并传递 keyword', async () => {
    mockedApi.get.mockResolvedValueOnce([{ id: 1, dept_name: '研发部', dept_code: 'RD' }]);

    const result = await listDepts({ keyword: '  研发  ' });

    expect(mockedApi.get).toHaveBeenCalledWith('/depts/list', {
      params: { keyword: '研发' },
    });
    expect(result).toEqual([{ id: 1, dept_name: '研发部', dept_code: 'RD' }]);
  });

  it('空 keyword 不传给 /depts/list', async () => {
    mockedApi.get.mockResolvedValueOnce([]);

    await listDepts({ keyword: '   ' });

    expect(mockedApi.get).toHaveBeenCalledWith('/depts/list', {
      params: {},
    });
  });

  it('使用 /depts/tree 读取部门树摘要', async () => {
    mockedApi.get.mockResolvedValueOnce([{ id: 2, name: '总公司', parentId: 0 }]);

    const result = await getDeptTree();

    expect(mockedApi.get).toHaveBeenCalledWith('/depts/tree');
    expect(result).toEqual([{ id: 2, name: '总公司', parentId: 0 }]);
  });
});
