import { useState } from 'react';
import { useNavigate } from 'react-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Bell,
  AlertTriangle,
  Info,
  CheckCircle2,
  XCircle,
  Shield,
  ClipboardList,
  CheckCheck,
  ListFilter,
  ChevronLeft,
  ChevronRight,
  Trash2,
} from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { PageHeader } from '@/components/ui/PageHeader';
import {
  getNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
  deleteNotification,
} from '@/api/notification';
import type { PaginatedResponse } from '@/types/common';
import type { Notification } from '@/types/common';

type NotificationTab = 'all' | 'system' | 'approval' | 'alert';

const TABS: { key: NotificationTab; label: string }[] = [
  { key: 'all', label: '全部' },
  { key: 'system', label: '系统通知' },
  { key: 'approval', label: '审批通知' },
  { key: 'alert', label: '预警通知' },
];

const TYPE_CONFIG: Record<string, { icon: typeof Bell; bgColor: string; textColor: string; borderColor: string }> = {
  info:    { icon: Bell,          bgColor: 'bg-[#dbeafe]', textColor: 'text-[#2563eb]', borderColor: 'bg-[#2563eb]' },
  warning: { icon: AlertTriangle, bgColor: 'bg-[#fef3c7]', textColor: 'text-[#d97706]', borderColor: 'bg-[#d97706]' },
  success: { icon: CheckCircle2,  bgColor: 'bg-[#dcfce7]', textColor: 'text-[#16a34a]', borderColor: 'bg-[#16a34a]' },
  error:   { icon: XCircle,       bgColor: 'bg-[#ffdad6]', textColor: 'text-[#ba1a1a]', borderColor: 'bg-[#ba1a1a]' },
};

const ACTION_STYLES: Record<string, string> = {
  primary:   'bg-[#004191] text-white hover:opacity-90',
  secondary: 'border border-[#e5e7eb] hover:bg-[#f1f3ff]',
  danger:    'border border-[#ba1a1a] text-[#ba1a1a] hover:bg-[#ffdad6]/20',
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

export default function NotificationsPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [activeTab, setActiveTab] = useState<NotificationTab>('all');
  const [page, setPage] = useState(1);

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
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }),
  });

  const notifications: Notification[] = (data as PaginatedResponse<Notification> | undefined)?.data?.records ?? [];
  const total: number = (data as PaginatedResponse<Notification> | undefined)?.data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="min-h-screen">
      <div className="max-w-[1200px] mx-auto p-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-6">
          <PageHeader
            title="通知中心"
            breadcrumbs={[{ label: '仪表板', href: '/dashboard' }, { label: '通知中心' }]}
          />

          <div className="flex items-center gap-4 w-full md:w-auto justify-end">
            <Button
              variant="ghost"
              size="md"
              loading={markAllReadMutation.isPending}
              onClick={() => markAllReadMutation.mutate()}
            >
              <CheckCheck className="w-4 h-4" />
              全部已读
            </Button>
            <button
              className="p-2 border border-[#e5e7eb] rounded hover:bg-[#f1f3ff] transition-colors"
              onClick={() => { setActiveTab('all'); setPage(1); }}
              title="重置筛选"
            >
              <ListFilter className="w-5 h-5 text-[#424753]" />
            </button>
          </div>
        </div>

        <div className="flex items-center gap-4 border-b border-[#e5e7eb] w-full md:w-auto overflow-x-auto mb-6">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => { setActiveTab(tab.key); setPage(1); }}
              className={`px-4 py-3 whitespace-nowrap text-sm font-medium transition-colors ${
                activeTab === tab.key
                  ? 'text-[#004191] border-b-2 border-[#004191] font-semibold'
                  : 'text-[#424753] hover:text-[#004191]'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {isLoading ? (
          <div className="flex justify-center py-12">
            <div className="w-8 h-8 border-2 border-[#004191] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : notifications.length === 0 ? (
          <div className="text-center py-12 text-[#424753]">暂无通知</div>
        ) : (
          <div className="grid grid-cols-1 gap-3">
            {notifications.map((n) => {
              const displayType = mapNotificationType(n);
              const cfg = TYPE_CONFIG[displayType] ?? TYPE_CONFIG.info;
              const Icon = cfg.icon;
              return (
                <div
                  key={n.id}
                  className="bg-white border border-[#e5e7eb] relative overflow-hidden flex items-start p-4 gap-4 group hover:shadow-sm transition-all cursor-pointer rounded"
                  onClick={() => {
                    if (!n.isRead) markReadMutation.mutate(n.id);
                  }}
                >
                  <div className={`absolute left-0 top-0 bottom-0 w-1 ${cfg.borderColor}`} />
                  <div className={`flex-shrink-0 w-12 h-12 rounded-full ${cfg.bgColor} flex items-center justify-center ${cfg.textColor}`}>
                    <Icon className="w-6 h-6" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <h3 className="text-base font-semibold flex items-center gap-2 text-[#161c27]">
                        {n.title}
                        {!n.isRead && <span className="w-2 h-2 rounded-full bg-[#ba1a1a] block" />}
                      </h3>
                      <span className="text-xs text-[#424753] whitespace-nowrap">{n.createTime}</span>
                    </div>
                    <p className="text-sm text-[#424753] truncate mb-3">{n.content}</p>
                    <div className="flex items-center gap-3">
                      {n.refType === 'APPROVAL' && (
                        <button
                          className={`px-4 py-1.5 text-sm rounded transition-colors ${ACTION_STYLES.primary}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate('/approvals');
                          }}
                        >
                          去审批
                        </button>
                      )}
                      <button
                        className="p-1.5 text-[#424753] hover:text-[#ba1a1a] hover:bg-[#ffdad6]/20 rounded transition-colors"
                        title="删除"
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteMutation.mutate(n.id);
                        }}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {totalPages > 1 && (
          <div className="mt-6 flex justify-center">
            <nav className="flex items-center gap-1">
              <button
                className="p-2 border border-[#e5e7eb] rounded hover:bg-[#f1f3ff] transition-colors"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                <button
                  key={p}
                  onClick={() => setPage(p)}
                  className={`w-10 h-10 rounded text-sm font-medium ${
                    page === p
                      ? 'bg-[#004191] text-white'
                      : 'border border-[#e5e7eb] text-[#424753] hover:bg-[#f1f3ff]'
                  }`}
                >
                  {p}
                </button>
              ))}
              <button
                className="p-2 border border-[#e5e7eb] rounded hover:bg-[#f1f3ff] transition-colors"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </nav>
          </div>
        )}
      </div>
    </div>
  );
}
