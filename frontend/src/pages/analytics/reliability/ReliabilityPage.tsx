/**
 * @file pages/analytics/reliability/ReliabilityPage.tsx
 * @description 可靠性分析仪表板
 */

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Activity, Clock, CheckCircle, AlertTriangle, TrendingUp } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { PageHeader } from '@/components/ui/PageHeader';
import TrendChart from '@/components/reliability/TrendChart';
import RankingTable from '@/components/reliability/RankingTable';
import { getReliabilitySummary, getReliabilityTrend, getReliabilityRanking } from '@/api/reliability';
import type { ReliabilitySummary, ReliabilityTrend, ReliabilityRanking } from '@/types/reliability';

export default function ReliabilityPage() {
  const [sortBy, setSortBy] = useState('MTBF');

  const { data: summaryRes } = useQuery({
    queryKey: ['reliability', 'summary'],
    queryFn: () => getReliabilitySummary({}),
  });

  const { data: trendRes } = useQuery({
    queryKey: ['reliability', 'trend'],
    queryFn: () => getReliabilityTrend({ period: 'MONTH' }),
  });

  const { data: rankingRes } = useQuery({
    queryKey: ['reliability', 'ranking', sortBy],
    queryFn: () => getReliabilityRanking({ sortBy, limit: 10 }),
  });

  const summary = (summaryRes as any)?.data as ReliabilitySummary | undefined;
  const trends = (trendRes as any)?.data ?? [];
  const rankings = (rankingRes as any)?.data ?? [];

  const kpiCards = [
    {
      title: 'MTBF',
      value: summary?.mtbf ? `${summary.mtbf.toFixed(1)}h` : '-',
      subtitle: '平均故障间隔',
      icon: Activity,
      color: 'text-blue-600',
      bg: 'bg-blue-50',
    },
    {
      title: 'MTTR',
      value: summary?.mttr ? `${summary.mttr.toFixed(1)}h` : '-',
      subtitle: '平均修复时间',
      icon: Clock,
      color: 'text-amber-600',
      bg: 'bg-amber-50',
    },
    {
      title: '可用性',
      value: summary?.availability ? `${summary.availability.toFixed(1)}%` : '-',
      subtitle: '设备可用率',
      icon: CheckCircle,
      color: 'text-green-600',
      bg: 'bg-green-50',
    },
    {
      title: '月均故障率',
      value: summary?.failureRate ? `${summary.failureRate.toFixed(2)}次/月` : '-',
      subtitle: `总故障 ${summary?.totalFailures ?? 0} 次`,
      icon: AlertTriangle,
      color: 'text-red-600',
      bg: 'bg-red-50',
    },
  ];

  return (
    <div className="p-6 space-y-6">
      <PageHeader
        title="可靠性分析"
        description="MTBF/MTTR/可用性/故障率分析"
      />

      {/* KPI 卡片 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {kpiCards.map(card => (
          <Card key={card.title}>
            <CardContent className="p-4">
              <div className="flex items-start justify-between">
                <div>
                  <div className="text-2xl font-bold text-gray-900">{card.value}</div>
                  <div className="text-xs text-gray-400 mt-1">{card.subtitle}</div>
                </div>
                <div className={`p-3 rounded-xl ${card.bg}`}>
                  <card.icon className={`w-5 h-5 ${card.color}`} />
                </div>
              </div>
              <div className="mt-2 text-sm font-medium text-gray-700">{card.title}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* 趋势图 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="w-4 h-4" />
            MTBF/MTTR 趋势
          </CardTitle>
        </CardHeader>
        <CardContent>
          <TrendChart data={trends} />
        </CardContent>
      </Card>

      {/* 排名表 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>资产可靠性排名</span>
            <select
              value={sortBy}
              onChange={e => setSortBy(e.target.value)}
              className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 bg-white"
            >
              <option value="MTBF">按 MTBF</option>
              <option value="MTTR">按 MTTR</option>
              <option value="AVAILABILITY">按可用性</option>
            </select>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <RankingTable data={rankings} sortBy={sortBy} />
        </CardContent>
      </Card>
    </div>
  );
}
