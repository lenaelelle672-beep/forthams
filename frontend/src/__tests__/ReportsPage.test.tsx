/**
 * ReportsPage.test.tsx
 *
 * Tests for the ReportsPage component covering:
 * - Page rendering with header
 * - Category tab switching
 * - Empty data state
 * - Loading state
 * - API error state
 * - Chart preview rendering on card click
 * - Time range select interaction
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import ReportsPage from '@/pages/reports/ReportsPage';

// Mock sonner toast
vi.mock('sonner', () => ({
  toast: {
    error: vi.fn(),
    info: vi.fn(),
    success: vi.fn(),
  },
}));

// Mock the reports API module (include all exports used by ReportsPage)
vi.mock('@/api/reports', () => ({
  getReportSummary: vi.fn(),
  getReportByCategory: vi.fn(),
  getReportTrend: vi.fn(),
  getDepreciationStats: vi.fn(),
  getMaintenanceStats: vi.fn(),
  getRetirementStats: vi.fn(),
  getWorkOrderStatusDistribution: vi.fn(),
  getWorkOrderDeptPending: vi.fn(),
}));

import {
  getReportSummary,
  getReportByCategory,
  getReportTrend,
  getDepreciationStats,
  getMaintenanceStats,
  getRetirementStats,
  getWorkOrderStatusDistribution,
  getWorkOrderDeptPending,
} from '@/api/reports';
import { toast } from 'sonner';
import type { ApiResponse } from '@/types/common';
import type { ReportSummary, CategoryReport } from '@/api/reports';

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0,
      },
    },
  });

  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>{children}</MemoryRouter>
    </QueryClientProvider>
  );
}

const emptySummary: ApiResponse<ReportSummary> = {
  code: 200,
  message: 'success',
  data: { totalAssets: 0, activeAssets: 0, pendingApproval: 0, recentlyRetired: 0 },
};

const emptyCategory: ApiResponse<CategoryReport[]> = {
  code: 200,
  message: 'success',
  data: [],
};

const sampleCategory: ApiResponse<CategoryReport[]> = {
  code: 200,
  message: 'success',
  data: [
    { categoryName: '电子设备', assetCount: 80, totalValue: 5000000 },
    { categoryName: '机械设备', assetCount: 45, totalValue: 8000000 },
  ],
};

const sampleSummary: ApiResponse<ReportSummary> = {
  code: 200,
  message: 'success',
  data: { totalAssets: 150, activeAssets: 120, pendingApproval: 10, recentlyRetired: 5 },
};

const emptyMonthly = { code: 200, message: 'success', data: [] };

describe('ReportsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default mock: resolve with empty data so page renders
    vi.mocked(getReportSummary).mockResolvedValue(emptySummary);
    vi.mocked(getReportByCategory).mockResolvedValue(emptyCategory);
    vi.mocked(getReportTrend).mockResolvedValue({ code: 200, message: 'success', data: [] });
    vi.mocked(getDepreciationStats).mockResolvedValue(emptyMonthly);
    vi.mocked(getMaintenanceStats).mockResolvedValue(emptyMonthly);
    vi.mocked(getRetirementStats).mockResolvedValue(emptyMonthly);
    vi.mocked(getWorkOrderStatusDistribution).mockResolvedValue(emptyMonthly);
    vi.mocked(getWorkOrderDeptPending).mockResolvedValue(emptyMonthly);  });

  it('should render page header with subtitle', async () => {
    render(<ReportsPage />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.queryByText('预定义报表查看与数据可视化')).toBeInTheDocument();
    });
  });

  it('should render all category tabs', async () => {
    render(<ReportsPage />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByText('资产报表')).toBeInTheDocument();
      expect(screen.getByText('财务报表')).toBeInTheDocument();
      expect(screen.getByText('运维报表')).toBeInTheDocument();
      expect(screen.getByText('工单报表')).toBeInTheDocument();
    });
  });

  it('should show asset report cards by default (asset tab)', async () => {
    vi.mocked(getReportSummary).mockResolvedValue(sampleSummary);
    vi.mocked(getReportByCategory).mockResolvedValue(sampleCategory);

    render(<ReportsPage />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByText('资产汇总表')).toBeInTheDocument();
      expect(screen.getByText('资产分类统计')).toBeInTheDocument();
      expect(screen.getByText('资产状态分布')).toBeInTheDocument();
    });
  });

  it('should switch report cards when switching tabs', async () => {
    vi.mocked(getReportSummary).mockResolvedValue(emptySummary);
    vi.mocked(getReportByCategory).mockResolvedValue(emptyCategory);

    const user = userEvent.setup();
    render(<ReportsPage />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByText('资产汇总表')).toBeInTheDocument();
    });

    await user.click(screen.getByText('财务报表'));

    await waitFor(() => {
      expect(screen.getByText('资产价值趋势')).toBeInTheDocument();
      expect(screen.queryByText('资产汇总表')).not.toBeInTheDocument();
    });
  });

  it('should handle API loading state', async () => {
    // Never resolve — keeps loading state
    vi.mocked(getReportSummary).mockReturnValue(new Promise(() => {}));
    vi.mocked(getReportByCategory).mockReturnValue(new Promise(() => {}));

    render(<ReportsPage />, { wrapper: createWrapper() });

    // The page container should exist (without assertions on specific data)
    expect(screen.getByText('资产报表')).toBeInTheDocument();
  });

  it('should show error state when API calls fail', async () => {
    // Reject both queries
    vi.mocked(getReportSummary).mockRejectedValue(new Error('Network Error'));
    vi.mocked(getReportByCategory).mockRejectedValue(new Error('Network Error'));

    render(<ReportsPage />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByText('数据加载失败')).toBeInTheDocument();
      expect(screen.getByText('无法加载报表数据，请稍后重试')).toBeInTheDocument();
    });
  });

  it('should call sonner toast on API error', async () => {
    vi.mocked(getReportSummary).mockRejectedValue(new Error('API Error'));
    vi.mocked(getReportByCategory).mockRejectedValue(new Error('API Error'));

    render(<ReportsPage />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('数据加载失败，请重试');
    });
  });

  it('should show ChartPreview when a report card is clicked', async () => {
    vi.mocked(getReportSummary).mockResolvedValue(sampleSummary);
    vi.mocked(getReportByCategory).mockResolvedValue(sampleCategory);

    const user = userEvent.setup();
    render(<ReportsPage />, { wrapper: createWrapper() });

    // Wait for cards to render
    await waitFor(() => {
      expect(screen.getByText('资产汇总表')).toBeInTheDocument();
    });

    // Click the "资产汇总表" card
    await user.click(screen.getByText('资产汇总表'));

    // After clicking, both the card and chart preview exist — verify chart card is present
    await waitFor(() => {
      const chartTitles = screen.getAllByText('资产汇总表');
      expect(chartTitles.length).toBeGreaterThanOrEqual(2);
    });
  });

  it('should toggle ChartPreview visibility when clicking the same card again', async () => {
    vi.mocked(getReportSummary).mockResolvedValue(sampleSummary);
    vi.mocked(getReportByCategory).mockResolvedValue(sampleCategory);

    const user = userEvent.setup();
    render(<ReportsPage />, { wrapper: createWrapper() });

    // Wait for cards to render
    await waitFor(() => {
      expect(screen.getByText('资产汇总表')).toBeInTheDocument();
    });

    // Click to open chart preview — should have 2+ instances (card + chart)
    await user.click(screen.getByText('资产汇总表'));
    await waitFor(() => {
      expect(screen.getAllByText('资产汇总表').length).toBeGreaterThanOrEqual(2);
    });

    // Click the first h3 element (ReportCard) again to toggle
    const cardTitle = screen.getAllByText('资产汇总表')[0];
    await user.click(cardTitle);

    // After toggling off, only the card should remain (1 instance)
    await waitFor(() => {
      expect(screen.getAllByText('资产汇总表').length).toBe(1);
    });
  });

  it('should show trend data and call getReportTrend with default period', async () => {
    vi.mocked(getReportSummary).mockResolvedValue(sampleSummary);
    vi.mocked(getReportByCategory).mockResolvedValue(sampleCategory);
    vi.mocked(getReportTrend).mockResolvedValue({
      code: 200,
      message: 'success',
      data: [
        { month: '2026-01', assetCount: 100, totalValue: 5000000 },
        { month: '2026-02', assetCount: 110, totalValue: 5500000 },
      ],
    });

    const user = userEvent.setup();
    render(<ReportsPage />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByText('资产增长趋势')).toBeInTheDocument();
    });

    // Click trend report to open chart
    await user.click(screen.getByText('资产增长趋势'));

    // Verify getReportTrend was called with default 12
    await waitFor(() => {
      expect(getReportTrend).toHaveBeenCalledWith(12);
    });
  });

  it('should render page header with export button and time range select', async () => {
    vi.mocked(getReportSummary).mockResolvedValue(emptySummary);
    vi.mocked(getReportByCategory).mockResolvedValue(emptyCategory);

    render(<ReportsPage />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByText('导出')).toBeInTheDocument();
      // Time range select renders with "近 12 个月" as default
      expect(screen.getByText('近 12 个月')).toBeInTheDocument();
    });
  });

  it('should render cards with zero API data', async () => {
    // API returns successful response with zero values
    vi.mocked(getReportSummary).mockResolvedValue({
      code: 200,
      message: 'success',
      data: { totalAssets: 0, activeAssets: 0, pendingApproval: 0, recentlyRetired: 0 },
    });
    vi.mocked(getReportByCategory).mockResolvedValue({
      code: 200,
      message: 'success',
      data: [],
    });

    render(<ReportsPage />, { wrapper: createWrapper() });

    await waitFor(() => {
      // Cards should still render (ALL_REPORTS is hardcoded)
      expect(screen.getByText('资产汇总表')).toBeInTheDocument();
      expect(screen.getByText('资产增长趋势')).toBeInTheDocument();
      // Tab headers render
      expect(screen.getByText('资产报表')).toBeInTheDocument();
    });
  });

  it('should handle empty category data gracefully when chart is opened', async () => {
    vi.mocked(getReportSummary).mockResolvedValue({
      code: 200,
      message: 'success',
      data: { totalAssets: 0, activeAssets: 0, pendingApproval: 0, recentlyRetired: 0 },
    });
    vi.mocked(getReportByCategory).mockResolvedValue({
      code: 200,
      message: 'success',
      data: [],
    });

    const user = userEvent.setup();
    render(<ReportsPage />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByText('资产汇总表')).toBeInTheDocument();
    });

    // Click to open chart — should render chart preview even with empty data
    await user.click(screen.getByText('资产汇总表'));
    await waitFor(() => {
      const titles = screen.getAllByText('资产汇总表');
      expect(titles.length).toBeGreaterThanOrEqual(2);
    });
  });
});

// ── 导出功能测试 ──────────────────────────────────────────────────────────────

vi.mock('xlsx', () => ({
  utils: {
    json_to_sheet: vi.fn(() => ({ '!ref': 'A1:D5' })),
    book_new: vi.fn(() => ({ SheetNames: [], Sheets: {} })),
    book_append_sheet: vi.fn(),
  },
  writeFile: vi.fn(),
}));

import * as XLSX from 'xlsx';

describe('ReportsPage — 导出功能', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getReportSummary).mockResolvedValue(emptySummary);
    vi.mocked(getReportByCategory).mockResolvedValue(emptyCategory);
    vi.mocked(getReportTrend).mockResolvedValue({ code: 200, message: 'success', data: [] });
    vi.mocked(getDepreciationStats).mockResolvedValue(emptyMonthly);
    vi.mocked(getMaintenanceStats).mockResolvedValue(emptyMonthly);
    vi.mocked(getWorkOrderStatusDistribution).mockResolvedValue(emptyMonthly);
    vi.mocked(getWorkOrderDeptPending).mockResolvedValue(emptyMonthly);    vi.mocked(getRetirementStats).mockResolvedValue(emptyMonthly);
    vi.mocked(getWorkOrderStatusDistribution).mockResolvedValue(emptyMonthly);
    vi.mocked(getWorkOrderDeptPending).mockResolvedValue(emptyMonthly);  });

  it('应渲染导出按钮', async () => {
    render(<ReportsPage />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByText('导出')).toBeInTheDocument();
    });
  });

  it('导出的文件名应包含日期和"报表中心"前缀', async () => {
    const user = userEvent.setup();
    render(<ReportsPage />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByText('资产汇总表')).toBeInTheDocument();
    });

    await user.click(screen.getByText('导出'));

    await waitFor(() => {
      expect(XLSX.writeFile).toHaveBeenCalledTimes(1);
      const fileName = vi.mocked(XLSX.writeFile).mock.calls[0][1] as string;
      expect(fileName).toMatch(/^报表中心_\d{8}\.xlsx$/);
    });
  });

  it('导出数据应包含当前 tab 分类下的报表信息', async () => {
    const user = userEvent.setup();
    render(<ReportsPage />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByText('资产汇总表')).toBeInTheDocument();
    });

    await user.click(screen.getByText('导出'));

    await waitFor(() => {
      // 传入 json_to_sheet 的数据应包含当前分类（asset）的报表
      const exportData = vi.mocked(XLSX.utils.json_to_sheet).mock.calls[0][0] as Record<string, string>[];
      expect(exportData.length).toBeGreaterThan(0);
      // 每个条目应有 title、description、category、updatedAt 字段
      expect(exportData[0]).toHaveProperty('title');
      expect(exportData[0]).toHaveProperty('description');
      expect(exportData[0]).toHaveProperty('category');
      expect(exportData[0]).toHaveProperty('updatedAt');
      // 所有行 category 应为 'asset'（当前 tab）
      exportData.forEach((row) => {
        expect(row.category).toBe('asset');
      });
    });
  });

  it('导出成功后应调用 toast.success', async () => {
    const user = userEvent.setup();
    render(<ReportsPage />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByText('资产汇总表')).toBeInTheDocument();
    });

    await user.click(screen.getByText('导出'));

    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith('导出成功');
    });
  });

  it('导出失败时应在控制台输出错误并调用 toast.error', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.mocked(XLSX.utils.json_to_sheet).mockImplementationOnce(() => {
      throw new Error('Sheet error');
    });

    const user = userEvent.setup();
    render(<ReportsPage />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByText('资产汇总表')).toBeInTheDocument();
    });

    await user.click(screen.getByText('导出'));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('导出失败，请重试');
      expect(consoleSpy).toHaveBeenCalled();
    });

    consoleSpy.mockRestore();
  });
});
