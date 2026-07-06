/**
 * AssetSummaryCard — 资产汇总统计卡片组件
 *
 * 展示资产数量或金额的汇总指标，内部调用从 DashboardPage 导入的
 * formatNumber / formatCurrency 进行格式化渲染，禁止重写格式化逻辑。
 *
 * 支持三种渲染状态：
 * - Loading：骨架屏占位
 * - 正常数据：格式化后的数值展示
 *
 * @module components/dashboard/AssetSummaryCard
 * @see frontend/src/app/pages/DashboardPage.tsx — formatNumber, formatCurrency
 */

import React from 'react';
import type { LucideIcon } from 'lucide-react';
import { formatNumber, formatCurrency } from '../../pages/DashboardPage';
import styles from './DashboardPage.module.css';

/**
 * AssetSummaryCard 组件属性
 */
export interface AssetSummaryCardProps {
  /** 卡片标题，如 "资产总数"、"资产净值" */
  title: string;
  /** 主数值（原始 number 或已格式化的 string） */
  value: number | string;
  /** 辅助说明文本 */
  detail?: string;
  /** 图标组件（来自 lucide-react） */
  icon: LucideIcon;
  /** 图标容器背景样式类后缀 */
  iconBgColor?: string;
  /** 图标文字色 */
  iconTextColor?: string;
  /** 加载态标记 */
  loading?: boolean;
  /** data-testid 用于 E2E 测试 */
  dataTestId?: string;
}

/**
 * AssetSummaryCard 组件
 *
 * 根据 title 判断是否使用货币格式化（包含"净值"/"总值"/"价值"关键词），
 * 否则使用数值格式化。外部可传入已格式化的 string 以跳过二次格式化。
 *
 * @example
 * ```tsx
 * <AssetSummaryCard
 *   title="资产总数"
 *   value={1280}
 *   detail="在用资产 1024"
 *   icon={Package}
 *   iconBgColor="bg-blue-50"
 *   iconTextColor="text-blue-600"
 *   dataTestId="stat-total"
 * />
 * ```
 */
export const AssetSummaryCard: React.FC<AssetSummaryCardProps> = ({
  title,
  value,
  detail,
  icon: Icon,
  iconBgColor,
  iconTextColor,
  loading = false,
  dataTestId,
}) => {
  /**
   * 渲染加载态骨架屏
   */
  if (loading) {
    return (
      <div
        className={styles.summaryCardSkeleton}
        data-testid={dataTestId ? `${dataTestId}-loading` : undefined}
      >
        <div className={styles.summaryCardContent}>
          <div className={styles.summaryCardInfo}>
            <div className={`${styles.skeletonBar} ${styles.skeletonBarSm}`} />
            <div className={`${styles.skeletonBar} ${styles.skeletonBarLg}`} />
            <div className={`${styles.skeletonBar} ${styles.skeletonBarXs}`} />
          </div>
          <div className={`${styles.skeletonBar}`} style={{ width: '3rem', height: '3rem' }} />
        </div>
      </div>
    );
  }

  /**
   * 判断是否需要货币格式化
   */
  const isCurrency =
    typeof value === 'string' && (value.includes('¥') || value.startsWith('CNY'));

  /**
   * 对原始数值进行格式化
   */
  const displayValue =
    typeof value === 'number'
      ? title.includes('净值') || title.includes('总值') || title.includes('价值')
        ? formatCurrency(value)
        : formatNumber(value)
      : String(value);

  return (
    <div className={styles.summaryCard} data-testid={dataTestId}>
      <div className={styles.summaryCardContent}>
        <div className={styles.summaryCardInfo}>
          <p className={styles.summaryCardLabel}>{title}</p>
          <p className={styles.summaryCardValue}>{displayValue}</p>
          {detail ? <p className={styles.summaryCardDetail}>{detail}</p> : null}
        </div>
        <div
          className={styles.summaryCardIconWrap}
          style={{
            backgroundColor: iconBgColor || '#eff6ff',
            color: iconTextColor || '#2563eb',
          }}
        >
          <Icon className="w-6 h-6" />
        </div>
      </div>
    </div>
  );
};

export default AssetSummaryCard;
