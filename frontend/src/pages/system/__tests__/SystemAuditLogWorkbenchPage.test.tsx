import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import SystemAuditLogWorkbenchPage from '../SystemAuditLogWorkbenchPage';
import {
  getAuditActionTypeDistribution,
  getAuditLogDetail,
  getAuditLogs,
  getAuditMeta,
  getAuditOperatorRanking,
  getAuditStats,
  getAuditTrends,
} from '../../../api/audit';

vi.mock('../../../api/audit', () => ({
  getAuditLogs: vi.fn(),
  getAuditLogDetail: vi.fn(),
  getAuditStats: vi.fn(),
  getAuditTrends: vi.fn(),
  getAuditActionTypeDistribution: vi.fn(),
  getAuditOperatorRanking: vi.fn(),
  getAuditMeta: vi.fn(),
}));

const mockedGetLogs = vi.mocked(getAuditLogs);
const mockedGetDetail = vi.mocked(getAuditLogDetail);
const mockedGetStats = vi.mocked(getAuditStats);
const mockedGetTrends = vi.mocked(getAuditTrends);
const mockedGetDistribution = vi.mocked(getAuditActionTypeDistribution);
const mockedGetRanking = vi.mocked(getAuditOperatorRanking);
const mockedGetMeta = vi.mocked(getAuditMeta);

describe('SystemAuditLogWorkbenchPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedGetLogs.mockResolvedValue({ records: [log()], total: 1, size: 20, current: 1, pages: 1 });
    mockedGetDetail.mockResolvedValue({ ...log(), rawPayloadSummary: 'payload(length=10, sha256=abc, preview=token=******)' });
    mockedGetStats.mockResolvedValue({ totalCount: 1, trendData: [{ date: '2026-07-07', count: 1 }], typeDistribution: [], topOperators: [] });
    mockedGetTrends.mockResolvedValue({ granularity: 'daily', data: [{ date: '2026-07-07', count: 1 }] });
    mockedGetDistribution.mockResolvedValue({ totalOperations: 1, distribution: [{ actionType: 'UPDATE', count: 1, percentage: 100 }] });
    mockedGetRanking.mockResolvedValue([{ rank: 1, operatorName: '管理员', count: 1 }]);
    mockedGetMeta.mockResolvedValue({ operationTypes: ['UPDATE'], resourceTypes: ['ASSET'], operators: ['管理员'], tenantScoped: true, masked: true, readonlyBoundary: 'GET-only' });
  });

  it('真实调用 /audit-logs GET 族 wrapper 并展示只读脱敏边界', async () => {
    const { container } = render(<SystemAuditLogWorkbenchPage embeddedInWorkbench />);

    expect(screen.getByText('审计日志加载中...')).toBeInTheDocument();
    expect(await screen.findByRole('heading', { name: '只读审计事件' })).toBeInTheDocument();
    expect(container.querySelector('[data-system-audit-log="workbench-v3"]')).toHaveAttribute('data-embedded', 'true');
    expect(screen.getAllByText(/真实调用 \/audit-logs/).length).toBeGreaterThan(0);
    expect(screen.getByText(/GET-only \/ tenant-scoped \/ masked/)).toBeInTheDocument();
    expect(screen.getByText(/不采集审计写入/)).toBeInTheDocument();
    expect(screen.getByText(/不代表全模块审计覆盖/)).toBeInTheDocument();
    expect(screen.getByText(/不可篡改合规归档或 SIEM/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /导出脱敏快照/ })).toBeDisabled();
    expect(mockedGetLogs).toHaveBeenCalledWith(expect.objectContaining({ page: 1, pageSize: 20 }));
    expect(mockedGetStats).toHaveBeenCalled();
    expect(mockedGetTrends).toHaveBeenCalled();
    expect(mockedGetDistribution).toHaveBeenCalled();
    expect(mockedGetRanking).toHaveBeenCalled();
    expect(mockedGetMeta).toHaveBeenCalled();
    expect(mockedGetDetail).toHaveBeenCalledWith(7);
    expect(container.querySelector('iframe')).toBeNull();
    expect(document.body.textContent).not.toContain(rawSecret());
  });

  it('支持筛选、详情追溯和脱敏摘要展示', async () => {
    mockedGetLogs.mockResolvedValueOnce({ records: [log()], total: 1, size: 20, current: 1, pages: 1 })
      .mockResolvedValueOnce({ records: [{ ...log(), id: 8, operationType: 'UPDATE' }], total: 1, size: 20, current: 1, pages: 1 });
    render(<SystemAuditLogWorkbenchPage />);

    expect(await screen.findByText(/UPDATE · ASSET/)).toBeInTheDocument();
    await userEvent.type(screen.getByPlaceholderText('按操作人、说明或资源类型搜索'), '资产');
    await userEvent.selectOptions(screen.getByLabelText('操作类型筛选'), 'UPDATE');
    await userEvent.selectOptions(screen.getByLabelText('资源类型筛选'), 'ASSET');
    await userEvent.click(screen.getByRole('button', { name: '查询' }));

    await waitFor(() => expect(mockedGetLogs).toHaveBeenLastCalledWith(expect.objectContaining({ keyword: '资产', operationType: 'UPDATE', resourceType: 'ASSET' })));
    expect(await screen.findByLabelText('审计日志详情')).toHaveTextContent('beforeRecord 摘要');
    expect(screen.getByLabelText('审计日志详情')).toHaveTextContent('token=******');
    expect(document.body.textContent).not.toContain(rawSecret());
  });

  it('错误态脱敏且无权限时不加载 wrapper', async () => {
    mockedGetLogs.mockRejectedValueOnce(new Error('secret=' + rawSecret()));

    const { unmount } = render(<SystemAuditLogWorkbenchPage />);
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('错误详情已脱敏'));
    expect(screen.queryByText(rawSecret())).not.toBeInTheDocument();

    unmount();
    vi.clearAllMocks();
    render(<SystemAuditLogWorkbenchPage canView={false} />);
    expect(screen.getByRole('alert')).toHaveTextContent('无权限访问审计日志');
    expect(mockedGetLogs).not.toHaveBeenCalled();
  });

  function log() {
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
      errorSummary: 'authorization=******',
      createdAt: '2026-07-07T12:00:00',
      masked: true,
      tenantScoped: true,
    };
  }

  function rawSecret() {
    return 'raw-audit-secret';
  }
});
