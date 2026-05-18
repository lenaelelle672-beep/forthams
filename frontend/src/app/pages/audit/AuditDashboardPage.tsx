/**
 * @module AuditDashboardPage
 * @description 审计日志仪表板页面 — 真实 API 集成（SWARM-044）。
 *
 * 用户可以在仪表板上查看审计操作日志的趋势图表、
 * 通过时间范围和多维筛选器（操作人/操作类型/所属模块）过滤数据，
 * 并查看操作人明细。
 *
 * 所有数据均来自真实后端 API（/api/v1/audit-log/*），
 * 通过 useAuditLogs Hook 统一管理状态与请求。
 *
 * 对应 SPEC: SWARM-044 Audit Log Dashboard Page Real API Integration
 * - ATB-01: 审计趋势图表真实数据渲染
 * - ATB-02: 筛选器API参数映射与联动
 * - ATB-03: 明细表格数据同步与展示
 * - ATB-04: 接口异常降级处理
 * - ATB-05: 筛选器联动与数据刷新
 * - ATB-06: 趋势图表渲染
 *
 * @since SWARM-044
 */

import React, { useEffect, useCallback, useMemo } from 'react';
import { RefreshCw, FileText, Users, Activity } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { useAuditLogs } from '../../hooks/useAuditLogs';
import { AuditTrendChart } from '../../components/audit/AuditTrendChart';
import { AuditLogFilterBar } from '../../components/audit/AuditLogFilterBar';
import { AuditLogTable } from '../../components/audit/AuditLogTable';
import type { ModuleOption } from '../../components/audit/AuditLogFilterBar';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** 页面组件属性（预留扩展） */
export interface AuditDashboardPageProps {
  /** 认证 token，可选 */
  authToken?: string;
}

// ---------------------------------------------------------------------------
// Sub-components: KPI Summary Cards
// ---------------------------------------------------------------------------

/** KPI 卡片属性 */
interface KpiCardProps {
  /** 标题 */
  title: string;
  /** 数值 */
  value: string | number;
  /** 图标 */
  icon: React.ReactNode;
  /** 额外样式 */
  className?: string;
}

/**
 * KpiCard — KPI 摘要卡片
 *
 * @param props 组件属性
 * @returns React 组件
 */
const KpiCard: React.FC<KpiCardProps> = ({ title, value, icon, className }) => (
  <Card className={className}>
    <CardHeader className="flex flex-row items-center justify-between pb-2">
      <CardTitle className="text-sm font-medium text-muted-foreground">
        {title}
      </CardTitle>
      {icon}
    </CardHeader>
    <CardContent>
      <div className="text-2xl font-bold">{value}</div>
    </CardContent>
  </Card>
);

// ---------------------------------------------------------------------------
// Sub-components: Operator Breakdown
// ---------------------------------------------------------------------------

/** 操作人统计项 */
interface OperatorStat {
  operator_name: string;
  operator_id: string;
  count: number;
}

/** 操作人统计卡片属性 */
interface OperatorBreakdownProps {
  items: Array<{ operator_id: string; operator_name: string }>;
  loading: boolean;
}

/**
 * OperatorBreakdown — 操作人统计面板
 *
 * 从日志列表数据中汇总各操作人的操作次数，
 * 按操作次数降序排列展示 Top N 操作人。
 *
 * @param props 组件属性
 * @returns React 组件
 */
