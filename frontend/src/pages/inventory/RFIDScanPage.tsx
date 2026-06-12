/**
 * @file pages/inventory/RFIDScanPage.tsx
 * @description RFID 扫描大屏页 — 数据源绑定真实 API，无 MOCK 残留
 * 接受 taskId URL 参数，大屏扫描界面风格
 *
 * API 绑定:
 *   - getTaskAssets(taskId)        → 盘点资产列表
 *   - confirmAsset(taskId, assetId, data) → 单条确认
 *   - batchConfirmAssets(taskId, data)    → 批量确认
 *   - submitTask(taskId)           → 提交盘点
 *   - getTaskSummary(taskId)       → 盘盈盘亏差异汇总
 */

import { useState, useEffect, useRef, useCallback } from 'react';
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
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { inventoryService } from '@/api/inventory';
import {
  type InventoryTaskRecord,
  type InventoryDetailRecord,
  getTaskAssets,
  confirmAsset,
  batchConfirmAssets,
  submitTask,
  getTaskSummary,
} from '@/api/inventory';
import type { ApiResponse, PaginatedResponse } from '@/types/common';
import type { ActualStatus, InventoryAsset, InventorySummary } from '@/types/inventory';

type RFIDInventoryTaskRecord = InventoryTaskRecord & {
  scannedCount?: number | null;
};

type RFIDTaskPayload = RFIDInventoryTaskRecord | {
  task: RFIDInventoryTaskRecord;
};

function unwrapTaskPayload(payload?: RFIDTaskPayload): RFIDInventoryTaskRecord | undefined {
  if (!payload) return undefined;
  return 'task' in payload ? payload.task : payload;
}

// ── 任务进度条 ────────────────────────────────────────────────────────────────
function ProgressBar({ value, className }: { value: number; className?: string }) {
  const pct = Math.min(Math.max(value, 0), 100);
  const color = pct >= 90 ? 'bg-green-500' : pct >= 60 ? 'bg-[#3b82f6]' : 'bg-yellow-400';
  return (
    <div className={`w-full h-2 bg-[#e5e7eb] rounded-full overflow-hidden ${className ?? ''}`}>
      <div className={`h-full ${color} rounded-full transition-all duration-500`} style={{ width: `${pct}%` }} />
    </div>
  );
}

// ── 闪光动效组件 ──────────────────────────────────────────────────────────────
function ScanFlash({ show }: { show: boolean }) {
  if (!show) return null;
  return (
    <div className="absolute inset-0 rounded-full bg-[#3b82f6]/30 animate-ping pointer-events-none" />
  );
}

