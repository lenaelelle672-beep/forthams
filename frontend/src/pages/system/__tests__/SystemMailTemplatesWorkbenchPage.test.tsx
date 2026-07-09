import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import SystemMailTemplatesWorkbenchPage from '../SystemMailTemplatesWorkbenchPage';
import { mailTemplateApi } from '../../../api/mailTemplate';

vi.mock('../../../api/mailTemplate', () => ({
  mailTemplateApi: {
    list: vi.fn(),
    getById: vi.fn(),
    getByCode: vi.fn(),
    meta: vi.fn(),
    preview: vi.fn(),
  },
}));

const mockedApi = vi.mocked(mailTemplateApi);

describe('SystemMailTemplatesWorkbenchPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedApi.list.mockResolvedValue({ records: [template()], total: 1, size: 20, current: 1, pages: 1, tenantScoped: true });
    mockedApi.getById.mockResolvedValue(template());
    mockedApi.getByCode.mockResolvedValue(template());
    mockedApi.meta.mockResolvedValue({
      categories: [{ value: 'system', label: '系统' }],
      contentTypes: [{ value: 'HTML', label: 'HTML' }],
      statuses: [{ value: '1', label: '启用' }],
      previewVariablePolicy: {
        htmlEscaped: true,
        whitelistOnly: true,
        nonPersistent: true,
        sensitiveVariableNames: ['token'],
      },
      tenantScoped: true,
      readonlyBoundary: '邮件模板 catalog + safe preview',
      nonGoals: ['不发送邮件', '不配置 SMTP/邮件网关'],
    });
    mockedApi.preview.mockResolvedValue({
      renderedSubject: '资产 &lt;A&gt;',
      renderedContent: '正文 &lt;A&gt;',
      missingVariables: ['dueDate'],
      rejectedVariables: [{ name: 'token', reason: '敏感变量名已拒绝' }],
      usedVariables: ['assetName'],
      nonPersistent: true,
    });
  });

  it('真实调用 template catalog、详情、code、meta 与 preview wrapper 并展示非发送边界', async () => {
    const { container } = render(<SystemMailTemplatesWorkbenchPage embeddedInWorkbench />);

    expect(screen.getByText('邮件模板加载中...')).toBeInTheDocument();
    expect(await screen.findByRole('heading', { name: '模板 catalog' })).toBeInTheDocument();
    expect(container.querySelector('[data-system-mail-templates="workbench-v3"]')).toHaveAttribute('data-embedded', 'true');
    expect(screen.getByText(/真实调用 \/mail-templates\/list/)).toBeInTheDocument();
    expect(screen.getByText(/不发送邮件、不配置 SMTP\/邮件网关、不处理邮件日志\/重试\/导出、不接入流程邮件/)).toBeInTheDocument();
    expect(screen.getByText(/nonPersistent=true/)).toBeInTheDocument();
    expect(mockedApi.list).toHaveBeenCalledWith({ page: 1, pageSize: 20 });
    expect(mockedApi.meta).toHaveBeenCalled();
    expect(mockedApi.getById).toHaveBeenCalledWith(5);
    expect(mockedApi.getByCode).toHaveBeenCalledWith('ASSET_EXPIRE_MAIL');

    await userEvent.click(screen.getByRole('button', { name: '生成无持久化预览' }));
    await waitFor(() => expect(mockedApi.preview).toHaveBeenCalledWith(expect.objectContaining({ templateId: 5 })));
    expect(await screen.findByLabelText('邮件模板预览结果')).toHaveTextContent('missingVariables：dueDate');
    expect(screen.getByLabelText('邮件模板预览结果')).toHaveTextContent('rejectedVariables：token:敏感变量名已拒绝');
    expect(screen.getByLabelText('邮件模板预览结果')).toHaveTextContent('usedVariables：assetName');
  });

  it('支持筛选、按编码重新加载，且无权限时不调用 wrapper', async () => {
    render(<SystemMailTemplatesWorkbenchPage />);
    expect((await screen.findAllByText(/资产到期邮件/)).length).toBeGreaterThan(0);

    await userEvent.type(screen.getByPlaceholderText('按编码、名称或正文搜索'), '资产');
    await userEvent.selectOptions(screen.getByLabelText('邮件模板分类'), 'system');
    await userEvent.selectOptions(screen.getByLabelText('邮件模板内容类型'), 'HTML');
    await userEvent.click(screen.getByRole('button', { name: '查询' }));
    await waitFor(() => expect(mockedApi.list).toHaveBeenLastCalledWith(expect.objectContaining({ keyword: '资产', category: 'system', contentType: 'HTML' })));

    await userEvent.clear(screen.getByLabelText('按编码查询'));
    await userEvent.type(screen.getByLabelText('按编码查询'), 'ASSET_EXPIRE_MAIL');
    await userEvent.click(screen.getByRole('button', { name: '按编码加载' }));
    await waitFor(() => expect(mockedApi.getByCode).toHaveBeenLastCalledWith('ASSET_EXPIRE_MAIL'));

    vi.clearAllMocks();
    render(<SystemMailTemplatesWorkbenchPage canView={false} />);
    expect(screen.getByRole('alert')).toHaveTextContent('无权限访问邮件模板 catalog');
    expect(mockedApi.list).not.toHaveBeenCalled();
  });

  function template() {
    return {
      id: 5,
      tenantId: 'tenant-a',
      templateCode: 'ASSET_EXPIRE_MAIL',
      templateName: '资产到期邮件',
      category: 'system',
      subjectTemplate: '资产 {{assetName}}',
      contentTemplate: '正文 {{assetName}}',
      contentType: 'HTML',
      variables: '["assetName","dueDate"]',
      status: 1,
    };
  }
});
