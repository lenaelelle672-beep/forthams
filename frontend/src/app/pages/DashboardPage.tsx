/**
 * DashboardPage — 仪表板主页面（系统默认首页）
 *
 * 通过 useDashboardData Hook 及独立 API 调用获取真实数据，
 * 整合资产汇总卡片、分类分布饼图、过期预警提醒三大核心模块。
 *
 * 功能：
 * - 展示资产总数、待审批流程、闲置资产、资产净值四大核心指标
 * - 展示资产分类分布饼图
 * - 展示合同到期预警和维保到期预警
 * - 展示资产价值趋势折线图（调用 getValueTrends API）
 * - 展示部门资产分布饼图（调用 getDeptDistribution API）
 * - 展示待审批事项，支持批准/驳回操作
 * - 展示快速操作和保养日历
 *
 * 导出的格式化工具函数（供子组件作为外部依赖引入）：
 * - formatNumber — 数值千分位格式化
 * - formatCurrency — 货币（¥）格式化
 * - formatDateLabel — 日期月/日格式化
 * - formatApprovalDate — 审批日期格式化
 * - getApprovalLabel — 审批记录标签提取
 *
 * 状态三态处理：Loading（骨架屏）、Error（异常降级提示）、Empty（无数据占位）
 *
 * @module pages/DashboardPage
 * @see frontend/src/app/hooks/useDashboardData.ts — useDashboardData
 * @see frontend/src/app/services/dashboardService.ts — dashboardService
 * @see frontend/src/app/services/approvalService.ts — approvalService
 * @see frontend/src/app/components/dashboard/AssetSummaryCard.tsx
 * @see frontend/src/app/components/dashboard/CategoryPieChart.tsx
 * @see frontend/src/app/components/dashboard/ExpirationAlertList.tsx
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  CheckCircle,
  Clock,
  Package,
} from 'lucide-react';
import {
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { useDashboardData } from '../hooks/useDashboardData';
import { AssetSummaryCard } from '../components/dashboard/AssetSummaryCard';
import { CategoryPieChart } from '../components/dashboard/CategoryPieChart';
import { ExpirationAlertList } from '../components/dashboard/ExpirationAlertList';
import { QuickActions } from '../components/QuickActions';
import { MaintenanceCalendar } from '../components/MaintenanceCalendar';
import {
  dashboardService,
  type AssetValueTrend,
  type DeptDistribution,
} from '../services/dashboardService';
import {
  approvalService,
  type ApprovalRecord,
} from '../services/approvalService';
import styles from '../components/dashboard/DashboardPage.module.css';

// ── 导出格式化工具函数（供子组件作为外部依赖引入） ──

/**
 * 格式化数值显示
 *
 * @param value - 待格式化的值
 * @returns 格式化后的字符串
 */
export function formatNumber(value?: number | string): string {
  if (value === undefined || value === null || value === '') {
    return '--';
  }
  const numericValue = Number(value);
  if (Number.isNaN(numericValue)) {
    return String(value);
  }
  return new Intl.NumberFormat('zh-CN').format(numericValue);
}

/**
 * 格式化货币值
 *
 * @param value - 待格式化的货币值
 * @returns 带有 ¥ 前缀的格式化字符串
 */
export function formatCurrency(value?: number | string): string {
  if (value === undefined || value === null || value === '') {
    return '--';
  }
  const numericValue = Number(value);
  if (Number.isNaN(numericValue)) {
    return String(value);
  }
  return new Intl.NumberFormat('zh-CN', {
    style: 'currency',
    currency: 'CNY',
    maximumFractionDigits: 2,
  }).format(numericValue);
}

/**
 * 格式化日期标签（月/日）
 *
 * @param value - ISO 日期字符串
 * @returns 格式化后的日期文本
 */
export function formatDateLabel(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return new Intl.DateTimeFormat('zh-CN', {
    month: 'numeric',
    day: 'numeric',
  }).format(date);
}

/**
 * 格式化审批日期字段
 *
 * @param value - 日期值，通常是字符串
 * @returns 格式化后的日期文本或占位符
 */
export function formatApprovalDate(value: unknown): string {
  return typeof value === 'string' && value ? value : '-';
}

