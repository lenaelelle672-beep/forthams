/**
 * AssetWorkOrdersTab Component
 *
 * 资产详情页 - 关联工单标签页
 * 展示与当前资产关联的工单列表，包括工单状态、类型、优先级等信息。
 *
 * @module components/asset/AssetWorkOrdersTab
 * @since SWARM-015
 */

import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '../ui/card';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Skeleton } from '../ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select';
import { ClipboardList, ExternalLink, Info, RefreshCw } from 'lucide-react';
import { fetchRelatedWorkOrders } from '../../services/assetDetailService';
import type { WorkOrderRecord } from '../../services/workOrderService';

/**
 * Component props
 */
interface AssetWorkOrdersTabProps {
  /** 资产 ID */
  assetId: string;
}

/**
 * 工单状态颜色及中文映射
 */
const STATUS_CONFIG: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  DRAFT: { label: '草稿', variant: 'outline' },
  PENDING: { label: '待审批', variant: 'secondary' },
  APPROVED: { label: '已审批', variant: 'default' },
  EXECUTING: { label: '执行中', variant: 'default' },
  COMPLETED: { label: '已完成', variant: 'default' },
  REJECTED: { label: '已拒绝', variant: 'destructive' },
  CANCELLED: { label: '已取消', variant: 'outline' },
};

/**
 * 工单优先级中文映射
 */
const PRIORITY_LABELS: Record<string, string> = {
  NORMAL: '普通',
  URGENT: '紧急',
  EMERGENCY: '特急',
};

/**
 * 格式化日期为可读格式
 *
 * @param dateStr - ISO 8601 日期字符串
 * @returns 格式化后的日期字符串
 */
const formatDate = (dateStr?: string): string => {
  if (!dateStr) return '-';
  try {
    return new Date(dateStr).toLocaleDateString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
  } catch {
    return dateStr;
  }
};

/**
 * 资产关联工单标签页组件
 *
 * 该组件获取并展示与指定资产关联的所有工单：
 * - 状态筛选
 * - 工单列表表格
 * - 分页控制
 * - 点击跳转工单详情
 *
 * @param props - 组件属性
 * @returns 关联工单标签页 JSX
 */
