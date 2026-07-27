/**
 * @file pages/mobile/MobileAssetListPage.tsx
 * @description 移动端资产列表 — 搜索 + 状态筛选 + 卡片列表
 */

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, CheckCircle2, ChevronRight, Clock, Package, Search, Wrench } from 'lucide-react';
import { PageTransition, ErrorState, EmptyState } from '@/components/ui';
import http from '@/utils/http';

interface AssetItem {
  id: number;
  assetNo: string;
  assetName: string;
  status: string;
  locationName: string | null;
  model: string | null;
  brand: string | null;
  createTime: string;
}

interface AssetListData {
  records: AssetItem[];
  total: number;
  page: number;
  pageSize: number;
}

const PAGE_STEP = 20;

const STATUS_TABS = [
  { value: '', label: '全部' },
  { value: 'IN_USE', label: '在用' },
  { value: 'IDLE', label: '闲置' },
  { value: 'MAINTENANCE', label: '维修' },
  { value: 'SCRAPPED', label: '报废' },
];

const STATUS_STYLE: Record<string, { label: string; color: string; bg: string; icon: ReactNode }> = {
  IN_USE: { label: '在用', color: '#16a34a', bg: '#f0fdf4', icon: <CheckCircle2 size={12} /> },
  IDLE: { label: '闲置', color: '#ca8a04', bg: '#fefce8', icon: <Clock size={12} /> },
  MAINTENANCE: { label: '维修', color: '#dc2626', bg: '#fef2f2', icon: <Wrench size={12} /> },
  SCRAPPED: { label: '报废', color: '#64748b', bg: '#f1f5f9', icon: <AlertTriangle size={12} /> },
};

function getStatusStyle(status: string) {
  return STATUS_STYLE[status] || { label: status, color: '#64748b', bg: '#f8fafc', icon: <Package size={12} /> };
}

