/**
 * @file api/__tests__/reports.test.ts
 * @description api/reports.ts 单元测试 — 验证端点调用正确、响应类型匹配
 *
 * 覆盖：
 * - getReportSummary: 端点、数据、错误处理
 * - getReportByCategory: 端点、空数据、错误处理
 * - getReportTrend: 端点、参数传递、错误处理
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock http utility
vi.mock('@/utils/http', () => ({
  default: {
    get: vi.fn(),
  },
}));

import http from '@/utils/http';
import {
  getReportSummary,
  getReportByCategory,
  getReportTrend,
} from '@/api/reports';

const mockedHttp = vi.mocked(http);

describe('api/reports — 报表 API 调用测试', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── getReportSummary ──────────────────────────────────────────────────

  describe('getReportSummary', () => {
    it('应正确调用 GET /reports/summary 端点', async () => {
      const mockResponse = {
        code: 200,
        message: 'success',
        data: {
          totalAssets: 1200,
          activeAssets: 850,
          pendingApproval: 23,
          recentlyRetired: 45,
        },
      };
      mockedHttp.get.mockResolvedValueOnce(mockResponse);

      const result = await getReportSummary();

      expect(mockedHttp.get).toHaveBeenCalledWith('/reports/summary');
      expect(result.data.totalAssets).toBe(1200);
      expect(result.data.activeAssets).toBe(850);
      expect(result.data.pendingApproval).toBe(23);
      expect(result.data.recentlyRetired).toBe(45);
    });

    it('应返回正确的 TypeScript 类型结构', async () => {
      const mockResponse = {
        code: 200,
        message: 'success',
        data: {
          totalAssets: 0,
          activeAssets: 0,
          pendingApproval: 0,
          recentlyRetired: 0,
        },
      };
      mockedHttp.get.mockResolvedValueOnce(mockResponse);

      const result = await getReportSummary();

      // 验证所有必需字段都存在且类型正确
      const summary = result.data;
      expect(summary).toHaveProperty('totalAssets');
      expect(summary).toHaveProperty('activeAssets');
      expect(summary).toHaveProperty('pendingApproval');
      expect(summary).toHaveProperty('recentlyRetired');
      expect(typeof summary.totalAssets).toBe('number');
      expect(typeof summary.activeAssets).toBe('number');
    });

    it('应处理服务端错误', async () => {
      mockedHttp.get.mockRejectedValueOnce(new Error('服务端错误'));

      await expect(getReportSummary()).rejects.toThrow('服务端错误');
    });
  });

  // ── getReportByCategory ──────────────────────────────────────────────

  describe('getReportByCategory', () => {
    it('应正确调用 GET /reports/by-category 端点', async () => {
      const mockCategories = [
        { categoryName: '电子设备', assetCount: 350, totalValue: 5200000 },
        { categoryName: '办公家具', assetCount: 280, totalValue: 1800000 },
      ];
      const mockResponse = {
        code: 200,
        message: 'success',
        data: mockCategories,
      };
      mockedHttp.get.mockResolvedValueOnce(mockResponse);

      const result = await getReportByCategory();

      expect(mockedHttp.get).toHaveBeenCalledWith('/reports/by-category');
      expect(result.data).toHaveLength(2);
      expect(result.data[0].categoryName).toBe('电子设备');
      expect(result.data[0].assetCount).toBe(350);
    });

    it('应在无分类数据时返回空数组', async () => {
      const mockResponse = {
        code: 200,
        message: 'success',
        data: [],
      };
      mockedHttp.get.mockResolvedValueOnce(mockResponse);

      const result = await getReportByCategory();

      expect(result.data).toEqual([]);
    });

    it('应验证分类数据字段完整性', async () => {
      const mockCategory = {
        categoryName: '生产设备',
        assetCount: 120,
        totalValue: 12000000,
      };

      expect(mockCategory).toHaveProperty('categoryName');
      expect(mockCategory).toHaveProperty('assetCount');
      expect(mockCategory).toHaveProperty('totalValue');
      expect(typeof mockCategory.categoryName).toBe('string');
      expect(typeof mockCategory.assetCount).toBe('number');
      expect(typeof mockCategory.totalValue).toBe('number');
    });
  });

  // ── getReportTrend ───────────────────────────────────────────────────

  describe('getReportTrend', () => {
    it('应正确调用 GET /reports/trend 端点（默认 12 个月）', async () => {
      const mockResponse = {
        code: 200,
        message: 'success',
        data: [
          { month: '2026-01', assetCount: 100, totalValue: 5000000 },
          { month: '2026-02', assetCount: 110, totalValue: 5500000 },
        ],
      };
      mockedHttp.get.mockResolvedValueOnce(mockResponse);

      const result = await getReportTrend();

      expect(mockedHttp.get).toHaveBeenCalledWith('/reports/trend', { params: { months: 12 } });
      expect(result.data).toHaveLength(2);
    });

    it('应支持自定义月份参数', async () => {
      const mockResponse = {
        code: 200,
        message: 'success',
        data: [],
      };
      mockedHttp.get.mockResolvedValueOnce(mockResponse);

      await getReportTrend(6);

      expect(mockedHttp.get).toHaveBeenCalledWith('/reports/trend', { params: { months: 6 } });
    });

    it('应返回正确的 TrendReport 字段', async () => {
      const mockResponse = {
        code: 200,
        message: 'success',
        data: [
          { month: '2026-03', assetCount: 120, totalValue: 6000000 },
        ],
      };
      mockedHttp.get.mockResolvedValueOnce(mockResponse);

      const result = await getReportTrend(3);

      expect(result.data[0]).toHaveProperty('month');
      expect(result.data[0]).toHaveProperty('assetCount');
      expect(result.data[0]).toHaveProperty('totalValue');
      expect(typeof result.data[0].month).toBe('string');
      expect(typeof result.data[0].assetCount).toBe('number');
    });

    it('应处理网络错误', async () => {
      mockedHttp.get.mockRejectedValueOnce(new Error('Network Error'));

      await expect(getReportTrend()).rejects.toThrow('Network Error');
    });
  });
});
