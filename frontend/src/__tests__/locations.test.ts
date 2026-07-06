import { beforeEach, describe, expect, it, vi } from 'vitest';
import { api } from '../app/utils/api';
import { listLocations, listRootLocations } from '../api/locations';

vi.mock('../app/utils/api', () => ({
  api: {
    get: vi.fn(),
  },
}));

const mockedApi = vi.mocked(api);

describe('locations API wrapper', () => {
  beforeEach(() => vi.clearAllMocks());

  it('只通过 /locations/list 读取位置列表', async () => {
    mockedApi.get.mockResolvedValueOnce([{ id: 1, name: '华东仓库', locationCode: 'LOC-001' }]);

    const result = await listLocations();

    expect(mockedApi.get).toHaveBeenCalledWith('/locations/list');
    expect(result).toEqual([{ id: 1, name: '华东仓库', locationCode: 'LOC-001' }]);
  });

  it('只通过 /locations/root 读取根位置摘要', async () => {
    mockedApi.get.mockResolvedValueOnce([{ id: 2, name: '总部', locationCode: 'ROOT' }]);

    const result = await listRootLocations();

    expect(mockedApi.get).toHaveBeenCalledWith('/locations/root');
    expect(result).toEqual([{ id: 2, name: '总部', locationCode: 'ROOT' }]);
  });
});
