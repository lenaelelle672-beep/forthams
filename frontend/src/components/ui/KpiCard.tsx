/**
 * @file components/ui/KpiCard.tsx
 * @description 仪表板 KPI 统计卡片
 * 支持：数值、标签、趋势、图标、颜色主题、计数动画、渐变背景
 */

import * as React from 'react';
import { motion, useMotionValue, useTransform, animate } from 'motion/react';
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
  /** 渐变背景选项：'none' | 'brand' | 'warm' | 'cool' */
  gradientBg?: 'none' | 'brand' | 'warm' | 'cool';
  /** 启用计数动画（仅对数字类型有效） */
  animateCount?: boolean;
}

const GRADIENT_BG_MAP = {
  none: '',
  brand: 'bg-gradient-to-br from-blue-50 to-white border-blue-100',
  warm: 'bg-gradient-to-br from-orange-50 to-white border-orange-100',
  cool: 'bg-gradient-to-br from-cyan-50 to-white border-cyan-100',
};

export function KpiCard({
  title,
  value,
  subtitle,
  trend,
  icon: Icon,
  iconColor = '#1d4ed8',
  className,
  loading,
  gradientBg = 'none',
  animateCount = false,
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

  // 计数动画
  const countRef = React.useRef<HTMLSpanElement>(null);
  const numericValue = typeof value === 'number' ? value : parseFloat(String(value).replace(/[^0-9.-]/g, ''));
  const isNumeric = !isNaN(numericValue);
  const motionValue = useMotionValue(0);
  const displayValue = useTransform(motionValue, (latest) => {
    if (typeof value === 'number') {
      return Math.round(latest).toLocaleString();
    }
    return String(value);
  });

  React.useEffect(() => {
    if (animateCount && isNumeric && !loading) {
      const controls = animate(motionValue, numericValue, {
        duration: 1.2,
        ease: [0.25, 0.1, 0.25, 1],
      });
      return controls.stop;
    } else {
      motionValue.set(isNumeric ? numericValue : 0);
    }
  }, [animateCount, isNumeric, numericValue, loading, motionValue]);

  if (loading) {
    return (
      <Card className={cn('overflow-hidden p-5', className)}>
        <div className="animate-pulse space-y-3 motion-reduce:animate-none" aria-hidden="true">
          <div className="h-4 w-24 rounded bg-[var(--surface-muted-strong)]" />
          <div className="h-8 w-32 rounded bg-[var(--surface-muted-strong)]" />
          <div className="h-3 w-20 rounded bg-[var(--surface-muted-strong)]" />
        </div>
      </Card>
    );
  }

  return (
    <motion.div
      whileHover={{ scale: 1.02, y: -2 }}
      transition={{ type: 'spring', stiffness: 300, damping: 24 }}
      className={cn('motion-reduce:hover:scale-100 motion-reduce:hover:translate-y-0')}
    >
      <Card className={cn('group overflow-hidden p-5', gradientBg !== 'none' && GRADIENT_BG_MAP[gradientBg], className)}>
        <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#93c5fd]/70 to-transparent opacity-0 transition-opacity duration-200 group-hover:opacity-100 motion-reduce:transition-none" />
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <p className="mb-1 text-sm font-semibold text-[var(--surface-muted-text)]">{title}</p>
            <p className="mb-2 text-3xl font-bold leading-none tracking-[-0.03em] text-[var(--surface-heading)]">
              {animateCount && isNumeric ? (
                <motion.span ref={countRef}>{displayValue}</motion.span>
              ) : (
                value
              )}
            </p>
            {subtitle && (
              <p className="text-xs leading-5 text-[var(--surface-muted-text)]">{subtitle}</p>
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
              className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ml-4 border border-white/70 shadow-inner ring-1 ring-slate-900/5"
              style={{ backgroundColor: `${iconColor}15` }}
            >
              <Icon className="w-5 h-5" style={{ color: iconColor }} />
            </div>
          )}
        </div>
      </Card>
    </motion.div>
  );
}
