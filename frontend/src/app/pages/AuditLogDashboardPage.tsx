/**
 * @module AuditLogDashboardPage
 * @description 审计日志仪表板页面 — 真实 API 集成。
 *
 * 用户可以在仪表板上查看审计操作日志的趋势图表、
 * 通过时间范围和多维筛选器过滤数据，并查看操作人明细。
 *
 * 所有数据均来自真实后端 API（/api/v1/audit-log/*），
 * 通过 useAuditLogs Hook 统一管理状态与请求。
 *
 * 对应 SPEC: SWARM-030 Audit log dashboard real API integration
 * - ATB-01: 多维筛选与分页
 * - ATB-02: 时间跨度越界拦截
 * - ATB-03: 趋势数据聚合
 * - ATB-05: 筛选器联动与数据刷新
 * - ATB-06: 趋势图表渲染
 *
 * @since SWARM-030
 */

import React, { useEffect, useCallback, useMemo } from 'react';
import { RefreshCw, FileText, Users, Activity } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../components/ui/table';
import { useAuditLogs } from '../hooks/useAuditLogs';
import type { AuditLogItem as AuditLogItemType } from '../hooks/useAuditLogs';
import { AuditTrendChart } from '../components/audit/AuditTrendChart';
import { AuditLogFilterBar } from '../components/audit/AuditLogFilterBar';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** 页面组件属性（预留扩展） */
export interface AuditLogDashboardPageProps {
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
  items: AuditLogItemType[];
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
// Helper
// ---------------------------------------------------------------------------

/**
 * 格式化 UTC ISO 时间字符串为本地可读格式。
 *
 * @param utcString UTC ISO 8601 字符串
 * @returns 本地格式化时间字符串
 */
function formatLocalTime(utcString: string): string {
  try {
    const d = new Date(utcString);
    const y = d.getFullYear();
    const mo = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const h = String(d.getHours()).padStart(2, '0');
    const mi = String(d.getMinutes()).padStart(2, '0');
    const s = String(d.getSeconds()).padStart(2, '0');
    return `${y}-${mo}-${day} ${h}:${mi}:${s}`;
  } catch {
    return utcString;
  }
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

/**
 * AuditLogDashboardPage — 审计日志仪表板主页面
 *
 * 集成真实后端 API，提供审计操作日志的查看、搜索、筛选与可视化能力：
 * - 趋势图表：基于 Recharts 的折线图，支持小时/天/周粒度自适应
 * - 时间范围筛选：90 天跨度上限约束
 * - 操作类型筛选：由后端 meta 接口动态下发
 * - 操作人统计：按操作人汇总操作次数
 * - 分页日志表格：展示审计日志明细
 *
 * @param props 页面属性
 * @returns React 组件
 *
 * @performance 数据加载 O(n)，渲染受 React.memo 保护
 */
const AuditLogDashboardPage: React.FC<AuditLogDashboardPageProps> = ({
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
  } = useAuditLogs(authToken);

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
      // 分页变化后自动查询列表
      // Note: setPagination 是异步状态更新，通过 useEffect 监听来触发查询
    },
    [setPagination]
  );

  // 分页变化自动触发列表查询
  useEffect(() => {
    if (listData !== null || listLoading) {
      // 已有数据或正在加载时才响应分页变化（跳过初始化）
      fetchList();
    }
  }, [pagination.page]); // eslint-disable-line react-hooks/exhaustive-deps

  /** 列表数据条目 */
  const logItems = listData?.items ?? [];

  /** 总记录数 */
  const totalCount = listData?.total ?? 0;

  /** 总页数 */
  const totalPages = Math.max(1, Math.ceil(totalCount / pagination.size));

  /** KPI - 总操作数 */
  const kpiTotal = totalCount;

  /** KPI - 趋势数据点数量 */
  const kpiTrendPoints = trendData?.data_points?.length ?? 0;

  /** 加载中综合状态 */
  const isAnyLoading = listLoading || trendLoading || metaLoading;

  return (
    <div data-testid="audit-dashboard" className="space-y-6 p-6">
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

      {/* 趋势图表 */}
      <AuditTrendChart
        trendData={trendData}
        loading={trendLoading}
      />

      {/* 趋势错误提示 */}
      {trendError && (
        <div className="text-sm text-destructive bg-destructive/10 p-2 rounded-md">
          趋势数据加载失败: {trendError}
        </div>
      )}

      {/* 筛选工具栏 */}
      <AuditLogFilterBar
        filters={filters}
        onUpdateFilters={updateFilters}
        onResetFilters={resetFilters}
        pagination={pagination}
        onSetPagination={setPagination}
        actionTypeOptions={actionTypeOptions}
        onFetchAll={fetchAll}
        loading={isAnyLoading}
        isTimeRangeExceeded={isTimeRangeExceeded}
      />

      {/* 操作人统计面板 */}
      <OperatorBreakdown items={logItems} loading={listLoading} />

      {/* 日志明细表格 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <FileText className="size-4 text-muted-foreground" />
            操作记录明细
            <Badge variant="secondary">{totalCount}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {/* 列表错误提示 */}
          {listError && (
            <div className="text-sm text-destructive bg-destructive/10 p-2 rounded-md mb-4">
              {listError}
            </div>
          )}

          {listLoading && logItems.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground text-sm">
              加载中...
            </div>
          ) : logItems.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground text-sm">
              暂无审计记录
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[170px]">时间</TableHead>
                      <TableHead className="w-[120px]">操作人</TableHead>
                      <TableHead className="w-[100px]">操作类型</TableHead>
                      <TableHead className="w-[100px]">资源类型</TableHead>
                      <TableHead className="w-[130px]">资源 ID</TableHead>
                      <TableHead>详情</TableHead>
                      <TableHead className="w-[120px]">IP 地址</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {logItems.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                          {formatLocalTime(item.created_at)}
                        </TableCell>
                        <TableCell>
                          <div className="text-sm">{item.operator_name}</div>
                          <div className="text-xs text-muted-foreground">
                            {item.operator_id}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{item.action_type}</Badge>
                        </TableCell>
                        <TableCell className="text-sm">
                          {item.resource_type}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground font-mono truncate max-w-[130px]">
                          {item.resource_id}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground max-w-[200px] truncate">
                          {item.detail}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground font-mono">
                          {item.ip_address}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* 分页控件 */}
              <div className="flex items-center justify-between mt-4 text-sm">
                <span className="text-muted-foreground">
                  共 {totalCount} 条记录，第 {pagination.page}/{totalPages} 页
                </span>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={pagination.page <= 1 || listLoading}
                    onClick={() => handlePageChange(pagination.page - 1)}
                  >
                    上一页
                  </Button>
                  <span className="px-2">
                    {pagination.page}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={pagination.page >= totalPages || listLoading}
                    onClick={() => handlePageChange(pagination.page + 1)}
                  >
                    下一页
                  </Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

AuditLogDashboardPage.displayName = 'AuditLogDashboardPage';

export default AuditLogDashboardPage;
export { AuditLogDashboardPage };
