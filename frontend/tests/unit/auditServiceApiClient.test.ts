import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  fetchAuditDetail,
  fetchAuditLogList,
  fetchAuditLogMeta,
  fetchAuditLogTrend,
} from '../../src/app/services/auditService';
import { api } from '../../src/app/utils/api';

vi.mock('../../src/app/utils/api', () => ({
  api: {
    get: vi.fn(),
  },
}));

const mockedApi = vi.mocked(api);

function queryFromFirstCall() {
  const calledUrl = mockedApi.get.mock.calls[0][0] as string;
  return {
    calledUrl,
    query: new URLSearchParams(calledUrl.split('?')[1] ?? ''),
  };
}

describe('auditService API client integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calls the v1 audit-log list endpoint through the shared api client', async () => {
    mockedApi.get.mockResolvedValueOnce({
      records: [
        {
          id: 1001,
          operatorId: 'U001',
          operatorName: '审计员',
          operationType: 'DELETE',
          resourceType: 'ASSET',
          resourceId: 'A-001',
          action: '删除资产',
          ipAddress: '127.0.0.1',
          timestamp: '2026-05-01T10:00:00Z',
        },
      ],
      total: 1,
      current: 2,
      size: 20,
    });

    const result = await fetchAuditLogList({
      start_time: '2026-05-01T00:00:00Z',
      end_time: '2026-05-02T00:00:00Z',
      operator_id: 'U001',
      action_type: 'DELETE',
      module: 'ASSET',
      page: 2,
      size: 20,
    });

    const { calledUrl, query } = queryFromFirstCall();
    expect(calledUrl).toContain('/v1/audit-log/list?');
    expect(query.get('start_time')).toBe('2026-05-01T00:00:00Z');
    expect(query.get('end_time')).toBe('2026-05-02T00:00:00Z');
    expect(query.get('operation_type')).toBe('DELETE');
    expect(query.get('operator_id')).toBe('U001');
    expect(query.get('module')).toBe('ASSET');
    expect(query.get('page')).toBe('1');
    expect(query.get('size')).toBe('20');
    expect(result.items[0]).toMatchObject({
      id: '1001',
      operator_name: '审计员',
      action_type: 'DELETE',
    });
  });

  it('calls the v1 audit-log trend endpoint with adaptive weekly granularity', async () => {
    mockedApi.get.mockResolvedValueOnce({
      granularity: 'weekly',
      startDate: '2026-05-01',
      endDate: '2026-06-15',
      data: [{ date: '2026-05-04', count: 3 }],
    });

    const result = await fetchAuditLogTrend({
      start_time: '2026-05-01T00:00:00Z',
      end_time: '2026-06-15T00:00:00Z',
      operator_id: 'U001',
      action_type: 'DELETE',
      module: 'ASSET',
    });

    const { calledUrl, query } = queryFromFirstCall();
    expect(calledUrl).toContain('/v1/audit-log/trend?');
    expect(query.get('granularity')).toBe('weekly');
    expect(query.get('operation_type')).toBe('DELETE');
    expect(query.get('operator_id')).toBe('U001');
    expect(query.get('module')).toBe('ASSET');
    expect(result).toEqual({
      granularity: 'week',
      data_points: [{ timestamp: '2026-05-04', count: 3 }],
    });
  });

  it('uses v1 audit-log meta and detail endpoints', async () => {
    mockedApi.get
      .mockResolvedValueOnce(['CREATE', 'DELETE'])
      .mockResolvedValueOnce({
        id: 1001,
        operatorId: 'U001',
        operatorName: '审计员',
        operationType: 'DELETE',
        resourceType: 'ASSET',
        resourceId: 'A-001',
        action: '删除资产',
        ipAddress: '127.0.0.1',
        timestamp: '2026-05-01T10:00:00Z',
        beforeRecord: '{"status":"ACTIVE"}',
        afterRecord: '{"status":"DELETED"}',
      });

    await expect(fetchAuditLogMeta()).resolves.toEqual({ action_types: ['CREATE', 'DELETE'] });
    await expect(fetchAuditDetail('1001')).resolves.toMatchObject({
      id: '1001',
      request_payload: '{"status":"ACTIVE"}',
      response_payload: '{"status":"DELETED"}',
    });

    expect(mockedApi.get).toHaveBeenNthCalledWith(1, '/v1/audit-log/meta');
    expect(mockedApi.get).toHaveBeenNthCalledWith(2, '/v1/audit-log/1001');
  });
});
