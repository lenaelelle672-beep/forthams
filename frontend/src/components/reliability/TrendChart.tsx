/**
 * @file components/reliability/TrendChart.tsx
 * @description MTBF/MTTR 趋势图组件
 */

import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer,
} from 'recharts';
import type { ReliabilityTrend } from '@/types/reliability';

interface TrendChartProps {
  data: ReliabilityTrend[];
}

export default function TrendChart({ data }: TrendChartProps) {
  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-400 text-sm">
        暂无趋势数据
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={300}>
      <LineChart data={data} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
        <XAxis
          dataKey="period"
          tick={{ fontSize: 12, fill: '#94a3b8' }}
          axisLine={{ stroke: '#e2e8f0' }}
        />
        <YAxis
          tick={{ fontSize: 12, fill: '#94a3b8' }}
          axisLine={{ stroke: '#e2e8f0' }}
          label={{ value: '小时 (h)', angle: -90, position: 'insideLeft', style: { fontSize: 12, fill: '#94a3b8' } }}
        />
        <Tooltip
          contentStyle={{
            borderRadius: '12px',
            border: '1px solid #e2e8f0',
            boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
          }}
        />
        <Legend />
        <Line
          type="monotone"
          dataKey="mtbf"
          name="MTBF (平均故障间隔)"
          stroke="#2563eb"
          strokeWidth={2}
          dot={{ r: 4, fill: '#2563eb' }}
          activeDot={{ r: 6 }}
        />
        <Line
          type="monotone"
          dataKey="mttr"
          name="MTTR (平均修复时间)"
          stroke="#f59e0b"
          strokeWidth={2}
          dot={{ r: 4, fill: '#f59e0b' }}
          activeDot={{ r: 6 }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
