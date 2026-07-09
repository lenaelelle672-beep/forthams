/**
 * systemConfig.test.ts
 *
 * Tests for the system config API module covering:
 * - API call correctness (GET/PUT for system and security config)
 * - @Valid rejection scenarios: empty/invalid config data handling
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock http utility before importing the module
vi.mock('../utils/http', () => ({
  default: {
    get: vi.fn(),
    put: vi.fn(),
    post: vi.fn(),
    delete: vi.fn(),
  },
}));

import http from '../utils/http';
import {
  createSysConfig,
  deleteSysConfig,
  getSysConfigList,
  getSystemBaseParamList,
  getSystemConfig,
  getSecurityConfig,
  previewSysConfig,
  previewSecurityConfig,
  previewSystemConfig,
  refreshSysConfigCache,
  saveSystemConfig,
  saveSecurityConfig,
  updateSysConfig,
} from '../api/systemConfig';

const mockedHttp = vi.mocked(http);

describe('systemConfig API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ── getSystemConfig ──────────────────────────────────────────────────────

  describe('getSystemConfig', () => {
    it('should fetch system config from /system-config/system', async () => {
      const mockData = { companyName: 'Test Corp', systemName: 'AMS' };
      mockedHttp.get.mockResolvedValueOnce({ data: mockData });

      const result = await getSystemConfig();

      expect(mockedHttp.get).toHaveBeenCalledWith('/system-config/system');
      expect(result.data).toEqual(mockData);
    });

    it('should return empty object when no config exists', async () => {
      mockedHttp.get.mockResolvedValueOnce({ data: {} });

      const result = await getSystemConfig();

      expect(result.data).toEqual({});
    });
  });

  // ── saveSystemConfig ─────────────────────────────────────────────────────

  describe('saveSystemConfig', () => {
    it('should PUT config map to /system-config/system', async () => {
      const config = { companyName: 'Test Corp', systemName: 'AMS', timezone: 'UTC+8' };
      mockedHttp.put.mockResolvedValueOnce({});

      await saveSystemConfig(config);

      expect(mockedHttp.put).toHaveBeenCalledWith('/system-config/system', config);
    });

    it('should PUT audited SYSTEM config payload to /system-config/system', async () => {
      const config = { systemName: 'AMS Pro' };
      const audit = { operatorId: 42, reason: 'V3 基础参数保存复核' };
      mockedHttp.put.mockResolvedValueOnce({ systemName: 'AMS Pro' });

      await saveSystemConfig(config, audit);

      expect(mockedHttp.put).toHaveBeenCalledWith('/system-config/system', { configs: config, ...audit });
    });

    it('should accept empty config map without error', async () => {
      mockedHttp.put.mockResolvedValueOnce({});

      await saveSystemConfig({});

      expect(mockedHttp.put).toHaveBeenCalledWith('/system-config/system', {});
    });
  });

  // ── getSecurityConfig ────────────────────────────────────────────────────

  describe('getSecurityConfig', () => {
    it('should fetch security config from /system-config/security', async () => {
      const mockData = { minLength: '8', enableAuditLog: 'true' };
      mockedHttp.get.mockResolvedValueOnce({ data: mockData });

      const result = await getSecurityConfig();

      expect(mockedHttp.get).toHaveBeenCalledWith('/system-config/security');
      expect(result.data).toEqual(mockData);
    });
  });

  // ── saveSecurityConfig ───────────────────────────────────────────────────

  describe('saveSecurityConfig', () => {
    it('should PUT security config map to /system-config/security', async () => {
      const config = { minLength: '8', requireUppercase: 'true' };
      mockedHttp.put.mockResolvedValueOnce({});

      await saveSecurityConfig(config);

      expect(mockedHttp.put).toHaveBeenCalledWith('/system-config/security', config);
    });

    it('keeps SECURITY wrapper compatibility for audited save', async () => {
      const config = { minLength: '12' };
      mockedHttp.put.mockResolvedValueOnce({ minLength: '12' });

      await saveSecurityConfig(config, { operatorId: 42, reason: '兼容保存' });

      expect(mockedHttp.put).toHaveBeenCalledWith('/system-config/security', {
        configs: config,
        operatorId: 42,
        reason: '兼容保存',
      });
    });

    it('should POST SECURITY preview without using generic management or fallback routes', async () => {
      const preview = {
        configGroup: 'SECURITY',
        changedKeys: ['signIn.maxAttempts'],
        beforeMasked: { 'signIn.maxAttempts': '5' },
        afterMasked: { 'signIn.maxAttempts': '6' },
        impactModules: ['Workbench V3 system-security-policy'],
        riskLevel: 'LOW',
        validationErrors: [],
        persistent: false,
        cacheRefreshed: false,
        runtimeEffect: false,
      };
      mockedHttp.post.mockResolvedValueOnce(preview);

      const result = await previewSecurityConfig({
        configs: { 'signIn.maxAttempts': '6' },
        operatorId: 42,
        reason: '配置态预览',
      });

      expect(mockedHttp.post).toHaveBeenCalledWith('/system-config/security/preview', expect.objectContaining({
        configs: { 'signIn.maxAttempts': '6' },
        operatorId: 42,
      }));
      expect(result.runtimeEffect).toBe(false);
      expect(result.persistent).toBe(false);
      expect(result.cacheRefreshed).toBe(false);
      expect(JSON.stringify(mockedHttp.post.mock.calls)).not.toMatch(/workflow|public\/mock|fixed-assets\/workbench\?menu=|routePermissions|auth\/login\/mobile/);
    });
  });

  describe('SYSTEM typed list/save/preview/refresh wrappers', () => {
    it('should list SYSTEM base params through /system/configs with explicit group', async () => {
      mockedHttp.get.mockResolvedValueOnce({ records: [], total: 0, size: 20, current: 1 });

      await getSystemBaseParamList({ page: 1, pageSize: 20 });

      expect(mockedHttp.get).toHaveBeenCalledWith('/system/configs', {
        params: { page: 1, pageSize: 20, configGroup: 'SYSTEM' },
      });
    });

    it('should preserve generic system config list/create/update/delete paths', async () => {
      mockedHttp.get.mockResolvedValueOnce({ records: [], total: 0, size: 10, current: 1 });
      mockedHttp.post.mockResolvedValueOnce({ id: 7, configKey: 'systemName' });
      mockedHttp.put.mockResolvedValueOnce({ id: 7, configKey: 'systemName' });
      mockedHttp.delete.mockResolvedValueOnce({});

      await getSysConfigList({ configKey: 'system', configGroup: 'SYSTEM' });
      await createSysConfig({ configGroup: 'SYSTEM', configKey: 'systemName', configValue: 'AMS', operatorId: 42, reason: '新增' } as any);
      await updateSysConfig(7, { configValue: 'AMS Pro', operatorId: 42, reason: '更新' } as any);
      await deleteSysConfig(7, { operatorId: 42, reason: '移除', confirmed: true });

      expect(mockedHttp.get).toHaveBeenCalledWith('/system/configs', { params: { configKey: 'system', configGroup: 'SYSTEM' } });
      expect(mockedHttp.post).toHaveBeenCalledWith('/system/configs', expect.objectContaining({ configGroup: 'SYSTEM' }));
      expect(mockedHttp.put).toHaveBeenCalledWith('/system/configs/7', expect.objectContaining({ configValue: 'AMS Pro' }));
      expect(mockedHttp.delete).toHaveBeenCalledWith('/system/configs/7', { data: { operatorId: 42, reason: '移除', confirmed: true } });
    });

    it('should preview without persistence and never use a void cache success contract', async () => {
      const preview = {
        configGroup: 'SYSTEM',
        changedKeys: ['systemName'],
        beforeMasked: { systemName: 'AMS' },
        afterMasked: { systemName: 'AMS Pro' },
        impactModules: ['Workbench V3 system-base-params'],
        riskLevel: 'LOW',
        validationErrors: [],
        persistent: false,
        cacheRefreshed: false,
        runtimeEffect: false,
      };
      const refresh = {
        overallStatus: 'DEGRADED',
        namespaceResults: [{ namespace: 'system-config:SYSTEM', status: 'DEGRADED', itemCount: 3, message: '未接入真实缓存' }],
        refreshedCount: 0,
        degradedCount: 1,
        message: '明确降级',
      };
      mockedHttp.post.mockResolvedValueOnce(preview).mockResolvedValueOnce(preview).mockResolvedValueOnce(refresh);

      const systemPreview = await previewSystemConfig({ configs: { systemName: 'AMS Pro' }, operatorId: 42, reason: '预演' });
      const rowPreview = await previewSysConfig({ configGroup: 'SYSTEM', configKey: 'systemName', configValue: 'AMS Pro', operatorId: 42, reason: '预演' } as any);
      const refreshResult = await refreshSysConfigCache({ operatorId: 42, reason: '刷新缓存', confirmed: true, namespaces: ['system-config:SYSTEM'] });

      expect(mockedHttp.post).toHaveBeenNthCalledWith(1, '/system-config/system/preview', expect.objectContaining({ configs: { systemName: 'AMS Pro' } }));
      expect(mockedHttp.post).toHaveBeenNthCalledWith(2, '/system/configs/preview', expect.objectContaining({ configKey: 'systemName' }));
      expect(mockedHttp.post).toHaveBeenNthCalledWith(3, '/system/configs/refresh-cache', expect.objectContaining({ namespaces: ['system-config:SYSTEM'] }));
      expect(systemPreview.persistent).toBe(false);
      expect(rowPreview.cacheRefreshed).toBe(false);
      expect(refreshResult.overallStatus).toBe('DEGRADED');
      expect(refreshResult.namespaceResults).toHaveLength(1);
    });
  });
});
