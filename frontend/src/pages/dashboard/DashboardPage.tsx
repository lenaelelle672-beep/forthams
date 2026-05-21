import { useNavigate } from 'react-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  BarChart3, CheckCircle2, Package, Clock,
  TrendingUp, TrendingDown, ChevronRight, Plus,
  Download, RefreshCw, Bell, Cog, Wrench,
  Server, FlaskConical, ArrowUpRight,
} from 'lucide-react';
import {
  AreaChart, Area, PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip, Legend, ResponsiveContainer,
} from 'recharts';
import {
  getDashboardStats,
  getAssetValueTrends,
  getDeptDistribution,
  getMaintenanceStats,
} from '@/api/asset';
import { getWorkOrderList } from '@/api/workorder';
import type { ApiResponse, PaginatedResponse } from '@/types/common';
import type { DashboardStats, AssetValueTrend, DeptAssetDistribution } from '@/types/asset';
import type { WorkOrderListItem } from '@/types/workorder';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { KpiCard } from '@/components/ui/KpiCard';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { PageHeader } from '@/components/ui/PageHeader';
import { DataTable, type Column } from '@/components/ui/DataTable';
import { SkeletonCard } from '@/components/ui/Skeleton';

const PIE_COLORS = ['#2563eb', '#004ac6', '#505f76', '#943700', '#737686', '#d8dadc'];

const WO_STATUS_BADGE: Record<string, { label: string; variant: 'default' | 'success' | 'warning' | 'danger' | 'gray' }> = {
  PENDING:           { label: '待处理',  variant: 'default'  },
  IN_PROGRESS:       { label: '进行中',  variant: 'success'  },
  COMPLETED:         { label: '已完成',  variant: 'success'  },
  APPROVING_LEVEL_1: { label: '审批中',  variant: 'warning'  },
  REJECTED:          { label: '已驳回',  variant: 'danger'   },
  CANCELLED:         { label: '已取消',  variant: 'gray'     },
};

interface MaintenanceAlertItem {
  id: number | string;
  assetName: string;
  maintenanceType?: string;
  daysLeft?: number;
  remainingDays?: number;
  dueDate?: string;
  urgency?: 'urgent' | 'warning' | 'normal';
}

interface MaintenanceStatsData {
  upcomingCount?: number;
  overdueCount?: number;
  alerts?: MaintenanceAlertItem[];
  upcomingList?: MaintenanceAlertItem[];
  [key: string]: unknown;
}

