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
} from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { PageHeader } from '@/components/ui/PageHeader';

type NotificationTab = 'all' | 'system' | 'approval' | 'alert';

interface NotificationItem {
  id: string;
  type: 'info' | 'warning' | 'success' | 'error';
  category: NotificationTab;
  title: string;
  content: string;
  time: string;
  isRead: boolean;
  actionLabel?: string;
  actionType?: 'primary' | 'secondary' | 'danger';
}

const MOCK_NOTIFICATIONS: NotificationItem[] = [
  {
    id: '1', type: 'info', category: 'approval', title: '资产报废申请待审批',
    content: '您有一条来自 [张三] 的资产报废申请待处理。', time: '刚刚',
    isRead: false, actionLabel: '去审批', actionType: 'primary',
  },
  {
    id: '2', type: 'warning', category: 'alert', title: '设备保养到期预警',
    content: '精密数控机床 VMC-850 保养计划将于 3 天后到期。', time: '5分钟前',
    isRead: false, actionLabel: '查看详情', actionType: 'secondary',
  },
  {
    id: '3', type: 'info', category: 'system', title: '系统升级成功',
    content: 'forthAMS 已成功升级至 v2.4.1 版本，点击查看更新日志。', time: '1小时前',
    isRead: true,
  },
  {
    id: '4', type: 'success', category: 'approval', title: '资产领用审批已通过',
    content: '您申请的 MacBook Pro 16" 领用流程已通过终审。', time: '昨天',
    isRead: true, actionLabel: '查看详情', actionType: 'secondary',
  },
  {
    id: '5', type: 'warning', category: 'alert', title: '库存不足提醒',
    content: 'RFID 标签库存已低于安全阈值 (500pcs)。', time: '2024-05-19',
    isRead: true,
  },
  {
    id: '6', type: 'error', category: 'approval', title: '调拨申请被驳回',
    content: '服务器集群 B-12 的调拨申请已被财务部驳回。', time: '2024-05-18',
    isRead: true, actionLabel: '查看原因', actionType: 'danger',
  },
  {
    id: '7', type: 'info', category: 'system', title: '安全登录提醒',
    content: '您的账号于 2024-05-17 14:20 在新设备登录。', time: '2024-05-17',
    isRead: true,
  },
  {
    id: '8', type: 'info', category: 'approval', title: '新任务指派',
    content: '您被指派为 [2024年度资产盘点] 流程的负责人。', time: '2024-05-16',
    isRead: true, actionLabel: '开始处理', actionType: 'primary',
  },
];

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

export default function NotificationsPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [activeTab, setActiveTab] = useState<NotificationTab>('all');
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ['notifications', activeTab, page],
    queryFn: async () => {
      // TODO: replace with real API call
      const filtered = activeTab === 'all'
        ? MOCK_NOTIFICATIONS
        : MOCK_NOTIFICATIONS.filter((n) => n.category === activeTab);
      return { data: { records: filtered, total: filtered.length } };
    },
    staleTime: 1000 * 30,
    refetchInterval: 1000 * 30,
  });

  const markReadMutation = useMutation({
    mutationFn: async (id: string) => {
      // TODO: replace with real API call
      console.log('标记已读:', id);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }),
  });

  const markAllReadMutation = useMutation({
    mutationFn: async () => {
      // TODO: replace with real API call
      console.log('全部标记已读');
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }),
  });

  const notifications: NotificationItem[] = (data as any)?.data?.records ?? [];
  const total = (data as any)?.data?.total ?? 0;

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
            <button className="p-2 border border-[#e5e7eb] rounded hover:bg-[#f1f3ff] transition-colors">
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

        <div className="grid grid-cols-1 gap-3">
          {notifications.map((n) => {
            const cfg = TYPE_CONFIG[n.type] ?? TYPE_CONFIG.info;
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
                    <span className="text-xs text-[#424753] whitespace-nowrap">{n.time}</span>
                  </div>
                  <p className="text-sm text-[#424753] truncate mb-3">{n.content}</p>
                  {n.actionLabel && (
                    <div className="flex items-center gap-3">
                      <button
                        className={`px-4 py-1.5 text-sm rounded transition-colors ${
                          n.actionType === 'primary'
                            ? ACTION_STYLES.primary
                            : n.actionType === 'danger'
                            ? ACTION_STYLES.danger
                            : ACTION_STYLES.secondary
                        }`}
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate('/approvals');
                        }}
                      >
                        {n.actionLabel}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-6 flex justify-center">
          <nav className="flex items-center gap-1">
            <button
              className="p-2 border border-[#e5e7eb] rounded hover:bg-[#f1f3ff] transition-colors"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            {[1, 2, 3].map((p) => (
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
              onClick={() => setPage((p) => p + 1)}
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </nav>
        </div>
      </div>
    </div>
  );
}