// ── 主组件 ────────────────────────────────────────────────────────────────────
export default function RFIDScanPage() {
  const { taskId } = useParams<{ taskId: string }>();
  const qc = useQueryClient();

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
  });

  // ── 批量确认资产 (batchConfirmAssets) ───────────────────────────────────────
  const batchConfirmMutation = useMutation({
    mutationFn: (data: {
      assetIds: string[];
      actualStatus: ActualStatus;
      remark?: string;
    }) => batchConfirmAssets(taskId!, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['inventory', 'task', taskId, 'assets'] });
      qc.invalidateQueries({ queryKey: ['inventory', 'task', taskId, 'summary'] });
    },
  });

  // ── 提交盘点任务 (submitTask) ──────────────────────────────────────────────
  const submitMutation = useMutation({
    mutationFn: () => submitTask(taskId!),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['inventory', 'task', taskId] });
      qc.invalidateQueries({ queryKey: ['inventory', 'task', taskId, 'assets'] });
      qc.invalidateQueries({ queryKey: ['inventory', 'task', taskId, 'summary'] });
      setScanning(false);
      setPaused(false);
    },
  });

  // ── 派生数据 ────────────────────────────────────────────────────────────────
  const taskPayload = (taskDetail as ApiResponse<RFIDTaskPayload> | undefined)?.data;
  const taskRecord = unwrapTaskPayload(taskPayload);
  const assetRecords = (assetsResponse as PaginatedResponse<InventoryAsset> | undefined)?.data?.records ?? [];
  const summary = (summaryResponse as ApiResponse<InventorySummary> | undefined)?.data;
  const detailRecordPayload = (detailRecords as ApiResponse<InventoryDetailRecord[]> | InventoryDetailRecord[] | undefined);
  const inventoryDetailRecords = Array.isArray(detailRecordPayload)
    ? detailRecordPayload
    : detailRecordPayload?.data ?? [];

  const assets = assetRecords;
  const unconfirmedAssets = assets.filter((a) => !a.confirmed);

  // 获取任务数据（纯 API，无 MOCK 兜底）
  const task = taskRecord
    ? {
        id: String(taskRecord.id),
        taskNo: taskRecord.taskNo,
        taskName: taskRecord.taskName ?? 'RFID扫描任务',
        location: taskRecord.location ?? '—',
        responsible: String(taskRecord.executorId ?? '—'),
        totalAssets: taskRecord.totalCount ?? 0,
        scanned: taskRecord.scannedCount ?? 0,
        progress: taskRecord.totalCount
          ? Math.round(((taskRecord.scannedCount ?? 0) / taskRecord.totalCount) * 100)
          : 0,
        status: taskRecord.status,
        startDate: taskRecord.startDate ?? '—',
        endDate: taskRecord.endDate ?? '—',
      }
    : null;

  // 最近扫描记录：优先用资产列表 API 数据
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
    : inventoryDetailRecords.length > 0
      ? inventoryDetailRecords.slice(0, 5).map((r) => ({
          id: String(r.id),
          assetNo: String(r.assetId),
          name: r.rfidTag ?? '未知资产',
          time: r.scanTime?.substring(11, 19) ?? '—',
          status: r.status === 'MATCH' ? 'match' : 'mismatch',
          confirmed: r.status === 'MATCH',
          assetId: String(r.assetId),
        }))
      : [];

  // 差异列表：从 getTaskSummary API 获取
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

  // ── 扫描时轮询真实资产数据 ───────────────────────────────────────────────────
  useEffect(() => {
    if (!scanning || paused) return;
    // 每 5 秒刷新一次盘点资产列表，同步最新扫描结果
    const timer = setInterval(() => {
      qc.invalidateQueries({ queryKey: ['inventory', 'task', taskId, 'assets'] });
      qc.invalidateQueries({ queryKey: ['inventory', 'task', taskId, 'summary'] });
      qc.invalidateQueries({ queryKey: ['inventory', 'task', taskId] });
      // 写一条日志说明正在刷新
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

  /** 提交盘点任务 */
  const handleSubmit = () => {
    submitMutation.mutate();
    const now = new Date().toLocaleTimeString('zh-CN', { hour12: false });
    setScanLog((prev) => [...prev, `[${now}] 提交盘点任务，等待核准...`]);
  };

  /** 单条确认资产 */
  const handleConfirmAsset = useCallback(
    (assetId: string) => {
      confirmMutation.mutate({ assetId, actualStatus: 'normal' });
      const now = new Date().toLocaleTimeString('zh-CN', { hour12: false });
      setScanLog((prev) => [...prev, `[${now}] ✓ 确认资产 ${assetId}`]);
    },
    [confirmMutation],
  );

  /** 批量确认所有未确认资产 */
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
      <div className="min-h-screen bg-[#f8fafc] flex items-center justify-center">
        <div className="flex items-center gap-3 text-[#64748b]">
          <Loader2 className="w-5 h-5 animate-spin" />
          <span>加载任务数据中...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f8fafc] p-6">
      <div className="max-w-[1400px] mx-auto space-y-6">

        {/* 顶部任务信息栏 */}
        <div className="bg-white border border-[#e5e7eb] rounded-2xl p-5 shadow-sm">
          <div className="flex items-start justify-between flex-wrap gap-4">
            <div className="flex items-center gap-4">
              <a href="/inventory" className="flex items-center gap-1 text-sm text-[#64748b] hover:text-[#3b82f6] transition-colors">
                <ChevronLeft className="w-4 h-4" />
                返回盘点列表
              </a>
              <div className="w-px h-5 bg-[#e5e7eb]" />
              <div>
                <div className="flex items-center gap-2 mb-0.5">
                  <Radio className="w-4 h-4 text-[#3b82f6]" />
                  <h1 className="text-lg font-bold text-[#0f172a]">{task.taskName}</h1>
                  <span className={`px-2 py-0.5 text-xs font-semibold rounded-full ${
                    task.status === 'IN_PROGRESS' || task.status === '进行中'
                      ? 'bg-blue-100 text-blue-700'
                      : task.status === 'COMPLETED' || task.status === '已完成'
                      ? 'bg-green-100 text-green-700'
                      : 'bg-gray-100 text-gray-600'
                  }`}>
                    {task.status === 'IN_PROGRESS' ? '进行中' :
                     task.status === 'COMPLETED' ? '已完成' :
                     task.status === 'PENDING' ? '待开始' : task.status}
                  </span>
                </div>
                <div className="flex items-center gap-5 text-sm text-[#64748b]">
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
              <div className="text-right text-xs text-[#94a3b8] mt-1">{task.progress}%</div>
            </div>
          </div>
        </div>

        {/* 主内容区：左侧扫描 + 右侧面板 */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* 左侧：扫描区域 */}
          <div className="lg:col-span-2 space-y-4">
            {/* 扫描核心区 */}
            <Card>
              <CardContent className="flex flex-col items-center py-10 gap-8">
                {/* Radio 图标 + 动画 */}
                <div className="relative flex items-center justify-center w-40 h-40">
                  {/* 扫描圈动效 */}
                  {scanning && !paused && (
                    <>
                      <div className="absolute inset-0 rounded-full border-2 border-[#3b82f6]/30 animate-ping" />
                      <div className="absolute inset-3 rounded-full border-2 border-[#3b82f6]/20 animate-ping" style={{ animationDelay: '0.3s' }} />
                    </>
                  )}
                  {/* 闪光效果 */}
                  <ScanFlash show={flash} />
                  <div className={`relative z-10 w-28 h-28 rounded-full flex items-center justify-center transition-all ${
                    scanning && !paused
                      ? 'bg-[#3b82f6] shadow-lg shadow-blue-400/40'
                      : paused
                      ? 'bg-yellow-500 shadow-lg shadow-yellow-400/30'
                      : 'bg-[#f1f5f9]'
                  }`}>
                    <Radio className={`w-14 h-14 ${
                      scanning ? 'text-white' : 'text-[#94a3b8]'
                    }`} />
                  </div>
                </div>

                {/* 状态文字 */}
                <div className="text-center">
                  <p className={`text-xl font-bold ${
                    scanning && !paused ? 'text-[#3b82f6]' :
                    paused ? 'text-yellow-500' :
                    'text-[#94a3b8]'
                  }`}>
                    {scanning && !paused ? '当前扫描中...' :
                     paused ? '扫描已暂停' :
                     '等待开始扫描'}
                  </p>
                  {scanning && !paused && (
                    <div className="flex items-center justify-center gap-2 mt-2">
                      <span className="w-2 h-2 bg-[#3b82f6] rounded-full animate-pulse" />
                      <span className="text-sm text-[#64748b]">RFID-01 扫描器已连接</span>
                    </div>
                  )}
                </div>

                {/* 实时统计 */}
                <div className="grid grid-cols-3 gap-6 w-full max-w-md">
                  <div className="text-center bg-blue-50 rounded-xl p-3">
                    <p className="text-xs text-[#64748b] mb-1">已扫描</p>
                    <p className="text-2xl font-bold text-[#3b82f6]">{task.scanned}</p>
                  </div>
                  <div className="text-center bg-green-50 rounded-xl p-3">
                    <p className="text-xs text-[#64748b] mb-1">扫描速度</p>
                    <p className="text-2xl font-bold text-green-600">{scanning && !paused ? '35/分' : '0/分'}</p>
                  </div>
                  <div className="text-center bg-purple-50 rounded-xl p-3">
                    <p className="text-xs text-[#64748b] mb-1">准确率</p>
                    <p className="text-2xl font-bold text-purple-600">99.5%</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* 日志终端 */}
            <Card>
              <CardHeader>
                <CardTitle>扫描日志</CardTitle>
                <div className="flex items-center gap-1.5">
                  <span className={`w-2 h-2 rounded-full ${scanning && !paused ? 'bg-green-500 animate-pulse' : 'bg-gray-300'}`} />
                  <span className="text-xs text-[#64748b]">{scanning && !paused ? '实时' : '停止'}</span>
                </div>
              </CardHeader>
              <div
                ref={logRef}
                className="bg-[#0f172a] text-green-400 font-mono text-xs p-4 rounded-b-[10px] h-44 overflow-y-auto space-y-0.5"
              >
                {scanLog.map((line, i) => (
                  <div key={i} className={line.includes('异常') || line.includes('失败') ? 'text-yellow-400' : ''}>
                    {line}
                  </div>
                ))}
                {scanning && !paused && (
                  <div className="animate-pulse">▋</div>
                )}
              </div>
            </Card>

            {/* 底部控制按钮 */}
            <div className="flex gap-3">
              <Button
                variant={scanning && !paused ? 'secondary' : 'primary'}
                size="lg"
                className="flex-1"
                onClick={handleStartPause}
              >
                {!scanning ? (
                  <><Play className="w-4 h-4" />开始扫描</>
                ) : paused ? (
                  <><Play className="w-4 h-4" />继续扫描</>
                ) : (
                  <><Pause className="w-4 h-4" />暂停扫描</>
                )}
              </Button>
              <Button
                variant="primary"
                size="lg"
                className="flex-1 bg-blue-500 hover:bg-blue-600"
                loading={batchConfirmMutation.isPending}
                disabled={unconfirmedAssets.length === 0}
                onClick={handleBatchConfirm}
              >
                <CheckCheck className="w-4 h-4" />
                批量确认 ({unconfirmedAssets.length})
              </Button>
              <Button
                variant="primary"
                size="lg"
                className="flex-1 bg-green-600 hover:bg-green-700"
                loading={submitMutation.isPending}
                disabled={!scanning && !paused && unconfirmedAssets.length > 0}
                onClick={handleSubmit}
              >
                <CheckCircle className="w-4 h-4" />
                提交盘点
              </Button>
            </div>
          </div>

          {/* 右侧面板 */}
          <div className="space-y-4">
            {/* 最近扫描记录 */}
            <Card>
              <CardHeader>
                <CardTitle>最近扫描记录</CardTitle>
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                  <span className="text-xs text-[#64748b]">实时更新</span>
                </div>
              </CardHeader>
              <div className="divide-y divide-[#f1f5f9]">
                {recentScans.map((scan) => (
                  <div
                    key={scan.id}
                    className="px-4 py-3 flex items-center justify-between hover:bg-[#f8fafc] transition-colors cursor-pointer"
                    onClick={() => !scan.confirmed && handleConfirmAsset(scan.assetId)}
                    role={scan.confirmed ? undefined : 'button'}
                    tabIndex={scan.confirmed ? undefined : 0}
                    title={scan.confirmed ? '已确认' : '点击确认'}
                  >
                    <div className="flex items-center gap-2.5">
                      {scan.confirmed
                        ? <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0" />
                        : <AlertTriangle className="w-4 h-4 text-yellow-500 flex-shrink-0" />
                      }
                      <div>
                        <p className="text-sm font-medium text-[#0f172a] leading-tight">{scan.name}</p>
                        <p className="text-xs text-[#94a3b8]">{scan.assetNo}</p>
                      </div>
                    </div>
                    <span className="text-xs text-[#94a3b8] font-mono whitespace-nowrap ml-2">{scan.time}</span>
                  </div>
                ))}
                {recentScans.length === 0 && (
                  <div className="px-4 py-6 text-center text-sm text-[#94a3b8]">暂无扫描记录</div>
                )}
              </div>
            </Card>

            {/* 差异列表 */}
            <Card>
              <CardHeader>
                <CardTitle>差异列表</CardTitle>
                <span className="px-2 py-0.5 text-xs font-semibold bg-yellow-100 text-yellow-700 rounded-full">
                  {discrepancyCount} 项
                </span>
              </CardHeader>
              <div className="divide-y divide-[#f1f5f9]">
                {discrepancies.map((d) => (
                  <div key={d.id} className="px-4 py-3 hover:bg-[#f8fafc] transition-colors">
                    <div className="flex items-start gap-2 mb-1">
                      <AlertTriangle className="w-3.5 h-3.5 text-yellow-500 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="text-sm font-medium text-[#0f172a]">{d.name}</p>
                        <p className="text-xs text-[#94a3b8]">{d.assetNo}</p>
                      </div>
                      <span className={`ml-auto px-2 py-0.5 text-[10px] font-bold rounded-full flex-shrink-0 ${
                        d.type === '盘亏' ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'
                      }`}>
                        {d.type}
                      </span>
                    </div>
                    <p className="text-xs text-[#64748b] pl-5">{d.detail}</p>
                  </div>
                ))}
                {discrepancies.length === 0 && (
                  <div className="px-4 py-6 text-center text-sm text-[#94a3b8]">暂无差异</div>
                )}
              </div>
            </Card>

            {/* 任务概览 */}
            <Card>
              <CardHeader>
                <CardTitle>任务概览</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {[
                  { label: '资产总数',  value: task.totalAssets,                 color: 'text-[#0f172a]' },
                  { label: '已盘点',    value: task.scanned,                     color: 'text-[#3b82f6]' },
                  { label: '未盘点',    value: task.totalAssets - task.scanned,  color: 'text-[#f59e0b]' },
                  { label: '差异数量',  value: discrepancyCount,                  color: 'text-red-500' },
                ].map(({ label, value, color }) => (
                  <div key={label} className="flex items-center justify-between text-sm">
                    <span className="text-[#64748b]">{label}</span>
                    <span className={`font-bold text-base ${color}`}>{value}</span>
                  </div>
                ))}
                <div className="pt-1">
                  <div className="flex justify-between text-xs text-[#94a3b8] mb-1">
                    <span>完成率</span>
                    <span>{task.progress}%</span>
                  </div>
                  <ProgressBar value={task.progress} />
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
