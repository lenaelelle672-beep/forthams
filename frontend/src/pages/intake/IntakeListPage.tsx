/**
 * @file pages/intake/IntakeListPage.tsx
 * @description 入库验收列表页
 */

import { useState } from 'react';
import { useNavigate } from 'react-router';
import { Plus, Search, Eye, Trash2, ClipboardCheck } from 'lucide-react';
import { useIntakeOrders, useDeleteIntakeOrder } from '@/hooks/intake/useIntakeOrders';
import { IntakeStatus, INTAKE_STATUS_CONFIG, type IntakeOrder, type IntakeOrderListQuery } from '@/types/intake';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { StatusBadge } from '@/components/ui/Badge';
import { DataTable, type Column } from '@/components/ui/DataTable';
import { Input } from '@/components/ui/Input';

export default function IntakeListPage() {
  const navigate = useNavigate();
  const [query, setQuery] = useState<IntakeOrderListQuery>({ page: 1, pageSize: 10 });
  const [keyword, setKeyword] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('');

  const { data: pageRes, isLoading } = useIntakeOrders(query);
  const deleteMutation = useDeleteIntakeOrder();

  const pageData = pageRes as unknown as { records?: IntakeOrder[]; total?: number; current?: number; pages?: number } | undefined;
  const records = Array.isArray(pageData?.records) ? pageData.records : [];
  const total = pageData?.total ?? 0;

  const handleSearch = () => {
    setQuery((prev) => ({ ...prev, keyword, page: 1 }));
  };

  const handleStatusFilter = (status: string) => {
    const newStatus = status === statusFilter ? '' : status;
    setStatusFilter(newStatus);
    setQuery((prev) => ({ ...prev, status: newStatus, page: 1 }));
  };

  const handleDelete = (id: number) => {
    if (confirm('确定删除此验收单吗？')) {
      deleteMutation.mutate(id);
    }
  };

  const statusKeys = Object.keys(IntakeStatus);

  const columns: Column<IntakeOrder>[] = [
    {
      key: 'orderNo',
      title: '验收单号',
      render: (_v, row) => (
        <span className="font-medium text-[#0f172a]">{row.orderNo}</span>
      ),
    },
    {
      key: 'status',
      title: '状态',
      render: (_v, row) => <StatusBadge status={row.status} />,
    },
    {
      key: 'orderDate',
      title: '验收日期',
      render: (v) => <span className="text-[#64748b]">{(v as string) || '\u2014'}</span>,
    },
    {
      key: 'totalAmount',
      title: '总金额',
      align: 'right',
      render: (v) => (
        <span className="text-[#64748b]">
          {v != null ? `\u00a5${Number(v).toLocaleString()}` : '\u2014'}
        </span>
      ),
    },
    {
      key: 'createTime',
      title: '创建时间',
      render: (v) => <span className="text-[#64748b]">{(v as string) || '\u2014'}</span>,
    },
    {
      key: 'action',
      title: '操作',
      width: 120,
      render: (_v, row) => (
        <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
          <button
            type="button"
            onClick={() => navigate(`/intake/${row.id}`)}
            className="inline-flex h-7 items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-medium text-slate-600 hover:bg-slate-50 transition-colors"
          >
            <Eye className="w-3.5 h-3.5" />
          </button>
          {row.status === IntakeStatus.DRAFT && (
            <button
              type="button"
              onClick={() => handleDelete(row.id)}
              disabled={deleteMutation.isPending}
              className="inline-flex h-7 items-center gap-1 rounded-lg border border-red-200 bg-white px-2.5 text-xs font-medium text-red-500 hover:bg-red-50 transition-colors disabled:opacity-40"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="min-h-full bg-[var(--app-background)] px-4 py-5 sm:px-6 lg:px-8">
      <div className="mx-auto flex w-full max-w-[1480px] flex-col gap-6">

        {/* ── Compact header ── */}
        <section className="rounded-2xl border border-[var(--surface-border)] bg-white shadow-sm">
          <div className="flex items-center justify-between px-6 py-5">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 shadow-sm">
                <ClipboardCheck className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold tracking-tight text-[#0f172a]">入库验收</h1>
                <p className="text-sm text-[#64748b]">管理资产入库验收全流程</p>
              </div>
            </div>
            <Button onClick={() => navigate('/intake/new')}>
              <Plus className="w-4 h-4 mr-2" />
              新建验收单
            </Button>
          </div>
        </section>

        {/* ── Main content ── */}
        <Card className="overflow-hidden rounded-2xl border-slate-200/80 shadow-sm">
          {/* Toolbar */}
          <div className="flex items-center gap-3 border-b border-slate-100 px-5 py-3.5">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input
                placeholder="搜索验收单号..."
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                className="pl-10 h-9"
              />
            </div>
            <button
              type="button"
              onClick={handleSearch}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 text-xs font-medium text-slate-600 hover:bg-slate-50 transition-colors"
            >
              <Search className="w-3.5 h-3.5" />
              搜索
            </button>
          </div>

          {/* Quick filter pills */}
          <div className="flex items-center gap-2 border-b border-slate-100 px-5 py-2.5 flex-wrap">
            {statusKeys.map((key) => (
              <button
                key={key}
                type="button"
                className={`rounded-full border px-3.5 py-1.5 text-xs font-semibold transition-all ${
                  statusFilter === key
                    ? 'border-blue-500 bg-blue-600 text-white'
                    : 'border-slate-200 bg-white text-slate-500 hover:border-slate-300 hover:text-slate-700'
                }`}
                onClick={() => handleStatusFilter(key)}
              >
                {INTAKE_STATUS_CONFIG[key as IntakeStatus]?.label || key}
              </button>
            ))}
          </div>

          {/* DataTable */}
          <DataTable<IntakeOrder>
            columns={columns}
            data={records}
            loading={isLoading}
            onRowClick={(row) => navigate(`/intake/${row.id}`)}
            emptyText="暂无验收单"
          />

          {/* Pagination */}
          {total > 0 && (
            <div className="flex items-center justify-between border-t border-slate-100 px-5 py-3 text-sm text-[#64748b]">
              <span>共 {total} 条</span>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={!query.page || query.page <= 1}
                  onClick={() => setQuery((prev) => ({ ...prev, page: (prev.page || 1) - 1 }))}
                >
                  上一页
                </Button>
                <span className="px-2">第 {query.page || 1} 页</span>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={(query.page || 1) * (query.pageSize || 10) >= total}
                  onClick={() => setQuery((prev) => ({ ...prev, page: (prev.page || 1) + 1 }))}
                >
                  下一页
                </Button>
              </div>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
