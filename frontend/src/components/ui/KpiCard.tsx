/**
 * @file components/ui/KpiCard.tsx
 * @description 仪表板 KPI 统计卡片
 * 支持：数值、标签、趋势、图标、颜色主题
 */

import * as React from 'react';
import type { LucideIcon } from 'lucide-react';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { cn } from '@/utils/cn';
import { Card } from './Card';

interface KpiCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  trend?: {
    value: string;
    direction: 'up' | 'down' | 'neutral';
  };
  icon?: LucideIcon;
  iconColor?: string;
  className?: string;
  loading?: boolean;
}

export function KpiCard({
  title,
  value,
  subtitle,
  trend,
  icon: Icon,
  iconColor = '#3b82f6',
  className,
  loading,
}: KpiCardProps) {
  const TrendIcon =
    trend?.direction === 'up'
      ? TrendingUp
      : trend?.direction === 'down'
        ? TrendingDown
        : Minus;

  const trendColor =
    trend?.direction === 'up'
      ? 'text-green-600'
      : trend?.direction === 'down'
        ? 'text-red-500'
        : 'text-slate-400';

  if (loading) {
    return (
      <Card className={cn('p-5', className)}>
        <div className="animate-pulse space-y-3">
          <div className="h-4 bg-slate-100 rounded w-24" />
          <div className="h-8 bg-slate-100 rounded w-32" />
          <div className="h-3 bg-slate-100 rounded w-20" />
        </div>
      </Card>
    );
  }

  return (
    <Card className={cn('p-5', className)}>
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-[#64748b] mb-1">{title}</p>
          <p className="text-3xl font-bold text-[#0f172a] leading-none mb-2">
            {value}
          </p>
          {subtitle && (
            <p className="text-xs text-[#64748b]">{subtitle}</p>
          )}
          {trend && (
            <div className={cn('flex items-center gap-1 mt-2 text-xs font-medium', trendColor)}>
              <TrendIcon className="w-3.5 h-3.5" />
              <span>{trend.value}</span>
            </div>
          )}
        </div>
        {Icon && (
          <div
            className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ml-4"
            style={{ backgroundColor: `${iconColor}15` }}
          >
            <Icon className="w-5 h-5" style={{ color: iconColor }} />
          </div>
        )}
      </div>
    </Card>
  );
}
