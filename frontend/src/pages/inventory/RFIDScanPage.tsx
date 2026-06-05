/**
 * @file pages/inventory/RFIDScanPage.tsx
 * @description RFID 扫描大屏页 — 克制现代化视觉打磨
 * 保留所有核心业务逻辑：5 秒轮询、扫描状态机、扫描动画、日志终端、API 调用、mutations、派生数据
 *
 * API 绑定:
 *   - getTaskAssets(taskId)        → 盘点资产列表
 *   - confirmAsset(taskId, assetId, data) → 单条确认
 *   - batchConfirmAssets(taskId, data)    → 批量确认
 *   - submitTask(taskId)           → 提交盘点
 *   - getTaskSummary(taskId)       → 盘盈盘亏差异汇总
 */

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useParams } from 'react-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Radio,
  Play,
  Pause,
  CheckCircle,
  CheckCircle2,
  AlertTriangle,
  ChevronLeft,
  MapPin,
  User,
  Hash,
  Clock,
  CheckCheck,
  Loader2,
  Activity,
  AlertCircle,
  RefreshCw,
  XCircle,
  Copy,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { inventoryService } from '@/api/inventory';
import {
  getTaskAssets,
  confirmAsset,
  batchConfirmAssets,
  submitTask,
  getTaskSummary,
} from '@/api/inventory';
import type { ActualStatus } from '@/types/inventory';

/** Scan result status for individual tag reads */
type ScanResultStatus = 'success' | 'failed' | 'duplicate' | 'abnormal';

/**
 * Detect whether the user prefers reduced motion.
 * Respects the `prefers-reduced-motion` media query per WCAG 2.3.3.
 */
function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mql = window.matchMedia('(prefers-reduced-motion: reduce)');
    const handler = (e: MediaQueryListEvent) => setReduced(e.matches);
    mql.addEventListener('change', handler);
    return () => mql.removeEventListener('change', handler);
  }, []);

  return reduced;
}

/** Scan result entry for the real-time feed */
interface ScanResultEntry {
  id: string;
  assetNo: string;
  name: string;
  time: string;
  status: ScanResultStatus;
  confirmed: boolean;
  assetId: string;
  /** Human-readable status label */
  statusLabel: string;
}

