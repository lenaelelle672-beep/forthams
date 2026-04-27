import { BarChart3, Download, TrendingUp, Package, DollarSign } from "lucide-react";
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";

const assetValueTrend = [
  { month: '2023-09', 总价值: 4500000, 新增: 120000, 折旧: 80000 },
  { month: '2023-10', 总价值: 4650000, 新增: 180000, 折旧: 85000 },
  { month: '2023-11', 总价值: 4800000, 新增: 200000, 折旧: 90000 },
  { month: '2023-12', 总价值: 4950000, 新增: 220000, 折旧: 95000 },
  { month: '2024-01', 总价值: 5100000, 新增: 250000, 折旧: 100000 },
  { month: '2024-02', 总价值: 5280000, 新增: 280000, 折旧: 105000 },
];

const categoryDistribution = [
  { name: '电子设备', value: 3200000, count: 450, color: '#3b82f6' },
  { name: '生产设备', value: 1800000, count: 85, color: '#10b981' },
  { name: '办公设备', value: 280000, count: 320, color: '#f59e0b' },
  { name: '移动设备', value: 150000, count: 180, color: '#8b5cf6' },
  { name: '其他', value: 70000, count: 120, color: '#6b7280' },
];

const departmentAssets = [
  { dept: '研发部', 资产数量: 280, 资产价值: 1500000 },
  { dept: '生产部', 资产数量: 150, 资产价值: 2200000 },
  { dept: '销售部', 资产数量: 180, 资产价值: 650000 },
  { dept: '行政部', 资产数量: 120, 资产价值: 280000 },
  { dept: '财务部', 资产数量: 90, 资产价值: 350000 },
  { dept: '设计部', 资产数量: 110, 资产价值: 520000 },
];

const utilizationStats = [
  { status: '高效使用', count: 520, percentage: 65 },
  { status: '正常使用', count: 200, percentage: 25 },
  { status: '低效使用', count: 56, percentage: 7 },
  { status: '闲置', count: 24, percentage: 3 },
];

const lifecycleData = [
  { stage: '新增', count: 156 },
  { stage: '在用', count: 780 },
  { stage: '维修中', count: 12 },
  { stage: '闲置', count: 24 },
  { stage: '报废', count: 28 },
];

const maintenanceTrend = [
  { month: '1月', 保养次数: 45, 维修次数: 12, 费用: 35000 },
  { month: '2月', 保养次数: 52, 维修次数: 15, 费用: 42000 },
  { month: '3月', 保养次数: 48, 维修次数: 10, 费用: 38000 },
];

const topExpenses = [
  { name: '数控机床 CNC-05', category: '生产设备', maintenanceCost: 18000, count: 6 },
  { name: '激光切割机 LC-08', category: '生产设备', maintenanceCost: 15000, count: 8 },
  { name: '工业机器人 RB-12', category: '生产设备', maintenanceCost: 12000, count: 5 },
  { name: '精密测量仪 PM-06', category: '检测设备', maintenanceCost: 8000, count: 4 },
];

