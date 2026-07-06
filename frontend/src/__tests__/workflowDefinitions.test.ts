import { beforeEach, describe, expect, it, vi } from 'vitest';
import { api } from '../app/utils/api';
import { getWorkflowDefinition, listWorkflowDefinitions } from '../api/workflowDefinitions';

vi.mock('../app/utils/api', () => ({
  api: {
    get: vi.fn(),
  },
}));

const mockedApi = vi.mocked(api);

describe('workflowDefinitions API wrapper', () => {
  beforeEach(() => vi.clearAllMocks());

  it('使用 /workflows 读取流程模板目录', async () => {
    mockedApi.get.mockResolvedValueOnce([{ businessType: 'ASSET_TRANSFER', name: '资产转移流程' }]);

    const result = await listWorkflowDefinitions();

    expect(mockedApi.get).toHaveBeenCalledWith('/workflows');
    expect(result).toEqual([{ businessType: 'ASSET_TRANSFER', name: '资产转移流程' }]);
  });

  it('使用 /workflows/{businessType} 读取单个流程摘要', async () => {
    mockedApi.get.mockResolvedValueOnce({ businessType: 'ASSET_SCRAP', name: '资产报废转让流程' });

    const result = await getWorkflowDefinition('ASSET_SCRAP');

    expect(mockedApi.get).toHaveBeenCalledWith('/workflows/ASSET_SCRAP');
    expect(result).toEqual({ businessType: 'ASSET_SCRAP', name: '资产报废转让流程' });
  });
});
