import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/utils/http', () => ({
  default: {
    get: vi.fn(),
  },
}));

import http from '@/utils/http';
import {
  getAssetAuditLogs,
  getAuditActionTypeDistribution,
  getAuditLogDetail,
  getAuditLogs,
  getAuditMeta,
  getAuditOperatorRanking,
  getAuditStats,
  getAuditTrends,
} from '@/api/audit';

const mockedHttp = vi.mocked(http);

describe('api/audit', () => {
  beforeEach(() => vi.clearAllMocks());

  it('只封装 /audit-logs GET 只读端点并归一分页参数', async () => {
    mockedHttp.get
      .mockResolvedValueOnce({ records: [rawLog()], total: 1, size: 20, current: 1 })
      .mockResolvedValueOnce(rawLog())
      .mockResolvedValueOnce({ totalCount: 1, trendData: [], typeDistribution: [], topOperators: [] })
      .mockResolvedValueOnce({ granularity: 'daily', data: [] })
      .mockResolvedValueOnce({ totalOperations: 1, distribution: [] })
      .mockResolvedValueOnce([{ rank: 1, operatorName: '管理员', count: 1 }])
      .mockResolvedValueOnce({ operationTypes: ['UPDATE'], resourceTypes: ['ASSET'], operators: ['管理员'], tenantScoped: true, masked: true, readonlyBoundary: 'GET-only' })
      .mockResolvedValueOnce({ records: [], total: 0, size: 20, current: 1 });

    const list = await getAuditLogs({ page: 2, pageSize: 20, keyword: '资产', operationType: 'UPDATE' });
    const detail = await getAuditLogDetail(7);
    await getAuditStats({ operationType: 'UPDATE' });
    await getAuditTrends({ granularity: 'daily' });
    await getAuditActionTypeDistribution({});
    await getAuditOperatorRanking({ limit: 10 });
    await getAuditMeta();
    await getAssetAuditLogs(1001, { page: 1, pageSize: 20 });

    expect(mockedHttp.get).toHaveBeenNthCalledWith(1, '/audit-logs', { params: { page: 2, size: 20, pageSize: undefined, keyword: '资产', operationType: 'UPDATE' } });
    expect(mockedHttp.get).toHaveBeenNthCalledWith(2, '/audit-logs/7');
    expect(mockedHttp.get).toHaveBeenNthCalledWith(3, '/audit-logs/stats', { params: { operationType: 'UPDATE' } });
    expect(mockedHttp.get).toHaveBeenNthCalledWith(4, '/audit-logs/trends', { params: { granularity: 'daily' } });
    expect(mockedHttp.get).toHaveBeenNthCalledWith(5, '/audit-logs/action-type-distribution', { params: {} });
    expect(mockedHttp.get).toHaveBeenNthCalledWith(6, '/audit-logs/operator-ranking', { params: { limit: 10 } });
    expect(mockedHttp.get).toHaveBeenNthCalledWith(7, '/audit-logs/meta');
    expect(mockedHttp.get).toHaveBeenNthCalledWith(8, '/audit-logs', { params: { page: 1, size: 20, pageSize: undefined, resourceType: 'ASSET', resourceId: '1001' } });
    expect(list.records[0]).not.toHaveProperty('raw');
    expect(detail.rawPayloadSummary).toContain('token=******');
    expect(JSON.stringify(mockedHttp.get.mock.calls)).not.toMatch(/post|put|patch|delete|Blob|createObjectURL|downloadUrl|export/);
  });

  it('响应标准化只暴露脱敏摘要，不透传 raw payload', async () => {
    mockedHttp.get.mockResolvedValueOnce({ records: [rawLog()], total: 1, size: 20, current: 1 });

    const page = await getAuditLogs();
    const item = page.records[0];

    expect(item.operationType).toBe('UPDATE');
    expect(item.resourceId).toBe('AS****01');
    expect(item.beforeRecordSummary).toContain('******');
    expect(item.rawPayloadSummary).toContain('token=******');
    expect(JSON.stringify(item)).not.toContain(rawSecret());
  });

  function rawLog() {
    return {
      id: 7,
      operationType: 'UPDATE',
      operatorName: '管理员',
      resourceType: 'ASSET',
      resourceId: 'AS****01',
      requestUri: '/assets?query=redacted',
      ipAddress: '10.2.*.*',
      userAgent: 'Browser credential=******',
      beforeRecordSummary: '{"password":"******"}',
      afterRecordSummary: '{"name":"资产A"}',
      rawPayloadSummary: 'payload(length=10, sha256=abc, preview=token=******)',
      createdAt: '2026-07-07T12:00:00',
      raw: { token: rawSecret() },
      masked: true,
      tenantScoped: true,
    };
  }

  function rawSecret() {
    return 'raw-audit-secret';
  }
});
