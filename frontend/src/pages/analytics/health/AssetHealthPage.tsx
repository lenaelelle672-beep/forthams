/**
 * @file pages/analytics/health/AssetHealthPage.tsx
 * @description 资产健康评分仪表板 — 评分分布、不健康资产Top20、趋势
 */

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell,
} from 'recharts';
import { AlertTriangle, Heart, Activity } from 'lucide-react';
import { getUnhealthyAssets, batchAssetHealth } from '@/api/assetHealth';
import { getAssetList } from '@/api/asset';
import { Card, CardContent } from '@/components/ui/Card';
import { Skeleton } from '@/components/ui/Skeleton';
import type { AssetHealthVO } from '@/types/assetHealth';

const LEVEL_COLORS: Record<string, string> = {
  HEALTHY: '#10b981',
  WARNING: '#f59e0b',
  CRITICAL: '#ef4444',
};

export default function AssetHealthPage() {
  const [topN] = useState(20);

  // 获取资产列表
  const { data: assetListRes, isLoading: assetLoading } = useQuery({
    queryKey: ['assets-brief'],
    queryFn: () => getAssetList({ page: 1, pageSize: 100 }),
  });

  const assets = (assetListRes as any)?.records ?? [];

  // 获取所有资产健康评分
  const { data: healthData, isLoading: healthLoading } = useQuery({
    queryKey: ['asset-health-all', assets.length],
    queryFn: async () => {
      if (assets.length === 0) return [];
      const ids = assets.map((a: any) => a.id).filter(Boolean);
      return batchAssetHealth(ids);
    },
    enabled: assets.length > 0,
  });

  // 获取不健康资产
  const { data: unhealthyData } = useQuery({
    queryKey: ['asset-health-unhealthy'],
    queryFn: () => getUnhealthyAssets(topN, 60),
  });

  const isLoading = assetLoading || healthLoading;
  const healthList = (healthData ?? []) as AssetHealthVO[];

  // 分布统计
  const healthyCount = healthList.filter((h) => h.scoreLevel === 'HEALTHY').length;
  const warningCount = healthList.filter((h) => h.scoreLevel === 'WARNING').length;
  const criticalCount = healthList.filter((h) => h.scoreLevel === 'CRITICAL').length;

  const distributionData = [
    { name: '健康 (>80)', value: healthyCount, color: LEVEL_COLORS.HEALTHY },
    { name: '警告 (50-80)', value: warningCount, color: LEVEL_COLORS.WARNING },
    { name: '危险 (<50)', value: criticalCount, color: LEVEL_COLORS.CRITICAL },
  ];

  // 评分区间分布
  const scoreRanges = [
    { range: '0-20', count: healthList.filter((h) => h.score < 20).length },
    { range: '20-40', count: healthList.filter((h) => h.score >= 20 && h.score < 40).length },
    { range: '40-60', count: healthList.filter((h) => h.score >= 40 && h.score < 60).length },
    { range: '60-80', count: healthList.filter((h) => h.score >= 60 && h.score < 80).length },
    { range: '80-100', count: healthList.filter((h) => h.score >= 80).length },
  ];

  const unhealthyList = (unhealthyData ?? []) as AssetHealthVO[];

  const averageScore = healthList.length > 0
    ? Math.round(healthList.reduce((sum, h) => sum + h.score, 0) / healthList.length)
    : 0;

  return (
    <div className="space-y-6">
      {/* 页面标题 */}
      <div>
        <h1 className="text-xl font-bold text-[var(--surface-heading)]">资产健康评分</h1>
        <p className="text-sm text-[var(--surface-muted-text)]">多维度资产健康度评估</p>
      </div>

      {/* KPI 卡片 */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-[var(--surface-card)]">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-[var(--surface-muted-text)]">平均健康分</p>
                <p className="text-2xl font-bold text-[var(--surface-heading)]">{isLoading ? '-' : averageScore}</p>
              </div>
              <Heart className="w-8 h-8 text-[var(--brand-primary)] opacity-60" />
            </div>
          </CardContent>
        </Card>
        <Card className="bg-[var(--surface-card)]">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-[var(--surface-muted-text)]">健康资产</p>
                <p className="text-2xl font-bold text-green-500">{isLoading ? '-' : healthyCount}</p>
              </div>
              <Activity className="w-8 h-8 text-green-500 opacity-60" />
            </div>
          </CardContent>
        </Card>
        <Card className="bg-[var(--surface-card)]">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-[var(--surface-muted-text)]">警告资产</p>
                <p className="text-2xl font-bold text-amber-500">{isLoading ? '-' : warningCount}</p>
              </div>
              <AlertTriangle className="w-8 h-8 text-amber-500 opacity-60" />
            </div>
          </CardContent>
        </Card>
        <Card className="bg-[var(--surface-card)]">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-[var(--surface-muted-text)]">危险资产</p>
                <p className="text-2xl font-bold text-red-500">{isLoading ? '-' : criticalCount}</p>
              </div>
              <AlertTriangle className="w-8 h-8 text-red-500 opacity-60" />
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 评分分布饼图 */}
        <Card className="bg-[var(--surface-card)]">
          <CardContent className="p-4">
            <h3 className="text-sm font-semibold text-[var(--surface-heading)] mb-4">评分分布</h3>
            {isLoading ? (
              <Skeleton className="h-[300px]" />
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={distributionData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={4}
                    dataKey="value"
                    label={({ name, value }) => `${name}: ${value}`}
                  >
                    {distributionData.map((entry, idx) => (
                      <Cell key={idx} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* 评分区间柱状图 */}
        <Card className="bg-[var(--surface-card)]">
          <CardContent className="p-4">
            <h3 className="text-sm font-semibold text-[var(--surface-heading)] mb-4">评分区间分布</h3>
            {isLoading ? (
              <Skeleton className="h-[300px]" />
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={scoreRanges}>
                  <XAxis dataKey="range" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="count" fill="var(--brand-primary)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* 不健康资产 TopN */}
      <Card className="bg-[var(--surface-card)]">
        <CardContent className="p-4">
          <h3 className="text-sm font-semibold text-[var(--surface-heading)] mb-4">
            不健康资产 Top {topN}
          </h3>
          {!unhealthyList || unhealthyList.length === 0 ? (
            <p className="text-sm text-[var(--surface-muted-text)] text-center py-8">暂无数据</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[var(--surface-border)]">
                    <th className="text-left py-2 px-3 text-[var(--surface-muted-text)] font-medium">资产名称</th>
                    <th className="text-left py-2 px-3 text-[var(--surface-muted-text)] font-medium">资产编码</th>
                    <th className="text-center py-2 px-3 text-[var(--surface-muted-text)] font-medium">评分</th>
                    <th className="text-center py-2 px-3 text-[var(--surface-muted-text)] font-medium">等级</th>
                    <th className="text-center py-2 px-3 text-[var(--surface-muted-text)] font-medium">年龄分</th>
                    <th className="text-center py-2 px-3 text-[var(--surface-muted-text)] font-medium">维修分</th>
                    <th className="text-center py-2 px-3 text-[var(--surface-muted-text)] font-medium">故障率分</th>
                    <th className="text-center py-2 px-3 text-[var(--surface-muted-text)] font-medium">利用率分</th>
                    <th className="text-center py-2 px-3 text-[var(--surface-muted-text)] font-medium">折旧分</th>
                  </tr>
                </thead>
                <tbody>
                  {unhealthyList.map((h) => (
                    <tr key={h.assetId} className="border-b border-[var(--surface-border-subtle)] hover:bg-[var(--surface-muted)] transition-colors">
                      <td className="py-2 px-3 font-medium">{h.assetName || '-'}</td>
                      <td className="py-2 px-3 text-[var(--surface-muted-text)]">{h.assetCode || '-'}</td>
                      <td className="py-2 px-3 text-center font-bold">{h.score}</td>
                      <td className="py-2 px-3 text-center">
                        <span
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium"
                          style={{
                            backgroundColor: LEVEL_COLORS[h.scoreLevel] + '20',
                            color: LEVEL_COLORS[h.scoreLevel],
                          }}
                        >
                          {h.scoreLevel === 'HEALTHY' ? '健康' : h.scoreLevel === 'WARNING' ? '警告' : '危险'}
                        </span>
                      </td>
                      <td className="py-2 px-3 text-center">{h.ageScore}</td>
                      <td className="py-2 px-3 text-center">{h.maintenanceScore}</td>
                      <td className="py-2 px-3 text-center">{h.faultRateScore}</td>
                      <td className="py-2 px-3 text-center">{h.utilizationScore}</td>
                      <td className="py-2 px-3 text-center">{h.depreciationScore}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
