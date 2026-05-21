/**
 * AssetRetirementListPage — List view for all retirement applications with
 * status filtering, pagination, and navigation to detail pages.
 *
 * SWARM-053: Implements paginated query with status tab filtering, renders
 * retirement application records in a table with process number, asset info,
 * status badge, and action links to the detail page.
 *
 * @module pages/assets/AssetRetirementListPage
 * @since SWARM-053
 */

import React, { useState, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '../../components/ui/card';
import { Button } from '../../components/ui/button';
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
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../../components/ui/tabs';
import {
  FileText,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  Plus,
  Eye,
  ShieldAlert,
} from 'lucide-react';
import { retirementService } from '../../services/retirementService';
import { RETIREMENT_STATUS_MAP } from '../../hooks/useRetirement';
import type { RetirementApplication } from '../../types/retirement.types';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * Paginated result structure from the retirement service.
 */
interface PaginatedResult<T> {
  items: T[];
  total: number;
  page?: number;
  pageSize?: number;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/**
 * Status tab definitions with filter values and display labels.
 */
const STATUS_TABS = [
  { value: 'ALL', label: '全部' },
  { value: 'PENDING', label: '待审批' },
  { value: 'APPROVED', label: '已审批' },
  { value: 'COMPLETED', label: '已完成' },
  { value: 'CANCELLED', label: '已取消' },
  { value: 'SCRAPPED', label: '已报废' },
] as const;

/**
 * Default page size for list queries.
 */
const DEFAULT_PAGE_SIZE = 10;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Map status to badge variant.
 *
 * @param status - Backend status string
 * @returns Badge variant
 */
function getStatusBadgeVariant(
  status: string
): 'default' | 'secondary' | 'destructive' | 'outline' {
  switch (status) {
    case 'PENDING':
      return 'outline';
    case 'APPROVED':
      return 'secondary';
    case 'CANCELLED':
      return 'destructive';
    case 'SCRAPPED':
      return 'destructive';
    case 'COMPLETED':
      return 'default';
    default:
      return 'outline';
  }
}

/**
 * Format a date-time string for display.
 *
 * @param value - ISO date string
 * @returns Formatted date string
 */
function formatDateTime(value: string | undefined | null): string {
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
}

/**
 * Get display label for retirement status.
 *
 * @param status - Backend status string
 * @returns Chinese display label
 */
function getStatusLabel(status: string): string {
  return RETIREMENT_STATUS_MAP[status] ?? status;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * AssetRetirementListPage component
 *
 * Displays a paginated, filterable list of retirement applications.
 * Users can filter by status via tabs, navigate to detail pages,
 * and initiate new retirement requests.
 *
 * @returns The retirement list page JSX
 */
export const AssetRetirementListPage: React.FC = () => {
  const navigate = useNavigate();

  // -- State -----------------------------------------------------------------
  const [applications, setApplications] = useState<RetirementApplication[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<string>('ALL');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);

  // -- Derived values --------------------------------------------------------
  const totalPages = Math.max(1, Math.ceil(total / DEFAULT_PAGE_SIZE));

  /**
   * Load retirement applications from the backend.
   *
   * @param statusFilter - Optional status filter value
   * @param pageNum - Page number to load
   */
  const loadApplications = useCallback(
    async (statusFilter?: string, pageNum?: number) => {
      setLoading(true);
      setError(null);

      try {
        const params: Record<string, unknown> = {
          page: pageNum ?? page,
          pageSize: DEFAULT_PAGE_SIZE,
        };

        if (statusFilter && statusFilter !== 'ALL') {
          params.status = statusFilter;
        }

        const result = await retirementService.listApplications(params);

        if (Array.isArray(result)) {
          // Some API versions return flat arrays
          setApplications(result);
          setTotal(result.length);
        } else if (result && typeof result === 'object' && 'items' in result) {
          setApplications((result as PaginatedResult<RetirementApplication>).items);
          setTotal((result as PaginatedResult<RetirementApplication>).total);
        } else {
          setApplications([]);
          setTotal(0);
        }
      } catch (err) {
        if (err instanceof Error) {
          const msg = err.message ?? '';
          if (msg.includes('403') || msg.includes('无权操作') || msg.includes('跨租户')) {
            setError('权限不足，无法操作此资产');
          } else {
            setError(msg);
          }
        } else {
          setError('加载退役申请列表失败');
        }
        setApplications([]);
        setTotal(0);
      } finally {
        setLoading(false);
      }
    },
    [page]
  );

  /**
   * Handle tab change — resets page and loads data.
   *
   * @param tabValue - The new tab value
   */
  const handleTabChange = useCallback(
    (tabValue: string) => {
      setActiveTab(tabValue);
      setPage(1);
      loadApplications(tabValue, 1);
    },
    [loadApplications]
  );

  /**
   * Handle page navigation.
   *
   * @param newPage - The target page number
   */
  const handlePageChange = useCallback(
    (newPage: number) => {
      setPage(newPage);
      loadApplications(activeTab, newPage);
    },
    [activeTab, loadApplications]
  );

  /**
   * Handle refresh.
   */
  const handleRefresh = useCallback(() => {
    loadApplications(activeTab, page);
  }, [activeTab, page, loadApplications]);

  /**
   * Navigate to create a new retirement application.
   */
  const handleCreate = useCallback(() => {
    navigate('/retirement/new');
  }, [navigate]);

  // -- Initial data load -----------------------------------------------------
  useEffect(() => {
    loadApplications(activeTab, page);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---- Render --------------------------------------------------------------
  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-12" data-testid="retirement-list-page">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 mb-8">
        <div className="flex items-center gap-4">
          <div className="p-2 bg-orange-50 rounded-lg">
            <FileText className="w-6 h-6 text-orange-600" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-gray-900">退役申请列表</h2>
            <p className="text-sm text-gray-400 mt-1">
              管理资产退役与报废申请
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={handleRefresh}>
            <RefreshCw className="w-4 h-4" />
          </Button>
          <Button size="sm" onClick={handleCreate} data-testid="create-retirement-btn">
            <Plus className="w-4 h-4 mr-1" />
            发起退役申请
          </Button>
        </div>
      </div>

      {/* Error banner */}
      {error && (
        <div
          className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-800 text-sm flex items-center gap-2"
          data-testid="error-banner"
          role="alert"
        >
          <ShieldAlert className="w-4 h-4 flex-shrink-0" />
          {error}
        </div>
      )}

      {/* Status tabs */}
      <Tabs value={activeTab} onValueChange={handleTabChange}>
        <TabsList>
          {STATUS_TABS.map((tab) => (
            <TabsTrigger key={tab.value} value={tab.value}>
              {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>

        {/* Single content area — tab filtering is handled by API query */}
        <TabsContent value={activeTab}>
          <Card>
            <CardHeader>
              <CardTitle className="text-base font-semibold">
                退役申请记录
                <span className="ml-2 text-sm font-normal text-gray-400">
                  共 {total} 条
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="space-y-3">
                  {[...Array(5)].map((_, i) => (
                    <Skeleton key={i} className="h-12 w-full" />
                  ))}
                </div>
              ) : applications.length === 0 ? (
                <div className="flex flex-col items-center py-12 text-gray-400">
                  <FileText className="w-10 h-10 mb-3" />
                  <p className="text-sm">暂无退役申请记录</p>
                </div>
              ) : (
                <>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>流程编号</TableHead>
                        <TableHead>关联资产</TableHead>
                        <TableHead>状态</TableHead>
                        <TableHead>申请时间</TableHead>
                        <TableHead>更新时间</TableHead>
                        <TableHead className="text-right">操作</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {applications.map((app) => {
                        const statusStr = (app.status as string) ?? '';
                        return (
                          <TableRow key={app.id}>
                            <TableCell className="font-mono text-sm">
                              <span data-testid="retirement-no">
                                {app.retirementNo ?? app.id ?? '-'}
                              </span>
                            </TableCell>
                            <TableCell className="text-sm">
                              {app.assetId ?? '-'}
                            </TableCell>
                            <TableCell>
                              <Badge
                                variant={getStatusBadgeVariant(statusStr)}
                                className="text-xs"
                                data-testid="retirement-status-badge"
                              >
                                {getStatusLabel(statusStr)}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-sm text-gray-400">
                              {formatDateTime(app.createdAt)}
                            </TableCell>
                            <TableCell className="text-sm text-gray-400">
                              {formatDateTime(app.updatedAt)}
                            </TableCell>
                            <TableCell className="text-right">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => navigate(`/retirement/${app.id}`)}
                                data-testid="view-retirement-btn"
                              >
                                <Eye className="w-4 h-4 mr-1" />
                                查看
                              </Button>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>

                  {/* Pagination */}
                  {totalPages > 1 && (
                    <div className="flex items-center justify-between mt-4 pt-4 border-t">
                      <p className="text-sm text-gray-400">
                        第 {page} / {totalPages} 页，共 {total} 条
                      </p>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={page <= 1}
                          onClick={() => handlePageChange(page - 1)}
                          data-testid="prev-page-btn"
                        >
                          <ChevronLeft className="w-4 h-4" />
                          上一页
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={page >= totalPages}
                          onClick={() => handlePageChange(page + 1)}
                          data-testid="next-page-btn"
                        >
                          下一页
                          <ChevronRight className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default AssetRetirementListPage;
