import { useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  CheckCircle,
  Clock,
  Package,
} from "lucide-react";
import {
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { QuickActions } from "../components/QuickActions";
import { MaintenanceCalendar } from "../components/MaintenanceCalendar";
import {
  dashboardService,
  type AssetValueTrend,
  type DashboardStats,
  type DeptDistribution,
} from "../services/dashboardService";

const chartPalette = [
  "var(--color-chart-1)",
  "var(--color-chart-2)",
  "var(--color-chart-3)",
  "var(--color-chart-4)",
  "var(--color-chart-5)",
];

const recentActivities = [
  { id: 1, type: 'approve', title: '资产转移申请已审批', detail: '设备编号: EQ-2024-001 从研发部转移至生产部', time: '5分钟前', status: 'success' },
  { id: 2, type: 'maintenance', title: '重要设备保养提醒', detail: '数控机床 CNC-05 需要进行月度保养', time: '1小时前', status: 'warning' },
  { id: 3, type: 'inventory', title: 'RFID盘点完成', detail: '第一车间资产盘点完成,盘点率 99.5%', time: '2小时前', status: 'success' },
  { id: 4, type: 'idle', title: '闲置资产公告发布', detail: '办公设备 5台笔记本电脑待认领', time: '3小时前', status: 'info' },
  { id: 5, type: 'compensation', title: '资产赔偿申请', detail: '员工张三提交设备损坏赔偿申请', time: '5小时前', status: 'warning' },
];

const pendingApprovals = [
  { id: 1, type: '资产新增', applicant: '李四', asset: '��记本电脑 ThinkPad X1', amount: '¥8,500', time: '2024-03-08' },
  { id: 2, type: '资产报废', applicant: '王五', asset: '打印机 HP LaserJet', amount: '¥0', time: '2024-03-08' },
  { id: 3, type: '资产转移', applicant: '赵六', asset: '投影仪 Epson EB-2250U', amount: '-', time: '2024-03-07' },
];

function formatNumber(value?: number | string) {
  if (value === undefined || value === null || value === "") {
    return "--";
  }

  const numericValue = Number(value);

  if (Number.isNaN(numericValue)) {
    return String(value);
  }

  return new Intl.NumberFormat("zh-CN").format(numericValue);
}

function formatCurrency(value?: number | string) {
  if (value === undefined || value === null || value === "") {
    return "--";
  }

  const numericValue = Number(value);

  if (Number.isNaN(numericValue)) {
    return String(value);
  }

  return new Intl.NumberFormat("zh-CN", {
    style: "currency",
    currency: "CNY",
    maximumFractionDigits: 0,
  }).format(numericValue);
}

function formatDateLabel(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("zh-CN", {
    month: "numeric",
    day: "numeric",
  }).format(date);
}

export function Dashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [valueTrends, setValueTrends] = useState<AssetValueTrend[]>([]);
  const [deptDistribution, setDeptDistribution] = useState<DeptDistribution[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    async function loadDashboard() {
      setLoading(true);
      setError(null);

      try {
        const [statsResponse, trendsResponse, distributionResponse] = await Promise.all([
          dashboardService.getStats(),
          dashboardService.getValueTrends(),
          dashboardService.getDeptDistribution(),
        ]);

        if (!mounted) {
          return;
        }

        setStats(statsResponse);
        setValueTrends(trendsResponse);
        setDeptDistribution(distributionResponse);
      } catch (loadError) {
        if (!mounted) {
          return;
        }

        setError(loadError instanceof Error ? loadError.message : "仪表板数据加载失败");
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    }

    void loadDashboard();

    return () => {
      mounted = false;
    };
  }, []);

  const statCards = useMemo(
    () => [
      {
        name: "资产总数",
        value: formatNumber(stats?.totalAssets),
        detail: `在用资产 ${formatNumber(stats?.inUseAssets)}`,
        icon: Package,
      },
      {
        name: "待审批流程",
        value: formatNumber(stats?.pendingApprovals),
        detail: "待处理审批事项",
        icon: Clock,
      },
      {
        name: "闲置资产",
        value: formatNumber(stats?.idleAssets),
        detail: `报废资产 ${formatNumber(stats?.scrapAssets)}`,
        icon: AlertCircle,
      },
      {
        name: "资产净值",
        value: formatCurrency(stats?.netValue),
        detail: `总值 ${formatCurrency(stats?.totalValue)}`,
        icon: CheckCircle,
      },
    ],
    [stats],
  );

  const trendChartData = useMemo(
    () =>
      valueTrends.map((item) => ({
        date: formatDateLabel(item.date),
        totalValue: Number(item.totalValue),
        netValue: Number(item.netValue),
      })),
    [valueTrends],
  );

  const distributionChartData = useMemo(
    () =>
      deptDistribution.map((item, index) => ({
        ...item,
        fill: chartPalette[index % chartPalette.length],
      })),
    [deptDistribution],
  );

  return (
    <div className="space-y-6">
      {/* 页面标题 */}
      <div>
        <h2 className="text-2xl font-semibold text-gray-900">仪表板</h2>
        <p className="text-gray-600 mt-1">欢迎回来,这是您的资产管理概览</p>
      </div>

      {loading ? (
        <div className="rounded-lg border border-border bg-card px-4 py-3 text-sm text-muted-foreground">
          正在同步仪表板数据...
        </div>
      ) : null}

      {error ? (
        <div className="rounded-lg border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      ) : null}

      {/* 统计卡片 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {statCards.map((stat) => (
          <div key={stat.name} className="bg-white rounded-lg border border-gray-200 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">{stat.name}</p>
                <p className="text-3xl font-semibold text-gray-900 mt-2">{stat.value}</p>
                <p className="mt-2 text-sm text-gray-500">{stat.detail}</p>
              </div>
              <div className="w-12 h-12 bg-blue-50 rounded-lg flex items-center justify-center">
                <stat.icon className="w-6 h-6 text-blue-600" />
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 资产趋势图 */}
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">资产价值趋势</h3>
          {trendChartData.length ? (
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={trendChartData}>
                <CartesianGrid stroke="var(--color-border)" strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis tickFormatter={(value) => formatNumber(value)} />
                <Tooltip
                  formatter={(value) => formatCurrency(value as number)}
                  labelFormatter={(label) => `日期：${label}`}
                />
                <Legend />
                <Line
                  dataKey="totalValue"
                  name="资产总值"
                  stroke="var(--color-chart-1)"
                  strokeWidth={2}
                  type="monotone"
                />
                <Line
                  dataKey="netValue"
                  name="资产净值"
                  stroke="var(--color-chart-2)"
                  strokeWidth={2}
                  type="monotone"
                />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex h-[300px] items-center justify-center text-sm text-gray-500">
              {loading ? "正在加载趋势数据..." : "暂无趋势数据"}
            </div>
          )}
        </div>

        {/* 设备使用率分布 */}
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">部门资产分布</h3>
          <div className="flex items-center justify-center">
            {distributionChartData.length ? (
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    cx="50%"
                    cy="50%"
                    data={distributionChartData}
                    dataKey="assetCount"
                    label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`}
                    labelLine={false}
                    nameKey="deptName"
                    outerRadius={100}
                  >
                    {distributionChartData.map((entry) => (
                      <Cell key={`cell-dashboard-${entry.deptId}`} fill={entry.fill} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value) => `${formatNumber(value as number)} 件`} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-[300px] items-center justify-center text-sm text-gray-500">
                {loading ? "正在加载分布数据..." : "暂无分布数据"}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 最近动态 */}
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">最近动态</h3>
          <div className="space-y-4">
            {recentActivities.map((activity) => (
              <div key={activity.id} className="flex gap-3 pb-4 border-b border-gray-100 last:border-0">
                <div className={`w-2 h-2 rounded-full mt-2 flex-shrink-0 ${
                  activity.status === 'success' ? 'bg-green-500' :
                  activity.status === 'warning' ? 'bg-yellow-500' :
                  activity.status === 'info' ? 'bg-blue-500' : 'bg-gray-500'
                }`}></div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900">{activity.title}</p>
                  <p className="text-sm text-gray-600 mt-1">{activity.detail}</p>
                  <p className="text-xs text-gray-500 mt-1">{activity.time}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 待审批事项 */}
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">待审批事项</h3>
            <span className="px-2.5 py-0.5 text-xs font-medium bg-red-100 text-red-800 rounded-full">
              {formatNumber(stats?.pendingApprovals ?? pendingApprovals.length)}项待处理
            </span>
          </div>
          <div className="space-y-3">
            {pendingApprovals.map((approval) => (
              <div key={approval.id} className="p-4 bg-gray-50 rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <span className="px-2 py-1 text-xs font-medium bg-blue-100 text-blue-800 rounded">
                    {approval.type}
                  </span>
                  <span className="text-xs text-gray-500">{approval.time}</span>
                </div>
                <p className="text-sm font-medium text-gray-900">{approval.asset}</p>
                <div className="flex items-center justify-between mt-2">
                  <span className="text-sm text-gray-600">申请人: {approval.applicant}</span>
                  {approval.amount !== '-' && (
                    <span className="text-sm font-medium text-gray-900">{approval.amount}</span>
                  )}
                </div>
                <div className="flex gap-2 mt-3">
                  <button className="flex-1 px-3 py-1.5 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded transition-colors">
                    批准
                  </button>
                  <button className="flex-1 px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 rounded transition-colors">
                    驳回
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 快速操作 */}
        <QuickActions />

        {/* 保养日历 */}
        <MaintenanceCalendar />
      </div>
    </div>
  );
}
