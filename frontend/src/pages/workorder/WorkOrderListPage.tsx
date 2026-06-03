/**
 * @file pages/workorder/WorkOrderListPage.tsx
 * @description 工单管理列表页
 */

import { useState } from 'react';
import { useNavigate } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { Plus, FileText, Download, Loader2, Clock, AlertTriangle, Shield } from 'lucide-react';
import { toast } from 'sonner';
import { getWorkOrderList } from '@/api/workorder';
import http from '@/utils/http';
import type { PaginatedResponse, PageData } from '@/types/common';
import type { WorkOrderListItem } from '@/types/workorder';
import { Button } from '@/components/ui/Button';
import { FilterBar } from '@/components/ui/FilterBar';
import { DataTable, type Column } from '@/components/ui/DataTable';
import { Badge } from '@/components/ui/Badge';
import { PageHeader } from '@/components/ui/PageHeader';
import { MagicCard } from '@/components/ui/MagicCard';
import { GlowEffect } from '@/components/ui/GlowEffect';

const WO_STATUS_OPTIONS = [
  { key: 'PENDING',           label: '待审批'   },
  { key: 'APPROVED',          label: '已通过'   },
  { key: 'EXECUTING',         label: '执行中'   },
  { key: 'ON_HOLD',           label: '挂起中'   },
  { key: 'COMPLETED',         label: '已完成'   },
  { key: 'REJECTED',          label: '已驳回'   },
  { key: 'CANCELLED',         label: '已取消'   },
];

const SLA_STATUS_OPTIONS = [
  { key: 'NORMAL',   label: 'SLA 正常',   icon: <Shield className="w-3 h-3" /> },
  { key: 'WARNING',  label: 'SLA 预警',   icon: <Clock className="w-3 h-3" /> },
  { key: 'BREACHED', label: 'SLA 超期',   icon: <AlertTriangle className="w-3 h-3" /> },
];

const STATUS_BADGE: Record<string, { label: string; variant: 'default' | 'success' | 'warning' | 'danger' | 'gray' }> = {
  DRAFT:             { label: '草稿',      variant: 'gray'    },
  PENDING:           { label: '待审批',    variant: 'default' },
  APPROVED:          { label: '已通过',    variant: 'success' },
  EXECUTING:         { label: '执行中',    variant: 'success' },
  ON_HOLD:           { label: '挂起中',    variant: 'warning' },
  COMPLETED:         { label: '已完成',    variant: 'success' },
  REJECTED:          { label: '已驳回',    variant: 'danger'  },
  CANCELLED:         { label: '已取消',    variant: 'gray'    },
};

const PRIORITY_LABEL: Record<string, string> = {
  LOW: '低', MEDIUM: '中', HIGH: '高', CRITICAL: '紧急',
};

const PRIORITY_CONFIG: Record<string, { borderClass: string; badgeClass: string }> = {
  CRITICAL: { borderClass: 'border-red-500',   badgeClass: 'bg-red-50 text-red-700 ring-1 ring-red-300 animate-pulse' },
  HIGH:     { borderClass: 'border-amber-400', badgeClass: 'bg-amber-50 text-amber-700 ring-1 ring-amber-300' },
  MEDIUM:   { borderClass: 'border-blue-300',  badgeClass: 'bg-blue-50 text-blue-600 ring-1 ring-blue-200' },
  LOW:      { borderClass: 'border-gray-200',  badgeClass: 'bg-gray-50 text-gray-500' },
};

