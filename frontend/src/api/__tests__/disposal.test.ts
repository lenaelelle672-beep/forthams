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
  createCompensation,
  getCompensationDetail,
  getCompensationList,
  getDisposalDetail,
  getDisposalList,
  getDisposalStats,
  submitClearanceApplication,
  submitScrapApplication,
  submitTransferApplication,
  updateCompensation,
} from '@/api/disposal';

const mockedHttp = {
  get: vi.mocked(http.get),
  post: vi.mocked(http.post),
  put: vi.mocked(http.put),
  delete: vi.mocked(http.delete),
};

describe('api/disposal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('maps retirement-backed disposal endpoints and direct unwrapped responses', async () => {
    mockedHttp.get
      .mockResolvedValueOnce({
        records: [{ id: 1, assetId: 8, assetNo: 'AMS-001', assetName: '打印机', status: 'PENDING', reason: '清退' }],
        total: 1,
      })
      .mockResolvedValueOnce({
        id: 1,
        assetId: 8,
        assetCode: 'AMS-001',
        assetName: '打印机',
        status: 'PENDING',
        reason: '清退',
        createTime: '2026-06-09',
      })
      .mockResolvedValueOnce({
        thisMonthCount: 2,
        pendingCount: 1,
        approvedCount: 1,
        completedCount: 1,
      });

    await expect(getDisposalList({ page: 2, pageSize: 10, status: 'PENDING' })).resolves.toEqual({
      records: [
        {
          id: 1,
          assetId: 8,
          assetNo: 'AMS-001',
          assetName: '打印机',
          type: 'CLEARANCE',
          status: 'PENDING',
          reason: '清退',
          applicantName: undefined,
          createdAt: undefined,
        },
      ],
      total: 1,
    });
    await expect(getDisposalDetail(1)).resolves.toMatchObject({
      id: 1,
      assetId: 8,
      assetNo: 'AMS-001',
      type: 'CLEARANCE',
    });
    await expect(getDisposalStats()).resolves.toEqual({
      totalThisMonth: 2,
      monthOverMonthDelta: 0,
      pendingCount: 1,
      completedCount: 2,
      recoveredValue: 0,
    });

    expect(mockedHttp.get).toHaveBeenNthCalledWith(1, '/retirement/list', {
      params: { page: 2, pageSize: 10, status: 'PENDING' },
    });
    expect(mockedHttp.get).toHaveBeenNthCalledWith(2, '/retirement/1');
    expect(mockedHttp.get).toHaveBeenNthCalledWith(3, '/retirement/statistics');
  });

  it('uses compensation and approval workflow paths without ApiResponse wrapping', async () => {
    mockedHttp.get.mockResolvedValue({});
    mockedHttp.post.mockResolvedValue({});
    mockedHttp.put.mockResolvedValue({});

    await getCompensationList({ page: 1, pageSize: 20 });
    await getCompensationDetail(9);
    await createCompensation({ assetId: 8, compensationAmount: 100, incidentDate: '2026-06-09' });
    await updateCompensation(9, { description: '更新说明' });
    await submitScrapApplication({
      assetIds: ['8'],
      scrapDate: '2026-06-09',
      scrapReason: '损坏',
      disposalMethod: '回收',
      approvalFlow: 'default',
    });
    await submitClearanceApplication({
      assetIds: ['8'],
      clearanceReason: '闲置',
      disposalMethod: '清退',
      approvalFlow: 'default',
      urgency: 'NORMAL',
      applicationDate: '2026-06-09',
    });
    await submitTransferApplication({
      assetIds: ['8'],
      transferType: '部门调拨',
      fromDept: '1',
      toDept: '2',
      expectedWorkflowDefinitionId: 7,
      expectedWorkflowVersion: 3,
      priority: 'NORMAL',
    });

    expect(mockedHttp.get).toHaveBeenCalledWith('/compensation', { params: { page: 1, pageSize: 20 } });
    expect(mockedHttp.get).toHaveBeenCalledWith('/compensation/9');
    expect(mockedHttp.post).toHaveBeenNthCalledWith(1, '/approvals', expect.objectContaining({ processType: 'ASSET_COMPENSATION' }));
    expect(mockedHttp.put).toHaveBeenCalledWith('/compensation/9', { description: '更新说明' });
    expect(mockedHttp.post).toHaveBeenNthCalledWith(2, '/approvals', expect.objectContaining({ processType: 'ASSET_SCRAP' }));
    expect(mockedHttp.post).toHaveBeenNthCalledWith(3, '/approvals', expect.objectContaining({ processType: 'ASSET_CLEARANCE' }));
    expect(mockedHttp.post).toHaveBeenNthCalledWith(4, '/approvals', expect.objectContaining({
      processType: 'ASSET_TRANSFER',
      expectedWorkflowDefinitionId: 7,
      expectedWorkflowVersion: 3,
      description: expect.stringContaining('发布流程：ASSET_TRANSFER v3'),
    }));
  });
});
