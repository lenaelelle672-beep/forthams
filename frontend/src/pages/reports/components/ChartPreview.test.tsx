import type { ReactNode } from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ChartPreview } from './ChartPreview';

interface MockChartProps {
  children?: ReactNode;
  data?: Array<{ name?: string }>;
  label?: (args: { name: string; percent: number }) => string;
}

function mockChart(testId: string) {
  return ({ children }: MockChartProps) => <div data-testid={testId}>{children}</div>;
}

vi.mock('recharts', () => ({
  ResponsiveContainer: ({ children }: MockChartProps) => <div data-testid="responsive-container">{children}</div>,
  BarChart: mockChart('bar-chart'),
  Bar: mockChart('bar'),
  PieChart: mockChart('pie-chart'),
  Pie: ({ children, data, label }: MockChartProps) => (
    <div data-testid="pie">
      {label && data?.[0] ? <span>{label({ name: data[0].name ?? '', percent: 0.25 })}</span> : null}
      {children}
    </div>
  ),
  Cell: mockChart('cell'),
  AreaChart: ({ children }: MockChartProps) => <svg data-testid="area-chart">{children}</svg>,
  Area: mockChart('area'),
  LineChart: mockChart('line-chart'),
  Line: mockChart('line'),
  XAxis: mockChart('x-axis'),
  YAxis: mockChart('y-axis'),
  Tooltip: mockChart('tooltip'),
  Legend: mockChart('legend'),
  CartesianGrid: mockChart('cartesian-grid'),
}));

const sampleData = [
  { name: '资产', value: 12, month: '2026-06' },
  { name: '工单', value: 5, month: '2026-07' },
];

describe('ChartPreview', () => {
  it('renders loading placeholder', () => {
    render(<ChartPreview title="加载图表" type="bar" data={[]} loading />);

    expect(screen.getByText('加载图表')).toBeInTheDocument();
    expect(document.querySelector('.animate-pulse')).toBeInTheDocument();
  });

  it('renders empty state when data is empty', () => {
    render(<ChartPreview title="空图表" type="bar" data={[]} />);

    expect(screen.getByText('暂无图表数据')).toBeInTheDocument();
    expect(screen.getByText('当前报表暂无可用数据')).toBeInTheDocument();
  });

  it('renders bar chart', () => {
    render(<ChartPreview title="柱状图" type="bar" data={sampleData} />);

    expect(screen.getByTestId('bar-chart')).toBeInTheDocument();
    expect(screen.getByTestId('bar')).toBeInTheDocument();
  });

  it('renders pie chart labels and cells', () => {
    render(<ChartPreview title="饼图" type="pie" data={sampleData} />);

    expect(screen.getByTestId('pie-chart')).toBeInTheDocument();
    expect(screen.getByText('资产 25%')).toBeInTheDocument();
    expect(screen.getAllByTestId('cell')).toHaveLength(2);
  });

  it('renders area chart with month data key', () => {
    render(<ChartPreview title="面积图" type="area" data={sampleData} dataKey="month" />);

    expect(screen.getByTestId('area-chart')).toBeInTheDocument();
    expect(screen.getByTestId('area')).toBeInTheDocument();
  });

  it('renders line chart', () => {
    render(<ChartPreview title="折线图" type="line" data={sampleData} />);

    expect(screen.getByTestId('line-chart')).toBeInTheDocument();
    expect(screen.getByTestId('line')).toBeInTheDocument();
  });

  it('renders unsupported chart fallback for table type', () => {
    render(<ChartPreview title="表格图" type="table" data={sampleData} />);

    expect(screen.getByText('不支持的图表类型')).toBeInTheDocument();
  });
});
