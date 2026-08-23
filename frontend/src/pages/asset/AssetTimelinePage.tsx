/**
 * @file pages/asset/AssetTimelinePage.tsx
 * @description 资产履历时间线页面 — 独立页面版本
 *
 * 功能：展示资产的完整履历事件时间线，支持按事件类型筛选
 * API: getAssetHistory (GET /assets/{id}/history)
 */

import React, { useMemo, useState } from 'react';
import { useParams } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { getAssetHistory, type AssetHistoryEvent, type AssetHistoryEventType } from '@/api/asset';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Skeleton } from '@/components/ui/Skeleton';
import { PageTransition } from '@/components/ui';
import {
  Clock,
  Activity,
  Wrench,
  Users,
  ArrowLeftRight,
  ClipboardCheck,
  Archive,
  Package,
  PackageOpen,
  AlertTriangle,
  Info,
  AlertCircle,
  Filter,
  ArrowLeft,
} from 'lucide-react';
import { useNavigate } from 'react-router';

// ─── 常量 ────────────────────────────────────────────────────────────────────

const EVENT_TYPE_OPTIONS = [
  { value: 'ALL', label: '全部事件' },
  { value: 'CHANGE_LOG', label: '变更日志' },
  { value: 'WORK_ORDER', label: '工单' },
  { value: 'MAINTENANCE', label: '保养' },
  { value: 'ASSIGNMENT', label: '领用' },
  { value: 'BORROW', label: '借用' },
  { value: 'INSPECTION', label: '检验' },
  { value: 'RETIREMENT', label: '报废' },
  { value: 'INVENTORY', label: '盘点' },
  { value: 'INTAKE', label: '入库' },
] as const;

// ─── 辅助函数 ────────────────────────────────────────────────────────────────

/**
 * 格式化时间戳用于展示。
 */
function formatTimestamp(value: string): string {
  try {
    const date = new Date(value);
    if (isNaN(date.getTime())) return value;
    return date.toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return value;
  }
}

/**
 * 根据事件类型获取图标。
 */
function getEventIcon(eventType: AssetHistoryEventType): React.ReactNode {
  switch (eventType) {
    case 'WORK_ORDER':
      return <Wrench className="w-4 h-4 text-orange-500" />;
    case 'MAINTENANCE':
      return <Wrench className="w-4 h-4 text-blue-500" />;
    case 'ASSIGNMENT':
      return <Users className="w-4 h-4 text-green-500" />;
    case 'BORROW':
      return <ArrowLeftRight className="w-4 h-4 text-purple-500" />;
    case 'INSPECTION':
      return <ClipboardCheck className="w-4 h-4 text-teal-500" />;
    case 'RETIREMENT':
      return <Archive className="w-4 h-4 text-gray-500" />;
    case 'INVENTORY':
      return <Package className="w-4 h-4 text-indigo-500" />;
    case 'INTAKE':
      return <PackageOpen className="w-4 h-4 text-cyan-500" />;
    case 'CHANGE_LOG':
    default:
      return <Clock className="w-4 h-4 text-blue-500" />;
  }
}

/**
 * 根据事件类型获取中文标签。
 */
function getEventLabel(eventType: AssetHistoryEventType): string {
  const labels: Record<AssetHistoryEventType, string> = {
    CHANGE_LOG: '变更日志',
    WORK_ORDER: '工单',
    MAINTENANCE: '保养',
    ASSIGNMENT: '领用',
    BORROW: '借用',
    INSPECTION: '检验',
    RETIREMENT: '报废',
    INVENTORY: '盘点',
    INTAKE: '入库',
  };
  return labels[eventType] || eventType;
}

/**
 * 根据事件级别获取圆点颜色。
 */
function getLevelDotClasses(level: string): string {
  switch (level) {
    case 'ERROR':
      return 'w-3 h-3 rounded-full bg-red-500 border-2 border-white ring-2 ring-red-100 flex-shrink-0';
    case 'WARNING':
      return 'w-3 h-3 rounded-full bg-yellow-400 border-2 border-white ring-2 ring-yellow-100 flex-shrink-0';
    case 'INFO':
    default:
      return 'w-3 h-3 rounded-full bg-blue-400 border-2 border-white ring-2 ring-blue-100 flex-shrink-0';
  }
}

/**
 * 根据事件级别获取图标。
 */
function getLevelIcon(level: string): React.ReactNode {
  switch (level) {
    case 'ERROR':
      return <AlertCircle className="w-4 h-4 text-red-500" />;
    case 'WARNING':
      return <AlertTriangle className="w-4 h-4 text-yellow-500" />;
    case 'INFO':
    default:
      return <Info className="w-4 h-4 text-blue-500" />;
  }
}

/**
 * 根据事件类型获取 Badge variant。
 */
