/**
 * @file pages/asset/AssetHealthPage.tsx
 * @description 资产健康评分页面 — 不健康资产列表、详情弹窗（五维进度条）、批量计算
 *
 * 后端端点：
 * - GET  /asset-health/unhealthy?topN=&minScore=  → 不健康资产 TopN
 * - GET  /asset-health/{assetId}                   → 单资产健康详情
 * - POST /asset-health/batch                       → 批量计算
 */

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  AlertTriangle, Heart, Activity, RefreshCw,
  ChevronDown, ChevronUp, X, Zap,
} from 'lucide-react';
import { getAssetHealth, getUnhealthyAssets, batchAssetHealth } from '@/api/assetHealth';
import { getAssetList } from '@/api/asset';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Skeleton } from '@/components/ui/Skeleton';
import type { AssetHealthVO } from '@/types/assetHealth';
import { toast } from 'sonner';

// ── 评分等级配色 ───────────────────────────────────────────────────────────
const LEVEL_CONFIG: Record<string, { label: string; color: string; bgColor: string; icon: React.ReactNode }> = {
  HEALTHY: {
    label: '健康',
    color: '#10b981',
    bgColor: '#dcfce7',
    icon: <Heart className="w-4 h-4" />,
  },
  WARNING: {
    label: '警告',
    color: '#f59e0b',
    bgColor: '#fef3c7',
    icon: <AlertTriangle className="w-4 h-4" />,
  },
  CRITICAL: {
    label: '危险',
    color: '#ef4444',
    bgColor: '#fee2e2',
    icon: <AlertTriangle className="w-4 h-4" />,
  },
};

// ── 维度标签 ────────────────────────────────────────────────────────────────
const DIMENSION_LABELS: { key: keyof Pick<AssetHealthVO, 'ageScore' | 'maintenanceScore' | 'faultRateScore' | 'utilizationScore' | 'depreciationScore'>; label: string; weight: string }[] = [
  { key: 'ageScore', label: '年龄', weight: '20%' },
  { key: 'maintenanceScore', label: '维修频率', weight: '25%' },
  { key: 'faultRateScore', label: '故障率', weight: '20%' },
  { key: 'utilizationScore', label: '利用率', weight: '20%' },
  { key: 'depreciationScore', label: '折旧进度', weight: '15%' },
];

// ── 进度条颜色 ──────────────────────────────────────────────────────────────
function scoreColor(score: number): string {
  if (score >= 80) return '#10b981';
  if (score >= 60) return '#f59e0b';
  if (score >= 40) return '#f97316';
  return '#ef4444';
}

// ── 评分等级标签组件 ────────────────────────────────────────────────────────
function LevelBadge({ level }: { level: string }) {
  const cfg = LEVEL_CONFIG[level] ?? LEVEL_CONFIG.WARNING;
  return (
    <span
      className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold"
      style={{ backgroundColor: cfg.bgColor, color: cfg.color }}
    >
      {cfg.icon}
      {cfg.label}
    </span>
  );
}

// ── 单维度进度条 ────────────────────────────────────────────────────────────
function DimensionBar({ label, score, weight }: { label: string; score: number; weight: string }) {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-sm">
        <span className="text-[var(--surface-muted-text)]">
          {label}
          <span className="ml-1 text-xs opacity-60">({weight})</span>
        </span>
        <span className="font-semibold" style={{ color: scoreColor(score) }}>{score}</span>
      </div>
      <div className="h-2 rounded-full bg-[var(--surface-border)] overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-500 ease-out"
          style={{ width: `${Math.min(score, 100)}%`, backgroundColor: scoreColor(score) }}
        />
      </div>
    </div>
  );
}

