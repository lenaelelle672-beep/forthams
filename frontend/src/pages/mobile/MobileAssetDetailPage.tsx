/**
 * @file pages/mobile/MobileAssetDetailPage.tsx
 * @description 移动端资产详情
 */

import { useNavigate, useParams } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { ArrowLeft, Banknote, Barcode, Boxes, MapPin, Package, Radio, RefreshCw, Tag } from 'lucide-react';
import { PageTransition, ErrorState, EmptyState, SkeletonCard } from '@/components/ui';
import http from '@/utils/http';

interface AssetDetail {
  id: number;
  assetNo: string;
  assetName: string;
  status: string;
  model?: string | null;
  brand?: string | null;
  serialNo?: string | null;
  supplier?: string | null;
  originalValue?: number | null;
  currentValue?: number | null;
  locationName?: string | null;
  rfidTag?: string | null;
  description?: string | null;
  remark?: string | null;
}

const STATUS_STYLE: Record<string, { label: string; color: string; bg: string }> = {
  IN_USE: { label: '在用', color: '#16a34a', bg: '#f0fdf4' },
  IDLE: { label: '闲置', color: '#ca8a04', bg: '#fefce8' },
  MAINTENANCE: { label: '维修', color: '#dc2626', bg: '#fef2f2' },
  SCRAPPED: { label: '报废', color: '#64748b', bg: '#f1f5f9' },
};

function formatMoney(value?: number | null) {
  if (value == null) return '-';
  return `¥${Number(value).toLocaleString('zh-CN', { maximumFractionDigits: 2 })}`;
}

function statusStyle(status?: string) {
  return STATUS_STYLE[status || ''] || { label: status || '未知', color: '#64748b', bg: '#f8fafc' };
}

export default function MobileAssetDetailPage() {
  const navigate = useNavigate();
  const { id } = useParams();

  const { data, isLoading, isFetching, isError, error, refetch } = useQuery({
    queryKey: ['mobile', 'assets', id],
    enabled: !!id,
    queryFn: () => http.get<AssetDetail>(`/mobile/assets/${id}`),
    staleTime: 1000 * 60,
  });

  if (!id) {
    return (
      <PageTransition>
        <EmptyState title="资产不存在" description="缺少资产 ID" />
      </PageTransition>
    );
  }

  if (isError) {
    return (
      <PageTransition>
        <ErrorState
          title="资产加载失败"
          description={(error as Error)?.message || '获取资产详情失败'}
          onRetry={() => refetch()}
        />
      </PageTransition>
    );
  }

  if (isLoading) {
    return (
      <PageTransition>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {[1, 2, 3].map((item) => <SkeletonCard key={item} />)}
        </div>
      </PageTransition>
    );
  }

  if (!data) {
    return (
      <PageTransition>
        <EmptyState title="资产不存在" description="未找到对应资产" />
      </PageTransition>
    );
  }

  const status = statusStyle(data.status);

  return (
    <PageTransition>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <button
          type="button"
          onClick={() => navigate(-1)}
          style={{
            alignSelf: 'flex-start',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            border: 'none',
            background: 'transparent',
            color: '#64748b',
            fontSize: 13,
            padding: '2px 0',
          }}
        >
          <ArrowLeft size={16} /> 返回
        </button>

        <div style={{
          borderRadius: 16,
          padding: 16,
          background: 'linear-gradient(135deg, #eff6ff 0%, #ffffff 100%)',
          border: '1px solid #dbeafe',
          boxShadow: '0 10px 30px rgba(15,23,42,0.08)',
        }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
            <div style={{
              width: 46,
              height: 46,
              borderRadius: 14,
              backgroundColor: '#dbeafe',
              color: '#2563eb',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}>
              <Package size={23} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 17, fontWeight: 800, color: '#0f172a', lineHeight: 1.35 }}>
                {data.assetName || data.assetNo}
              </div>
              <div style={{ marginTop: 4, fontSize: 12, color: '#64748b' }}>{data.assetNo}</div>
              <span style={{
                display: 'inline-flex',
                marginTop: 10,
                fontSize: 12,
                fontWeight: 700,
                color: status.color,
                backgroundColor: status.bg,
                padding: '3px 9px',
                borderRadius: 999,
              }}>
                {status.label}
              </span>
            </div>
            {isFetching ? <RefreshCw size={16} color="#94a3b8" className="animate-spin" /> : null}
          </div>
        </div>

        <Section title="基础信息">
          <InfoRow icon={<Tag size={15} />} label="品牌" value={data.brand || '-'} />
          <InfoRow icon={<Boxes size={15} />} label="型号" value={data.model || '-'} />
          <InfoRow icon={<Barcode size={15} />} label="序列号" value={data.serialNo || '-'} />
          <InfoRow icon={<Radio size={15} />} label="RFID" value={data.rfidTag || '-'} />
          <InfoRow icon={<MapPin size={15} />} label="当前位置" value={data.locationName || '-'} />
        </Section>

        <Section title="价值信息">
          <InfoRow icon={<Banknote size={15} />} label="原值" value={formatMoney(data.originalValue)} />
          <InfoRow icon={<Banknote size={15} />} label="净值" value={formatMoney(data.currentValue)} />
          <InfoRow icon={<Tag size={15} />} label="供应商" value={data.supplier || '-'} />
        </Section>

        {(data.description || data.remark) && (
          <Section title="备注">
            {data.description ? <TextBlock value={data.description} /> : null}
            {data.remark ? <TextBlock value={data.remark} /> : null}
          </Section>
        )}
      </div>
    </PageTransition>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section style={{
      borderRadius: 14,
      backgroundColor: '#fff',
      border: '1px solid #e2e8f0',
      boxShadow: '0 8px 24px rgba(15,23,42,0.05)',
      overflow: 'hidden',
    }}>
      <div style={{ padding: '12px 14px', borderBottom: '1px solid #f1f5f9', fontSize: 14, fontWeight: 800, color: '#0f172a' }}>
        {title}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column' }}>{children}</div>
    </section>
  );
}

function InfoRow({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: 10,
      padding: '11px 14px',
      borderBottom: '1px solid #f8fafc',
    }}>
      <span style={{ color: '#94a3b8', display: 'flex', alignItems: 'center' }}>{icon}</span>
      <span style={{ width: 70, flexShrink: 0, fontSize: 12, color: '#64748b' }}>{label}</span>
      <span style={{ flex: 1, minWidth: 0, textAlign: 'right', fontSize: 13, fontWeight: 600, color: '#0f172a', overflowWrap: 'anywhere' }}>
        {value}
      </span>
    </div>
  );
}

function TextBlock({ value }: { value: string }) {
  return (
    <div style={{ padding: 14, fontSize: 13, lineHeight: 1.7, color: '#475569', whiteSpace: 'pre-wrap' }}>
      {value}
    </div>
  );
}
