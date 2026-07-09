import { readFileSync } from 'node:fs';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import SystemNotificationPreferencesWorkbenchPage from '../SystemNotificationPreferencesWorkbenchPage';
import { notificationPreferenceApi } from '../../../api/notificationTemplate';

vi.mock('../../../api/notificationTemplate', () => ({
  notificationPreferenceApi: {
    list: vi.fn(),
    getByCategory: vi.fn(),
    meta: vi.fn(),
    preview: vi.fn(),
  },
}));

const mockedApi = vi.mocked(notificationPreferenceApi);
const pageSource = readFileSync('src/pages/system/SystemNotificationPreferencesWorkbenchPage.tsx', 'utf8');

describe('SystemNotificationPreferencesWorkbenchPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedApi.list.mockResolvedValue([preference()]);
    mockedApi.getByCategory.mockResolvedValue(preference());
    mockedApi.meta.mockResolvedValue({
      categories: [{ value: 'system', label: '系统' }],
      channelTypes: [{ value: 'ALL', label: '全部渠道' }, { value: 'IN_APP', label: '站内信' }, { value: 'EMAIL', label: '邮件' }],
      statuses: [{ value: '1', label: '启用' }],
      quietWindowPolicy: { format: 'HH:mm', crossMidnightSupported: true, examples: ['22:00-07:30'] },
      previewPolicy: { tenantScoped: true, noPersistence: true, noSend: true, runtimeEffect: false },
      reservedCategoryWords: ['meta', 'preview', 'batch', 'user', 'users', 'id'],
      tenantScoped: true,
      readOnly: true,
      noPersistencePreview: true,
      runtimeEffect: false,
      readonlyBoundary: '只读通知偏好目录与无持久化预览',
      nonGoals: ['不保存偏好', '不发送通知'],
    });
    mockedApi.preview.mockResolvedValue({
      wouldReceive: false,
      inAppEnabled: true,
      emailEnabled: false,
      quietWindowMatched: true,
      missingPreferences: ['system'],
      rejectedInputs: [{ field: 'userId', reason: '已拒绝' }],
      tenantScoped: true,
      noPersistence: true,
      runtimeEffect: false,
      readonlyBoundary: '只读通知偏好目录与无持久化预览',
    });
  });

  it('真实调用 preference list、category、meta 与 preview wrapper 并展示无发送边界', async () => {
    const { container } = render(<SystemNotificationPreferencesWorkbenchPage embeddedInWorkbench />);

    expect(screen.getByText('通知偏好只读目录加载中...')).toBeInTheDocument();
    expect(await screen.findByRole('heading', { name: '偏好 catalog' })).toBeInTheDocument();
    expect(container.querySelector('[data-system-notification-preferences="workbench-v3"]')).toHaveAttribute('data-embedded', 'true');
    expect(screen.getByText(/真实调用 \/notification-preferences/)).toBeInTheDocument();
    expect(screen.getByText(/只读通知偏好目录 \+ 无持久化偏好决策预览/)).toBeInTheDocument();
    expect(screen.getByText(/消息与通知组未全组完成/)).toBeInTheDocument();
    expect(screen.getByText(/仍非 44\/44/)).toBeInTheDocument();
    expect(mockedApi.list).toHaveBeenCalled();
    expect(mockedApi.meta).toHaveBeenCalled();
    expect(mockedApi.getByCategory).toHaveBeenCalledWith('system');

    await userEvent.click(screen.getByRole('button', { name: '运行无持久化偏好预览' }));
    await waitFor(() => expect(mockedApi.preview).toHaveBeenCalledWith(expect.objectContaining({ category: 'system', channelType: 'ALL' })));
    expect(await screen.findByLabelText('通知偏好预览结果')).toHaveTextContent('wouldReceive=false · quietWindowMatched=true');
    expect(screen.getByLabelText('通知偏好预览结果')).toHaveTextContent('missingPreferences：system');
    expect(screen.getByLabelText('通知偏好预览结果')).toHaveTextContent('tenantScoped=true · noPersistence=true · runtimeEffect=false');
  });

  it('支持分类读取、预览输入和无权限 fail-closed', async () => {
    render(<SystemNotificationPreferencesWorkbenchPage />);
    expect((await screen.findAllByText(/系统/)).length).toBeGreaterThan(0);

    await userEvent.selectOptions(screen.getByLabelText('通知偏好分类'), 'system');
    await userEvent.click(screen.getByRole('button', { name: '读取分类' }));
    await waitFor(() => expect(mockedApi.getByCategory).toHaveBeenLastCalledWith('system'));

    await userEvent.clear(screen.getByLabelText('样例时间'));
    await userEvent.type(screen.getByLabelText('样例时间'), '23:00');
    await userEvent.selectOptions(screen.getByLabelText('预览渠道'), 'EMAIL');
    await userEvent.click(screen.getByRole('button', { name: '运行无持久化偏好预览' }));
    await waitFor(() => expect(mockedApi.preview).toHaveBeenLastCalledWith(expect.objectContaining({ sampleTime: '23:00', channelType: 'EMAIL' })));

    vi.clearAllMocks();
    render(<SystemNotificationPreferencesWorkbenchPage canView={false} />);
    expect(screen.getByRole('alert')).toHaveTextContent('无权限访问通知偏好只读目录');
    expect(mockedApi.list).not.toHaveBeenCalled();
    expect(mockedApi.preview).not.toHaveBeenCalled();
  });

  it('静态证明 V3 页面未调用偏好写入、通知开关、渠道、邮件、流程或受保护 API helper', () => {
    for (const allowed of [
      'notificationPreferenceApi.list',
      'notificationPreferenceApi.getByCategory',
      'notificationPreferenceApi.meta',
      'notificationPreferenceApi.preview',
    ]) {
      expect(pageSource).toContain(allowed);
    }
    for (const forbidden of [
      'notificationPreferenceApi.save',
      'notificationPreferenceApi.batchSave',
      'notificationSwitchApi',
      'notificationTemplateApi.create',
      'notificationTemplateApi.update',
      'notificationTemplateApi.delete',
      'channelConfigApi',
      'mailTemplateApi',
      'mailLogApi',
      'mailGatewayApi',
      '../api/workflow',
      'routePermissions',
      'auth/login/mobile',
    ]) {
      expect(pageSource).not.toContain(forbidden);
    }
  });

  function preference() {
    return {
      id: 7,
      tenantId: 'tenant-a',
      category: 'system',
      categoryLabel: '系统',
      inApp: 1,
      email: 0,
      quietStart: '22:00',
      quietEnd: '07:30',
      status: 1,
      missingPreference: false,
      tenantScoped: true,
      readonlyBoundary: '只读通知偏好目录',
    };
  }
});
