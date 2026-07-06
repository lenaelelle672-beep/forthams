/**
 * AssetDisposalPage — Disposal management page with real API integration.
 *
 * SWARM-028: Users can now browse all disposal requests, view disposal details,
 * and approve or reject disposal workflows.
 *
 * Features:
 * - Paginated list of disposal (retirement) applications with status badges
 * - Filter by status and search by keyword
 * - Detail modal for viewing full application information
 * - Approve / reject actions on pending applications with inline confirmation
 * - Summary statistics cards at the top
 *
 * @module pages/assets/AssetDisposalPage
 * @since SWARM-028
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { Skeleton } from '../../components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../../components/ui/table';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import {
  Trash2,
  Search,
  RefreshCw,
  Info,
  Filter,
  Eye,
  CheckCircle,
  XCircle,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import {
  fetchDisposalList,
  approveDisposal,
  rejectDisposal,
  fetchDisposalStatistics,
} from '../../services/assetDisposalService';
import type {
  DisposalApplication,
  DisposalStatus,
  DisposalStatistics,
  DisposalListParams,
} from '../../services/assetDisposalService';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Default page size */
const PAGE_SIZE = 10;

/**
 * Status badge color mapping.
 *
 * @description Maps each disposal status to a badge variant for visual
 * differentiation in the table rows.
 */
const STATUS_BADGE_VARIANT: Record<
  string,
  'default' | 'secondary' | 'destructive' | 'outline'
> = {
  DRAFT: 'outline',
  PENDING: 'default',
  APPROVING: 'secondary',
  APPROVED: 'secondary',
  COMPLETED: 'default',
  REJECTED: 'destructive',
  CANCELLED: 'outline',
};

/**
 * Chinese labels for disposal statuses.
 */
const STATUS_LABELS: Record<string, string> = {
  DRAFT: '草稿',
  PENDING: '待审批',
  APPROVING: '审批中',
  APPROVED: '已通过',
  COMPLETED: '已完成',
  REJECTED: '已驳回',
  CANCELLED: '已取消',
};

/**
 * Chinese labels for disposal types.
 */
