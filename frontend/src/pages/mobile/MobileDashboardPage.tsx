/**
 * @file pages/mobile/MobileDashboardPage.tsx
 * @description 移动端首页仪表盘 — 统计卡片 + 快捷入口 + 待办 + 通知
 */

import { useNavigate } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/app/context/AuthContext';
import { PageTransition, ErrorState, EmptyState, SkeletonCard } from '@/components/ui';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import http from '@/utils/http';
import {
  Package,
  CheckCircle2,
  Clock,
  ScanLine,
  ClipboardList,
  Wrench,
  Bell,
  ChevronRight,
  AlertTriangle,
} from 'lucide-react';

/* ── 类型定义 ─────────────────────────────────────────────────────────────── */
interface DashboardData {
  totalAssets: number;
  inUseAssets: number;
  idleAssets: number;
  scrapAssets: number;
  pendingWorkOrders: number;
  unreadNotifications: number;
}

interface WorkOrderItem {
  id: number;
  workOrderNo: string;
  title: string;
  status: string;
  priority: string;
  assetName: string;
  createTime: string;
}

interface NotificationItem {
  id: number;
  title: string;
  content: string;
  type: string;
  createTime: string;
  isRead: number;
}

/* ── 状态样式映射 ──────────────────────────────────────────────────────────── */
const STATUS_STYLE: Record<string, { label: string; color: string; bg: string }> = {
  PENDING:          { label: '待处理',  color: '#2563eb', bg: '#eff6ff' },
  IN_PROGRESS:      { label: '进行中',  color: '#ca8a04', bg: '#fefce8' },
  APPROVING_LEVEL_1:{ label: '审批中',  color: '#9333ea', bg: '#faf5ff' },
  COMPLETED:        { label: '已完成',  color: '#16a34a', bg: '#f0fdf4' },
  REJECTED:         { label: '已驳回',  color: '#dc2626', bg: '#fef2f2' },
};

const getStatusStyle = (status: string) => STATUS_STYLE[status] || { label: status, color: '#64748b', bg: '#f8fafc' };