export const AssetWorkOrdersTab: React.FC<AssetWorkOrdersTabProps> = ({ assetId }) => {
  const navigate = useNavigate();

  const [workOrders, setWorkOrders] = useState<WorkOrderRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [currentPage, setCurrentPage] = useState(1);
  const PAGE_SIZE = 10;

  /**
   * 获取关联工单数据
   */
  const loadWorkOrders = useCallback(async () => {
    if (!assetId) return;

    setLoading(true);
    setError(null);

    try {
      const params: { page: number; pageSize: number; status?: string } = {
        page: currentPage,
        pageSize: PAGE_SIZE,
      };
      if (statusFilter !== 'ALL') {
        params.status = statusFilter;
      }

      const response = await fetchRelatedWorkOrders(assetId, params);
      setWorkOrders(response.records || []);
      setTotal(response.total || 0);
    } catch (err) {
      const message = err instanceof Error ? err.message : '获取关联工单失败';
      setError(message);
      setWorkOrders([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [assetId, currentPage, statusFilter]);

  useEffect(() => {
    loadWorkOrders();
  }, [loadWorkOrders]);

  /**
   * 跳转到工单详情
   */
  const handleViewWorkOrder = useCallback((woId: number | string) => {
    navigate(`/workorders/${woId}`);
  }, [navigate]);

  /**
   * 渲染工单状态徽章
   */
  const renderStatusBadge = (status?: string) => {
    if (!status) return <Badge variant="outline">未知</Badge>;
    const config = STATUS_CONFIG[status] || { label: status, variant: 'outline' as const };
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  // ---- Loading skeleton ----
  if (loading && workOrders.length === 0) {
    return (
      <div className="space-y-4" data-testid="workorders-tab-loading">
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-40" />
          </CardHeader>
          <CardContent className="space-y-2">
            {[...Array(5)].map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </CardContent>
        </Card>
      </div>
    );
  }

  // ---- Error state ----
  if (error) {
    return (
      <div className="flex items-center justify-center py-12" data-testid="workorders-tab-error">
        <Card className="w-full">
          <CardContent className="flex flex-col items-center py-8">
            <Info className="h-10 w-10 text-muted-foreground mb-3" />
            <p className="text-muted-foreground mb-4">加载关联工单失败：{error}</p>
            <Button variant="outline" onClick={loadWorkOrders}>
              <RefreshCw className="h-4 w-4 mr-2" />
              重试
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ---- Empty state ----
  if (workOrders.length === 0 && !loading) {
    return (
      <div data-testid="workorders-tab">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg font-semibold flex items-center gap-2">
                <ClipboardList className="h-5 w-5" />
                关联工单
              </CardTitle>
              <div className="flex items-center gap-2">
                <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setCurrentPage(1); }}>
                  <SelectTrigger className="w-[120px] h-8">
                    <SelectValue placeholder="工单状态" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">全部状态</SelectItem>
                    <SelectItem value="DRAFT">草稿</SelectItem>
                    <SelectItem value="PENDING">待审批</SelectItem>
                    <SelectItem value="APPROVED">已审批</SelectItem>
                    <SelectItem value="EXECUTING">执行中</SelectItem>
                    <SelectItem value="COMPLETED">已完成</SelectItem>
                    <SelectItem value="REJECTED">已拒绝</SelectItem>
                    <SelectItem value="CANCELLED">已取消</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col items-center py-12 text-muted-foreground">
              <ClipboardList className="h-12 w-12 mb-3 opacity-50" />
              <p>该资产暂无关联工单</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div className="space-y-4" data-testid="workorders-tab">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg font-semibold flex items-center gap-2">
              <ClipboardList className="h-5 w-5" />
              关联工单
              <Badge variant="outline" className="ml-2">
                {total} 条
              </Badge>
            </CardTitle>
            <div className="flex items-center gap-2">
              <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setCurrentPage(1); }}>
                <SelectTrigger className="w-[120px] h-8">
                  <SelectValue placeholder="工单状态" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">全部状态</SelectItem>
                  <SelectItem value="DRAFT">草稿</SelectItem>
                  <SelectItem value="PENDING">待审批</SelectItem>
                  <SelectItem value="APPROVED">已审批</SelectItem>
                  <SelectItem value="EXECUTING">执行中</SelectItem>
                  <SelectItem value="COMPLETED">已完成</SelectItem>
                  <SelectItem value="REJECTED">已拒绝</SelectItem>
                  <SelectItem value="CANCELLED">已取消</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[130px]">工单编号</TableHead>
                  <TableHead>标题</TableHead>
                  <TableHead className="w-[90px]">状态</TableHead>
                  <TableHead className="w-[80px]">优先级</TableHead>
                  <TableHead className="w-[100px]">创建人</TableHead>
                  <TableHead className="w-[100px]">创建时间</TableHead>
                  <TableHead className="w-[60px]">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {workOrders.map((wo) => (
                  <TableRow key={wo.id} className="cursor-pointer hover:bg-muted/50">
                    <TableCell className="font-mono text-sm">
                      {wo.workOrderNo || wo.id}
                    </TableCell>
                    <TableCell className="font-medium">
                      {wo.title || '-'}
                    </TableCell>
                    <TableCell>
                      {renderStatusBadge(wo.status)}
                    </TableCell>
                    <TableCell className="text-sm">
                      {PRIORITY_LABELS[wo.priority || ''] || wo.priority || '-'}
                    </TableCell>
                    <TableCell className="text-sm">
                      {wo.reporterName || '-'}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {formatDate(wo.createTime)}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleViewWorkOrder(wo.id)}
                        title="查看工单详情"
                      >
                        <ExternalLink className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {/* Pagination controls */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-4 pt-4 border-t">
              <p className="text-sm text-muted-foreground">
                第 {currentPage} / {totalPages} 页，共 {total} 条记录
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={currentPage <= 1}
                  onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                >
                  上一页
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={currentPage >= totalPages}
                  onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                >
                  下一页
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default AssetWorkOrdersTab;
