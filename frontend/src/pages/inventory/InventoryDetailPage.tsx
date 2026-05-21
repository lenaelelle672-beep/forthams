import { useState } from 'react';
import { useParams, useNavigate } from 'react-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  Search,
  Download,
  Bell,
  HelpCircle,
  Filter,
  Columns3,
  CheckCircle2,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  Building2,
  MapPin,
  Send,
  Camera,
} from 'lucide-react';
import {
  getInventoryTaskDetail,
  getTaskAssets,
  confirmAsset,
  batchConfirmAssets,
  submitTask,
  getTaskSummary,
} from '@/api/inventory';
import type { ActualStatus, InventoryTask, InventoryAsset, InventorySummary } from '@/types/inventory';
import type { ApiResponse, PaginatedResponse } from '@/types/common';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { DataTable, type Column } from '@/components/ui/DataTable';
import { PageHeader } from '@/components/ui/PageHeader';
import { Select, SelectItem } from '@/components/ui/Select';
import { Input } from '@/components/ui/Input';
import { Skeleton } from '@/components/ui/Skeleton';

const ACTUAL_STATUS_OPTIONS: Array<{ value: ActualStatus; label: string; variant: any }> = [
  { value: 'normal', label: '正常', variant: 'success' },
  { value: 'surplus', label: '盘盈', variant: 'default' },
  { value: 'deficit', label: '盘亏', variant: 'danger' },
  { value: 'damaged', label: '损坏', variant: 'warning' },
  { value: 'other', label: '其他', variant: 'gray' },
];

function StatusSelect({
  value,
  onChange,
  disabled,
}: {
  value: ActualStatus | undefined;
  onChange: (v: ActualStatus) => void;
  disabled?: boolean;
}) {
  return (
    <Select
      value={value ?? ''}
      onValueChange={onChange as (v: string) => void}
      disabled={disabled}
      placeholder="选择实盘状态"
    >
      {ACTUAL_STATUS_OPTIONS.map((o) => (
        <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
      ))}
    </Select>
  );
}

