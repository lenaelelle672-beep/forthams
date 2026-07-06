/**
 * @file pages/report/components/ReportChart.tsx
 * @description 报表图表包装组件
 *
 * 使用 recharts 提供 Area 和 Pie 两种图表模式。
 * 遵循 AnalyticsPage 的图表模式（ResponsiveContainer + 标准化配色）。
 */
import * as React from 'react';
import {
  AreaChart, Area, PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, CartesianGrid,
} from 'recharts';
import { cn } from '@/utils/cn';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';

// ── 颜色常量 ──────────────────────────────────────────────────────────────────
const COLORS = {
  blue:   '#3b82f6',
  green:  '#10b981',
  amber:  '#f59e0b',
  red:    '#ef4444',
  purple: '#8b5cf6',
  cyan:   '#06b6d4',
  pink:   '#ec4899',
  gray:   '#64748b',
};

const PIE_COLORS = [COLORS.blue, COLORS.green, COLORS.amber, COLORS.red, COLORS.purple, COLORS.cyan, COLORS.pink, COLORS.gray];

export type ChartType = 'area' | 'pie' | 'bar';

export interface ReportChartProps {
  /** 图表数据 */
  data: Record<string, unknown>[];
  /** 图表类型 */
  chartType: ChartType;
  /** 图表标题 */
  title: string;
  /** 数据键名（area: dataKey, pie: nameKey） */
  nameKey?: string;
  /** 数据值键名 */
  dataKey?: string;
  /** 面积图额外数据键 */
  dataKey2?: string;
  /** 面积图额外数据名称 */
  name2?: string;
  /** 类名 */
  className?: string;
}

export function ReportChart({
  data,
  chartType,
  title,
  nameKey = 'name',
  dataKey = 'value',
  dataKey2,
  name2,
  className,
}: ReportChartProps) {
  const chartHeight = 260;

  const renderChart = () => {
    if (data.length === 0) {
      return (
        <div className="flex items-center justify-center h-[260px] text-sm text-[#94a3b8]">
          暂无数据
        </div>
      );
    }

    switch (chartType) {
      case 'area':
        return (
          <ResponsiveContainer width="100%" height={chartHeight}>
            <AreaChart data={data} margin={{ top: 5, right: 16, left: -16, bottom: 0 }}>
              <defs>
                <linearGradient id="reportAreaGrad1" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={COLORS.blue} stopOpacity={0.15} />
                  <stop offset="95%" stopColor={COLORS.blue} stopOpacity={0} />
                </linearGradient>
                {dataKey2 && (
                  <linearGradient id="reportAreaGrad2" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={COLORS.green} stopOpacity={0.15} />
                    <stop offset="95%" stopColor={COLORS.green} stopOpacity={0} />
                  </linearGradient>
                )}
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis
                dataKey={nameKey}
                tick={{ fontSize: 11, fill: '#94a3b8' }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={{ fontSize: 11, fill: '#94a3b8' }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e5e7eb' }} />
              <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />
              <Area
                type="monotone"
                dataKey={dataKey}
                name={title}
                stroke={COLORS.blue}
                strokeWidth={2}
                fill="url(#reportAreaGrad1)"
              />
              {dataKey2 && (
                <Area
                  type="monotone"
                  dataKey={dataKey2}
                  name={name2 || '参考值'}
                  stroke={COLORS.green}
                  strokeWidth={2}
                  fill="url(#reportAreaGrad2)"
                />
              )}
            </AreaChart>
          </ResponsiveContainer>
        );

      case 'pie':
        return (
          <ResponsiveContainer width="100%" height={chartHeight}>
            <PieChart>
              <Pie
                data={data}
                cx="50%"
                cy="45%"
                innerRadius={50}
                outerRadius={90}
                dataKey={dataKey}
                nameKey={nameKey}
                paddingAngle={2}
              >
                {data.map((_: Record<string, unknown>, i: number) => (
                  <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
              <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
            </PieChart>
          </ResponsiveContainer>
        );

      default:
        return (
          <div className="flex items-center justify-center h-[260px] text-sm text-[#94a3b8]">
            不支持的图表类型
          </div>
        );
    }
  };

  return (
    <Card className={cn(className)}>
      <CardHeader>
        <CardTitle className="text-sm">{title}</CardTitle>
      </CardHeader>
      <CardContent>{renderChart()}</CardContent>
    </Card>
  );
}