// ── 进度条（视觉升级版）────────────────────────────────────────────────────
function ProgressBar({ value, className }: { value: number; className?: string }) {
  const pct = Math.min(Math.max(value, 0), 100);
  const color = pct >= 90 ? 'bg-gradient-to-r from-emerald-400 to-emerald-500'
    : pct >= 60 ? 'bg-gradient-to-r from-blue-400 to-blue-500'
    : 'bg-gradient-to-r from-amber-400 to-amber-500';
  return (
    <div className={`w-full h-2.5 bg-slate-100 rounded-full overflow-hidden ring-1 ring-slate-200/70 ${className ?? ''}`}>
      <div
        className={`h-full rounded-full transition-all duration-700 ease-out shadow-sm ${color}`}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

// ── 闪光动效组件（克制反馈）──────────────────────────────────────────────
/** Renders a brief flash overlay when a new tag is read; disabled when reducedMotion is true */
function ScanFlash({ show, reducedMotion }: { show: boolean; reducedMotion?: boolean }) {
  if (!show) return null;
  if (reducedMotion) {
    return <div className="absolute inset-0 rounded-full bg-blue-400/10 pointer-events-none" />;
  }
  return (
    <>
      <div className="absolute inset-0 rounded-full bg-blue-400/15 animate-ping pointer-events-none" />
    </>
  );
}

// ── 扫描脉冲波纹组件 ─────────────────────────────────────────────────────
/** Renders ripple rings and rotating halo; falls back to a static ring when reducedMotion is true */
function ScanRipples({ active, reducedMotion }: { active: boolean; reducedMotion?: boolean }) {
  if (!active) return null;
  if (reducedMotion) {
    return <div className="absolute inset-0 rounded-full border-2 border-blue-400/20 pointer-events-none" />;
  }
  return (
    <>
      <div className="absolute inset-0 rounded-full border-2 border-blue-300/40 animate-ping" />
      <div className="absolute inset-5 rounded-full border border-blue-200/70 pointer-events-none" />
    </>
  );
}

// ── 主组件 ───────────────────────────────────────────────────────────────
export default function RFIDScanPage() {
  const { taskId } = useParams<{ taskId: string }>();
  const qc = useQueryClient();
  const prefersReducedMotion = usePrefersReducedMotion();

  const [scanning, setScanning] = useState(false);
  const [paused, setPaused] = useState(false);
  const [flash, setFlash] = useState(false);
  const [scanLog, setScanLog] = useState<string[]>([
    '[系统] RFID扫描器已就绪',
    '[系统] 等待开始扫描...',
  ]);
  const logRef = useRef<HTMLDivElement>(null);

  // ── 查询任务详情 ─────────────────────────────────────────────────────────────
  const { data: taskDetail } = useQuery({
    queryKey: ['inventory', 'task', taskId],
    queryFn: () => inventoryService.getTask(taskId!),
    enabled: !!taskId,
    staleTime: 1000 * 30,
  });

  const { data: detailRecords } = useQuery({
    queryKey: ['inventory', 'task', taskId, 'details'],
    queryFn: () => inventoryService.getTaskDetails(taskId!),
    enabled: !!taskId,
    staleTime: 1000 * 30,
  });

  // ── 盘点资产列表 (getTaskAssets) ────────────────────────────────────────────
  const { data: assetsResponse } = useQuery({
    queryKey: ['inventory', 'task', taskId, 'assets'],
    queryFn: () => getTaskAssets(taskId!, { page: 1, pageSize: 100 }),
    enabled: !!taskId,
    staleTime: 1000 * 30,
  });

  // ── 盘盈盘亏汇总 (getTaskSummary) ──────────────────────────────────────────
  const { data: summaryResponse } = useQuery({
    queryKey: ['inventory', 'task', taskId, 'summary'],
    queryFn: () => getTaskSummary(taskId!),
    enabled: !!taskId,
    staleTime: 1000 * 30,
  });

  // ── 单条确认资产 (confirmAsset) ─────────────────────────────────────────────
  /** 确认单条资产的实际状态 */
  const confirmMutation = useMutation({
    mutationFn: ({
      assetId,
      actualStatus,
      remark,
    }: {
      assetId: string;
      actualStatus: ActualStatus;
      remark?: string;
    }) => confirmAsset(taskId!, assetId, { actualStatus, remark }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['inventory', 'task', taskId, 'assets'] });
      qc.invalidateQueries({ queryKey: ['inventory', 'task', taskId, 'summary'] });
    },
    onError: (err) => {
      const now = new Date().toLocaleTimeString('zh-CN', { hour12: false });
      setScanLog((prev) => [...prev, `[${now}] ✗ 确认失败: ${err instanceof Error ? err.message : '未知错误'}`]);
    },
  });

  // ── 批量确认资产 (batchConfirmAssets) ───────────────────────────────────────
  /** 批量确认多条未盘点资产 */
  const batchConfirmMutation = useMutation({
    mutationFn: (data: {
      assetIds: string[];
      actualStatus: ActualStatus;
      remark?: string;
    }) => batchConfirmAssets(taskId!, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['inventory', 'task', taskId, 'assets'] });
      qc.invalidateQueries({ queryKey: ['inventory', 'task', taskId, 'summary'] });
      const now = new Date().toLocaleTimeString('zh-CN', { hour12: false });
      setScanLog((prev) => [...prev, `[${now}] ✓ 批量确认成功`]);
    },
    onError: (err) => {
      const now = new Date().toLocaleTimeString('zh-CN', { hour12: false });
      setScanLog((prev) => [...prev, `[${now}] ✗ 批量确认失败: ${err instanceof Error ? err.message : '未知错误'}`]);
    },
  });

  // ── 提交盘点任务 (submitTask) ──────────────────────────────────────────────
  /** 提交当前盘点任务进入审核流程 */
  const submitMutation = useMutation({
    mutationFn: () => submitTask(taskId!),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['inventory', 'task', taskId] });
      qc.invalidateQueries({ queryKey: ['inventory', 'task', taskId, 'assets'] });
      qc.invalidateQueries({ queryKey: ['inventory', 'task', taskId, 'summary'] });
      setScanning(false);
      setPaused(false);
      const now = new Date().toLocaleTimeString('zh-CN', { hour12: false });
      setScanLog((prev) => [...prev, `[${now}] ✓ 盘点任务已提交，等待核准`]);
    },
    onError: (err) => {
      const now = new Date().toLocaleTimeString('zh-CN', { hour12: false });
      setScanLog((prev) => [...prev, `[${now}] ✗ 提交失败: ${err instanceof Error ? err.message : '未知错误'}`]);
    },
  });

  // ── 派生数据 ────────────────────────────────────────────────────────────────
  const assets = assetsResponse?.records ?? [];
  const summary = summaryResponse;
  const unconfirmedAssets = assets.filter((a) => !a.confirmed);

  const task = taskDetail?.task
    ? {
        id: String(taskDetail.task.id),
        taskNo: taskDetail.task.taskNo,
        taskName: taskDetail.task.taskName ?? 'RFID扫描任务',
        location: taskDetail.task.location ?? '—',
        responsible: String(taskDetail.task.executorId ?? '—'),
        totalAssets: taskDetail.task.totalCount ?? 0,
        scanned: taskDetail.task.matchedCount ?? 0,
        progress: taskDetail.task.totalCount
          ? Math.round(((taskDetail.task.matchedCount ?? 0) / taskDetail.task.totalCount) * 100)
          : 0,
        status: taskDetail.task.status,
        startDate: taskDetail.task.startDate ?? '—',
        endDate: taskDetail.task.endDate ?? '—',
      }
    : null;

  const recentScans = assets.length > 0
    ? assets.slice(0, 5).map((a) => ({
        id: a.assetId,
        assetNo: a.assetCode,
        name: a.assetName,
        time: a.confirmedAt?.substring(11, 19) ?? '—',
        status: a.confirmed ? 'match' : 'mismatch',
        confirmed: a.confirmed,
        assetId: a.assetId,
      }))
    : detailRecords && detailRecords.length > 0
      ? detailRecords.slice(0, 5).map((r) => ({
          id: String(r.id),
          assetNo: String(r.assetId),
          name: r.rfidTag ?? '未知资产',
          time: r.scanTime?.substring(11, 19) ?? '—',
          status: r.status === 'MATCH' ? 'match' : 'mismatch',
          confirmed: r.status === 'MATCH',
          assetId: String(r.assetId),
        }))
      : [];

  const discrepancies = [
    ...(summary?.surplusItems ?? []).map((item, i) => ({
      id: `surplus-${i}`,
      assetNo: item.assetCode,
      name: item.assetName,
      type: '盘盈' as const,
      detail: item.reason ?? '盘盈资产',
    })),
    ...(summary?.deficitItems ?? []).map((item, i) => ({
      id: `deficit-${i}`,
      assetNo: item.assetCode,
      name: item.assetName,
      type: '盘亏' as const,
      detail: item.reason ?? '盘亏资产',
    })),
  ];

  const discrepancyCount = (summary?.surplusCount ?? 0) + (summary?.deficitCount ?? 0);

  // ── 扫描时轮询真实资产数据（每 5 秒）──── 核心机制，不得修改 ──────────────
  useEffect(() => {
    if (!scanning || paused) return;
    const timer = setInterval(() => {
      qc.invalidateQueries({ queryKey: ['inventory', 'task', taskId, 'assets'] });
      qc.invalidateQueries({ queryKey: ['inventory', 'task', taskId, 'summary'] });
      qc.invalidateQueries({ queryKey: ['inventory', 'task', taskId] });
      const now = new Date().toLocaleTimeString('zh-CN', { hour12: false });
      setScanLog((prev) => [...prev.slice(-30), `[${now}] 同步最新扫描数据...`]);
      setFlash(true);
      setTimeout(() => setFlash(false), 300);
    }, 5000);
    return () => clearInterval(timer);
  }, [scanning, paused, taskId, qc]);

  // 自动滚动日志
  useEffect(() => {
    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight;
    }
  }, [scanLog]);

  const handleStartPause = () => {
    if (!scanning) {
      setScanning(true);
      setPaused(false);
      const now = new Date().toLocaleTimeString('zh-CN', { hour12: false });
      setScanLog((prev) => [...prev, `[${now}] RFID 扫描器 RFID-01 已连接`, `[${now}] 开始扫描...`]);
    } else {
      setPaused((p) => !p);
      const now = new Date().toLocaleTimeString('zh-CN', { hour12: false });
      setScanLog((prev) => [...prev, `[${now}] ${paused ? '继续扫描...' : '扫描已暂停'}`]);
    }
  };

  const handleSubmit = () => {
    submitMutation.mutate();
    const now = new Date().toLocaleTimeString('zh-CN', { hour12: false });
    setScanLog((prev) => [...prev, `[${now}] 提交盘点任务，等待核准...`]);
  };

  const handleConfirmAsset = useCallback(
    (assetId: string) => {
      confirmMutation.mutate({ assetId, actualStatus: 'normal' });
      const now = new Date().toLocaleTimeString('zh-CN', { hour12: false });
      setScanLog((prev) => [...prev, `[${now}] ✓ 确认资产 ${assetId}`]);
    },
    [confirmMutation],
  );

  const handleBatchConfirm = () => {
    if (unconfirmedAssets.length === 0) return;
    batchConfirmMutation.mutate({
      assetIds: unconfirmedAssets.map((a) => a.assetId),
      actualStatus: 'normal',
    });
    const now = new Date().toLocaleTimeString('zh-CN', { hour12: false });
    setScanLog((prev) => [
      ...prev,
      `[${now}] ✓ 批量确认 ${unconfirmedAssets.length} 条资产`,
    ]);
  };

  // ── 加载态 ──────────────────────────────────────────────────────────────────
  if (!task) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#f8fafc] via-white to-[#eef2f7] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="relative">
            <Loader2 className="w-8 h-8 animate-spin text-[#2563eb]" />
            <div className="absolute inset-0 w-8 h-8 rounded-full bg-blue-400/10" />
          </div>
          <span className="text-[#64748b] text-sm">加载任务数据中...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#f8fafc] via-white to-[#eef2f7] p-4 sm:p-6">
      <div className="max-w-[1400px] mx-auto space-y-6">

        {/* ═══════════════════════════════════════════════════════════════════════
            顶部任务概览栏 — 浅色企业风格
           ═══════════════════════════════════════════════════════════════════════ */}
        <div className="bg-white/90 border border-[#e2e8f0] rounded-2xl p-5 shadow-sm ring-1 ring-white/60">
          <div className="flex items-start justify-between flex-wrap gap-4">
            <div className="flex items-center gap-4">
              {/* 返回按钮 — 更醒目 */}
              <a
                href="/inventory"
                className="flex items-center gap-1.5 px-3 py-1.5 bg-[#f8fafc] hover:bg-blue-50 border border-[#e2e8f0] rounded-lg text-sm text-[#475569] hover:text-[#2563eb] transition-all"
              >
                <ChevronLeft className="w-4 h-4" />
                返回盘点列表
              </a>
              <div className="w-px h-6 bg-[#e2e8f0]" />
              <div>
                <div className="flex items-center gap-3 mb-1">
                  <div className="p-1.5 rounded-lg bg-blue-50">
                    <Radio className="w-4 h-4 text-[#2563eb]" />
                  </div>
                  <h1 className="text-lg font-bold text-[#0f172a]">{task.taskName}</h1>
                  <span className={`px-2.5 py-0.5 text-xs font-semibold rounded-full ${
                    task.status === 'IN_PROGRESS' || task.status === '进行中'
                      ? 'bg-blue-50 text-blue-700 border border-blue-200'
                      : task.status === 'COMPLETED' || task.status === '已完成'
                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                      : 'bg-slate-50 text-slate-600 border border-slate-200'
                  }`}>
                    {task.status === 'IN_PROGRESS' ? '进行中' :
                     task.status === 'COMPLETED' ? '已完成' :
                     task.status === 'PENDING' ? '待开始' : task.status}
                  </span>
                </div>
                <div className="flex items-center gap-4 text-sm text-[#64748b]">
                  <span className="flex items-center gap-1.5"><Hash className="w-3.5 h-3.5" />{task.taskNo}</span>
                  <span className="flex items-center gap-1.5"><MapPin className="w-3.5 h-3.5" />{task.location}</span>
                  <span className="flex items-center gap-1.5"><User className="w-3.5 h-3.5" />{task.responsible}</span>
                  <span className="flex items-center gap-1.5"><Clock className="w-3.5 h-3.5" />{task.startDate} → {task.endDate}</span>
                </div>
              </div>
            </div>
            {/* 进度 */}
            <div className="min-w-[220px]">
              <div className="flex justify-between text-sm mb-1.5">
                <span className="text-[#64748b]">盘点进度</span>
                <span className="font-bold text-[#0f172a]">{task.scanned} / {task.totalAssets}</span>
              </div>
              <ProgressBar value={task.progress} />
              <div className="flex justify-between items-center mt-1">
                <span className="text-xs text-[#94a3b8]">{task.progress}%</span>
                <span className="text-xs text-[#94a3b8] flex items-center gap-1">
                  <Activity className="w-3 h-3" />
                  {scanning && !paused ? '扫描中...' : paused ? '已暂停' : '就绪'}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* ═══════════════════════════════════════════════════════════════════════
            主内容区：左侧 2/3 扫描 + 日志 + 控制 / 右侧 1/3 信息面板
           ═══════════════════════════════════════════════════════════════════════ */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* ────────── 左侧：扫描核心区 ────────────────────────────────────── */}
          <div className="lg:col-span-2 space-y-5">

            {/* 扫描核心区 — 浅色企业操作台 */}
            <div className="bg-white/95 border border-[#e2e8f0] rounded-2xl p-6 shadow-sm ring-1 ring-white/60 sm:p-8">
              <div className="flex flex-col items-center gap-8">

                {/* Radio 图标 + 动效 */}
                <div className="relative flex items-center justify-center w-48 h-48">
                  {/* 多层扫描波纹 */}
                  <ScanRipples active={scanning && !paused} reducedMotion={prefersReducedMotion} />
                  {/* 闪光效果 */}
                  <ScanFlash show={flash} reducedMotion={prefersReducedMotion} />
                  {/* 中心图标 */}
                  <div className={(`relative z-10 w-32 h-32 rounded-full flex items-center justify-center transition-all duration-500 ${
                    scanning && !paused
                      ? 'bg-gradient-to-br from-blue-500 to-blue-600 shadow-md shadow-blue-500/20'
                      : paused
                      ? 'bg-gradient-to-br from-amber-400 to-amber-500 shadow-md shadow-amber-500/20'
                      : 'bg-slate-100 border border-slate-200 shadow-sm'
                  }`)}>
                    <Radio className={(`w-16 h-16 ${
                      scanning ? 'text-white' : 'text-[#64748b]'
                    }`)} />
                  </div>
                  {/* 扫描状态指示光晕 */}
                  {scanning && !paused && (
                    <div className="absolute inset-[-8px] rounded-full bg-blue-200/30 blur-xl pointer-events-none" />
                  )}
                </div>

                {/* 状态文字 */}
                <div className="text-center">
                  <p className={(`text-2xl font-bold tracking-wide ${
                    scanning && !paused ? 'text-[#2563eb]' :
                    paused ? 'text-amber-600' :
                    'text-[#64748b]'
                  }`)}>
                    {scanning && !paused ? '● 当前扫描中...' :
                     paused ? '⏸ 扫描已暂停' :
                     '等待开始扫描'}
                  </p>
                  {scanning && !paused && (
                    <div className="flex items-center justify-center gap-2 mt-3">
                      <span className="w-2 h-2 bg-blue-500 rounded-full" />
                      <span className="text-sm text-[#64748b]">RFID-01 扫描器已连接</span>
                      <span className="w-1 h-1 text-[#cbd5e1]">·</span>
                      <span className="text-sm text-[#64748b]">信号强度 98%</span>
                    </div>
                  )}
                </div>

                {/* 实时统计 — 渐变卡片 */}
                <div className="grid w-full max-w-lg grid-cols-1 gap-3 sm:grid-cols-3 sm:gap-4">
                  <div className="text-center bg-blue-50 rounded-xl p-4 border border-blue-100">
                    <p className="text-xs text-blue-700 mb-1">已扫描</p>
                    <p className="text-3xl font-bold text-blue-700 tabular-nums">{task.scanned}</p>
                    <p className="text-[10px] text-blue-500 mt-1">项资产</p>
                  </div>
                  <div className="text-center bg-emerald-50 rounded-xl p-4 border border-emerald-100">
                    <p className="text-xs text-emerald-700 mb-1">扫描速度</p>
                    <p className="text-3xl font-bold text-emerald-700 tabular-nums">{scanning && !paused ? '35' : '0'}<span className="text-lg ml-0.5">/分</span></p>
                    <p className="text-[10px] text-emerald-500 mt-1">实时</p>
                  </div>
                  <div className="text-center bg-slate-50 rounded-xl p-4 border border-slate-200">
                    <p className="text-xs text-[#94a3b8] mb-1">准确率</p>
                    <p className="text-3xl font-bold text-slate-700 tabular-nums">99.5<span className="text-lg">%</span></p>
                    <p className="text-[10px] text-slate-500 mt-1">参考值</p>
                  </div>
                </div>
              </div>
            </div>

            {/* 日志终端 — 浅色事件列表 */}
            <div className="overflow-hidden rounded-[24px] border border-[#e2e8f0] bg-white/95 shadow-sm">
              <div className="flex items-center justify-between px-5 py-3.5 border-b border-[#e2e8f0]">
                <div className="flex items-center gap-2.5">
                  <div className="flex gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-red-500/80" />
                    <span className="w-2.5 h-2.5 rounded-full bg-amber-500/80" />
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500/80" />
                  </div>
                  <span className="text-sm font-medium text-[#0f172a] ml-1">扫描日志</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className={`w-2 h-2 rounded-full ${scanning && !paused ? 'bg-emerald-500' : 'bg-slate-300'}`} />
                  <span className="text-xs text-[#94a3b8]">{scanning && !paused ? '实时' : '停止'}</span>
                </div>
              </div>
              <div
                ref={logRef}
                className="bg-[#f8fafc] text-[#475569] font-mono text-xs p-4 h-44 overflow-y-auto space-y-1"

              >
                {scanLog.map((line, i) => (
                  <div key={i} className={`leading-relaxed ${
                    line.includes('✗') || line.includes('失败') ? 'text-red-600' :
                    line.includes('✓') ? 'text-emerald-600' :
                    line.includes('异常') || line.includes('暂停') ? 'text-amber-600' :
                    line.includes('[系统]') ? 'text-blue-600' :
                    'text-[#64748b]'
                  }`}>
                    <span className="text-[#94a3b8] mr-2">{'>'}</span>{line}
                  </div>
                ))}
                {scanning && !paused && (
                  <div className="text-emerald-500">▋</div>
                )}
              </div>
            </div>

            {/* 底部控制按钮 — 更大更醒目 */}
            <div className="grid gap-3 sm:grid-cols-3">
              <Button
                variant={scanning && !paused ? 'secondary' : 'primary'}
                size="lg"
                className={(`flex-1 h-12 text-base font-semibold ${
                  !scanning
                    ? 'bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 shadow-md shadow-blue-500/15'
                    : paused
                    ? 'bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 shadow-md shadow-blue-500/15'
                    : 'bg-slate-100 hover:bg-slate-200 text-slate-700 shadow-sm'
                }`)}
                onClick={handleStartPause}
              >
                {!scanning ? (
                  <><Play className="w-5 h-5" />开始扫描</>
                ) : paused ? (
                  <><Play className="w-5 h-5" />继续扫描</>
                ) : (
                  <><Pause className="w-5 h-5" />暂停扫描</>
                )}
              </Button>
              <Button
                variant="primary"
                size="lg"
                className={(`flex-1 h-12 text-base font-semibold bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-600 hover:to-green-700 shadow-md shadow-emerald-500/15 ${
                  unconfirmedAssets.length === 0 ? 'opacity-50' : ''
                }`)}
                loading={batchConfirmMutation.isPending}
                disabled={unconfirmedAssets.length === 0}
                onClick={handleBatchConfirm}
              >
                <CheckCheck className="w-5 h-5" />
                批量确认 ({unconfirmedAssets.length})
              </Button>
              <Button
                variant="primary"
                size="lg"
                className={(`flex-1 h-12 text-base font-semibold bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 shadow-md shadow-amber-500/15 ${
                  !scanning && !paused && unconfirmedAssets.length > 0 ? '' : 'opacity-50'
                }`)}
                loading={submitMutation.isPending}
                disabled={!scanning && !paused && unconfirmedAssets.length > 0}
                onClick={handleSubmit}
              >
                <CheckCircle className="w-5 h-5" />
                提交盘点
              </Button>
            </div>
          </div>

          {/* ────────── 右侧：信息面板 ──────────────────────────────────────── */}
          <div className="space-y-5">

            {/* 最近扫描记录 — 企业信息卡 */}
            <div className="overflow-hidden rounded-[24px] border border-[#e2e8f0] bg-white/95 shadow-sm">
              <div className="flex items-center justify-between px-5 py-4 border-b border-[#e2e8f0]">
                <h3 className="text-base font-semibold text-[#0f172a]">最近扫描记录</h3>
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 bg-emerald-500 rounded-full" />
                  <span className="text-xs text-[#94a3b8]">实时更新</span>
                </div>
              </div>
              <div className="divide-y divide-[#f1f5f9]">
                {recentScans.map((scan) => (
                  <div
                    key={scan.id}
                    className={(`px-5 py-3.5 flex items-center justify-between transition-all cursor-pointer ${
                      scan.confirmed ? 'hover:bg-[#f8fafc]' : 'hover:bg-amber-50'
                    }`)}
                    onClick={() => !scan.confirmed && handleConfirmAsset(scan.assetId)}
                    role={scan.confirmed ? undefined : 'button'}
                    tabIndex={scan.confirmed ? undefined : 0}
                    title={scan.confirmed ? '已确认' : '点击确认'}
                  >
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <div className={(`flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center ${
                        scan.confirmed
                          ? 'bg-emerald-50'
                          : 'bg-amber-50'
                      }`)}>
                        {scan.confirmed
                          ? <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                          : <AlertTriangle className="w-4 h-4 text-amber-600" />
                        }
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-[#334155] truncate">{scan.name}</p>
                        <p className="text-xs text-[#94a3b8] truncate">{scan.assetNo}</p>
                      </div>
                    </div>
                    <span className="text-xs text-[#94a3b8] font-mono whitespace-nowrap ml-3">{scan.time}</span>
                  </div>
                ))}
                {recentScans.length === 0 && (
                  <div className="px-5 py-8 text-center text-sm text-[#94a3b8]">暂无扫描记录</div>
                )}
              </div>
            </div>

            {/* 差异列表 — 企业信息卡 */}
            <div className="overflow-hidden rounded-[24px] border border-[#e2e8f0] bg-white/95 shadow-sm">
              <div className="flex items-center justify-between px-5 py-4 border-b border-[#e2e8f0]">
                <h3 className="text-base font-semibold text-[#0f172a]">差异列表</h3>
                <span className={(`px-2.5 py-0.5 text-xs font-bold rounded-full ${
                  discrepancyCount > 0
                    ? 'bg-amber-50 text-amber-700 border border-amber-200'
                    : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                }`)}>
                  {discrepancyCount} 项
                </span>
              </div>
              <div className="divide-y divide-[#f1f5f9]">
                {discrepancies.map((d) => (
                  <div key={d.id} className="px-5 py-3.5 hover:bg-[#f8fafc] transition-colors">
                    <div className="flex items-start gap-3 mb-1">
                      <div className={(`flex-shrink-0 w-7 h-7 rounded-lg flex items-center justify-center ${
                        d.type === '盘亏' ? 'bg-red-50' : 'bg-amber-50'
                      }`)}>
                        <AlertTriangle className={(`w-3.5 h-3.5 ${
                          d.type === '盘亏' ? 'text-red-600' : 'text-amber-600'
                        }`)} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium text-[#334155] truncate">{d.name}</p>
                          <span className={(`ml-auto px-2 py-0.5 text-[10px] font-bold rounded-full flex-shrink-0 ${
                            d.type === '盘亏'
                              ? 'bg-red-50 text-red-700 border border-red-200'
                              : 'bg-amber-50 text-amber-700 border border-amber-200'
                          }`)}>
                            {d.type}
                          </span>
                        </div>
                        <p className="text-xs text-[#94a3b8] mt-0.5 truncate">{d.assetNo}</p>
                      </div>
                    </div>
                    <p className="text-xs text-[#64748b] pl-10">{d.detail}</p>
                  </div>
                ))}
                {discrepancies.length === 0 && (
                  <div className="px-5 py-8 text-center text-sm text-[#94a3b8]">暂无差异</div>
                )}
              </div>
            </div>

            {/* 任务概览 — 企业信息卡 */}
            <div className="overflow-hidden rounded-[24px] border border-[#e2e8f0] bg-white/95 shadow-sm">
              <div className="flex items-center justify-between px-5 py-4 border-b border-[#e2e8f0]">
                <h3 className="text-base font-semibold text-[#0f172a]">任务概览</h3>
              </div>
              <div className="px-5 py-4 space-y-3.5">
                {[
                  { label: '资产总数',  value: task.totalAssets,                 gradient: 'from-blue-700 to-blue-600' },
                  { label: '已盘点',    value: task.scanned,                     gradient: 'from-emerald-700 to-emerald-600' },
                  { label: '未盘点',    value: task.totalAssets - task.scanned,  gradient: 'from-amber-700 to-amber-600' },
                  { label: '差异数量',  value: discrepancyCount,                  gradient: 'from-red-700 to-rose-600' },
                ].map(({ label, value, gradient }) => (
                  <div key={label} className="flex items-center justify-between">
                    <span className="text-sm text-[#64748b]">{label}</span>
                    <span className={(`font-bold text-lg bg-clip-text text-transparent bg-gradient-to-r ${gradient}`)}>{value}</span>
                  </div>
                ))}
                <div className="pt-2 border-t border-[#e2e8f0]">
                  <div className="flex justify-between text-xs text-[#94a3b8] mb-1.5">
                    <span>完成率</span>
                    <span>{task.progress}%</span>
                  </div>
                  <ProgressBar value={task.progress} />
                </div>
              </div>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}
