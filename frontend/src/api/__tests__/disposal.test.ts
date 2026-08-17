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
  buildClearanceDisposalReason,
  buildScrapDisposalReason,
  buildTransferDisposalReason,
  createCompensation,
  getCompensationDetail,
  getCompensationList,
  getDisposalDetail,
  getDisposalList,
  getDisposalStats,
  isDisposalResubmissionStatus,
  submitCompensationApplications,
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

  const compensationResponse = {
    id: 9,
    compensationNo: 'CMP-20260609-001',
    assetId: 8,
    compensationType: 'cash',
    compensationAmount: 100,
    description: '资产损坏赔偿',
    incidentDate: '2026-06-09',
    responsibleUserId: 6,
    responsibleDeptId: 2,
    status: 'PENDING',
    createTime: '2026-06-09T10:00:00',
  };

  it('maps disposal application endpoints and direct unwrapped responses', async () => {
    mockedHttp.get
      .mockResolvedValueOnce({
        records: [{ id: 1, applicationNo: 'DSP-001', assetId: 8, assetNo: 'AMS-001', assetName: '打印机', disposalType: 'TRANSFER', status: 'PENDING', reason: '调拨', applicantName: '张三', createTime: '2026-06-09' }],
        total: 1,
        size: 10,
        current: 2,
      })
      .mockResolvedValueOnce({
        id: 1,
        applicationNo: 'DSP-001',
        assetId: 8,
        assetNo: 'AMS-001',
        assetName: '打印机',
        disposalType: 'TRANSFER',
        status: 'PENDING',
        reason: '调拨',
        applicantName: '张三',
        createTime: '2026-06-09',
      })
      .mockResolvedValueOnce({
        thisMonthCount: 2,
        previousMonthCount: 1,
        pendingCount: 1,
        approvedCount: 1,
      });

    await expect(getDisposalList({ page: 2, pageSize: 10, type: 'TRANSFER', status: 'PENDING' })).resolves.toEqual({
      records: [
        {
          id: 1,
          assetId: 8,
          assetNo: 'AMS-001',
          assetName: '打印机',
          applicationNo: 'DSP-001',
          type: 'TRANSFER',
          status: 'PENDING',
          reason: '调拨',
          applicantName: '张三',
          createdAt: '2026-06-09',
        },
      ],
      total: 1,
      size: 10,
      current: 2,
    });
    await expect(getDisposalDetail(1)).resolves.toMatchObject({
      id: 1,
      assetId: 8,
      assetNo: 'AMS-001',
      type: 'TRANSFER',
    });
    await expect(getDisposalStats()).resolves.toEqual({
      totalThisMonth: 2,
      monthOverMonthDelta: 1,
      pendingCount: 1,
      completedCount: 1,
      recoveredValue: 0,
    });

    expect(mockedHttp.get).toHaveBeenNthCalledWith(1, '/disposals', {
      params: { page: 2, pageSize: 10, disposalType: 'TRANSFER', status: 'PENDING' },
    });
    expect(mockedHttp.get).toHaveBeenNthCalledWith(2, '/disposals/1');
    expect(mockedHttp.get).toHaveBeenNthCalledWith(3, '/disposals/statistics');
  });

  it('keeps cancelled-requires-resubmission rows without failing the whole list', async () => {
    mockedHttp.get.mockResolvedValueOnce({
      records: [
        {
          id: 2,
          applicationNo: 'DSP-002',
          assetId: 9,
          assetNo: 'AMS-002',
          assetName: '显示器',
          disposalType: 'SCRAP',
          status: 'CANCELLED_REQUIRES_RESUBMISSION',
          reason: '处理人缺失',
          applicantName: '李四',
          createTime: '2026-06-10',
        },
        {
          id: 'bad',
          disposalType: 'UNKNOWN',
          status: 'BROKEN',
        },
      ],
      total: 2,
      size: 10,
      current: 1,
    });

    await expect(getDisposalList()).resolves.toMatchObject({
      records: [
        {
          id: 2,
          type: 'SCRAP',
          status: 'CANCELLED_REQUIRES_RESUBMISSION',
          reason: '处理人缺失',
        },
      ],
      total: 2,
    });
    expect(isDisposalResubmissionStatus('CANCELLED_REQUIRES_RESUBMISSION')).toBe(true);
  });

  it('safely maps actual compensation DTO fields from unwrapped unknown responses', async () => {
    mockedHttp.get
      .mockResolvedValueOnce({ records: [compensationResponse], total: 1, size: 20, current: 1 })
      .mockResolvedValueOnce(compensationResponse);
    mockedHttp.post.mockResolvedValue(compensationResponse);
    mockedHttp.put.mockResolvedValue(compensationResponse);

    await expect(getCompensationList({ page: 1, pageSize: 20 })).resolves.toEqual({
      records: [compensationResponse],
      total: 1,
      size: 20,
      current: 1,
    });
    await expect(getCompensationDetail(9)).resolves.toEqual(compensationResponse);
    await expect(createCompensation({
      assetId: 8,
      compensationType: 'cash',
      compensationAmount: 100,
      description: '资产损坏赔偿',
      incidentDate: '2026-06-09',
      responsibleUserId: 6,
    })).resolves.toEqual(compensationResponse);
    await expect(updateCompensation(9, { description: '更新说明' })).resolves.toEqual(compensationResponse);

    expect(mockedHttp.get).toHaveBeenCalledWith('/compensation', { params: { page: 1, pageSize: 20 } });
    expect(mockedHttp.get).toHaveBeenCalledWith('/compensation/9');
    expect(mockedHttp.post).toHaveBeenCalledWith('/compensation', expect.objectContaining({
      assetId: 8,
      responsibleUserId: 6,
      description: '资产损坏赔偿',
    }));
    expect(mockedHttp.put).toHaveBeenCalledWith('/compensation/9', { description: '更新说明' });
  });

  it('rejects malformed unknown compensation records instead of coercing them', async () => {
    mockedHttp.get.mockResolvedValue({
      records: [{ ...compensationResponse, compensationNo: null }],
      total: 1,
      size: 20,
      current: 1,
    });

    await expect(getCompensationList()).resolves.toEqual({
      records: [],
      total: 1,
      size: 20,
      current: 1,
    });
  });

  it('uses only business endpoints without ApiResponse wrapping', async () => {
    mockedHttp.post.mockResolvedValue({});

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

    expect(mockedHttp.post).toHaveBeenNthCalledWith(1, '/disposals/scrap', expect.objectContaining({ assetId: 8 }));
    expect(mockedHttp.post).toHaveBeenNthCalledWith(2, '/disposals/clearance', expect.objectContaining({ assetId: 8 }));
    expect(mockedHttp.post).toHaveBeenNthCalledWith(3, '/disposals/transfer', expect.objectContaining({
      assetId: 8,
      targetDeptId: 2,
      targetLocation: undefined,
    }));
    expect(mockedHttp.post).not.toHaveBeenCalledWith('/approvals', expect.anything());
  });

  it('reports each asset result when a multi-asset submission partially succeeds', async () => {
    mockedHttp.post
      .mockResolvedValueOnce({ id: 101 })
      .mockRejectedValueOnce(new Error('asset is no longer eligible'));

    const result = await submitScrapApplication({
      assetIds: ['8', '9'],
      scrapDate: '2026-06-09',
      scrapReason: '损坏',
      disposalMethod: '回收',
      approvalFlow: 'default',
    });

    expect(result.successes).toEqual([{ assetId: 8, response: { id: 101 } }]);
    expect(result.failures).toHaveLength(1);
    expect(result.failures[0].assetId).toBe(9);
    expect(mockedHttp.post).toHaveBeenNthCalledWith(1, '/disposals/scrap', expect.objectContaining({ assetId: 8 }));
    expect(mockedHttp.post).toHaveBeenNthCalledWith(2, '/disposals/scrap', expect.objectContaining({ assetId: 9 }));
  });

  it('returns individual compensation successes and failures without resubmitting successful assets', async () => {
    mockedHttp.post
      .mockResolvedValueOnce(compensationResponse)
      .mockRejectedValueOnce(new Error('asset is no longer eligible'));

    const result = await submitCompensationApplications({
      compensationType: 'cash',
      description: '资产损坏赔偿',
      incidentDate: '2026-06-09',
      responsibleUserId: 6,
      responsibleDeptId: 2,
      assets: [
        { assetId: 8, compensationAmount: 100 },
        { assetId: 9, compensationAmount: 200 },
      ],
    });

    expect(result.successes).toEqual([{ assetId: 8, response: compensationResponse }]);
    expect(result.failures).toHaveLength(1);
    expect(result.failures[0].assetId).toBe(9);
    expect(mockedHttp.post).toHaveBeenNthCalledWith(1, '/compensation', expect.objectContaining({ assetId: 8, compensationAmount: 100 }));
    expect(mockedHttp.post).toHaveBeenNthCalledWith(2, '/compensation', expect.objectContaining({ assetId: 9, compensationAmount: 200 }));
  });

  it('rejects an empty compensation asset set before making a request', async () => {
    await expect(submitCompensationApplications({
      compensationType: 'cash',
      description: '资产损坏赔偿',
      responsibleUserId: 6,
      assets: [],
    })).rejects.toThrow('请至少选择一项资产');

    expect(mockedHttp.post).not.toHaveBeenCalled();
  });

  it('rejects compensation amounts that do not match the backend decimal precision before requesting', async () => {
    await expect(createCompensation({
      assetId: 8,
      compensationType: 'cash',
      compensationAmount: 100000000,
      description: '资产损坏赔偿',
      responsibleUserId: 6,
    })).rejects.toThrow('赔偿金额最多 8 位整数和 2 位小数');
    await expect(submitCompensationApplications({
      compensationType: 'cash',
      description: '资产损坏赔偿',
      responsibleUserId: 6,
      assets: [{ assetId: 8, compensationAmount: 0.001 }],
    })).rejects.toThrow('赔偿金额最多 8 位整数和 2 位小数');

    expect(mockedHttp.post).not.toHaveBeenCalled();
  });

  it('rejects overlong composed disposal reasons before any batch request is sent', () => {
    const longRemark = 'a'.repeat(500);

    expect(() => buildScrapDisposalReason({
      scrapReason: '损坏',
      disposalMethod: '回收',
      remark: longRemark,
    })).toThrow('处置事由拼接后不能超过500个字符');
    expect(() => buildClearanceDisposalReason({
      clearanceReason: '闲置',
      disposalMethod: '清退',
      urgency: 'NORMAL',
      remark: longRemark,
    })).toThrow('处置事由拼接后不能超过500个字符');
    expect(() => buildTransferDisposalReason({
      transferType: '部门调拨',
      fromDept: '1',
      toDept: '2',
      priority: 'NORMAL',
      notes: longRemark,
    })).toThrow('处置事由拼接后不能超过500个字符');

    expect(mockedHttp.post).not.toHaveBeenCalled();
  });
});
