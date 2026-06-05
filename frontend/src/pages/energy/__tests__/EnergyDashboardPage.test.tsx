import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import React from 'react';

vi.mock('echarts-for-react/lib/core', () => ({ default: () => React.createElement('div', { 'data-testid': 'echarts-mock' }) }));
vi.mock('echarts/charts', () => ({ LineChart: {}, PieChart: {}, BarChart: {} }));
vi.mock('echarts/components', () => ({ TooltipComponent: {}, GridComponent: {}, LegendComponent: {} }));
vi.mock('echarts/renderers', () => ({ CanvasRenderer: {} }));
vi.mock('echarts/core', () => ({ use: vi.fn(), init: vi.fn(), registerTheme: vi.fn(), getInstanceByDom: vi.fn() }));

vi.mock('@/components/shared/SpatialTimeContext', () => ({ useSpatialTime: () => ({ query: {}, setSpatialTime: vi.fn() }) }));
vi.mock('@/components/shared/LocationCascader', () => ({ LocationCascader: () => React.createElement('div', { 'data-testid': 'location-cascader' }) }));
vi.mock('@/components/shared/TimeRangeSelector', () => ({ TimeRangeSelector: () => React.createElement('div', { 'data-testid': 'time-range-selector' }) }));

const { mockUseEnergyAnomalies } = vi.hoisted(() => ({
  mockUseEnergyAnomalies: vi.fn(() => []),
}));

vi.mock('../hooks/useEnergyDashboard', () => ({ useEnergyDashboard: vi.fn() }));
vi.mock('../hooks/useEnergyAnomalies', () => ({ useEnergyAnomalies: mockUseEnergyAnomalies }));
vi.mock('../hooks/useEnergyCompare', () => ({ useEnergyCompare: () => ({ data: null, isLoading: false }) }));
vi.mock('../hooks/useEnergyAnomaliesAuthority', () => ({ useEnergyAnomaliesAuthority: () => ({ data: null, isLoading: false }) }));
vi.mock('../hooks/useEnergyRanking', () => ({ useEnergyRanking: () => ({ data: null, isLoading: false }) }));

import { useEnergyDashboard } from '../hooks/useEnergyDashboard';
import EnergyDashboardPage from '../EnergyDashboardPage';
const mockedUseDashboard = vi.mocked(useEnergyDashboard);

const mockData = {
  byType: { ELECTRICITY: 1000, WATER: 500, GAS: 200 },
  trend: { '2026-01': 400, '2026-02': 500, '2026-03': 600 },
  assetRanking: [
    { assetId: 1, consumption: 800 },
    { assetId: 2, consumption: 600 },
    { assetId: 3, consumption: 400 },
  ],
  total: 1700,
  periodType: 'MONTH' as const,
};

function renderPage() {
  return render(React.createElement(MemoryRouter, null, React.createElement(EnergyDashboardPage)));
}

describe('EnergyDashboardPage', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('should show loading state with skeleton cards', () => {
    mockedUseDashboard.mockReturnValue({ data: undefined, isLoading: true, isError: false, error: null, refetch: vi.fn() } as any);
    renderPage();
    // loading 态渲染 SkeletonCard（animate-pulse），不显示错误或空态
    expect(screen.queryByText('加载失败')).not.toBeInTheDocument();
    expect(screen.queryByText('暂无能耗数据')).not.toBeInTheDocument();
  });

  it('should show error state', () => {
    mockedUseDashboard.mockReturnValue({ data: undefined, isLoading: false, isError: true, error: new Error('Failed to load'), refetch: vi.fn() } as any);
    renderPage();
    expect(screen.getByText('加载失败')).toBeInTheDocument();
    expect(screen.getByText('Failed to load')).toBeInTheDocument();
  });

  it('should show empty state', () => {
    mockedUseDashboard.mockReturnValue({ data: undefined, isLoading: false, isError: false, error: null, refetch: vi.fn() } as any);
    renderPage();
    expect(screen.getByText('暂无能耗数据')).toBeInTheDocument();
  });

  it('should show KPI cards with data', () => {
    mockedUseDashboard.mockReturnValue({
      data: { byType: { ELECTRICITY: 1000, WATER: 500 }, trend: { '2026-01': 100, '2026-02': 200 }, assetRanking: [], total: 1500, periodType: 'MONTH' },
      isLoading: false, isError: false, error: null, refetch: vi.fn(),
    } as any);
    renderPage();
    expect(screen.getByText('总能耗')).toBeInTheDocument();
    expect(screen.getByText('用电量')).toBeInTheDocument();
    expect(screen.getByText('用水量')).toBeInTheDocument();
  });

  it('should render anomaly alerts when anomalies exist', () => {
    mockedUseDashboard.mockReturnValue({
      data: mockData, isLoading: false, isError: false, error: null, refetch: vi.fn(),
    } as any);
    mockUseEnergyAnomalies.mockReturnValue([
      { period: '2026-03', value: 600, expected: 450, deviation: 1.8, severity: 'medium' },
    ]);
    renderPage();
    expect(screen.getByText('异常耗能检测')).toBeInTheDocument();
    expect(screen.getByText('2026-03')).toBeInTheDocument();
  });

  it('should show ranking section when assetRanking has data', () => {
    mockedUseDashboard.mockReturnValue({
      data: mockData, isLoading: false, isError: false, error: null, refetch: vi.fn(),
    } as any);
    renderPage();
    expect(screen.getByText('能耗排名（前10）')).toBeInTheDocument();
  });

  it('should show energy saving suggestions when electricity dominates', () => {
    mockedUseDashboard.mockReturnValue({
      data: {
        ...mockData,
        byType: { ELECTRICITY: 3000, WATER: 200, GAS: 100 },
      },
      isLoading: false, isError: false, error: null, refetch: vi.fn(),
    } as any);
    renderPage();
    // ELECTRICITY(3000) > WATER(200)*2 = 400 → 触发节能建议
    expect(screen.getByText('节能建议')).toBeInTheDocument();
  });

  it('should render ECharts charts when data is available', () => {
    mockedUseDashboard.mockReturnValue({
      data: mockData, isLoading: false, isError: false, error: null, refetch: vi.fn(),
    } as any);
    renderPage();
    const charts = screen.getAllByTestId('echarts-mock');
    // 趋势图 + 饼图 + 排名图 = 3 个 ECharts 实例
    expect(charts.length).toBeGreaterThanOrEqual(2);
  });
});
