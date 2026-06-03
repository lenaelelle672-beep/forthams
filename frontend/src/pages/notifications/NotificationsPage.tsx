import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Bell,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  CheckCheck,
  ListFilter,
  ChevronLeft,
  ChevronRight,
  Trash2,
  Inbox,
  Square,
  CheckSquare,
  Clock,
  Mail,
  Settings,
  ClipboardCheck,
} from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import {
  getNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
  deleteNotification,
} from '@/api/notification';
import type { PaginatedResponse, PageData } from '@/types/common';
import type { Notification } from '@/types/common';

type NotificationTab = 'all' | 'system' | 'approval' | 'alert';

const TABS: { key: NotificationTab; label: string }[] = [
  { key: 'all', label: '全部' },
  { key: 'system', label: '系统通知' },
  { key: 'approval', label: '审批通知' },
  { key: 'alert', label: '预警通知' },
];

const TYPE_CONFIG: Record<string, { icon: typeof Bell; bgColor: string; textColor: string; borderColor: string }> = {
  info:    { icon: Bell,          bgColor: 'bg-blue-100',  textColor: 'text-blue-600',  borderColor: 'bg-blue-600' },
  warning: { icon: AlertTriangle, bgColor: 'bg-amber-100', textColor: 'text-amber-600', borderColor: 'bg-amber-500' },
  success: { icon: CheckCircle2,  bgColor: 'bg-emerald-100', textColor: 'text-emerald-600', borderColor: 'bg-emerald-500' },
  error:   { icon: XCircle,       bgColor: 'bg-red-100',   textColor: 'text-red-600',   borderColor: 'bg-red-600' },
};

