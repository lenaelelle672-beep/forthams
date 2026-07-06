/**
 * @module AuditLogPage
 * @description 审计日志仪表板主页面，集成趋势图表、多维筛选器与日志明细表格。
 *
 * 用户可以在页面上查看所有操作审计日志，支持：
 * - 按用户（操作人）筛选
 * - 按操作类型筛选（动态从 meta API 获取）
 * - 按时间范围筛选（90 天跨度上限）
 * - 查看趋势折线图（小时/天/周粒度自适应）
 * - 分页浏览审计日志明细表格
 *
 * 所有数据通过 auditService 调用真实后端 API（/api/v1/audit-log/*）获取。
 *
 * 对应 SPEC: SWARM-060 Audit Log Dashboard Page
 * - ATB-01: 多维筛选与分页
 * - ATB-02: 时间跨度越界拦截
 * - ATB-03: 趋势数据聚合
 * - ATB-05: 筛选器联动与数据刷新
 * - ATB-06: 趋势图表渲染
 *
 * @since SWARM-060
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { RefreshCw, Activity } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../../components/ui/table';
import { AuditTrendChart } from './AuditTrendChart';
import { AuditFilterBar } from './AuditFilterBar';
import type { AuditFilterState, ActionTypeOption } from './AuditFilterBar';
import {
  fetchAuditLogList,
  fetchAuditLogTrend,
  fetchAuditLogMeta,
  getDaysAgoUTC,
  getTodayEndUTC,
  formatUTCToLocalDisplay,
  validateTimeRange,
  type AuditLogItem,
  type AuditLogListResponse,
  type AuditLogTrendResponse,
  type AuditLogMetaResponse,
} from '../../services/auditService';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** 页面组件属性 */
export interface AuditLogPageProps {
  /** 认证 token，可选 */
  authToken?: string;
}

