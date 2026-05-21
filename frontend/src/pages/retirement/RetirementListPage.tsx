import { useState } from 'react';
import { useNavigate } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import {
  Plus,
  Search,
  Filter,
  RefreshCw,
  Eye,
  Edit2,
  ChevronLeft,
  ChevronRight,
  ChevronRightIcon,
  ChevronsLeft,
  ChevronsRight,
  Wallet,
  TrendingUp,
  Clock,
  Recycle,
  AlertTriangle,
  CalendarDays,
} from 'lucide-react';
import { getRetirementList } from '@/api/retirement';
import type { RetirementStatus, RetirementApplication, RetirementListQuery } from '@/api/retirement';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { FilterBar } from '@/components/ui/FilterBar';
import { DataTable, type Column } from '@/components/ui/DataTable';
import { PageHeader } from '@/components/ui/PageHeader';
import type { PaginatedResponse } from '@/types/common';
import { Input } from '@/components/ui/Input';

const STATUS_CONFIG: Record<
  RetirementStatus,
  { label: string; variant: 'gray' | 'default' | 'warning' | 'success' | 'danger' | 'purple'; cls?: string }
> = {
  DRAFT: { label: '草稿', variant: 'gray' },
  PENDING: {
    label: '待审批',
    variant: 'warning',
    cls: 'bg-[#fef3c7] text-[#d97706] border-[#d97706]/10',
  },
  APPROVING: {
    label: '审批中',
    variant: 'default',
    cls: 'bg-[#dbeafe] text-[#2563eb] border-[#2563eb]/10',
  },
  APPROVED: { label: '已通过', variant: 'success' },
  REJECTED: {
    label: '已驳回',
    variant: 'danger',
    cls: 'bg-[#ffdad6] text-[#ba1a1a] border-[#ba1a1a]/10',
  },
  WITHDRAWN: { label: '已撤回', variant: 'gray' },
  COMPLETED: {
    label: '已完成',
    variant: 'gray',
    cls: 'bg-[#dee2f2] text-[#64748b] border-[#64748b]/10',
  },
};

const QUICK_FILTERS = [
  { key: 'PENDING', label: '待审批' },
  { key: 'APPROVING', label: '审批中' },
  { key: 'APPROVED', label: '已通过' },
  { key: 'REJECTED', label: '已驳回' },
  { key: 'COMPLETED', label: '已完成' },
];

const METRIC_CARDS = [
  { label: '退役总价值', value: '¥1,842,000', sub: '较上月 +12.5%', subColor: 'text-[#16a34a]', icon: Wallet, iconColor: 'text-[#004191]' },
  { label: '待审核', value: '18 项申请', sub: '平均响应时间: 4.2h', subColor: 'text-[#64748b]', icon: Clock, iconColor: 'text-[#d97706]' },
  { label: '残值回收', value: '¥610,200', sub: '回收率 33%', subColor: 'text-[#64748b]', icon: Recycle, iconColor: 'text-[#16a34a]' },
  { label: '主要退役原因', value: '技术过时', sub: '占全部退役的 42%', subColor: 'text-[#64748b]', icon: AlertTriangle, iconColor: 'text-[#ba1a1a]' },
] as const;

