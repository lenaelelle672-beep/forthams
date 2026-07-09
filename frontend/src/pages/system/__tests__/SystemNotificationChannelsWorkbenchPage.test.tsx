import { readFileSync } from 'node:fs';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import SystemNotificationChannelsWorkbenchPage from '../SystemNotificationChannelsWorkbenchPage';
import { channelConfigApi } from '../../../api/channelConfig';

vi.mock('../../../api/channelConfig', () => ({
  CHANNEL_TYPE_LABELS: {
    DINGTALK: '钉钉',
    WECHAT: '企业微信',
    EMAIL: '邮件',
  },
  channelConfigApi: {
    list: vi.fn(),
    getById: vi.fn(),
    meta: vi.fn(),
    preview: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    test: vi.fn(),
  },
}));

const mockedApi = vi.mocked(channelConfigApi);
const pageSource = readFileSync('src/pages/system/SystemNotificationChannelsWorkbenchPage.tsx', 'utf8');

describe('SystemNotificationChannelsWorkbenchPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedApi.list.mockResolvedValue({
      records: [channelConfig()],
      total: 1,
      page: 1,
      pageSize: 20,
      tenantScoped: true,
      readonlyBoundary: '只读通知渠道目录',
    });
    mockedApi.getById.mockResolvedValue(channelConfig());
    mockedApi.meta.mockResolvedValue({
      channelTypes: [{ value: 'DINGTALK', label: '钉钉' }, { value: 'WECHAT', label: '企业微信' }],
      statuses: [{ value: '1', label: '启用' }],
      previewPolicy: { tenantScoped: true, noPersistence: true, noSend: true, runtimeEffect: false, forbiddenOperations: ['test-send'], rejectedInputFields: ['webhookUrl', 'secret'] },
      tenantScoped: true,
      readOnly: true,
      noPersistencePreview: true,
      noSend: true,
      runtimeEffect: false,
      readonlyBoundary: '只读通知渠道目录与无发送预览',
      nonGoals: ['不发送测试消息', '不调用外部 webhook'],
    });
    mockedApi.preview.mockResolvedValue({
      channelType: 'DINGTALK',
      configName: '运维群',
      configured: true,
      webhookUrlConfigured: true,
      webhookUrlMasked: '已配置（脱敏）',
      signatureConfigured: true,
      enabled: 1,
      sampleEndpointAccepted: true,
      previewAccepted: true,
      rejectedInputs: [{ field: 'secret', reason: '已拒绝' }],
      tenantScoped: true,
      noPersistence: true,
      noSend: true,
      runtimeEffect: false,
      readonlyBoundary: '只读通知渠道目录与无发送预览',
    });
  });

  it('真实调用 channel config list、detail、meta 与 preview wrapper 并展示 no-send 边界', async () => {
    const { container } = render(<SystemNotificationChannelsWorkbenchPage embeddedInWorkbench />);

    expect(screen.getByText('通知渠道只读目录加载中...')).toBeInTheDocument();
    expect(await screen.findByRole('heading', { name: '渠道 catalog' })).toBeInTheDocument();
    expect(container.querySelector('[data-system-notification-channels="workbench-v3"]')).toHaveAttribute('data-embedded', 'true');
    expect(screen.getByText(/真实调用 \/system\/channel-configs/)).toBeInTheDocument();
    expect(screen.getByText(/只读通知渠道目录 \+ 无持久化、无发送、无外联脱敏预览/)).toBeInTheDocument();
    expect(screen.getByText(/消息与通知组未全组完成/)).toBeInTheDocument();
    expect(screen.getByText(/仍非 44\/44/)).toBeInTheDocument();
    expect(mockedApi.list).toHaveBeenCalledWith({ page: 1, pageSize: 20 });
    expect(mockedApi.meta).toHaveBeenCalled();
    expect(mockedApi.getById).toHaveBeenCalledWith(7);

    await userEvent.click(screen.getByRole('button', { name: '运行无持久化渠道预览' }));
    await waitFor(() => expect(mockedApi.preview).toHaveBeenCalledWith(expect.objectContaining({ channelType: 'DINGTALK', webhookUrlConfigured: true, enabled: 1 })));
    expect(await screen.findByLabelText('通知渠道预览结果')).toHaveTextContent('configured=true · previewAccepted=true');
    expect(screen.getByLabelText('通知渠道预览结果')).toHaveTextContent('tenantScoped=true · noPersistence=true · noSend=true · runtimeEffect=false');
    expect(screen.getByLabelText('通知渠道预览结果')).toHaveTextContent('rejectedInputs：secret:已拒绝');
  });

  it('支持详情读取、预览输入和无权限 fail-closed', async () => {
    render(<SystemNotificationChannelsWorkbenchPage />);
    expect((await screen.findAllByText(/运维群/)).length).toBeGreaterThan(0);

    await userEvent.selectOptions(screen.getByLabelText('通知渠道配置'), '7');
    await userEvent.click(screen.getByRole('button', { name: '读取详情' }));
    await waitFor(() => expect(mockedApi.getById).toHaveBeenLastCalledWith(7));

    await userEvent.clear(screen.getByLabelText('样例相对路径'));
    await userEvent.type(screen.getByLabelText('样例相对路径'), '/robot/safe-preview');
    await userEvent.selectOptions(screen.getByLabelText('预览渠道类型'), 'WECHAT');
    await userEvent.click(screen.getByRole('button', { name: '运行无持久化渠道预览' }));
    await waitFor(() => expect(mockedApi.preview).toHaveBeenLastCalledWith(expect.objectContaining({ sampleEndpoint: '/robot/safe-preview', channelType: 'WECHAT' })));

    vi.clearAllMocks();
    render(<SystemNotificationChannelsWorkbenchPage canView={false} />);
    expect(screen.getByRole('alert')).toHaveTextContent('无权限访问通知渠道只读目录');
    expect(mockedApi.list).not.toHaveBeenCalled();
    expect(mockedApi.preview).not.toHaveBeenCalled();
  });

  it('静态证明 V3 页面未调用渠道写入、测试发送、通知偏好、邮件、流程或受保护 API helper', () => {
    for (const allowed of [
      'channelConfigApi.list',
      'channelConfigApi.getById',
      'channelConfigApi.meta',
      'channelConfigApi.preview',
    ]) {
      expect(pageSource).toContain(allowed);
    }
    for (const forbidden of [
      'channelConfigApi.create',
      'channelConfigApi.update',
      'channelConfigApi.delete',
      'channelConfigApi.test',
      'NotificationChannelTab',
      'notificationPreferenceApi',
      'notificationSwitchApi',
      'notificationTemplateApi.create',
      'notificationTemplateApi.update',
      'notificationTemplateApi.delete',
      'mailTemplateApi',
      'mailLogApi',
      'mailGatewayApi',
      '../api/workflow',
      'routePermissions',
      'auth/login/mobile',
      'providerRequest',
      'dangerouslySetInnerHTML',
    ]) {
      expect(pageSource).not.toContain(forbidden);
    }
  });

  function channelConfig() {
    return {
      id: 7,
      channelType: 'DINGTALK',
      configName: '运维群',
      webhookUrlMasked: 'https://example.com/***',
      webhookUrlConfigured: true,
      signatureConfigured: true,
      enabled: 1,
      description: '只读渠道',
      createdAt: '2026-01-01',
      updatedAt: '2026-01-01',
      tenantScoped: true,
      readonlyBoundary: '只读通知渠道目录',
    };
  }
});