export function Analytics() {
  return (
    <div className="space-y-6">
      {/* 页面标题 */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-gray-900">数据统计分析</h2>
          <p className="text-gray-600 mt-1">多维度资产数据分析与可视化报表</p>
        </div>
        <button onClick={() => alert('报表导出中...')} className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors flex items-center gap-2">
          <Download className="w-4 h-4" />
          导出报表
        </button>
      </div>

      {/* 核心指标卡片 */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">资产总价值</p>
              <p className="text-3xl font-semibold text-gray-900 mt-2">¥5.28M</p>
              <div className="flex items-center gap-1 mt-2">
                <TrendingUp className="w-4 h-4 text-green-600" />
                <span className="text-sm text-green-600">+3.6%</span>
                <span className="text-sm text-gray-500">vs上月</span>
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
              <p className="text-3xl font-semibold text-gray-900 mt-2">1,155</p>
              <div className="flex items-center gap-1 mt-2">
                <TrendingUp className="w-4 h-4 text-green-600" />
                <span className="text-sm text-green-600">+156</span>
                <span className="text-sm text-gray-500">本月新增</span>
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
              <p className="text-sm text-gray-600">平均使用率</p>
              <p className="text-3xl font-semibold text-gray-900 mt-2">92%</p>
              <div className="flex items-center gap-1 mt-2">
                <TrendingUp className="w-4 h-4 text-green-600" />
                <span className="text-sm text-green-600">+2%</span>
                <span className="text-sm text-gray-500">vs上月</span>
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
              <p className="text-sm text-gray-600">本月维护费用</p>
              <p className="text-3xl font-semibold text-gray-900 mt-2">¥38K</p>
              <div className="flex items-center gap-1 mt-2">
                <span className="text-sm text-gray-600">48次保养</span>
                <span className="mx-1">|</span>
                <span className="text-sm text-gray-600">10次维修</span>
              </div>
            </div>
            <div className="w-12 h-12 bg-yellow-50 rounded-lg flex items-center justify-center">
              <DollarSign className="w-6 h-6 text-yellow-600" />
            </div>
          </div>
        </div>
      </div>

      {/* 资产价值趋势 */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">资产价值趋势</h3>
        <ResponsiveContainer width="100%" height={350}>
          <LineChart data={assetValueTrend} isAnimationActive={false}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="month" />
            <YAxis />
            <Tooltip formatter={(value: number) => `¥${value.toLocaleString()}`} />
            <Legend />
            <Line type="monotone" dataKey="总价值" stroke="#3b82f6" strokeWidth={2} name="总价值" />
            <Line type="monotone" dataKey="新增" stroke="#10b981" strokeWidth={2} name="新增资产" />
            <Line type="monotone" dataKey="折旧" stroke="#ef4444" strokeWidth={2} name="累计折旧" />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 资产分类分布 */}
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">资产分类分布</h3>
          <div className="flex items-center justify-center">
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={categoryDistribution}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  outerRadius={100}
                  fill="#8884d8"
                  dataKey="value"
                  isAnimationActive={false}
                >
                  {categoryDistribution.map((entry) => (
                    <Cell key={`cell-analytics-${entry.name}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip formatter={(value: number) => `¥${value.toLocaleString()}`} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3">
            {categoryDistribution.map((cat) => (
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

        {/* 部门资产分布 */}
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">部门资产分布</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={departmentAssets} isAnimationActive={false}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="dept" />
              <YAxis yAxisId="left" orientation="left" stroke="#3b82f6" />
              <YAxis yAxisId="right" orientation="right" stroke="#10b981" />
              <Tooltip />
              <Legend />
              <Bar yAxisId="left" dataKey="资产数量" fill="#3b82f6" name="资产数量" />
              <Bar yAxisId="right" dataKey="资产价值" fill="#10b981" name="资产价值(元)" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 使用率统计 */}
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">资产使用率统计</h3>
          <div className="space-y-4">
            {utilizationStats.map((stat) => (
              <div key={stat.status}>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-gray-700">{stat.status}</span>
                  <span className="text-sm text-gray-600">{stat.count}项 ({stat.percentage}%)</span>
                </div>
                <div className="w-full h-3 bg-gray-200 rounded-full overflow-hidden">
                  <div
                    className={`h-full ${
                      stat.status === '高效使用' ? 'bg-green-500' :
                      stat.status === '正常使用' ? 'bg-blue-500' :
                      stat.status === '低效使用' ? 'bg-yellow-500' :
                      'bg-red-500'
                    }`}
                    style={{ width: `${stat.percentage}%` }}
                  ></div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 生命周期分布 */}
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
      </div>

      {/* 维护保养趋势 */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">维护保养趋势</h3>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={maintenanceTrend} isAnimationActive={false}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="month" />
            <YAxis yAxisId="left" orientation="left" />
            <YAxis yAxisId="right" orientation="right" />
            <Tooltip />
            <Legend />
            <Bar yAxisId="left" dataKey="保养次数" fill="#10b981" />
            <Bar yAxisId="left" dataKey="维修次数" fill="#ef4444" />
            <Bar yAxisId="right" dataKey="费用" fill="#3b82f6" name="费用(元)" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* 维护费用TOP设备 */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">维护费用TOP设备</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">排名</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">设备名称</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">分类</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">维护次数</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">累计费用</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">占比</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {topExpenses.map((item, index) => (
                <tr key={item.name} className="hover:bg-gray-50">
                  <td className="px-6 py-4 text-sm">
                    <span className={`w-6 h-6 flex items-center justify-center rounded-full text-white font-medium ${
                      index === 0 ? 'bg-yellow-500' :
                      index === 1 ? 'bg-gray-400' :
                      index === 2 ? 'bg-orange-400' :
                      'bg-gray-300'
                    }`}>
                      {index + 1}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm font-medium text-gray-900">{item.name}</td>
                  <td className="px-6 py-4 text-sm text-gray-600">{item.category}</td>
                  <td className="px-6 py-4 text-sm text-gray-900">{item.count}次</td>
                  <td className="px-6 py-4 text-sm font-semibold text-red-600">¥{item.maintenanceCost.toLocaleString()}</td>
                  <td className="px-6 py-4 text-sm text-gray-600">
                    {((item.maintenanceCost / 53000) * 100).toFixed(1)}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
