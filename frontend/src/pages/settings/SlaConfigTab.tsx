/**
 * @file pages/settings/SlaConfigTab.tsx
 * @description SLA 配置 Tab — 服务承诺矩阵
 *
 * 对应后端：SlaConfigController
 * GET /sla-config — 查询配置列表
 * PUT /sla-config/{id} — 更新配置
 */
import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  Loader2,
  RefreshCw,
  RotateCcw,
  Save,
  ShieldAlert,
  Zap,
} from 'lucide-react';
import {
  listSlaConfigs,
  updateSlaConfig,
  type SlaConfigItem,
  type SlaConfigPayload,
} from '@/api/slaConfig';
import { Button } from '@/components/ui/Button';
import { Card, CardContent } from '@/components/ui/Card';

const SLA_QUERY_KEY = ['sla-config'] as const;

const PRIORITY_LABELS: Record<string, string> = {
  LOW: '低优先级',
  MEDIUM: '中优先级',
  HIGH: '高优先级',
  CRITICAL: '紧急',
};

const PRIORITY_ORDER = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];

type EditableSlaConfigField = 'responseHours' | 'resolveHours' | 'warningRatio' | 'status';

export type SlaConfigDraft = Partial<Pick<SlaConfigItem, EditableSlaConfigField>>;

export interface SlaConfigStats {
  total: number;
  enabled: number;
  disabled: number;
  criticalResolveHours: number | null;
  minResponseHours: number | null;
}

const EDITABLE_FIELDS: EditableSlaConfigField[] = [
  'responseHours',
  'resolveHours',
  'warningRatio',
  'status',
];

function getDraftValue(item: SlaConfigItem, draft: SlaConfigDraft, field: EditableSlaConfigField): number {
  return (draft[field] ?? item[field]) as number;
}

function formatHours(value: number | null) {
  return value == null || !Number.isFinite(value) ? '-' : `${value}h`;
}

function formatPercent(value: number) {
  return Number.isFinite(value) ? `${Math.round(value * 100)}%` : '-';
}

function getNumberInputValue(value: number) {
  return Number.isFinite(value) ? value : '';
}

function getPercentInputValue(value: number) {
  return Number.isFinite(value) ? Math.round(value * 100) : '';
}

function getErrorMessage(err: unknown, fallback: string) {
  return err instanceof Error && err.message ? err.message : fallback;
}

export function hasSlaConfigChanges(item: SlaConfigItem, draft: SlaConfigDraft = {}): boolean {
  return EDITABLE_FIELDS.some(field => draft[field] != null && draft[field] !== item[field]);
}

export function buildSlaConfigPayload(item: SlaConfigItem, draft: SlaConfigDraft = {}): SlaConfigPayload {
  const payload: SlaConfigPayload = {};

  EDITABLE_FIELDS.forEach(field => {
    const value = draft[field];
    if (value != null && value !== item[field]) {
      Object.assign(payload, { [field]: value });
    }
  });

  return payload;
}

export function validateSlaConfigDraft(item: SlaConfigItem, draft: SlaConfigDraft = {}): string[] {
  const responseHours = getDraftValue(item, draft, 'responseHours');
  const resolveHours = getDraftValue(item, draft, 'resolveHours');
  const warningRatio = getDraftValue(item, draft, 'warningRatio');
  const errors: string[] = [];

  if (!Number.isFinite(responseHours) || responseHours <= 0) {
    errors.push('响应时限必须大于 0 小时');
  }

  if (!Number.isFinite(resolveHours) || resolveHours <= 0) {
    errors.push('解决时限必须大于 0 小时');
  }

  if (
    Number.isFinite(responseHours) &&
    Number.isFinite(resolveHours) &&
    responseHours > 0 &&
    resolveHours > 0 &&
    responseHours > resolveHours
  ) {
    errors.push('响应时限不能大于解决时限');
  }

  if (!Number.isFinite(warningRatio) || warningRatio <= 0 || warningRatio > 1) {
    errors.push('预警阈值必须大于 0 且不超过 100%');
  }

  return errors;
}

export function getSlaConfigStats(items: SlaConfigItem[]): SlaConfigStats {
  const enabled = items.filter(item => item.status === 1).length;
  const critical = items.find(item => item.priority === 'CRITICAL');
  const responseHours = items
    .map(item => item.responseHours)
    .filter(value => Number.isFinite(value));

  return {
    total: items.length,
    enabled,
    disabled: items.length - enabled,
    criticalResolveHours: critical?.resolveHours ?? null,
    minResponseHours: responseHours.length > 0 ? Math.min(...responseHours) : null,
  };
}

