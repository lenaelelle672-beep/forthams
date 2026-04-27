/**
 * StatCard Component
 * 
 * 仪表板统计卡片组件，用于展示资产总览的关键指标数据。
 * 支持数值展示、变化率显示、加载态、错误态和无数据态。
 * 
 * @module StatCard
 * @version 1.0.0
 * @see {@link https://xxx.com/docs/dashboard/stat-card} 组件文档
 * 
 * @example
 * // 基础用法
 * <StatCard
 *   label="资产总量"
 *   value={12345}
 *   loading={false}
 * />
 * 
 * @example
 * // 带变化率展示
 * <StatCard
 *   label="本月新增"
 *   value={256}
 *   change={12}
 *   changeRate={4.9}
 * />
 * 
 * @example
 * // 错误态示例
 * <StatCard
 *   label="资产总量"
 *   error={true}
 *   onRetry={handleRetry}
 * />
 */

import React, { useCallback, useMemo } from 'react';
import { AlertCircle, RefreshCw, TrendingUp, TrendingDown } from 'lucide-react';
import { Card, Skeleton, Tooltip } from '@/components/ui';
import clsx from 'clsx';
import styles from './StatCard.module.css';

// ============================================================================
// Type Definitions
// ============================================================================

/** 紧急度等级枚举 */
export enum UrgencyLevel {
  /** 紧急 - 已到期或接近到期 */
  CRITICAL = 'critical',
  /** 警告 - 7天内到期 */
  WARNING = 'warning',
  /** 注意 - 30天内到期 */
  NOTICE = 'notice',
  /** 正常 */
  NORMAL = 'normal',
}

/** 统计数据接口 */
export interface StatCardData {
  /** 指标标签 */
  label: string;
  /** 指标数值 */
  value: number;
  /** 变化量（绝对值） */
  change?: number;
  /** 变化率（百分比） */
  changeRate?: number;
  /** 图标类型 */
  icon?: string;
  /** 颜色主题 */
  theme?: 'primary' | 'success' | 'warning' | 'danger';
}

/** StatCard 组件 Props 接口 */
export interface StatCardProps {
  /** 指标标签 */
  label: string;
  /** 指标数值 */
  value?: number;
  /** 变化量（绝对值） */
  change?: number;
  /** 变化率（百分比） */
  changeRate?: number;
  /** 图标类型 */
  icon?: string;
  /** 颜色主题 */
  theme?: 'primary' | 'success' | 'warning' | 'danger';
  /** 加载状态 */
  loading?: boolean;
  /** 错误状态 */
  error?: boolean;
  /** 错误消息 */
  errorMessage?: string;
  /** 无数据状态 */
  empty?: boolean;
  /** 空状态提示文本 */
  emptyText?: string;
  /** 点击回调 */
  onClick?: (event: React.MouseEvent<HTMLDivElement>) => void;
  /** 重试回调 */
  onRetry?: () => void;
  /** 是否可点击 */
  clickable?: boolean;
  /** 自定义类名 */
  className?: string;
  /** 数字格式化选项 */
  formatOptions?: {
    /** 是否启用简写格式（如万） */
    abbreviated?: boolean;
    /** 小数位数 */
    decimals?: number;
    /** 前缀符号 */
    prefix?: string;
    /** 后缀符号 */
    suffix?: string;
  };
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * 格式化数字，根据阈值自动选择合适的显示格式。
 * 
 * @param value - 待格式化的数值
 * @param options - 格式化选项
 * @returns 格式化后的字符串
 * 
 * @description
 * 数字格式化规则：
 * - 超过 10000 显示为 "X.XX万" 格式
 * - 超过 100000000 显示为 "X.XX亿" 格式
 * - 小数部分根据 decimals 选项保留
 * 
 * @example
 * formatNumber(12345) // "1.23万"
 * formatNumber(123456789) // "1.23亿"
 * formatNumber(1234, { decimals: 2 }) // "1234.00"
 */
export function formatNumber(
  value: number,
  options: StatCardProps['formatOptions'] = {}
): string {
  const {
    abbreviated = true,
    decimals = 0,
    prefix = '',
    suffix = '',
  } = options;

  if (!abbreviated) {
    return `${prefix}${value.toFixed(decimals)}${suffix}`;
  }

  const absValue = Math.abs(value);
  let formatted: string;

  if (absValue >= 100000000) {
    // 亿级别
    formatted = `${(absValue / 100000000).toFixed(2)}亿`;
  } else if (absValue >= 10000) {
    // 万级别
    formatted = `${(absValue / 10000).toFixed(2)}万`;
  } else {
    // 普通数字
    formatted = absValue.toFixed(decimals);
  }

  // 处理负数
  return `${value < 0 ? '-' : ''}${prefix}${formatted}${suffix}`;
}

/**
 * 格式化变化率显示。
 * 
 * @param rate - 变化率（百分比）
 * @returns 带正负号的变化率字符串
 * 
 * @example
 * formatChangeRate(5.2) // "+5.2%"
 * formatChangeRate(-3.1) // "-3.1%"
 */
export function formatChangeRate(rate: number): string {
  const sign = rate > 0 ? '+' : '';
  return `${sign}${rate.toFixed(2)}%`;
}

/**
 * 计算剩余天数。
 * 
 * @param expireDate - 到期日期（ISO 8601 格式）
 * @returns 剩余天数（负数表示已过期）
 */
export function calculateDaysRemaining(expireDate: string | Date): number {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  
  const expire = new Date(expireDate);
  expire.setHours(0, 0, 0, 0);
  
  const diffTime = expire.getTime() - now.getTime();
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

/**
 * 获取紧急度等级。
 * 
 * @param daysRemaining - 剩余天数
 * @returns 紧急度等级
 */
export function getUrgencyLevel(daysRemaining: number): UrgencyLevel {
  if (daysRemaining < 0) {
    return UrgencyLevel.CRITICAL;
  } else if (daysRemaining <= 7) {
    return UrgencyLevel.WARNING;
  } else if (daysRemaining <= 30) {
    return UrgencyLevel.NOTICE;
  }
  return UrgencyLevel.NORMAL;
}

// ============================================================================
// Component
// ============================================================================

/**
 * StatCard 组件
 * 
 * 仪表板统计卡片，用于展示关键指标数据。支持多种状态展示：
 * - 正常态：展示数值和变化趋势
 * - 加载态：骨架屏占位
 * - 错误态：显示错误提示和重试按钮
 * - 无数据态：显示空状态提示
 * 
 * @param props - 组件属性
 * @returns StatCard 组件
 */
export const StatCard: React.FC<StatCardProps> = ({
  label,
  value,
  change,
  changeRate,
  icon,
  theme = 'primary',
  loading = false,
  error = false,
  errorMessage = '数据加载失败',
  empty = false,
  emptyText = '暂无数据',
  onClick,
  onRetry,
  clickable = false,
  className,
  formatOptions,
}) => {
  // 处理重试点击事件
  const handleRetryClick = useCallback(
    (e: React.MouseEvent<HTMLButtonElement>) => {
      e.stopPropagation();
      onRetry?.();
    },
    [onRetry]
  );

  // 处理卡片点击事件
  const handleClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (clickable && !loading && !error && !empty) {
        onClick?.(e);
      }
    },
    [clickable, loading, error, empty, onClick]
  );

