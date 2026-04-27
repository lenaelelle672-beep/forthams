/**
 * KpiCards 组件 — 审计日志仪表板关键指标卡片
 *
 * 展示审计日志的核心统计指标，包括：
 * - 总操作数
 * - 今日操作数
 * - 活跃操作人数
 * - 最频繁操作类型
 *
 * 数据来源于 useAuditData hook，支持加载态与空数据态。
 * 时间展示统一转换为用户本地时区。
 * 操作类型由后端元数据接口动态下发，前端不硬编码。
 */
import React, { useMemo } from 'react';
import styles from './KpiCards.module.css';

/** 单个 KPI 卡片的数据结构 */
export interface KpiCardData {
  /** 指标唯一标识 */
  key: string;
  /** 指标显示标题 */
  title: string;
  /** 指标数值 */
  value: number | string;
  /** 指标描述或补充信息 */
  description?: string;
  /** 趋势方向：上升、下降或持平 */
  trend?: 'up' | 'down' | 'flat';
  /** 趋势百分比变化值 */
  trendValue?: number;
  /** 图标名称（可选，用于扩展） */
  icon?: string;
}

/** useAuditData hook 返回的审计摘要数据结构 */
export interface AuditSummaryData {
  /** 符合筛选条件的总操作数 */
  totalLogs: number;
  /** 今日操作数（本地时区计算） */
  todayLogs: number;
  /** 活跃操作人数量 */
  uniqueOperators: number;
  /** 最频繁操作类型（动态从后端获取） */
  topActionType: string;
  /** 与上一周期相比的总操作数变化百分比 */
  totalLogsTrend?: number;
  /** 与昨日相比的今日操作数变化百分比 */
  todayLogsTrend?: number;
  /** 与上一周期相比的操作人变化百分比 */
  uniqueOperatorsTrend?: number;
}

/** KpiCards 组件属性 */
export interface KpiCardsProps {
  /** 审计摘要数据，由 useAuditData hook 提供 */
  summary: AuditSummaryData | null;
  /** 数据加载状态 */
  loading: boolean;
  /** 数据加载错误信息 */
  error: string | null;
  /** 可选的自定义类名 */
  className?: string;
}

/**
 * 格式化大数字为可读字符串
 *
 * 当数字超过 1000 时使用 k 后缀缩写，
 * 超过 1000000 时使用 M 后缀缩写。
 *
 * @param value - 待格式化的数值
 * @returns 格式化后的字符串表示
 */
