import { readFileSync } from 'node:fs';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import SystemMailGatewayWorkbenchPage from '../SystemMailGatewayWorkbenchPage';
import { mailGatewayApi } from '../../../api/mailGateways';

vi.mock('../../../api/mailGateways', () => ({
  mailGatewayApi: {
    list: vi.fn(),
    getById: vi.fn(),
    meta: vi.fn(),
    preview: vi.fn(),
  },
}));

const mockedApi = vi.mocked(mailGatewayApi);
const pageSource = readFileSync('src/pages/system/SystemMailGatewayWorkbenchPage.tsx', 'utf8');

describe('SystemMailGatewayWorkbenchPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedApi.list.mockResolvedValue(pageRecord());
    mockedApi.getById.mockResolvedValue(gatewayRecord());
    mockedApi.meta.mockResolvedValue(metaRecord());
    mockedApi.preview.mockResolvedValue(previewRecord());
  });

  it('真实调用 list、getById、meta 与 preview，并展示只读 no-send/no-network 边界', async () => {
    const { container } = render(<SystemMailGatewayWorkbenchPage embeddedInWorkbench />);

    expect(screen.getByText('邮件网关 metadata-only catalog 加载中...')).toBeInTheDocument();
    expect(await screen.findByRole('heading', { name: '网关 catalog' })).toBeInTheDocument();
    expect(container.querySelector('[data-system-mail-gateway="workbench-v3"]')).toHaveAttribute('data-embedded', 'true');
    expect(screen.getByText(/真实调用 \/system\/mail-gateways/)).toBeInTheDocument();
    expect(screen.getByText(/noPersistence=true、noSend=true、noNetwork=true/)).toBeInTheDocument();
    expect(screen.getByText(/system-mail-gateway 已接入真组件/)).toBeInTheDocument();
    expect(screen.getByText(/不代表消息与通知组、邮件子系统或 Workbench V3 全量完成/)).toBeInTheDocument();
    expect(mockedApi.list).toHaveBeenCalledWith({ page: 1, pageSize: 20 });
    expect(mockedApi.meta).toHaveBeenCalled();
    await waitFor(() => expect(mockedApi.getById).toHaveBeenCalledWith(8));

    await userEvent.click(screen.getByRole('button', { name: '运行 dry-run preview' }));
    await waitFor(() => expect(mockedApi.preview).toHaveBeenCalledWith(expect.objectContaining({ hostMasked: 'smtp.***.corp', port: 587, tlsMode: 'STARTTLS', authConfigured: true, enabled: true, priority: 10 })));
    expect(await screen.findByLabelText('邮件网关预览结果')).toHaveTextContent('previewAccepted=true · configured=true');
    expect(screen.getByLabelText('邮件网关预览结果')).toHaveTextContent('noPersistence=true · noSend=true · noNetwork=true · runtimeEffect=false · cacheRefreshed=false · credentialExposed=false · smtpConnect=false · javaMailSenderUsed=false · mailSenderProviderUsed=false');
  });

  it('支持只读刷新、脱敏详情读取和无权限 fail-closed', async () => {
    render(<SystemMailGatewayWorkbenchPage />);
    expect((await screen.findAllByText(/主邮件网关/)).length).toBeGreaterThan(0);

    await userEvent.clear(screen.getByLabelText('邮件网关关键词'));
    await userEvent.type(screen.getByLabelText('邮件网关关键词'), 'smtp');
    await userEvent.click(screen.getByRole('button', { name: '只读刷新' }));
    await waitFor(() => expect(mockedApi.list).toHaveBeenLastCalledWith({ page: 1, pageSize: 20, keyword: 'smtp' }));

    await userEvent.click(screen.getByRole('button', { name: /主邮件网关/ }));
    await waitFor(() => expect(mockedApi.getById).toHaveBeenLastCalledWith(8));

    vi.clearAllMocks();
    render(<SystemMailGatewayWorkbenchPage canView={false} />);
    expect(screen.getByRole('alert')).toHaveTextContent('无权限访问邮件网关 metadata-only catalog');
    expect(mockedApi.list).not.toHaveBeenCalled();
    expect(mockedApi.preview).not.toHaveBeenCalled();
  });

  it('静态证明页面未调用 CRUD、渠道/模板/日志/通知/workflow/systemConfig 或受保护模块', () => {
    for (const allowed of [
      'mailGatewayApi.list',
      'mailGatewayApi.getById',
      'mailGatewayApi.meta',
      'mailGatewayApi.preview',
    ]) {
      expect(pageSource).toContain(allowed);
    }
    expect(pageSource).not.toMatch(/channelConfigApi|systemConfig|mailTemplateApi|mailLogApi|notificationTemplateApi|notificationPreferenceApi|notificationSwitchApi|workflowApi|@\/api\/workflow|\.\.\/api\/workflow|routePermissions|auth\/login\/mobile|保存修改|删除|测试连接|发送邮件|重试/);
    expect(pageSource).not.toMatch(/credentialInput|secretInput|rawCredential|smtpPassword/);
  });

  function gatewayRecord() {
    return {
      id: 8,
      gatewayCode: 'smtp-main',
      gatewayName: '主邮件网关',
      hostMasked: 'smtp.***.corp',
      port: 587,
      tlsMode: 'STARTTLS',
      authConfigured: true,
      senderMasked: 'n***@c***',
      priority: 10,
      enabled: true,
      lastTestStatus: 'SUCCESS',
      tenantScoped: true,
      readOnly: true,
      readonlyBoundary: '只读邮件网关目录',
    };
  }

  function pageRecord() {
    return { records: [gatewayRecord()], total: 1, page: 1, pageSize: 20, pages: 1, tenantScoped: true, readOnly: true, readonlyBoundary: '只读邮件网关目录' };
  }

  function metaRecord() {
    return {
      tlsModes: [{ value: 'STARTTLS', label: 'STARTTLS 元数据' }],
      lastTestStatuses: [{ value: 'SUCCESS', label: '最近验证成功' }],
      allowedPreviewFields: ['hostMasked', 'port', 'tlsMode'],
      previewPolicy: { tenantScoped: true, noPersistence: true, noSend: true, noNetwork: true, runtimeEffect: false, cacheRefreshed: false, credentialExposed: false, smtpConnect: false, javaMailSenderUsed: false, mailSenderProviderUsed: false, readonlyBoundary: '只读邮件网关目录', rejectedInputFields: ['smtpPassword'] },
      tenantScoped: true,
      readOnly: true,
      noPersistencePreview: true,
      noSend: true,
      noNetwork: true,
      runtimeEffect: false,
      cacheRefreshed: false,
      credentialExposed: false,
      smtpConnect: false,
      javaMailSenderUsed: false,
      mailSenderProviderUsed: false,
      readonlyBoundary: '只读邮件网关目录',
      nonGoals: ['不代表邮件子系统完成'],
    };
  }

  function previewRecord() {
    return { previewAccepted: true, configured: true, acceptedFields: ['hostMasked', 'port', 'tlsMode'], rejectedInputs: [], warnings: [], tenantScoped: true, readOnly: true, noPersistence: true, noSend: true, noNetwork: true, runtimeEffect: false, cacheRefreshed: false, credentialExposed: false, smtpConnect: false, javaMailSenderUsed: false, mailSenderProviderUsed: false, readonlyBoundary: '只读邮件网关目录' };
  }
});
