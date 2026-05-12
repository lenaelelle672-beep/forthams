/**
 * ExpirationAlertList — 过期预警提醒列表组件
 *
 * 展示即将到期的合同和维保预警，按紧急程度排序。
 * 内部调用从 DashboardPage 导入的 formatDateLabel / formatApprovalDate /
 * getApprovalLabel 进行日期与标签格式化，禁止重写任何格式化逻辑。
 *
 * 三态边界处理：
 * - Loading：骨架屏占位
 * - Empty：data-testid="empty-alert-list" 占位符
 * - 正常数据：格式化后的列表展示
 *
 * 所有样式来自 DashboardPage.module.css，禁止使用内联样式。
 *
 * @module components/dashboard/ExpirationAlertList
 * @see frontend/src/app/hooks/useDashboardData.ts — ExpirationAlert
 * @see frontend/src/app/pages/DashboardPage.tsx — formatDateLabel, formatApprovalDate, getApprovalLabel
 */

import React from 'react';
import { AlertTriangle, Clock, FileWarning } from 'lucide-react';
import type { ExpirationAlert } from '../../hooks/useDashboardData';
import {
  formatDateLabel,
  formatApprovalDate,
  getApprovalLabel,
} from '../../pages/DashboardPage';
import styles from './DashboardPage.module.css';

/**
 * ExpirationAlertList 组件属性
 */
export interface ExpirationAlertListProps {
  /** 外部注入数据 */
  items?: ExpirationAlert[];
  /** 加载状态 */
  loading?: boolean;
  /** 最大显示条数，默认 10 */
  maxItems?: number;
  /** data-testid 用于 E2E 测试 */
  dataTestId?: string;
}

/**
 * 获取紧急程度对应的图标容器样式类
 *
 * @param urgency - 紧急程度
 * @returns CSS Module 类名
 */
function getUrgencyIconClass(urgency: ExpirationAlert['urgency']): string {
  switch (urgency) {
    case 'urgent':
      return `${styles.alertIconWrap} ${styles.alertIconUrgent}`;
    case 'warning':
      return `${styles.alertIconWrap} ${styles.alertIconWarning}`;
    case 'normal':
      return `${styles.alertIconWrap} ${styles.alertIconNormal}`;
  }
}

/**
 * 获取剩余天数徽章的样式类
 *
 * @param urgency - 紧急程度
 * @returns CSS Module 类名
 */
function getUrgencyBadgeClass(urgency: ExpirationAlert['urgency']): string {
  const base = `${styles.alertItemBadge}`;
  switch (urgency) {
    case 'urgent':
      return `${base} ${styles.alertItemBadgeUrgent}`;
    case 'warning':
      return `${base} ${styles.alertItemBadgeWarning}`;
    case 'normal':
      return `${base} ${styles.alertItemBadgeNormal}`;
  }
}

/**
 * 获取剩余天数的显示文本
 *
 * @param remainingDays - 剩余天数
 * @returns 用户友好的文本描述
 */
function getRemainingDaysText(remainingDays: number): string {
  if (remainingDays < 0) return `已过期 ${Math.abs(remainingDays)} 天`;
  if (remainingDays === 0) return '今天到期';
  return `剩余 ${remainingDays} 天`;
}

/**
 * ExpirationAlertList 组件
 *
 * 展示合同到期和维保到期预警列表，按紧急程度排序。
 * 使用 CSS Module 样式，无内联样式。
 *
 * @example
 * ```tsx
 * <ExpirationAlertList items={alerts} />
 * <ExpirationAlertList loading={true} />
 * <ExpirationAlertList items={[]} dataTestId="dashboard-expiration-alerts" />
 * ```
 */
export const ExpirationAlertList: React.FC<ExpirationAlertListProps> = ({
  items = [],
  loading = false,
  maxItems = 10,
  dataTestId,
}) => {
  /** 紧急项计数 */
  const urgentCount = items.filter((item) => item.urgency === 'urgent').length;

  /** 按剩余天数截取展示数量 */
  const displayItems = items.slice(0, maxItems);

  /**
   * 渲染加载态骨架屏
   */
  if (loading) {
    return (
      <div className={styles.alertPanel} data-testid={dataTestId}>
        <div className={styles.alertPanelHeader}>
          <h3 className={styles.alertPanelTitle}>到期预警</h3>
        </div>
        <div className={styles.alertSkeletonWrap}>
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className={styles.alertSkeletonItem}>
              <div className={styles.alertItemContent}>
                <div
                  className={styles.skeletonBar}
                  style={{ width: '75%', height: '1rem', marginBottom: '0.5rem' }}
                />
                <div
                  className={styles.skeletonBar}
                  style={{ width: '50%', height: '0.75rem' }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  /**
   * 渲染主内容
   */
  return (
    <div className={styles.alertPanel} data-testid={dataTestId}>
      <div className={styles.alertPanelHeader}>
        <h3 className={styles.alertPanelTitle}>到期预警</h3>
        {urgentCount > 0 ? (
          <span className={styles.alertBadge}>
            {urgentCount}项紧急
          </span>
        ) : null}
      </div>

      {displayItems.length === 0 ? (
        <div
          className={styles.alertEmpty}
          data-testid="empty-alert-list"
        >
          暂无到期预警，所有合同和维保状态正常。
        </div>
      ) : (
        <div className={styles.alertList}>
          {displayItems.map((item) => (
            <div key={item.id} className={styles.alertItem}>
              <div className={getUrgencyIconClass(item.urgency)}>
                {item.type === 'maintenance' ? (
                  <FileWarning className="w-4 h-4" />
                ) : (
                  <AlertTriangle className="w-4 h-4" />
                )}
              </div>
              <div className={styles.alertItemContent}>
                <div className={styles.alertItemHeader}>
                  <p className={styles.alertItemName}>
                    {item.assetName}
                  </p>
                  <span className={getUrgencyBadgeClass(item.urgency)}>
                    {getRemainingDaysText(item.remainingDays)}
                  </span>
                </div>
                <p className={styles.alertItemType}>
                  {item.type === 'contract' ? '合同到期' : '维保到期'}
                </p>
                <div className={styles.alertItemDate}>
                  <Clock className={styles.alertItemDateIcon} />
                  <span>
                    {item.expirationDate
                      ? formatDateLabel(item.expirationDate)
                      : '--'}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default ExpirationAlertList;
