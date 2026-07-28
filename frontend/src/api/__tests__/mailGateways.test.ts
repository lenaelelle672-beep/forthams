import { readFileSync } from 'node:fs';
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
import { mailGatewayApi } from '@/api/mailGateways';

const mockedHttp = {
  get: vi.mocked(http.get),
  post: vi.mocked(http.post),
  put: vi.mocked(http.put),
  delete: vi.mocked(http.delete),
};
const wrapperSource = readFileSync('src/api/mailGateways.ts', 'utf8');

describe('api/mailGateways', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('只调用 /system/mail-gateways list/getById/meta/preview 合同', async () => {
    const gateway = {
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
      tenantScoped: true,
      readOnly: true,
    };
    const page = { records: [gateway], total: 1, page: 1, pageSize: 20, pages: 1, tenantScoped: true, readOnly: true, readonlyBoundary: '只读邮件网关目录' };
    const meta = {
      tlsModes: [{ value: 'STARTTLS', label: 'STARTTLS 元数据' }],
      lastTestStatuses: [{ value: 'SUCCESS', label: '最近验证成功' }],
      allowedPreviewFields: ['hostMasked', 'port', 'tlsMode'],
      previewPolicy: { tenantScoped: true, noPersistence: true, noSend: true, noNetwork: true, runtimeEffect: false, cacheRefreshed: false, credentialExposed: false, smtpConnect: false, javaMailSenderUsed: false, mailSenderProviderUsed: false },
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
    const preview = { previewAccepted: true, configured: true, acceptedFields: ['hostMasked'], rejectedInputs: [], warnings: [], tenantScoped: true, readOnly: true, noPersistence: true, noSend: true, noNetwork: true, runtimeEffect: false, cacheRefreshed: false, credentialExposed: false, smtpConnect: false, javaMailSenderUsed: false, mailSenderProviderUsed: false, readonlyBoundary: '只读邮件网关目录' };

    mockedHttp.get
      .mockResolvedValueOnce(page)
      .mockResolvedValueOnce(gateway)
      .mockResolvedValueOnce(meta);
    mockedHttp.post.mockResolvedValueOnce(preview);

    await expect(mailGatewayApi.list({ page: 1, pageSize: 20 })).resolves.toBe(page);
    await expect(mailGatewayApi.getById(8)).resolves.toBe(gateway);
    await expect(mailGatewayApi.meta()).resolves.toBe(meta);
    await expect(mailGatewayApi.preview({ hostMasked: 'smtp.***.corp', port: 587, tlsMode: 'STARTTLS' })).resolves.toBe(preview);

    expect(mockedHttp.get).toHaveBeenNthCalledWith(1, '/system/mail-gateways', { params: { page: 1, pageSize: 20 } });
    expect(mockedHttp.get).toHaveBeenNthCalledWith(2, '/system/mail-gateways/8');
    expect(mockedHttp.get).toHaveBeenNthCalledWith(3, '/system/mail-gateways/meta');
    expect(mockedHttp.post).toHaveBeenCalledWith('/system/mail-gateways/preview', { hostMasked: 'smtp.***.corp', port: 587, tlsMode: 'STARTTLS' });
  });

  it('静态保持专属 wrapper，不暴露 CRUD、连接验证、发送或 workflow helper', () => {
    expect(wrapperSource).toContain("'/system/mail-gateways'");
    expect(wrapperSource).toContain("'/system/mail-gateways/meta'");
    expect(wrapperSource).toContain("'/system/mail-gateways/preview'");
    expect(wrapperSource).not.toMatch(/create\(|update\(|delete\(|save\(|testConnection|\/test`|\/test'|send\(|retry\(|workflowApi|@\/api\/workflow|channelConfigApi|systemConfig|mailTemplateApi|mailLogApi|notificationTemplateApi|notificationPreferenceApi|notificationSwitchApi|routePermissions|auth\/login\/mobile/);
  });
});
