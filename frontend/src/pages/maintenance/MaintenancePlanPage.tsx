/**
 * @file pages/maintenance/MaintenancePlanPage.tsx
 * @description 维保计划管理页 — 计划列表 + 新建/编辑弹窗 + 日历视图
 *
 * 字段映射（v2 schema）:
 *   triggerType: manual/daily/weekly/monthly/yearly
 *   intervalDays: manual 时使用
 *   dayOfWeek/dayOfMonth/monthOfYear: 条件触发时使用
 */
import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Pencil, Trash2, RefreshCw, Calendar, Play, ChevronLeft, ChevronRight, AlertTriangle, AlertCircle, Clock, LayoutGrid, Table as TableIcon, Wrench } from 'lucide-react';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { DataTable, type Column } from '@/components/ui/DataTable';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/Dialog';
import { maintenancePlanApi } from '@/api/maintenancePlan';
import {
  TRIGGER_TYPE_LABELS, PRIORITY_LABELS, PRIORITY_COLORS,
  STATUS_LABELS, STATUS_COLORS,
} from '@/types/maintenancePlan';
import type { MaintenancePlan, PageResponse, CreateMaintenancePlanRequest } from '@/types/maintenancePlan';

const PAGE_SIZE = 10;

/**
 * 计算计划的风险等级 — 逾期/即将到期/正常
 * @returns 'overdue' | 'urgent' | 'warning' | 'normal'
 */
function computeDueRisk(nextDueDate?: string, status?: string): 'overdue' | 'urgent' | 'warning' | 'normal' {
  if (!nextDueDate || status === 'COMPLETED' || status === 'CANCELED') return 'normal';
  const now = new Date();
  const due = new Date(nextDueDate);
  const diffMs = due.getTime() - now.getTime();
  const diffDays = diffMs / (1000 * 60 * 60 * 24);
  if (diffDays < 0) return 'overdue';
  if (diffDays <= 3) return 'urgent';
  if (diffDays <= 7) return 'warning';
  return 'normal';
}

/** 风险标签文本与样式映射 */
const RISK_BADGE: Record<string, { label: string; cls: string }> = {
  overdue: { label: '逾期', cls: 'bg-red-100 text-red-700 border border-red-200' },
  urgent:  { label: '即将到期', cls: 'bg-orange-100 text-orange-700 border border-orange-200' },
  warning: { label: '临近', cls: 'bg-yellow-100 text-yellow-700 border border-yellow-200' },
  normal:  { label: '', cls: '' },
};

/** 格式化日期为 YYYY-MM-DD 短格式 */
function fmtDateShort(dateStr?: string): string {
  if (!dateStr) return '\u2014';
  return dateStr.substring(0, 10);
}

/** 构建周期描述文本 */
function buildCycleLabel(plan: { triggerType: string; intervalDays?: number; dayOfWeek?: number; dayOfMonth?: number; monthOfYear?: number }): string {
  const base = TRIGGER_TYPE_LABELS[plan.triggerType] || plan.triggerType;
  switch (plan.triggerType) {
    case 'manual': return plan.intervalDays ? `${base} / ${plan.intervalDays}天` : base;
    case 'weekly': return `${base}(周${['一','二','三','四','五','六','日'][(plan.dayOfWeek ?? 1) - 1]})`;
    case 'monthly': return `${base}(${plan.dayOfMonth ?? 1}号)`;
    case 'yearly': return `${base}(${plan.monthOfYear ?? 1}月${plan.dayOfMonth ?? 1}号)`;
    default: return base;
  }
}

const TRIGGER_OPTIONS = [
  { value: 'manual', label: '手动' },
  { value: 'daily', label: '每日' },
  { value: 'weekly', label: '每周' },
  { value: 'monthly', label: '每月' },
  { value: 'yearly', label: '每年' },
];

const EMPTY_FORM: CreateMaintenancePlanRequest = {
  assetId: 0,
  planName: '',
  triggerType: 'monthly',
  intervalDays: 30,
  dayOfWeek: 1,
  dayOfMonth: 1,
  monthOfYear: 1,
  startDate: new Date().toISOString().substring(0, 10),
  priority: 'NORMAL',
  status: 'ACTIVE',
  defaultContent: '',
  defaultExecutor: '',
};

// ─── 新建/编辑弹窗 ──────────────────────────────────────────────────────────

