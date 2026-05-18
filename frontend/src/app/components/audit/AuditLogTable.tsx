/**
 * @module AuditLogTable
 * @description 审计日志明细表格组件，基于 shadcn/ui Table 渲染审计日志列表数据。
 * 接收外部传入的日志条目与分页信息，支持空数据状态与加载态展示。
 *
 * 对应 SPEC: ATB-03 明细表格数据同步与展示
 *
 * @since SWARM-044
 */

import React from 'react';
import { useNavigate } from 'react-router';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../ui/table';
import type { AuditLogItem } from '../../hooks/useAuditLogs';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** 分页元数据 */
export interface PaginationMeta {
  /** 总记录数 */
  total: number;
  /** 当前页码 */
  page: number;
  /** 每页条数 */
  size: number;
}

/** 表格组件属性 */
export interface AuditLogTableProps {
  /** 审计日志条目列表 */
  logs: AuditLogItem[];
  /** 分页元数据 */
  pagination: PaginationMeta;
  /** 加载状态 */
  isLoading: boolean;
  /** 页码变更回调 */
  onPageChange: (page: number) => void;
}

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
// Component
// ---------------------------------------------------------------------------

/**
 * AuditLogTable — 审计日志明细表格
 *
 * 渲染审计日志列表数据，支持分页操作和空数据状态展示。
 * 所有数据通过 props 从父组件单向流入，不发起任何 API 请求。
 *
 * @param props 组件属性
 * @returns React 组件
 *
 * @example
 * ```tsx
 * <AuditLogTable
 *   logs={logItems}
 *   pagination={{ total: 100, page: 1, size: 50 }}
 *   isLoading={listLoading}
 *   onPageChange={handlePageChange}
 * />
 * ```
 */
const AuditLogTable: React.FC<AuditLogTableProps> = ({
  logs,
  pagination,
  isLoading,
  onPageChange,
}) => {
  const navigate = useNavigate();
  /** 总页数 */
  const totalPages = Math.max(1, Math.ceil(pagination.total / pagination.size));

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          审计日志明细
          {pagination.total > 0 && (
            <Badge variant="secondary" data-testid="pagination-info">
              共 {pagination.total} 条记录
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading && logs.length === 0 ? (
          <div
            className="text-center py-8 text-muted-foreground text-sm"
            data-testid="audit-table-loading"
          >
            加载中...
          </div>
        ) : logs.length === 0 ? (
          <div
            className="text-center py-8 text-muted-foreground text-sm"
            data-testid="audit-table-empty"
          >
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
                    <TableHead className="w-[90px]">操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody data-testid="audit-log-table-body">
                  {logs.map((item) => (
                    <TableRow key={item.id} className="audit-table-row" data-testid="audit-table-row">
                      <TableCell
                        className="text-xs text-muted-foreground whitespace-nowrap"
                        data-testid="audit-table-cell-timestamp"
                      >
                        {formatLocalTime(item.created_at)}
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">{item.operator_name}</div>
                        <div className="text-xs text-muted-foreground">
                          {item.operator_id}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          data-testid="audit-table-cell-action-type"
                        >
                          {item.action_type}
                        </Badge>
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
                      <TableCell>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => navigate(`/audit/${encodeURIComponent(item.id)}`)}
                        >
                          详情
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {/* 分页控件 */}
            <div className="flex items-center justify-between mt-4 text-sm">
              <span className="text-muted-foreground">
                共 {pagination.total} 条记录，第 {pagination.page}/{totalPages} 页
              </span>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={pagination.page <= 1 || isLoading}
                  onClick={() => onPageChange(pagination.page - 1)}
                  data-testid="pagination-prev"
                >
                  上一页
                </Button>
                <span className="px-2">
                  {pagination.page}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={pagination.page >= totalPages || isLoading}
                  onClick={() => onPageChange(pagination.page + 1)}
                  data-testid="pagination-next"
                >
                  下一页
                </Button>
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
};

AuditLogTable.displayName = 'AuditLogTable';

export default AuditLogTable;
export { AuditLogTable };
