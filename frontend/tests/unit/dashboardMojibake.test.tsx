import { render, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { Dashboard } from '../../src/app/pages/Dashboard';
import { dashboardService } from '../../src/app/services/dashboardService';
import { approvalService } from '../../src/app/services/approvalService';

vi.mock('recharts', () => ({
  ResponsiveContainer: ({ children }: { children: ReactNode }) => (
    <div data-testid="responsive-container">{children}</div>
  ),
  LineChart: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  Line: () => null,
  PieChart: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  Pie: ({ data, children }: { data?: Array<Record<string, unknown>>; children?: ReactNode }) => (
    <div data-testid="mock-pie">
      {(data ?? []).map((item) => (
        <span key={String(item.deptId ?? item.deptName)}>{String(item.deptName ?? '')}</span>
      ))}
      {children}
    </div>
  ),
  Cell: () => null,
  CartesianGrid: () => null,
  XAxis: () => null,
  YAxis: () => null,
  Tooltip: () => null,
  Legend: () => null,
}));

vi.mock('../../src/app/components/QuickActions', () => ({
  QuickActions: () => <div data-testid="quick-actions" />,
}));

vi.mock('../../src/app/components/MaintenanceCalendar', () => ({
  MaintenanceCalendar: () => <div data-testid="maintenance-calendar" />,
}));

vi.mock('../../src/app/services/dashboardService', () => ({
  dashboardService: {
    getStats: vi.fn(),
    getValueTrends: vi.fn(),
    getDeptDistribution: vi.fn(),
  },
}));

vi.mock('../../src/app/services/approvalService', () => ({
  approvalService: {
    getPending: vi.fn(),
    approve: vi.fn(),
  },
}));

const mojibake = {
  hqDept: 'æ€»å…¬å¸',
  researchDept: '\u00e7\u00a0\u0094\u00e5\u008f\u0091\u00e9\u0083\u00a8',
  marketDept: '\u00e5\u00b8\u0082\u00e5\u009c\u00ba\u00e9\u0083\u00a8',
  approvalTitle: '\u00e8\u00b5\u0084\u00e4\u00ba\u00a7\u00e8\u00bd\u00ac\u00e7\u00a7\u00bb\u00e5\u00ae\u00a1\u00e6\u0089\u00b9',
};

describe('Dashboard mojibake cleanup', () => {
  beforeEach(() => {
    vi.mocked(dashboardService.getStats).mockReset();
    vi.mocked(dashboardService.getStats).mockResolvedValue({
      totalAssets: 10,
      inUseAssets: 8,
      idleAssets: 1,
      maintenanceAssets: 0,
      scrapAssets: 1,
      totalValue: 100000,
      netValue: 80000,
      categoryDistribution: {},
      pendingApprovals: 1,
    });
    vi.mocked(dashboardService.getValueTrends).mockReset();
    vi.mocked(dashboardService.getValueTrends).mockResolvedValue([
      { date: '2026-05-14', totalValue: 100000, netValue: 80000 },
    ]);
    vi.mocked(dashboardService.getDeptDistribution).mockReset();
    vi.mocked(dashboardService.getDeptDistribution).mockResolvedValue([
      { deptId: 4, deptName: mojibake.hqDept, assetCount: 5 },
      { deptId: 1, deptName: mojibake.researchDept, assetCount: 4 },
      { deptId: 2, deptName: mojibake.marketDept, assetCount: 3 },
      { deptId: 3, deptName: '□□', assetCount: 1 },
    ]);
    vi.mocked(approvalService.getPending).mockReset();
    vi.mocked(approvalService.getPending).mockResolvedValue([
      { id: 1, title: mojibake.approvalTitle, description: 'ç åé¨资产转移', createTime: '2026-05-14' },
    ]);
    vi.mocked(approvalService.approve).mockReset();
  });

  it('repairs UTF-8-as-Latin-1 dashboard labels and hides unrecoverable garbled text', async () => {
    render(
      <MemoryRouter>
        <Dashboard />
      </MemoryRouter>
    );

    expect(await screen.findByText('总公司')).toBeInTheDocument();
    expect(await screen.findByText('研发部')).toBeInTheDocument();
    expect(screen.getByText('市场部')).toBeInTheDocument();
    expect(screen.getByText('部门3')).toBeInTheDocument();
    expect(screen.getAllByText('资产转移审批').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('研发部资产转移')).toBeInTheDocument();

    await waitFor(() => {
      const text = document.body.textContent ?? '';
      expect(text).not.toContain(mojibake.hqDept);
      expect(text).not.toContain(mojibake.researchDept);
      expect(text).not.toContain(mojibake.marketDept);
      expect(text).not.toContain(mojibake.approvalTitle);
      expect(text).not.toContain('□□');
      expect(text).not.toContain('锟斤拷');
    });
  });
});