export default function WorkOrderListPage() {
  const navigate = useNavigate();
  const [params, setParams] = useState<{ page: number; pageSize: number; keyword?: string; status?: string; slaStatus?: string }>({ page: 1, pageSize: 20 });
  const [exporting, setExporting] = useState(false);

  const { data: res, isLoading } = useQuery({
    queryKey: ['workorders', 'list', params],
    queryFn:  () => getWorkOrderList(params),
    staleTime: 1000 * 30,
    placeholderData: (p) => p,
  });

  const records = (res as PageData<WorkOrderListItem> | undefined)?.records ?? [];
  const total   = (res as PageData<WorkOrderListItem> | undefined)?.total   ?? 0;

  const columns: Column<any>[] = [
    {
      key: 'workOrderNo',
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
      width: 80,
      render: (v) => {
        const key = String(v);
        const cfg = PRIORITY_CONFIG[key] ?? PRIORITY_CONFIG['LOW'];
        return (
          <div className={`inline-flex items-center pl-2 border-l-2 ${cfg.borderClass}`}>
            <Badge className={`text-xs font-medium px-1.5 py-0.5 ${cfg.badgeClass}`}>
              {PRIORITY_LABEL[key] ?? key}
            </Badge>
          </div>
        );
      },
    },
    {
      key: 'status',
      title: '状态',
      width: 110,
      render: (v) => {
        const cfg = STATUS_BADGE[String(v)];
        return (
          <GlowEffect mode="shimmer" intensity={0.3} animated={true}>
            <Badge variant={cfg?.variant}>{cfg?.label ?? String(v)}</Badge>
          </GlowEffect>
        );
      },
    },
    { key: 'reporterName', title: '申请人', width: 80 },
    { key: 'deptName', title: '部门', width: 100 },
    {
      key: 'createTime',
      title: '申请时间',
      width: 120,
      render: (v) => <span className="text-xs text-[#94a3b8]">{String(v ?? '').substring(0, 10)}</span>,
    },
  ];

  return (
    <div className="p-6 space-y-5">
      <PageHeader
        title="工单管理"
        subtitle={
          params.status
            ? `过滤: ${STATUS_BADGE[params.status]?.label ?? params.status} · 共 ${total} 条`
            : `共 ${total} 条工单`
        }
        breadcrumbs={[{ label: '仪表板', href: '/dashboard' }, { label: '工单管理' }]}
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" size="md" disabled={exporting} onClick={async () => {
              if (exporting) return;
              setExporting(true);
              try {
                const allRes = await http.get('/workorders', {
                  params: {
                    page: 1,
                    pageSize: 99999,
                    keyword: params.keyword || undefined,
                    status: params.status || undefined,
                  },
                });
                const allRecords = (allRes as PageData<WorkOrderListItem> | undefined)?.records ?? [];
                if (allRecords.length === 0) {
                  toast.info('暂无数据可导出');
                  return;
                }
                const headers = ['工单号', '标题', '优先级', '状态', '申请人', '部门', '申请时间'];
                const rows = allRecords.map((r: any) => [
                  r.workOrderNo ?? r.id ?? '',
                  r.title ?? '',
                  PRIORITY_LABEL[r.priority] ?? r.priority ?? '',
                  STATUS_BADGE[r.status]?.label ?? r.status ?? '',
                  r.reporterName ?? '',
                  r.deptName ?? '',
                  r.createTime ?? '',
                ]);
                const csv = [headers, ...rows].map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\n');
                const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url; a.download = `workorders-${new Date().toISOString().slice(0, 10)}.csv`;
                a.click(); URL.revokeObjectURL(url);
                toast.success(`已导出 ${allRecords.length} 条工单`);
              } catch (err) {
                toast.error('导出失败，请重试');
              } finally {
                setExporting(false);
              }
            }}>
              {exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
              {exporting ? '导出中...' : '导出全部'}
            </Button>
            <Button size="md" onClick={() => navigate('/workorders/new')}>
              <Plus className="w-4 h-4" /> 新建工单
            </Button>
          </div>
        }
      />

      <MagicCard variant="glow" size="sm" className="!p-0">
        <div className="p-4 border-b border-[#e5e7eb] space-y-3">
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
          {/* SLA 快速筛选 */}
          <div className="flex items-center gap-2 overflow-x-auto pb-0.5">
            <button
              onClick={() => setParams((p) => ({ ...p, slaStatus: undefined, page: 1 }))}
              className={`h-7 px-3 rounded-full text-xs font-medium whitespace-nowrap transition-all ${
                !params.slaStatus
                  ? 'bg-[#3b82f6] text-white'
                  : 'bg-[#f1f5f9] text-[#64748b] hover:bg-[#e2e8f0]'
              }`}
            >
              全部 SLA
            </button>
            {SLA_STATUS_OPTIONS.map((opt) => (
              <button
                key={opt.key}
                onClick={() => setParams((p) => ({ ...p, slaStatus: opt.key, page: 1 }))}
                className={`inline-flex items-center gap-1 h-7 px-3 rounded-full text-xs font-medium whitespace-nowrap transition-all ${
                  params.slaStatus === opt.key
                    ? 'bg-[#3b82f6] text-white'
                    : 'bg-[#f1f5f9] text-[#64748b] hover:bg-[#e2e8f0]'
                }`}
              >
                {opt.icon}
                {opt.label}
              </button>
            ))}
          </div>
        </div>
        {(isLoading || !!params.status || !!params.slaStatus) && (
          <div className="px-4 py-2 border-b border-[#e5e7eb] bg-[#f8fbff] flex items-center gap-3 text-xs text-[#64748b]">
            {isLoading ? (
              <><Loader2 className="w-3 h-3 animate-spin text-[#3b82f6]" /><span>加载中...</span></>
            ) : (
              <>
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-[#3b82f6]" />
                <span>
                  {params.status || params.slaStatus
                    ? `当前筛选：共 ${total} 条结果`
                    : `共 ${total} 条工单`}
                </span>
                {(params.status || params.slaStatus) && (
                  <button
                    className="ml-auto text-[#94a3b8] hover:text-[#ef4444] transition-colors"
                    onClick={() => setParams((p) => ({ ...p, status: undefined, slaStatus: undefined, page: 1 }))}
                  >
                    清除筛选
                  </button>
                )}
              </>
            )}
          </div>
        )}
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
      </MagicCard>
    </div>
  );
}
