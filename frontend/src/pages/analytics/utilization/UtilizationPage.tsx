import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  TrendingUp, Clock, Package, Zap, Download, Calendar,
} from 'lucide-react';
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip, Legend,
  ResponsiveContainer, CartesianGrid,
} from 'recharts';
import {
  getUtilizationOverview,
  getUtilizationTrend,
  getUtilizationSummary,
  getTopUtilized,
  getIdleAssets,
  type UtilizationOverview,
  type UtilizationTrend,
  type UtilizationSummary,
  type AssetUtilization,
} from '@/api/stats';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { KpiCard } from '@/components/ui/KpiCard';
import { PageHeader } from '@/components/ui/PageHeader';
import { Select, SelectItem } from '@/components/ui/Select';
import { Skeleton } from '@/components/ui/Skeleton';

const COLORS = {
  blue: '#3b82f6', green: '#10b981', amber: '#f59e0b',
  red: '#ef4444', purple: '#8b5cf6', cyan: '#06b6d4',
};

export default function UtilizationPage() {
  const [months, setMonths] = useState('6');
  const [period, setPeriod] = useState('1M');

  const now = new Date();
  const endDate = now.toISOString().slice(0, 10);
  const startDate = new Date(now.getTime() - parseInt(months) * 30 * 86400000).toISOString().slice(0, 10);

  const { data: overviewRes, isLoading: overviewLoading } = useQuery({
    queryKey: ['utilization', 'overview', startDate, endDate],
    queryFn: () => getUtilizationOverview(startDate, endDate),
    staleTime: 1000 * 60 * 5,
  });

  const { data: trendRes } = useQuery({
    queryKey: ['utilization', 'trend', 0, parseInt(months)],
    queryFn: () => getUtilizationTrend(0, parseInt(months)),
    staleTime: 1000 * 60 * 15,
  });

  const { data: summaryRes } = useQuery({
    queryKey: ['utilization', 'summary', startDate, endDate],
    queryFn: () => getUtilizationSummary(startDate, endDate),
    staleTime: 1000 * 60 * 15,
  });

  const { data: topRes } = useQuery({
    queryKey: ['utilization', 'top', startDate, endDate],
    queryFn: () => getTopUtilized(10, startDate, endDate),
    staleTime: 1000 * 60 * 15,
  });

  const { data: idleRes } = useQuery({
    queryKey: ['utilization', 'idle'],
    queryFn: () => getIdleAssets(30),
    staleTime: 1000 * 60 * 15,
  });

  const overview = overviewRes as unknown as UtilizationOverview | undefined;
  const trends = trendRes as unknown as UtilizationTrend[] | undefined ?? [];
  const summary = summaryRes as unknown as UtilizationSummary | undefined;
  const topAssets = topRes as unknown as AssetUtilization[] | undefined ?? [];
  const idleAssets = idleRes as unknown as AssetUtilization[] | undefined ?? [];

  const trendChartData = trends.map((t: UtilizationTrend) => ({
    month: t.month?.substring(5) ?? '',
    rate: t.utilizationRate ?? 0,
    used: t.usedHours ?? 0,
  }));

  const categoryData = summary?.byCategory?.map((item) => ({
    name: item.name,
    rate: item.utilizationRate ?? 0,
  })) ?? [];

  const topChartData = [...topAssets]
    .sort((a, b) => (b.utilizationRate ?? 0) - (a.utilizationRate ?? 0))
    .slice(0, 10)
    .map((a) => ({
      name: a.assetName?.length > 8 ? a.assetName.slice(0, 8) + '…' : a.assetName ?? a.assetNo ?? '',
      rate: a.utilizationRate ?? 0,
    }));

  const exportReport = () => {
    const rows = [['资产名称', '资产编号', '使用时长(h)', '利用率(%)', '闲置天数']];
    topAssets.forEach((a) => {
      rows.push([a.assetName ?? '', a.assetNo ?? '', String(a.usedHours ?? 0), String(a.utilizationRate ?? 0), String(a.idleDays ?? '-')]);
    });
    const csv = rows.map((r) => r.join(',')).join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `利用率报表_${endDate}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="p-6 space-y-6">
      <PageHeader
        title="资产利用率"
        subtitle="多维资产使用率统计与闲置分析"
        breadcrumbs={[{ label: '仪表板', href: '/dashboard' }, { label: '数据分析', href: '/analytics' }, { label: '利用率' }]}
        actions={
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-[#94a3b8]" />
            <Select value={months} onValueChange={setMonths}>
              <SelectItem value="3">近 3 个月</SelectItem>
              <SelectItem value="6">近 6 个月</SelectItem>
              <SelectItem value="12">近 12 个月</SelectItem>
            </Select>
            <button
              onClick={exportReport}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg border border-[#e2e8f0] bg-white text-[#64748b] hover:bg-[#f8fafc] transition-colors"
            >
              <Download className="w-4 h-4" /> 导出
            </button>
          </div>
        }
      />

      {/* KPI 概览 */}
      <div className="grid grid-cols-4 gap-4">
        {overviewLoading ? (
          Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} />)
        ) : (
          <>
            <KpiCard
              title="整体利用率"
              value={(overview?.overallUtilizationRate ?? 0).toFixed(1) + '%'}
              icon={TrendingUp}
              iconColor={COLORS.blue}
            />
            <KpiCard
              title="闲置资产数"
              value={String(overview?.idleAssetCount ?? 0)}
              subtitle="超过 30 天未使用"
              icon={Clock}
              iconColor={COLORS.amber}
            />
            <KpiCard
              title="在用量资产"
              value={String(overview?.inUseAssetCount ?? 0)}
              icon={Package}
              iconColor={COLORS.green}
            />
            <KpiCard
              title="高利用率资产"
              value={String(overview?.highUtilizationCount ?? 0)}
              subtitle="利用率 &ge; 80%"
              icon={Zap}
              iconColor={COLORS.purple}
            />
          </>
        )}
      </div>

      {/* 图表行 */}
      <div className="grid grid-cols-2 gap-4">
        {/* 利用率趋势 */}
        <Card className="col-span-2 lg:col-span-1">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-blue-500" />
              利用率趋势
            </CardTitle>
          </CardHeader>
          <CardContent>
            {trendChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={260}>
                <LineChart data={trendChartData} margin={{ top: 5, right: 16, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} unit="%" />
                  <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e5e7eb' }} formatter={(v: number) => [`${v.toFixed(1)}%`, '利用率']} />
                  <Line type="monotone" dataKey="rate" stroke={COLORS.blue} strokeWidth={2} dot={{ r: 3 }} name="利用率" />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-60 text-gray-400 text-sm">暂无趋势数据</div>
            )}
          </CardContent>
        </Card>

        {/* 按分类利用率 */}
        <Card className="col-span-2 lg:col-span-1">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Package className="w-4 h-4 text-emerald-500" />
              按分类利用率
            </CardTitle>
          </CardHeader>
          <CardContent>
            {categoryData.length > 0 ? (
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={categoryData} margin={{ top: 5, right: 16, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} unit="%" />
                  <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} formatter={(v: number) => [`${v.toFixed(1)}%`, '利用率']} />
                  <Bar dataKey="rate" fill={COLORS.green} radius={[4, 4, 0, 0]} name="利用率" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-60 text-gray-400 text-sm">暂无分类数据</div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* 底部行：Top10 + 闲置资产 */}
      <div className="grid grid-cols-2 gap-4">
        {/* 利用率 Top10 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Zap className="w-4 h-4 text-purple-500" />
              利用率 Top10
            </CardTitle>
          </CardHeader>
          <CardContent>
            {topChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={280}>
                <BarChart
                  data={topChartData}
                  layout="vertical"
                  margin={{ top: 0, right: 16, left: 80, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
                  <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} unit="%" />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} width={80} />
                  <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} formatter={(v: number) => [`${v.toFixed(1)}%`, '利用率']} />
                  <Bar dataKey="rate" fill={COLORS.blue} radius={[0, 4, 4, 0]} name="利用率" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-60 text-gray-400 text-sm">暂无排行数据</div>
            )}
          </CardContent>
        </Card>

        {/* 闲置资产列表 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-amber-500" />
              闲置资产列表（超过 30 天）
            </CardTitle>
          </CardHeader>
          <CardContent>
            {idleAssets.length > 0 ? (
              <div className="overflow-auto max-h-[280px]">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-[#94a3b8] text-xs border-b border-[#f1f5f9]">
                      <th className="text-left py-2 pr-2 font-medium">资产编号</th>
                      <th className="text-left py-2 pr-2 font-medium">资产名称</th>
                      <th className="text-left py-2 pr-2 font-medium">状态</th>
                      <th className="text-right py-2 font-medium">闲置天数</th>
                    </tr>
                  </thead>
                  <tbody>
                    {idleAssets.map((asset) => (
                      <tr key={asset.assetId} className="border-b border-[#f8fafc] hover:bg-[#f8fafc] transition-colors">
                        <td className="py-2 pr-2 text-[#64748b]">{asset.assetNo}</td>
                        <td className="py-2 pr-2 font-medium text-[#0f172a]">{asset.assetName}</td>
                        <td className="py-2 pr-2">
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-amber-50 text-amber-700">
                            {asset.status ?? '闲置'}
                          </span>
                        </td>
                        <td className="py-2 text-right text-[#ef4444] font-medium">{asset.idleDays} 天</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="flex items-center justify-center h-60 text-gray-400 text-sm">暂无闲置资产</div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
