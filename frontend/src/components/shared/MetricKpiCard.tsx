/**
 * @file components/shared/MetricKpiCard.tsx
 * @description 增强型 KPI 卡片 — 在 KpiCard 基础上叠加同环比箭头
 *
 * 通用：
 * - changeRate > 0 上箭头（红色 = 增长）
 * - changeRate < 0 下箭头（绿色 = 下降）
 * - changeRate = 0 平箭头
 * - changeRate 为 null/undefined 时不显示
 */
import React from 'react';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/Card';
import { cn } from '@/utils/cn';

interface MetricKpiCardProps {
  title: string;
  value: number | string;
  unit?: string;
  /** 0.05 表示 +5% */
  changeRate?: number | null;
  trend?: 'up' | 'down' | 'flat';
  /** 强调色：blue / amber / red / emerald */
  accent?: 'blue' | 'amber' | 'red' | 'emerald' | 'orange';
  icon?: React.ReactNode;
  className?: string;
  footer?: React.ReactNode;
}

const ACCENT: Record<NonNullable<MetricKpiCardProps['accent']>, { border: string; bg: string; text: string }> = {
  blue: { border: 'border-l-blue-400', bg: 'bg-blue-50', text: 'text-blue-500' },
  amber: { border: 'border-l-amber-400', bg: 'bg-amber-50', text: 'text-amber-500' },
  red: { border: 'border-l-red-400', bg: 'bg-red-50', text: 'text-red-500' },
  emerald: { border: 'border-l-emerald-400', bg: 'bg-emerald-50', text: 'text-emerald-500' },
  orange: { border: 'border-l-orange-400', bg: 'bg-orange-50', text: 'text-orange-500' },
};

export const MetricKpiCard: React.FC<MetricKpiCardProps> = ({
  title,
  value,
  unit,
  changeRate,
  trend,
  accent = 'blue',
  icon,
  className,
  footer,
}) => {
  const accentStyle = ACCENT[accent];

  const inferredTrend: 'up' | 'down' | 'flat' =
    trend ??
    (changeRate == null ? 'flat' : changeRate > 0.001 ? 'up' : changeRate < -0.001 ? 'down' : 'flat');

  return (
    <Card className={cn('border-l-4', accentStyle.border, className)}>
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-xs font-medium text-gray-500 uppercase tracking-wide">{title}</div>
            <div className="text-3xl font-bold text-[#0f172a] mt-1 tabular-nums">
              {typeof value === 'number' ? value.toFixed(1) : value}
              {unit && <span className="text-base font-medium text-gray-500 ml-1">{unit}</span>}
            </div>
          </div>
          {icon && (
            <div className={cn('flex-shrink-0 w-12 h-12 rounded-xl flex items-center justify-center', accentStyle.bg, accentStyle.text)}>
              {icon}
            </div>
          )}
        </div>
        {changeRate != null && (
          <div
            className={cn(
              'mt-2 inline-flex items-center gap-1 text-xs font-medium',
              inferredTrend === 'up' && 'text-red-500',
              inferredTrend === 'down' && 'text-emerald-500',
              inferredTrend === 'flat' && 'text-gray-400',
            )}
          >
            {inferredTrend === 'up' ? (
              <TrendingUp className="w-3.5 h-3.5" />
            ) : inferredTrend === 'down' ? (
              <TrendingDown className="w-3.5 h-3.5" />
            ) : (
              <Minus className="w-3.5 h-3.5" />
            )}
            {Math.abs(changeRate).toFixed(1)}% 较上期
          </div>
        )}
        {footer}
      </CardContent>
    </Card>
  );
};

export default MetricKpiCard;