// ── 详情弹窗 ────────────────────────────────────────────────────────────────
function HealthDetailDialog({
  assetId,
  onClose,
}: {
  assetId: number;
  onClose: () => void;
}) {
  const { data, isLoading, error } = useQuery({
    queryKey: ['asset-health-detail', assetId],
    queryFn: () => getAssetHealth(assetId),
  });

  const health = data as AssetHealthVO | undefined;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* 遮罩 */}
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      {/* 弹窗内容 */}
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* 头部 */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--surface-border)]">
          <div>
            <h2 className="text-lg font-bold text-[var(--surface-heading)]">
              {health?.assetName ?? '加载中...'}
            </h2>
            <p className="text-xs text-[var(--surface-muted-text)] mt-0.5">
              {health?.assetCode ?? ''}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-[var(--surface-muted)] transition-colors"
          >
            <X className="w-5 h-5 text-[var(--surface-muted-text)]" />
          </button>
        </div>

        {/* 内容 */}
        <div className="px-6 py-5 space-y-6">
          {isLoading ? (
            <div className="space-y-4">
              <Skeleton className="h-16 w-full" />
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : error ? (
            <div className="text-center py-8 text-red-500">
              加载失败: {(error as Error).message}
            </div>
          ) : health ? (
            <>
              {/* 总分卡片 */}
              <div className="flex items-center gap-4 p-4 rounded-xl" style={{ backgroundColor: (LEVEL_CONFIG[health.scoreLevel]?.bgColor ?? '#f1f5f9') + '80' }}>
                <div
                  className="w-16 h-16 rounded-2xl flex items-center justify-center text-2xl font-black text-white"
                  style={{ backgroundColor: LEVEL_CONFIG[health.scoreLevel]?.color ?? '#94a3b8' }}
                >
                  {health.score}
                </div>
                <div>
                  <LevelBadge level={health.scoreLevel} />
                  <p className="text-xs text-[var(--surface-muted-text)] mt-1">综合健康评分</p>
                </div>
              </div>

              {/* 五维进度条 */}
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-[var(--surface-heading)]">维度评分明细</h3>
                {DIMENSION_LABELS.map((dim) => (
                  <DimensionBar
                    key={dim.key}
                    label={dim.label}
                    score={health[dim.key] ?? 0}
                    weight={dim.weight}
                  />
                ))}
              </div>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}

// ── 主页面 ──────────────────────────────────────────────────────────────────
export default function AssetHealthPage() {
  const queryClient = useQueryClient();
  const [topN, setTopN] = useState(20);
  const [minScore, setMinScore] = useState(60);
  const [detailAssetId, setDetailAssetId] = useState<number | null>(null);
  const [sortDesc, setSortDesc] = useState(true); // 按评分升序（最差在前）

  // ── 获取不健康资产列表 ──────────────────────────────────────────────────
  const { data: unhealthyData, isLoading } = useQuery({
    queryKey: ['asset-health-unhealthy', topN, minScore],
    queryFn: () => getUnhealthyAssets(topN, minScore),
  });

  const unhealthyList = (unhealthyData ?? []) as AssetHealthVO[];

  // 排序：默认升序（最差在前），可切换
  const sortedList = [...unhealthyList].sort((a, b) =>
    sortDesc ? b.score - a.score : a.score - b.score,
  );

  // ── 批量计算 ──────────────────────────────────────────────────────────
  const batchMutation = useMutation({
    mutationFn: async () => {
      // 先获取所有资产 ID
      const res = await getAssetList({ page: 1, pageSize: 500 }) as any;
      const ids = (res?.records ?? []).map((a: any) => a.id).filter(Boolean);
      if (ids.length === 0) throw new Error('暂无资产可计算');
      return batchAssetHealth(ids);
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['asset-health-unhealthy'] });
      toast.success(`批量计算完成，共 ${(data as AssetHealthVO[]).length} 条`);
    },
    onError: (err: Error) => {
      toast.error(`批量计算失败: ${err.message}`);
    },
  });

  // ── KPI 统计 ──────────────────────────────────────────────────────────
  const healthyCount = unhealthyList.filter((h) => h.scoreLevel === 'HEALTHY').length;
  const warningCount = unhealthyList.filter((h) => h.scoreLevel === 'WARNING').length;
  const criticalCount = unhealthyList.filter((h) => h.scoreLevel === 'CRITICAL').length;
  const averageScore = unhealthyList.length > 0
    ? Math.round(unhealthyList.reduce((s, h) => s + h.score, 0) / unhealthyList.length)
    : 0;

  return (
    <div className="space-y-6">
      {/* 页面标题 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-[var(--surface-heading)]">资产健康评分</h1>
          <p className="text-sm text-[var(--surface-muted-text)]">
            基于年龄、维修频率、故障率、利用率、折旧进度的多维度评估
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => batchMutation.mutate()}
            disabled={batchMutation.isPending}
          >
            <Zap className={`w-4 h-4 mr-1 ${batchMutation.isPending ? 'animate-spin' : ''}`} />
            {batchMutation.isPending ? '计算中...' : '批量计算'}
          </Button>
        </div>
      </div>

      {/* KPI 卡片 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card variant="stat">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-[var(--surface-muted-text)]">平均健康分</p>
                <p className="text-2xl font-bold text-[var(--surface-heading)]">{isLoading ? '-' : averageScore}</p>
              </div>
              <Heart className="w-8 h-8 text-[var(--brand-primary)] opacity-60" />
            </div>
          </CardContent>
        </Card>
        <Card variant="stat">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-[var(--surface-muted-text)]">健康</p>
                <p className="text-2xl font-bold text-emerald-600">{isLoading ? '-' : healthyCount}</p>
              </div>
              <Activity className="w-8 h-8 text-emerald-500 opacity-60" />
            </div>
          </CardContent>
        </Card>
        <Card variant="stat">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-[var(--surface-muted-text)]">警告</p>
                <p className="text-2xl font-bold text-amber-600">{isLoading ? '-' : warningCount}</p>
              </div>
              <AlertTriangle className="w-8 h-8 text-amber-500 opacity-60" />
            </div>
          </CardContent>
        </Card>
        <Card variant="stat">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-[var(--surface-muted-text)]">危险</p>
                <p className="text-2xl font-bold text-red-600">{isLoading ? '-' : criticalCount}</p>
              </div>
              <AlertTriangle className="w-8 h-8 text-red-500 opacity-60" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 筛选条件 */}
      <Card>
        <CardContent className="py-3">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <label className="text-sm text-[var(--surface-muted-text)]">TopN:</label>
              <select
                value={topN}
                onChange={(e) => setTopN(Number(e.target.value))}
                className="px-2 py-1 text-sm border border-[var(--surface-border)] rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary)]/30"
              >
                <option value={10}>10</option>
                <option value={20}>20</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
            </div>
            <div className="flex items-center gap-2">
              <label className="text-sm text-[var(--surface-muted-text)]">最低分:</label>
              <input
                type="number"
                value={minScore}
                onChange={(e) => setMinScore(Number(e.target.value))}
                min={0}
                max={100}
                className="w-20 px-2 py-1 text-sm border border-[var(--surface-border)] rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary)]/30"
              />
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => queryClient.invalidateQueries({ queryKey: ['asset-health-unhealthy'] })}
            >
              <RefreshCw className="w-4 h-4 mr-1" />
              刷新
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* 不健康资产列表 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between w-full">
            <span>不健康资产列表</span>
            <span className="text-xs font-normal text-[var(--surface-muted-text)]">
              共 {unhealthyList.length} 条
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-5">
              <Skeleton className="h-8 w-full mb-3" />
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full mb-2" />
              ))}
            </div>
          ) : sortedList.length === 0 ? (
            <div className="text-center py-16 text-[var(--surface-muted-text)]">
              <Heart className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p className="text-sm">暂无不健康资产，所有资产状态良好</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[var(--surface-border)] bg-[var(--surface-card-muted)]/50">
                    <th className="text-left py-3 px-4 text-xs font-semibold text-[var(--surface-muted-text)] uppercase tracking-wider">资产名称</th>
                    <th className="text-left py-3 px-4 text-xs font-semibold text-[var(--surface-muted-text)] uppercase tracking-wider">资产编码</th>
                    <th className="text-center py-3 px-4 text-xs font-semibold text-[var(--surface-muted-text)] uppercase tracking-wider cursor-pointer select-none"
                        onClick={() => setSortDesc(!sortDesc)}
                    >
                      <span className="inline-flex items-center gap-1">
                        评分
                        {sortDesc ? <ChevronDown className="w-3 h-3" /> : <ChevronUp className="w-3 h-3" />}
                      </span>
                    </th>
                    <th className="text-center py-3 px-4 text-xs font-semibold text-[var(--surface-muted-text)] uppercase tracking-wider">等级</th>
                    <th className="text-center py-3 px-4 text-xs font-semibold text-[var(--surface-muted-text)] uppercase tracking-wider">年龄</th>
                    <th className="text-center py-3 px-4 text-xs font-semibold text-[var(--surface-muted-text)] uppercase tracking-wider">维修</th>
                    <th className="text-center py-3 px-4 text-xs font-semibold text-[var(--surface-muted-text)] uppercase tracking-wider">故障率</th>
                    <th className="text-center py-3 px-4 text-xs font-semibold text-[var(--surface-muted-text)] uppercase tracking-wider">利用率</th>
                    <th className="text-center py-3 px-4 text-xs font-semibold text-[var(--surface-muted-text)] uppercase tracking-wider">折旧</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedList.map((h) => (
                    <tr
                      key={h.assetId}
                      className="border-b border-[var(--surface-border-subtle)] hover:bg-[var(--surface-muted)]/50 transition-colors cursor-pointer"
                      onClick={() => setDetailAssetId(h.assetId)}
                    >
                      <td className="py-3 px-4 font-medium text-[var(--surface-heading)]">{h.assetName || '-'}</td>
                      <td className="py-3 px-4 text-[var(--surface-muted-text)] font-mono text-xs">{h.assetCode || '-'}</td>
                      <td className="py-3 px-4 text-center">
                        <span className="inline-flex items-center justify-center w-10 h-10 rounded-xl text-base font-black text-white"
                              style={{ backgroundColor: scoreColor(h.score) }}>
                          {h.score}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center"><LevelBadge level={h.scoreLevel} /></td>
                      <td className="py-3 px-4 text-center font-mono">{h.ageScore}</td>
                      <td className="py-3 px-4 text-center font-mono">{h.maintenanceScore}</td>
                      <td className="py-3 px-4 text-center font-mono">{h.faultRateScore}</td>
                      <td className="py-3 px-4 text-center font-mono">{h.utilizationScore}</td>
                      <td className="py-3 px-4 text-center font-mono">{h.depreciationScore}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 详情弹窗 */}
      {detailAssetId !== null && (
        <HealthDetailDialog
          assetId={detailAssetId}
          onClose={() => setDetailAssetId(null)}
        />
      )}
    </div>
  );
}
