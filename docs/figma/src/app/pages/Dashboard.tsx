import { TrendingUp, TrendingDown, Package, AlertCircle, CheckCircle, Clock } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell } from "recharts";
import { QuickActions } from "../components/QuickActions";
import { MaintenanceCalendar } from "../components/MaintenanceCalendar";

const stats = [
  { name: '资产总数', value: '12,458', change: '+12%', trend: 'up', icon: Package },
  { name: '待审批流程', value: '23', change: '-5%', trend: 'down', icon: Clock },
  { name: '闲置资产', value: '156', change: '+3%', trend: 'up', icon: AlertCircle },
  { name: '设备完好率', value: '98.5%', change: '+0.5%', trend: 'up', icon: CheckCircle },
];

const assetTrend = [
  { month: '1月', 新增: 120, 报废: 30, 转移: 45 },
  { month: '2月', 新增: 150, 报废: 25, 转移: 52 },
  { month: '3月', 新增: 180, 报废: 35, 转移: 48 },
  { month: '4月', 新增: 160, 报废: 28, 转移: 55 },
  { month: '5月', 新增: 200, 报废: 32, 转移: 60 },
  { month: '6月', 新增: 190, 报废: 30, 转移: 58 },
];

const equipmentUsage = [
  { name: '高效使用', value: 65, color: '#10b981' },
  { name: '正常使用', value: 25, color: '#3b82f6' },
  { name: '低效使用', value: 7, color: '#f59e0b' },
  { name: '闲置', value: 3, color: '#ef4444' },
];

const recentActivities = [
  { id: 1, type: 'approve', title: '资产转移申请已审批', detail: '设备编号: EQ-2024-001 从研发部转移至生产部', time: '5分钟前', status: 'success' },
  { id: 2, type: 'maintenance', title: '重要设备保养提醒', detail: '数控机床 CNC-05 需要进行月度保养', time: '1小时前', status: 'warning' },
  { id: 3, type: 'inventory', title: 'RFID盘点完成', detail: '第一车间资产盘点完成,盘点率 99.5%', time: '2小时前', status: 'success' },
  { id: 4, type: 'idle', title: '闲置资产公告发布', detail: '办公设备 5台笔记本电脑待认领', time: '3小时前', status: 'info' },
  { id: 5, type: 'compensation', title: '资产赔偿申请', detail: '员工张三提交设备损坏赔偿申请', time: '5小时前', status: 'warning' },
];

const pendingApprovals = [
  { id: 1, type: '资产新增', applicant: '李四', asset: '笔记本电脑 ThinkPad X1', amount: '¥8,500', time: '2024-03-08' },
  { id: 2, type: '资产报废', applicant: '王五', asset: '打印机 HP LaserJet', amount: '¥0', time: '2024-03-08' },
  { id: 3, type: '资产转移', applicant: '赵六', asset: '投影仪 Epson EB-2250U', amount: '-', time: '2024-03-07' },
];

export function Dashboard() {
  return (
    <div className="space-y-6">
      {/* 页面标题 */}
      <div>
        <h2 className="text-2xl font-semibold text-gray-900">仪表板</h2>
        <p className="text-gray-600 mt-1">欢迎回来,这是您的资产管理概览</p>
      </div>

      {/* 统计卡片 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat) => (
          <div key={stat.name} className="bg-white rounded-lg border border-gray-200 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">{stat.name}</p>
                <p className="text-3xl font-semibold text-gray-900 mt-2">{stat.value}</p>
                <div className="flex items-center gap-1 mt-2">
                  {stat.trend === 'up' ? (
                    <TrendingUp className="w-4 h-4 text-green-600" />
                  ) : (
                    <TrendingDown className="w-4 h-4 text-red-600" />
                  )}
                  <span className={`text-sm ${stat.trend === 'up' ? 'text-green-600' : 'text-red-600'}`}>
                    {stat.change}
                  </span>
                  <span className="text-sm text-gray-500">vs上月</span>
                </div>
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
          <h3 className="text-lg font-semibold text-gray-900 mb-4">资产变动趋势</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={assetTrend} isAnimationActive={false}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey="新增" fill="#10b981" />
              <Bar dataKey="报废" fill="#ef4444" />
              <Bar dataKey="转移" fill="#3b82f6" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* 设备使用率分布 */}
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">重要设备使用率分布</h3>
          <div className="flex items-center justify-center">
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={equipmentUsage}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  outerRadius={100}
                  fill="#8884d8"
                  dataKey="value"
                  isAnimationActive={false}
                >
              {equipmentUsage.map((entry) => (
                <Cell key={`cell-dashboard-${entry.name}`} fill={entry.color} />
              ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
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
              {pendingApprovals.length}项待处理
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