/* ── 页面组件 ──────────────────────────────────────────────────────────────── */
function MobileDashboardContent() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const { data: dashData, isLoading: dashLoading, isError: dashError, error: dashErr } = useQuery({
    queryKey: ['mobile', 'dashboard'],
    queryFn: async () => {
      const res = await http.get<any, any>('/mobile/dashboard');
      return res.data as DashboardData;
    },
    staleTime: 1000 * 60 * 2,
  });

  const { data: workOrders, isLoading: woLoading, isError: woError } = useQuery({
    queryKey: ['mobile', 'work-orders'],
    queryFn: async () => {
      const res = await http.get<any, any>('/mobile/work-orders', { params: { page: 1, pageSize: 5 } });
      return res.data.records as WorkOrderItem[];
    },
    staleTime: 1000 * 60 * 2,
  });

  const { data: notifications, isLoading: notifLoading, isError: notifError } = useQuery({
    queryKey: ['mobile', 'notifications'],
    queryFn: async () => {
      const res = await http.get<any, any>('/mobile/notifications');
      return res.data as NotificationItem[];
    },
    staleTime: 1000 * 60 * 1,
  });

  const d = dashData || { totalAssets: 0, inUseAssets: 0, idleAssets: 0, scrapAssets: 0, pendingWorkOrders: 0, unreadNotifications: 0 };

  if (dashError && !dashData) {
    return (
      <PageTransition>
        <ErrorState title="加载失败" description={(dashErr as Error)?.message || '获取仪表盘数据失败'} onRetry={() => window.location.reload()} />
      </PageTransition>
    );
  }

  const isLoading = dashLoading || woLoading || notifLoading;

  return (
    <PageTransition>
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', paddingBottom: '12px' }}>
      {/* 用户信息 */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        padding: '16px',
        background: 'linear-gradient(135deg, #ffffff 0%, #f8fbff 100%)',
        borderRadius: '18px',
        border: '1px solid rgba(226, 232, 240, 0.9)',
        boxShadow: '0 10px 30px rgba(15,23,42,0.08)',
      }}>
        <div style={{
          width: '44px',
          height: '44px',
          borderRadius: '50%',
          background: 'linear-gradient(135deg, #2563eb, #0f766e)',
          color: '#fff',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '18px',
          fontWeight: 600,
          flexShrink: 0,
        }}>
          {(user?.realName || user?.username || '?').charAt(0).toUpperCase()}
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: '16px', fontWeight: 600, color: '#0f172a' }}>
            {user?.realName || user?.username || '用户'}
          </div>
          <div style={{ fontSize: '12px', color: '#64748b' }}>
            资产管理系统
          </div>
        </div>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '4px',
          backgroundColor: '#fff1f2',
          color: '#dc2626',
          padding: '6px 10px',
          borderRadius: '999px',
          fontSize: '12px',
          fontWeight: 500,
        }}>
          <Bell size={14} />
          <span>{d.unreadNotifications > 99 ? '99+' : d.unreadNotifications}</span>
        </div>
      </div>

      {/* 统计卡片 */}
      {dashLoading ? (
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '10px',
        }}>
          {[1, 2, 3, 4].map(i => <SkeletonCard key={i} />)}
        </div>
      ) : (
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: '10px',
      }}>
        <StatCard
          icon={<Package size={20} />}
          label="资产总数"
          value={d.totalAssets}
          color="#2563eb"
          bg="#eff6ff"
          onClick={() => navigate('/m/assets')}
        />
        <StatCard
          icon={<CheckCircle2 size={20} />}
          label="在用"
          value={d.inUseAssets}
          color="#16a34a"
          bg="#f0fdf4"
          onClick={() => navigate('/m/assets?status=IN_USE')}
        />
        <StatCard
          icon={<Clock size={20} />}
          label="闲置"
          value={d.idleAssets}
          color="#ca8a04"
          bg="#fefce8"
          onClick={() => navigate('/m/assets?status=IDLE')}
        />
        <StatCard
          icon={<AlertTriangle size={20} />}
          label="待办工单"
          value={d.pendingWorkOrders}
          color="#dc2626"
          bg="#fef2f2"
          onClick={() => navigate('/m/work-orders')}
        />
      </div>
      )}

      {/* 快捷入口 */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(3, 1fr)',
        gap: '10px',
      }}>
        <QuickAction icon={<ScanLine size={24} />} label="扫码查询" onClick={() => navigate('/m/scan')} />
        <QuickAction icon={<ClipboardList size={24} />} label="资产盘点" onClick={() => navigate('/inventory')} />
        <QuickAction icon={<Wrench size={24} />} label="报修申请" onClick={() => navigate('/workorders/new')} />
      </div>

      {/* 待办事项 */}
      <Section title="待办事项" onMore={() => navigate('/m/work-orders')}>
        {woLoading ? (
          <div className="space-y-4 py-4">
            {[1, 2, 3].map(i => <SkeletonCard key={i} />)}
          </div>
        ) : !workOrders || workOrders.length === 0 ? (
          <div style={{ textAlign: 'center', color: '#94a3b8', padding: '24px 0', fontSize: '14px' }}>
            暂无待办事项
          </div>
        ) : (
          workOrders.map((wo) => {
            const s = getStatusStyle(wo.status);
            return (
              <div
                key={wo.id}
                onClick={() => navigate(`/workorders/${wo.id}`)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '12px 0',
                  borderBottom: '1px solid #f1f5f9',
                  cursor: 'pointer',
                }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '14px', fontWeight: 500, color: '#0f172a', marginBottom: '2px' }}>
                    {wo.title}
                  </div>
                  <div style={{ fontSize: '12px', color: '#64748b' }}>
                    {wo.workOrderNo} · {wo.assetName || ''}
                  </div>
                </div>
                <span style={{
                  fontSize: '11px',
                  fontWeight: 500,
                  color: s.color,
                  backgroundColor: s.bg,
                  padding: '2px 8px',
                  borderRadius: '10px',
                  whiteSpace: 'nowrap',
                  marginLeft: '8px',
                }}>
                  {s.label}
                </span>
              </div>
            );
          })
        )}
      </Section>

      {/* 最近通知 */}
      <Section title="最近通知" onMore={() => navigate('/notifications')}>
        {notifLoading ? (
          <div className="space-y-4 py-4">
            {[1, 2].map(i => <SkeletonCard key={i} />)}
          </div>
        ) : !notifications || notifications.length === 0 ? (
          <div style={{ textAlign: 'center', color: '#94a3b8', padding: '24px 0', fontSize: '14px' }}>
            暂无通知
          </div>
        ) : (
          notifications.slice(0, 3).map((n) => (
            <div
              key={n.id}
              style={{
                padding: '10px 0',
                borderBottom: '1px solid #f1f5f9',
              }}
            >
              <div style={{ fontSize: '13px', fontWeight: 500, color: '#0f172a', marginBottom: '2px' }}>
                {n.title}
              </div>
              <div style={{ fontSize: '12px', color: '#64748b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {n.content}
              </div>
            </div>
          ))
        )}
      </Section>
    </div>
    </PageTransition>
  );
}