const TYPE_LABELS: Record<string, string> = {
  SCRAP: '报废',
  RETIREMENT: '退役',
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Format a date-time string for display.
 *
 * @param value - ISO date string or undefined
 * @returns Formatted date string, e.g. "2025-01-15 14:30"
 */
const formatDateTime = (value: string | undefined | null): string => {
  if (!value) return '-';
  try {
    const date = new Date(value);
    if (isNaN(date.getTime())) return value;
    return date.toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return value;
  }
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * AssetDisposalPage component
 *
 * Renders a browseable, paginated list of disposal applications with real
 * API integration. Users can filter by status, search by keyword, view
 * application details in a modal, and approve or reject pending applications.
 *
 * @returns The disposal management page JSX
 */
export const AssetDisposalPage: React.FC = () => {
  // -- List state ----------------------------------------------------------
  const [records, setRecords] = useState<DisposalApplication[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // -- Filters -------------------------------------------------------------
  const [filterStatus, setFilterStatus] = useState<DisposalStatus | ''>('');
  const [searchKeyword, setSearchKeyword] = useState('');

  // -- Statistics ----------------------------------------------------------
  const [stats, setStats] = useState<DisposalStatistics | null>(null);

  const [actionLoading, setActionLoading] = useState<number | null>(null);
  const [rejectingId, setRejectingId] = useState<number | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const navigate = useNavigate();

  /**
   * Load disposal statistics summary.
   */
  const loadStats = useCallback(async () => {
    try {
      const data = await fetchDisposalStatistics();
      setStats(data);
    } catch {
      // Statistics are non-critical; silently fail
    }
  }, []);

  /**
   * Load the disposal applications list from the API.
   */
  const loadList = useCallback(async () => {
    setLoading(true);
    setError(null);

    const params: DisposalListParams = {
      page,
      pageSize: PAGE_SIZE,
    };
    if (filterStatus) params.status = filterStatus;

    try {
      const data = await fetchDisposalList(params);
      setRecords(data.records ?? []);
      setTotal(data.total ?? 0);
    } catch (err) {
      const message = err instanceof Error ? err.message : '获取处置列表失败';
      setError(message);
      setRecords([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [page, filterStatus]);

  useEffect(() => {
    loadList();
  }, [loadList]);

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  /**
   * Reload stats after an approve/reject action.
   */
  const refreshAfterAction = useCallback(async () => {
    await Promise.all([loadList(), loadStats()]);
  }, [loadList, loadStats]);

  /**
   * Open the detail modal for a disposal application.
   *
   * @param app - The application to view
   */
  const handleViewDetail = useCallback(
    (app: DisposalApplication) => {
      navigate(`/disposals/${app.id}`);
    },
    [navigate],
  );

  /**
   * Handle approve action for a pending application.
   *
   * @param id - The application ID to approve
   */
  const handleApprove = useCallback(
    async (id: number) => {
      setActionLoading(id);
      try {
        await approveDisposal(id);
        await refreshAfterAction();
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error('Approve failed:', err);
      } finally {
        setActionLoading(null);
      }
    },
    [refreshAfterAction],
  );

  /**
   * Handle reject action for a pending application.
   *
   * @param id - The application ID to reject
   */
  const handleReject = useCallback(
    async (id: number) => {
      setActionLoading(id);
      try {
        await rejectDisposal(id, rejectReason || undefined);
        setRejectingId(null);
        setRejectReason('');
        await refreshAfterAction();
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error('Reject failed:', err);
      } finally {
        setActionLoading(null);
      }
    },
    [rejectReason, refreshAfterAction],
  );

  /** Total number of pages */
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  /**
   * Client-side keyword search filter over the loaded records.
   *
   * @description Filters by application number, asset name, asset code,
   * or reason fields.
   */
  const filteredRecords = searchKeyword.trim()
    ? records.filter((r) => {
        const kw = searchKeyword.trim().toLowerCase();
        return (
          (r.applicationNo ?? '').toLowerCase().includes(kw) ||
          (r.assetName ?? '').toLowerCase().includes(kw) ||
          (r.assetCode ?? '').toLowerCase().includes(kw) ||
          (r.reason ?? '').toLowerCase().includes(kw) ||
          (r.applicantName ?? '').toLowerCase().includes(kw)
        );
      })
    : records;

  // ---- Loading skeleton ---------------------------------------------------
  if (loading && records.length === 0) {
    return (
      <div
        className="max-w-7xl mx-auto space-y-6 pb-12"
        data-testid="disposal-page-loading"
      >
        <div className="flex items-center gap-4 mb-8">
          <div className="w-10 h-10 bg-blue-50 rounded-lg animate-pulse" />
          <div className="space-y-2">
            <div className="h-6 w-56 bg-blue-50 rounded animate-pulse" />
            <div className="h-4 w-40 bg-gray-50 rounded animate-pulse" />
          </div>
        </div>
        <Card>
          <CardContent className="p-6 space-y-4">
            {[...Array(5)].map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </CardContent>
        </Card>
      </div>
    );
  }

  // ---- Error state --------------------------------------------------------
  if (error && records.length === 0) {
    return (
      <div
        className="max-w-7xl mx-auto space-y-6 pb-12"
        data-testid="disposal-page-error"
      >
        <Card>
          <CardContent className="flex flex-col items-center py-12">
            <Info className="h-10 w-10 text-muted-foreground mb-3" />
            <p className="text-muted-foreground">
              加载处置数据失败：{error}
            </p>
            <Button variant="outline" className="mt-4" onClick={loadList}>
              重试
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ---- Main render --------------------------------------------------------
  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-12" data-testid="disposal-page">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 mb-8">
        <div className="flex items-center gap-4">
          <div className="p-2 bg-red-50 rounded-lg">
            <Trash2 className="w-6 h-6 text-red-600" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-gray-900">资产处置管理</h2>
            <p className="text-sm text-gray-400 mt-1">
              浏览所有处置申请、查看详情并审批或驳回处置流程
            </p>
          </div>
        </div>
      </div>

      {/* Summary statistics */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-gray-400">全部</p>
            <p className="text-xl font-bold">{stats?.total ?? total}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-gray-400">待审批</p>
            <p className="text-xl font-bold text-yellow-600">
              {stats?.pending ?? '-'}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-gray-400">已通过</p>
            <p className="text-xl font-bold text-green-600">
              {stats?.approved ?? '-'}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-gray-400">已完成</p>
            <p className="text-xl font-bold text-blue-600">
              {stats?.completed ?? '-'}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-gray-400">已驳回</p>
            <p className="text-xl font-bold text-red-600">
              {stats?.rejected ?? '-'}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-gray-400">已取消</p>
            <p className="text-xl font-bold text-gray-400">
              {stats?.cancelled ?? '-'}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Search / Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2 flex-1 min-w-[200px]">
              <Search className="w-4 h-4 text-gray-400" />
              <Input
                placeholder="搜索申请单号、资产名称、原因..."
                value={searchKeyword}
                onChange={(e) => setSearchKeyword(e.target.value)}
                className="max-w-xs"
                data-testid="disposal-search-input"
              />
            </div>
            <Button variant="outline" size="sm" onClick={loadList}>
              <RefreshCw className="w-4 h-4 mr-1" />
              刷新
            </Button>
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-gray-400" />
              <select
                className="h-9 rounded-md border border-input bg-background px-3 py-1 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                value={filterStatus}
                onChange={(e) => {
                  setFilterStatus(e.target.value as DisposalStatus | '');
                  setPage(1);
                }}
                data-testid="disposal-status-filter"
              >
                <option value="">全部状态</option>
                <option value="DRAFT">草稿</option>
                <option value="PENDING">待审批</option>
                <option value="APPROVING">审批中</option>
                <option value="APPROVED">已通过</option>
                <option value="COMPLETED">已完成</option>
                <option value="REJECTED">已驳回</option>
                <option value="CANCELLED">已取消</option>
              </select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Disposal applications table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg font-semibold">处置申请列表</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>申请编号</TableHead>
                  <TableHead>资产编号</TableHead>
                  <TableHead>资产名称</TableHead>
                  <TableHead>处置类型</TableHead>
                  <TableHead>状态</TableHead>
                  <TableHead>申请人</TableHead>
                  <TableHead>处置原因</TableHead>
                  <TableHead>申请时间</TableHead>
                  <TableHead className="text-center">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredRecords.map((record) => {
                  const isActionLoading = actionLoading === record.id;
                  const isRejecting = rejectingId === record.id;
                  const canApprove = record.status === 'PENDING' || record.status === 'APPROVING';
                  const canReject = record.status === 'PENDING' || record.status === 'APPROVING';

                  return (
                    <React.Fragment key={record.id}>
                      <TableRow className="hover:bg-gray-50/50">
                        <TableCell className="font-mono text-sm">
                          {record.applicationNo ?? record.id}
                        </TableCell>
                        <TableCell className="font-mono text-sm">
                          {record.assetCode ?? record.assetId}
                        </TableCell>
                        <TableCell className="font-medium">
                          {record.assetName ?? '-'}
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary">
                            {TYPE_LABELS[record.retirementType ?? ''] ?? record.retirementType ?? '-'}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant={STATUS_BADGE_VARIANT[record.status] ?? 'outline'}>
                            {STATUS_LABELS[record.status] ?? record.status}
                          </Badge>
                        </TableCell>
                        <TableCell>{record.applicantName ?? '-'}</TableCell>
                        <TableCell
                          className="max-w-[200px] truncate"
                          title={record.reason ?? ''}
                        >
                          {record.reason ?? '-'}
                        </TableCell>
                        <TableCell className="text-sm text-gray-400">
                          {formatDateTime(record.createTime)}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center justify-center gap-1">
                            {/* View detail */}
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleViewDetail(record)}
                              title="查看详情"
                              data-testid={`disposal-view-${record.id}`}
                            >
                              <Eye className="w-4 h-4" />
                            </Button>

                            {/* Approve */}
                            {canApprove && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleApprove(record.id)}
                                disabled={isActionLoading}
                                title="审批通过"
                                className="text-green-600 hover:text-green-700 hover:bg-green-50"
                                data-testid={`disposal-approve-${record.id}`}
                              >
                                {isActionLoading ? (
                                  <RefreshCw className="w-4 h-4 animate-spin" />
                                ) : (
                                  <CheckCircle className="w-4 h-4" />
                                )}
                              </Button>
                            )}

                            {/* Reject */}
                            {canReject && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  setRejectingId(record.id);
                                  setRejectReason('');
                                }}
                                disabled={isActionLoading}
                                title="驳回"
                                className="text-red-600 hover:text-red-700 hover:bg-red-50"
                                data-testid={`disposal-reject-btn-${record.id}`}
                              >
                                <XCircle className="w-4 h-4" />
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>

                      {/* Inline reject reason input row */}
                      {isRejecting && (
                        <TableRow>
                          <TableCell colSpan={9} className="bg-red-50/50 p-3">
                            <div className="flex items-center gap-3">
                              <Input
                                placeholder="请输入驳回原因..."
                                value={rejectReason}
                                onChange={(e) => setRejectReason(e.target.value)}
                                className="max-w-md"
                                data-testid={`disposal-reject-input-${record.id}`}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') {
                                    handleReject(record.id);
                                  }
                                  if (e.key === 'Escape') {
                                    setRejectingId(null);
                                    setRejectReason('');
                                  }
                                }}
                              />
                              <Button
                                size="sm"
                                variant="destructive"
                                onClick={() => handleReject(record.id)}
                                disabled={isActionLoading}
                                data-testid={`disposal-reject-confirm-${record.id}`}
                              >
                                {isActionLoading ? '处理中...' : '确认驳回'}
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  setRejectingId(null);
                                  setRejectReason('');
                                }}
                              >
                                取消
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                    </React.Fragment>
                  );
                })}

                {filteredRecords.length === 0 && !loading && (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-12 text-gray-400">
                      <Trash2 className="w-8 h-8 mx-auto mb-2" />
                      暂无处置申请数据
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>

          {/* Pagination controls */}
          {total > PAGE_SIZE && (
            <div className="flex items-center justify-between mt-4 pt-4 border-t">
              <p className="text-sm text-gray-400">
                共 {total} 条记录，第 {page} / {totalPages} 页
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  <ChevronLeft className="w-4 h-4 mr-1" />
                  上一页
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                >
                  下一页
                  <ChevronRight className="w-4 h-4 ml-1" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

    </div>
  );
};

export default AssetDisposalPage;