  // 格式化后的数值
  const formattedValue = useMemo(() => {
    if (value === undefined || value === null) {
      return null;
    }
    return formatNumber(value, formatOptions);
  }, [value, formatOptions]);

  // 变化趋势方向
  const trendDirection = useMemo(() => {
    if (change === undefined || change === 0) {
      return 'neutral';
    }
    return change > 0 ? 'up' : 'down';
  }, [change]);

  // 组件类名
  const cardClassName = useMemo(() => {
    return clsx(
      styles.statCard,
      styles[`theme-${theme}`],
      {
        [styles.clickable]: clickable && !loading && !error && !empty,
        [styles.error]: error,
        [styles.empty]: empty,
      },
      className
    );
  }, [theme, clickable, loading, error, empty, className]);

  // 渲染加载态
  const renderLoadingState = useCallback(() => {
    return (
      <div className={styles.content}>
        <Skeleton className={styles.skeletonLabel} width="60%" />
        <Skeleton className={styles.skeletonValue} width="80%" />
        <Skeleton className={styles.skeletonTrend} width="40%" />
      </div>
    );
  }, []);

  // 渲染错误态
  const renderErrorState = useCallback(() => {
    return (
      <div className={styles.content}>
        <div className={styles.errorIcon}>
          <AlertCircle size={24} />
        </div>
        <p className={styles.errorMessage}>{errorMessage}</p>
        {onRetry && (
          <button
            type="button"
            className={styles.retryButton}
            onClick={handleRetryClick}
          >
            <RefreshCw size={14} />
            <span>重试</span>
          </button>
        )}
      </div>
    );
  }, [errorMessage, onRetry, handleRetryClick]);

  // 渲染无数据态
  const renderEmptyState = useCallback(() => {
    return (
      <div className={styles.content}>
        <p className={styles.emptyText}>{emptyText}</p>
      </div>
    );
  }, [emptyText]);

  // 渲染正常态
  const renderNormalState = useCallback(() => {
    return (
      <div className={styles.content}>
        <div className={styles.header}>
          <span className={styles.label}>{label}</span>
          {icon && (
            <Tooltip content={label}>
              <span className={styles.icon}>{icon}</span>
            </Tooltip>
          )}
        </div>

        <div className={styles.valueContainer}>
          <span className={styles.value}>{formattedValue}</span>
        </div>

        {(change !== undefined || changeRate !== undefined) && (
          <div className={clsx(styles.trend, styles[`trend-${trendDirection}`])}>
            {trendDirection === 'up' && <TrendingUp size={14} />}
            {trendDirection === 'down' && <TrendingDown size={14} />}
            {change !== undefined && (
              <span className={styles.change}>
                {change > 0 ? '+' : ''}
                {change}
              </span>
            )}
            {changeRate !== undefined && (
              <span className={styles.changeRate}>
                ({formatChangeRate(changeRate)})
              </span>
            )}
          </div>
        )}
      </div>
    );
  }, [
    label,
    icon,
    formattedValue,
    change,
    changeRate,
    trendDirection,
  ]);

  // 渲染内容
  const renderContent = useCallback(() => {
    if (loading) {
      return renderLoadingState();
    }
    if (error) {
      return renderErrorState();
    }
    if (empty || value === undefined) {
      return renderEmptyState();
    }
    return renderNormalState();
  }, [
    loading,
    error,
    empty,
    value,
    renderLoadingState,
    renderErrorState,
    renderEmptyState,
    renderNormalState,
  ]);

  return (
    <Card
      className={cardClassName}
      onClick={handleClick}
      role={clickable ? 'button' : undefined}
      tabIndex={clickable ? 0 : undefined}
    >
      {renderContent()}
    </Card>
  );
};

// ============================================================================
// Exports
// ============================================================================

export default StatCard;