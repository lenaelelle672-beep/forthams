/**
 * DashboardPage — 仪表板主页面
 *
 * 通过 useDashboardData Hook 及独立 API 调用获取真实数据，
 * 整合资产概览卡片、分类分布饼图、资产价值趋势、部门资产分布、
 * 待审批事项处理、最近动态、快速操作及保养日历等核心模块。
 *
 * 功能：
 * - 展示资产总数、待审批流程、闲置资产、资产净值四大核心指标
 * - 展示资产分类分布饼图
 * - 展示资产价值趋势折线图（调用 getValueTrends API）
 * - 展示部门资产分布饼图（调用 getDeptDistribution API）
 * - 展示待审批事项，支持批准/驳回操作（调用 approvalService API）
 * - 展示最近动态列表
 * - 展示合同到期预警和维保到期预警
 * - 展示快速操作和保养日历
 *
 * @module pages/DashboardPage
 * @see frontend/src/app/hooks/useDashboardData.ts — useDashboardData
 * @see frontend/src/app/services/dashboardService.ts — dashboardService
 * @see frontend/src/app/services/approvalService.ts — approvalService
 * @see frontend/src/app/components/dashboard/AssetOverviewCard.tsx
 * @see frontend/src/app/components/dashboard/CategoryStatsChart.tsx
 * @see frontend/src/app/components/dashboard/ExpirationAlertList.tsx
 * @see frontend/src/app/components/QuickActions.tsx
 * @see frontend/src/app/components/MaintenanceCalendar.tsx
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
import { AssetOverviewCard } from '../components/dashboard/AssetOverviewCard';
import { CategoryStatsChart } from '../components/dashboard/CategoryStatsChart';
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
 * 格式化数值显示
 *
 * @param value - 待格式化的值
 * @returns 格式化后的字符串
 */
function formatNumber(value?: number | string): string {
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
function formatCurrency(value?: number | string): string {
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
    maximumFractionDigits: 0,
  }).format(numericValue);
}

/**
 * 格式化日期标签（月/日）
 *
 * @param value - ISO 日期字符串
 * @returns 格式化后的日期文本
 */
