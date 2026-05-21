import { useState } from 'react';
import { useNavigate } from 'react-router';
import { useQuery } from '@tanstack/react-query';
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
import { getDashboardStats, getAssetValueTrends } from '@/api/asset';
import { getWorkOrderList } from '@/api/workorder';
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

const MOCK_TREND = [
  { month: '6月',  total: 1050, net: 780 },
  { month: '7月',  total: 1080, net: 795 },
  { month: '8月',  total: 1120, net: 820 },
  { month: '9月',  total: 1150, net: 840 },
  { month: '10月', total: 1200, net: 870 },
  { month: '11月', total: 1180, net: 855 },
  { month: '12月', total: 1220, net: 890 },
  { month: '1月',  total: 1260, net: 910 },
  { month: '2月',  total: 1250, net: 905 },
  { month: '3月',  total: 1280, net: 920 },
  { month: '4月',  total: 1300, net: 930 },
  { month: '5月',  total: 1268, net: 924 },
];

const CATEGORY_DATA = [
  { name: 'IT设备',    value: 40, color: '#2563eb' },
  { name: '生产设备',  value: 25, color: '#004ac6' },
  { name: '办公家具',  value: 15, color: '#505f76' },
  { name: '运输工具',  value: 10, color: '#943700' },
  { name: '实验器材',  value: 5,  color: '#737686' },
  { name: '其他',      value: 5,  color: '#d8dadc' },
];

const MOCK_WORKORDERS = [
  { id: 1, orderNo: 'WO-20240501', title: '生产线3号日常维保',   type: '维保', priority: '高', status: 'PENDING',     createdAt: '05-20 09:30' },
  { id: 2, orderNo: 'WO-20240502', title: 'A座4F空调故障抢修',   type: '抢修', priority: '高', status: 'IN_PROGRESS', createdAt: '05-20 10:15' },
  { id: 3, orderNo: 'WO-20240503', title: '研发服务器阵列扩容',   type: '维保', priority: '中', status: 'COMPLETED',   createdAt: '05-19 16:40' },
  { id: 4, orderNo: 'WO-20240504', title: '实验室精密仪表校准',   type: '维保', priority: '中', status: 'PENDING',     createdAt: '05-19 14:00' },
  { id: 5, orderNo: 'WO-20240505', title: '公车苏A-8888定期保养', type: '维保', priority: '低', status: 'COMPLETED',   createdAt: '05-18 11:20' },
];

const MOCK_ALERTS = [
  { id: 1, name: '精密数控机床 X1',     level: '紧急', daysLeft: 3,  desc: '逾期风险预警',   icon: Wrench },
  { id: 2, name: '核心交换机 (研发楼)',  level: '普通', daysLeft: 8,  desc: '定期巡检提醒',   icon: Server },
  { id: 3, name: '质谱分析仪 MS-03',    level: '普通', daysLeft: 12, desc: '传感器校准计划', icon: FlaskConical },
  { id: 4, name: '1号货梯 (制造部)',     level: '紧急', daysLeft: 2,  desc: '特种设备强检',   icon: ArrowUpRight },
];

const DEPARTMENT_STATS = [
  { name: '研发中心', count: '428 件', value: '¥12.5M', pct: 85 },
  { name: '制造部',   count: '356 件', value: '¥28.4M', pct: 72 },
  { name: '实验室',   count: '184 件', value: '¥8.2M',  pct: 45 },
  { name: '行政部',   count: '120 件', value: '¥1.4M',  pct: 30 },
  { name: '销售部',   count: '98 件',  value: '¥0.8M',  pct: 24 },
];

export default function DashboardPage() {
  const navigate = useNavigate();

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

  const stats = (statsRes as any)?.data;
  const trends = (trendsRes as any)?.data ?? [];
  const workorders = (woRes as any)?.data?.records ?? [];

  const trendData = trends.length > 0
    ? trends.slice(-12).map((t: any) => ({
        month: t.date?.substring(5, 7) + '月',
        total: Math.round(t.totalValue / 10000),
        net:   Math.round(t.netValue / 10000),
      }))
    : MOCK_TREND;

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

  const displayWOs = workorders.length > 0 ? workorders : MOCK_WORKORDERS;

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
            <Button variant="primary" size="md">
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
              value={(stats?.totalAssets ?? 1286).toLocaleString()}
              trend={{ value: '2.4%', direction: 'up' }}
              icon={BarChart3}
              iconColor="#004ac6"
            />
            <KpiCard
              title="在用资产"
              value={(stats?.inUseAssets ?? 892).toLocaleString()}
              trend={{ value: '5.1%', direction: 'up' }}
              icon={CheckCircle2}
              iconColor="#16a34a"
            />
            <KpiCard
              title="闲置资产"
              value={(stats?.idleAssets ?? 156).toLocaleString()}
              trend={{ value: '1.2%', direction: 'down' }}
              icon={Package}
              iconColor="#6b7280"
            />
            <KpiCard
              title="待审批"
              value={stats?.pendingApprovals ?? 23}
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
          </CardContent>
        </Card>

        <Card className="lg:col-span-4">
          <CardHeader>
            <CardTitle>分类分布</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col items-center">
            <div className="relative w-48 h-48">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={CATEGORY_DATA}
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={80}
                    dataKey="value"
                    paddingAngle={2}
                  >
                    {CATEGORY_DATA.map((d, i) => (
                      <Cell key={i} fill={d.color} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, fontSize: 12 }} />
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <span className="text-2xl font-bold text-[#0f172a]">1,286</span>
                <span className="text-[10px] text-[#64748b]">资产总额</span>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-x-8 gap-y-2 mt-6 w-full">
              {CATEGORY_DATA.map((d) => (
                <div key={d.name} className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: d.color }} />
                  <span className="text-xs text-[#64748b]">{d.name} ({d.value}%)</span>
                </div>
              ))}
            </div>
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
            <DataTable columns={woColumns} data={displayWOs} compact onRowClick={(row) => navigate(`/workorders/${row.id}`)} />
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
            <div className="space-y-3">
              {MOCK_ALERTS.map((alert) => {
                const AlertIcon = alert.icon;
                const isUrgent = alert.level === '紧急';
                const urgentColors = 'bg-red-50 text-red-600';
                const normalColors = 'bg-[#ffdbcd] text-[#943700]';
                const colors = isUrgent ? urgentColors : normalColors;
                return (
                  <div key={alert.id} className="flex items-center gap-3 p-3 hover:bg-[#f8fafc] rounded-lg transition-colors border border-transparent hover:border-[#e5e7eb]/60">
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${colors}`}>
                      <AlertIcon className="w-5 h-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-start">
                        <h5 className="text-sm font-bold text-[#0f172a] truncate">{alert.name}</h5>
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded flex-shrink-0 ml-2 ${isUrgent ? 'bg-red-50 text-red-700' : 'bg-[#ffdbcd] text-[#943700]'}`}>
                          {alert.level}
                        </span>
                      </div>
                      <div className="flex justify-between items-center mt-1">
                        <span className="text-[11px] text-[#64748b]">{alert.desc}</span>
                        <span className={`text-[11px] font-bold ${isUrgent ? 'text-red-600' : 'text-[#943700]'}`}>
                          剩余 {alert.daysLeft} 天
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>部门资产统计 (Top 5 部门)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-5">
            {DEPARTMENT_STATS.map((dept) => (
              <div key={dept.name} className="space-y-2">
                <div className="flex justify-between text-xs font-medium text-[#0f172a]">
                  <span>{dept.name}</span>
                  <span>{dept.count} ({dept.value})</span>
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
        </CardContent>
      </Card>
    </div>
  );
}
