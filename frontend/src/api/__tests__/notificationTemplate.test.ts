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

  it('uses the current flow notification switch backend contract', async () => {
    const switches = [
      {
        id: 9,
        bizType: 'maintenance',
        event: 'approved',
        enabled: 0,
        templateCode: 'MAINT_APPROVED',
      },
    ];

    mockedHttp.get.mockResolvedValueOnce(switches).mockResolvedValueOnce(switches);
    mockedHttp.put.mockResolvedValueOnce(undefined);

    await expect(notificationSwitchApi.list()).resolves.toBe(switches);
    await expect(notificationSwitchApi.getByBizType('maintenance')).resolves.toBe(switches);
    await expect(notificationSwitchApi.updateEnabled(9, 1)).resolves.toBeUndefined();

    expect(mockedHttp.get).toHaveBeenNthCalledWith(1, '/notification-switches/list');
    expect(mockedHttp.get).toHaveBeenNthCalledWith(2, '/notification-switches/biz-type/maintenance');
    expect(mockedHttp.put).toHaveBeenCalledWith('/notification-switches/9', null, { params: { enabled: 1 } });
  });

  it('keeps notification template and preference APIs on their established paths', async () => {
    const listParams = { page: 1, pageSize: 20, category: 'system', keyword: 'ops' };
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
    const pageResponse = { records: [template], total: 1, size: 20, current: 1, pages: 1 };

    mockedHttp.get
      .mockResolvedValueOnce(pageResponse)
      .mockResolvedValueOnce(template)
      .mockResolvedValueOnce(template)
      .mockResolvedValueOnce([preference])
      .mockResolvedValueOnce(preference);
    mockedHttp.post.mockResolvedValueOnce(template);
    mockedHttp.put
      .mockResolvedValueOnce(template)
      .mockResolvedValueOnce(preference)
      .mockResolvedValueOnce(undefined);
    mockedHttp.delete.mockResolvedValueOnce(undefined);

    await expect(notificationTemplateApi.list(listParams)).resolves.toBe(pageResponse);
    await expect(notificationTemplateApi.getById(3)).resolves.toBe(template);
    await expect(notificationTemplateApi.getByCode('SYS_NOTICE')).resolves.toBe(template);
    await expect(notificationTemplateApi.create(template)).resolves.toBe(template);
    await expect(notificationTemplateApi.update(3, { templateName: '新系统通知' })).resolves.toBe(template);
    await expect(notificationTemplateApi.delete(3)).resolves.toBeUndefined();
    await expect(notificationPreferenceApi.list()).resolves.toEqual([preference]);
    await expect(notificationPreferenceApi.getByCategory('system')).resolves.toBe(preference);
    await expect(notificationPreferenceApi.save(preference)).resolves.toBe(preference);
    await expect(notificationPreferenceApi.batchSave([preference])).resolves.toBeUndefined();

    expect(mockedHttp.get).toHaveBeenNthCalledWith(1, '/notification-templates/list', { params: listParams });
    expect(mockedHttp.get).toHaveBeenNthCalledWith(2, '/notification-templates/3');
    expect(mockedHttp.get).toHaveBeenNthCalledWith(3, '/notification-templates/code/SYS_NOTICE');
    expect(mockedHttp.post).toHaveBeenCalledWith('/notification-templates', template);
    expect(mockedHttp.put).toHaveBeenNthCalledWith(1, '/notification-templates/3', { templateName: '新系统通知' });
    expect(mockedHttp.delete).toHaveBeenCalledWith('/notification-templates/3');
    expect(mockedHttp.get).toHaveBeenNthCalledWith(4, '/notification-preferences');
    expect(mockedHttp.get).toHaveBeenNthCalledWith(5, '/notification-preferences/system');
    expect(mockedHttp.put).toHaveBeenNthCalledWith(2, '/notification-preferences', preference);
    expect(mockedHttp.put).toHaveBeenNthCalledWith(3, '/notification-preferences/batch', [preference]);
  });
});