/**
 * 从审批记录中提取标签文本
 *
 * 依次尝试给定的字段名，返回第一个非空值。
 *
 * @param approval - 审批记录对象
 * @param keys - 优先尝试的字段名列表
 * @param fallback - 所有字段均为空时的回退值
 * @returns 提取到的标签文本
 */
export function getApprovalLabel(
  approval: ApprovalRecord,
  keys: string[],
  fallback = '-',
): string {
  for (const key of keys) {
    const value = approval[key];
    if (value !== undefined && value !== null && value !== '') {
      return String(value);
    }
  }
  return fallback;
}

/** 图表调色板 */
const CHART_PALETTE = [
  '#5470C6',
  '#91CC75',
  '#FAC858',
  '#EE6666',
  '#73C0DE',
  '#3BA272',
  '#FC8452',
  '#9A60B4',
  '#EA7CCC',
  '#0068B7',
];

/**
 * DashboardPage 主页面组件
 *
 * 使用 useDashboardData Hook 加载仪表板统计数据，
 * 并通过 dashboardService / approvalService 获取趋势、分布和审批数据。
 * 渲染资产汇总卡片、分类饼图、价值趋势折线图、部门分布饼图、
 * 待审批列表、最近动态、到期预警、快速操作和保养日历。
 *
 * 三态边界处理：
 * - Loading：骨架屏加载指示器
 * - Error：data-testid="dashboard-error-boundary" 异常降级
 * - Empty：各子组件内部独立处理空态
 *
 * @example
 * ```tsx
 * // 在路由中直接使用
 * <Route path="/" element={<DashboardPage />} />
 * ```
 */
