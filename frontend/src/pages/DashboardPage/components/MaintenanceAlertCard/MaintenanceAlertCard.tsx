/**
 * MaintenanceAlertCard Component
 * 
 * 维保到期预警卡片组件
 * 展示7天内/30天内即将到期的维保项，支持快速跳转至维保详情
 * 
 * @packageDocumentation
 */

import React, { useMemo } from 'react';
import { AlertTriangle, Clock, ChevronRight } from 'lucide-react';
import styles from './MaintenanceAlertCard.module.css';

// ============================================================================
// Types
// ============================================================================

/**
 * 维保预警项数据结构
 */
export interface MaintenanceAlertItem {
  /** 维保记录ID */
  id: number;
  /** 资产ID */
  assetId: number;
  /** 资产名称 */
  assetName: string;
  /** 维保类型 */
  maintenanceType: string;
  /** 到期日期 */
  expireDate: string;
  /** 剩余天数 */
  remainingDays: number;
  /** 维保供应商 */
  vendor?: string;
}

/**
 * 维保预警汇总数据
 */
export interface MaintenanceAlertSummary {
  /** 7天内预警数量 */
  urgentCount: number;
  /** 30天内预警数量 */
  warningCount: number;
}

/**
 * 维保预警卡片组件属性
 */
export interface MaintenanceAlertCardProps {
  /** 预警列表数据 */
  alerts: MaintenanceAlertItem[];
  /** 预警汇总数据 */
  summary: MaintenanceAlertSummary;
  /** 加载状态 */
  loading?: boolean;
  /** 点击跳转回调 */
  onAlertClick?: (alert: MaintenanceAlertItem) => void;
  /** 查看全部回调 */
  onViewAllClick?: () => void;
}

// ============================================================================
// Constants
// ============================================================================

/** 紧急预警阈值（天） */
const URGENT_THRESHOLD = 7;

/** 警告预警阈值（天） */
const WARNING_THRESHOLD = 30;

/** 紧急预警颜色 */
const URGENT_COLOR = '#ef4444';

/** 警告预警颜色 */
const WARNING_COLOR = '#f59e0b';

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * 按剩余天数分类预警项
 * 
 * @param alerts - 预警列表
 * @returns 分类后的预警数据
 */
function classifyAlerts(alerts: MaintenanceAlertItem[]): {
  urgent: MaintenanceAlertItem[];
  warning: MaintenanceAlertItem[];
} {
  const urgent: MaintenanceAlertItem[] = [];
  const warning: MaintenanceAlertItem[] = [];

  for (const alert of alerts) {
    if (alert.remainingDays <= URGENT_THRESHOLD) {
      urgent.push(alert);
    } else if (alert.remainingDays <= WARNING_THRESHOLD) {
      warning.push(alert);
    }
  }

  return { urgent, warning };
}

/**
 * 格式化剩余天数显示文本
 * 
 * @param days - 剩余天数
 * @returns 格式化的文本
 */
function formatRemainingDays(days: number): string {
  if (days <= 0) {
    return '已过期';
  } else if (days === 1) {
    return '明天到期';
  } else if (days <= 7) {
    return `${days}天后到期`;
  } else {
    return `${days}天后到期`;
  }
}

/**
 * 格式化日期显示
 * 
 * @param dateString - ISO日期字符串
 * @returns 格式化后的日期
 */
function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString('zh-CN', {
    month: 'short',
    day: 'numeric',
  });
}

// ============================================================================
// Sub-Components
// ============================================================================

/**
 * 预警汇总区域组件
 * 
 * @param props - 汇总数据
 */
interface AlertSummaryProps {
  summary: MaintenanceAlertSummary;
}

/**
 * 预警汇总区域
 * 显示7天内和30天内预警数量
 */
const AlertSummary: React.FC<AlertSummaryProps> = ({ summary }) => (
  <div className={styles.summary}>
    <div className={styles.summaryItem} data-type="urgent">
      <AlertTriangle size={16} />
      <span className={styles.summaryLabel}>7天内</span>
      <span className={styles.summaryCount}>{summary.urgentCount}</span>
    </div>
    <div className={styles.summaryItem} data-type="warning">
      <Clock size={16} />
      <span className={styles.summaryLabel}>30天内</span>
      <span className={styles.summaryCount}>{summary.warningCount}</span>
    </div>
  </div>
);

/**
 * 单个预警项组件
 * 
 * @param props - 预警项数据及回调
 */
interface AlertItemProps {
  alert: MaintenanceAlertItem;
  onClick?: () => void;
}

/**
 * 预警项渲染
 * 包含资产名称、维保类型、到期时间等信息
 */