const OperatorBreakdown: React.FC<OperatorBreakdownProps> = ({ items, loading }) => {
  const stats = useMemo(() => {
    const map = new Map<string, OperatorStat>();
    for (const item of items) {
      const key = item.operator_id;
      const existing = map.get(key);
      if (existing) {
        existing.count += 1;
      } else {
        map.set(key, {
          operator_name: item.operator_name,
          operator_id: item.operator_id,
          count: 1,
        });
      }
    }
    return Array.from(map.values()).sort((a, b) => b.count - a.count).slice(0, 10);
  }, [items]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Users className="size-4 text-muted-foreground" />
          操作人统计
        </CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="text-sm text-muted-foreground py-4 text-center">加载中...</div>
        ) : stats.length === 0 ? (
          <div className="text-sm text-muted-foreground py-4 text-center">暂无数据</div>
        ) : (
          <div className="space-y-2">
            {stats.map((s) => (
              <div
                key={s.operator_id}
                className="flex items-center justify-between text-sm"
              >
                <span className="truncate mr-2">
                  {s.operator_name}
                  <span className="text-muted-foreground ml-1 text-xs">
                    ({s.operator_id})
                  </span>
                </span>
                <Badge variant="secondary">{s.count}</Badge>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

// ---------------------------------------------------------------------------
// Module options — static config for ATB-02 module filter
// ---------------------------------------------------------------------------

/** 所属模块选项（对应 ATB-02 的 module 筛选维度） */
const MODULE_OPTIONS: ModuleOption[] = [
  { value: 'ASSET', label: '资产管理' },
  { value: 'USER', label: '用户管理' },
  { value: 'APPROVAL', label: '审批流程' },
  { value: 'INVENTORY', label: '盘点管理' },
  { value: 'REPORT', label: '报表统计' },
  { value: 'SYSTEM', label: '系统设置' },
];

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

/**
 * AuditDashboardPage — 审计日志仪表板主页面
 *
 * 集成真实后端 API，提供审计操作日志的查看、搜索、筛选与可视化能力：
 * - 趋势图表：基于 Recharts 的折线图，支持小时/天/周粒度自适应
 * - 时间范围筛选：90 天跨度上限约束
 * - 操作类型筛选：由后端 meta 接口动态下发
 * - 所属模块筛选：支持按模块维度筛选（ATB-02）
 * - 操作人统计：按操作人汇总操作次数
 * - 分页日志表格：展示审计日志明细（使用 AuditLogTable 组件）
 *
 * @param props 页面属性
 * @returns React 组件
 *
 * @performance 数据加载 O(n)，渲染受 React.memo 保护
 */
const AuditDashboardPage: React.FC<AuditDashboardPageProps> = ({
  authToken,
}) => {
  const {
    filters,
    updateFilters,
    resetFilters,
    pagination,
    setPagination,
    listData,
    listLoading,
    listError,
    trendData,
    trendLoading,
    trendError,
    actionTypeOptions,
    metaLoading,
    fetchAll,
    fetchList,
    computedGranularity,
    isTimeRangeExceeded,
  } = useAuditLogs();

  /** 页面初次加载时自动查询 */
  useEffect(() => {
    fetchAll();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  /**
   * 手动刷新数据
   */
  const handleRefresh = useCallback(() => {
    fetchAll();
  }, [fetchAll]);

  /**
   * 处理分页变化
   *
   * @param page 目标页码
   */
  const handlePageChange = useCallback(
    (page: number) => {
      setPagination({ page });
    },
    [setPagination]
  );

  // 分页变化自动触发列表查询
  useEffect(() => {
    if (listData !== null || listLoading) {
      fetchList();
    }
  }, [pagination.page]); // eslint-disable-line react-hooks/exhaustive-deps

  /** 列表数据条目 */
  const logItems = listData?.items ?? [];

  /** 总记录数 */
  const totalCount = listData?.total ?? 0;

  /** KPI - 总操作数 */
  const kpiTotal = totalCount;

  /** KPI - 趋势数据点数量 */
  const kpiTrendPoints = trendData?.data_points?.length ?? 0;

  /** 加载中综合状态 */
  const isAnyLoading = listLoading || trendLoading || metaLoading;

  return (
    <div data-testid="audit-dashboard" className="audit-dashboard-container space-y-6 p-6">
      {/* 页面标题 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Activity className="size-6 text-primary" />
          <h1 className="text-2xl font-bold">审计日志仪表板</h1>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleRefresh}
          disabled={isAnyLoading}
        >
          <RefreshCw className={`size-4 mr-1 ${isAnyLoading ? 'animate-spin' : ''}`} />
          刷新
        </Button>
      </div>

      {/* KPI 摘要卡片 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          title="总操作数"
          value={kpiTotal.toLocaleString()}
          icon={<FileText className="size-4 text-muted-foreground" />}
        />
        <KpiCard
          title="当前页条数"
          value={logItems.length}
          icon={<FileText className="size-4 text-muted-foreground" />}
        />
        <KpiCard
          title="趋势数据点"
          value={kpiTrendPoints}
          icon={<Activity className="size-4 text-muted-foreground" />}
        />
        <KpiCard
          title="聚合粒度"
          value={computedGranularity === 'hour' ? '按小时' : computedGranularity === 'day' ? '按天' : '按周'}
          icon={<Activity className="size-4 text-muted-foreground" />}
        />
      </div>

      {/* 趋势图表 — ATB-01 真实数据渲染 / ATB-04 错误降级 */}
      <AuditTrendChart
        trendData={trendData}
        loading={trendLoading}
        error={trendError}
      />

      {/* 筛选工具栏 — ATB-02 操作人/操作类型/模块多维筛选 */}
      <AuditLogFilterBar
        filters={filters}
        onUpdateFilters={updateFilters}
        onResetFilters={resetFilters}
        pagination={pagination}
        onSetPagination={setPagination}
        actionTypeOptions={actionTypeOptions}
        moduleOptions={MODULE_OPTIONS}
        onFetchAll={fetchAll}
        loading={isAnyLoading}
        isTimeRangeExceeded={isTimeRangeExceeded}
      />

      {/* 操作人统计面板 */}
      <OperatorBreakdown items={logItems} loading={listLoading} />

      {/* 列表错误提示 */}
      {listError && (
        <div
          className="text-sm text-destructive bg-destructive/10 p-2 rounded-md"
          data-testid="audit-dashboard-error"
          role="alert"
        >
          {listError}
        </div>
      )}

      {/* 日志明细表格 — ATB-03 数据同步与展示 */}
      <AuditLogTable
        logs={logItems}
        pagination={{
          total: totalCount,
          page: pagination.page,
          size: pagination.size,
        }}
        isLoading={listLoading}
        onPageChange={handlePageChange}
      />
    </div>
  );
};

AuditDashboardPage.displayName = 'AuditDashboardPage';

export default AuditDashboardPage;
export { AuditDashboardPage };
