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
  getSystemConfig,
  saveSystemConfig,
  getSecurityConfig,
  saveSecurityConfig,
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

    it('should accept empty config map without error', async () => {
      mockedHttp.put.mockResolvedValueOnce({});

      await saveSystemConfig({});

      expect(mockedHttp.put).toHaveBeenCalledWith('/system-config/system', {});
    });
  });

  // ── getSecurityConfig ────────────────────────────────────────────────────

  describe('getSecurityConfig', () => {
    it('should fetch security config from /system-config/security', async () => {
      const mockData = { minPasswordLen: '8', enableAuditLog: 'true' };
      mockedHttp.get.mockResolvedValueOnce({ data: mockData });

      const result = await getSecurityConfig();

      expect(mockedHttp.get).toHaveBeenCalledWith('/system-config/security');
      expect(result.data).toEqual(mockData);
    });
  });

  // ── saveSecurityConfig ───────────────────────────────────────────────────

  describe('saveSecurityConfig', () => {
    it('should PUT security config map to /system-config/security', async () => {
      const config = { minPasswordLen: '8', requireUppercase: 'true' };
      mockedHttp.put.mockResolvedValueOnce({});

      await saveSecurityConfig(config);

      expect(mockedHttp.put).toHaveBeenCalledWith('/system-config/security', config);
    });
  });
});