function PlanFormDialog({ open, plan, submitting, onClose, onSubmit }: {
  open: boolean;
  plan: MaintenancePlan | null;
  submitting: boolean;
  onClose: () => void;
  onSubmit: (data: CreateMaintenancePlanRequest) => void;
}) {
  const [form, setForm] = useState<CreateMaintenancePlanRequest>({ ...EMPTY_FORM });
  const formRef = React.useRef<HTMLFormElement>(null);

  React.useEffect(() => {
    if (open) {
      if (plan) {
        setForm({
          assetId: plan.assetId,
          planName: plan.planName,
          triggerType: plan.triggerType,
          intervalDays: plan.intervalDays ?? 30,
          dayOfWeek: plan.dayOfWeek ?? 1,
          dayOfMonth: plan.dayOfMonth ?? 1,
          monthOfYear: plan.monthOfYear ?? 1,
          startDate: plan.startDate?.substring(0, 10) || '',
          endDate: plan.endDate?.substring(0, 10) || '',
          estimatedCost: plan.estimatedCost ?? undefined,
          defaultExecutor: plan.defaultExecutor || '',
          defaultContent: plan.defaultContent || '',
          priority: plan.priority || 'NORMAL',
          status: plan.status || 'ACTIVE',
          vendorId: plan.vendorId ?? undefined,
          remark: plan.remark || '',
        });
      } else {
        setForm({ ...EMPTY_FORM, startDate: new Date().toISOString().substring(0, 10) });
      }
    }
  }, [open, plan]);

  const set = (field: string, value: any) => setForm(prev => ({ ...prev, [field]: value }));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.planName.trim() || !form.assetId) {
      toast.error('计划名称和资产ID为必填项');
      return;
    }
    onSubmit(form);
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => { if (!isOpen) onClose(); }}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{plan ? '编辑维保计划' : '新建维保计划'}</DialogTitle>
        </DialogHeader>
        <form ref={formRef} onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          {/* 行1：计划名称 + 资产ID */}
          <div className="grid grid-cols-2 gap-4">
            <Input label="计划名称 *" placeholder="如 服务器季度维保"
              value={form.planName} onChange={e => set('planName', e.target.value)} required />
            <Input label="资产ID *" type="number" placeholder="资产编号"
              value={form.assetId || ''} onChange={e => set('assetId', Number(e.target.value))} required />
          </div>

          {/* 行2：触发类型 + 条件参数 */}
          <div className="grid grid-cols-4 gap-3">
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-[#374151]">触发类型</label>
              <select value={form.triggerType} onChange={e => set('triggerType', e.target.value)}
                className="h-9 px-3 rounded-lg border border-slate-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-200">
                {TRIGGER_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
            {form.triggerType === 'manual' && (
              <Input label="间隔(天)" type="number" placeholder="如 30"
                value={form.intervalDays ?? ''} onChange={e => set('intervalDays', e.target.value ? Number(e.target.value) : undefined)} />
            )}
            {form.triggerType === 'weekly' && (
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-[#374151]">星期几</label>
                <select value={form.dayOfWeek ?? 1} onChange={e => set('dayOfWeek', Number(e.target.value))}
                  className="h-9 px-3 rounded-lg border border-slate-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-200">
                  <option value={1}>周一</option><option value={2}>周二</option><option value={3}>周三</option>
                  <option value={4}>周四</option><option value={5}>周五</option><option value={6}>周六</option><option value={7}>周日</option>
                </select>
              </div>
            )}
            {form.triggerType === 'monthly' && (
              <Input label="每月第几天" type="number" placeholder="1-31" min={1} max={31}
                value={form.dayOfMonth ?? 1} onChange={e => set('dayOfMonth', Number(e.target.value))} />
            )}
            {form.triggerType === 'yearly' && (
              <>
                <Input label="第几个月" type="number" placeholder="1-12" min={1} max={12}
                  value={form.monthOfYear ?? 1} onChange={e => set('monthOfYear', Number(e.target.value))} />
                <Input label="第几天" type="number" placeholder="1-31" min={1} max={31}
                  value={form.dayOfMonth ?? 1} onChange={e => set('dayOfMonth', Number(e.target.value))} />
              </>
            )}
          </div>

          {/* 行3：起止日期 */}
          <div className="grid grid-cols-2 gap-4">
            <Input label="开始日期 *" type="date"
              value={form.startDate} onChange={e => set('startDate', e.target.value)} />
            <Input label="结束日期" type="date"
              value={form.endDate || ''} onChange={e => set('endDate', e.target.value)} />
          </div>

          {/* 行4：执行人 + 预估费用 */}
          <div className="grid grid-cols-2 gap-4">
            <Input label="默认执行人" placeholder="负责人姓名"
              value={form.defaultExecutor || ''} onChange={e => set('defaultExecutor', e.target.value)} />
            <Input label="预估费用(元)" type="number" placeholder="如 500.00"
              value={form.estimatedCost ?? ''} onChange={e => set('estimatedCost', e.target.value ? Number(e.target.value) : undefined)} />
          </div>

          {/* 行5：优先级 + 状态 */}
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-[#374151]">优先级</label>
              <select value={form.priority} onChange={e => set('priority', e.target.value)}
                className="h-9 px-3 rounded-lg border border-slate-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-200">
                {Object.entries(PRIORITY_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-[#374151]">状态</label>
              <select value={form.status} onChange={e => set('status', e.target.value)}
                className="h-9 px-3 rounded-lg border border-slate-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-200">
                <option value="ACTIVE">启用</option>
                <option value="PAUSED">暂停</option>
              </select>
            </div>
          </div>

          {/* 默认维保内容 */}
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-[#374151]">默认维保内容</label>
            <textarea value={form.defaultContent || ''} onChange={e => set('defaultContent', e.target.value)}
              rows={3} placeholder="如：检查设备运行状态、清洁滤网、更新固件..."
              className="px-3 py-2 rounded-lg border border-slate-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-200 resize-none" />
          </div>

          {/* 备注 */}
          <Input label="备注" placeholder="备注信息（可选）"
            value={form.remark || ''} onChange={e => set('remark', e.target.value)} />
        </form>
        <DialogFooter>
          <Button type="button" variant="secondary" onClick={onClose} disabled={submitting}>取消</Button>
          <Button type="button" variant="primary" loading={submitting} onClick={() => formRef.current?.requestSubmit()}>
            {plan ? '保存修改' : '确认新建'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── 删除确认弹窗 ──────────────────────────────────────────────────────────

function DeleteConfirmDialog({ open, plan, deleting, onClose, onConfirm }: {
  open: boolean;
  plan: MaintenancePlan | null;
  deleting: boolean;
  onClose: () => void;
  onConfirm: () => void;
}) {
  return (
    <Dialog open={open && !!plan} onOpenChange={(isOpen) => { if (!isOpen) onClose(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>确认删除</DialogTitle>
        </DialogHeader>
        <div className="px-6 py-4">
          <p className="text-sm text-[#64748b]">
            确定要删除维保计划「<span className="font-medium text-[#0f172a]">{plan?.planName}</span>」吗？
          </p>
        </div>
        <DialogFooter>
          <Button type="button" variant="secondary" onClick={onClose} disabled={deleting}>取消</Button>
          <Button type="button" variant="primary" onClick={onConfirm} loading={deleting}>确认删除</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── 日历视图 ──────────────────────────────────────────────────────────────

function CalendarView({ plans }: { plans: MaintenancePlan[] }) {
  const today = new Date();
  const [currentYear, setCurrentYear] = useState(today.getFullYear());
  const [currentMonth, setCurrentMonth] = useState(today.getMonth());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  // 按 nextDueDate 日期索引计划
  const plansByDate = useMemo(() => {
    const map: Record<string, MaintenancePlan[]> = {};
    plans.forEach(p => {
      if (p.nextDueDate) {
        const key = p.nextDueDate.substring(0, 10);
        if (!map[key]) map[key] = [];
        map[key].push(p);
      }
    });
    return map;
  }, [plans]);

  // 当前月份信息
  const year = currentYear;
  const month = currentMonth;
  const firstDay = new Date(year, month, 1);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  // 该月第一天是周几（0=周日...6=周六）→ 换算为周一索引（周一=0）
  let startOffset = firstDay.getDay() - 1;
  if (startOffset < 0) startOffset = 6;

  const monthLabel = `${year}年${month + 1}月`;

  const goToPrevMonth = () => {
    if (month === 0) { setCurrentYear(year - 1); setCurrentMonth(11); }
    else setCurrentMonth(month - 1);
  };
  const goToNextMonth = () => {
    if (month === 11) { setCurrentYear(year + 1); setCurrentMonth(0); }
    else setCurrentMonth(month + 1);
  };
  const goToToday = () => {
    setCurrentYear(today.getFullYear());
    setCurrentMonth(today.getMonth());
    setSelectedDate(null);
  };

  // 构建日期格子数组
  const days: { day: number; isToday: boolean; dateStr: string; plans: MaintenancePlan[] }[] = [];
  for (let i = 0; i < startOffset; i++) {
    days.push({ day: 0, isToday: false, dateStr: '', plans: [] });
  }
  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    const isToday = dateStr === `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    days.push({ day: d, isToday, dateStr, plans: plansByDate[dateStr] || [] });
  }

  const weekDayLabels = ['周一', '周二', '周三', '周四', '周五', '周六', '周日'];
  const selectedPlans = selectedDate ? plansByDate[selectedDate] || [] : [];

  const handleDayClick = (dateStr: string, dayPlans: MaintenancePlan[]) => {
    if (dayPlans.length === 0) return;
    setSelectedDate(selectedDate === dateStr ? null : dateStr);
  };

  return (
    <div className="px-5 py-4">
      {/* 月份导航 */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={goToPrevMonth}>
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <h3 className="text-base font-semibold text-[#0f172a] min-w-[140px] text-center select-none">
            {monthLabel}
          </h3>
          <Button variant="outline" size="sm" onClick={goToNextMonth}>
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
        <Button variant="secondary" size="sm" onClick={goToToday}>今天</Button>
      </div>

      {/* 日历网格 */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        {/* 星期头 */}
        <div className="grid grid-cols-7 border-b border-slate-200">
          {weekDayLabels.map(label => (
            <div key={label}
              className={`px-2 py-2.5 text-center text-xs font-semibold text-[#64748b] bg-slate-50
                ${label === '周六' || label === '周日' ? 'text-red-400' : ''}`}>
              {label}
            </div>
          ))}
        </div>
        {/* 日期格子 */}
        <div className="grid grid-cols-7">
          {days.map((dayData, idx) => {
            if (dayData.day === 0) {
              return <div key={`empty-${idx}`} className="min-h-[90px] bg-white border-b border-r border-slate-100" />;
            }
            const hasPlans = dayData.plans.length > 0;
            const isSelected = selectedDate === dayData.dateStr;
            const isWeekend = idx % 7 === 5 || idx % 7 === 6;
            return (
              <div
                key={dayData.dateStr}
                onClick={() => handleDayClick(dayData.dateStr, dayData.plans)}
                className={`
                  min-h-[90px] border-b border-r border-slate-100 p-1.5 relative cursor-default transition-colors
                  ${dayData.isToday ? 'bg-blue-50/60' : 'bg-white'}
                  ${isSelected ? 'ring-2 ring-inset ring-blue-500 bg-blue-50/40' : ''}
                  ${hasPlans ? 'cursor-pointer hover:bg-blue-50/30' : ''}
                `}
              >
                {/* 日期数字 */}
                <div className={`
                  inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-medium mb-1
                  ${dayData.isToday ? 'bg-blue-600 text-white' : isWeekend ? 'text-red-400' : 'text-[#374151]'}
                `}>
                  {dayData.day}
                </div>
                {/* 计划标记 */}
                {hasPlans && (
                  <div className="space-y-0.5 px-0.5">
                    <div className="flex flex-wrap items-center gap-1">
                      {dayData.plans.slice(0, 3).map(p => {
                        const colorClass = PRIORITY_COLORS[p.priority]?.split(' ')[0] || 'bg-blue-400';
                        return (
                          <span key={p.id}
                            className={`inline-block w-1.5 h-1.5 rounded-full ${colorClass}`}
                            title={p.planName}
                          />
                        );
                      })}
                      {dayData.plans.length > 3 && (
                        <span className="text-[10px] font-medium text-[#64748b] ml-0.5">
                          +{dayData.plans.length - 3}
                        </span>
                      )}
                    </div>
                    <span className="text-[10px] text-[#64748b] font-medium">
                      {dayData.plans.length}项计划
                    </span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* 选定日期的计划详情 */}
      {selectedDate && selectedPlans.length > 0 && (
        <Card className="mt-3 rounded-xl border-slate-200/80">
          <CardHeader className="pb-2 pt-3">
            <CardTitle className="text-sm font-semibold">{selectedDate} 维保计划</CardTitle>
          </CardHeader>
          <CardContent className="pb-3">
            <div className="space-y-1.5">
              {selectedPlans.sort((a, b) => a.planName.localeCompare(b.planName)).map(p => (
                <div key={p.id} className="flex items-center justify-between p-2.5 bg-slate-50 rounded-lg border border-slate-100">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-[#0f172a] truncate">{p.planName}</p>
                    <p className="text-xs text-[#64748b] mt-0.5">
                      资产 {p.assetId}
                      {p.triggerType && ` | ${TRIGGER_TYPE_LABELS[p.triggerType] || p.triggerType}`}
                      {p.defaultExecutor && ` | 执行人: ${p.defaultExecutor}`}
                    </p>
                  </div>
                  <span className={`px-2 py-0.5 text-xs rounded-full whitespace-nowrap ml-2 shrink-0
                    ${PRIORITY_COLORS[p.priority] || 'bg-gray-100 text-gray-500'}`}>
                    {PRIORITY_LABELS[p.priority] || p.priority}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* 引导提示 */}
      {!selectedDate && plans.length > 0 && (
        <p className="mt-3 text-center text-xs text-slate-400">
          点击日历中带有标记的日期查看维保计划详情
        </p>
      )}

      {/* 无条件提示 — 当月无计划时 */}
      {plans.length === 0 && (
        <div className="py-8 text-center text-sm text-slate-400">暂无维保计划数据</div>
      )}
    </div>
  );
}

// ─── 主页面 ─────────────────────────────────────────────────────────────────

export default function MaintenancePlanPage() {
  const qc = useQueryClient();

  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState('');
  const [keyword, setKeyword] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [viewMode, setViewMode] = useState<'table' | 'card' | 'calendar'>('table');

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingPlan, setEditingPlan] = useState<MaintenancePlan | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingPlan, setDeletingPlan] = useState<MaintenancePlan | null>(null);

  const queryParams = { page, pageSize: PAGE_SIZE, keyword: keyword || undefined, status: statusFilter || undefined };

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ['maintenance-plans', queryParams],
    queryFn: async () => {
      const res = await maintenancePlanApi.list(queryParams);
      return res as unknown as PageResponse<MaintenancePlan>;
    },
  });

  const { data: upcomingData } = useQuery({
    queryKey: ['maintenance-plans-upcoming'],
    queryFn: async () => {
      const res = await maintenancePlanApi.list({ page: 1, pageSize: 100, status: 'ACTIVE' });
      return (res as unknown as PageResponse<MaintenancePlan>)?.records ?? [];
    },
    enabled: viewMode === 'calendar',
  });

  const records = data?.records ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  // ── 风险统计 ──
  const riskStats = useMemo(() => {
    const overdue = records.filter(p => computeDueRisk(p.nextDueDate, p.status) === 'overdue').length;
    const urgent = records.filter(p => computeDueRisk(p.nextDueDate, p.status) === 'urgent').length;
    const warning = records.filter(p => computeDueRisk(p.nextDueDate, p.status) === 'warning').length;
    return { overdue, urgent, warning };
  }, [records]);

  // ── Mutations ──

  const createMut = useMutation({
    mutationFn: (data: CreateMaintenancePlanRequest) => maintenancePlanApi.create(data),
    onSuccess: () => {
      toast.success('维保计划创建成功');
      qc.invalidateQueries({ queryKey: ['maintenance-plans'] });
      setDialogOpen(false);
    },
    onError: (err: any) => toast.error(err?.message || '创建失败'),
  });

  const updateMut = useMutation({
    mutationFn: ({ id, data }: { id: number; data: CreateMaintenancePlanRequest }) =>
      maintenancePlanApi.update(id, data),
    onSuccess: () => {
      toast.success('维保计划更新成功');
      qc.invalidateQueries({ queryKey: ['maintenance-plans'] });
      setDialogOpen(false);
    },
    onError: (err: any) => toast.error(err?.message || '更新失败'),
  });

  const deleteMut = useMutation({
    mutationFn: (id: number) => maintenancePlanApi.delete(id),
    onSuccess: () => {
      toast.success('维保计划已删除');
      qc.invalidateQueries({ queryKey: ['maintenance-plans'] });
      setDeleteDialogOpen(false);
    },
    onError: (err: any) => toast.error(err?.message || '删除失败'),
  });

  const generateMut = useMutation({
    mutationFn: (id: number) => maintenancePlanApi.generate(id),
    onSuccess: () => {
      toast.success('维保记录已生成');
      qc.invalidateQueries({ queryKey: ['maintenance-plans'] });
    },
    onError: (err: any) => toast.error(err?.message || '生成失败'),
  });

  const submitting = createMut.isPending || updateMut.isPending;

  // ── DataTable columns ──
  const columns: Column<MaintenancePlan>[] = [
    {
      key: 'planName', title: '计划名称',
      render: (_v, row) => {
        const risk = computeDueRisk(row.nextDueDate, row.status);
        return (
          <div className="flex items-center gap-1.5">
            {risk === 'overdue' && <AlertTriangle className="w-3.5 h-3.5 text-red-500 shrink-0" />}
            {risk === 'urgent' && <AlertCircle className="w-3.5 h-3.5 text-orange-500 shrink-0" />}
            <div>
              <div className="font-medium text-[#0f172a] leading-tight">{row.planName}</div>
              <div className="text-xs text-slate-400 mt-0.5">{fmtDateShort(row.startDate)} ~ {fmtDateShort(row.endDate)}</div>
            </div>
          </div>
        );
      },
    },
    { key: 'assetId', title: '资产ID', width: 80 },
    {
      key: 'triggerType', title: '计划周期',
      render: (_v, row) => (
        <span className="inline-flex items-center gap-1 text-[#64748b]">
          <RefreshCw className="w-3 h-3 text-slate-400 shrink-0" />
          {buildCycleLabel(row)}
        </span>
      ),
    },
    {
      key: 'defaultExecutor', title: '负责人',
      render: (v) => v ? (
        <span className="inline-flex items-center gap-1">
          <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-indigo-100 text-indigo-600 text-[10px] font-semibold shrink-0">
            {String(v).charAt(0)}
          </span>
          <span className="text-[#374151]">{String(v)}</span>
        </span>
      ) : <span className="text-slate-400">未指定</span>,
    },
    {
      key: 'nextDueDate', title: '下次执行',
      render: (_v, row) => {
        const risk = computeDueRisk(row.nextDueDate, row.status);
        const riskBadge = RISK_BADGE[risk];
        return (
          <div className="flex flex-col gap-0.5">
            <span className={`text-xs ${risk === 'overdue' ? 'text-red-700 font-semibold' : risk === 'urgent' ? 'text-orange-700 font-medium' : 'text-[#374151]'}`}>
              {fmtDateShort(row.nextDueDate)}
            </span>
            {riskBadge.label && (
              <span className={`inline-block self-start px-1.5 py-px text-[10px] font-medium rounded ${riskBadge.cls}`}>
                {riskBadge.label}
              </span>
            )}
          </div>
        );
      },
    },
    {
      key: 'priority', title: '优先级', width: 90,
      render: (v) => (
        <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset ${PRIORITY_COLORS[String(v)] || 'bg-gray-50 text-gray-600 border-gray-200'}`}>
          <span className="w-1.5 h-1.5 rounded-full bg-current opacity-60" />
          {PRIORITY_LABELS[String(v)] || String(v)}
        </span>
      ),
    },
    {
      key: 'status', title: '状态', width: 80,
      render: (v) => (
        <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset ${STATUS_COLORS[String(v)] || ''}`}>
          <span className="w-1.5 h-1.5 rounded-full bg-current opacity-60" />
          {STATUS_LABELS[String(v)] || String(v)}
        </span>
      ),
    },
    {
      key: 'action', title: '操作', width: 130,
      render: (_v, row) => (
        <div className="flex items-center gap-1">
          <button onClick={(e) => { e.stopPropagation(); setEditingPlan(row); setDialogOpen(true); }}
            className="inline-flex h-7 items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 text-xs font-medium text-slate-500 hover:bg-slate-50 hover:text-blue-600 transition-colors" title="编辑">
            <Pencil className="w-3.5 h-3.5" />
          </button>
          {row.status === 'ACTIVE' && (
            <button onClick={(e) => { e.stopPropagation(); generateMut.mutate(row.id); }}
              disabled={generateMut.isPending}
              className="inline-flex h-7 items-center gap-1 rounded-lg border border-emerald-200 bg-white px-2 text-xs font-medium text-emerald-600 hover:bg-emerald-50 transition-colors disabled:opacity-40" title="手动生成维保记录">
              <Play className="w-3.5 h-3.5" />
            </button>
          )}
          <button onClick={(e) => { e.stopPropagation(); setDeletingPlan(row); setDeleteDialogOpen(true); }}
            className="inline-flex h-7 items-center gap-1 rounded-lg border border-red-200 bg-white px-2 text-xs font-medium text-red-500 hover:bg-red-50 transition-colors" title="删除">
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      ),
    },
  ];

  // ─── 渲染 ───────────────────────────────────────────────────────────────

  return (
    <div className="min-h-full bg-[var(--app-background)] px-4 py-5 sm:px-6 lg:px-8">
      <div className="mx-auto flex w-full max-w-[1480px] flex-col gap-6">

        {/* ── Compact header with stat bar ── */}
        <section className="rounded-2xl border border-[var(--surface-border)] bg-white shadow-sm">
          <div className="flex items-center justify-between px-6 py-5">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 shadow-sm">
                <Wrench className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold tracking-tight text-[#0f172a]">维保计划管理</h1>
                <p className="text-sm text-[#64748b]">周期性维保计划配置与管理</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex bg-slate-100 rounded-lg p-0.5">
                <button onClick={() => setViewMode('table')}
                  className={`p-1.5 rounded-md transition-colors ${viewMode === 'table' ? 'bg-white shadow-sm text-[#0f172a]' : 'text-slate-500 hover:text-slate-700'}`} title="表格视图">
                  <TableIcon className="w-4 h-4" />
                </button>
                <button onClick={() => setViewMode('card')}
                  className={`p-1.5 rounded-md transition-colors ${viewMode === 'card' ? 'bg-white shadow-sm text-[#0f172a]' : 'text-slate-500 hover:text-slate-700'}`} title="卡片视图">
                  <LayoutGrid className="w-4 h-4" />
                </button>
                <button onClick={() => setViewMode('calendar')}
                  className={`p-1.5 rounded-md transition-colors ${viewMode === 'calendar' ? 'bg-white shadow-sm text-[#0f172a]' : 'text-slate-500 hover:text-slate-700'}`} title="日历视图">
                  <Calendar className="w-4 h-4" />
                </button>
              </div>
              <Button variant="primary" size="md" onClick={() => { setEditingPlan(null); setDialogOpen(true); }}>
                <Plus className="w-4 h-4 mr-2" />新建计划
              </Button>
            </div>
          </div>
          {/* Stat bar — risk summary */}
          {records.length > 0 && viewMode !== 'calendar' && (
            <div className="grid grid-cols-3 divide-x divide-slate-100 border-t border-slate-100">
              <div className="flex items-center gap-3 px-6 py-4">
                <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${riskStats.overdue > 0 ? 'bg-gradient-to-br from-red-50 to-red-100/50' : 'bg-slate-50'}`}>
                  <AlertTriangle className={`w-5 h-5 ${riskStats.overdue > 0 ? 'text-red-600' : 'text-slate-400'}`} />
                </div>
                <div>
                  <p className={`text-2xl font-bold ${riskStats.overdue > 0 ? 'text-red-700' : 'text-slate-400'}`}>{riskStats.overdue}</p>
                  <p className="text-xs font-medium text-slate-500">逾期计划</p>
                </div>
              </div>
              <div className="flex items-center gap-3 px-6 py-4">
                <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${riskStats.urgent > 0 ? 'bg-gradient-to-br from-orange-50 to-orange-100/50' : 'bg-slate-50'}`}>
                  <AlertCircle className={`w-5 h-5 ${riskStats.urgent > 0 ? 'text-orange-600' : 'text-slate-400'}`} />
                </div>
                <div>
                  <p className={`text-2xl font-bold ${riskStats.urgent > 0 ? 'text-orange-700' : 'text-slate-400'}`}>{riskStats.urgent}</p>
                  <p className="text-xs font-medium text-slate-500">即将到期（3天内）</p>
                </div>
              </div>
              <div className="flex items-center gap-3 px-6 py-4">
                <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${riskStats.warning > 0 ? 'bg-gradient-to-br from-yellow-50 to-yellow-100/50' : 'bg-slate-50'}`}>
                  <Clock className={`w-5 h-5 ${riskStats.warning > 0 ? 'text-yellow-600' : 'text-slate-400'}`} />
                </div>
                <div>
                  <p className={`text-2xl font-bold ${riskStats.warning > 0 ? 'text-yellow-700' : 'text-slate-400'}`}>{riskStats.warning}</p>
                  <p className="text-xs font-medium text-slate-500">临近到期（7天内）</p>
                </div>
              </div>
            </div>
          )}
        </section>

        {/* ── Main content ── */}
        {viewMode === 'calendar' ? (
          <Card className="overflow-hidden rounded-2xl border-slate-200/80 shadow-sm">
            <CalendarView plans={upcomingData || []} />
          </Card>
        ) : (
          <Card className="overflow-hidden rounded-2xl border-slate-200/80 shadow-sm">
            {/* Toolbar */}
            <div className="flex items-center gap-3 border-b border-slate-100 px-5 py-3.5 flex-wrap">
              <input type="text" placeholder="搜索计划名称..." value={searchInput}
                onChange={e => setSearchInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && (setKeyword(searchInput), setPage(1))}
                className="flex-1 min-w-[180px] max-w-xs h-9 px-3 rounded-lg border border-slate-200 bg-white text-sm
                  focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-500 placeholder:text-slate-400" />
              <button
                type="button"
                onClick={() => { setKeyword(searchInput); setPage(1); }}
                className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 text-xs font-medium text-slate-600 hover:bg-slate-50 transition-colors"
              >
                <Search className="w-3.5 h-3.5" />搜索
              </button>
              <button
                type="button"
                onClick={() => qc.invalidateQueries({ queryKey: ['maintenance-plans'] })}
                disabled={isFetching}
                className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 text-xs font-medium text-slate-600 hover:bg-slate-50 transition-colors disabled:opacity-40"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isFetching ? 'animate-spin' : ''}`} />刷新
              </button>
            </div>

            {/* Quick filter pills */}
            <div className="flex items-center gap-2 border-b border-slate-100 px-5 py-2.5 flex-wrap">
              {[
                { key: '', label: '全部状态' },
                { key: 'ACTIVE', label: '启用' },
                { key: 'PAUSED', label: '暂停' },
                { key: 'COMPLETED', label: '已完成' },
              ].map((item) => (
                <button
                  key={item.key}
                  type="button"
                  className={`rounded-full border px-3.5 py-1.5 text-xs font-semibold transition-all ${
                    statusFilter === item.key
                      ? 'border-blue-500 bg-blue-600 text-white'
                      : 'border-slate-200 bg-white text-slate-500 hover:border-slate-300 hover:text-slate-700'
                  }`}
                  onClick={() => { setStatusFilter(item.key); setPage(1); }}
                >
                  {item.label}
                </button>
              ))}
            </div>

            {/* Content */}
            {viewMode === 'table' ? (
              <DataTable<MaintenancePlan>
                columns={columns}
                data={records}
                loading={isLoading}
                emptyText="暂无维保计划"
              />
            ) : (
              /* ── 卡片视图 ── */
              <div className="px-5 py-4">
                {isLoading ? (
                  <div className="flex items-center justify-center py-12 text-slate-400 text-sm">加载中...</div>
                ) : records.length === 0 ? (
                  <div className="py-12 text-center text-slate-400 text-sm">暂无维保计划</div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {records.map(p => {
                      const risk = computeDueRisk(p.nextDueDate, p.status);
                      const riskBadge = RISK_BADGE[risk];
                      return (
                        <div key={p.id}
                          className={`rounded-xl border p-4 transition-shadow hover:shadow-md
                            ${risk === 'overdue' ? 'border-red-200 bg-red-50/30' :
                              risk === 'urgent' ? 'border-orange-200 bg-orange-50/30' :
                              risk === 'warning' ? 'border-yellow-200' :
                              'border-slate-200 bg-white'}`}>
                          {/* 头部 */}
                          <div className="flex items-start justify-between gap-2 mb-3">
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-1.5">
                                {risk === 'overdue' && <AlertTriangle className="w-4 h-4 text-red-500 shrink-0" />}
                                {risk === 'urgent' && <AlertCircle className="w-4 h-4 text-orange-500 shrink-0" />}
                                <h4 className="text-sm font-semibold text-[#0f172a] truncate">{p.planName}</h4>
                              </div>
                              <p className="text-xs text-slate-400 mt-0.5">资产 #{p.assetId}</p>
                            </div>
                            {riskBadge.label && (
                              <span className={`shrink-0 px-1.5 py-px text-[10px] font-medium rounded ${riskBadge.cls}`}>
                                {riskBadge.label}
                              </span>
                            )}
                          </div>

                          {/* 信息行 */}
                          <div className="space-y-2 mb-3 text-xs">
                            <div className="flex items-center gap-2 text-[#64748b]">
                              <RefreshCw className="w-3 h-3 text-slate-400 shrink-0" />
                              <span>{buildCycleLabel(p)}</span>
                            </div>
                            <div className="flex items-center gap-2 text-[#64748b]">
                              <Clock className="w-3 h-3 text-slate-400 shrink-0" />
                              <span>{fmtDateShort(p.startDate)} ~ {fmtDateShort(p.endDate)}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              {p.defaultExecutor ? (
                                <>
                                  <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-indigo-100 text-indigo-600 text-[9px] font-semibold shrink-0">
                                    {p.defaultExecutor.charAt(0)}
                                  </span>
                                  <span className="text-[#374151]">{p.defaultExecutor}</span>
                                </>
                              ) : (
                                <span className="text-slate-400">未指定负责人</span>
                              )}
                            </div>
                            <div className="flex items-center gap-2">
                              <span className={`text-[10px] ${risk === 'overdue' ? 'text-red-700 font-semibold' : risk === 'urgent' ? 'text-orange-700 font-medium' : 'text-[#374151]'}`}>
                                下次执行: {fmtDateShort(p.nextDueDate)}
                              </span>
                            </div>
                          </div>

                          {/* 底部 */}
                          <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                            <div className="flex items-center gap-1.5">
                              <span className={`px-1.5 py-0.5 text-[10px] rounded-full ${PRIORITY_COLORS[p.priority] || 'bg-gray-100 text-gray-500'}`}>
                                {PRIORITY_LABELS[p.priority] || p.priority}
                              </span>
                              <span className={`px-1.5 py-0.5 text-[10px] rounded-full ${STATUS_COLORS[p.status] || ''}`}>
                                {STATUS_LABELS[p.status] || p.status}
                              </span>
                            </div>
                            <div className="flex items-center gap-0.5">
                              <button onClick={() => { setEditingPlan(p); setDialogOpen(true); }}
                                className="p-1 rounded text-slate-500 hover:bg-slate-100 hover:text-blue-600 transition-colors" title="编辑">
                                <Pencil className="w-3 h-3" />
                              </button>
                              {p.status === 'ACTIVE' && (
                                <button onClick={() => generateMut.mutate(p.id)} disabled={generateMut.isPending}
                                  className="p-1 rounded text-slate-500 hover:bg-slate-100 hover:text-emerald-600 transition-colors" title="执行">
                                  <Play className="w-3 h-3" />
                                </button>
                              )}
                              <button onClick={() => { setDeletingPlan(p); setDeleteDialogOpen(true); }}
                                className="p-1 rounded text-slate-500 hover:bg-red-50 hover:text-red-600 transition-colors" title="删除">
                                <Trash2 className="w-3 h-3" />
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* 分页 */}
            <div className="flex items-center justify-between border-t border-slate-100 px-5 py-3">
              <p className="text-xs text-slate-400">共 {total} 条</p>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1}>上一页</Button>
                <span className="text-sm text-[#64748b] px-2">{page}/{totalPages}</span>
                <Button variant="outline" size="sm" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page >= totalPages}>下一页</Button>
              </div>
            </div>
          </Card>
        )}

        {/* 弹窗 */}
        <PlanFormDialog
          open={dialogOpen}
          plan={editingPlan}
          submitting={submitting}
          onClose={() => { setDialogOpen(false); setEditingPlan(null); }}
          onSubmit={(data) => {
            if (editingPlan) updateMut.mutate({ id: editingPlan.id, data });
            else createMut.mutate(data);
          }}
        />
        <DeleteConfirmDialog
          open={deleteDialogOpen}
          plan={deletingPlan}
          deleting={deleteMut.isPending}
          onClose={() => { setDeleteDialogOpen(false); setDeletingPlan(null); }}
          onConfirm={() => deletingPlan && deleteMut.mutate(deletingPlan.id)}
        />
      </div>
    </div>
  );
}