function getEventBadgeVariant(
  eventType: AssetHistoryEventType,
): 'default' | 'secondary' | 'destructive' | 'outline' {
  switch (eventType) {
    case 'RETIREMENT':
      return 'secondary';
    case 'WORK_ORDER':
      return 'destructive';
    case 'ASSIGNMENT':
    case 'MAINTENANCE':
      return 'default';
    default:
      return 'outline';
  }
}

// ─── 主页面组件 ──────────────────────────────────────────────────────────────

const AssetTimelinePage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const assetId = Number(id);

  // 事件类型筛选
  const [eventTypeFilter, setEventTypeFilter] = useState<string>('ALL');

  // 查询资产履历数据
  const { data: events, isLoading, error } = useQuery({
    queryKey: ['asset-history', assetId, eventTypeFilter],
    queryFn: () => {
      const types = eventTypeFilter === 'ALL' ? undefined : [eventTypeFilter as AssetHistoryEventType];
      return getAssetHistory(assetId, types);
    },
    enabled: !!assetId,
  });

  const historyEvents: AssetHistoryEvent[] = (events as unknown as AssetHistoryEvent[]) ?? [];

  // 统计数据
  const stats = useMemo(() => {
    const total = historyEvents.length;
    const errorCount = historyEvents.filter((e) => e.level === 'ERROR').length;
    const warningCount = historyEvents.filter((e) => e.level === 'WARNING').length;
    const infoCount = historyEvents.filter((e) => e.level === 'INFO').length;
    return { total, errorCount, warningCount, infoCount };
  }, [historyEvents]);

  // 加载状态
  if (isLoading) {
    return (
      <PageTransition>
        <div className="min-h-full bg-[var(--app-background)] px-4 py-5 sm:px-6 lg:px-8">
          <div className="mx-auto flex w-full max-w-[1480px] flex-col gap-6">
            <div className="rounded-2xl border border-[var(--surface-border)] bg-white shadow-sm p-6">
              <Skeleton className="h-8 w-48 mb-4" />
              <Skeleton className="h-4 w-64" />
            </div>
            <div className="rounded-2xl border border-[var(--surface-border)] bg-white shadow-sm p-6">
              <Skeleton className="h-6 w-32 mb-4" />
              <div className="space-y-4">
                {[1, 2, 3, 4, 5].map((i) => (
                  <div key={i} className="flex gap-3">
                    <Skeleton className="w-3 h-3 rounded-full mt-1.5 flex-shrink-0" />
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-4 w-3/4" />
                      <Skeleton className="h-3 w-1/2" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </PageTransition>
    );
  }

  // 错误状态
  if (error) {
    return (
      <PageTransition>
        <div className="min-h-full bg-[var(--app-background)] px-4 py-5 sm:px-6 lg:px-8">
          <div className="mx-auto flex w-full max-w-[1480px] flex-col gap-6">
            <div className="rounded-2xl border border-[var(--surface-border)] bg-white shadow-sm p-6">
              <div className="flex flex-col items-center justify-center py-12">
                <AlertCircle className="h-12 w-12 text-red-400 mb-4" />
                <h3 className="text-lg font-semibold text-gray-900 mb-2">加载失败</h3>
                <p className="text-sm text-gray-500 mb-4">无法加载资产履历数据</p>
                <Button variant="primary" onClick={() => navigate(-1)}>
                  返回
                </Button>
              </div>
            </div>
          </div>
        </div>
      </PageTransition>
    );
  }

  // 空状态
  if (!historyEvents || historyEvents.length === 0) {
    return (
      <PageTransition>
        <div className="min-h-full bg-[var(--app-background)] px-4 py-5 sm:px-6 lg:px-8">
          <div className="mx-auto flex w-full max-w-[1480px] flex-col gap-6">
            <div className="rounded-2xl border border-[var(--surface-border)] bg-white shadow-sm p-6">
              <div className="flex items-center gap-4 mb-6">
                <Button variant="ghost" onClick={() => navigate(-1)}>
                  <ArrowLeft className="w-4 h-4" />
                </Button>
                <div>
                  <h1 className="text-xl font-bold tracking-tight text-[var(--surface-heading)]">
                    资产履历时间线
                  </h1>
                  <p className="mt-1 text-sm text-[var(--surface-muted-text)]">
                    资产 ID: {assetId}
                  </p>
                </div>
              </div>
            </div>
            <div className="rounded-2xl border border-[var(--surface-border)] bg-white shadow-sm p-6">
              <div className="flex flex-col items-center justify-center py-12">
                <Activity className="h-12 w-12 text-gray-400 mb-4" />
                <h3 className="text-lg font-semibold text-gray-900 mb-2">暂无履历记录</h3>
                <p className="text-sm text-gray-500">该资产暂无任何履历事件</p>
              </div>
            </div>
          </div>
        </div>
      </PageTransition>
    );
  }

  return (
    <PageTransition>
      <div className="min-h-full bg-[var(--app-background)] px-4 py-5 sm:px-6 lg:px-8">
        <div className="mx-auto flex w-full max-w-[1480px] flex-col gap-6">

          {/* ── 页头 + 统计栏 ────────────────────────────────────────────── */}
          <section className="rounded-2xl border border-[var(--surface-border)] bg-white shadow-sm">
            <div className="flex flex-col gap-4 px-6 py-5 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-4">
                <Button variant="ghost" onClick={() => navigate(-1)}>
                  <ArrowLeft className="w-4 h-4" />
                </Button>
                <div>
                  <h1 className="text-xl font-bold tracking-tight text-[var(--surface-heading)]">
                    资产履历时间线
                  </h1>
                  <p className="mt-1 text-sm text-[var(--surface-muted-text)]">
                    资产 ID: {assetId} — 完整变更历史记录
                  </p>
                </div>
              </div>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 divide-x divide-slate-100 border-t border-slate-100">
              <div className="flex items-center gap-3 px-5 py-3.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-blue-50 to-blue-100/60">
                  <Activity className="h-4.5 w-4.5 text-blue-600" />
                </div>
                <div>
                  <h3 className="text-xs font-medium text-slate-500">全部事件</h3>
                  <p className="text-lg font-bold text-slate-900">{stats.total}</p>
                </div>
              </div>
              <div className="flex items-center gap-3 px-5 py-3.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-red-50 to-red-100/60">
                  <AlertCircle className="h-4.5 w-4.5 text-red-600" />
                </div>
                <div>
                  <h3 className="text-xs font-medium text-slate-500">错误事件</h3>
                  <p className="text-lg font-bold text-red-600">{stats.errorCount}</p>
                </div>
              </div>
              <div className="flex items-center gap-3 px-5 py-3.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-yellow-50 to-yellow-100/60">
                  <AlertTriangle className="h-4.5 w-4.5 text-yellow-600" />
                </div>
                <div>
                  <h3 className="text-xs font-medium text-slate-500">警告事件</h3>
                  <p className="text-lg font-bold text-yellow-600">{stats.warningCount}</p>
                </div>
              </div>
              <div className="flex items-center gap-3 px-5 py-3.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-green-50 to-green-100/60">
                  <Info className="h-4.5 w-4.5 text-green-600" />
                </div>
                <div>
                  <h3 className="text-xs font-medium text-slate-500">信息事件</h3>
                  <p className="text-lg font-bold text-slate-900">{stats.infoCount}</p>
                </div>
              </div>
            </div>
          </section>

          {/* ── 事件类型筛选 ────────────────────────────────────────────── */}
          <Card className="overflow-hidden rounded-2xl border-slate-200/80 shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Filter className="w-4 h-4" />
                事件类型筛选
              </CardTitle>
            </CardHeader>
            <div className="border-t border-slate-100 px-5 py-3 flex items-center gap-2 flex-wrap">
              {EVENT_TYPE_OPTIONS.map((opt) => {
                const active = eventTypeFilter === opt.value;
                return (
                  <button
                    key={opt.value}
                    onClick={() => setEventTypeFilter(opt.value)}
                    className={`rounded-full border px-3.5 py-1.5 text-xs font-semibold transition-colors ${
                      active
                        ? 'border-blue-500 bg-blue-600 text-white'
                        : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50'
                    }`}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </Card>

          {/* ── 时间线主体 ────────────────────────────────────────────── */}
          <Card className="overflow-hidden rounded-2xl border-slate-200/80 shadow-sm">
            <CardHeader>
              <CardTitle>履历时间线</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-0">
                {historyEvents.map((event, index) => (
                  <div
                    key={`${event.eventType}-${event.refId ?? index}`}
                    className="flex gap-3"
                  >
                    {/* 时间线连接器 */}
                    <div className="flex flex-col items-center">
                      <div className={`${getLevelDotClasses(event.level)} mt-1.5`} />
                      {index < historyEvents.length - 1 && (
                        <div className="w-px h-full bg-blue-50 min-h-[24px]" />
                      )}
                    </div>
                    {/* 内容 */}
                    <div className="pb-4 min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        {getEventIcon(event.eventType)}
                        <span className="text-sm font-medium text-gray-900">
                          {event.title}
                        </span>
                        <span className="text-xs text-gray-400">
                          {formatTimestamp(event.eventTime)}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs text-gray-400">
                          操作人: {event.operatorName || '未知'}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge variant={getEventBadgeVariant(event.eventType)} className="text-xs">
                          {getEventLabel(event.eventType)}
                        </Badge>
                        {event.level !== 'INFO' && (
                          <span className="flex items-center gap-1">
                            {getLevelIcon(event.level)}
                            <span className="text-xs text-gray-500">{event.level}</span>
                          </span>
                        )}
                      </div>
                      {event.description && (
                        <p className="text-xs text-gray-400 mt-1">{event.description}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </PageTransition>
  );
};

export default AssetTimelinePage;