export const DashboardPage: React.FC = () => {
  const {
    stats,
    categoryData,
    expirationAlerts,
    loading: statsLoading,
    error: statsError,
    refresh: refreshStats,
  } = useDashboardData();

  // ── 趋势、分布、审批等扩展数据 ──
  const [valueTrends, setValueTrends] = useState<AssetValueTrend[]>([]);
  const [deptDistribution, setDeptDistribution] = useState<DeptDistribution[]>([]);
  const [pendingApprovals, setPendingApprovals] = useState<ApprovalRecord[]>([]);
  const [extLoading, setExtLoading] = useState(true);
  const [extError, setExtError] = useState<string | null>(null);

  // ── 审批操作状态 ──
  const [approvalMessage, setApprovalMessage] = useState<string | null>(null);
  const [approvalError, setApprovalError] = useState<string | null>(null);
  const [processingApprovalId, setProcessingApprovalId] = useState<number | string | null>(null);
  const mountedRef = useRef(true);

  /**
   * 加载趋势、分布、审批扩展数据
   */
  const loadExtendedData = useCallback(async () => {
    setExtLoading(true);
    setExtError(null);

    try {
      let approvalLoadError: string | null = null;
      const [trendsResponse, distributionResponse, approvalsResponse] = await Promise.all([
        dashboardService.getValueTrends(),
        dashboardService.getDeptDistribution(),
        approvalService.getPending().catch((pendingError) => {
          approvalLoadError = pendingError instanceof Error
            ? pendingError.message
            : '待审批事项加载失败';
          return [];
        }),
      ]);

      if (!mountedRef.current) return;

      setValueTrends(trendsResponse);
      setDeptDistribution(distributionResponse);
      setPendingApprovals(
        (Array.isArray(approvalsResponse)
          ? approvalsResponse
          : (approvalsResponse as Record<string, unknown>)?.records) as ApprovalRecord[] || [],
      );
      setApprovalError(approvalLoadError);
    } catch (loadError) {
      if (!mountedRef.current) return;
      setExtError(loadError instanceof Error ? loadError.message : '扩展数据加载失败');
    } finally {
      if (mountedRef.current) setExtLoading(false);
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    void loadExtendedData();
    return () => {
      mountedRef.current = false;
    };
  }, [loadExtendedData]);

  const loading = statsLoading || extLoading;
  const error = statsError ?? extError;

  /**
   * 刷新全部仪表板数据
   */
  const refreshAll = useCallback(() => {
    refreshStats();
    void loadExtendedData();
  }, [refreshStats, loadExtendedData]);

  /** 统计卡片配置 */
  const statCards = useMemo(
    () => [
      {
        name: '资产总数',
        value: stats?.totalAssets ?? '--',
        detail: `在用资产 ${formatNumber(stats?.inUseAssets)}`,
        icon: Package,
        iconBgColor: '#eff6ff',
        iconTextColor: '#2563eb',
        dataTestId: 'stat-total',
      },
      {
        name: '待审批流程',
        value: stats?.pendingApprovals ?? '--',
        detail: '待处理审批事项',
        icon: Clock,
        iconBgColor: '#fffbeb',
        iconTextColor: '#d97706',
        dataTestId: 'stat-pending',
      },
      {
        name: '闲置资产',
        value: stats?.idleAssets ?? '--',
        detail: `报废资产 ${formatNumber(stats?.scrapAssets)}`,
        icon: AlertCircle,
        iconBgColor: '#fff7ed',
        iconTextColor: '#ea580c',
        dataTestId: 'stat-idle',
      },
      {
        name: '资产净值',
        value: stats?.netValue ?? '--',
        detail: `总值 ${formatCurrency(stats?.totalValue)}`,
        icon: CheckCircle,
        iconBgColor: '#f0fdf4',
        iconTextColor: '#16a34a',
        dataTestId: 'stat-value',
      },
    ],
    [stats],
  );

  /** 资产价值趋势图表数据 */
  const trendChartData = useMemo(
    () =>
      valueTrends.map((item) => ({
        date: formatDateLabel(item.date),
        totalValue: Number(item.totalValue),
        netValue: Number(item.netValue),
      })),
    [valueTrends],
  );

  /** 部门资产分布图表数据 */
  const distributionChartData = useMemo(
    () =>
      deptDistribution.map((item, index) => ({
        ...item,
        fill: CHART_PALETTE[index % CHART_PALETTE.length],
      })),
    [deptDistribution],
  );

  /** 最近动态列表（来自待审批事项） */
  const recentActivities = useMemo(
    () =>
      pendingApprovals.slice(0, 5).map((approval) => ({
        id: approval.id,
        title: getApprovalLabel(approval, ['title', 'type', 'processType', 'changeType'], '待审批事项'),
        detail: getApprovalLabel(approval, ['assetName', 'asset', 'reason', 'description'], '来自审批服务的待处理记录'),
        time: formatApprovalDate(approval.createTime ?? approval.createdAt ?? approval.applyDate),
        status: 'warning' as const,
      })),
    [pendingApprovals],
  );

  /**
   * 处理审批批准/驳回操作
   *
   * @param id - 审批记录 ID
   * @param approved - true 为批准，false 为驳回
   */
  const handleDashApprove = useCallback(async (id: number | string, approved: boolean) => {
    try {
      setProcessingApprovalId(id);
      setApprovalError(null);
      setApprovalMessage(null);
      await approvalService.approve(id, {
        approved,
        comment: approved ? '同意' : '驳回',
      });
      setApprovalMessage(approved ? '审批已批准' : '审批已驳回');
      setPendingApprovals((current) => current.filter((a) => a.id !== id));
    } catch (approveError) {
      setApprovalError(approveError instanceof Error ? approveError.message : '审批操作失败');
    } finally {
      setProcessingApprovalId(null);
    }
  }, []);

  return (
    <div data-testid="dashboard-page-container">
      {/* 页面标题 */}
      <div className={styles.pageHeader}>
        <div>
          <h2 className={styles.pageTitle}>仪表板</h2>
          <p className={styles.pageSubtitle}>欢迎回来，这是您的资产管理概览</p>
        </div>
        <button
          type="button"
          onClick={refreshAll}
          className={styles.refreshButton}
          disabled={loading}
          data-testid="dashboard-refresh"
        >
          {loading ? '加载中...' : '刷新数据'}
        </button>
      </div>

      {/* 全局加载态 */}
      {loading ? (
        <div className={styles.loadingBanner}>
          正在同步仪表板数据...
        </div>
      ) : null}

      {/* 全局错误态 — API 异常降级处理 (ATB-05) */}
      {error && !loading ? (
        <div
          className={styles.errorBoundary}
          data-testid="dashboard-error-boundary"
        >
          <div className={styles.errorBoundaryTitle}>加载失败</div>
          <div className={styles.errorBoundaryMessage}>{error}</div>
          <button
            type="button"
            className={styles.errorBoundaryRetry}
            onClick={refreshAll}
          >
            重试
          </button>
        </div>
      ) : null}

      {/* 资产汇总统计卡片 (ATB-02) */}
      <div className={styles.statsGrid}>
        {statCards.map((card) => (
          <AssetSummaryCard
            key={card.name}
            title={card.name}
            value={card.value}
            detail={card.detail}
            icon={card.icon}
            iconBgColor={card.iconBgColor}
            iconTextColor={card.iconTextColor}
            loading={loading}
            dataTestId={card.dataTestId}
          />
        ))}
      </div>

      {/* 资产价值趋势 & 部门资产分布 */}
      <div className={styles.twoColGrid}>
        {/* 资产价值趋势折线图 */}
        <div className={styles.chartPanel}>
          <h3 className={styles.chartPanelTitle}>资产价值趋势</h3>
          {trendChartData.length ? (
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={trendChartData}>
                <CartesianGrid stroke="#e5e7eb" strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis tickFormatter={(value) => formatNumber(value)} />
                <Tooltip
                  formatter={(value) => formatCurrency(value as number)}
                  labelFormatter={(label) => `日期：${label}`}
                />
                <Legend />
                <Line
                  dataKey="totalValue"
                  name="资产总值"
                  stroke="#5470C6"
                  strokeWidth={2}
                  type="monotone"
                />
                <Line
                  dataKey="netValue"
                  name="资产净值"
                  stroke="#91CC75"
                  strokeWidth={2}
                  type="monotone"
                />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className={styles.chartEmpty}>
              {loading ? '正在加载趋势数据...' : '暂无趋势数据'}
            </div>
          )}
        </div>

        {/* 部门资产分布饼图 */}
        <div className={styles.chartPanel}>
          <h3 className={styles.chartPanelTitle}>部门资产分布</h3>
          {distributionChartData.length ? (
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  cx="50%"
                  cy="50%"
                  data={distributionChartData}
                  dataKey="assetCount"
                  label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`}
                  labelLine={false}
                  nameKey="deptName"
                  outerRadius={100}
                >
                  {distributionChartData.map((entry) => (
                    <Cell key={`cell-dept-${entry.deptId}`} fill={entry.fill} />
                  ))}
                </Pie>
                <Tooltip formatter={(value) => `${formatNumber(value as number)} 件`} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className={styles.chartEmpty}>
              {loading ? '正在加载分布数据...' : '暂无分布数据'}
            </div>
          )}
        </div>
      </div>

      {/* 最近动态 & 待审批事项 */}
      <div className={styles.twoColGrid}>
        {/* 最近动态 */}
        <div className={styles.chartPanel}>
          <h3 className={styles.chartPanelTitle}>最近动态</h3>
          <div className={styles.alertList}>
            {recentActivities.length ? (
              recentActivities.map((activity) => (
                <div key={activity.id} className={styles.alertItem}>
                  <div
                    className={styles.alertIconWrap}
                    style={{
                      backgroundColor:
                        activity.status === 'success' ? '#f0fdf4' :
                        activity.status === 'warning' ? '#fefce8' :
                        activity.status === 'info' ? '#eff6ff' : '#f9fafb',
                    }}
                  >
                    <div
                      style={{
                        width: '0.5rem',
                        height: '0.5rem',
                        borderRadius: '50%',
                        backgroundColor:
                          activity.status === 'success' ? '#22c55e' :
                          activity.status === 'warning' ? '#eab308' :
                          activity.status === 'info' ? '#3b82f6' : '#6b7280',
                      }}
                    />
                  </div>
                  <div className={styles.alertItemContent}>
                    <p className={styles.alertItemName}>{activity.title}</p>
                    <p className={styles.alertItemType}>{activity.detail}</p>
                    <p className={styles.alertItemDate}>{activity.time}</p>
                  </div>
                </div>
              ))
            ) : (
              <div className={styles.alertEmpty}>
                暂无最近动态；当前仅展示审批服务返回的真实待办记录。
              </div>
            )}
          </div>
        </div>

        {/* 待审批事项 */}
        <div className={styles.chartPanel}>
          <div className={styles.alertPanelHeader}>
            <h3 className={styles.chartPanelTitle}>待审批事项</h3>
            <span className={styles.alertBadge}>
              {formatNumber(pendingApprovals.length)}项待处理
            </span>
          </div>
          {approvalMessage ? (
            <div style={{ marginBottom: '0.75rem', fontSize: '0.875rem', color: '#16a34a' }}>{approvalMessage}</div>
          ) : null}
          {approvalError ? (
            <div style={{ marginBottom: '0.75rem', fontSize: '0.875rem', color: '#dc2626' }}>{approvalError}</div>
          ) : null}
          <div className={styles.alertList}>
            {pendingApprovals.length ? (
              pendingApprovals.map((approval) => (
                <div key={approval.id} className={styles.alertItem}>
                  <div className={styles.alertItemContent}>
                    <div className={styles.alertItemHeader}>
                      <span className={styles.alertItemBadge} style={{ backgroundColor: '#dbeafe', color: '#1e40af' }}>
                        {getApprovalLabel(approval, ['type', 'processType', 'changeType'], '审批')}
                      </span>
                      <span className={styles.alertItemDate}>
                        {formatApprovalDate(approval.createTime ?? approval.createdAt ?? approval.applyDate)}
                      </span>
                    </div>
                    <p className={styles.alertItemName}>
                      {getApprovalLabel(approval, ['assetName', 'asset', 'title', 'description'], '未提供资产名称')}
                    </p>
                    <div className={styles.alertItemHeader} style={{ marginTop: '0.5rem' }}>
                      <span className={styles.alertItemType}>
                        申请人: {getApprovalLabel(approval, ['applicant', 'applicantName', 'operatorId', 'userId'], '-')}
                      </span>
                      <span className={styles.alertItemName}>
                        {getApprovalLabel(approval, ['amount', 'value', 'cost'], '')}
                      </span>
                    </div>
                    <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.75rem' }}>
                      <button
                        type="button"
                        disabled={processingApprovalId === approval.id}
                        onClick={() => handleDashApprove(approval.id, true)}
                        style={{
                          flex: 1,
                          padding: '0.375rem 0.75rem',
                          fontSize: '0.875rem',
                          fontWeight: 500,
                          color: '#ffffff',
                          backgroundColor: '#2563eb',
                          borderRadius: '0.375rem',
                          border: 'none',
                          cursor: 'pointer',
                          opacity: processingApprovalId === approval.id ? 0.6 : 1,
                        }}
                      >
                        {processingApprovalId === approval.id ? '处理中...' : '批准'}
                      </button>
                      <button
                        type="button"
                        disabled={processingApprovalId === approval.id}
                        onClick={() => handleDashApprove(approval.id, false)}
                        style={{
                          flex: 1,
                          padding: '0.375rem 0.75rem',
                          fontSize: '0.875rem',
                          fontWeight: 500,
                          color: '#374151',
                          backgroundColor: '#ffffff',
                          border: '1px solid #d1d5db',
                          borderRadius: '0.375rem',
                          cursor: 'pointer',
                          opacity: processingApprovalId === approval.id ? 0.6 : 1,
                        }}
                      >
                        驳回
                      </button>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className={styles.alertEmpty}>
                暂无待审批事项。
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 分类分布饼图 & 到期预警 (ATB-03, ATB-04) */}
      <div className={styles.twoColGrid}>
        <CategoryPieChart
          data={categoryData}
          loading={loading}
          dataTestId="dashboard-category-pie-chart"
        />
        <ExpirationAlertList
          items={expirationAlerts}
          loading={loading}
          dataTestId="dashboard-expiration-alerts"
        />
      </div>

      {/* 快速操作 & 保养日历 */}
      <div className={styles.twoColGrid}>
        <QuickActions />
        <MaintenanceCalendar />
      </div>
    </div>
  );
};

export default DashboardPage;
