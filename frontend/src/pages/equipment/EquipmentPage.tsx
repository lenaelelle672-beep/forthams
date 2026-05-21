/**
 * @file pages/equipment/EquipmentPage.tsx
 * @description 重要设备管理页 — 新版 Design System 重构
 * 数据：先尝试真实 API，失败则用 Mock 数据兜底
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
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { PageHeader } from '@/components/ui/PageHeader';
import { maintenanceService } from '@/app/services/maintenanceService';

// ── Mock 数据兜底 ──────────────────────────────────────────────────────────────
const MOCK_EQUIPMENT = [
  { id: 'CNC-05', name: 'CNC精密车床 X1',     status: '使用中', lastMaintenance: '2025-04-10', nextMaintenance: '2025-07-10', usageRate: 87, maintenanceStatus: '正常' },
  { id: 'LC-08',  name: '激光切割机 L-8000',  status: '使用中', lastMaintenance: '2025-03-22', nextMaintenance: '2025-06-22', usageRate: 92, maintenanceStatus: '即将到期' },
  { id: 'RB-12',  name: '工业机器人臂 RB-II',  status: '维修中', lastMaintenance: '2025-05-01', nextMaintenance: '2025-08-01', usageRate: 0,  maintenanceStatus: '维修中' },
  { id: 'HP-03',  name: '液压冲床 HP-3000',   status: '使用中', lastMaintenance: '2025-02-18', nextMaintenance: '2025-05-18', usageRate: 74, maintenanceStatus: '已过期' },
  { id: 'WL-07',  name: '精密焊接工作站 WS-7', status: '使用中', lastMaintenance: '2025-04-30', nextMaintenance: '2025-07-30', usageRate: 81, maintenanceStatus: '正常' },
  { id: 'CM-02',  name: '三坐标测量仪 CMM-2', status: '报废',   lastMaintenance: '2024-12-01', nextMaintenance: '—',          usageRate: 0,  maintenanceStatus: '报废' },
];

const MOCK_RECORDS = [
  { id: 1, equipment: 'CNC精密车床 X1', date: '2025-04-10', type: '定期保养', technician: '张技师', duration: '4h', cost: '¥1,200', status: '已完成' },
  { id: 2, equipment: '激光切割机 L-8000', date: '2025-03-22', type: '校准检测', technician: '李工', duration: '2h', cost: '¥800', status: '已完成' },
  { id: 3, equipment: '工业机器人臂 RB-II', date: '2025-05-01', type: '故障维修', technician: '王维修', duration: '8h', cost: '¥5,600', status: '进行中' },
];

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
  };
  return (
    <span className={`px-2 py-0.5 text-xs font-medium rounded ${cfg[status] ?? 'bg-slate-100 text-slate-600'}`}>
      {status}
    </span>
  );
}

// ── 主组件 ────────────────────────────────────────────────────────────────────
export default function EquipmentPage() {
  const qc = useQueryClient();
  const [showModal, setShowModal] = useState(false);
  const [detailItem, setDetailItem] = useState<EquipmentItem | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [form, setForm] = useState({
    equipmentId: '',
    type: '定期保养',
    date: '',
    technician: '',
    duration: '',
    cost: '',
    content: '',
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

  // ── 处理数据（API 优先，失败 Mock 兜底）─────────────────────────────────────
  const rawRecords = recordsData?.records ?? [];
  const equipment: EquipmentItem[] = rawRecords.length > 0
    ? rawRecords.map((r) => ({
        id: String(r.assetId),
        name: String((r as any).equipmentName ?? (r as any).assetName ?? r.assetId),
        status: '使用中',
        lastMaintenance: r.maintenanceDate?.substring(0, 10) ?? '—',
        nextMaintenance: r.nextMaintenanceDate?.substring(0, 10) ?? '—',
        usageRate: Number((r as any).usageRate ?? 0),
        maintenanceStatus: '正常',
      }))
    : MOCK_EQUIPMENT;

  const upcomingList = (upcomingData && upcomingData.length > 0) ? upcomingData : [];

  // ── 统计 ─────────────────────────────────────────────────────────────────────
  const total = equipment.length;
  const inMaintenance = equipment.filter((e) => e.status === '维修中').length;
  const expiringSoon = equipment.filter((e) => e.maintenanceStatus === '即将到期' || e.maintenanceStatus === '已过期').length + upcomingList.length;
  const normal = equipment.filter((e) => e.status === '使用中').length;

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
      {recordsLoading && (
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

      {/* 设备列表 */}
      <Card>
        <CardHeader>
          <CardTitle>设备列表</CardTitle>
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
              {equipment.map((eq, i) => (
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
                        onClick={() => setDetailItem(eq)}
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
              {equipment.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-5 py-10 text-center text-[#94a3b8] text-sm">暂无设备数据</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* 维保记录（Mock） */}
      <Card>
        <CardHeader>
          <CardTitle>最近维保记录</CardTitle>
        </CardHeader>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#e5e7eb] bg-[#f8fafc]">
                {['设备', '日期', '类型', '技术员', '耗时', '费用', '状态'].map((h) => (
                  <th key={h} className="px-5 py-3 text-left text-xs font-semibold text-[#94a3b8] uppercase tracking-wide">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {MOCK_RECORDS.map((r) => (
                <tr key={r.id} className="border-b border-[#f1f5f9] hover:bg-[#f8fafc] transition-colors">
                  <td className="px-5 py-3.5 font-medium text-[#0f172a]">{r.equipment}</td>
                  <td className="px-5 py-3.5 text-[#64748b]">{r.date}</td>
                  <td className="px-5 py-3.5 text-[#64748b]">{r.type}</td>
                  <td className="px-5 py-3.5 text-[#64748b]">{r.technician}</td>
                  <td className="px-5 py-3.5 text-[#64748b]">{r.duration}</td>
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
                    {equipment.map((eq, i) => (
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
          onClick={() => setDetailItem(null)}
        >
          <div
            className="bg-white rounded-2xl w-full max-w-lg mx-4 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-6 py-4 border-b border-[#e5e7eb] flex items-center justify-between">
              <h3 className="text-base font-semibold text-[#0f172a]">设备详情</h3>
              <button onClick={() => setDetailItem(null)} className="text-[#94a3b8] hover:text-[#64748b] text-xl leading-none">×</button>
            </div>
            <div className="p-6 space-y-3">
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
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