export default function DashboardPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: statsRes, isLoading: statsLoading } = useQuery({
    queryKey: ['dashboard', 'stats'],
    queryFn: getDashboardStats,
    staleTime: 1000 * 60 * 5,
  });

  const { data: trendsRes } = useQuery({
    queryKey: ['dashboard', 'trends', 12],
    queryFn: () => getAssetValueTrends(365),
    staleTime: 1000 * 60 * 15,
  });

  const { data: woRes } = useQuery({
    queryKey: ['dashboard', 'workorders'],
    queryFn: () => getWorkOrderList({ page: 1, pageSize: 5 }),
    staleTime: 1000 * 30,
  });

  const { data: deptRes } = useQuery({
    queryKey: ['dashboard', 'dept-distribution'],
    queryFn: getDeptDistribution,
    staleTime: 1000 * 60 * 5,
  });

  const { data: maintenanceRes } = useQuery({
    queryKey: ['dashboard', 'maintenance-stats'],
    queryFn: getMaintenanceStats,
    staleTime: 1000 * 60 * 5,
  });

  const stats = (statsRes as ApiResponse<DashboardStats> | undefined)?.data;
  const trends = (trendsRes as ApiResponse<AssetValueTrend[]> | undefined)?.data ?? [];
  const workorders = (woRes as PaginatedResponse<WorkOrderListItem> | undefined)?.data?.records ?? [];
  const deptRawData: Array<{ deptId: number; deptName: string; assetCount: number }> =
    (deptRes as ApiResponse<DeptAssetDistribution[]> | undefined)?.data ?? [];
  const maintenanceStats = (maintenanceRes as ApiResponse<MaintenanceStatsData> | undefined)?.data;

  // Trend data from API (no MOCK fallback)
  const trendData = trends.slice(-12).map((t: AssetValueTrend) => ({
    month: t.date?.substring(5, 7) + '月',
    total: Math.round(t.totalValue / 10000),
    net:   Math.round(t.netValue / 10000),
  }));

  // Category distribution from stats API
  const categoryData = stats?.categoryDistribution
    ? Object.entries(stats.categoryDistribution as Record<string, number>).map(
        ([name, value], i) => ({
          name,
          value,
          color: PIE_COLORS[i % PIE_COLORS.length],
        }),
      )
    : [];

  const totalAssetCount = stats?.totalAssets ?? 0;

  // Department stats from API (top 5)
  const maxDeptCount = Math.max(...deptRawData.map((d) => d.assetCount ?? 0), 1);
  const departmentStats = deptRawData.slice(0, 5).map((d) => ({
    name: d.deptName || '未知部门',
    count: `${d.assetCount ?? 0} 件`,
    pct: Math.round(((d.assetCount ?? 0) / maxDeptCount) * 100),
  }));

  // Maintenance alerts from API
  const maintenanceAlerts: MaintenanceAlertItem[] = Array.isArray(maintenanceStats?.alerts)
    ? maintenanceStats!.alerts!
    : Array.isArray(maintenanceStats?.upcomingList)
      ? maintenanceStats!.upcomingList!
      : [];

  const handleRefresh = () => {
    queryClient.invalidateQueries({ queryKey: ['dashboard'] });
  };

  const now = new Date();
  const dateStr = `${now.getFullYear()}年${now.getMonth() + 1}月${now.getDate()}日`;

  const woColumns: Column<any>[] = [
    {
      key: 'orderNo', title: '工单编号', width: 130,
      render: (v) => <span className="font-mono text-xs text-[#004ac6] font-medium">{String(v)}</span>,
    },
    { key: 'title',  title: '标题' },
    {
      key: 'type', title: '类型', width: 70,
      render: (v) => {
        const color = String(v) === '抢修' ? 'bg-orange-50 text-orange-700' : 'bg-blue-50 text-blue-700';
        return <span className={`text-[11px] font-bold px-2 py-0.5 rounded ${color}`}>{String(v)}</span>;
      },
    },
    {
      key: 'priority', title: '优先级', width: 70,
      render: (v) => {
        const map: Record<string, string> = { '高': 'bg-red-50 text-red-700', '中': 'bg-blue-50 text-blue-700', '低': 'bg-gray-50 text-gray-700' };
        const cls = map[String(v)] ?? 'bg-gray-50 text-gray-700';
        return <span className={`text-[11px] font-bold px-2 py-0.5 rounded ${cls}`}>{String(v)}</span>;
      },
    },
    {
      key: 'status', title: '状态', width: 80,
      render: (v) => {
        const cfg = WO_STATUS_BADGE[String(v)];
        const fallback: Record<string, { label: string; variant: 'default' | 'success' | 'warning' | 'danger' | 'gray' }> = {
          '待处理': { label: '待处理', variant: 'default' },
          '进行中': { label: '进行中', variant: 'success' },
          '已完成': { label: '已完成', variant: 'success' },
        };
        const resolved = cfg ?? fallback[String(v)] ?? { label: String(v), variant: 'gray' as const };
        return <Badge variant={resolved.variant}>{resolved.label}</Badge>;
      },
    },
    {
      key: 'createdAt', title: '创建时间', width: 110,
      render: (v) => <span className="text-xs text-[#64748b]">{String(v)}</span>,
    },
  ];

  return (
    <div className="p-6 space-y-6">
      <PageHeader
        title="仪表板"
        subtitle={`欢迎回来，系统管理员 · ${dateStr}`}
        actions={
          <>
            <Button variant="outline" size="md">
              <Download className="w-4 h-4" />
              导出数据
            </Button>
            <Button variant="primary" size="md" onClick={handleRefresh}>
              <RefreshCw className="w-4 h-4" />
              刷新视图
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {statsLoading ? (
          Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} />)
        ) : (
          <>
            <KpiCard
              title="总资产数"
              value={(stats?.totalAssets ?? 0).toLocaleString()}
              trend={{ value: '2.4%', direction: 'up' }}
              icon={BarChart3}
              iconColor="#004ac6"
            />
            <KpiCard
              title="在用资产"
              value={(stats?.inUseAssets ?? 0).toLocaleString()}
              trend={{ value: '5.1%', direction: 'up' }}
              icon={CheckCircle2}
              iconColor="#16a34a"
            />
            <KpiCard
              title="闲置资产"
              value={(stats?.idleAssets ?? 0).toLocaleString()}
              trend={{ value: '1.2%', direction: 'down' }}
              icon={Package}
              iconColor="#6b7280"
            />
            <KpiCard
              title="待审批"
              value={stats?.pendingApprovals ?? 0}
              icon={Clock}
              iconColor="#943700"
              className="border-l-4 border-l-[#943700]"
            />
          </>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-10 gap-6">
        <Card className="lg:col-span-6">
          <CardHeader>
            <CardTitle>资产价值趋势 (近12个月)</CardTitle>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-[#004ac6]" />
                <span className="text-xs text-[#64748b]">总价值</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-[#b7c8e1]" />
                <span className="text-xs text-[#64748b]">净值</span>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {trendData.length > 0 ? (
              <ResponsiveContainer width="100%" height={280}>
                <AreaChart data={trendData} margin={{ top: 8, right: 16, left: -16, bottom: 24 }}>
                  <defs>
                    <linearGradient id="totalGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#004ac6" stopOpacity={0.15} />
                      <stop offset="100%" stopColor="#004ac6" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="month" tick={{ fontSize: 10, fill: '#64748b' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: '#64748b' }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, fontSize: 12 }} />
                  <Area type="monotone" dataKey="total" stroke="#004ac6" strokeWidth={3} fill="url(#totalGrad)" dot={false} />
                  <Area type="monotone" dataKey="net" stroke="#b7c8e1" strokeWidth={3} strokeDasharray="6 4" fill="none" dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-[280px] text-[#64748b] text-sm">
                暂无趋势数据
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-4">
          <CardHeader>
            <CardTitle>分类分布</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col items-center">
            {categoryData.length > 0 ? (
              <>
                <div className="relative w-48 h-48">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={categoryData}
                        cx="50%"
                        cy="50%"
                        innerRadius={55}
                        outerRadius={80}
                        dataKey="value"
                        paddingAngle={2}
                      >
                        {categoryData.map((d, i) => (
                          <Cell key={i} fill={d.color} />
                        ))}
                      </Pie>
                      <Tooltip contentStyle={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, fontSize: 12 }} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                    <span className="text-2xl font-bold text-[#0f172a]">{totalAssetCount.toLocaleString()}</span>
                    <span className="text-[10px] text-[#64748b]">资产总额</span>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-x-8 gap-y-2 mt-6 w-full">
                  {categoryData.map((d) => (
                    <div key={d.name} className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: d.color }} />
                      <span className="text-xs text-[#64748b]">{d.name} ({d.value})</span>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="flex items-center justify-center h-48 text-[#64748b] text-sm">
                暂无分类数据
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-10 gap-6">
        <Card className="lg:col-span-6">
          <CardHeader>
            <CardTitle>最近工单</CardTitle>
            <button
              className="text-xs text-[#004ac6] font-medium hover:underline"
              onClick={() => navigate('/workorders')}
            >
              查看全部
            </button>
          </CardHeader>
          <CardContent className="p-0">
            {workorders.length > 0 ? (
              <DataTable columns={woColumns} data={workorders} compact onRowClick={(row) => navigate(`/workorders/${row.id}`)} />
            ) : (
              <div className="flex items-center justify-center py-12 text-[#64748b] text-sm">
                暂无工单数据
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-4">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bell className="w-4 h-4 text-[#737686]" />
              维保预警
            </CardTitle>
          </CardHeader>
          <CardContent>
            {maintenanceAlerts.length > 0 ? (
              <div className="space-y-3">
                {maintenanceAlerts.slice(0, 5).map((alert) => {
                  const daysLeft = alert.daysLeft ?? alert.remainingDays ?? 0;
                  const isUrgent = alert.urgency === 'urgent' || daysLeft <= 7;
                  const urgentColors = 'bg-red-50 text-red-600';
                  const normalColors = 'bg-[#ffdbcd] text-[#943700]';
                  const colors = isUrgent ? urgentColors : normalColors;
                  return (
                    <div key={alert.id} className="flex items-center gap-3 p-3 hover:bg-[#f8fafc] rounded-lg transition-colors border border-transparent hover:border-[#e5e7eb]/60">
                      <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${colors}`}>
                        <Wrench className="w-5 h-5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between items-start">
                          <h5 className="text-sm font-bold text-[#0f172a] truncate">{alert.assetName}</h5>
                          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded flex-shrink-0 ml-2 ${isUrgent ? 'bg-red-50 text-red-700' : 'bg-[#ffdbcd] text-[#943700]'}`}>
                            {isUrgent ? '紧急' : '普通'}
                          </span>
                        </div>
                        <div className="flex justify-between items-center mt-1">
                          <span className="text-[11px] text-[#64748b]">{alert.maintenanceType ?? '维保提醒'}</span>
                          <span className={`text-[11px] font-bold ${isUrgent ? 'text-red-600' : 'text-[#943700]'}`}>
                            剩余 {daysLeft} 天
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="flex items-center justify-center py-12 text-[#64748b] text-sm">
                暂无维保预警
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>部门资产统计 (Top 5 部门)</CardTitle>
        </CardHeader>
        <CardContent>
          {departmentStats.length > 0 ? (
            <div className="space-y-5">
              {departmentStats.map((dept) => (
                <div key={dept.name} className="space-y-2">
                  <div className="flex justify-between text-xs font-medium text-[#0f172a]">
                    <span>{dept.name}</span>
                    <span>{dept.count}</span>
                  </div>
                  <div className="w-full h-3 bg-[#e6e8ea] rounded-full overflow-hidden">
                    <div
                      className="h-full bg-[#004ac6] rounded-full transition-all duration-500"
                      style={{ width: `${dept.pct}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex items-center justify-center py-8 text-[#64748b] text-sm">
              暂无部门统计数据
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
