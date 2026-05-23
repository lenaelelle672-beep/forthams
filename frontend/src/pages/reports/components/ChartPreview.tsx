/**
 * @file pages/reports/components/ChartPreview.tsx
 * @description 图表预览组件 — 使用 recharts 展示报表数据可视化
 * 遵循 forthAMS Design System 图表调色板
 */

import {
  BarChart, Bar, PieChart, Pie, Cell, AreaChart, Area,
  XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, CartesianGrid,
} from 'recharts';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { BarChart3 } from 'lucide-react';

// ── Design System 图表调色板 ──────────────────────────────────────────────────
const CHART_COLORS = ['#3b82f6', '#06b6d4', '#8b5cf6', '#f59e0b', '#10b981', '#ec4899', '#64748b'];

interface ChartPreviewProps {
  /** 图表标题 */
  title: string;
  /** 图表类型 */
  type: 'bar' | 'pie' | 'area' | 'table';
  /** 图表数据 */
  data: Record<string, unknown>[];
  /** X 轴/名称 数据字段 */
  dataKey?: string;
  /** 数值字段 */
  nameKey?: string;
  /** 值字段 */
  valueKey?: string;
  /** 是否在加载中 */
  loading?: boolean;
}

export function ChartPreview({
  title,
  type,
  data,
  dataKey = 'name',
  nameKey = 'name',
  valueKey = 'value',
  loading,
}: ChartPreviewProps) {
  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{title}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse h-60 bg-[#f1f5f9] rounded-lg" />
        </CardContent>
      </Card>
    );
  }

  if (!data || data.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{title}</CardTitle>
        </CardHeader>
        <CardContent>
          <EmptyState
            icon={BarChart3}
            title="暂无图表数据"
            description="当前报表暂无可用数据"
          />
        </CardContent>
      </Card>
    );
  }

  const renderChart = () => {
    switch (type) {
      case 'bar':
        return (
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={data} margin={{ top: 5, right: 16, left: -16, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis
                dataKey={dataKey}
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
              <Bar dataKey={valueKey} fill="#3b82f6" radius={[4, 4, 0, 0]} name={valueKey} />
            </BarChart>
          </ResponsiveContainer>
        );

      case 'pie':
        return (
          <ResponsiveContainer width="100%" height={280}>
            <PieChart>
              <Pie
                data={data}
                cx="50%"
                cy="45%"
                innerRadius={50}
                outerRadius={90}
                dataKey={valueKey}
                nameKey={nameKey}
                paddingAngle={2}
                label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
              >
                {data.map((_, i) => (
                  <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
              <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
            </PieChart>
          </ResponsiveContainer>
        );

      case 'area':
        return (
          <ResponsiveContainer width="100%" height={280}>
            <AreaChart data={data} margin={{ top: 5, right: 16, left: -16, bottom: 0 }}>
              <defs>
                <linearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.15} />
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis
                dataKey={dataKey}
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
                dataKey={valueKey}
                stroke="#3b82f6"
                strokeWidth={2}
                fill="url(#chartGradient)"
                name={valueKey}
              />
            </AreaChart>
          </ResponsiveContainer>
        );

      default:
        return (
          <div className="flex items-center justify-center h-60 text-[#94a3b8] text-sm">
            不支持的图表类型
          </div>
        );
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <BarChart3 className="w-4 h-4 text-blue-500" />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {renderChart()}
      </CardContent>
    </Card>
  );
}
