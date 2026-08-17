import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/utils/http', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
}));

import http from '@/utils/http';
import {
  flowDesignerApi,
  type FlowDesignerDefinitionDTO,
  type FlowDesignerGraphDTO,
  type WorkflowDefinitionVersionDTO,
} from '@/api/flowDesigner';

const mockedHttp = {
  get: vi.mocked(http.get),
  post: vi.mocked(http.post),
  put: vi.mocked(http.put),
  delete: vi.mocked(http.delete),
};

const graph: FlowDesignerGraphDTO = {
  id: 'ASSET_TRANSFER',
  name: '资产转移流程',
  nodes: [
    { id: 'start', type: 'START', label: '开始' },
    { id: 'approval', type: 'APPROVAL', label: '审批' },
    { id: 'end', type: 'END', label: '结束' },
  ],
  edges: [
    { id: 'edge-start-approval', source: 'start', target: 'approval' },
    { id: 'edge-approval-end', source: 'approval', target: 'end' },
  ],
};

function flowDefinition(overrides: Partial<FlowDesignerDefinitionDTO> = {}): FlowDesignerDefinitionDTO {
  return {
    id: 7,
    businessType: 'ASSET_TRANSFER',
    name: '资产转移流程',
    description: '用于资产转移审批',
    definition: graph,
    status: 'DRAFT',
    version: 2,
    revision: 2,
    publishedDefinitionId: null,
    publishedVersion: null,
    publishedStatus: null,
    updatedBy: 88,
    publishedBy: null,
    publishedAt: null,
    updateTime: null,
    ...overrides,
  };
}

function workflowVersion(overrides: Partial<WorkflowDefinitionVersionDTO> = {}): WorkflowDefinitionVersionDTO {
  return {
    id: 9,
    definitionId: 7,
    businessType: 'ASSET_TRANSFER',
    version: 2,
    actionType: 'PUBLISH',
    status: 'PUBLISHED',
    name: '资产转移流程',
    description: '用于资产转移审批',
    definition: graph,
    ...overrides,
  };
}

describe('api/flowDesigner', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
    localStorage.clear();
  });

  it('uses real workflow designer draft and validation endpoints', async () => {
    sessionStorage.setItem('user_info', JSON.stringify({ userId: 88 }));
    mockedHttp.put.mockResolvedValueOnce(flowDefinition());
    mockedHttp.post.mockResolvedValueOnce({ valid: true, errors: [], warnings: [], nodeCount: 3, edgeCount: 2 });

    await flowDesignerApi.saveDraft('ASSET_TRANSFER', {
      name: '资产转移流程',
      description: '用于资产转移审批',
      graph,
      expectedRevision: 2,
    });
    await flowDesignerApi.validateGraph('ASSET_TRANSFER', graph);

    expect(mockedHttp.put).toHaveBeenCalledWith('/workflows/ASSET_TRANSFER/designer/draft', {
      name: '资产转移流程',
      description: '用于资产转移审批',
      graph,
      expectedRevision: 2,
      operatorId: 88,
    });
    expect(mockedHttp.post).toHaveBeenCalledWith('/workflows/ASSET_TRANSFER/designer/validate', graph);
  });

  it('uses confirmed publish and rollback endpoints with audit payload', async () => {
    localStorage.setItem('user_info', JSON.stringify({ id: 7 }));
    mockedHttp.post
      .mockResolvedValueOnce(flowDefinition({ status: 'PUBLISHED', version: 3, revision: null }))
      .mockResolvedValueOnce(flowDefinition({ status: 'PUBLISHED', version: 4, revision: null }));

    await flowDesignerApi.publish('ASSET_TRANSFER', {
      confirmed: true,
      expectedDraftRevision: 3,
      publishNote: '发布稳定版本',
      impactScope: '后续新发起审批',
      rollbackPlan: '恢复上一版本',
    });
    await flowDesignerApi.rollback('ASSET_TRANSFER', 2, {
      confirmed: true,
      expectedDraftRevision: 3,
      expectedPublishedVersion: 4,
      reason: '恢复稳定版本',
      impactScope: '后续新发起审批',
      rollbackPlan: '必要时回滚到 v3',
    });

    expect(mockedHttp.post).toHaveBeenNthCalledWith(1, '/workflows/ASSET_TRANSFER/publish', {
      confirmed: true,
      expectedDraftRevision: 3,
      publishNote: '发布稳定版本',
      impactScope: '后续新发起审批',
      rollbackPlan: '恢复上一版本',
      operatorId: 7,
    });
    expect(mockedHttp.post).toHaveBeenNthCalledWith(2, '/workflows/ASSET_TRANSFER/versions/2/rollback', {
      confirmed: true,
      expectedDraftRevision: 3,
      expectedPublishedVersion: 4,
      reason: '恢复稳定版本',
      impactScope: '后续新发起审批',
      rollbackPlan: '必要时回滚到 v3',
      operatorId: 7,
    });
  });

  it('fetches designer detail and immutable version history', async () => {
    mockedHttp.get
      .mockResolvedValueOnce([flowDefinition()])
      .mockResolvedValueOnce(flowDefinition())
      .mockResolvedValueOnce([workflowVersion()]);

    await flowDesignerApi.listDefinitions();
    await flowDesignerApi.getDesigner('ASSET_TRANSFER');
    await flowDesignerApi.listVersions('ASSET_TRANSFER');

    expect(mockedHttp.get).toHaveBeenNthCalledWith(1, '/workflows');
    expect(mockedHttp.get).toHaveBeenNthCalledWith(2, '/workflows/ASSET_TRANSFER/designer');
    expect(mockedHttp.get).toHaveBeenNthCalledWith(3, '/workflows/ASSET_TRANSFER/versions');
  });

  it('rejects malformed validation payloads instead of treating them as trusted DTOs', async () => {
    mockedHttp.post.mockResolvedValueOnce({
      valid: true,
      errors: 'not-an-array',
      warnings: [],
      nodeCount: 3,
      edgeCount: 2,
    });

    await expect(flowDesignerApi.validateGraph('ASSET_TRANSFER', graph)).rejects.toThrow('流程图校验响应中的errors响应格式无效');
  });
});
