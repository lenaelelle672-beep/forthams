import { useEffect, useState, useCallback } from "react";
import { BarChart3, Download, TrendingUp, Package, DollarSign, RefreshCw } from "lucide-react";
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { dashboardService, type DashboardStats, type AssetValueTrend, type DeptDistribution } from "../services/dashboardService";

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#6b7280', '#ef4444', '#14b8a6', '#f97316'];

const statusLabels: Record<string, string> = {
  IN_USE: '使用中',
  IDLE: '闲置',
  MAINTENANCE: '维修中',
  SCRAPPED: '已报废',
};

function downloadCsv(filename: string, rows: Array<Record<string, string | number>>) {
  if (rows.length === 0) return;
  const headers = Object.keys(rows[0]);
  const csv = [
    headers.join(","),
    ...rows.map((row) => headers.map((h) => `"${String(row[h] ?? "").replaceAll('"', '""')}"`).join(",")),
  ].join("\n");
  const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export function Analytics() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [trends, setTrends] = useState<AssetValueTrend[]>([]);
  const [deptDist, setDeptDist] = useState<DeptDistribution[]>([]);
  const [maintenanceStats, setMaintenanceStats] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [s, t, d, m] = await Promise.allSettled([
        dashboardService.getStats(),
        dashboardService.getValueTrends(180),
        dashboardService.getDeptDistribution(),
        dashboardService.getMaintenanceStats(),
      ]);
      if (s.status === 'fulfilled') setStats(s.value);
      if (t.status === 'fulfilled') setTrends(t.value ?? []);
      if (d.status === 'fulfilled') setDeptDist(d.value ?? []);
      if (m.status === 'fulfilled') setMaintenanceStats(m.value);
    } catch (err) {
      setError('统计数据加载失败');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const trendChartData = trends.map((t) => ({
    month: t.date,
    总价值: Number(t.totalValue ?? 0),
    净值: Number(t.netValue ?? 0),
  }));

  const categoryData = stats?.categoryDistribution
    ? Object.entries(stats.categoryDistribution).map(([name, count], i) => ({
        name,
        value: count,
        count,
        color: COLORS[i % COLORS.length],
      }))
    : [];

  const deptChartData = deptDist.map((d) => ({
    dept: d.deptName ?? `部门${d.deptId}`,
    资产数量: d.assetCount ?? 0,
  }));

  const lifecycleData = stats
    ? [
        { stage: '使用中', count: stats.inUseAssets ?? 0 },
        { stage: '闲置', count: stats.idleAssets ?? 0 },
        { stage: '维修中', count: stats.maintenanceAssets ?? 0 },
        { stage: '已报废', count: stats.scrapAssets ?? 0 },
      ]
    : [];

  const totalAssets = stats?.totalAssets ?? 0;
  const utilizationRate = totalAssets > 0 ? Math.round(((stats?.inUseAssets ?? 0) / totalAssets) * 100) : 0;

  const handleExport = useCallback(() => {
    downloadCsv("asset-analytics-report.csv", [
      ...trendChartData.map((item) => ({ section: "资产价值趋势", ...item })),
      ...categoryData.map(({ color, ...item }) => ({ section: "资产分类分布", ...item })),
      ...deptChartData.map((item) => ({ section: "部门资产分布", ...item })),
      ...lifecycleData.map((item) => ({ section: "生命周期分布", ...item })),
    ]);
  }, [trendChartData, categoryData, deptChartData, lifecycleData]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-gray-500">加载统计数据中...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-gray-900">数据统计分析</h2>
          <p className="text-gray-600 mt-1">多维度资产数据分析与可视化报表</p>
        </div>
        <div className="flex gap-2">
          <button onClick={fetchData} className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 rounded-lg transition-colors flex items-center gap-2">
            <RefreshCw className="w-4 h-4" />
            刷新
          </button>
          <button onClick={handleExport} className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors flex items-center gap-2">
            <Download className="w-4 h-4" />
            导出报表
          </button>
        </div>
      </div>

      {error && <div className="text-sm text-red-600 bg-red-50 p-3 rounded-lg">{error}</div>}

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">资产总价值</p>
              <p className="text-3xl font-semibold text-gray-900 mt-2">
                ¥{stats?.totalValue ? Number(stats.totalValue).toLocaleString() : '-'}
              </p>
              <div className="flex items-center gap-1 mt-2">
                <span className="text-sm text-gray-500">净值 ¥{stats?.netValue ? Number(stats.netValue).toLocaleString() : '-'}</span>
              </div>
            </div>
            <div className="w-12 h-12 bg-blue-50 rounded-lg flex items-center justify-center">
              <DollarSign className="w-6 h-6 text-blue-600" />
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">资产总数</p>
              <p className="text-3xl font-semibold text-gray-900 mt-2">{(stats?.totalAssets ?? 0).toLocaleString()}</p>
              <div className="flex items-center gap-1 mt-2">
                <span className="text-sm text-green-600">{stats?.inUseAssets ?? 0} 在用</span>
              </div>
            </div>
            <div className="w-12 h-12 bg-green-50 rounded-lg flex items-center justify-center">
              <Package className="w-6 h-6 text-green-600" />
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">使用率</p>
              <p className="text-3xl font-semibold text-gray-900 mt-2">{utilizationRate}%</p>
              <div className="flex items-center gap-1 mt-2">
                <span className="text-sm text-gray-500">{stats?.idleAssets ?? 0} 闲置</span>
              </div>
            </div>
            <div className="w-12 h-12 bg-purple-50 rounded-lg flex items-center justify-center">
              <BarChart3 className="w-6 h-6 text-purple-600" />
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">待审批</p>
              <p className="text-3xl font-semibold text-gray-900 mt-2">{stats?.pendingApprovals ?? 0}</p>
              <div className="flex items-center gap-1 mt-2">
                <span className="text-sm text-gray-500">{stats?.scrapAssets ?? 0} 已报废</span>
              </div>
            </div>
            <div className="w-12 h-12 bg-yellow-50 rounded-lg flex items-center justify-center">
              <TrendingUp className="w-6 h-6 text-yellow-600" />
            </div>
          </div>
        </div>
      </div>

      {trendChartData.length > 0 && (
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">资产价值趋势</h3>
          <ResponsiveContainer width="100%" height={350}>
            <LineChart data={trendChartData} isAnimationActive={false}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" />
              <YAxis />
              <Tooltip formatter={(value: number) => `¥${value.toLocaleString()}`} />
              <Legend />
              <Line type="monotone" dataKey="总价值" stroke="#3b82f6" strokeWidth={2} name="总价值" />
              <Line type="monotone" dataKey="净值" stroke="#10b981" strokeWidth={2} name="净值" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {categoryData.length > 0 && (
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">资产分类分布</h3>
            <div className="flex items-center justify-center">
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={categoryData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    outerRadius={100}
                    fill="#8884d8"
                    dataKey="value"
                    isAnimationActive={false}
                  >
                    {categoryData.map((entry) => (
                      <Cell key={`cell-analytics-${entry.name}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3">
              {categoryData.map((cat) => (
                <div key={cat.name} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded" style={{ backgroundColor: cat.color }}></div>
                    <span className="text-sm text-gray-700">{cat.name}</span>
                  </div>
                  <span className="text-sm font-medium text-gray-900">{cat.count}项</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {deptChartData.length > 0 && (
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">部门资产分布</h3>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={deptChartData} isAnimationActive={false}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="dept" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="资产数量" fill="#3b82f6" name="资产数量" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {lifecycleData.length > 0 && (
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">资产生命周期分布</h3>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={lifecycleData} layout="vertical" isAnimationActive={false}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis type="number" />
              <YAxis dataKey="stage" type="category" />
              <Tooltip />
              <Bar dataKey="count" fill="#3b82f6" name="数量" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