const AlertItem: React.FC<AlertItemProps> = ({ alert, onClick }) => {
  const isUrgent = alert.remainingDays <= URGENT_THRESHOLD;
  const alertColor = isUrgent ? URGENT_COLOR : WARNING_COLOR;

  return (
    <div 
      className={styles.alertItem}
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyPress={(e) => e.key === 'Enter' && onClick?.()}
    >
      <div className={styles.alertItemContent}>
        <div className={styles.alertItemHeader}>
          <span className={styles.assetName}>{alert.assetName}</span>
          <span 
            className={styles.remainingDays}
            style={{ color: alertColor }}
          >
            {formatRemainingDays(alert.remainingDays)}
          </span>
        </div>
        <div className={styles.alertItemMeta}>
          <span className={styles.maintenanceType}>{alert.maintenanceType}</span>
          {alert.vendor && (
            <span className={styles.vendor}>{alert.vendor}</span>
          )}
        </div>
        <div className={styles.alertItemDate}>
          到期: {formatDate(alert.expireDate)}
        </div>
      </div>
      <ChevronRight size={16} className={styles.chevron} />
    </div>
  );
};

/**
 * 预警分区组件
 * 
 * @param props - 分区数据
 */
interface AlertSectionProps {
  title: string;
  alerts: MaintenanceAlertItem[];
  type: 'urgent' | 'warning';
  onAlertClick?: (alert: MaintenanceAlertItem) => void;
}

/**
 * 预警分区
 * 按7天内/30天内分类显示预警列表
 */
const AlertSection: React.FC<AlertSectionProps> = ({ 
  title, 
  alerts, 
  type,
  onAlertClick 
}) => {
  if (alerts.length === 0) {
    return null;
  }

  return (
    <div className={styles.alertSection} data-type={type}>
      <div className={styles.sectionTitle}>
        {title}
        <span className={styles.sectionCount}>{alerts.length}</span>
      </div>
      <div className={styles.alertList}>
        {alerts.map((alert) => (
          <AlertItem
            key={alert.id}
            alert={alert}
            onClick={() => onAlertClick?.(alert)}
          />
        ))}
      </div>
    </div>
  );
};

/**
 * 空状态组件
 */
const EmptyState: React.FC = () => (
  <div className={styles.emptyState}>
    <div className={styles.emptyIcon}>✓</div>
    <div className={styles.emptyText}>暂无维保预警</div>
    <div className={styles.emptySubtext}>所有资产维保状态正常</div>
  </div>
);

/**
 * 加载状态组件
 */
const LoadingState: React.FC = () => (
  <div className={styles.loadingState}>
    <div className={styles.skeleton} />
    <div className={styles.skeleton} />
    <div className={styles.skeleton} />
  </div>
);

// ============================================================================
// Main Component
// ============================================================================

/**
 * MaintenanceAlertCard
 * 
 * 维保到期预警卡片主组件
 * 用于仪表板首页展示维保预警信息
 * 
 * @example
 * ```tsx
 * <MaintenanceAlertCard
 *   alerts={alertList}
 *   summary={{ urgentCount: 2, warningCount: 5 }}
 *   onAlertClick={(alert) => navigate(`/maintenance/${alert.id}`)}
 * />
 * ```
 */
const MaintenanceAlertCard: React.FC<MaintenanceAlertCardProps> = ({
  alerts,
  summary,
  loading = false,
  onAlertClick,
  onViewAllClick,
}) => {
  // 按时间分类预警
  const { urgent, warning } = useMemo(
    () => classifyAlerts(alerts),
    [alerts]
  );

  // 是否有预警数据
  const hasAlerts = alerts.length > 0;

  // 处理预警项点击
  const handleAlertClick = (alert: MaintenanceAlertItem) => {
    onAlertClick?.(alert);
  };

  // 处理查看全部点击
  const handleViewAllClick = () => {
    onViewAllClick?.();
  };

  // 渲染加载状态
  if (loading) {
    return (
      <div id="maintenance-alert-card" className={styles.card}>
        <div className={styles.header}>
          <h3 className={styles.title}>维保到期预警</h3>
        </div>
        <LoadingState />
      </div>
    );
  }

  // 渲染空状态
  if (!hasAlerts) {
    return (
      <div id="maintenance-alert-card" className={styles.card}>
        <div className={styles.header}>
          <h3 className={styles.title}>维保到期预警</h3>
        </div>
        <EmptyState />
      </div>
    );
  }

  // 渲染预警卡片
  return (
    <div id="maintenance-alert-card" className={styles.card}>
      <div className={styles.header}>
        <h3 className={styles.title}>维保到期预警</h3>
        <button 
          className={styles.viewAllButton}
          onClick={handleViewAllClick}
        >
          查看全部
        </button>
      </div>
      
      <AlertSummary summary={summary} />
      
      <div className={styles.alertContent}>
        <AlertSection
          title="7天内"
          alerts={urgent}
          type="urgent"
          onAlertClick={handleAlertClick}
        />
        <AlertSection
          title="30天内"
          alerts={warning}
          type="warning"
          onAlertClick={handleAlertClick}
        />
      </div>
    </div>
  );
};

// ============================================================================
// Exports
// ============================================================================

export default MaintenanceAlertCard;

export {
  classifyAlerts,
  formatRemainingDays,
  formatDate,
  AlertSummary,
  AlertItem,
  AlertSection,
  EmptyState,
  LoadingState,
};

export type {
  MaintenanceAlertItem,
  MaintenanceAlertSummary,
  MaintenanceAlertCardProps,
  AlertSummaryProps,
  AlertItemProps,
  AlertSectionProps,
};