import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/utils/http', () => ({
  default: {
    get: vi.fn(),
    put: vi.fn(),
    post: vi.fn(),
  },
}));

import http from '@/utils/http';
import { roleApi, workflowApi, type WorkflowDefinitionDTO } from '@/api/workflow';

const mockedHttp = vi.mocked(http);

function workflow(overrides: Partial<WorkflowDefinitionDTO> = {}): WorkflowDefinitionDTO {
  return {
    id: 1,
    businessType: 'ASSET_TRANSFER',
    name: '资产转移流程',
    description: '用于资产转移审批',
    definition: { nodes: [], edges: [] },
    status: 'DRAFT',
    version: 0,
    ...overrides,
  };
}

describe('api/workflow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.sessionStorage.clear();
    window.localStorage.clear();
  });

  it('unwraps backend Result envelope for workflow list', async () => {
    mockedHttp.get.mockResolvedValueOnce({
      code: 200,
      message: '操作成功',
      data: [workflow()],
    });

    const result = await workflowApi.list();

    expect(mockedHttp.get).toHaveBeenCalledWith('/workflows');
    expect(result).toHaveLength(1);
    expect(result[0].status).toBe('DRAFT');
  });

  it('unwraps saved draft data so designer can update server status and version', async () => {
    window.sessionStorage.setItem('user_info', JSON.stringify({ id: 88 }));
    mockedHttp.put.mockResolvedValueOnce({
      code: 200,
      message: '操作成功',
      data: workflow({ status: 'DRAFT', version: 2 }),
    });

    const result = await workflowApi.saveDraft('ASSET_TRANSFER', {
      name: '资产转移流程',
      description: '用于资产转移审批',
      definition: { nodes: [], edges: [] },
    });

    expect(mockedHttp.put).toHaveBeenCalledWith('/workflows/ASSET_TRANSFER/draft', {
      name: '资产转移流程',
      description: '用于资产转移审批',
      definition: { nodes: [], edges: [] },
      operatorId: 88,
    });
    expect(result.status).toBe('DRAFT');
    expect(result.version).toBe(2);
  });

  it('keeps compatibility with already-unwrapped role responses', async () => {
    mockedHttp.get.mockResolvedValueOnce([
      { id: 1, roleCode: 'SUPER_ADMIN', roleName: '超级管理员' },
    ]);

    const result = await roleApi.getAll();

    expect(result[0].roleCode).toBe('SUPER_ADMIN');
  });
});