export default function InventoryDetailPage() {
  const { taskId } = useParams<{ taskId: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const [assetParams, setAssetParams] = useState({ page: 1, pageSize: 20 });
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [batchStatus, setBatchStatus] = useState<ActualStatus>('normal');
  const [activeTab, setActiveTab] = useState<string>('all');

  const { data: taskRes, isLoading: taskLoading } = useQuery({
    queryKey: ['inventory', 'task', taskId],
    queryFn: () => getInventoryTaskDetail(taskId!),
    enabled: !!taskId,
  });

  const { data: assetsRes, isLoading: assetsLoading } = useQuery({
    queryKey: ['inventory', 'assets', taskId, assetParams],
    queryFn: () => getTaskAssets(taskId!, assetParams),
    enabled: !!taskId,
    staleTime: 1000 * 15,
  });

  const { data: summaryRes } = useQuery({
    queryKey: ['inventory', 'summary', taskId],
    queryFn: () => getTaskSummary(taskId!),
    enabled: !!taskId,
  });

  const confirmMutation = useMutation({
    mutationFn: ({ assetId, status }: { assetId: string; status: ActualStatus }) =>
      confirmAsset(taskId!, assetId, { actualStatus: status }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['inventory', 'assets', taskId] }),
  });

  const batchConfirmMutation = useMutation({
    mutationFn: () =>
      batchConfirmAssets(taskId!, {
        assetIds: Array.from(selected),
        actualStatus: batchStatus,
      }),
    onSuccess: () => {
      setSelected(new Set());
      qc.invalidateQueries({ queryKey: ['inventory', 'assets', taskId] });
      qc.invalidateQueries({ queryKey: ['inventory', 'task', taskId] });
    },
  });

  const submitMutation = useMutation({
    mutationFn: () => submitTask(taskId!),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['inventory', 'task', taskId] });
      navigate('/inventory');
    },
  });

  const task = (taskRes as ApiResponse<InventoryTask> | undefined)?.data;
  const records = (assetsRes as PaginatedResponse<InventoryAsset> | undefined)?.data?.records ?? [];
  const total = (assetsRes as PaginatedResponse<InventoryAsset> | undefined)?.data?.total ?? 0;
  const summary = (summaryRes as ApiResponse<InventorySummary> | undefined)?.data;

  const canSubmit = task?.status === 'completed' || task?.progress >= 100;
  const progressPct = task?.progress ?? 0;
  const countedAssets = task?.countedAssets ?? 0;
  const totalAssets = task?.totalAssets ?? 0;
  const normalCount = summary?.normalCount ?? 0;
  const abnormalCount = summary?.abnormalCount ?? 0;

  const columns: Column<any>[] = [
    {
      key: 'assetCode',
      title: '资产编号',
      width: 130,
      render: (v) => <span className="font-mono text-[13px] text-[#2563eb] font-semibold">{String(v)}</span>,
    },
    {
      key: 'assetName',
      title: '资产名称',
      render: (v) => <span className="text-[13px] text-[#161c27]">{String(v)}</span>,
    },
    {
      key: 'categoryName',
      title: '分类',
      width: 100,
      render: (v) => <span className="text-[13px] text-[#64748b]">{String(v)}</span>,
    },
    {
      key: 'locationPath',
      title: '应存位置',
      width: 140,
      render: (v) => <span className="text-[13px] text-[#64748b]">{String(v)}</span>,
    },
    {
      key: 'actualLocation',
      title: '实存位置',
      width: 140,
      render: (v, row) => {
        if (row.actualStatus === 'deficit') {
          return <span className="text-[13px] text-[#ba1a1a] italic">未找到</span>;
        }
        if (v && v !== row.locationPath) {
          return <span className="text-[13px] text-[#ba1a1a] font-medium">{String(v)}</span>;
        }
        return <span className="text-[13px] text-[#64748b]">{String(v ?? row.locationPath)}</span>;
      },
    },
    {
      key: 'actualStatus',
      title: '盘点状态',
      width: 100,
      render: (v) => {
        if (v === 'normal') {
          return (
            <span className="px-2 py-1 bg-[#dcfce7]/50 text-[#16a34a] text-[12px] rounded border border-[#16a34a]/10">
              正常
            </span>
          );
        }
        if (v === 'deficit' || v === 'damaged') {
          return (
            <span className="px-2 py-1 bg-[#ffdad6]/50 text-[#ba1a1a] text-[12px] rounded border border-[#ba1a1a]/10">
              异常
            </span>
          );
        }
        return (
          <span className="px-2 py-1 bg-[#dcfce7]/50 text-[#16a34a] text-[12px] rounded border border-[#16a34a]/10">
            {v === 'surplus' ? '盘盈' : '正常'}
          </span>
        );
      },
    },
    {
      key: 'confirmedBy',
      title: '盘点人',
      width: 100,
      render: (v) => <span className="text-[13px] text-[#161c27]">{String(v ?? '—')}</span>,
    },
    {
      key: 'confirmedAt',
      title: '盘点时间',
      width: 140,
      render: (v) => <span className="text-[13px] text-[#64748b]">{v ? String(v).substring(0, 16) : '—'}</span>,
    },
  ];

  if (taskLoading) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 max-w-[1440px] mx-auto w-full">
      <PageHeader
        title={task?.taskName ?? '盘点详情'}
        subtitle={`任务编号: ${taskId ?? '—'}`}
        breadcrumbs={[
          { label: '仪表板', href: '/dashboard' },
          { label: '资产盘点', href: '/inventory' },
          { label: '执行详情' },
        ]}
        actions={
          <div className="flex items-center gap-3">
            <Button variant="outline" size="md" onClick={() => navigate('/inventory')}>
              <Download className="w-4 h-4" /> 导出报告
            </Button>
            <Button variant="ghost" size="icon" onClick={() => navigate('/inventory')}>
              <ArrowLeft className="w-4 h-4" />
            </Button>
          </div>
        }
      />

      <div className="grid grid-cols-12 gap-6">
        <div className="col-span-12 lg:col-span-8 bg-white p-6 border border-[#e5e7eb] rounded-xl">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-base font-semibold text-[#161c27]">盘点进度实时监控</h3>
            <div className="flex gap-4">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-[#004191]" />
                <span className="text-[12px] text-[#64748b]">已完成</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-[#e9edfe]" />
                <span className="text-[12px] text-[#64748b]">剩余</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-12">
            <div className="relative w-40 h-40">
              <div
                className="w-full h-full rounded-full flex items-center justify-center"
                style={{ background: `conic-gradient(#004191 ${progressPct}%, #e9edfe 0)` }}
              >
                <div className="w-32 h-32 bg-white rounded-full flex flex-col items-center justify-center">
                  <span className="text-2xl font-bold text-[#161c27]">{progressPct.toFixed(0)}%</span>
                  <span className="text-[12px] text-[#64748b]">总完成率</span>
                </div>
              </div>
            </div>
            <div className="flex-1 grid grid-cols-3 gap-6">
              <div className="p-4 bg-[#f1f3ff] rounded-lg border border-[#e5e7eb]/50">
                <p className="text-[10px] text-[#64748b] uppercase mb-2 tracking-wider">已盘 / 总数</p>
                <p className="text-2xl font-bold text-[#161c27]">
                  {countedAssets}
                  <span className="text-base font-normal text-[#727784]"> / {totalAssets.toLocaleString()}</span>
                </p>
                <div className="w-full bg-[#e9edfe] mt-3 h-1.5 rounded-full overflow-hidden">
                  <div className="bg-[#004191] h-full" style={{ width: `${progressPct}%` }} />
                </div>
              </div>
              <div className="p-4 bg-[#dcfce7]/30 rounded-lg border border-[#dcfce7]/50">
                <p className="text-[10px] text-[#16a34a] uppercase mb-2 tracking-wider">正常状态</p>
                <p className="text-2xl font-bold text-[#16a34a]">{normalCount}</p>
                <div className="flex items-center gap-1 mt-2 text-[12px] text-[#16a34a]">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>验证通过</span>
                </div>
              </div>
              <div className="p-4 bg-[#ffdad6]/30 rounded-lg border border-[#ffdad6]/50">
                <p className="text-[10px] text-[#ba1a1a] uppercase mb-2 tracking-wider">异常发现</p>
                <p className="text-2xl font-bold text-[#ba1a1a]">{abnormalCount}</p>
                <div className="flex items-center gap-1 mt-2 text-[12px] text-[#ba1a1a]">
                  <AlertTriangle className="w-4 h-4" />
                  <span>需要人工核查</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="col-span-12 lg:col-span-4 bg-white p-6 border border-[#e5e7eb] rounded-xl">
          <h3 className="text-base font-semibold text-[#161c27] mb-6">盘点范围</h3>
          <div className="space-y-6">
            <div>
              <p className="text-[10px] text-[#64748b] uppercase mb-3 flex items-center gap-2 tracking-wider">
                <Building2 className="w-3.5 h-3.5" /> 责任部门
              </p>
              <div className="flex flex-wrap gap-2">
                {['IT运维部', '生产部', '人力资源部'].map((dept) => (
                  <span
                    key={dept}
                    className="px-3 py-1 bg-[#d4e0f9] text-[#576378] text-[12px] rounded-full"
                  >
                    {dept}
                  </span>
                ))}
              </div>
            </div>
            <div className="pt-4 border-t border-[#e5e7eb]">
              <p className="text-[10px] text-[#64748b] uppercase mb-3 flex items-center gap-2 tracking-wider">
                <MapPin className="w-3.5 h-3.5" /> 关键点位
              </p>
              <ul className="space-y-3">
                {[
                  { name: 'B-12区', loc: '仓库A' },
                  { name: '3楼', loc: '总部大楼' },
                  { name: '机房 S-4', loc: '数据中心' },
                ].map(({ name, loc }) => (
                  <li key={name} className="flex items-center justify-between text-[13px] text-[#161c27]">
                    <span className="flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#004191]" />
                      {name}
                    </span>
                    <span className="text-[#64748b] text-[12px]">{loc}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </div>

      {selected.size > 0 && (
        <div className="flex items-center gap-3 p-3 bg-blue-50 rounded-lg border border-blue-200">
          <span className="text-sm text-blue-700 font-medium">已选 {selected.size} 条</span>
          <div className="w-40">
            <StatusSelect value={batchStatus} onChange={setBatchStatus} />
          </div>
          <Button size="md" loading={batchConfirmMutation.isPending} onClick={() => batchConfirmMutation.mutate()}>
            批量确认
          </Button>
          <Button variant="ghost" size="md" onClick={() => setSelected(new Set())}>
            取消选择
          </Button>
        </div>
      )}

      <Card>
        <div className="p-6 border-b border-[#e5e7eb] flex items-center justify-between">
          <div className="flex items-center gap-4">
            <h3 className="text-base font-semibold text-[#161c27]">资产明细表</h3>
            <div className="flex gap-1">
              {[
                { key: 'all', label: `全部 (${totalAssets.toLocaleString()})` },
                { key: 'pending', label: `待盘 (${totalAssets - countedAssets})` },
                { key: 'counted', label: `已盘 (${countedAssets})` },
                { key: 'abnormal', label: `异常 (${abnormalCount})` },
              ].map(({ key, label }) => (
                <button
                  key={key}
                  onClick={() => setActiveTab(key)}
                  className={`px-3 py-1 text-[13px] rounded transition-colors ${
                    activeTab === key
                      ? 'bg-[#004191] text-white'
                      : key === 'abnormal'
                      ? 'text-[#ba1a1a] hover:bg-[#f1f3ff]'
                      : 'text-[#64748b] hover:bg-[#e9edfe]'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="ghost" size="icon"><Filter className="w-4 h-4" /></Button>
            <Button variant="ghost" size="icon"><Columns3 className="w-4 h-4" /></Button>
          </div>
        </div>
        <CardContent className="p-0">
          <DataTable
            columns={columns}
            data={records}
            loading={assetsLoading}
            rowKey="assetId"
            pagination={{
              page: assetParams.page,
              pageSize: assetParams.pageSize,
              total,
              onChange: (page, pageSize) => setAssetParams({ page, pageSize }),
            }}
            emptyText="暂无盘点资产"
          />
        </CardContent>
      </Card>

      <div className="bg-[#e9edfe] p-6 rounded-xl border border-[#e5e7eb] flex items-center justify-between">
        <div className="flex items-center gap-6">
          <div className="flex flex-col">
            <span className="text-[10px] text-[#64748b] uppercase tracking-wider">最后更新</span>
            <span className="text-[13px] font-semibold">{task?.updatedAt ?? '—'}</span>
          </div>
          <div className="h-10 w-px bg-[#e5e7eb]" />
          <div className="flex flex-col">
            <span className="text-[10px] text-[#64748b] uppercase tracking-wider">当前盘点人</span>
            <span className="text-[13px] text-[#161c27]">{task?.assigneeName ?? '—'} 等人正在作业</span>
          </div>
        </div>
        <div className="flex gap-6">
          <Button variant="outline" size="md">保存草稿</Button>
          <Button
            size="md"
            loading={submitMutation.isPending}
            disabled={!canSubmit || task?.status === 'submitted'}
            onClick={() => submitMutation.mutate()}
          >
            <Send className="w-4 h-4" /> 提交盘点审核
          </Button>
        </div>
      </div>
    </div>
  );
}