export default function SlaConfigTab() {
  const qc = useQueryClient();
  const [edits, setEdits] = useState<Record<number, SlaConfigDraft>>({});
  const [savingIds, setSavingIds] = useState<Set<number>>(() => new Set());
  const [bulkSaving, setBulkSaving] = useState(false);

  const { data: configs, error, isError, isLoading, isFetching, refetch } = useQuery<SlaConfigItem[]>({
    queryKey: SLA_QUERY_KEY,
    queryFn: listSlaConfigs,
    retry: false,
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: SlaConfigPayload }) =>
      updateSlaConfig(id, data),
  });

  const setEdit = (id: number, field: EditableSlaConfigField, value: number) => {
    setEdits(prev => ({
      ...prev,
      [id]: { ...(prev[id] || {}), [field]: value },
    }));
  };

  const clearEdits = (ids: number[]) => {
    setEdits(prev => {
      const next = { ...prev };
      ids.forEach(id => {
        delete next[id];
      });
      return next;
    });
  };

  const setRowsSaving = (ids: number[], saving: boolean) => {
    setSavingIds(prev => {
      const next = new Set(prev);
      ids.forEach(id => {
        if (saving) next.add(id);
        else next.delete(id);
      });
      return next;
    });
  };

  const sorted = useMemo(
    () => configs
      ? [...configs].sort((a, b) => PRIORITY_ORDER.indexOf(a.priority) - PRIORITY_ORDER.indexOf(b.priority))
      : [],
    [configs],
  );

  const stats = useMemo(() => getSlaConfigStats(sorted), [sorted]);

  const changedRows = useMemo(
    () => sorted.filter(item => hasSlaConfigChanges(item, edits[item.id])),
    [edits, sorted],
  );

  const changedCount = changedRows.length;
  const isRefreshing = isFetching && !isLoading;

  const handleRefresh = () => {
    refetch();
  };

  const handleSaveRow = async (item: SlaConfigItem) => {
    const draft = edits[item.id] ?? {};
    const errors = validateSlaConfigDraft(item, draft);
    if (errors.length > 0) {
      toast.error(errors[0]);
      return;
    }

    const payload = buildSlaConfigPayload(item, draft);
    if (Object.keys(payload).length === 0) return;

    setRowsSaving([item.id], true);
    try {
      await updateMutation.mutateAsync({ id: item.id, data: payload });
      await qc.invalidateQueries({ queryKey: SLA_QUERY_KEY });
      clearEdits([item.id]);
      toast.success(`${PRIORITY_LABELS[item.priority] || item.priority} SLA 已保存`);
    } catch (err) {
      toast.error(getErrorMessage(err, 'SLA 配置保存失败'));
    } finally {
      setRowsSaving([item.id], false);
    }
  };

  const handleSaveAll = async () => {
    if (changedRows.length === 0) return;

    const invalidRows = changedRows
      .map(item => ({ item, errors: validateSlaConfigDraft(item, edits[item.id]) }))
      .filter(result => result.errors.length > 0);

    if (invalidRows.length > 0) {
      toast.error(`有 ${invalidRows.length} 项 SLA 校验未通过，请先修正`);
      return;
    }

    const ids = changedRows.map(item => item.id);
    setBulkSaving(true);
    setRowsSaving(ids, true);

    try {
      const results = await Promise.allSettled(
        changedRows.map(item =>
          updateSlaConfig(item.id, buildSlaConfigPayload(item, edits[item.id])).then(() => item.id),
        ),
      );

      const savedIds = results
        .filter((result): result is PromiseFulfilledResult<number> => result.status === 'fulfilled')
        .map(result => result.value);
      const failed = results.find((result): result is PromiseRejectedResult => result.status === 'rejected');

      if (savedIds.length > 0) {
        await qc.invalidateQueries({ queryKey: SLA_QUERY_KEY });
        clearEdits(savedIds);
        toast.success(`已保存 ${savedIds.length} 项 SLA 配置`);
      }

      if (failed) {
        toast.error(getErrorMessage(failed.reason, '部分 SLA 配置保存失败'));
      }
    } finally {
      setRowsSaving(ids, false);
      setBulkSaving(false);
    }
  };

  const handleResetAll = () => {
    setEdits({});
    toast.success('已撤销所有未保存修改');
  };

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-lg font-semibold text-[#0f172a]">服务承诺矩阵</h3>
            <span className="rounded-md border border-amber-200 bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-700">
              校验前置
            </span>
          </div>
          <p className="mt-1 text-sm text-[#64748b]">
            按工单优先级统一配置启停、响应时限、解决时限和预警阈值，变更保存后影响 SLA 截止与预警状态。
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 text-sm text-[#64748b]">
            <Clock className="h-4 w-4" />
            支持单行保存与批量保存
          </div>
          <Button variant="outline" size="sm" loading={isRefreshing} onClick={handleRefresh}>
            <RefreshCw className="h-4 w-4" />
            刷新
          </Button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { label: '总规则', value: stats.total, hint: '优先级策略', icon: ShieldAlert, tone: 'text-[#2563eb]' },
          { label: '启用规则', value: stats.enabled, hint: `${stats.disabled} 项停用`, icon: CheckCircle2, tone: 'text-emerald-600' },
          { label: '最快响应', value: formatHours(stats.minResponseHours), hint: '首次响应窗口', icon: Zap, tone: 'text-[#7c3aed]' },
          { label: '紧急解决', value: formatHours(stats.criticalResolveHours), hint: 'CRITICAL 关闭窗口', icon: Clock, tone: 'text-amber-600' },
        ].map(item => {
          const Icon = item.icon;
          return (
            <Card key={item.label}>
              <CardContent className="px-4 py-3">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-xs font-medium text-[#64748b]">{item.label}</span>
                  <Icon className={`h-4 w-4 ${item.tone}`} />
                </div>
                <div className="mt-2 flex items-end justify-between gap-3">
                  <span className="text-2xl font-semibold tabular-nums text-[#0f172a]">{item.value}</span>
                  <span className="text-xs text-[#94a3b8]">{item.hint}</span>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="flex flex-col gap-3 rounded-lg border border-[#dbeafe] bg-[#f8fbff] px-4 py-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0">
          <div className="text-sm font-semibold text-[#1e3a8a]">
            待保存 {changedCount} 项
          </div>
          <div className="mt-1 text-xs leading-5 text-[#64748b]">
            保存会只提交已变化字段；撤销只清空前端草稿，不影响已生效配置。
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" disabled={changedCount === 0 || bulkSaving} onClick={handleResetAll}>
            <RotateCcw className="h-4 w-4" />撤销全部
          </Button>
          <Button size="sm" loading={bulkSaving} disabled={changedCount === 0} onClick={handleSaveAll}>
            <Save className="h-4 w-4" />保存全部
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-[#3b82f6]" />
        </div>
      ) : isError ? (
        <Card>
          <CardContent className="px-4 py-8">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div className="min-w-0">
                <div className="flex items-center gap-2 text-sm font-semibold text-red-700">
                  <AlertCircle className="h-4 w-4" />
                  SLA 配置加载失败
                </div>
                <div className="mt-2 break-words text-xs leading-5 text-red-600">
                  {getErrorMessage(error, '请检查 GET /sla-config 服务状态后重试。')}
                </div>
              </div>
              <Button variant="outline" size="sm" loading={isRefreshing} onClick={() => refetch()}>
                <RefreshCw className="h-4 w-4" />重试加载
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : sorted.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-[#94a3b8]">
            暂无 SLA 配置数据
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {isRefreshing && (
            <div className="rounded-lg border border-[#bfdbfe] bg-[#eff6ff] px-4 py-2 text-xs font-medium text-[#1d4ed8]">
              正在刷新最新 SLA 配置...
            </div>
          )}
          {sorted.map(item => {
            const draft = edits[item.id] ?? {};
            const responseHours = getDraftValue(item, draft, 'responseHours');
            const resolveHours = getDraftValue(item, draft, 'resolveHours');
            const warningRatio = getDraftValue(item, draft, 'warningRatio');
            const status = getDraftValue(item, draft, 'status');
            const changed = hasSlaConfigChanges(item, draft);
            const errors = validateSlaConfigDraft(item, draft);
            const rowSaving = savingIds.has(item.id);

            return (
              <Card key={item.id}>
                <CardContent className="p-5">
                  <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-3">
                        <span className="inline-flex items-center rounded-md bg-[#eff6ff] px-2.5 py-1 text-xs font-semibold text-[#2563eb]">
                          {PRIORITY_LABELS[item.priority] || item.priority}
                        </span>
                        <span className="text-xs text-[#94a3b8]">
                          ID: {item.id}
                        </span>
                        {changed && (
                          <span className="rounded-md bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-700 ring-1 ring-amber-200">
                            未保存
                          </span>
                        )}
                      </div>
                      <p className="mt-3 max-w-3xl text-sm leading-6 text-[#475569]">
                        响应要求工单在 {responseHours || '-'} 小时内首次处理；解决要求在 {resolveHours || '-'} 小时内关闭；到达解决时限的 {formatPercent(warningRatio)} 时进入预警。
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 md:justify-end">
                      <label className="flex items-center gap-2 text-xs font-medium text-[#64748b]">
                        状态
                        <select
                          value={status}
                          onChange={event => setEdit(item.id, 'status', Number(event.target.value))}
                          className="h-8 rounded-md border border-[#d1d5db] bg-white px-2 text-xs font-semibold text-[#111827] shadow-sm outline-none transition focus:border-[#2563eb] focus:ring-2 focus:ring-[#bfdbfe]"
                        >
                          <option value={1}>启用</option>
                          <option value={0}>停用</option>
                        </select>
                      </label>
                      <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-semibold ${
                        status === 1 ? 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200' : 'bg-gray-100 text-gray-500 ring-1 ring-gray-200'
                      }`}>
                        {status === 1 ? '已启用' : '已停用'}
                      </span>
                    </div>
                  </div>

                  <div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-3">
                    <div className="min-w-0">
                      <label className="mb-1.5 block text-xs font-medium text-[#64748b]">响应时限（小时）</label>
                      <input
                        type="number"
                        min={1}
                        max={9999}
                        value={getNumberInputValue(responseHours)}
                        onChange={event => setEdit(item.id, 'responseHours', Number(event.target.value))}
                        className="h-10 w-full rounded-lg border border-[#d7deea] bg-white px-3 text-sm text-[#0f172a] focus:border-[#2563eb] focus:outline-none focus:ring-2 focus:ring-[#2563eb]/20"
                      />
                    </div>
                    <div className="min-w-0">
                      <label className="mb-1.5 block text-xs font-medium text-[#64748b]">解决时限（小时）</label>
                      <input
                        type="number"
                        min={1}
                        max={99999}
                        value={getNumberInputValue(resolveHours)}
                        onChange={event => setEdit(item.id, 'resolveHours', Number(event.target.value))}
                        className="h-10 w-full rounded-lg border border-[#d7deea] bg-white px-3 text-sm text-[#0f172a] focus:border-[#2563eb] focus:outline-none focus:ring-2 focus:ring-[#2563eb]/20"
                      />
                    </div>
                    <div className="min-w-0">
                      <label className="mb-1.5 block text-xs font-medium text-[#64748b]">预警阈值（%）</label>
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          min={1}
                          max={100}
                          step={1}
                          value={getPercentInputValue(warningRatio)}
                          onChange={event => setEdit(item.id, 'warningRatio', Number(event.target.value) / 100)}
                          className="h-10 w-full rounded-lg border border-[#d7deea] bg-white px-3 text-sm text-[#0f172a] focus:border-[#2563eb] focus:outline-none focus:ring-2 focus:ring-[#2563eb]/20"
                        />
                        <span className="w-6 text-sm text-[#64748b]">%</span>
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 rounded-lg border border-[#e2e8f0] bg-[#f8fafc] px-4 py-3">
                    <div className="grid gap-3 text-xs leading-5 text-[#475569] md:grid-cols-3">
                      <div><strong className="text-[#334155]">响应</strong>：影响待受理工单的首次处理截止。</div>
                      <div><strong className="text-[#334155]">解决</strong>：影响工单 SLA 到期时间与逾期判断。</div>
                      <div><strong className="text-[#334155]">预警</strong>：按解决时限比例提前标记风险。</div>
                    </div>
                  </div>

                  {errors.length > 0 && (
                    <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs leading-5 text-red-700">
                      {errors.map(errorText => (
                        <div key={errorText} className="flex gap-2">
                          <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                          <span>{errorText}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:justify-end">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={!changed || rowSaving}
                      onClick={() => clearEdits([item.id])}
                    >
                      <RotateCcw className="h-4 w-4" /> 撤销本行
                    </Button>
                    <Button
                      size="sm"
                      loading={rowSaving}
                      disabled={!changed || errors.length > 0}
                      onClick={() => handleSaveRow(item)}
                    >
                      <Save className="h-4 w-4" /> 保存
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