/* ── 导出页面 ──────────────────────────────────────────────────────────────── */
export default function MobileDashboardPage() {
  return (
    <ErrorBoundary>
      <MobileDashboardContent />
    </ErrorBoundary>
  );
}

/* ── 子组件 ──────────────────────────────────────────────────────────────── */
function StatCard({ icon, label, value, color, bg, onClick }: {
  icon: React.ReactNode;
  label: string;
  value: number | string;
  color: string;
  bg: string;
  onClick?: () => void;
}) {
  return (
    <div
      onClick={onClick}
      style={{
        backgroundColor: '#fff',
        borderRadius: '12px',
        padding: '14px',
        border: '1px solid rgba(226,232,240,0.9)',
        boxShadow: '0 8px 24px rgba(15,23,42,0.07)',
        cursor: onClick ? 'pointer' : 'default',
        transition: 'transform 0.12s ease, box-shadow 0.12s ease',
      }}
    >
      <div style={{
        width: '36px',
        height: '36px',
        borderRadius: '10px',
        backgroundColor: bg,
        color: color,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: '10px',
      }}>
        {icon}
      </div>
      <div style={{ fontSize: '22px', fontWeight: 700, color: '#0f172a', marginBottom: '2px' }}>
        {value}
      </div>
      <div style={{ fontSize: '12px', color: '#64748b' }}>{label}</div>
    </div>
  );
}

function QuickAction({ icon, label, onClick }: {
  icon: React.ReactNode;
  label: string;
  onClick?: () => void;
}) {
  return (
    <div
      onClick={onClick}
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#fff',
        borderRadius: '12px',
        padding: '16px 8px',
        border: '1px solid rgba(226,232,240,0.9)',
        boxShadow: '0 8px 22px rgba(15,23,42,0.06)',
        cursor: onClick ? 'pointer' : 'default',
        gap: '8px',
        minHeight: '80px',
      }}
    >
      <div style={{ color: '#2563eb' }}>{icon}</div>
      <div style={{ fontSize: '12px', fontWeight: 500, color: '#334155' }}>{label}</div>
    </div>
  );
}

function Section({ title, onMore, children }: {
  title: string;
  onMore?: () => void;
  children: React.ReactNode;
}) {
  return (
    <div style={{
      background: 'linear-gradient(180deg, #ffffff 0%, #fbfdff 100%)',
      borderRadius: '18px',
      border: '1px solid rgba(226,232,240,0.9)',
      padding: '14px 16px',
      boxShadow: '0 10px 26px rgba(15,23,42,0.07)',
    }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: '4px',
      }}>
        <h3 style={{ fontSize: '15px', fontWeight: 600, color: '#0f172a', margin: 0 }}>{title}</h3>
        {onMore && (
          <button
            onClick={onMore}
            style={{
              background: 'none',
              border: 'none',
              color: '#2563eb',
              fontSize: '12px',
              display: 'flex',
              alignItems: 'center',
              gap: '2px',
              cursor: 'pointer',
              padding: '4px',
            }}
          >
            更多 <ChevronRight size={14} />
          </button>
        )}
      </div>
      {children}
    </div>
  );
}
