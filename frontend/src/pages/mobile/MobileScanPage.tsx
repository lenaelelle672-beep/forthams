/**
 * @file pages/mobile/MobileScanPage.tsx
 * @description 移动端扫码页面 — 手动输入条码/RFID + 扫码结果展示
 *
 * 注意：实际摄像头扫码需要 HTTPS 环境且调用 getUserMedia API。
 * 当前版本提供手动输入模式 + 模拟扫码UI。生产环境可集成 QuaggaJS / html5-qrcode 等库。
 */

import { useState } from 'react';
import { PageTransition, ErrorState, EmptyState, SkeletonCard } from '@/components/ui';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { useNavigate } from 'react-router';
import http from '@/utils/http';
import {
  ScanLine,
  Package,
  CheckCircle2,
  XCircle,
  Search,
} from 'lucide-react';

/* ── 类型定义 ─────────────────────────────────────────────────────────────── */
interface ScanResult {
  id: number;
  assetNo: string;
  assetName: string;
  status: string;
  model: string | null;
  brand: string | null;
  locationName: string | null;
  rfidTag: string | null;
  originalValue: number | null;
}

const STATUS_MAP: Record<string, { label: string; color: string }> = {
  IN_USE:      { label: '在用', color: '#16a34a' },
  IDLE:        { label: '闲置', color: '#ca8a04' },
  MAINTENANCE: { label: '维修', color: '#dc2626' },
  SCRAPPED:    { label: '报废', color: '#64748b' },
};