/** Source-type label config derived from notification category/type */
const SOURCE_LABELS: Record<string, { label: string; dot: string; bg: string; text: string; border: string }> = {
  APPROVAL:   { label: '审批', dot: 'bg-blue-400',   bg: 'bg-blue-50',   text: 'text-blue-700',   border: 'border-blue-200' },
  SYSTEM:     { label: '系统', dot: 'bg-emerald-400', bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200' },
  ALERT:      { label: '预警', dot: 'bg-amber-400',  bg: 'bg-amber-50',  text: 'text-amber-700',  border: 'border-amber-200' },
  MAINTENANCE:{ label: '维保', dot: 'bg-amber-400',  bg: 'bg-amber-50',  text: 'text-amber-700',  border: 'border-amber-200' },
  INVENTORY:  { label: '盘点', dot: 'bg-indigo-400', bg: 'bg-indigo-50', text: 'text-indigo-700', border: 'border-indigo-200' },
};

/** Priority indicator derived from notification display type */
const PRIORITY_FROM_TYPE: Record<string, { label: string; dot: string; bg: string; text: string; border: string }> = {
  error:   { label: '紧急', dot: 'bg-red-500',    bg: 'bg-red-50',    text: 'text-red-700',    border: 'border-red-200' },
  warning: { label: '重要', dot: 'bg-amber-500',  bg: 'bg-amber-50',  text: 'text-amber-700',  border: 'border-amber-200' },
  info:    { label: '普通', dot: 'bg-blue-500',   bg: 'bg-blue-50',   text: 'text-blue-700',   border: 'border-blue-200' },
  success: { label: '普通', dot: 'bg-emerald-500', bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200' },
};

const PAGE_SIZE = 10;

/** Map API Notification type to display type used in TYPE_CONFIG */
function mapNotificationType(n: Notification): string {
  const t = n.type?.toUpperCase();
  if (t === 'APPROVAL') return 'info';
  if (t === 'MAINTENANCE' || t === 'INVENTORY') return 'warning';
  if (t === 'SYSTEM') return 'success';
  return 'info';
}

/** Map tab key to API category param */
function tabToCategory(tab: NotificationTab): string | undefined {
  if (tab === 'all') return undefined;
  if (tab === 'system') return 'SYSTEM';
  if (tab === 'approval') return 'APPROVAL';
  if (tab === 'alert') return 'ALERT';
  return undefined;
}

/**
 * Format a date string into a human-readable relative time.
 * Shows "刚刚", "N分钟前", "N小时前", "昨天 HH:mm", or "MM-DD HH:mm".
 */
function formatRelativeTime(dateStr?: string): string {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return dateStr;

  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  if (diffSec < 60) return '刚刚';
  if (diffMin < 60) return `${diffMin}分钟前`;
  if (diffHour < 24) return `${diffHour}小时前`;
  if (diffDay === 1) {
    const hh = String(date.getHours()).padStart(2, '0');
    const mm = String(date.getMinutes()).padStart(2, '0');
    return `昨天 ${hh}:${mm}`;
  }
  if (diffDay < 30) {
    const MM = String(date.getMonth() + 1).padStart(2, '0');
    const DD = String(date.getDate()).padStart(2, '0');
    const hh = String(date.getHours()).padStart(2, '0');
    const mm = String(date.getMinutes()).padStart(2, '0');
    return `${MM}-${DD} ${hh}:${mm}`;
  }
  const YYYY = date.getFullYear();
  const MM = String(date.getMonth() + 1).padStart(2, '0');
  const DD = String(date.getDate()).padStart(2, '0');
  return `${YYYY}-${MM}-${DD}`;
}

/** Derive source label key from notification */
function getSourceKey(n: Notification): string {
  return n.category?.toUpperCase() || n.type?.toUpperCase() || '';
}

export default function NotificationsPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [activeTab, setActiveTab] = useState<NotificationTab>('all');
  const [page, setPage] = useState(1);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [batchMode, setBatchMode] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['notifications', activeTab, page],
    queryFn: () =>
      getNotifications({
        category: tabToCategory(activeTab),
        page,
        pageSize: PAGE_SIZE,
      }),
    staleTime: 1000 * 30,
    refetchInterval: 1000 * 30,
  });

  const markReadMutation = useMutation({
    mutationFn: (id: number) => markAsRead(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }),
  });

  const markAllReadMutation = useMutation({
    mutationFn: () => markAllAsRead(),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => deleteNotification(id),
    onSuccess: (_data, deletedId) => {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        next.delete(deletedId);
        return next;
      });
      qc.invalidateQueries({ queryKey: ['notifications'] });
    },
  });

  const batchDeleteMutation = useMutation({
    mutationFn: async (ids: number[]) => {
      await Promise.all(ids.map((id) => deleteNotification(id)));
    },
    onSuccess: () => {
      setSelectedIds(new Set());
      setBatchMode(false);
      qc.invalidateQueries({ queryKey: ['notifications'] });
    },
  });

  const notifications: Notification[] = (data as PageData<Notification> | undefined)?.records ?? [];
  const total: number = (data as PageData<Notification> | undefined)?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const { data: unreadCount = 0 } = useQuery({
    queryKey: ['notifications', 'unreadCount'],
    queryFn: async () => {
      const res = await getUnreadCount();
      return (res as unknown as { data: number })?.data ?? 0;
    },
    staleTime: 1000 * 30,
    refetchInterval: 1000 * 30,
  });

  const systemCount = notifications.filter((n) => n.category?.toUpperCase() === 'SYSTEM').length;
  const approvalCount = notifications.filter((n) => n.category?.toUpperCase() === 'APPROVAL').length;

  const allOnPageSelected = notifications.length > 0 && notifications.every((n) => selectedIds.has(n.id));

  const toggleSelectAll = useCallback(() => {
    if (allOnPageSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(notifications.map((n) => n.id)));
    }
  }, [allOnPageSelected, notifications]);

  const toggleSelect = useCallback((id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  return (
    <div className="min-h-full bg-[var(--app-background)] px-4 py-5 sm:px-6 lg:px-8">
      <div className="mx-auto flex w-full max-w-[1480px] flex-col gap-6">

        {/* ── Compact header with stat bar ── */}
        <section className="rounded-2xl border border-[var(--surface-border)] bg-white shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 shadow-sm">
                <Bell className="w-5 h-5 text-white" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-xl font-bold tracking-tight text-[#0f172a]">通知中心</h1>
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-blue-200 bg-blue-50 px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider text-blue-700">
                    <Bell className="h-3 w-3" />
                    通知
                  </span>
                </div>
                <p className="text-sm text-[#64748b]">
                  共 {total} 条通知
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              {/* Batch mode toggle */}
              {notifications.length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    setBatchMode((v) => !v);
                    setSelectedIds(new Set());
                  }}
                  className={`inline-flex h-8 items-center gap-1.5 rounded-lg border px-3 text-xs font-medium transition-colors ${
                    batchMode
                      ? 'border-blue-500 bg-blue-600 text-white'
                      : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  {batchMode ? '取消批量' : '批量管理'}
                </button>
              )}

              {/* Batch actions bar */}
              {batchMode && selectedIds.size > 0 && (
                <button
                  type="button"
                  onClick={() => batchDeleteMutation.mutate(Array.from(selectedIds))}
                  disabled={batchDeleteMutation.isPending}
                  className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-red-200 bg-white px-3 text-xs font-medium text-red-600 hover:bg-red-50 transition-colors disabled:opacity-40"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  删除所选 ({selectedIds.size})
                </button>
              )}

              <button
                type="button"
                onClick={() => markAllReadMutation.mutate()}
                disabled={markAllReadMutation.isPending}
                className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-xs font-medium text-slate-600 hover:bg-slate-50 transition-colors disabled:opacity-40"
              >
                <CheckCheck className="w-3.5 h-3.5" />
                全部已读
              </button>
              <button
                type="button"
                className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 transition-colors"
                onClick={() => { setActiveTab('all'); setPage(1); qc.invalidateQueries({ queryKey: ['notifications'] }); }}
                title="重置筛选"
              >
                <ListFilter className="w-4 h-4" />
              </button>
            </div>
          </div>
          {/* Stat bar */}
          <div className="grid grid-cols-2 sm:grid-cols-4 divide-x divide-slate-100 border-t border-slate-100">
            <div className="flex items-center gap-3 px-5 py-3">
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-blue-600 to-cyan-500 shadow-sm">
                <Bell className="h-3.5 w-3.5 text-white" />
              </span>
              <div>
                <p className="text-[11px] font-medium text-slate-400">全部通知</p>
                <p className="text-lg font-bold text-slate-900">{total}</p>
              </div>
            </div>
            <div className="flex items-center gap-3 px-5 py-3">
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-red-500 to-rose-400 shadow-sm">
                <Mail className="h-3.5 w-3.5 text-white" />
              </span>
              <div>
                <p className="text-[11px] font-medium text-slate-400">未读</p>
                <p className="text-lg font-bold text-slate-900">{unreadCount}</p>
              </div>
            </div>
            <div className="flex items-center gap-3 px-5 py-3">
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-emerald-500 to-teal-400 shadow-sm">
                <Settings className="h-3.5 w-3.5 text-white" />
              </span>
              <div>
                <p className="text-[11px] font-medium text-slate-400">系统通知</p>
                <p className="text-lg font-bold text-slate-900">{systemCount}</p>
              </div>
            </div>
            <div className="flex items-center gap-3 px-5 py-3">
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-amber-500 to-orange-400 shadow-sm">
                <ClipboardCheck className="h-3.5 w-3.5 text-white" />
              </span>
              <div>
                <p className="text-[11px] font-medium text-slate-400">审批通知</p>
                <p className="text-lg font-bold text-slate-900">{approvalCount}</p>
              </div>
            </div>
          </div>
        </section>

        {/* ── Main content ── */}
        <Card className="overflow-hidden rounded-2xl border-slate-200/80 shadow-sm">
          {/* Quick filter pills */}
          <div className="flex items-center gap-2 border-b border-slate-100 px-5 py-2.5 flex-wrap">
            {TABS.map((tab) => (
              <button
                key={tab.key}
                type="button"
                className={`rounded-full border px-3.5 py-1.5 text-xs font-semibold transition-all ${
                  activeTab === tab.key
                    ? 'border-blue-500 bg-blue-600 text-white'
                    : 'border-slate-200 bg-white text-slate-500 hover:border-slate-300 hover:text-slate-700'
                }`}
                onClick={() => { setActiveTab(tab.key); setPage(1); }}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Content */}
          {isLoading ? (
            <div className="flex justify-center py-12">
              <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : notifications.length === 0 ? (
            /* Empty state */
            <div className="flex flex-col items-center justify-center py-16 text-slate-500">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-50 to-blue-100/50 flex items-center justify-center mb-4">
                <Inbox className="w-8 h-8 text-blue-400" />
              </div>
              <p className="text-base font-medium mb-1 text-[#0f172a]">暂无通知</p>
              <p className="text-sm text-slate-400">
                {activeTab === 'all' ? '所有通知都会显示在这里' : '当前筛选条件下没有通知'}
              </p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {/* Batch select-all row */}
              {batchMode && (
                <div className="flex items-center gap-3 px-5 py-2.5 bg-blue-50/50">
                  <button
                    onClick={toggleSelectAll}
                    className="flex items-center gap-2 text-sm text-slate-600 hover:text-blue-600 transition-colors"
                  >
                    {allOnPageSelected
                      ? <CheckSquare className="w-4 h-4 text-blue-600" />
                      : <Square className="w-4 h-4" />}
                    全选当前页
                  </button>
                </div>
              )}

              {notifications.map((n) => {
                const displayType = mapNotificationType(n);
                const cfg = TYPE_CONFIG[displayType] ?? TYPE_CONFIG.info;
                const Icon = cfg.icon;
                const sourceKey = getSourceKey(n);
                const sourceConf = SOURCE_LABELS[sourceKey];
                const priorityConf = PRIORITY_FROM_TYPE[displayType];
                const isSelected = selectedIds.has(n.id);

                return (
                  <div
                    key={n.id}
                    className={`relative overflow-hidden flex items-start px-5 py-4 gap-3 md:gap-4 group hover:bg-slate-50/80 transition-all cursor-pointer ${
                      !n.isRead ? 'bg-blue-50/30' : 'bg-white'
                    } ${isSelected ? 'ring-2 ring-inset ring-blue-300/60 bg-blue-50/20' : ''}`}
                    onClick={() => {
                      if (!n.isRead) markReadMutation.mutate(n.id);
                    }}
                  >
                    {/* Color accent bar */}
                    <div className={`absolute left-0 top-0 bottom-0 w-1 ${cfg.borderColor}`} />

                    {/* Batch checkbox */}
                    {batchMode && (
                      <button
                        className="flex-shrink-0 mt-3 text-slate-500 hover:text-blue-600 transition-colors"
                        onClick={(e) => { e.stopPropagation(); toggleSelect(n.id); }}
                        title={isSelected ? '取消选择' : '选择'}
                      >
                        {isSelected
                          ? <CheckSquare className="w-5 h-5 text-blue-600" />
                          : <Square className="w-5 h-5" />}
                      </button>
                    )}

                    {/* Icon */}
                    <div className={`hidden sm:flex flex-shrink-0 w-11 h-11 md:w-12 md:h-12 rounded-xl ${cfg.bgColor} items-center justify-center ${cfg.textColor}`}>
                      <Icon className="w-5 h-5 md:w-6 md:h-6" />
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      {/* Row 1: title + unread dot + time */}
                      <div className="flex items-start justify-between gap-2 mb-1">
                        <h3 className={`text-sm md:text-base flex items-center gap-2 ${!n.isRead ? 'font-semibold text-[#0f172a]' : 'font-medium text-[#424753]'}`}>
                          {!n.isRead && (
                            <span className="w-2.5 h-2.5 rounded-full bg-red-600 flex-shrink-0 ring-2 ring-red-600/20" />
                          )}
                          <span className="truncate">{n.title}</span>
                        </h3>
                        <span
                          className="text-xs text-slate-400 whitespace-nowrap flex items-center gap-1 flex-shrink-0"
                          title={n.createTime}
                        >
                          <Clock className="w-3 h-3 hidden md:inline" />
                          {formatRelativeTime(n.createTime)}
                        </span>
                      </div>

                      {/* Row 2: content text */}
                      <p className={`text-sm truncate mb-2 ${!n.isRead ? 'text-[#424753]' : 'text-slate-500'}`}>{n.content}</p>

                      {/* Row 3: tags + actions */}
                      <div className="flex items-center gap-2 flex-wrap">
                        {/* Source type badge */}
                        {sourceConf && (
                          <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset ${sourceConf.bg} ${sourceConf.text} ${sourceConf.border}`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${sourceConf.dot}`} />
                            {sourceConf.label}
                          </span>
                        )}
                        {/* Priority badge */}
                        {priorityConf && (
                          <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset ${priorityConf.bg} ${priorityConf.text} ${priorityConf.border}`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${priorityConf.dot}`} />
                            {priorityConf.label}
                          </span>
                        )}

                        <div className="flex-1" />

                        {/* Action buttons */}
                        {n.refType === 'APPROVAL' && (
                          <button
                            className="inline-flex h-7 items-center gap-1.5 rounded-lg border border-blue-200 bg-blue-600 px-3 text-xs font-medium text-white hover:bg-blue-700 transition-colors"
                            onClick={(e) => {
                              e.stopPropagation();
                              navigate('/approvals');
                            }}
                          >
                            去审批
                          </button>
                        )}
                        <button
                          className="inline-flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                          title="删除"
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteMutation.mutate(n.id);
                          }}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between border-t border-slate-100 px-5 py-3">
              <span className="text-xs text-slate-400">
                共 <span className="font-medium text-slate-600">{total}</span> 条
              </span>
              <nav className="flex items-center gap-1">
                <button
                  className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white hover:bg-slate-50 transition-colors disabled:opacity-40"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                  <button
                    key={p}
                    onClick={() => setPage(p)}
                    className={`h-8 min-w-[32px] rounded-lg border text-sm font-medium transition-colors ${
                      page === p
                        ? 'bg-blue-600 text-white border-blue-600'
                        : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    {p}
                  </button>
                ))}
                <button
                  className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white hover:bg-slate-50 transition-colors disabled:opacity-40"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </nav>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
