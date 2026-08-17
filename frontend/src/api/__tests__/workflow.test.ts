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
  workflowApi,
  type WorkflowDefinitionDTO,
  type WorkflowDefinitionVersionDTO,
  type WorkflowDesignerDraftDTO,
} from '@/api/workflow';

const mockedHttp = {
  get: vi.mocked(http.get),
  post: vi.mocked(http.post),
  put: vi.mocked(http.put),
  delete: vi.mocked(http.delete),
};

function workflowDefinition(overrides: Partial<WorkflowDefinitionDTO> = {}): WorkflowDefinitionDTO {
  return {
    id: 7,
    businessType: 'ASSET_TRANSFER',
    name: '资产转移流程',
    description: '测试流程',
    definition: { nodes: [], edges: [] },
    status: 'DRAFT',
    version: 0,
    draftRevision: 4,
    ...overrides,
  };
}

function workflowDesignerDraft(overrides: Partial<WorkflowDesignerDraftDTO> = {}): WorkflowDesignerDraftDTO {
  return {
    ...workflowDefinition(),
    revision: 6,
    publishedDefinitionId: null,
    publishedVersion: null,
    publishedStatus: null,
    ...overrides,
  };
}

function workflowVersion(overrides: Partial<WorkflowDefinitionVersionDTO> = {}): WorkflowDefinitionVersionDTO {
  return {
    id: 12,
    definitionId: 7,
    businessType: 'ASSET_TRANSFER',
    version: 2,
    actionType: 'PUBLISH',
    status: 'PUBLISHED',
    name: '资产转移流程',
    description: '测试流程',
    definition: { nodes: [], edges: [] },
    ...overrides,
  };
}

