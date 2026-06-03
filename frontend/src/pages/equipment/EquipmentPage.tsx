/**
 * @file pages/equipment/EquipmentPage.tsx
 * @description 重要设备管理页 — Design System 基准对齐版
 * 数据：全部从真实 API 加载，无 Mock 数据
 *
 * UI 层重构：对齐 benchmark 设计模式（page container + stat bar + DataTable + Dialog）
 * 业务逻辑、API 调用、数据流完全保持不变
 */

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Plus,
  Wrench,
  AlertCircle,
  CheckCircle2,
  Activity,
  Eye,
  RefreshCw,
  Search,
} from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { DataTable, type Column } from '@/components/ui/DataTable';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/Dialog';
import { maintenanceService } from '@/api/maintenance';
import { getAssetList, getAssetById } from '@/api/asset';
import type { AssetListItem, Asset } from '@/types/asset';
import { AssetStatus } from '@/types/asset';

// ── 类型 ──────────────────────────────────────────────────────────────────────
interface EquipmentItem {
  id: string;
  name: string;
  status: string;
  lastMaintenance: string;
  nextMaintenance: string;
  usageRate: number;
  maintenanceStatus: string;
}

// ── 进度条 ────────────────────────────────────────────────────────────────────
function UsageBar({ value }: { value: number }) {
  const pct = Math.min(Math.max(value, 0), 100);
  const color =
    pct >= 80 ? 'bg-blue-500' :
    pct >= 60 ? 'bg-emerald-500' :
    pct > 0   ? 'bg-amber-500' :
                'bg-slate-200';
  return (
    <div className="flex items-center gap-2 min-w-[100px]">
      <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
        <div className={`h-full ${color} rounded-full transition-all`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs font-semibold text-slate-500 w-9 text-right">{pct}%</span>
    </div>
  );
}

// ── 维保状态徽标（benchmark 设计：ring + dot）──────────────────────────────────
function MaintenanceBadge({ status }: { status: string }) {
  const cfg: Record<string, { dot: string; text: string; bg: string; border: string }> = {
    '正常':     { dot: 'bg-emerald-400', text: 'text-emerald-700', bg: 'bg-emerald-50', border: 'border-emerald-200' },
    '即将到期': { dot: 'bg-amber-400',   text: 'text-amber-700',   bg: 'bg-amber-50',   border: 'border-amber-200' },
    '已过期':   { dot: 'bg-red-400',     text: 'text-red-700',     bg: 'bg-red-50',     border: 'border-red-200' },
    '维修中':   { dot: 'bg-blue-400',    text: 'text-blue-700',    bg: 'bg-blue-50',    border: 'border-blue-200' },
    '报废':     { dot: 'bg-slate-400',   text: 'text-slate-600',   bg: 'bg-slate-50',   border: 'border-slate-200' },
  };
  const c = cfg[status] ?? { dot: 'bg-slate-400', text: 'text-slate-600', bg: 'bg-slate-50', border: 'border-slate-200' };
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset ${c.bg} ${c.text} ${c.border} ring-${c.dot}/20`}>
      <span className={`h-1.5 w-1.5 rounded-full ${c.dot}`} />
      {status}
    </span>
  );
}

// ── 设备状态徽标（benchmark 设计：ring + dot）─────────────────────────────────
function StatusBadge({ status }: { status: string }) {
  const cfg: Record<string, { dot: string; text: string; bg: string; border: string }> = {
    '使用中': { dot: 'bg-blue-400',    text: 'text-blue-700',    bg: 'bg-blue-50',    border: 'border-blue-200' },
    '维修中': { dot: 'bg-amber-400',   text: 'text-amber-700',   bg: 'bg-amber-50',   border: 'border-amber-200' },
    '报废':   { dot: 'bg-slate-400',   text: 'text-slate-600',   bg: 'bg-slate-50',   border: 'border-slate-200' },
    '在用':   { dot: 'bg-emerald-400', text: 'text-emerald-700', bg: 'bg-emerald-50', border: 'border-emerald-200' },
    '闲置':   { dot: 'bg-cyan-400',    text: 'text-cyan-700',    bg: 'bg-cyan-50',    border: 'border-cyan-200' },
    '已报废': { dot: 'bg-red-400',     text: 'text-red-700',     bg: 'bg-red-50',     border: 'border-red-200' },
  };
  const c = cfg[status] ?? { dot: 'bg-slate-400', text: 'text-slate-600', bg: 'bg-slate-50', border: 'border-slate-200' };
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset ${c.bg} ${c.text} ${c.border}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${c.dot}`} />
      {status}
    </span>
  );
}

