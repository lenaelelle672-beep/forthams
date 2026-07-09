import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import SystemMailLogsWorkbenchPage from '../SystemMailLogsWorkbenchPage';
import { mailLogApi } from '../../../api/mailTemplate';

vi.mock('../../../api/mailTemplate', () => ({
  mailLogApi: {
    list: vi.fn(),
    getById: vi.fn(),
    getByBiz: vi.fn(),
    meta: vi.fn(),
    retry: vi.fn(),
  },
}));

const mockedApi = vi.mocked(mailLogApi);

describe('SystemMailLogsWorkbenchPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedApi.list.mockResolvedValue({ records: [log()], total: 1, size: 20, current: 1, pages: 1, tenantScoped: true, redacted: true, readOnly: true });
    mockedApi.getById.mockResolvedValue({ ...log(), maskedBodySummary: '正文已脱敏，长度=64', redactionPolicy: ['只返回掩码'], nonGoals: ['不提供 retry/replay/resend'] });
    mockedApi.getByBiz.mockResolvedValue([log()]);
    mockedApi.meta.mockResolvedValue({
      sendStatuses: [{ value: 'FAILED', label: '发送失败' }],
      bizTypes: [{ value: 'asset', label: 'asset' }],
      templateCodes: [{ value: 'ASSET_NOTIFY', label: 'ASSET_NOTIFY' }],
      redactionPolicy: ['收件人、主题、正文和错误只返回脱敏摘要'],
      nonGoals: ['不提供 retry/replay/resend', '不提供 export/download', '不保证日志采集链路'],
      redacted: true,
      tenantScoped: true,
      readOnly: true,
      collectionGuaranteed: false,
      readonlyBoundary: '邮件日志只读 catalog/detail/biz/meta',
    });
  });

  it('真实调用 list、detail、biz 与 meta wrapper，并展示只读脱敏边界', async () => {
    const { container } = render(<SystemMailLogsWorkbenchPage embeddedInWorkbench />);

    expect(screen.getByText('邮件日志加载中...')).toBeInTheDocument();
    expect(await screen.findByRole('heading', { name: '日志 catalog' })).toBeInTheDocument();
    expect(container.querySelector('[data-system-mail-logs="workbench-v3"]')).toHaveAttribute('data-embedded', 'true');
    expect(screen.getByText(/真实调用 \/mail-logs\/list/)).toBeInTheDocument();
    expect(screen.getByText(/no retry\/export\/send/)).toBeInTheDocument();
    expect(screen.getAllByText(/不保证日志采集链路/).length).toBeGreaterThan(0);
    expect(screen.getByText(/不代表邮件子系统完成/)).toBeInTheDocument();
    expect(screen.getByText(/收件人：o\*\*\*@e\*\*\*/)).toBeInTheDocument();
    expect(screen.queryByText('ops@example.com')).not.toBeInTheDocument();
    expect(screen.queryByText('工资单')).not.toBeInTheDocument();
    expect(screen.queryByText('raw-content-secret')).not.toBeInTheDocument();

    await waitFor(() => expect(mockedApi.list).toHaveBeenCalledWith({ page: 1, pageSize: 20 }));
    expect(mockedApi.meta).toHaveBeenCalled();
    expect(mockedApi.getById).toHaveBeenCalledWith(7);
    expect(mockedApi.getByBiz).toHaveBeenCalledWith('asset', 18);
    expect(mockedApi.retry).not.toHaveBeenCalled();
  });

  it('支持筛选重新加载，且无权限时不调用 wrapper', async () => {
    render(<SystemMailLogsWorkbenchPage />);
    expect((await screen.findAllByText(/ASSET_NOTIFY/)).length).toBeGreaterThan(0);

    await userEvent.type(screen.getByLabelText('邮件日志模板编码'), 'ASSET_NOTIFY');
    await userEvent.selectOptions(screen.getByLabelText('邮件日志状态'), 'FAILED');
    await userEvent.type(screen.getByLabelText('邮件日志业务类型'), 'asset');
    await userEvent.type(screen.getByLabelText('邮件日志业务 ID'), '18');
    await userEvent.click(screen.getByRole('button', { name: '查询' }));
    await waitFor(() => expect(mockedApi.list).toHaveBeenLastCalledWith(expect.objectContaining({ templateCode: 'ASSET_NOTIFY', sendStatus: 'FAILED', bizType: 'asset', bizId: 18 })));

    vi.clearAllMocks();
    render(<SystemMailLogsWorkbenchPage canView={false} />);
    expect(screen.getByRole('alert')).toHaveTextContent('无权限访问邮件日志 read-only catalog');
    expect(mockedApi.list).not.toHaveBeenCalled();
    expect(mockedApi.retry).not.toHaveBeenCalled();
  });

  function log() {
    return {
      id: 7,
      tenantId: 'tenant-a',
      templateCode: 'ASSET_NOTIFY',
      maskedMailFrom: 'n***@e***',
      maskedMailTo: 'o***@e***',
      maskedSubject: '主题已脱敏，长度=4',
      maskedBodySummary: '正文已脱敏，长度=64',
      sendStatus: 'FAILED',
      diagnosticSummary: '状态=FAILED；重试=1/3；错误详情已脱敏',
      retryCount: 1,
      maxRetry: 3,
      bizType: 'asset',
      bizId: 18,
      redacted: true,
      tenantScoped: true,
      readOnly: true,
      readonlyBoundary: '邮件日志只读 catalog/detail/biz/meta',
    };
  }
});
