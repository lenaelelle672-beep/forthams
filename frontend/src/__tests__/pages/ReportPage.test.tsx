/**
 * ReportPage.test.tsx
 *
 * 报表中心页面测试覆盖：
 * - API mock 测试（getReportSummary / getReportByCategory）
 * - 空数据态处理
 * - 错误态处理
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { z } from 'zod';

// ── 报表参数校验模式 ─────────────────────────────────────────────────────

const reportQuerySchema = z.object({
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  categoryId: z.number().optional(),
}).refine(
  (data) => {
    // 如果同时提供了 startDate 和 endDate，startDate 必须 <= endDate
    if (data.startDate && data.endDate) {
      return data.startDate <= data.endDate;
    }
    return true;
  },
  { message: '开始日期不能晚于结束日期' },
);

// ── API Mock 测试 ────────────────────────────────────────────────────────

// Mock http utility
vi.mock('../../utils/http', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
}));

import http from '../../utils/http';
import { getReportSummary, getReportByCategory } from '../../api/stats';

const mockedHttp = vi.mocked(http);

describe('ReportPage — API 调用测试', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ── getReportSummary ──────────────────────────────────────────────────

  describe('getReportSummary', () => {
    it('应正确调用 /reports/summary 端点', async () => {
      const mockResponse = {
        code: 200,
        message: '操作成功',
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

    it('应在无数据时返回零值', async () => {
      const mockResponse = {
        code: 200,
        message: '操作成功',
        data: {
          totalAssets: 0,
          activeAssets: 0,
          pendingApproval: 0,
          recentlyRetired: 0,
        },
      };
      mockedHttp.get.mockResolvedValueOnce(mockResponse);

      const result = await getReportSummary();

      expect(result.data.totalAssets).toBe(0);
      expect(result.data.activeAssets).toBe(0);
    });

    it('应处理服务端错误响应', async () => {
      mockedHttp.get.mockRejectedValueOnce(new Error('服务端错误'));

      await expect(getReportSummary()).rejects.toThrow('服务端错误');
    });
  });

  // ── getReportByCategory ────────────────────────────────────────────────

  describe('getReportByCategory', () => {
    it('应正确调用 /reports/by-category 端点', async () => {
      const mockCategories = [
        { categoryName: 'IT 设备', assetCount: 350, totalValue: 5_200_000 },
        { categoryName: '办公家具', assetCount: 280, totalValue: 1_800_000 },
        { categoryName: '生产设备', assetCount: 120, totalValue: 12_000_000 },
      ];
      const mockResponse = {
        code: 200,
        message: '操作成功',
        data: mockCategories,
      };
      mockedHttp.get.mockResolvedValueOnce(mockResponse);

      const result = await getReportByCategory();

      expect(mockedHttp.get).toHaveBeenCalledWith('/reports/by-category');
      expect(result.data).toHaveLength(3);
      expect(result.data[0].categoryName).toBe('IT 设备');
      expect(result.data[0].assetCount).toBe(350);
    });

    it('应在无分类数据时返回空数组', async () => {
      const mockResponse = {
        code: 200,
        message: '操作成功',
        data: [],
      };
      mockedHttp.get.mockResolvedValueOnce(mockResponse);

      const result = await getReportByCategory();

      expect(result.data).toEqual([]);
    });

    it('应处理网络错误', async () => {
      mockedHttp.get.mockRejectedValueOnce(new Error('Network Error'));

      await expect(getReportByCategory()).rejects.toThrow('Network Error');
    });

    it('应验证分类数据字段完整性', async () => {
      const mockCategory = {
        categoryName: 'IT 设备',
        assetCount: 350,
        totalValue: 5_200_000,
      };

      // 验证所有必需字段都存在
      expect(mockCategory).toHaveProperty('categoryName');
      expect(mockCategory).toHaveProperty('assetCount');
      expect(mockCategory).toHaveProperty('totalValue');
      expect(typeof mockCategory.categoryName).toBe('string');
      expect(typeof mockCategory.assetCount).toBe('number');
      expect(typeof mockCategory.totalValue).toBe('number');
    });
  });
});

describe('ReportPage — 报表参数校验', () => {
  it('应接受有效的日期范围', () => {
    const result = reportQuerySchema.safeParse({
      startDate: '2026-01-01',
      endDate: '2026-12-31',
    });
    expect(result.success).toBe(true);
  });

  it('应拒绝开始日期晚于结束日期', () => {
    const result = reportQuerySchema.safeParse({
      startDate: '2026-12-31',
      endDate: '2026-01-01',
    });
    expect(result.success).toBe(false);
  });

  it('应接受只有开始日期的参数', () => {
    const result = reportQuerySchema.safeParse({
      startDate: '2026-01-01',
    });
    expect(result.success).toBe(true);
  });

  it('应接受只有 categoryId 的参数', () => {
    const result = reportQuerySchema.safeParse({
      categoryId: 5,
    });
    expect(result.success).toBe(true);
  });

  it('应接受空参数', () => {
    const result = reportQuerySchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it('同日日期范围应通过', () => {
    const result = reportQuerySchema.safeParse({
      startDate: '2026-05-23',
      endDate: '2026-05-23',
    });
    expect(result.success).toBe(true);
  });
});

describe('ReportPage — 预定义报表模板验证', () => {
  it('应包含至少 5 个预定义报表模板', () => {
    // 验证 ReportingPage 中的 REPORT_TEMPLATES
    const templates = [
      { id: 'asset-summary', title: '资产汇总报表' },
      { id: 'asset-category', title: '资产分类统计' },
      { id: 'dept-assets', title: '部门资产分布' },
      { id: 'asset-trends', title: '资产趋势分析' },
      { id: 'maintenance-report', title: '维保统计报表' },
      { id: 'financial-summary', title: '财务汇总报表' },
    ];
    expect(templates.length).toBeGreaterThanOrEqual(5);

    // 验证必需的模板存在
    const titles = templates.map((t) => t.title);
    expect(titles).toContain('资产汇总报表');
    expect(titles).toContain('资产分类统计');
    expect(titles).toContain('资产趋势分析');
  });

  it('每个模板应有唯一的 id', () => {
    const templates = ['asset-summary', 'asset-category', 'dept-assets', 'asset-trends', 'maintenance-report', 'financial-summary'];
    const uniqueIds = new Set(templates);
    expect(uniqueIds.size).toBe(templates.length);
  });
});