export default function MobileAssetListPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const loaderRef = useRef<HTMLDivElement>(null);

  const [keyword, setKeyword] = useState('');
  const [searchText, setSearchText] = useState('');
  const [status, setStatus] = useState(searchParams.get('status') || '');
  const [pageSize, setPageSize] = useState(PAGE_STEP);

  useEffect(() => {
    setStatus(searchParams.get('status') || '');
    setPageSize(PAGE_STEP);
  }, [searchParams]);

  const { data, isLoading, isFetching, isError, error } = useQuery({
    queryKey: ['mobile', 'assets', pageSize, status, searchText],
    queryFn: async () => {
      const params: Record<string, unknown> = { page: 1, pageSize };
      if (status) params.status = status;
      if (searchText) params.keyword = searchText;
      return http.get<AssetListData>('/mobile/assets', { params });
    },
    staleTime: 1000 * 30,
  });

  const handleSearch = () => {
    setSearchText(keyword.trim());
    setPageSize(PAGE_STEP);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSearch();
  };

  const handleStatusChange = (nextStatus: string) => {
    setStatus(nextStatus);
    setPageSize(PAGE_STEP);
  };

  const clearSearch = () => {
    setKeyword('');
    setSearchText('');
    setPageSize(PAGE_STEP);
  };

  if (isError) {
    return (
      <PageTransition>
        <ErrorState
          title="加载失败"
          description={(error as Error)?.message || '获取资产列表失败'}
          onRetry={() => window.location.reload()}
        />
      </PageTransition>
    );
  }

  const records = data?.records || [];
  const hasMore = data ? records.length < data.total : false;

  return (
    <PageTransition>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          backgroundColor: '#fff',
          borderRadius: 10,
          padding: '0 12px',
          gap: 8,
          border: '1px solid #e2e8f0',
        }}>
          <Search size={18} color="#94a3b8" />
          <input
            type="text"
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="搜索资产编号/名称"
            style={{
              flex: 1,
              border: 'none',
              outline: 'none',
              padding: '12px 0',
              fontSize: 14,
              color: '#0f172a',
              backgroundColor: 'transparent',
              minWidth: 0,
            }}
          />
          {keyword && (
            <button
              type="button"
              onClick={clearSearch}
              style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: 4, fontSize: 16 }}
              aria-label="清空搜索"
            >
              x
            </button>
          )}
          <button
            type="button"
            onClick={handleSearch}
            style={{
              backgroundColor: '#2563eb',
              color: '#fff',
              border: 'none',
              borderRadius: 8,
              padding: '6px 14px',
              fontSize: 13,
              fontWeight: 500,
              cursor: 'pointer',
            }}
          >
            搜索
          </button>
        </div>

        <div style={{
          display: 'flex',
          gap: 8,
          overflow: 'auto',
          WebkitOverflowScrolling: 'touch',
          paddingBottom: 4,
        }}>
          {STATUS_TABS.map((tab) => (
            <button
              key={tab.value}
              type="button"
              onClick={() => handleStatusChange(tab.value)}
              style={{
                flexShrink: 0,
                padding: '6px 16px',
                borderRadius: 20,
                border: '1px solid',
                fontSize: 13,
                fontWeight: 500,
                cursor: 'pointer',
                transition: 'all 0.15s',
                borderColor: status === tab.value ? '#2563eb' : '#e2e8f0',
                color: status === tab.value ? '#fff' : '#475569',
                backgroundColor: status === tab.value ? '#2563eb' : '#fff',
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {isLoading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: '20px 0' }}>
            {[1, 2, 3].map((item) => (
              <div key={item} className="h-20 bg-gray-100 rounded-xl animate-pulse" />
            ))}
          </div>
        ) : records.length === 0 ? (
          <div style={{ padding: '60px 0', fontSize: 14 }} className="flex flex-col items-center">
            <EmptyState title="暂无资产数据" description="没有找到匹配的资产，请调整搜索条件" />
          </div>
        ) : (
          <>
            <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 4 }}>共 {data?.total || 0} 条</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {records.map((asset: any) => {
                const s = getStatusStyle(asset.status);
                return (
                  <button
                    key={asset.id}
                    type="button"
                    onClick={() => navigate(`/m/assets/${asset.id}`)}
                    style={{
                      width: '100%',
                      backgroundColor: '#fff',
                      border: 'none',
                      borderRadius: 12,
                      padding: 14,
                      boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 12,
                      textAlign: 'left',
                    }}
                  >
                    <div style={{
                      width: 40,
                      height: 40,
                      borderRadius: 10,
                      backgroundColor: s.bg,
                      color: s.color,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                    }}>
                      {s.icon}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{
                        fontSize: 14,
                        fontWeight: 600,
                        color: '#0f172a',
                        marginBottom: 2,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}>
                        {asset.assetName}
                      </div>
                      <div style={{
                        fontSize: 12,
                        color: '#64748b',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}>
                        {asset.assetNo}
                        {asset.model ? ` · ${asset.model}` : ''}
                        {asset.locationName ? ` · ${asset.locationName}` : ''}
                      </div>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4, flexShrink: 0 }}>
                      <span style={{
                        fontSize: 11,
                        fontWeight: 500,
                        color: s.color,
                        backgroundColor: s.bg,
                        padding: '2px 8px',
                        borderRadius: 10,
                      }}>
                        {s.label}
                      </span>
                      <ChevronRight size={14} color="#cbd5e1" />
                    </div>
                  </button>
                );
              })}
            </div>

            <div ref={loaderRef} style={{ textAlign: 'center', padding: '16px 0' }}>
              {isFetching ? (
                <span style={{ color: '#94a3b8', fontSize: 13 }}>加载中...</span>
              ) : hasMore ? (
                <button
                  type="button"
                  onClick={() => setPageSize((size) => size + PAGE_STEP)}
                  style={{
                    background: 'none',
                    border: '1px solid #e2e8f0',
                    borderRadius: 8,
                    padding: '8px 24px',
                    color: '#2563eb',
                    fontSize: 13,
                    cursor: 'pointer',
                  }}
                >
                  加载更多
                </button>
              ) : (
                <span style={{ color: '#cbd5e1', fontSize: 12 }}>已加载全部</span>
              )}
            </div>
          </>
        )}
      </div>
    </PageTransition>
  );
}
