/**
 * @file pages/settings/NotificationBizSwitchTab.tsx
 * @description 流程通知开关管理 Tab
 */
import React, { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Activity, CheckCircle2, Filter, RadioTower, RefreshCw, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { notificationSwitchApi } from '@/api/notificationTemplate';
import { BIZ_TYPE_LABELS } from '@/types/notificationTemplate';
import type { NotificationBizSwitch } from '@/types/notificationTemplate';

const SWITCH_QUERY_KEY = ['notification-switches'] as const;

const EVENT_LABELS: Record<string, string> = {
  submitted: '提交',
  approved: '通过',
  rejected: '驳回',
  reminder: '催办',
  completed: '完成',
  cancelled: '取消',
  overdue: '逾期',
};

type StatusFilter = 'all' | 'enabled' | 'disabled';

const STATUS_OPTIONS: { value: StatusFilter; label: string }[] = [
  { value: 'all', label: '全部状态' },
  { value: 'enabled', label: '仅启用' },
  { value: 'disabled', label: '仅停用' },
];

function getBizTypeLabel(bizType: string) {
  return BIZ_TYPE_LABELS[bizType] || bizType;
}

function getEventLabel(event: string) {
  return EVENT_LABELS[event] || event;
}

export default function NotificationBizSwitchTab() {
  const qc = useQueryClient();
  const [bizTypeFilter, setBizTypeFilter] = useState('all');
  const [eventFilter, setEventFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [updatingIds, setUpdatingIds] = useState<Set<number>>(() => new Set());

  const { data: switches, error, isError, isFetching, isLoading, refetch } = useQuery({
    queryKey: SWITCH_QUERY_KEY,
    queryFn: async () => {
      const res = await notificationSwitchApi.list();
      return res as unknown as NotificationBizSwitch[];
    },
  });

  const allSwitches = switches ?? [];
  const isRefreshing = isFetching && !isLoading;

  const bizTypeOptions = useMemo(
    () => Array.from(new Set(allSwitches.map(item => item.bizType))).sort(),
    [allSwitches],
  );

  const eventOptions = useMemo(
    () => Array.from(new Set(allSwitches.map(item => item.event))).sort(),
    [allSwitches],
  );

  const summary = useMemo(() => {
    const enabledCount = allSwitches.filter(item => item.enabled === 1).length;
    return {
      total: allSwitches.length,
      enabled: enabledCount,
      disabled: allSwitches.length - enabledCount,
      bizTypes: new Set(allSwitches.map(item => item.bizType)).size,
      events: new Set(allSwitches.map(item => item.event)).size,
    };
  }, [allSwitches]);

  const filteredSwitches = useMemo(
    () => allSwitches.filter(item => {
      if (bizTypeFilter !== 'all' && item.bizType !== bizTypeFilter) return false;
      if (eventFilter !== 'all' && item.event !== eventFilter) return false;
      if (statusFilter === 'enabled' && item.enabled !== 1) return false;
      if (statusFilter === 'disabled' && item.enabled === 1) return false;
      return true;
    }),
    [allSwitches, bizTypeFilter, eventFilter, statusFilter],
  );

  const hasFilters = bizTypeFilter !== 'all' || eventFilter !== 'all' || statusFilter !== 'all';

  const toggleMut = useMutation({
    mutationFn: ({ id, enabled }: { id: number; enabled: number }) =>
      notificationSwitchApi.updateEnabled(id, enabled),
    onMutate: ({ id }) => {
      setUpdatingIds(prev => {
        const next = new Set(prev);
        next.add(id);
        return next;
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: SWITCH_QUERY_KEY });
      toast.success('开关状态已更新');
    },
    onError: (err: unknown) => toast.error(err instanceof Error ? err.message : '更新失败'),
    onSettled: (_data, _error, variables) => {
      setUpdatingIds(prev => {
        const next = new Set(prev);
        next.delete(variables.id);
        return next;
      });
    },
  });

  return (
    <Card className="overflow-hidden">
      <CardHeader className="items-start bg-[linear-gradient(120deg,#ffffff_0%,#f8fafc_52%,#eef6ff_100%)]">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <CardTitle>流程通知开关</CardTitle>
            <span className="rounded-md border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700">
              契约已对齐
            </span>
          </div>
          <p className="mt-1 text-sm leading-6 text-[#64748b]">
            按业务类型和流程事件控制通知触达，只更新通知开关，不发布流程。
          </p>
        </div>
        <Button variant="outline" size="sm" loading={isRefreshing} onClick={() => refetch()}>
          <RefreshCw className="h-4 w-4" />刷新
        </Button>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="overflow-hidden rounded-lg border border-[#e2e8f0] bg-white">
          <div className="grid gap-px bg-[#e2e8f0] sm:grid-cols-2 xl:grid-cols-5">
          {[
            { label: '总开关数', value: summary.total, hint: '全部事件', icon: Activity, tone: 'text-[#2563eb]' },
            { label: '启用', value: summary.enabled, hint: '当前触达', icon: CheckCircle2, tone: 'text-emerald-600' },
            { label: '停用', value: summary.disabled, hint: '暂不触达', icon: ShieldCheck, tone: 'text-amber-600' },
            { label: '业务覆盖', value: summary.bizTypes, hint: '业务类型', icon: RadioTower, tone: 'text-[#7c3aed]' },
            { label: '事件覆盖', value: summary.events, hint: '事件类型', icon: Filter, tone: 'text-[#0f766e]' },
          ].map(item => {
            const Icon = item.icon;
            return (
              <div key={item.label} className="bg-white px-4 py-3">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-xs font-medium text-[#64748b]">{item.label}</span>
                  <Icon className={`h-4 w-4 ${item.tone}`} />
                </div>
                <div className="mt-2 flex items-end justify-between gap-3">
                  <span className="text-2xl font-semibold tabular-nums text-[#0f172a]">{item.value}</span>
                  <span className="text-xs text-[#94a3b8]">{item.hint}</span>
                </div>
              </div>
            );
          })}
          </div>
        </div>

        <div className="border-l-4 border-[#2563eb] bg-[#f8fbff] px-4 py-3">
          <div className="grid gap-3 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
            <div>
              <div className="text-xs font-semibold uppercase text-[#1d4ed8]">后端契约</div>
              <div className="mt-2 flex flex-wrap gap-2 text-xs">
                <code className="rounded-md border border-[#bfdbfe] bg-white px-2 py-1 font-mono text-[#1e3a8a]">
                  GET /notification-switches/list
                </code>
                <code className="rounded-md border border-[#bfdbfe] bg-white px-2 py-1 font-mono text-[#1e3a8a]">
                  PUT /notification-switches/{'{id}'}?enabled=
                </code>
              </div>
            </div>
            <div className="text-sm leading-6 text-[#475569]">
              操作只写入通知触达开关；不会发布、回滚或重编排流程。启停前先确认业务类型、事件和模板编码。
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-3 rounded-lg border border-[#e2e8f0] bg-white px-4 py-3 lg:flex-row lg:items-end lg:justify-between">
          <div className="grid min-w-0 flex-1 gap-3 sm:grid-cols-3">
            <label className="min-w-0 space-y-1">
              <span className="block text-xs font-medium text-[#64748b]">业务类型</span>
              <select
                value={bizTypeFilter}
                onChange={event => setBizTypeFilter(event.target.value)}
                className="h-9 w-full rounded-md border border-[#d1d5db] bg-white px-3 text-sm text-[#111827] shadow-sm outline-none transition focus:border-[#2563eb] focus:ring-2 focus:ring-[#bfdbfe]"
              >
                <option value="all">全部业务</option>
                {bizTypeOptions.map(option => (
                  <option key={option} value={option}>{getBizTypeLabel(option)}</option>
                ))}
              </select>
            </label>
            <label className="min-w-0 space-y-1">
              <span className="block text-xs font-medium text-[#64748b]">事件</span>
              <select
                value={eventFilter}
                onChange={event => setEventFilter(event.target.value)}
                className="h-9 w-full rounded-md border border-[#d1d5db] bg-white px-3 text-sm text-[#111827] shadow-sm outline-none transition focus:border-[#2563eb] focus:ring-2 focus:ring-[#bfdbfe]"
              >
                <option value="all">全部事件</option>
                {eventOptions.map(option => (
                  <option key={option} value={option}>{getEventLabel(option)}</option>
                ))}
              </select>
            </label>
            <label className="min-w-0 space-y-1">
              <span className="block text-xs font-medium text-[#64748b]">状态</span>
              <select
                value={statusFilter}
                onChange={event => setStatusFilter(event.target.value as StatusFilter)}
                className="h-9 w-full rounded-md border border-[#d1d5db] bg-white px-3 text-sm text-[#111827] shadow-sm outline-none transition focus:border-[#2563eb] focus:ring-2 focus:ring-[#bfdbfe]"
              >
                {STATUS_OPTIONS.map(option => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </label>
          </div>
          <div className="flex items-center justify-between gap-3 lg:justify-end">
            <span className="text-xs text-[#64748b]">
              显示 <strong className="font-semibold text-[#0f172a]">{filteredSwitches.length}</strong> / {summary.total}
            </span>
            <Button
              variant="ghost"
              size="sm"
              disabled={!hasFilters}
              onClick={() => {
                setBizTypeFilter('all');
                setEventFilter('all');
                setStatusFilter('all');
              }}
            >
              重置筛选
            </Button>
          </div>
        </div>

        {isLoading ? (
          <div className="space-y-3 rounded-lg border border-[#e2e8f0] bg-white p-4">
            <div className="h-4 w-40 animate-pulse rounded bg-[#e2e8f0]" />
            <div className="grid gap-2">
              {[0, 1, 2, 3].map(item => (
                <div key={item} className="h-12 animate-pulse rounded-md bg-[#f1f5f9]" />
              ))}
            </div>
          </div>
        ) : isError ? (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-8">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div className="min-w-0">
                <div className="text-sm font-semibold text-red-700">开关列表加载失败</div>
                <div className="mt-1 break-words text-xs leading-5 text-red-600">
                  {error instanceof Error ? error.message : '请检查 /notification-switches/list 服务状态后重试。'}
                </div>
              </div>
              <Button variant="outline" size="sm" loading={isRefreshing} onClick={() => refetch()}>
                <RefreshCw className="h-4 w-4" />重试
              </Button>
            </div>
          </div>
        ) : summary.total === 0 ? (
          <div className="rounded-lg border border-dashed border-[#cbd5e1] bg-white px-4 py-12 text-center">
            <div className="text-sm font-medium text-[#334155]">暂无流程开关配置</div>
            <div className="mt-1 text-xs text-[#94a3b8]">等待后端返回 /notification-switches/list 数据后即可展示事件矩阵。</div>
          </div>
        ) : filteredSwitches.length === 0 ? (
          <div className="rounded-lg border border-dashed border-[#cbd5e1] bg-white px-4 py-12 text-center">
            <div className="text-sm font-medium text-[#334155]">当前筛选没有匹配的开关</div>
            <div className="mt-1 text-xs text-[#94a3b8]">调整业务类型、事件或状态筛选后再查看。</div>
          </div>
        ) : (
          <div className="overflow-hidden rounded-lg border border-[#e2e8f0] bg-white">
            {isRefreshing && (
              <div className="border-b border-[#dbeafe] bg-[#eff6ff] px-4 py-2 text-xs font-medium text-[#1d4ed8]">
                正在刷新最新开关状态...
              </div>
            )}
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-sm">
              <thead>
                <tr className="border-b border-[#e2e8f0] bg-[#f8fafc]">
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-[#64748b]">业务类型</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-[#64748b]">事件</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-[#64748b]">模板编码</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-[#64748b]">状态</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase text-[#64748b]">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#eef2f7]">
                {filteredSwitches.map((s: NotificationBizSwitch) => {
                  const rowUpdating = updatingIds.has(s.id);
                  const enabled = s.enabled === 1;
                  return (
                  <tr key={s.id} className="transition-colors hover:bg-[#f8fafc]">
                    <td className="px-4 py-3">
                      <div className="font-medium text-[#111827]">{getBizTypeLabel(s.bizType)}</div>
                      <div className="mt-0.5 max-w-[220px] truncate font-mono text-xs text-[#94a3b8]">{s.bizType}</div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-[#334155]">{getEventLabel(s.event)}</div>
                      <div className="mt-0.5 max-w-[220px] truncate font-mono text-xs text-[#94a3b8]">{s.event}</div>
                    </td>
                    <td className="px-4 py-3">
                      <code className="inline-block max-w-[260px] truncate rounded-md bg-[#f1f5f9] px-2 py-1 align-middle font-mono text-xs text-[#475569]">
                        {s.templateCode || '未绑定模板'}
                      </code>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center rounded-md px-2 py-1 text-xs font-semibold ${
                        enabled ? 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200' : 'bg-[#f1f5f9] text-[#64748b] ring-1 ring-[#e2e8f0]'
                      }`}>
                        {enabled ? '启用' : '停用'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => toggleMut.mutate({ id: s.id, enabled: enabled ? 0 : 1 })}
                        disabled={rowUpdating}
                        className={`inline-flex min-w-[74px] items-center justify-center rounded-md border px-3 py-1.5 text-xs font-semibold transition-colors ${
                          enabled
                            ? 'border-red-200 text-red-600 hover:bg-red-50'
                            : 'border-emerald-200 text-emerald-700 hover:bg-emerald-50'
                        }`}>
                        {rowUpdating ? '更新中' : enabled ? '停用' : '启用'}
                      </button>
                    </td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
