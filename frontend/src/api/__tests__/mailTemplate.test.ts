import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/utils/http', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
}));

import http from '@/utils/http';
import { mailLogApi, mailTemplateApi } from '@/api/mailTemplate';

const mockedHttp = vi.mocked(http);

describe('api/mailTemplate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('keeps mail template catalog paths and adds meta plus no-persistence preview', async () => {
    const listParams = { page: 1, pageSize: 20, category: 'system', keyword: '资产' };
    const template = {
      id: 5,
      templateCode: 'ASSET_EXPIRE_MAIL',
      templateName: '资产到期邮件',
      subjectTemplate: '资产 {{assetName}}',
      contentTemplate: '正文 {{assetName}}',
      contentType: 'HTML',
      status: 1,
    };
    const pageResponse = { records: [template], total: 1, size: 20, current: 1, pages: 1 };
    const meta = {
      categories: [{ value: 'system', label: '系统' }],
      contentTypes: [{ value: 'HTML', label: 'HTML' }],
      statuses: [{ value: '1', label: '启用' }],
      previewVariablePolicy: {
        htmlEscaped: true,
        whitelistOnly: true,
        nonPersistent: true,
        sensitiveVariableNames: ['token'],
      },
    };
    const preview = {
      renderedSubject: '资产 A',
      renderedContent: '正文 A',
      missingVariables: [],
      rejectedVariables: [{ name: 'token', reason: '敏感变量名已拒绝' }],
      usedVariables: ['assetName'],
      nonPersistent: true as const,
    };

    mockedHttp.get
      .mockResolvedValueOnce(pageResponse)
      .mockResolvedValueOnce(template)
      .mockResolvedValueOnce(template)
      .mockResolvedValueOnce(meta);
    mockedHttp.post.mockResolvedValueOnce(preview).mockResolvedValueOnce(template);
    mockedHttp.put.mockResolvedValueOnce(template);
    mockedHttp.delete.mockResolvedValueOnce(undefined);

    await expect(mailTemplateApi.list(listParams)).resolves.toBe(pageResponse);
    await expect(mailTemplateApi.getById(5)).resolves.toBe(template);
    await expect(mailTemplateApi.getByCode('ASSET_EXPIRE_MAIL')).resolves.toBe(template);
    await expect(mailTemplateApi.meta()).resolves.toBe(meta);
    await expect(mailTemplateApi.preview({ templateId: 5, variables: { assetName: 'A', token: '已拒绝' } })).resolves.toBe(preview);
    await expect(mailTemplateApi.create(template)).resolves.toBe(template);
    await expect(mailTemplateApi.update(5, { templateName: '新资产到期邮件' })).resolves.toBe(template);
    await expect(mailTemplateApi.delete(5)).resolves.toBeUndefined();

    expect(mockedHttp.get).toHaveBeenNthCalledWith(1, '/mail-templates/list', { params: listParams });
    expect(mockedHttp.get).toHaveBeenNthCalledWith(2, '/mail-templates/5');
    expect(mockedHttp.get).toHaveBeenNthCalledWith(3, '/mail-templates/code/ASSET_EXPIRE_MAIL');
    expect(mockedHttp.get).toHaveBeenNthCalledWith(4, '/mail-templates/meta');
    expect(mockedHttp.post).toHaveBeenNthCalledWith(1, '/mail-templates/preview', { templateId: 5, variables: { assetName: 'A', token: '已拒绝' } });
    expect(mockedHttp.post).toHaveBeenNthCalledWith(2, '/mail-templates', template);
    expect(mockedHttp.put).toHaveBeenCalledWith('/mail-templates/5', { templateName: '新资产到期邮件' });
    expect(mockedHttp.delete).toHaveBeenCalledWith('/mail-templates/5');
  });

  it('does not change mailLogApi paths while adding mailTemplateApi preview', async () => {
    const log = { id: 7, mailTo: 'ops@example.com', sendStatus: 'FAILED' };
    const pageResponse = { records: [log], total: 1, size: 10, current: 1, pages: 1 };
    mockedHttp.get
      .mockResolvedValueOnce(pageResponse)
      .mockResolvedValueOnce(log)
      .mockResolvedValueOnce([log]);
    mockedHttp.post.mockResolvedValueOnce(undefined);

    await expect(mailLogApi.list({ page: 1, pageSize: 10, sendStatus: 'FAILED' })).resolves.toBe(pageResponse);
    await expect(mailLogApi.getById(7)).resolves.toBe(log);
    await expect(mailLogApi.getByBiz('asset', 18)).resolves.toEqual([log]);
    await expect(mailLogApi.retry(7)).resolves.toBeUndefined();

    expect(mockedHttp.get).toHaveBeenNthCalledWith(1, '/mail-logs/list', { params: { page: 1, pageSize: 10, sendStatus: 'FAILED' } });
    expect(mockedHttp.get).toHaveBeenNthCalledWith(2, '/mail-logs/7');
    expect(mockedHttp.get).toHaveBeenNthCalledWith(3, '/mail-logs/biz', { params: { bizType: 'asset', bizId: 18 } });
    expect(mockedHttp.post).toHaveBeenCalledWith('/mail-logs/7/retry');
  });
});
