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
import { workflowApi } from '@/api/workflow';

const mockedHttp = vi.mocked(http);

describe('api/workflow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
    localStorage.clear();
  });

  it('saves workflow drafts through the unified /workflows draft endpoint', async () => {
    sessionStorage.setItem('user_info', JSON.stringify({ userId: 88 }));
    mockedHttp.put.mockResolvedValueOnce({
      businessType: 'ASSET_TRANSFER',
      name: '资产转移流程',
      description: '测试流程',
      definition: {},
      status: 'DRAFT',
      version: 0,
    });

    await workflowApi.saveDraft('ASSET_TRANSFER', {
      name: '资产转移流程',
      description: '测试流程',
      definition: { nodes: [], edges: [] },
    });

    expect(mockedHttp.put).toHaveBeenCalledWith('/workflows/ASSET_TRANSFER/draft', {
      name: '资产转移流程',
      description: '测试流程',
      definition: { nodes: [], edges: [] },
      operatorId: 88,
    });
  });

  it('creates custom workflow definitions through /workflows/custom', async () => {
    localStorage.setItem('user_info', JSON.stringify({ id: 7 }));
    mockedHttp.post.mockResolvedValueOnce({
      businessType: 'CUSTOM_PURCHASE_APPROVAL',
      name: '采购审批',
      description: '采购审批流程',
      definition: {},
      status: 'DRAFT',
      version: 0,
    });

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
    mockedHttp.post.mockResolvedValue({});

    await workflowApi.publish('ASSET_TRANSFER');
    await workflowApi.updateStatus('ASSET_TRANSFER', 'DISABLED');

    expect(mockedHttp.post).toHaveBeenNthCalledWith(1, '/workflows/ASSET_TRANSFER/publish', {
      operatorId: 3,
    });
    expect(mockedHttp.post).toHaveBeenNthCalledWith(2, '/workflows/ASSET_TRANSFER/status', {
      status: 'DISABLED',
      operatorId: 3,
    });
  });
});
