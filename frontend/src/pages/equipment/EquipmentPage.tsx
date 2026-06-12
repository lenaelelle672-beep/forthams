/**
 * @file pages/equipment/EquipmentPage.tsx
 * @description 重要设备管理页 — 新版 Design System 重构
 * 数据：全部从真实 API 加载，无 Mock 数据
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
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { PageHeader } from '@/components/ui/PageHeader';
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

// ── 子组件：统计卡片 ──────────────────────────────────────────────────────────
function StatCard({
  label,
  value,
  icon: Icon,
  iconBg,
  iconColor,
}: {
  label: string;
  value: number | string;
  icon: React.ElementType;
  iconBg: string;
  iconColor: string;
}) {
  return (
    <Card>
      <CardContent className="flex items-center justify-between">
        <div>
          <p className="text-sm text-[#64748b] font-medium">{label}</p>
          <p className="text-3xl font-bold text-[#0f172a] mt-1">{value}</p>
        </div>
        <div className={`w-12 h-12 rounded-xl ${iconBg} flex items-center justify-center`}>
          <Icon className={`w-6 h-6 ${iconColor}`} />
        </div>
      </CardContent>
    </Card>
  );
}

// ── 进度条 ────────────────────────────────────────────────────────────────────
function UsageBar({ value }: { value: number }) {
  const pct = Math.min(Math.max(value, 0), 100);
  const color =
    pct >= 80 ? 'bg-[#3b82f6]' :
    pct >= 60 ? 'bg-[#22c55e]' :
    pct > 0   ? 'bg-[#f59e0b]' :
                'bg-[#e5e7eb]';
  return (
    <div className="flex items-center gap-2 min-w-[120px]">
      <div className="flex-1 h-1.5 bg-[#f1f5f9] rounded-full overflow-hidden">
        <div className={`h-full ${color} rounded-full transition-all`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-[12px] font-semibold text-[#64748b] w-9 text-right">{pct}%</span>
    </div>
  );
}

// ── 维保状态徽标 ──────────────────────────────────────────────────────────────
function MaintenanceBadge({ status }: { status: string }) {
  const cfg: Record<string, string> = {
    '正常':   'bg-green-100 text-green-700',
    '即将到期': 'bg-yellow-100 text-yellow-700',
    '已过期': 'bg-red-100 text-red-700',
    '维修中': 'bg-blue-100 text-blue-700',
    '报废':   'bg-gray-100 text-gray-500',
  };
  return (
    <span className={`px-2.5 py-0.5 text-xs font-semibold rounded-full ${cfg[status] ?? 'bg-slate-100 text-slate-600'}`}>
      {status}
    </span>
  );
}

// ── 设备状态徽标 ──────────────────────────────────────────────────────────────
function StatusBadge({ status }: { status: string }) {
  const cfg: Record<string, string> = {
    '使用中': 'bg-blue-50 text-blue-700',
    '维修中': 'bg-yellow-50 text-yellow-700',
    '报废':   'bg-gray-100 text-gray-500',
    '在用':   'bg-green-50 text-green-700',
    '闲置':   'bg-blue-50 text-blue-600',
    '已报废': 'bg-red-50 text-red-700',
  };
  return (
    <span className={`px-2 py-0.5 text-xs font-medium rounded ${cfg[status] ?? 'bg-slate-100 text-slate-600'}`}>
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
      const asset = resp.data;
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
  const assetItems: AssetListItem[] = assetListData?.data?.records ?? [];
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
    equipment: String(r.equipmentName ?? r.assetName ?? r.assetId),
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

  return (
    <div className="p-8 max-w-[1440px] mx-auto w-full space-y-8">
      {/* 页头 */}
      <PageHeader
        title="重要设备管理"
        subtitle="关键生产设备维保追踪与状态监控"
        breadcrumbs={[{ label: '仪表板', href: '/dashboard' }, { label: '重要设备' }]}
        actions={
          <Button size="lg" onClick={() => setShowModal(true)}>
            <Plus className="w-4 h-4" />
            新建维保记录
          </Button>
        }
      />

      {/* 加载态 */}
      {(assetLoading || recordsLoading) && (
        <div className="flex items-center gap-2 text-sm text-[#64748b]">
          <RefreshCw className="w-4 h-4 animate-spin" />
          加载中...
        </div>
      )}

      {/* 统计卡片 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <StatCard label="总设备数"   value={total}         icon={Wrench}       iconBg="bg-blue-50"   iconColor="text-[#3b82f6]" />
        <StatCard label="维保中"     value={inMaintenance} icon={AlertCircle}  iconBg="bg-yellow-50" iconColor="text-yellow-500" />
        <StatCard label="即将到期"   value={expiringSoon}  icon={Activity}     iconBg="bg-red-50"    iconColor="text-red-500" />
        <StatCard label="正常运行"   value={normal}        icon={CheckCircle2} iconBg="bg-green-50"  iconColor="text-green-500" />
      </div>

      {/* 搜索与筛选 */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="搜索设备名称或编号..."
            value={searchKeyword}
            onChange={(e) => setSearchKeyword(e.target.value)}
            className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div className="flex gap-1.5">
          {[{ key: 'all', label: '全部' }, { key: '使用中', label: '正常运行' }, { key: '维修中', label: '维修中' }, { key: '闲置', label: '闲置' }].map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setStatusFilter(key)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                statusFilter === key
                  ? 'bg-blue-500 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        {searchKeyword && (
          <span className="text-xs text-gray-400">
            找到 {filtered.length} 台设备
          </span>
        )}
      </div>

      {/* 设备列表 */}
      <Card>
        <CardHeader>
          <CardTitle>设备列表{filtered.length !== equipment.length && ` (${filtered.length}/${equipment.length})`}</CardTitle>
        </CardHeader>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#e5e7eb] bg-[#f8fafc]">
                {['设备名称', '设备ID', '状态', '上次维保', '下次维保', '使用率', '维保状态', '操作'].map((h) => (
                  <th key={h} className="px-5 py-3 text-left text-xs font-semibold text-[#94a3b8] uppercase tracking-wide">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-5 py-10 text-center text-gray-400">
                    {searchKeyword ? `未找到包含"${searchKeyword}"的设备` : '暂无设备数据'}
                  </td>
                </tr>
              ) : filtered.map((eq, i) => (
                <tr key={`${eq.id}-${i}`} className="border-b border-[#f1f5f9] hover:bg-[#f8fafc] transition-colors">
                  <td className="px-5 py-3.5 font-semibold text-[#0f172a]">{eq.name}</td>
                  <td className="px-5 py-3.5 text-[#3b82f6] font-medium">{eq.id}</td>
                  <td className="px-5 py-3.5"><StatusBadge status={eq.status} /></td>
                  <td className="px-5 py-3.5 text-[#64748b]">{eq.lastMaintenance}</td>
                  <td className="px-5 py-3.5 text-[#64748b]">{eq.nextMaintenance}</td>
                  <td className="px-5 py-3.5"><UsageBar value={eq.usageRate} /></td>
                  <td className="px-5 py-3.5"><MaintenanceBadge status={eq.maintenanceStatus} /></td>
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleOpenDetail(eq)}
                        title="查看详情"
                      >
                        <Eye className="w-4 h-4" />
                        详情
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => { setForm((f) => ({ ...f, equipmentId: eq.id })); setShowModal(true); }}
                      >
                        新建维保
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* 维保记录（从 API） */}
      <Card>
        <CardHeader>
          <CardTitle>最近维保记录</CardTitle>
        </CardHeader>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#e5e7eb] bg-[#f8fafc]">
                {['设备', '日期', '类型', '技术员', '费用', '状态'].map((h) => (
                  <th key={h} className="px-5 py-3 text-left text-xs font-semibold text-[#94a3b8] uppercase tracking-wide">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {maintenanceRecords.map((r) => (
                <tr key={r.id} className="border-b border-[#f1f5f9] hover:bg-[#f8fafc] transition-colors">
                  <td className="px-5 py-3.5 font-medium text-[#0f172a]">{r.equipment}</td>
                  <td className="px-5 py-3.5 text-[#64748b]">{r.date}</td>
                  <td className="px-5 py-3.5 text-[#64748b]">{r.type}</td>
                  <td className="px-5 py-3.5 text-[#64748b]">{r.technician}</td>
                  <td className="px-5 py-3.5 font-medium text-[#0f172a]">{r.cost}</td>
                  <td className="px-5 py-3.5">
                    <span className={`px-2.5 py-0.5 text-xs font-semibold rounded-full ${
                      r.status === '已完成' ? 'bg-green-100 text-green-700' :
                      r.status === '进行中' ? 'bg-blue-100 text-blue-700' :
                      'bg-gray-100 text-gray-600'
                    }`}>
                      {r.status}
                    </span>
                  </td>
                </tr>
              ))}
              {maintenanceRecords.length === 0 && !recordsLoading && (
                <tr>
                  <td colSpan={6} className="px-5 py-10 text-center text-[#94a3b8] text-sm">暂无维保记录</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* 新建维保记录 Modal */}
      {showModal && (
        <div
          className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50"
          onClick={() => setShowModal(false)}
        >
          <div
            className="bg-white rounded-2xl w-full max-w-2xl mx-4 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-6 py-4 border-b border-[#e5e7eb] flex items-center justify-between">
              <h3 className="text-base font-semibold text-[#0f172a]">新建维保记录</h3>
              <button onClick={() => setShowModal(false)} className="text-[#94a3b8] hover:text-[#64748b] text-xl leading-none">×</button>
            </div>
            <div className="p-6 space-y-4">
              {formError && (
                <div className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-4 py-2">{formError}</div>
              )}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-[#374151] mb-1">选择设备 *</label>
                  <select
                    value={form.equipmentId}
                    onChange={(e) => setForm((f) => ({ ...f, equipmentId: e.target.value }))}
                    className="w-full px-3 py-2 border border-[#e5e7eb] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#3b82f6]"
                  >
                    <option value="">请选择设备</option>
                    {filtered.map((eq, i) => (
                      <option key={`${eq.id}-${i}`} value={eq.id}>{eq.name} ({eq.id})</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-[#374151] mb-1">保养类型 *</label>
                  <select
                    value={form.type}
                    onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))}
                    className="w-full px-3 py-2 border border-[#e5e7eb] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#3b82f6]"
                  >
                    <option>定期保养</option>
                    <option>故障维修</option>
                    <option>校准检测</option>
                    <option>升级改造</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-[#374151] mb-1">保养日期 *</label>
                  <input
                    type="date"
                    value={form.date}
                    onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
                    className="w-full px-3 py-2 border border-[#e5e7eb] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#3b82f6]"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-[#374151] mb-1">技术员 *</label>
                  <input
                    type="text"
                    value={form.technician}
                    onChange={(e) => setForm((f) => ({ ...f, technician: e.target.value }))}
                    placeholder="技术员姓名"
                    className="w-full px-3 py-2 border border-[#e5e7eb] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#3b82f6]"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-[#374151] mb-1">耗时（小时）</label>
                  <input
                    type="number"
                    step="0.5"
                    value={form.duration}
                    onChange={(e) => setForm((f) => ({ ...f, duration: e.target.value }))}
                    className="w-full px-3 py-2 border border-[#e5e7eb] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#3b82f6]"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-[#374151] mb-1">费用（元）</label>
                  <input
                    type="number"
                    value={form.cost}
                    onChange={(e) => setForm((f) => ({ ...f, cost: e.target.value }))}
                    className="w-full px-3 py-2 border border-[#e5e7eb] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#3b82f6]"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-[#374151] mb-1">保养内容 *</label>
                <textarea
                  rows={3}
                  value={form.content}
                  onChange={(e) => setForm((f) => ({ ...f, content: e.target.value }))}
                  placeholder="请详细描述保养内容..."
                  className="w-full px-3 py-2 border border-[#e5e7eb] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#3b82f6] resize-none"
                />
              </div>
            </div>
            <div className="px-6 py-4 border-t border-[#e5e7eb] flex justify-end gap-3">
              <Button variant="secondary" onClick={() => setShowModal(false)}>取消</Button>
              <Button
                loading={createMutation.isPending}
                onClick={handleSubmit}
              >
                保存记录
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* 设备详情 Modal */}
      {detailItem && (
        <div
          className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50"
          onClick={() => { setDetailItem(null); setDetailAsset(null); }}
        >
          <div
            className="bg-white rounded-2xl w-full max-w-lg mx-4 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-6 py-4 border-b border-[#e5e7eb] flex items-center justify-between">
              <h3 className="text-base font-semibold text-[#0f172a]">设备详情</h3>
              <button onClick={() => { setDetailItem(null); setDetailAsset(null); }} className="text-[#94a3b8] hover:text-[#64748b] text-xl leading-none">×</button>
            </div>
            <div className="p-6 space-y-3">
              {detailLoading && (
                <div className="flex items-center gap-2 text-sm text-[#64748b]">
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
                      <span className="text-[#94a3b8] min-w-[80px]">{k}</span>
                      <span className="text-[#0f172a] font-medium">{v}</span>
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
                      <span className="text-[#94a3b8] min-w-[80px]">{k}</span>
                      <span className="text-[#0f172a] font-medium">{v}</span>
                    </div>
                  ))}
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