export function formatKpiValue(value: number | string): string {
  if (typeof value === 'string') {
    return value;
  }
  if (value >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(1)}M`;
  }
  if (value >= 1_000) {
    return `${(value / 1_000).toFixed(1)}k`;
  }
  return value.toLocaleString();
}

/**
 * 根据趋势百分比计算趋势方向
 *
 * @param trendValue - 与上一周期相比的变化百分比
 * @returns 趋势方向标识
 */
export function computeTrendDirection(trendValue: number | undefined): 'up' | 'down' | 'flat' {
  if (trendValue === undefined || trendValue === 0) {
    return 'flat';
  }
  return trendValue > 0 ? 'up' : 'down';
}

/**
 * 格式化趋势百分比为显示字符串
 *
 * @param trendValue - 变化百分比数值
 * @returns 带正负号和百分号的字符串
 */
export function formatTrendPercent(trendValue: number | undefined): string {
  if (trendValue === undefined) {
    return '';
  }
  const sign = trendValue > 0 ? '+' : '';
  return `${sign}${trendValue.toFixed(1)}%`;
}

/**
 * 将审计摘要数据转换为 KPI 卡片数据数组
 *
 * 按照仪表板设计规范，将摘要数据映射为四个 KPI 卡片：
 * 总操作数、今日操作数、活跃操作人数、最频繁操作类型。
 * 操作类型标签由后端元数据接口动态下发，此处仅做展示映射。
 *
 * @param summary - 审计摘要数据
 * @returns KPI 卡片数据数组
 */
export function mapSummaryToCards(summary: AuditSummaryData): KpiCardData[] {
  return [
    {
      key: 'totalLogs',
      title: '总操作数',
      value: summary.totalLogs,
      description: '符合筛选条件的操作记录总数',
      trend: computeTrendDirection(summary.totalLogsTrend),
      trendValue: summary.totalLogsTrend,
      icon: 'total',
    },
    {
      key: 'todayLogs',
      title: '今日操作数',
      value: summary.todayLogs,
      description: '今日（本地时区）操作记录数',
      trend: computeTrendDirection(summary.todayLogsTrend),
      trendValue: summary.todayLogsTrend,
      icon: 'today',
    },
    {
      key: 'uniqueOperators',
      title: '活跃操作人',
      value: summary.uniqueOperators,
      description: '筛选范围内不同操作人数量',
      trend: computeTrendDirection(summary.uniqueOperatorsTrend),
      trendValue: summary.uniqueOperatorsTrend,
      icon: 'operators',
    },
    {
      key: 'topActionType',
      title: '最频繁操作',
      value: summary.topActionType || '--',
      description: '操作频次最高的操作类型',
      icon: 'topAction',
    },
  ];
}

/**
 * 渲染单个 KPI 卡片的趋势标识
 *
 * 根据趋势方向渲染上升/下降/持平的视觉标识。
 *
 * @param trend - 趋势方向
 * @param trendValue - 趋势百分比数值
 * @returns React 节点
 */
export function renderTrendIndicator(trend: 'up' | 'down' | 'flat', trendValue?: number): React.ReactNode {
  if (trend === 'flat' && trendValue === undefined) {
    return null;
  }

  const trendClass =
    trend === 'up'
      ? styles.trendUp
      : trend === 'down'
        ? styles.trendDown
        : styles.trendFlat;

  const arrow = trend === 'up' ? '↑' : trend === 'down' ? '↓' : '→';

  return (
    <span className={`${styles.trendIndicator} ${trendClass}`}>
      <span className={styles.trendArrow}>{arrow}</span>
      <span className={styles.trendValue}>{formatTrendPercent(trendValue)}</span>
    </span>
  );
}

/**
 * 渲染单个 KPI 卡片
 *
 * @param card - KPI 卡片数据
 * @returns React 节点
 */
export function renderKpiCard(card: KpiCardData): React.ReactNode {
  return (
    <div key={card.key} className={styles.kpiCard} data-testid={`kpi-card-${card.key}`}>
      <div className={styles.kpiCardHeader}>
        <span className={styles.kpiCardTitle}>{card.title}</span>
        {card.trend !== undefined && renderTrendIndicator(card.trend, card.trendValue)}
      </div>
      <div className={styles.kpiCardValue} data-testid={`kpi-value-${card.key}`}>
        {formatKpiValue(card.value)}
      </div>
      {card.description && (
        <div className={styles.kpiCardDescription}>{card.description}</div>
      )}
    </div>
  );
}

/**
 * 渲染加载态骨架屏卡片
 *
 * 在数据加载期间展示占位骨架，提升用户体验。
 *
 * @param count - 骨架卡片数量
 * @returns React 节点数组
 */
export function renderSkeletonCards(count: number = 4): React.ReactNode {
  return Array.from({ length: count }, (_, index) => (
    <div key={`skeleton-${index}`} className={`${styles.kpiCard} ${styles.skeleton}`}>
      <div className={styles.kpiCardHeader}>
        <span className={`${styles.skeletonLine} ${styles.skeletonTitle}`} />
      </div>
      <div className={`${styles.skeletonLine} ${styles.skeletonValue}`} />
      <div className={`${styles.skeletonLine} ${styles.skeletonDesc}`} />
    </div>
  ));
}

/**
 * 渲染错误状态卡片
 *
 * 当数据加载失败时，展示错误提示信息。
 *
 * @param errorMessage - 错误信息文本
 * @returns React 节点
 */
export function renderErrorCards(errorMessage: string): React.ReactNode {
  return (
    <div className={`${styles.kpiCard} ${styles.errorCard}`} data-testid="kpi-cards-error">
      <div className={styles.errorIcon}>⚠</div>
      <div className={styles.errorMessage}>{errorMessage}</div>
    </div>
  );
}

/**
 * KpiCards 组件 — 审计日志仪表板关键指标卡片组
 *
 * 展示审计日志的核心统计指标卡片组，包括总操作数、今日操作数、
 * 活跃操作人数和最频繁操作类型。支持加载态骨架屏和错误态展示。
 *
 * @param props - 组件属性
 * @param props.summary - 审计摘要数据
 * @param props.loading - 是否正在加载
 * @param props.error - 错误信息
 * @param props.className - 自定义类名
 * @returns KPI 卡片组 React 节点
 */
export function KpiCards({ summary, loading, error, className }: KpiCardsProps): React.ReactElement {
  const containerClass = useMemo(() => {
    const classes = [styles.kpiCardsContainer];
    if (className) {
      classes.push(className);
    }
    return classes.join(' ');
  }, [className]);

  /** 加载态：展示骨架屏 */
  if (loading) {
    return (
      <div className={containerClass} data-testid="kpi-cards-loading">
        {renderSkeletonCards(4)}
      </div>
    );
  }

  /** 错误态：展示错误信息 */
  if (error) {
    return (
      <div className={containerClass} data-testid="kpi-cards-error">
        {renderErrorCards(error)}
      </div>
    );
  }

  /** 空数据态：展示占位提示 */
  if (!summary) {
    return (
      <div className={containerClass} data-testid="kpi-cards-empty">
        <div className={styles.emptyState}>
          <span className={styles.emptyText}>暂无审计数据</span>
        </div>
      </div>
    );
  }

  /** 正常态：将摘要数据映射为卡片并渲染 */
  const cards = mapSummaryToCards(summary);

  return (
    <div className={containerClass} data-testid="kpi-cards">
      {cards.map(renderKpiCard)}
    </div>
  );
}

export default KpiCards;