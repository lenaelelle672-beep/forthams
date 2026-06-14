/**
 * @file pages/mobile/MobileNotificationsPage.tsx
 * @description 移动端未读通知列表
 */

import { useNavigate } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { Bell, ChevronRight, Clock, Inbox, RefreshCw } from 'lucide-react';
import { PageTransition, ErrorState, EmptyState, SkeletonCard } from '@/components/ui';
import http from '@/utils/http';

interface NotificationItem {
  id: number;
  title: string;
  content: string;
  type?: string;
  category?: string;
  createTime?: string;
  isRead?: number | boolean;
}

function formatTime(value?: string) {
  if (!value) return '刚刚';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function getTypeLabel(item: NotificationItem) {
  return item.category || item.type || '系统通知';
}

export default function MobileNotificationsPage() {
  const navigate = useNavigate();
  const { data, isLoading, isFetching, isError, error, refetch } = useQuery({
    queryKey: ['mobile', 'notifications'],
    queryFn: async () => {
      return http.get<NotificationItem[]>('/mobile/notifications');
    },
    staleTime: 1000 * 30,
  });

  if (isError) {
    return (
      <PageTransition>
        <ErrorState
          title="通知加载失败"
          description={(error as Error)?.message || '获取消息通知失败'}
          onRetry={() => refetch()}
        />
      </PageTransition>
    );
  }

  const notifications = data ?? [];
  const unreadCount = notifications.filter((item) => item.isRead === 0 || item.isRead === false).length;

  return (
    <PageTransition>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderRadius: 14,
          padding: '14px 16px',
          background: 'linear-gradient(135deg, #fff7ed 0%, #f8fafc 100%)',
          border: '1px solid #fed7aa',
        }}>
          <div>
            <div style={{ fontSize: 13, color: '#64748b' }}>未读通知</div>
            <div style={{ fontSize: 24, fontWeight: 800, color: '#0f172a' }}>{unreadCount}</div>
          </div>
          <button
            type="button"
            onClick={() => refetch()}
            style={{
              width: 42,
              height: 42,
              border: 'none',
              borderRadius: 12,
              backgroundColor: '#ffedd5',
              color: '#ea580c',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
            }}
            aria-label="刷新通知"
          >
            {isFetching && !isLoading ? <RefreshCw size={20} className="animate-spin" /> : <Bell size={22} />}
          </button>
        </div>

        {isLoading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {[1, 2, 3].map((i) => <SkeletonCard key={i} />)}
          </div>
        ) : notifications.length === 0 ? (
          <EmptyState title="暂无未读通知" description="新的消息会显示在这里" />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {notifications.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => navigate('/notifications')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  padding: 14,
                  borderRadius: 14,
                  border: '1px solid #e2e8f0',
                  backgroundColor: '#fff',
                  boxShadow: '0 8px 24px rgba(15,23,42,0.06)',
                  textAlign: 'left',
                  cursor: 'pointer',
                }}
              >
                <div style={{
                  width: 40,
                  height: 40,
                  borderRadius: 12,
                  backgroundColor: '#fff7ed',
                  color: '#ea580c',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}>
                  <Inbox size={18} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 8,
                    marginBottom: 4,
                  }}>
                    <span style={{
                      fontSize: 14,
                      fontWeight: 700,
                      color: '#0f172a',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}>
                      {item.title || '未命名通知'}
                    </span>
                    <span style={{
                      fontSize: 11,
                      fontWeight: 600,
                      color: '#ea580c',
                      backgroundColor: '#fff7ed',
                      padding: '2px 7px',
                      borderRadius: 999,
                      whiteSpace: 'nowrap',
                    }}>
                      {getTypeLabel(item)}
                    </span>
                  </div>
                  <div style={{
                    fontSize: 12,
                    color: '#64748b',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}>
                    {item.content || '无通知内容'}
                  </div>
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4,
                    marginTop: 8,
                    fontSize: 11,
                    color: '#94a3b8',
                  }}>
                    <Clock size={12} />
                    <span>{formatTime(item.createTime)}</span>
                  </div>
                </div>
                <ChevronRight size={16} color="#cbd5e1" />
              </button>
            ))}
          </div>
        )}
      </div>
    </PageTransition>
  );
}
