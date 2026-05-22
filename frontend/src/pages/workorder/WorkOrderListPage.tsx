/**
 * @file pages/workorder/WorkOrderListPage.tsx
 * @description 工单管理列表页
 */

import { useState } from 'react';
import { useNavigate } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { Plus, FileText, Download } from 'lucide-react';
import { toast } from 'sonner';
import { getWorkOrderList } from '@/api/workorder';
import type { PaginatedResponse } from '@/types/common';
import type { WorkOrderListItem } from '@/types/workorder';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { FilterBar } from '@/components/ui/FilterBar';
import { DataTable, type Column } from '@/components/ui/DataTable';
import { Badge } from '@/components/ui/Badge';
import { PageHeader } from '@/components/ui/PageHeader';

const WO_STATUS_OPTIONS = [
  { key: 'PENDING',           label: '待审批'   },
  { key: 'APPROVING_LEVEL_1', label: '一级审批中' },
  { key: 'APPROVING_LEVEL_2', label: '二级审批中' },
  { key: 'APPROVED',          label: '已通过'   },
  { key: 'IN_PROGRESS',       label: '进行中'   },
  { key: 'COMPLETED',         label: '已完成'   },
  { key: 'REJECTED',          label: '已驳回'   },
  { key: 'CANCELLED',         label: '已取消'   },
];

const STATUS_BADGE: Record<string, { label: string; variant: 'default' | 'success' | 'warning' | 'danger' | 'gray' }> = {
  DRAFT:             { label: '草稿',      variant: 'gray'    },
  PENDING:           { label: '待审批',    variant: 'default' },
  APPROVING_LEVEL_1: { label: '一级审批中', variant: 'warning' },
  APPROVING_LEVEL_2: { label: '二级审批中', variant: 'warning' },
  APPROVED:          { label: '已通过',    variant: 'success' },
  IN_PROGRESS:       { label: '进行中',    variant: 'success' },
  COMPLETED:         { label: '已完成',    variant: 'success' },
  REJECTED:          { label: '已驳回',    variant: 'danger'  },
  CANCELLED:         { label: '已取消',    variant: 'gray'    },
};

const PRIORITY_LABEL: Record<string, string> = {
  LOW: '低', MEDIUM: '中', HIGH: '高', CRITICAL: '紧急',
};

export default function WorkOrderListPage() {
  const navigate = useNavigate();
  const [params, setParams] = useState<{ page: number; pageSize: number; keyword?: string; status?: string }>({ page: 1, pageSize: 20 });

  const { data: res, isLoading } = useQuery({
    queryKey: ['workorders', 'list', params],
    queryFn:  () => getWorkOrderList(params),
    staleTime: 1000 * 30,
    placeholderData: (p) => p,
  });

  const records = (res as PaginatedResponse<WorkOrderListItem> | undefined)?.data?.records ?? [];
  const total   = (res as PaginatedResponse<WorkOrderListItem> | undefined)?.data?.total   ?? 0;

  const columns: Column<any>[] = [
    {
      key: 'orderNo',
      title: '工单号',
      width: 150,
      render: (v) => <span className="font-mono text-xs text-[#3b82f6] font-medium">{String(v)}</span>,
    },
    {
      key: 'title',
      title: '工单标题',
      render: (v, row) => (
        <div>
          <p className="font-medium text-sm text-[#0f172a] line-clamp-1">{String(v)}</p>
          <p className="text-xs text-[#94a3b8]">{row.type ?? ''}</p>
        </div>
      ),
    },
    {
      key: 'priority',
      title: '优先级',
      width: 70,
      render: (v) => {
        const colors: Record<string, string> = {
          CRITICAL: 'text-red-600 font-bold', HIGH: 'text-amber-600 font-semibold',
          MEDIUM: 'text-blue-600', LOW: 'text-gray-500',
        };
        return <span className={`text-xs ${colors[String(v)] ?? ''}`}>{PRIORITY_LABEL[String(v)] ?? String(v)}</span>;
      },
    },
    {
      key: 'status',
      title: '状态',
      width: 110,
      render: (v) => {
        const cfg = STATUS_BADGE[String(v)];
        return <Badge variant={cfg?.variant}>{cfg?.label ?? String(v)}</Badge>;
      },
    },
    { key: 'applicantName', title: '申请人', width: 80 },
    { key: 'departmentName', title: '部门', width: 100 },
    {
      key: 'createdAt',
      title: '申请时间',
      width: 120,
      render: (v) => <span className="text-xs text-[#94a3b8]">{String(v ?? '').substring(0, 10)}</span>,
    },
  ];

  return (
    <div className="p-6 space-y-5">
      <PageHeader
        title="工单管理"
        subtitle={`共 ${total} 条工单`}
        breadcrumbs={[{ label: '仪表板', href: '/dashboard' }, { label: '工单管理' }]}
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" size="md" onClick={() => {
              if (records.length === 0) {
                toast.info('暂无数据可导出');
                return;
              }
              const headers = ['工单号', '标题', '优先级', '状态', '申请人', '部门', '申请时间'];
              const rows = records.map((r: any) => [
                r.orderNo ?? r.id ?? '',
                r.title ?? '',
                PRIORITY_LABEL[r.priority] ?? r.priority ?? '',
                STATUS_BADGE[r.status]?.label ?? r.status ?? '',
                r.applicantName ?? '',
                r.departmentName ?? '',
                r.createdAt ?? '',
              ]);
              const csv = [headers, ...rows].map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\n');
              const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url; a.download = `workorders-${new Date().toISOString().slice(0, 10)}.csv`;
              a.click(); URL.revokeObjectURL(url);
              toast.success('导出成功');
            }}>
              <Download className="w-4 h-4" /> 导出CSV
            </Button>
            <Button size="md" onClick={() => navigate('/workorders/new')}>
              <Plus className="w-4 h-4" /> 新建工单
            </Button>
          </div>
        }
      />

      <Card>
        <div className="p-4 border-b border-[#e5e7eb]">
          <FilterBar
            placeholder="搜索工单号、标题..."
            onSearch={(keyword) => setParams((p) => ({ ...p, keyword, page: 1 }))}
            quickFilters={WO_STATUS_OPTIONS}
            activeFilter={params.status}
            onFilterChange={(key) =>
              setParams((p) => ({
                ...p,
                status: key === 'all' ? undefined : key,
                page: 1,
              }))
            }
          />
        </div>
        <DataTable
          columns={columns}
          data={records}
          loading={isLoading}
          rowKey="id"
          onRowClick={(row) => navigate(`/workorders/${row.id}`)}
          pagination={{
            page: params.page, pageSize: params.pageSize, total,
            onChange: (page, pageSize) => setParams((p) => ({ ...p, page, pageSize })),
          }}
          emptyText="暂无工单记录"
        />
      </Card>
    </div>
  );
}