describe('api/workflow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
    localStorage.clear();
  });

  it('saves workflow drafts through the unified /workflows draft endpoint', async () => {
    sessionStorage.setItem('user_info', JSON.stringify({ userId: 88 }));
    mockedHttp.put.mockResolvedValueOnce(workflowDefinition());

    await workflowApi.saveDraft('ASSET_TRANSFER', {
      name: '资产转移流程',
      description: '测试流程',
      definition: { nodes: [], edges: [] },
      expectedRevision: 4,
    });

    expect(mockedHttp.put).toHaveBeenCalledWith('/workflows/ASSET_TRANSFER/draft', {
      name: '资产转移流程',
      description: '测试流程',
      definition: { nodes: [], edges: [] },
      expectedRevision: 4,
      operatorId: 88,
    });
  });

  it('creates custom workflow definitions through /workflows/custom', async () => {
    localStorage.setItem('user_info', JSON.stringify({ id: 7 }));
    mockedHttp.post.mockResolvedValueOnce(workflowDefinition({
      businessType: 'CUSTOM_PURCHASE_APPROVAL',
      name: '采购审批',
      description: '采购审批流程',
    }));

    await workflowApi.createCustomWorkflow('CUSTOM_PURCHASE_APPROVAL', '采购审批', '采购审批流程');

    expect(mockedHttp.post).toHaveBeenCalledWith('/workflows/custom', {
      businessType: 'CUSTOM_PURCHASE_APPROVAL',
      name: '采购审批',
      description: '采购审批流程',
      operatorId: 7,
    });
  });

  it('publishes and updates workflow status on the current business type', async () => {
    sessionStorage.setItem('user_info', JSON.stringify({ uid: 3 }));
    mockedHttp.post
      .mockResolvedValueOnce(workflowDefinition({ status: 'PUBLISHED', version: 1, draftRevision: null }))
      .mockResolvedValueOnce(workflowDefinition({ status: 'DISABLED', version: 1, draftRevision: null }));

    await workflowApi.publish('ASSET_TRANSFER', {
      expectedDraftRevision: 6,
      publishNote: '发布稳定版本',
      impactScope: '后续新发起审批',
      rollbackPlan: '回滚到上一版本',
    });
    await workflowApi.updateStatus('ASSET_TRANSFER', 'DISABLED');

    expect(mockedHttp.post).toHaveBeenNthCalledWith(1, '/workflows/ASSET_TRANSFER/publish', {
      confirmed: true,
      expectedDraftRevision: 6,
      publishNote: '发布稳定版本',
      impactScope: '后续新发起审批',
      rollbackPlan: '回滚到上一版本',
      operatorId: 3,
    });
    expect(mockedHttp.post).toHaveBeenNthCalledWith(2, '/workflows/ASSET_TRANSFER/status', {
      status: 'DISABLED',
      operatorId: 3,
    });
  });

  it('fetches applicant-facing workflow start availability from runtime endpoint', async () => {
    mockedHttp.get.mockResolvedValueOnce({
      businessType: 'ASSET_TRANSFER',
      canStart: true,
      status: 'PUBLISHED',
      version: 3,
      definitionId: 7,
      entryUrl: '/disposals/transfer/new',
      blockReason: '',
    });

    await workflowApi.getStartAvailability('ASSET_TRANSFER');

    expect(mockedHttp.get).toHaveBeenCalledWith('/workflow-runtime/ASSET_TRANSFER/start-availability');
  });

  it('previews applicant-facing assignees from runtime endpoint without definition payload', async () => {
    mockedHttp.post.mockResolvedValueOnce({
      businessType: 'ASSET_TRANSFER',
      calculable: true,
      missingFields: [],
      nodes: [],
    });

    await workflowApi.previewRuntimeAssignees('ASSET_TRANSFER', {
      businessData: { toDept: '2', targetDeptId: '2' },
      currentStep: 2,
    });

    expect(mockedHttp.post).toHaveBeenCalledWith('/workflow-runtime/ASSET_TRANSFER/assignees/preview', {
      businessData: { toDept: '2', targetDeptId: '2' },
      currentStep: 2,
    });
  });

  it('uses immutable workflow version history endpoints', async () => {
    sessionStorage.setItem('user_info', JSON.stringify({ userId: 5 }));
    mockedHttp.get.mockResolvedValueOnce([
      workflowVersion(),
    ]);
    mockedHttp.get.mockResolvedValueOnce(workflowVersion({ version: 1 }));
    mockedHttp.post.mockResolvedValueOnce(workflowDefinition({ status: 'PUBLISHED', version: 3, draftRevision: null }));

    await workflowApi.listVersions('ASSET_TRANSFER');
    await workflowApi.getVersion('ASSET_TRANSFER', 1);
    await workflowApi.rollback('ASSET_TRANSFER', 1, {
      expectedDraftRevision: 6,
      expectedPublishedVersion: 2,
      reason: '恢复稳定版本',
      impactScope: '后续新发起审批',
      rollbackPlan: '必要时回滚到 v2',
    });

    expect(mockedHttp.get).toHaveBeenNthCalledWith(1, '/workflows/ASSET_TRANSFER/versions');
    expect(mockedHttp.get).toHaveBeenNthCalledWith(2, '/workflows/ASSET_TRANSFER/versions/1');
    expect(mockedHttp.post).toHaveBeenCalledWith('/workflows/ASSET_TRANSFER/versions/1/rollback', {
      confirmed: true,
      expectedDraftRevision: 6,
      expectedPublishedVersion: 2,
      reason: '恢复稳定版本',
      impactScope: '后续新发起审批',
      rollbackPlan: '必要时回滚到 v2',
      operatorId: 5,
    });
  });

  it('reads the reviewable designer draft revision separately from the published version', async () => {
    mockedHttp.get.mockResolvedValueOnce(workflowDesignerDraft({
      version: 3,
      publishedVersion: 2,
    }));

    await workflowApi.getDesignerDraft('ASSET_TRANSFER');

    expect(mockedHttp.get).toHaveBeenCalledWith('/workflows/ASSET_TRANSFER/designer');
  });

  it('rejects malformed workflow DTOs instead of trusting the Axios generic', async () => {
    mockedHttp.get.mockResolvedValueOnce({
      ...workflowDefinition(),
      version: '1',
    });

    await expect(workflowApi.get('ASSET_TRANSFER')).rejects.toThrow('流程定义响应中的version无效');
  });
});
