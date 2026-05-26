import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import DashboardPage from '@/pages/dashboard/DashboardPage';

vi.mock('recharts', () => ({
  AreaChart: ({ children }: any) => <div data-testid="area-chart">{children}</div>,
  Area: () => <div data-testid="area" />,
  PieChart: ({ children }: any) => <div data-testid="pie-chart">{children}</div>,
  Pie: () => <div data-testid="pie" />,
  Cell: () => <div data-testid="cell" />,
  XAxis: () => <div data-testid="xaxis" />,
  YAxis: () => <div data-testid="yaxis" />,
  Tooltip: () => <div data-testid="tooltip" />,
  Legend: () => <div data-testid="legend" />,
  ResponsiveContainer: ({ children }: any) => <div>{children}</div>,
}));

vi.mock('@/api/asset', () => ({
  getDashboardStats: vi.fn(),
  getAssetValueTrends: vi.fn(),
  getDeptDistribution: vi.fn(),
  getMaintenanceStats: vi.fn(),
}));

vi.mock('@/api/workorder', () => ({
  getWorkOrderList: vi.fn(),
}));

import { getDashboardStats, getAssetValueTrends, getDeptDistribution, getMaintenanceStats } from '@/api/asset';
import { getWorkOrderList } from '@/api/workorder';

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>{children}</MemoryRouter>
    </QueryClientProvider>
  );
}

describe('DashboardPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getDashboardStats).mockResolvedValue({
      code: 200, message: 'success',
      data: { totalAssets: 150, inUseAssets: 120, idleAssets: 20, maintenanceAssets: 5, scrapAssets: 5, totalValue: 50000000, netValue: 35000000, categoryDistribution: {}, pendingApprovals: 3 },
    });
    vi.mocked(getAssetValueTrends).mockResolvedValue({ code: 200, message: 'success', data: [] });
    vi.mocked(getWorkOrderList).mockResolvedValue({ code: 200, message: 'success', data: { records: [], total: 0, size: 20, current: 1 } });
    vi.mocked(getDeptDistribution).mockResolvedValue({ code: 200, message: 'success', data: [] });
    vi.mocked(getMaintenanceStats).mockResolvedValue({ code: 200, message: 'success', data: {} });
  });

  it('renders page header', async () => {
    render(<DashboardPage />, { wrapper: createWrapper() });
    await waitFor(() => expect(screen.getByText('仪表板')).toBeTruthy());
  });

  it('displays KPI card with total assets', async () => {
    render(<DashboardPage />, { wrapper: createWrapper() });
    await waitFor(() => expect(screen.getByText('150')).toBeTruthy(), { timeout: 3000 });
  });

  it('shows loading state with page header', () => {
    vi.mocked(getDashboardStats).mockImplementation(() => new Promise(() => {}));
    vi.mocked(getAssetValueTrends).mockImplementation(() => new Promise(() => {}));
    vi.mocked(getWorkOrderList).mockImplementation(() => new Promise(() => {}));
    vi.mocked(getDeptDistribution).mockImplementation(() => new Promise(() => {}));
    vi.mocked(getMaintenanceStats).mockImplementation(() => new Promise(() => {}));
    render(<DashboardPage />, { wrapper: createWrapper() });
    expect(screen.getByText('仪表板')).toBeTruthy();
  });

  it('handles API error gracefully', async () => {
    vi.mocked(getDashboardStats).mockRejectedValue(new Error('Network error'));
    render(<DashboardPage />, { wrapper: createWrapper() });
    await waitFor(() => {
      expect(screen.getByText('仪表板')).toBeTruthy();
    }, { timeout: 3000 });
  });
});