/* ── 页面组件 ──────────────────────────────────────────────────────────────── */
function MobileScanContent() {
  const navigate = useNavigate();
  const [code, setCode] = useState('');
  const [scanning, setScanning] = useState(false);
  const [result, setResult] = useState<ScanResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleScan = async () => {
    const trimmed = code.trim();
    if (!trimmed) {
      setError('请输入条码或 RFID 编号');
      return;
    }

    setScanning(true);
    setError(null);
    setResult(null);

    try {
      const res = await http.post<any, any>('/mobile/scan', { code: trimmed });
      if (res.code === 200 && res.data) {
        setResult(res.data);
      } else {
        setError(res.message || '未找到匹配的资产');
      }
    } catch (err: any) {
      setError(err?.response?.data?.message || '查询失败，请检查网络');
    } finally {
      setScanning(false);
    }
  };

  const resetScan = () => {
    setCode('');
    setResult(null);
    setError(null);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleScan();
  };

  return (
    <PageTransition>
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* 扫码区域 */}
      <div style={{
        backgroundColor: '#fff',
        borderRadius: '12px',
        padding: '24px 16px',
        boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
        textAlign: 'center',
      }}>
        <div style={{
          width: '100%',
          aspectRatio: '1',
          maxWidth: '240px',
          margin: '0 auto 16px',
          backgroundColor: '#0a1628',
          borderRadius: '16px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          position: 'relative',
          overflow: 'hidden',
        }}>
          {/* 扫码取景框 */}
          <div style={{
            position: 'absolute',
            top: '20%',
            left: '15%',
            right: '15%',
            bottom: '20%',
            border: '2px solid rgba(37, 99, 235, 0.6)',
            borderRadius: '8px',
          }} />
          {/* 扫描线动画 */}
          <div style={{
            position: 'absolute',
            left: '15%',
            right: '15%',
            height: '2px',
            backgroundColor: '#2563eb',
            opacity: 0.7,
            animation: 'scanLine 2s ease-in-out infinite',
            top: '30%',
          }} />
          <ScanLine size={36} color="rgba(255,255,255,0.3)" />
          <style>{`
            @keyframes scanLine {
              0%, 100% { top: 22%; }
              50% { top: 68%; }
            }
          `}</style>
        </div>
        <div style={{ fontSize: '13px', color: '#64748b', marginBottom: '12px' }}>
          请将条形码 / RFID 对准取景框
        </div>

        {/* 手动输入 */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          border: '1px solid #e2e8f0',
          borderRadius: '10px',
          padding: '0 12px',
          backgroundColor: '#f8fafc',
        }}>
          <Search size={18} color="#94a3b8" />
          <input
            type="text"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="手动输入条码或 RFID 编号"
            style={{
              flex: 1,
              border: 'none',
              outline: 'none',
              padding: '12px 0',
              fontSize: '14px',
              color: '#0f172a',
              backgroundColor: 'transparent',
              minWidth: 0,
            }}
          />
        </div>

        <button
          onClick={handleScan}
          disabled={scanning}
          style={{
            width: '100%',
            marginTop: '12px',
            padding: '14px',
            backgroundColor: scanning ? '#93c5fd' : '#2563eb',
            color: '#fff',
            border: 'none',
            borderRadius: '10px',
            fontSize: '15px',
            fontWeight: 600,
            cursor: scanning ? 'not-allowed' : 'pointer',
            transition: 'background-color 0.15s',
          }}
        >
          {scanning ? '查询中...' : '查 询'}
        </button>

        {result && (
          <button
            onClick={resetScan}
            style={{
              width: '100%',
              marginTop: '8px',
              padding: '10px',
              backgroundColor: '#fff',
              color: '#64748b',
              border: '1px solid #e2e8f0',
              borderRadius: '10px',
              fontSize: '13px',
              cursor: 'pointer',
            }}
          >
            继续扫码
          </button>
        )}
      </div>

      {/* 扫描中骨架 */}
      {scanning && !result && !error && (
        <div className="bg-white rounded-xl p-4 shadow-sm">
          <SkeletonCard />
        </div>
      )}

      {/* 错误提示 */}
      {error && !result && (
        <ErrorState
          title="查询失败"
          description={error}
          className="!py-3 !px-4 !rounded-xl !bg-red-50"
        />
      )}

      {/* 空状态提示 */}
      {!result && !error && !scanning && (
        <div className="bg-white rounded-xl p-6 shadow-sm text-center">
          <EmptyState
            title="查询资产"
            description="输入条码或 RFID 编号后点击查询"
            className="!py-8"
          />
        </div>
      )}

      {/* 扫描结果 */}
      {result && (
        <div style={{
          backgroundColor: '#fff',
          borderRadius: '12px',
          padding: '16px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            marginBottom: '14px',
            paddingBottom: '12px',
            borderBottom: '1px solid #f1f5f9',
          }}>
            <CheckCircle2 size={18} color="#16a34a" />
            <span style={{ fontSize: '15px', fontWeight: 600, color: '#0f172a' }}>
              资产信息
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <ResultRow label="资产名称" value={result.assetName} />
            <ResultRow label="资产编号" value={result.assetNo} />
            <ResultRow label="状态" value={STATUS_MAP[result.status]?.label || result.status}
              color={STATUS_MAP[result.status]?.color} />
            <ResultRow label="型号" value={result.model || '-'} />
            <ResultRow label="品牌" value={result.brand || '-'} />
            <ResultRow label="位置" value={result.locationName || '-'} />
            <ResultRow label="RFID" value={result.rfidTag || '-'} />
            <ResultRow label="原值" value={result.originalValue != null ? `¥${result.originalValue.toLocaleString()}` : '-'} />
          </div>

          <button
            onClick={() => navigate(`/assets/${result.id}`)}
            style={{
              width: '100%',
              marginTop: '14px',
              padding: '12px',
              backgroundColor: '#eff6ff',
              color: '#2563eb',
              border: '1px solid #bfdbfe',
              borderRadius: '10px',
              fontSize: '14px',
              fontWeight: 500,
              cursor: 'pointer',
            }}
          >
            查看完整详情
          </button>
        </div>
      )}
    </div>
</PageTransition>
  );
}

/* ── 导出页面 ──────────────────────────────────────────────────────────────── */
export default function MobileScanPage() {
  return (
    <ErrorBoundary>
      <MobileScanContent />
    </ErrorBoundary>
  );
}

/* ── 子组件 ──────────────────────────────────────────────────────────────── */
function ResultRow({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <span style={{ fontSize: '13px', color: '#64748b' }}>{label}</span>
      <span style={{
        fontSize: '13px',
        fontWeight: 500,
        color: color || '#0f172a',
        textAlign: 'right',
      }}>
        {value}
      </span>
    </div>
    
  );
}