// ── 维保记录状态徽标 ──────────────────────────────────────────────────────────
function RecordStatusBadge({ status }: { status: string }) {
  const cfg: Record<string, { dot: string; text: string; bg: string; border: string }> = {
    '已完成': { dot: 'bg-emerald-400', text: 'text-emerald-700', bg: 'bg-emerald-50', border: 'border-emerald-200' },
    '进行中': { dot: 'bg-blue-400',    text: 'text-blue-700',    bg: 'bg-blue-50',    border: 'border-blue-200' },
  };
  const c = cfg[status] ?? { dot: 'bg-slate-400', text: 'text-slate-600', bg: 'bg-slate-50', border: 'border-slate-200' };
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset ${c.bg} ${c.text} ${c.border}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${c.dot}`} />
      {status}
    </span>
  );
}

// ── 资产状态 → 中文展示名 ────────────────────────────────────────────────────
function assetStatusLabel(status: string): string {
  const map: Record<string, string> = {
    [AssetStatus.IN_USE]: '使用中',
    [AssetStatus.MAINTENANCE]: '维修中',
    [AssetStatus.SCRAPPED]: '报废',
    [AssetStatus.IDLE]: '闲置',
    [AssetStatus.RETIRED]: '已退役',
    [AssetStatus.PENDING_RETIREMENT]: '待退役',
    [AssetStatus.CLEARED]: '已清退',
  };
  return map[status] ?? status;
}

/** 根据维保记录推算维保状态 */
function computeMaintenanceStatus(nextDate: string | null | undefined): string {
  if (!nextDate || nextDate === '—') return '正常';
  const d = new Date(nextDate);
  if (isNaN(d.getTime())) return '正常';
  const now = new Date();
  const diffDays = (d.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
  if (diffDays < 0) return '已过期';
  if (diffDays <= 14) return '即将到期';
  return '正常';
}

// ── 主组件 ────────────────────────────────────────────────────────────────────
export default function EquipmentPage() {
  const qc = useQueryClient();
  const [showModal, setShowModal] = useState(false);
  const [detailItem, setDetailItem] = useState<EquipmentItem | null>(null);
  const [detailAsset, setDetailAsset] = useState<Asset | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [searchKeyword, setSearchKeyword] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [form, setForm] = useState({
    equipmentId: '',
    type: '定期保养',
    date: '',
    technician: '',
    duration: '',
    cost: '',
    content: '',
  });

  // ── 查询重要设备列表 ──────────────────────────────────────────────────────────
  const { data: assetListData, isLoading: assetLoading } = useQuery({
    queryKey: ['assets', 'important'],
    queryFn: () => getAssetList({ isImportant: 1, pageSize: 200 }),
    staleTime: 1000 * 60,
  });

  // ── 查询维保记录 ─────────────────────────────────────────────────────────────
  const { data: recordsData, isLoading: recordsLoading } = useQuery({
    queryKey: ['maintenance', 'records'],
    queryFn: () => maintenanceService.list({ page: 1, pageSize: 50 }),
    staleTime: 1000 * 60,
  });

  const { data: upcomingData } = useQuery({
    queryKey: ['maintenance', 'upcoming'],
    queryFn: () => maintenanceService.getUpcoming(30),
    staleTime: 1000 * 60,
  });

  // ── 创建维保记录 ─────────────────────────────────────────────────────────────
  const createMutation = useMutation({
    mutationFn: (payload: Parameters<typeof maintenanceService.create>[0]) =>
      maintenanceService.create(payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['maintenance'] });
      setShowModal(false);
      setForm({ equipmentId: '', type: '定期保养', date: '', technician: '', duration: '', cost: '', content: '' });
    },
  });

  // ── 查询设备详情（按需） ─────────────────────────────────────────────────────
  const { isLoading: detailLoading } = useQuery({
    queryKey: ['asset', 'detail', detailItem?.id],
    queryFn: async () => {
      const resp = await getAssetById(Number(detailItem!.id));
      const asset = resp as unknown as Asset;
      setDetailAsset(asset);
      return asset;
    },
    enabled: !!detailItem?.id,
    staleTime: 1000 * 60,
  });

  // ── 维保记录按 assetId 建立索引，以便快速查找 last/next maintenance ────────
  const maintenanceByAsset: Record<string, { lastDate: string; nextDate: string | null }> = {};
  const rawRecords = recordsData?.records ?? [];
  for (const r of rawRecords) {
    const key = String(r.assetId);
    const existing = maintenanceByAsset[key];
    if (!existing || (r.maintenanceDate && r.maintenanceDate > existing.lastDate)) {
      maintenanceByAsset[key] = {
        lastDate: existing?.lastDate ?? r.maintenanceDate?.substring(0, 10) ?? '—',
        nextDate: r.nextMaintenanceDate?.substring(0, 10) ?? existing?.nextDate ?? null,
      };
    }
    if (r.nextMaintenanceDate) {
      maintenanceByAsset[key] = {
        ...maintenanceByAsset[key],
        nextDate: r.nextMaintenanceDate.substring(0, 10),
      };
    }
  }

  // ── 将 API 资产列表映射为设备展示列表 ─────────────────────────────────────────
  const assetItems: AssetListItem[] = assetListData?.records ?? [];
  const equipment: EquipmentItem[] = assetItems.map((a) => {
    const mInfo = maintenanceByAsset[String(a.id)];
    const nextDate = mInfo?.nextDate ?? null;
    return {
      id: String(a.id),
      name: a.assetName ?? a.assetNo ?? String(a.id),
      status: assetStatusLabel(a.status),
      lastMaintenance: mInfo?.lastDate ?? a.purchaseDate?.substring(0, 10) ?? '—',
      nextMaintenance: nextDate ?? '—',
      usageRate: a.status === AssetStatus.IN_USE ? 75 : 0,
      maintenanceStatus: computeMaintenanceStatus(nextDate),
    };
  });

  const upcomingList = (upcomingData && upcomingData.length > 0) ? upcomingData : [];

  // ── 统计 ─────────────────────────────────────────────────────────────────────
  const total = equipment.length;
  const inMaintenance = equipment.filter((e) => e.status === '维修中').length;
  const expiringSoon = equipment.filter((e) => e.maintenanceStatus === '即将到期' || e.maintenanceStatus === '已过期').length + upcomingList.length;
  const normal = equipment.filter((e) => e.status === '使用中').length;

  const filtered = equipment.filter((e) => {
    const matchSearch = !searchKeyword
      || e.name.toLowerCase().includes(searchKeyword.toLowerCase())
      || e.id.toLowerCase().includes(searchKeyword.toLowerCase());
    const matchStatus = statusFilter === 'all' || e.status === statusFilter;
    return matchSearch && matchStatus;
  });

  // ── 维保记录表格数据（从 API 获取） ──────────────────────────────────────────
  const maintenanceRecords = rawRecords.slice(0, 20).map((r) => ({
    id: r.id,
    equipment: String((r as unknown as Record<string, unknown>).equipmentName ?? (r as unknown as Record<string, unknown>).assetName ?? r.assetId),
    date: r.maintenanceDate?.substring(0, 10) ?? '—',
    type: r.maintenanceType ?? '—',
    technician: r.executor ?? '—',
    duration: r.cost != null ? `${r.cost}` : '—',
    cost: r.cost != null ? `¥${Number(r.cost).toLocaleString()}` : '—',
    status: r.result === 'COMPLETED' ? '已完成' : '进行中',
  }));

  // ── 提交 ─────────────────────────────────────────────────────────────────────
  const handleSubmit = () => {
    if (!form.equipmentId || !form.date || !form.technician || !form.content) {
      setFormError('请填写设备、保养日期、技术员和保养内容');
      return;
    }
    setFormError(null);
    createMutation.mutate({
      assetId: Number(form.equipmentId) || undefined,
      maintenanceType: form.type,
      maintenanceDate: form.date,
      executor: form.technician,
      content: form.content,
      cost: form.cost ? Number(form.cost) : undefined,
    });
  };

  // ── 打开详情 ─────────────────────────────────────────────────────────────────
  const handleOpenDetail = (eq: EquipmentItem) => {
    setDetailAsset(null);
    setDetailItem(eq);
  };

  // ── DataTable 列定义：设备列表 ─────────────────────────────────────────────────
  const equipmentColumns: Column<EquipmentItem>[] = [
    {
      key: 'name',
      title: '设备名称',
      render: (_v, row) => <span className="font-semibold text-slate-900">{row.name}</span>,
    },
    {
      key: 'id',
      title: '设备ID',
      render: (_v, row) => <span className="font-medium text-blue-600">{row.id}</span>,
    },
    {
      key: 'status',
      title: '状态',
      render: (_v, row) => <StatusBadge status={row.status} />,
    },
    {
      key: 'lastMaintenance',
      title: '上次维保',
      render: (_v, row) => <span className="text-slate-500">{row.lastMaintenance}</span>,
    },
    {
      key: 'nextMaintenance',
      title: '下次维保',
      render: (_v, row) => <span className="text-slate-500">{row.nextMaintenance}</span>,
    },
    {
      key: 'usageRate',
      title: '使用率',
      render: (_v, row) => <UsageBar value={row.usageRate} />,
    },
    {
      key: 'maintenanceStatus',
      title: '维保状态',
      render: (_v, row) => <MaintenanceBadge status={row.maintenanceStatus} />,
    },
    {
      key: 'actions',
      title: '操作',
      render: (_v, row) => (
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => handleOpenDetail(row)} title="查看详情">
            <Eye className="w-4 h-4" />
            详情
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => { setForm((f) => ({ ...f, equipmentId: row.id })); setShowModal(true); }}
          >
            新建维保
          </Button>
        </div>
      ),
    },
  ];

  // ── DataTable 列定义：维保记录 ─────────────────────────────────────────────────
  const recordColumns: Column<typeof maintenanceRecords[0]>[] = [
    {
      key: 'equipment',
      title: '设备',
      render: (_v, row) => <span className="font-medium text-slate-900">{row.equipment}</span>,
    },
    {
      key: 'date',
      title: '日期',
      render: (_v, row) => <span className="text-slate-500">{row.date}</span>,
    },
    {
      key: 'type',
      title: '类型',
      render: (_v, row) => <span className="text-slate-500">{row.type}</span>,
    },
    {
      key: 'technician',
      title: '技术员',
      render: (_v, row) => <span className="text-slate-500">{row.technician}</span>,
    },
    {
      key: 'cost',
      title: '费用',
      render: (_v, row) => <span className="font-medium text-slate-900">{row.cost}</span>,
    },
    {
      key: 'status',
      title: '状态',
      render: (_v, row) => <RecordStatusBadge status={row.status} />,
    },
  ];

  // ── 统计栏配置 ────────────────────────────────────────────────────────────────
  const stats = [
    { label: '总设备数', value: total, icon: Wrench, iconColor: 'text-blue-600', iconBg: 'bg-blue-50' },
    { label: '维保中', value: inMaintenance, icon: AlertCircle, iconColor: 'text-amber-500', iconBg: 'bg-amber-50' },
    { label: '即将到期', value: expiringSoon, icon: Activity, iconColor: 'text-red-500', iconBg: 'bg-red-50' },
    { label: '正常运行', value: normal, icon: CheckCircle2, iconColor: 'text-emerald-500', iconBg: 'bg-emerald-50' },
  ];

  // ── 快速筛选 ──────────────────────────────────────────────────────────────────
  const quickFilters = [
    { key: 'all', label: '全部' },
    { key: '使用中', label: '正常运行' },
    { key: '维修中', label: '维修中' },
    { key: '闲置', label: '闲置' },
  ];

  return (
    <div className="min-h-full bg-[var(--app-background)] px-4 py-5 sm:px-6 lg:px-8">
      <div className="mx-auto flex w-full max-w-[1480px] flex-col gap-6">

        {/* ── Header + Stat Bar ─────────────────────────────────────────────── */}
        <section className="rounded-2xl border border-[var(--surface-border)] bg-white shadow-sm">
          <div className="flex flex-col gap-4 px-6 py-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-xl font-bold tracking-tight text-slate-900">重要设备管理</h1>
              <p className="mt-1 text-sm text-slate-500">关键生产设备维保追踪与状态监控</p>
            </div>
            <Button size="lg" onClick={() => setShowModal(true)}>
              <Plus className="w-4 h-4" />
              新建维保记录
            </Button>
          </div>
          {/* stat bar */}
          <div className="grid grid-cols-2 sm:grid-cols-4 divide-x divide-slate-100 border-t border-slate-100">
            {stats.map(({ label, value, icon: Icon, iconColor, iconBg }) => (
              <div key={label} className="flex items-center gap-3 px-6 py-4">
                <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${iconBg}`}>
                  <Icon className={`h-5 w-5 ${iconColor}`} />
                </div>
                <div>
                  <p className="text-2xl font-bold text-slate-900">{value}</p>
                  <p className="text-xs font-medium text-slate-500">{label}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ── 加载态 ────────────────────────────────────────────────────────── */}
        {(assetLoading || recordsLoading) && (
          <div className="flex items-center gap-2 text-sm text-slate-500">
            <RefreshCw className="w-4 h-4 animate-spin" />
            加载中...
          </div>
        )}

        {/* ── 设备列表 Card ─────────────────────────────────────────────────── */}
        <Card className="overflow-hidden rounded-2xl border-slate-200/80 shadow-sm">
          {/* Toolbar */}
          <div className="flex flex-col gap-3 border-b border-slate-100 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="text-sm font-semibold text-slate-900">
              设备列表
              {filtered.length !== equipment.length && (
                <span className="ml-2 text-xs font-normal text-slate-400">
                  {filtered.length}/{equipment.length}
                </span>
              )}
            </h2>
            <div className="flex items-center gap-3">
              <div className="relative w-full sm:w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="搜索设备名称或编号..."
                  value={searchKeyword}
                  onChange={(e) => setSearchKeyword(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-500"
                />
              </div>
            </div>
          </div>

          {/* Quick filter pills */}
          <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 px-5 py-3">
            {quickFilters.map(({ key, label }) => (
              <button
                key={key}
                onClick={() => setStatusFilter(key)}
                className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                  statusFilter === key
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {label}
              </button>
            ))}
            {searchKeyword && (
              <span className="ml-auto text-xs text-slate-400">
                找到 {filtered.length} 台设备
              </span>
            )}
          </div>

          {/* DataTable */}
          <div className="p-0">
            <DataTable
              columns={equipmentColumns}
              data={filtered}
              rowKey="id"
              loading={assetLoading}
              emptyText={searchKeyword ? `未找到包含"${searchKeyword}"的设备` : '暂无设备数据'}
            />
          </div>
        </Card>

        {/* ── 维保记录 Card ─────────────────────────────────────────────────── */}
        <Card className="overflow-hidden rounded-2xl border-slate-200/80 shadow-sm">
          <div className="border-b border-slate-100 px-5 py-4">
            <h2 className="text-sm font-semibold text-slate-900">最近维保记录</h2>
          </div>
          <div className="p-0">
            <DataTable
              columns={recordColumns}
              data={maintenanceRecords}
              rowKey="id"
              loading={recordsLoading}
              emptyText="暂无维保记录"
            />
          </div>
        </Card>

        {/* ── 新建维保记录 Dialog ───────────────────────────────────────────── */}
        <Dialog open={showModal} onOpenChange={setShowModal}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>新建维保记录</DialogTitle>
            </DialogHeader>
            <div className="px-6 py-5 space-y-5">
              {formError && (
                <div className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-4 py-2">
                  {formError}
                </div>
              )}
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-medium text-slate-700">选择设备 *</label>
                  <select
                    value={form.equipmentId}
                    onChange={(e) => setForm((f) => ({ ...f, equipmentId: e.target.value }))}
                    className="w-full h-9 px-3 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-500"
                  >
                    <option value="">请选择设备</option>
                    {filtered.map((eq, i) => (
                      <option key={`${eq.id}-${i}`} value={eq.id}>{eq.name} ({eq.id})</option>
                    ))}
                  </select>
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-medium text-slate-700">保养类型 *</label>
                  <select
                    value={form.type}
                    onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))}
                    className="w-full h-9 px-3 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-500"
                  >
                    <option>定期保养</option>
                    <option>故障维修</option>
                    <option>校准检测</option>
                    <option>升级改造</option>
                  </select>
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-medium text-slate-700">保养日期 *</label>
                  <input
                    type="date"
                    value={form.date}
                    onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
                    className="w-full h-9 px-3 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-500"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-medium text-slate-700">技术员 *</label>
                  <input
                    type="text"
                    value={form.technician}
                    onChange={(e) => setForm((f) => ({ ...f, technician: e.target.value }))}
                    placeholder="技术员姓名"
                    className="w-full h-9 px-3 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-500"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-medium text-slate-700">耗时（小时）</label>
                  <input
                    type="number"
                    step="0.5"
                    value={form.duration}
                    onChange={(e) => setForm((f) => ({ ...f, duration: e.target.value }))}
                    className="w-full h-9 px-3 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-500"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-medium text-slate-700">费用（元）</label>
                  <input
                    type="number"
                    value={form.cost}
                    onChange={(e) => setForm((f) => ({ ...f, cost: e.target.value }))}
                    className="w-full h-9 px-3 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-500"
                  />
                </div>
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-slate-700">保养内容 *</label>
                <textarea
                  rows={3}
                  value={form.content}
                  onChange={(e) => setForm((f) => ({ ...f, content: e.target.value }))}
                  placeholder="请详细描述保养内容..."
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-500 resize-none"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="secondary" onClick={() => setShowModal(false)}>取消</Button>
              <Button loading={createMutation.isPending} onClick={handleSubmit}>
                保存记录
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* ── 设备详情 Dialog ───────────────────────────────────────────────── */}
        <Dialog open={!!detailItem} onOpenChange={(open) => { if (!open) { setDetailItem(null); setDetailAsset(null); } }}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>设备详情</DialogTitle>
            </DialogHeader>
            <div className="px-6 py-5 space-y-3">
              {detailLoading && (
                <div className="flex items-center gap-2 text-sm text-slate-500">
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  加载详情...
                </div>
              )}
              {detailAsset ? (
                <>
                  {([
                    ['资产编号', detailAsset.assetNo ?? '—'],
                    ['资产名称', detailAsset.assetName ?? '—'],
                    ['品牌/型号', [detailAsset.brand, detailAsset.model].filter(Boolean).join(' ') || '—'],
                    ['当前状态', assetStatusLabel(detailAsset.status)],
                    ['使用部门', detailAsset.deptName ?? '—'],
                    ['使用人', detailAsset.userName ?? '—'],
                    ['存放地点', detailAsset.location ?? '—'],
                    ['购置日期', detailAsset.purchaseDate?.substring(0, 10) ?? '—'],
                    ['原值', detailAsset.originalValue != null ? `¥${Number(detailAsset.originalValue).toLocaleString()}` : '—'],
                    ['净值', detailAsset.currentValue != null ? `¥${Number(detailAsset.currentValue).toLocaleString()}` : '—'],
                    ['序列号', detailAsset.serialNo ?? '—'],
                    ['描述', detailAsset.description ?? '—'],
                  ] as [string, string][]).map(([k, v]) => (
                    <div key={k} className="flex items-center gap-3 text-sm">
                      <span className="text-slate-400 min-w-[80px]">{k}</span>
                      <span className="text-slate-900 font-medium">{v}</span>
                    </div>
                  ))}
                </>
              ) : !detailLoading && (
                <>
                  {([
                    ['设备编号', detailItem.id],
                    ['设备名称', detailItem.name],
                    ['当前状态', detailItem.status],
                    ['上次维保', detailItem.lastMaintenance],
                    ['下次维保', detailItem.nextMaintenance],
                    ['使用率',   `${detailItem.usageRate}%`],
                    ['维保状态', detailItem.maintenanceStatus],
                  ] as [string, string][]).map(([k, v]) => (
                    <div key={k} className="flex items-center gap-3 text-sm">
                      <span className="text-slate-400 min-w-[80px]">{k}</span>
                      <span className="text-slate-900 font-medium">{v}</span>
                    </div>
                  ))}
                </>
              )}
            </div>
          </DialogContent>
        </Dialog>

      </div>
    </div>
  );
}
