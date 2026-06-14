/**
 * @file pages/mobile/MobileWorkOrdersPage.tsx
 * @description 移动端待办工单列表
 */

import { useState } from 'react';
import { useNavigate } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, ChevronRight, Clock, ClipboardList, RefreshCw } from 'lucide-react';
import { PageTransition, ErrorState, EmptyState, SkeletonCard } from '@/components/ui';
import http from '@/utils/http';

interface WorkOrderItem {
  id: number;
  workOrderNo: string;
  title: string;
  status: string;
  priority: string;
  assetName?: string;
  createTime?: string;
}

interface MobilePageData<T> {
  records: T[];
  total: number;
  page: number;
  pageSize: number;
}

const STATUS_STYLE: Record<string, { label: string; color: string; bg: string }> = {
  PENDING: { label: '待处理', color: '#2563eb', bg: '#eff6ff' },
  IN_PROGRESS: { label: '进行中', color: '#ca8a04', bg: '#fefce8' },
  APPROVING_LEVEL_1: { label: '审批中', color: '#9333ea', bg: '#faf5ff' },
  APPROVED: { label: '已审批', color: '#0f766e', bg: '#ecfdf5' },
  EXECUTING: { label: '执行中', color: '#ca8a04', bg: '#fefce8' },
};

const PRIORITY_STYLE: Record<string, { label: string; color: string; bg: string }> = {
  LOW: { label: '低', color: '#64748b', bg: '#f8fafc' },
  MEDIUM: { label: '中', color: '#2563eb', bg: '#eff6ff' },
  HIGH: { label: '高', color: '#ca8a04', bg: '#fefce8' },
  CRITICAL: { label: '紧急', color: '#dc2626', bg: '#fef2f2' },
};

function getStatusStyle(status: string) {
  return STATUS_STYLE[status] || { label: status || '未知', color: '#64748b', bg: '#f8fafc' };
}

function getPriorityStyle(priority: string) {
  return PRIORITY_STYLE[priority] || { label: priority || '未定', color: '#64748b', bg: '#f8fafc' };
}

export default function MobileWorkOrdersPage() {
  const navigate = useNavigate();
  const [pageSize, setPageSize] = useState(20);

  const { data, isLoading, isFetching, isError, error, refetch } = useQuery({
    queryKey: ['mobile', 'work-orders', pageSize],
    queryFn: async () => {
      return http.get<MobilePageData<WorkOrderItem>>('/mobile/work-orders', { params: { page: 1, pageSize } });
    },
    staleTime: 1000 * 60,
  });

  if (isError) {
    return (
      <PageTransition>
        <ErrorState
          title="待办加载失败"
          description={(error as Error)?.message || '获取待办工单失败'}
          onRetry={() => refetch()}
        />
      </PageTransition>
    );
  }

  const records = data?.records ?? [];
  const hasMore = data ? records.length < data.total : false;

  return (
    <PageTransition>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderRadius: 14,
          padding: '14px 16px',
          background: 'linear-gradient(135deg, #eff6ff 0%, #f8fafc 100%)',
          border: '1px solid #dbeafe',
        }}>
          <div>
            <div style={{ fontSize: 13, color: '#64748b' }}>待办工单</div>
            <div style={{ fontSize: 24, fontWeight: 800, color: '#0f172a' }}>{data?.total ?? 0}</div>
          </div>
          <div style={{
            width: 42,
            height: 42,
            borderRadius: 12,
            backgroundColor: '#dbeafe',
            color: '#2563eb',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            <ClipboardList size={22} />
          </div>
        </div>

        {isLoading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {[1, 2, 3].map((i) => <SkeletonCard key={i} />)}
          </div>
        ) : records.length === 0 ? (
          <EmptyState title="暂无待办工单" description="当前没有需要处理的工单" />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {records.map((wo) => {
              const status = getStatusStyle(wo.status);
              const priority = getPriorityStyle(wo.priority);
              return (
                <button
                  key={wo.id}
                  type="button"
                  onClick={() => navigate(`/workorders/${wo.id}`)}
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
                    backgroundColor: priority.bg,
                    color: priority.color,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}>
                    {wo.priority === 'CRITICAL' ? <AlertTriangle size={18} /> : <Clock size={18} />}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                      fontSize: 14,
                      fontWeight: 700,
                      color: '#0f172a',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}>
                      {wo.title || wo.workOrderNo}
                    </div>
                    <div style={{
                      marginTop: 3,
                      fontSize: 12,
                      color: '#64748b',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}>
                      {wo.workOrderNo}{wo.assetName ? ` · ${wo.assetName}` : ''}
                    </div>
                    <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
                      <span style={{
                        fontSize: 11,
                        fontWeight: 600,
                        color: status.color,
                        backgroundColor: status.bg,
                        padding: '2px 8px',
                        borderRadius: 999,
                      }}>
                        {status.label}
                      </span>
                      <span style={{
                        fontSize: 11,
                        fontWeight: 600,
                        color: priority.color,
                        backgroundColor: priority.bg,
                        padding: '2px 8px',
                        borderRadius: 999,
                      }}>
                        {priority.label}优先级
                      </span>
                    </div>
                  </div>
                  <ChevronRight size={16} color="#cbd5e1" />
                </button>
              );
            })}
          </div>
        )}

        <div style={{ textAlign: 'center', padding: '8px 0 16px' }}>
          {isFetching && !isLoading ? (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: '#94a3b8', fontSize: 13 }}>
              <RefreshCw size={14} className="animate-spin" /> 刷新中
            </span>
          ) : hasMore ? (
            <button
              type="button"
              onClick={() => setPageSize((size) => size + 20)}
              style={{
                border: '1px solid #dbeafe',
                backgroundColor: '#fff',
                color: '#2563eb',
                borderRadius: 10,
                padding: '9px 22px',
                fontSize: 13,
                fontWeight: 600,
              }}
            >
              加载更多
            </button>
          ) : records.length > 0 ? (
            <span style={{ color: '#cbd5e1', fontSize: 12 }}>已加载全部</span>
          ) : null}
        </div>
      </div>
    </PageTransition>
  );
}
