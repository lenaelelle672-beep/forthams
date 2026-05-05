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
import { approvalService, type ApprovalRecord } from '../services/approvalService';

const chartPalette = [
  "var(--color-chart-1)",
  "var(--color-chart-2)",
  "var(--color-chart-3)",
  "var(--color-chart-4)",
  "var(--color-chart-5)",
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

function formatApprovalDate(value: unknown) {
  return typeof value === "string" && value ? value : "-";
}

function getApprovalLabel(approval: ApprovalRecord, keys: string[], fallback = "-") {
  for (const key of keys) {
    const value = approval[key];
    if (value !== undefined && value !== null && value !== "") {
      return String(value);
    }
  }
  return fallback;
}

export function Dashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [valueTrends, setValueTrends] = useState<AssetValueTrend[]>([]);
  const [deptDistribution, setDeptDistribution] = useState<DeptDistribution[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pendingApprovals, setPendingApprovals] = useState<ApprovalRecord[]>([]);
  const [approvalMessage, setApprovalMessage] = useState<string | null>(null);
  const [approvalError, setApprovalError] = useState<string | null>(null);
  const [processingApprovalId, setProcessingApprovalId] = useState<number | string | null>(null);

  useEffect(() => {
    let mounted = true;

    async function loadDashboard() {
      setLoading(true);
      setError(null);

      try {
        let approvalLoadError: string | null = null;
        const [statsResponse, trendsResponse, distributionResponse, approvalsResponse] = await Promise.all([
          dashboardService.getStats(),
          dashboardService.getValueTrends(),
          dashboardService.getDeptDistribution(),
          approvalService.getPending().catch((pendingError) => {
            approvalLoadError = pendingError instanceof Error ? pendingError.message : "待审批事项加载失败";
            return [];
          }),
        ]);

        if (!mounted) {
          return;
        }

        setStats(statsResponse);
        setValueTrends(trendsResponse);
        setDeptDistribution(distributionResponse);
        setPendingApprovals((Array.isArray(approvalsResponse) ? approvalsResponse : (approvalsResponse as any)?.records) || []);
        setApprovalError(approvalLoadError);
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

  const recentActivities = useMemo(
    () =>
      pendingApprovals.slice(0, 5).map((approval) => ({
        id: approval.id,
        title: getApprovalLabel(approval, ["title", "type", "processType", "changeType"], "待审批事项"),
        detail: getApprovalLabel(approval, ["assetName", "asset", "reason", "description"], "来自审批服务的待处理记录"),
        time: formatApprovalDate(approval.createTime ?? approval.createdAt ?? approval.applyDate),
        status: "warning",
      })),
    [pendingApprovals],
  );

  const handleDashApprove = async (id: number | string, approved: boolean) => {
    try {
      setProcessingApprovalId(id);
      setApprovalError(null);
      setApprovalMessage(null);
      await approvalService.approve(id, { approved, comment: approved ? "同意" : "驳回" });
      setApprovalMessage(approved ? "审批已批准" : "审批已驳回");
      setPendingApprovals((current) => current.filter((approval) => approval.id !== id));
    } catch (approveError) {
      setApprovalError(approveError instanceof Error ? approveError.message : "审批操作失败");
    } finally {
      setProcessingApprovalId(null);
    }
  };

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
            {recentActivities.length ? recentActivities.map((activity) => (
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
            )) : (
              <div className="rounded-lg border border-dashed border-gray-200 p-4 text-sm text-gray-500">
                暂无最近动态；当前仅展示审批服务返回的真实待办记录。
              </div>
            )}
          </div>
        </div>

        {/* 待审批事项 */}
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">待审批事项</h3>
            <span className="px-2.5 py-0.5 text-xs font-medium bg-red-100 text-red-800 rounded-full">
              {formatNumber(pendingApprovals.length)}项待处理
            </span>
          </div>
          {approvalMessage ? <div className="mb-3 text-sm text-green-600">{approvalMessage}</div> : null}
          {approvalError ? <div className="mb-3 text-sm text-red-600">{approvalError}</div> : null}
          <div className="space-y-3">
            {pendingApprovals.length ? pendingApprovals.map((approval) => (
              <div key={approval.id} className="p-4 bg-gray-50 rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <span className="px-2 py-1 text-xs font-medium bg-blue-100 text-blue-800 rounded">
                    {getApprovalLabel(approval, ["type", "processType", "changeType"], "审批")}
                  </span>
                  <span className="text-xs text-gray-500">{formatApprovalDate(approval.createTime ?? approval.createdAt ?? approval.applyDate)}</span>
                </div>
                <p className="text-sm font-medium text-gray-900">{getApprovalLabel(approval, ["assetName", "asset", "title", "description"], "未提供资产名称")}</p>
                <div className="flex items-center justify-between mt-2">
                  <span className="text-sm text-gray-600">申请人: {getApprovalLabel(approval, ["applicant", "applicantName", "operatorId", "userId"], "-")}</span>
                  <span className="text-sm font-medium text-gray-900">{getApprovalLabel(approval, ["amount", "value", "cost"], "")}</span>
                </div>
                <div className="flex gap-2 mt-3">
                  <button disabled={processingApprovalId === approval.id} onClick={() => handleDashApprove(approval.id, true)} className="flex-1 px-3 py-1.5 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-60 rounded transition-colors">
                    {processingApprovalId === approval.id ? "处理中..." : "批准"}
                  </button>
                  <button disabled={processingApprovalId === approval.id} onClick={() => handleDashApprove(approval.id, false)} className="flex-1 px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 disabled:opacity-60 rounded transition-colors">
                    驳回
                  </button>
                </div>
              </div>
            )) : (
              <div className="rounded-lg border border-dashed border-gray-200 p-4 text-sm text-gray-500">
                暂无待审批事项。
              </div>
            )}
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
