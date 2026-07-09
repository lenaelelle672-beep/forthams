import { readFileSync } from 'node:fs';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import SystemWorkflowNotificationSwitchWorkbenchPage from '../SystemWorkflowNotificationSwitchWorkbenchPage';
import { notificationSwitchApi } from '../../../api/notificationTemplate';

vi.mock('../../../api/notificationTemplate', () => ({
  notificationSwitchApi: {
    list: vi.fn(),
    getByBizType: vi.fn(),
    meta: vi.fn(),
    preview: vi.fn(),
    updateEnabled: vi.fn(),
  },
}));

const mockedApi = vi.mocked(notificationSwitchApi);
const pageSource = readFileSync('src/pages/system/SystemWorkflowNotificationSwitchWorkbenchPage.tsx', 'utf8');

describe('SystemWorkflowNotificationSwitchWorkbenchPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedApi.list.mockResolvedValue([switchRecord()]);
    mockedApi.getByBizType.mockResolvedValue([switchRecord()]);
    mockedApi.meta.mockResolvedValue({
      bizTypes: [{ value: 'maintenance', label: '维保' }],
      events: [{ value: 'approved', label: '通过' }, { value: 'submitted', label: '提交' }],
      channelTypes: [{ value: 'IN_APP', label: '站内信' }, { value: 'EMAIL', label: '邮件' }],
      statuses: [{ value: '1', label: '允许通知' }, { value: '0', label: '阻断通知' }],
      previewPolicy: { tenantScoped: true, noPersistence: true, noSend: true, workflowRuntimeEffect: false, rejectedInputFields: ['tenantId', 'runtimeContext'] },
      tenantScoped: true,
      readOnly: true,
      noPersistencePreview: true,
      noSend: true,
      workflowRuntimeEffect: false,
      readonlyBoundary: '只读流程通知开关目录',
      nonGoals: ['不启停开关', '不发送通知'],
    });
    mockedApi.preview.mockResolvedValue({
      wouldNotify: false,
      blockedBySwitch: true,
      matchedSwitches: [switchRecord()],
      missingSwitches: [],
      rejectedInputs: [{ field: 'tenantId', reason: '已拒绝' }],
      tenantScoped: true,
      noPersistence: true,
      noSend: true,
      workflowRuntimeEffect: false,
      readonlyBoundary: '只读流程通知开关目录',
    });
  });

  it('真实调用 list、getByBizType、meta 与 preview wrapper 并展示无运行时影响边界', async () => {
    const { container } = render(<SystemWorkflowNotificationSwitchWorkbenchPage embeddedInWorkbench />);

    expect(screen.getByText('流程通知开关只读目录加载中...')).toBeInTheDocument();
    expect(await screen.findByRole('heading', { name: '通知开关 catalog' })).toBeInTheDocument();
    expect(container.querySelector('[data-system-workflow-notification-switch="workbench-v3"]')).toHaveAttribute('data-embedded', 'true');
    expect(screen.getByText(/真实调用 \/notification-switches\/list/)).toBeInTheDocument();
    expect(screen.getByText(/read-only notification switch catalog \+ no-persistence preview \+ no-send preview/)).toBeInTheDocument();
    expect(screen.getAllByText(/workflowRuntimeEffect=false/).length).toBeGreaterThan(0);
    expect(screen.getByText(/not flow-platform acceptance/)).toBeInTheDocument();
    expect(screen.getByText(/not message-notification group completion/)).toBeInTheDocument();
    expect(screen.getByText(/not Workbench V3 full completion/)).toBeInTheDocument();
    expect(mockedApi.list).toHaveBeenCalled();
    expect(mockedApi.meta).toHaveBeenCalled();
    expect(mockedApi.getByBizType).toHaveBeenCalledWith('maintenance');

    await userEvent.click(screen.getByRole('button', { name: '运行无持久化通知开关预览' }));
    await waitFor(() => expect(mockedApi.preview).toHaveBeenCalledWith(expect.objectContaining({ bizType: 'maintenance', event: 'approved', channelType: 'IN_APP', enabled: 0 })));
    expect(await screen.findByLabelText('流程通知开关预览结果')).toHaveTextContent('wouldNotify=false · blockedBySwitch=true');
    expect(screen.getByLabelText('流程通知开关预览结果')).toHaveTextContent('matchedSwitches=1 · missingSwitches：无');
    expect(screen.getByLabelText('流程通知开关预览结果')).toHaveTextContent('tenantScoped=true · noPersistence=true · noSend=true · workflowRuntimeEffect=false');
    expect(mockedApi.updateEnabled).not.toHaveBeenCalled();
  });

  it('支持按业务类型读取、预览输入和无权限 fail-closed', async () => {
    render(<SystemWorkflowNotificationSwitchWorkbenchPage />);
    expect((await screen.findAllByText(/维保/)).length).toBeGreaterThan(0);

    await userEvent.selectOptions(screen.getByLabelText('业务类型'), 'maintenance');
    await userEvent.click(screen.getByRole('button', { name: '读取业务类型' }));
    await waitFor(() => expect(mockedApi.getByBizType).toHaveBeenLastCalledWith('maintenance'));

    await userEvent.selectOptions(screen.getByLabelText('事件'), 'submitted');
    await userEvent.selectOptions(screen.getByLabelText('渠道'), 'EMAIL');
    await userEvent.selectOptions(screen.getByLabelText('样例启停状态'), '1');
    await userEvent.click(screen.getByRole('button', { name: '运行无持久化通知开关预览' }));
    await waitFor(() => expect(mockedApi.preview).toHaveBeenLastCalledWith(expect.objectContaining({ event: 'submitted', channelType: 'EMAIL', enabled: 1 })));

    vi.clearAllMocks();
    render(<SystemWorkflowNotificationSwitchWorkbenchPage canView={false} />);
    expect(screen.getByRole('alert')).toHaveTextContent('无权限访问流程通知开关只读目录');
    expect(mockedApi.list).not.toHaveBeenCalled();
    expect(mockedApi.preview).not.toHaveBeenCalled();
  });

  it('静态证明 V3 页面未调用旧启停、流程、发送链、消息中心或受保护 API helper', () => {
    for (const allowed of [
      'notificationSwitchApi.list',
      'notificationSwitchApi.getByBizType',
      'notificationSwitchApi.meta',
      'notificationSwitchApi.preview',
    ]) {
      expect(pageSource).toContain(allowed);
    }
    for (const forbidden of [
      'notificationSwitchApi.updateEnabled',
      'notificationTemplateApi.create',
      'notificationTemplateApi.update',
      'notificationTemplateApi.delete',
      'notificationPreferenceApi.save',
      'notificationPreferenceApi.batchSave',
      'channelConfigApi',
      'mailTemplateApi',
      'mailLogApi',
      'mailGatewayApi',
      '../api/workflow',
      'routePermissions',
      'auth/login/mobile',
      'messageCenter',
      'eventPublisher',
      'queue',
      'websocket',
      'webhook',
      'push',
      'retry',
    ]) {
      expect(pageSource).not.toContain(forbidden);
    }
  });

  function switchRecord() {
    return {
      id: 9,
      tenantId: 'tenant-a',
      bizType: 'maintenance',
      event: 'approved',
      channelType: 'IN_APP',
      enabled: 0,
      templateCode: 'MAINT_APPROVED',
      description: '只读流程通知开关',
      tenantScoped: true,
      readonlyBoundary: '只读流程通知开关目录',
    };
  }
});