/** 分页状态 */
interface PaginationState {
  /** 当前页码，从 1 开始 */
  page: number;
  /** 每页条数 */
  size: number;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** 默认每页条数 */
const DEFAULT_PAGE_SIZE = 20;

/** 默认筛选器状态（最近 7 天） */
const buildInitialFilters = (): AuditFilterState => ({
  operator_id: '',
  action_type: '',
  start_time: getDaysAgoUTC(7),
  end_time: getTodayEndUTC(),
});

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * AuditLogPage — 审计日志仪表板主页面
 *
 * 集成真实后端 API，提供审计操作日志的查看、搜索、筛选与可视化能力：
 * - 趋势图表：基于 Recharts 的折线图，支持小时/天/周粒度自适应
 * - 多维筛选器：操作人、操作类型、时间范围
 * - 分页日志表格：展示审计日志明细
 *
 * @param props 页面属性
 * @returns React 组件
 *
 * @performance 数据加载 O(n)，筛选器变化触发并行请求刷新列表与图表
 *
 * @example
 * ```tsx
 * <AuditLogPage />
 * ```
 */
export const AuditLogPage: React.FC<AuditLogPageProps> = () => {
  // -----------------------------------------------------------------------
  // State
  // -----------------------------------------------------------------------

  /** 筛选器状态 */
  const [filters, setFilters] = useState<AuditFilterState>(buildInitialFilters);

  /** 分页状态 */
  const [pagination, setPagination] = useState<PaginationState>({
    page: 1,
    size: DEFAULT_PAGE_SIZE,
  });

  /** 日志列表数据 */
  const [listData, setListData] = useState<AuditLogListResponse | null>(null);

  /** 趋势数据 */
  const [trendData, setTrendData] = useState<AuditLogTrendResponse | null>(null);

  /** 操作类型选项 */
  const [actionTypeOptions, setActionTypeOptions] = useState<ActionTypeOption[]>([]);

  /** 加载状态 */
  const [listLoading, setListLoading] = useState(false);
  const [trendLoading, setTrendLoading] = useState(false);
  const [metaLoading, setMetaLoading] = useState(false);

  /** 错误状态 */
  const [listError, setListError] = useState<string | null>(null);
  const [trendError, setTrendError] = useState<string | null>(null);

  // -----------------------------------------------------------------------
  // Computed
  // -----------------------------------------------------------------------

  /** 时间范围是否越界（超过 90 天） */
  const isTimeRangeExceeded = useMemo(() => {
    if (!filters.start_time || !filters.end_time) return false;
    const result = validateTimeRange(filters.start_time, filters.end_time);
    return !result.valid;
  }, [filters.start_time, filters.end_time]);

  /** 加载中综合状态 */
  const isAnyLoading = listLoading || trendLoading || metaLoading;

  /** 日志条目 */
  const logItems: AuditLogItem[] = listData?.items ?? [];

  /** 总记录数 */
  const totalCount = listData?.total ?? 0;

  /** 总页数 */
  const totalPages = Math.max(1, Math.ceil(totalCount / pagination.size));

  // -----------------------------------------------------------------------
  // Data Fetching
  // -----------------------------------------------------------------------

  /**
   * 获取操作类型元数据
   */
  const fetchMeta = useCallback(async () => {
    setMetaLoading(true);
    try {
      const meta: AuditLogMetaResponse = await fetchAuditLogMeta();
      const options: ActionTypeOption[] = (meta.action_types ?? []).map((type) => ({
        value: type,
        label: type,
      }));
      setActionTypeOptions(options);
    } catch {
      // 元数据加载失败不阻塞页面
    } finally {
      setMetaLoading(false);
    }
  }, []);

  /**
   * 获取日志列表数据
   */
  const fetchList = useCallback(async () => {
    if (!filters.start_time || !filters.end_time) return;
    if (isTimeRangeExceeded) return;

    setListLoading(true);
    setListError(null);
    try {
      const data = await fetchAuditLogList({
        start_time: filters.start_time,
        end_time: filters.end_time,
        operator_id: filters.operator_id || undefined,
        action_type: filters.action_type || undefined,
        page: pagination.page,
        size: pagination.size,
      });
      setListData(data);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : '加载日志列表失败';
      setListError(message);
    } finally {
      setListLoading(false);
    }
  }, [filters, pagination, isTimeRangeExceeded]);

  /**
   * 获取趋势数据
   */
  const fetchTrend = useCallback(async () => {
    if (!filters.start_time || !filters.end_time) return;
    if (isTimeRangeExceeded) return;

    setTrendLoading(true);
    setTrendError(null);
    try {
      const data = await fetchAuditLogTrend({
        start_time: filters.start_time,
        end_time: filters.end_time,
        action_type: filters.action_type || undefined,
        operator_id: filters.operator_id || undefined,
      });
      setTrendData(data);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : '加载趋势数据失败';
      setTrendError(message);
    } finally {
      setTrendLoading(false);
    }
  }, [filters, isTimeRangeExceeded]);

  /**
   * 并行获取所有数据（列表 + 趋势）
   */
  const fetchAll = useCallback(async () => {
    await Promise.all([fetchList(), fetchTrend()]);
  }, [fetchList, fetchTrend]);

  // -----------------------------------------------------------------------
  // Effects
  // -----------------------------------------------------------------------

  /** 页面初次加载：获取元数据和全部数据 */
  useEffect(() => {
    fetchMeta();
    fetchAll();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  /** 筛选器变化时重置页码并刷新数据 */
  useEffect(() => {
    setPagination((prev) => ({ ...prev, page: 1 }));
    fetchAll();
  }, [filters]); // eslint-disable-line react-hooks/exhaustive-deps

  /** 分页变化时仅刷新列表 */
  useEffect(() => {
    fetchList();
  }, [pagination.page]); // eslint-disable-line react-hooks/exhaustive-deps

  // -----------------------------------------------------------------------
  // Handlers
  // -----------------------------------------------------------------------

  /**
   * 处理筛选器变化
   *
   * @param newFilters 新的筛选器状态
   */
  const handleFiltersChange = useCallback((newFilters: AuditFilterState) => {
    setFilters(newFilters);
  }, []);

  /**
   * 处理手动刷新
   */
  const handleRefresh = useCallback(() => {
    fetchAll();
  }, [fetchAll]);

  /**
   * 处理页码变化
   *
   * @param page 目标页码
   */
  const handlePageChange = useCallback((page: number) => {
    setPagination((prev) => ({ ...prev, page }));
  }, []);

  // -----------------------------------------------------------------------
  // Render
  // -----------------------------------------------------------------------

  return (
    <div data-testid="audit-log-page" className="space-y-6 p-6">
      {/* 页面标题 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Activity className="size-6 text-primary" />
          <h1 className="text-2xl font-bold">审计日志</h1>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleRefresh}
          disabled={isAnyLoading}
          data-testid="audit-refresh-btn"
        >
          <RefreshCw className={`size-4 mr-1 ${isAnyLoading ? 'animate-spin' : ''}`} />
          刷新
        </Button>
      </div>

      {/* 筛选工具栏 */}
      <AuditFilterBar
        filters={filters}
        onFiltersChange={handleFiltersChange}
        actionTypeOptions={actionTypeOptions}
        loading={isAnyLoading}
        isTimeRangeExceeded={isTimeRangeExceeded}
      />

      {/* 趋势图表 */}
      <AuditTrendChart
        trendData={trendData}
        loading={trendLoading}
        error={trendError}
      />

      {/* 错误提示 */}
      {listError && (
        <div
          className="text-sm text-destructive bg-destructive/10 p-2 rounded-md"
          data-testid="audit-list-error"
          role="alert"
        >
          {listError}
        </div>
      )}

      {/* 日志明细表格 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between text-base">
            <span>操作日志明细</span>
            <Badge variant="secondary">
              共 {totalCount.toLocaleString()} 条
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>操作时间</TableHead>
                <TableHead>操作人</TableHead>
                <TableHead>操作类型</TableHead>
                <TableHead>资源类型</TableHead>
                <TableHead>资源 ID</TableHead>
                <TableHead>操作详情</TableHead>
                <TableHead>IP 地址</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {listLoading ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                    加载中...
                  </TableCell>
                </TableRow>
              ) : logItems.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                    暂无审计日志数据
                  </TableCell>
                </TableRow>
              ) : (
                logItems.map((item) => (
                  <TableRow key={item.id} data-testid={`audit-log-row-${item.id}`}>
                    <TableCell className="text-xs whitespace-nowrap">
                      {formatUTCToLocalDisplay(item.created_at)}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <span className="font-medium">{item.operator_name}</span>
                        <span className="text-xs text-muted-foreground">
                          ({item.operator_id})
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{item.action_type}</Badge>
                    </TableCell>
                    <TableCell>{item.resource_type}</TableCell>
                    <TableCell className="text-xs font-mono">{item.resource_id}</TableCell>
                    <TableCell className="max-w-[300px] truncate" title={item.detail}>
                      {item.detail}
                    </TableCell>
                    <TableCell className="text-xs font-mono">{item.ip_address}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>

          {/* 分页控件 */}
          {totalCount > 0 && (
            <div className="flex items-center justify-between mt-4 pt-4 border-t">
              <div className="text-sm text-muted-foreground">
                第 {pagination.page} / {totalPages} 页，共 {totalCount} 条
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handlePageChange(1)}
                  disabled={pagination.page <= 1 || listLoading}
                  data-testid="audit-page-first"
                >
                  首页
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handlePageChange(pagination.page - 1)}
                  disabled={pagination.page <= 1 || listLoading}
                  data-testid="audit-page-prev"
                >
                  上一页
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handlePageChange(pagination.page + 1)}
                  disabled={pagination.page >= totalPages || listLoading}
                  data-testid="audit-page-next"
                >
                  下一页
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handlePageChange(totalPages)}
                  disabled={pagination.page >= totalPages || listLoading}
                  data-testid="audit-page-last"
                >
                  末页
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

AuditLogPage.displayName = 'AuditLogPage';

export default AuditLogPage;