export default function RetirementListPage() {
  const navigate = useNavigate();
  const [params, setParams] = useState<{ page: number; pageSize: number; keyword?: string; status?: string; department?: string; dateRange?: string }>({ page: 1, pageSize: 20 });

  const { data: res, isLoading } = useQuery({
    queryKey: ['retirement', 'list', params],
    queryFn: () => getRetirementList(params),
    staleTime: 1000 * 30,
    placeholderData: (p) => p,
  });

  const records = (res as PaginatedResponse<RetirementApplication> | undefined)?.data?.records ?? [];
  const total = (res as PaginatedResponse<RetirementApplication> | undefined)?.data?.total ?? 0;

  const columns: Column<any>[] = [
    {
      key: 'id',
      title: '申请编号',
      width: 150,
      render: (v) => <span className="text-[13px] font-semibold text-[#004191]">{String(v)}</span>,
    },
    {
      key: 'assetNo',
      title: '资产编号',
      width: 110,
      render: (v) => <span className="text-[11px] font-mono text-[#64748b]">{String(v)}</span>,
    },
    {
      key: 'assetName',
      title: '资产名称',
      render: (v) => <span className="text-[13px] font-medium text-[#161c27]">{String(v ?? '—')}</span>,
    },
    {
      key: 'categoryName',
      title: '分类',
      width: 100,
      render: (v) => (
        <span className="px-2 py-0.5 bg-[#dee2f2] text-[#64748b] text-[11px] font-bold rounded uppercase tracking-wider">
          {String(v ?? '—')}
        </span>
      ),
    },
    {
      key: 'originalValue',
      title: '原值',
      width: 120,
      align: 'right',
      render: (v) => (
        <span className="text-[13px] font-medium text-[#161c27]">
          {v != null ? `¥${Number(v).toLocaleString()}` : '—'}
        </span>
      ),
    },
    {
      key: 'residualValue',
      title: '残值',
      width: 120,
      align: 'right',
      render: (v) => (
        <span className="text-[13px] text-[#64748b]">
          {v != null ? `¥${Number(v).toLocaleString()}` : '—'}
        </span>
      ),
    },
    {
      key: 'reason',
      title: '退役原因',
      width: 140,
      render: (v) => <span className="text-[11px] text-[#64748b] line-clamp-1">{String(v ?? '—')}</span>,
    },
    {
      key: 'applicantName',
      title: '申请人',
      width: 110,
      render: (v) => <span className="text-[13px] text-[#161c27]">{String(v ?? '—')}</span>,
    },
    {
      key: 'status',
      title: '状态',
      width: 130,
      render: (v) => {
        const cfg = STATUS_CONFIG[v as RetirementStatus];
        if (cfg?.cls) {
          return (
            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${cfg.cls}`}>
              <span className={`w-1.5 h-1.5 rounded-full mr-1.5 ${cfg.cls.includes('warning') ? 'bg-[#d97706]' : cfg.cls.includes('danger') ? 'bg-[#ba1a1a]' : cfg.cls.includes('2563eb') ? 'bg-[#2563eb]' : 'bg-[#64748b]'}`} />
              {cfg.label}
            </span>
          );
        }
        return <Badge variant={cfg?.variant}>{cfg?.label ?? String(v)}</Badge>;
      },
    },
    {
      key: 'id',
      title: '操作',
      width: 90,
      align: 'center',
      render: (_, row) => (
        <div className="flex items-center justify-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            onClick={(e) => { e.stopPropagation(); navigate(`/retirement/${row.id}`); }}
          >
            <Eye className="w-4 h-4" />
          </Button>
          {row.status !== 'COMPLETED' && (
            <Button
              variant="ghost"
              size="icon"
              onClick={(e) => { e.stopPropagation(); navigate(`/retirement/${row.id}/edit`); }}
            >
              <Edit2 className="w-4 h-4" />
            </Button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <nav className="flex items-center text-[10px] text-[#64748b] space-x-2 mb-2 uppercase tracking-wider">
            <a className="hover:text-[#004191] cursor-pointer" onClick={() => navigate('/dashboard')}>FORTHAMS</a>
            <ChevronRightIcon className="w-3 h-3" />
            <span className="text-[#004191] font-bold">资产退役</span>
          </nav>
          <PageHeader
            title="资产退役管理"
            subtitle="管理资产生命周期终止、处置流程和退役记录。"
            breadcrumbs={[]}
            actions={
              <Button size="md" onClick={() => navigate('/retirement/new')}>
                <Plus className="w-4 h-4" />
                新建退役申请
              </Button>
            }
          />
        </div>
      </div>

      <div className="bg-white border border-[#e5e7eb] rounded-xl p-4 shadow-sm">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
          <div className="md:col-span-3">
            <label className="text-[10px] text-[#64748b] mb-1.5 block uppercase tracking-wider">搜索申请</label>
            <Input
              placeholder="搜索编号或资产..."
              prefix={<Search className="w-4 h-4" />}
              onChange={(e) => setParams((p) => ({ ...p, keyword: e.target.value, page: 1 }))}
            />
          </div>
          <div className="md:col-span-2">
            <label className="text-[10px] text-[#64748b] mb-1.5 block uppercase tracking-wider">状态</label>
            <select
              className="w-full px-3 py-2 bg-white border border-[#e5e7eb] rounded-lg text-[13px] focus:ring-2 focus:ring-[#004191]/10 focus:border-[#004191] outline-none transition-all"
              value={params.status ?? ''}
              onChange={(e) =>
                setParams((p) => ({
                  ...p,
                  status: e.target.value || undefined,
                  page: 1,
                }))
              }
            >
              <option value="">全部状态</option>
              <option value="PENDING">待审批</option>
              <option value="APPROVING">审批中</option>
              <option value="COMPLETED">已完成</option>
              <option value="REJECTED">已驳回</option>
            </select>
          </div>
          <div className="md:col-span-2">
            <label className="text-[10px] text-[#64748b] mb-1.5 block uppercase tracking-wider">部门</label>
            <select
              className="w-full px-3 py-2 bg-white border border-[#e5e7eb] rounded-lg text-[13px] focus:ring-2 focus:ring-[#004191]/10 focus:border-[#004191] outline-none transition-all"
              value={params.department ?? ''}
              onChange={(e) =>
                setParams((p) => ({
                  ...p,
                  department: e.target.value || undefined,
                  page: 1,
                }))
              }
            >
              <option value="">全部部门</option>
              <option value="it">技术部</option>
              <option value="mfg">生产部</option>
              <option value="ops">运维部</option>
              <option value="log">后勤部</option>
            </select>
          </div>
          <div className="md:col-span-3">
            <label className="text-[10px] text-[#64748b] mb-1.5 block uppercase tracking-wider">日期范围</label>
            <Input
              placeholder="2024/05/01 - 2024/05/31"
              prefix={<CalendarDays className="w-4 h-4" />}
              onChange={(e) =>
                setParams((p) => ({ ...p, dateRange: e.target.value, page: 1 }))
              }
            />
          </div>
          <div className="md:col-span-2 flex items-end gap-2">
            <Button
              variant="secondary"
              size="md"
              className="flex-1"
              onClick={() => {}}
            >
              <Filter className="w-3.5 h-3.5" /> 筛选
            </Button>
            <Button
              variant="outline"
              size="icon"
              onClick={() => setParams({ page: 1, pageSize: 20 })}
            >
              <RefreshCw className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>

      <Card>
        <DataTable
          columns={columns}
          data={records}
          loading={isLoading}
          rowKey="id"
          onRowClick={(row) => navigate(`/retirement/${row.id}`)}
          pagination={{
            page: params.page,
            pageSize: params.pageSize,
            total,
            onChange: (page, pageSize) => setParams((p) => ({ ...p, page, pageSize })),
          }}
          emptyText="暂无退役申请记录"
        />
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        {METRIC_CARDS.map(({ label, value, sub, subColor, icon: Icon, iconColor }) => (
          <div key={label} className="bg-white border border-[#e5e7eb] p-4 rounded-xl shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] text-[#64748b] uppercase tracking-wider">{label}</span>
              <Icon className={`w-5 h-5 ${iconColor}`} />
            </div>
            <div className="text-xl font-bold text-[#161c27]">{value}</div>
            <div className={`text-[11px] mt-1 flex items-center gap-1 ${subColor}`}>
              {subColor.includes('16a34a') && <TrendingUp className="w-3 h-3" />}
              {sub}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
