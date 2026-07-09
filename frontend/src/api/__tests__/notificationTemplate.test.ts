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
import {
  notificationPreferenceApi,
  notificationSwitchApi,
  notificationTemplateApi,
} from '@/api/notificationTemplate';

const mockedHttp = vi.mocked(http);

describe('api/notificationTemplate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('uses the read-only notification switch backend contract and keeps updateEnabled as compatibility only', async () => {
    const switches = [
      {
        id: 9,
        bizType: 'maintenance',
        event: 'approved',
        channelType: 'IN_APP',
        enabled: 0,
        templateCode: 'MAINT_APPROVED',
      },
    ];
    const meta = {
      bizTypes: [{ value: 'maintenance', label: '维保' }],
      events: [{ value: 'approved', label: '通过' }],
      channelTypes: [{ value: 'IN_APP', label: '站内信' }],
      statuses: [{ value: '1', label: '允许通知' }],
      previewPolicy: { tenantScoped: true, noPersistence: true, noSend: true, workflowRuntimeEffect: false as const },
      tenantScoped: true,
      readOnly: true,
      noPersistencePreview: true,
      noSend: true,
      workflowRuntimeEffect: false as const,
    };
    const preview = {
      wouldNotify: false,
      blockedBySwitch: true,
      matchedSwitches: switches,
      missingSwitches: [],
      rejectedInputs: [{ field: 'tenantId', reason: '已拒绝' }],
      tenantScoped: true,
      noPersistence: true as const,
      noSend: true as const,
      workflowRuntimeEffect: false as const,
      readonlyBoundary: '只读流程通知开关目录',
    };

    mockedHttp.get
      .mockResolvedValueOnce(switches)
      .mockResolvedValueOnce(switches)
      .mockResolvedValueOnce(meta);
    mockedHttp.post.mockResolvedValueOnce(preview);
    mockedHttp.put.mockResolvedValueOnce(undefined);

    await expect(notificationSwitchApi.list()).resolves.toBe(switches);
    await expect(notificationSwitchApi.getByBizType('maintenance')).resolves.toBe(switches);
    await expect(notificationSwitchApi.meta()).resolves.toBe(meta);
    await expect(notificationSwitchApi.preview({ bizType: 'maintenance', event: 'approved', channelType: 'IN_APP', tenantId: 'tenant-b' })).resolves.toBe(preview);
    await expect(notificationSwitchApi.updateEnabled(9, 1)).resolves.toBeUndefined();

    expect(mockedHttp.get).toHaveBeenNthCalledWith(1, '/notification-switches/list');
    expect(mockedHttp.get).toHaveBeenNthCalledWith(2, '/notification-switches/biz-type/maintenance');
    expect(mockedHttp.get).toHaveBeenNthCalledWith(3, '/notification-switches/meta');
    expect(mockedHttp.post).toHaveBeenCalledWith('/notification-switches/preview', { bizType: 'maintenance', event: 'approved', channelType: 'IN_APP', tenantId: 'tenant-b' });
    expect(mockedHttp.put).toHaveBeenCalledWith('/notification-switches/9', null, { params: { enabled: 1 } });
  });

  it('keeps notification template and preference APIs on their established paths', async () => {
    const listParams = { page: 1, pageSize: 20, category: 'system', channelType: 'IN_APP', status: 1, keyword: 'ops' };
    const template = {
      id: 3,
      templateCode: 'SYS_NOTICE',
      templateName: '系统通知',
      channelType: 'IN_APP',
      titleTemplate: '标题',
      contentTemplate: '正文',
      status: 1,
    };
    const preference = {
      id: 5,
      category: 'system',
      inApp: 1,
      email: 0,
    };
    const preferenceMeta = {
      categories: [{ value: 'system', label: '系统' }],
      channelTypes: [{ value: 'IN_APP', label: '站内信' }],
      statuses: [{ value: '1', label: '启用' }],
      quietWindowPolicy: { format: 'HH:mm', crossMidnightSupported: true },
      previewPolicy: { tenantScoped: true, noPersistence: true, noSend: true, runtimeEffect: false as const },
      tenantScoped: true,
      noPersistencePreview: true,
      runtimeEffect: false as const,
    };
    const preferencePreview = {
      wouldReceive: false,
      inAppEnabled: true,
      emailEnabled: false,
      quietWindowMatched: true,
      missingPreferences: [],
      rejectedInputs: [],
      tenantScoped: true,
      noPersistence: true as const,
      runtimeEffect: false as const,
      readonlyBoundary: '只读通知偏好目录',
    };
    const pageResponse = { records: [template], total: 1, size: 20, current: 1, pages: 1 };
    const meta = {
      categories: [{ value: 'system', label: '系统' }],
      channelTypes: [{ value: 'IN_APP', label: '站内信' }],
      statuses: [{ value: '1', label: '启用' }],
      previewVariablePolicy: {
        htmlEscaped: true,
        whitelistOnly: true,
        nonPersistent: true,
        sensitiveVariableNames: ['token'],
      },
    };
    const preview = {
      renderedTitle: '标题',
      renderedContent: '正文',
      missingVariables: [],
      rejectedVariables: [{ name: 'token', reason: '敏感变量名已拒绝' }],
      usedVariables: ['assetName'],
      nonPersistent: true as const,
    };

    mockedHttp.get
      .mockResolvedValueOnce(pageResponse)
      .mockResolvedValueOnce(template)
      .mockResolvedValueOnce(template)
      .mockResolvedValueOnce(meta)
      .mockResolvedValueOnce([preference])
      .mockResolvedValueOnce(preference)
      .mockResolvedValueOnce(preferenceMeta);
    mockedHttp.post
      .mockResolvedValueOnce(preview)
      .mockResolvedValueOnce(template)
      .mockResolvedValueOnce(preferencePreview);
    mockedHttp.put
      .mockResolvedValueOnce(template)
      .mockResolvedValueOnce(preference)
      .mockResolvedValueOnce(undefined);
    mockedHttp.delete.mockResolvedValueOnce(undefined);

    await expect(notificationTemplateApi.list(listParams)).resolves.toBe(pageResponse);
    await expect(notificationTemplateApi.getById(3)).resolves.toBe(template);
    await expect(notificationTemplateApi.getByCode('SYS_NOTICE')).resolves.toBe(template);
    await expect(notificationTemplateApi.meta()).resolves.toBe(meta);
    await expect(notificationTemplateApi.preview({ templateId: 3, variables: { assetName: '资产A', token: '已拒绝' } })).resolves.toBe(preview);
    await expect(notificationTemplateApi.create(template)).resolves.toBe(template);
    await expect(notificationTemplateApi.update(3, { templateName: '新系统通知' })).resolves.toBe(template);
    await expect(notificationTemplateApi.delete(3)).resolves.toBeUndefined();
    await expect(notificationPreferenceApi.list()).resolves.toEqual([preference]);
    await expect(notificationPreferenceApi.getByCategory('system')).resolves.toBe(preference);
    await expect(notificationPreferenceApi.meta()).resolves.toBe(preferenceMeta);
    await expect(notificationPreferenceApi.preview({ category: 'system', channelType: 'IN_APP', sampleTime: '22:30' })).resolves.toBe(preferencePreview);
    await expect(notificationPreferenceApi.save(preference)).resolves.toBe(preference);
    await expect(notificationPreferenceApi.batchSave([preference])).resolves.toBeUndefined();

    expect(mockedHttp.get).toHaveBeenNthCalledWith(1, '/notification-templates/list', { params: listParams });
    expect(mockedHttp.get).toHaveBeenNthCalledWith(2, '/notification-templates/3');
    expect(mockedHttp.get).toHaveBeenNthCalledWith(3, '/notification-templates/code/SYS_NOTICE');
    expect(mockedHttp.get).toHaveBeenNthCalledWith(4, '/notification-templates/meta');
    expect(mockedHttp.post).toHaveBeenNthCalledWith(1, '/notification-templates/preview', { templateId: 3, variables: { assetName: '资产A', token: '已拒绝' } });
    expect(mockedHttp.post).toHaveBeenNthCalledWith(2, '/notification-templates', template);
    expect(mockedHttp.put).toHaveBeenNthCalledWith(1, '/notification-templates/3', { templateName: '新系统通知' });
    expect(mockedHttp.delete).toHaveBeenCalledWith('/notification-templates/3');
    expect(mockedHttp.get).toHaveBeenNthCalledWith(5, '/notification-preferences');
    expect(mockedHttp.get).toHaveBeenNthCalledWith(6, '/notification-preferences/system');
    expect(mockedHttp.get).toHaveBeenNthCalledWith(7, '/notification-preferences/meta');
    expect(mockedHttp.post).toHaveBeenNthCalledWith(3, '/notification-preferences/preview', { category: 'system', channelType: 'IN_APP', sampleTime: '22:30' });
    expect(mockedHttp.put).toHaveBeenNthCalledWith(2, '/notification-preferences', preference);
    expect(mockedHttp.put).toHaveBeenNthCalledWith(3, '/notification-preferences/batch', [preference]);
  });
});