function formatDateLabel(value: string): string {
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
 * 格化审批日期字段
 *
 * @param value - 日期值，通常是字符串
 * @returns 格式化后的日期文本或占位符
 */
function formatApprovalDate(value: unknown): string {
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
function getApprovalLabel(
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

/**
 * DashboardPage 主页面组件
 *
 * 使用 useDashboardData Hook 加载仪表板统计数据，
 * 并通过 dashboardService / approvalService 获取趋势、分布和审批数据。
 * 渲染资产概览卡片、分类饼图、价值趋势折线图、部门分布饼图、
 * 待审批列表、最近动态、到期预警、快速操作和保养日历。
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
        iconBgClass: 'bg-blue-50',
        iconTextClass: 'text-blue-600',
        dataTestId: 'stat-total',
      },
      {
        name: '待审批流程',
        value: stats?.pendingApprovals ?? '--',
        detail: '待处理审批事项',
        icon: Clock,
        iconBgClass: 'bg-amber-50',
        iconTextClass: 'text-amber-600',
        dataTestId: 'stat-pending',
      },
      {
        name: '闲置资产',
        value: stats?.idleAssets ?? '--',
        detail: `报废资产 ${formatNumber(stats?.scrapAssets)}`,
        icon: AlertCircle,
        iconBgClass: 'bg-orange-50',
        iconTextClass: 'text-orange-600',
        dataTestId: 'stat-idle',
      },
      {
        name: '资产净值',
        value: stats?.netValue ?? '--',
        detail: `总值 ${formatCurrency(stats?.totalValue)}`,
        icon: CheckCircle,
        iconBgClass: 'bg-green-50',
        iconTextClass: 'text-green-600',
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
    <div className="space-y-6">
      {/* 页面标题 */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-gray-900">仪表板</h2>
          <p className="text-gray-600 mt-1">欢迎回来，这是您的资产管理概览</p>
        </div>
        <button
          type="button"
          onClick={refreshAll}
          className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          disabled={loading}
          data-testid="dashboard-refresh"
        >
          {loading ? '加载中...' : '刷新数据'}
        </button>
      </div>

      {/* 全局加载态 */}
      {loading ? (
        <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-700">
          正在同步仪表板数据...
        </div>
      ) : null}

      {/* 全局错误态 */}
      {error ? (
        <div className="rounded-lg border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      ) : null}

      {/* 统计卡片 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {statCards.map((card) => (
          <AssetOverviewCard
            key={card.name}
            title={card.name}
            value={card.value}
            detail={card.detail}
            icon={card.icon}
            iconBgClass={card.iconBgClass}
            iconTextClass={card.iconTextClass}
            loading={loading}
            dataTestId={card.dataTestId}
          />
        ))}
      </div>

      {/* 趋势图 & 部门分布 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 资产价值趋势折线图 */}
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">资产价值趋势</h3>
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
            <div className="flex h-[300px] items-center justify-center text-sm text-gray-500">
              {loading ? '正在加载趋势数据...' : '暂无趋势数据'}
            </div>
          )}
        </div>

        {/* 部门资产分布饼图 */}
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">部门资产分布</h3>
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
            <div className="flex h-[300px] items-center justify-center text-sm text-gray-500">
              {loading ? '正在加载分布数据...' : '暂无分布数据'}
            </div>
          )}
        </div>
      </div>

      {/* 最近动态 & 待审批事项 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 最近动态 */}
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">最近动态</h3>
          <div className="space-y-4">
            {recentActivities.length ? (
              recentActivities.map((activity) => (
                <div key={activity.id} className="flex gap-3 pb-4 border-b border-gray-100 last:border-0">
                  <div
                    className={`w-2 h-2 rounded-full mt-2 flex-shrink-0 ${
                      activity.status === 'success'
                        ? 'bg-green-500'
                        : activity.status === 'warning'
                          ? 'bg-yellow-500'
                          : activity.status === 'info'
                            ? 'bg-blue-500'
                            : 'bg-gray-500'
                    }`}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900">{activity.title}</p>
                    <p className="text-sm text-gray-600 mt-1">{activity.detail}</p>
                    <p className="text-xs text-gray-500 mt-1">{activity.time}</p>
                  </div>
                </div>
              ))
            ) : (
              <div className="rounded-lg border border-dashed border-gray-200 p-4 text-sm text-gray-500">
                暂无最近动态；当前仅展示审批服务返回的真实待办记录。
              </div>
            )}
          </div>
        </div>

        {/* 待审批事项 */}
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">待审批事项</h3>
            <span className="px-2.5 py-0.5 text-xs font-medium bg-red-100 text-red-800 rounded-full">
              {formatNumber(pendingApprovals.length)}项待处理
            </span>
          </div>
          {approvalMessage ? (
            <div className="mb-3 text-sm text-green-600">{approvalMessage}</div>
          ) : null}
          {approvalError ? (
            <div className="mb-3 text-sm text-red-600">{approvalError}</div>
          ) : null}
          <div className="space-y-3">
            {pendingApprovals.length ? (
              pendingApprovals.map((approval) => (
                <div key={approval.id} className="p-4 bg-gray-50 rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <span className="px-2 py-1 text-xs font-medium bg-blue-100 text-blue-800 rounded">
                      {getApprovalLabel(approval, ['type', 'processType', 'changeType'], '审批')}
                    </span>
                    <span className="text-xs text-gray-500">
                      {formatApprovalDate(approval.createTime ?? approval.createdAt ?? approval.applyDate)}
                    </span>
                  </div>
                  <p className="text-sm font-medium text-gray-900">
                    {getApprovalLabel(approval, ['assetName', 'asset', 'title', 'description'], '未提供资产名称')}
                  </p>
                  <div className="flex items-center justify-between mt-2">
                    <span className="text-sm text-gray-600">
                      申请人: {getApprovalLabel(approval, ['applicant', 'applicantName', 'operatorId', 'userId'], '-')}
                    </span>
                    <span className="text-sm font-medium text-gray-900">
                      {getApprovalLabel(approval, ['amount', 'value', 'cost'], '')}
                    </span>
                  </div>
                  <div className="flex gap-2 mt-3">
                    <button
                      type="button"
                      disabled={processingApprovalId === approval.id}
                      onClick={() => handleDashApprove(approval.id, true)}
                      className="flex-1 px-3 py-1.5 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-60 rounded transition-colors"
                    >
                      {processingApprovalId === approval.id ? '处理中...' : '批准'}
                    </button>
                    <button
                      type="button"
                      disabled={processingApprovalId === approval.id}
                      onClick={() => handleDashApprove(approval.id, false)}
                      className="flex-1 px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 disabled:opacity-60 rounded transition-colors"
                    >
                      驳回
                    </button>
                  </div>
                </div>
              ))
            ) : (
              <div className="rounded-lg border border-dashed border-gray-200 p-4 text-sm text-gray-500">
                暂无待审批事项。
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 分类分布 & 到期预警 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 分类分布饼图 */}
        <CategoryStatsChart data={categoryData} loading={loading} />
        {/* 到期预警列表 */}
        <ExpirationAlertList
          items={expirationAlerts}
          loading={loading}
          dataTestId="dashboard-expiration-alerts"
        />
      </div>

      {/* 快速操作 & 保养日历 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <QuickActions />
        <MaintenanceCalendar />
      </div>
    </div>
  );
};

export default DashboardPage;
