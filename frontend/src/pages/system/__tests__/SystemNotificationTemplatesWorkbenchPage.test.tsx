import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import SystemNotificationTemplatesWorkbenchPage from '../SystemNotificationTemplatesWorkbenchPage';
import { notificationTemplateApi } from '../../../api/notificationTemplate';

vi.mock('../../../api/notificationTemplate', () => ({
  notificationTemplateApi: {
    list: vi.fn(),
    getById: vi.fn(),
    getByCode: vi.fn(),
    meta: vi.fn(),
    preview: vi.fn(),
  },
}));

const mockedApi = vi.mocked(notificationTemplateApi);

describe('SystemNotificationTemplatesWorkbenchPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedApi.list.mockResolvedValue({ records: [template()], total: 1, size: 20, current: 1, pages: 1, tenantScoped: true });
    mockedApi.getById.mockResolvedValue(template());
    mockedApi.getByCode.mockResolvedValue(template());
    mockedApi.meta.mockResolvedValue({
      categories: [{ value: 'system', label: '系统' }],
      channelTypes: [{ value: 'IN_APP', label: '站内信' }],
      statuses: [{ value: '1', label: '启用' }],
      previewVariablePolicy: {
        htmlEscaped: true,
        whitelistOnly: true,
        nonPersistent: true,
        sensitiveVariableNames: ['token'],
      },
      tenantScoped: true,
      readonlyBoundary: '通知模板 catalog + safe preview',
      nonGoals: ['不发送通知', '不配置渠道'],
    });
    mockedApi.preview.mockResolvedValue({
      renderedTitle: '资产 &lt;A&gt;',
      renderedContent: '正文 &lt;A&gt;',
      missingVariables: ['dueDate'],
      rejectedVariables: [{ name: 'token', reason: '敏感变量名已拒绝' }],
      usedVariables: ['assetName'],
      nonPersistent: true,
    });
  });

  it('真实调用 template catalog、详情、code、meta 与 preview wrapper 并展示非发送边界', async () => {
    const { container } = render(<SystemNotificationTemplatesWorkbenchPage embeddedInWorkbench />);

    expect(screen.getByText('通知模板加载中...')).toBeInTheDocument();
    expect(await screen.findByRole('heading', { name: '模板 catalog' })).toBeInTheDocument();
    expect(container.querySelector('[data-system-notification-templates="workbench-v3"]')).toHaveAttribute('data-embedded', 'true');
    expect(screen.getByText(/真实调用 \/notification-templates\/list/)).toBeInTheDocument();
    expect(screen.getByText(/不发送通知、不配置渠道、不修改偏好、不控制流程通知开关、不接入邮件网关/)).toBeInTheDocument();
    expect(screen.getByText(/nonPersistent=true/)).toBeInTheDocument();
    expect(mockedApi.list).toHaveBeenCalledWith({ page: 1, pageSize: 20 });
    expect(mockedApi.meta).toHaveBeenCalled();
    expect(mockedApi.getById).toHaveBeenCalledWith(3);
    expect(mockedApi.getByCode).toHaveBeenCalledWith('SYS_NOTICE');

    await userEvent.click(screen.getByRole('button', { name: '生成无持久化预览' }));
    await waitFor(() => expect(mockedApi.preview).toHaveBeenCalledWith(expect.objectContaining({ templateId: 3 })));
    expect(await screen.findByLabelText('通知模板预览结果')).toHaveTextContent('missingVariables：dueDate');
    expect(screen.getByLabelText('通知模板预览结果')).toHaveTextContent('rejectedVariables：token:敏感变量名已拒绝');
    expect(screen.getByLabelText('通知模板预览结果')).toHaveTextContent('usedVariables：assetName');
  });

  it('支持筛选、按编码重新加载，且无权限时不调用 wrapper', async () => {
    render(<SystemNotificationTemplatesWorkbenchPage />);
    expect((await screen.findAllByText(/系统通知/)).length).toBeGreaterThan(0);

    await userEvent.type(screen.getByPlaceholderText('按编码、名称或正文搜索'), '系统');
    await userEvent.selectOptions(screen.getByLabelText('通知模板分类'), 'system');
    await userEvent.selectOptions(screen.getByLabelText('通知模板渠道'), 'IN_APP');
    await userEvent.click(screen.getByRole('button', { name: '查询' }));
    await waitFor(() => expect(mockedApi.list).toHaveBeenLastCalledWith(expect.objectContaining({ keyword: '系统', category: 'system', channelType: 'IN_APP' })));

    await userEvent.clear(screen.getByLabelText('按编码查询'));
    await userEvent.type(screen.getByLabelText('按编码查询'), 'SYS_NOTICE');
    await userEvent.click(screen.getByRole('button', { name: '按编码加载' }));
    await waitFor(() => expect(mockedApi.getByCode).toHaveBeenLastCalledWith('SYS_NOTICE'));

    vi.clearAllMocks();
    render(<SystemNotificationTemplatesWorkbenchPage canView={false} />);
    expect(screen.getByRole('alert')).toHaveTextContent('无权限访问通知模板 catalog');
    expect(mockedApi.list).not.toHaveBeenCalled();
  });

  function template() {
    return {
      id: 3,
      tenantId: 'tenant-a',
      templateCode: 'SYS_NOTICE',
      templateName: '系统通知',
      category: 'system',
      channelType: 'IN_APP',
      titleTemplate: '资产 {{assetName}}',
      contentTemplate: '正文 {{assetName}}',
      variables: '["assetName","dueDate"]',
      status: 1,
    };
  }
});
