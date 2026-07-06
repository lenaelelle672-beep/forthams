/**
 * @file api/__tests__/reports.test.ts
 * @description api/reports.ts 单元测试 — 验证端点调用正确、响应类型匹配
 *
 * 覆盖：
 * - getReportSummary: 端点、数据、错误处理
 * - getReportByCategory: 端点、空数据、错误处理
 * - getReportTrend: 端点、参数传递、错误处理
 */

import { afterEach, describe, it, expect, vi, beforeEach } from 'vitest';

// Mock http utility
vi.mock('@/utils/http', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
  },
}));

import http from '@/utils/http';
import {
  getDepreciationStats,
  getMaintenanceStats,
  getReportSummary,
  getReportByCategory,
  getReportTrend,
  getRetirementStats,
  getWorkOrderDeptPending,
  getWorkOrderStatusDistribution,
  exportReportPdf,
  downloadBlob,
} from '@/api/reports';

const mockedHttp = vi.mocked(http);

describe('api/reports — 报表 API 调用测试', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  // ── getReportSummary ──────────────────────────────────────────────────

  describe('getReportSummary', () => {
    it('应正确调用 GET /reports/summary 端点', async () => {
      const mockResponse = {
        totalAssets: 1200,
        activeAssets: 850,
        pendingApproval: 23,
        recentlyRetired: 45,
      };
      mockedHttp.get.mockResolvedValueOnce(mockResponse);

      const result = await getReportSummary();

      expect(mockedHttp.get).toHaveBeenCalledWith('/reports/summary');
      expect(result.totalAssets).toBe(1200);
      expect(result.activeAssets).toBe(850);
      expect(result.pendingApproval).toBe(23);
      expect(result.recentlyRetired).toBe(45);
    });

    it('应返回正确的 TypeScript 类型结构', async () => {
      const mockResponse = {
        totalAssets: 0,
        activeAssets: 0,
        pendingApproval: 0,
        recentlyRetired: 0,
      };
      mockedHttp.get.mockResolvedValueOnce(mockResponse);

      const result = await getReportSummary();

      // 验证所有必需字段都存在且类型正确
      const summary = result;
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
      mockedHttp.get.mockResolvedValueOnce(mockCategories);

      const result = await getReportByCategory();

      expect(mockedHttp.get).toHaveBeenCalledWith('/reports/by-category');
      expect(result).toHaveLength(2);
      expect(result[0].categoryName).toBe('电子设备');
      expect(result[0].assetCount).toBe(350);
    });

    it('应在无分类数据时返回空数组', async () => {
      mockedHttp.get.mockResolvedValueOnce([]);

      const result = await getReportByCategory();

      expect(result).toEqual([]);
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
      const mockResponse = [
        { month: '2026-01', assetCount: 100, totalValue: 5000000 },
        { month: '2026-02', assetCount: 110, totalValue: 5500000 },
      ];
      mockedHttp.get.mockResolvedValueOnce(mockResponse);

      const result = await getReportTrend();

      expect(mockedHttp.get).toHaveBeenCalledWith('/reports/trend', { params: { months: 12 } });
      expect(result).toHaveLength(2);
    });

    it('应支持自定义月份参数', async () => {
      mockedHttp.get.mockResolvedValueOnce([]);

      await getReportTrend(6);

      expect(mockedHttp.get).toHaveBeenCalledWith('/reports/trend', { params: { months: 6 } });
    });

    it('应返回正确的 TrendReport 字段', async () => {
      const mockResponse = [
        { month: '2026-03', assetCount: 120, totalValue: 6000000 },
      ];
      mockedHttp.get.mockResolvedValueOnce(mockResponse);

      const result = await getReportTrend(3);

      expect(result[0]).toHaveProperty('month');
      expect(result[0]).toHaveProperty('assetCount');
      expect(result[0]).toHaveProperty('totalValue');
      expect(typeof result[0].month).toBe('string');
      expect(typeof result[0].assetCount).toBe('number');
    });

    it('应处理网络错误', async () => {
      mockedHttp.get.mockRejectedValueOnce(new Error('Network Error'));

      await expect(getReportTrend()).rejects.toThrow('Network Error');
    });
  });

  it('应正确调用月度统计和工单统计端点，并直接返回业务数组', async () => {
    const monthly = [{ month: '6月', value: 12 }];
    const pairs = [{ name: '待处理', value: 3 }];

    mockedHttp.get
      .mockResolvedValueOnce(monthly)
      .mockResolvedValueOnce(monthly)
      .mockResolvedValueOnce(monthly)
      .mockResolvedValueOnce(pairs)
      .mockResolvedValueOnce(pairs);

    await expect(getDepreciationStats()).resolves.toBe(monthly);
    await expect(getMaintenanceStats()).resolves.toBe(monthly);
    await expect(getRetirementStats()).resolves.toBe(monthly);
    await expect(getWorkOrderStatusDistribution()).resolves.toBe(pairs);
    await expect(getWorkOrderDeptPending()).resolves.toBe(pairs);

    expect(mockedHttp.get).toHaveBeenNthCalledWith(1, '/reports/depreciation-stats');
    expect(mockedHttp.get).toHaveBeenNthCalledWith(2, '/reports/maintenance-stats');
    expect(mockedHttp.get).toHaveBeenNthCalledWith(3, '/reports/retirement-stats');
    expect(mockedHttp.get).toHaveBeenNthCalledWith(4, '/workorders/status-distribution');
    expect(mockedHttp.get).toHaveBeenNthCalledWith(5, '/workorders/dept-pending');
  });

  it('应按模板类型导出 PDF Blob', async () => {
    const blob = new Blob(['pdf'], { type: 'application/pdf' });
    mockedHttp.post.mockResolvedValueOnce(blob);

    await expect(exportReportPdf('asset-register', { tenantId: 1 })).resolves.toBe(blob);

    expect(mockedHttp.post).toHaveBeenCalledWith('/reports/asset-register/export-pdf', { tenantId: 1 }, {
      responseType: 'blob',
    });
  });

  it('未传 PDF 参数时应发送空对象', async () => {
    const blob = new Blob(['pdf'], { type: 'application/pdf' });
    mockedHttp.post.mockResolvedValueOnce(blob);

    await exportReportPdf('summary');

    expect(mockedHttp.post).toHaveBeenCalledWith('/reports/summary/export-pdf', {}, {
      responseType: 'blob',
    });
  });

  it('downloadBlob 应创建临时链接并释放 Object URL', () => {
    const createObjectURL = vi.fn((_blob: Blob) => 'blob:report-pdf');
    const revokeObjectURL = vi.fn((_url: string) => undefined);
    vi.stubGlobal('URL', {
      ...URL,
      createObjectURL,
      revokeObjectURL,
    });
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);

    const blob = new Blob(['pdf'], { type: 'application/pdf' });
    downloadBlob(blob, 'summary.pdf');

    expect(createObjectURL).toHaveBeenCalledWith(blob);
    expect(HTMLAnchorElement.prototype.click).toHaveBeenCalledTimes(1);
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:report-pdf');
    expect(document.querySelector('a[download="summary.pdf"]')).not.toBeInTheDocument();
  });
});
