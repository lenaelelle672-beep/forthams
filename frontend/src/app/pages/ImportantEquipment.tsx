import { useEffect, useState } from "react";
import { Wrench, AlertCircle, TrendingUp, Calendar, Bell, Plus, Eye, Edit } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, BarChart, Bar } from "recharts";
import { maintenanceService } from "../services/maintenanceService";

const usageTrend = [
  { date: '03-01', 'CNC-05': 82, 'LC-08': 88, 'RB-12': 75 },
  { date: '03-02', 'CNC-05': 85, 'LC-08': 90, 'RB-12': 78 },
  { date: '03-03', 'CNC-05': 83, 'LC-08': 92, 'RB-12': 76 },
  { date: '03-04', 'CNC-05': 87, 'LC-08': 91, 'RB-12': 80 },
  { date: '03-05', 'CNC-05': 84, 'LC-08': 93, 'RB-12': 77 },
  { date: '03-06', 'CNC-05': 86, 'LC-08': 94, 'RB-12': 79 },
  { date: '03-07', 'CNC-05': 85, 'LC-08': 92, 'RB-12': 78 },
];

export function ImportantEquipment() {
  const [selectedEquipment, setSelectedEquipment] = useState<string | null>(null);
  const [detailItem, setDetailItem] = useState<any | null>(null);
  const [showMaintenanceModal, setShowMaintenanceModal] = useState(false);
  const [equipment, setEquipment] = useState<any[]>([]);
  const [maintenanceRecords, setMaintenanceRecords] = useState<any[]>([]);
  const [alerts, setAlerts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [maintenanceForm, setMaintenanceForm] = useState<Record<string, any>>({
    equipmentId: "",
    type: "定期保养",
    date: "",
    technician: "",
    duration: "",
    cost: "",
    content: "",
  });

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      const [records, upcoming] = await Promise.all([
        maintenanceService.list(),
        maintenanceService.getUpcoming(),
      ]);
      const recordList = (Array.isArray(records) ? records : (records as any)?.records) || [];
      setMaintenanceRecords(recordList);
      setEquipment((recordList || []).map((item: any) => ({
        id: item.equipmentId || item.assetId || item.id,
        name: item.equipmentName || item.assetName || item.equipment || '-',
        usageRate: item.usageRate || 0,
        lastMaintenance: item.date || item.lastMaintenance || '-',
        nextMaintenance: item.nextMaintenance || '-',
        maintenanceStatus: item.maintenanceStatus || '正常',
        maintenanceCount: item.maintenanceCount || 0,
      })));
      setAlerts((upcoming || []).map((item: any) => ({
        id: item.id,
        equipment: item.equipmentName || item.assetName || '-',
        type: item.level || 'warning',
        message: item.message || '保养计划提醒',
        time: item.nextMaintenance || item.date || '-',
      })));
    } catch (err) {
      console.error('Failed to load maintenance data:', err);
      setError('重要设备数据加载失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleCreateMaintenance = async () => {
    try {
      await maintenanceService.create(maintenanceForm);
      setShowMaintenanceModal(false);
      await loadData();
    } catch (err) {
      console.error('Failed to create maintenance record:', err);
    }
  };

  return (
    <div className="space-y-6">
      {/* 页面标题 */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-gray-900">重要设备管理</h2>
          <p className="text-gray-600 mt-1">管理重要设备维护保养、使用率统计与智能提醒</p>
        </div>
        <button 
          onClick={() => setShowMaintenanceModal(true)}
          className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          新增保养记录
        </button>
      </div>

      {/* 统计卡片 */}
      {loading && <div className="text-sm text-gray-500">加载中...</div>}
      {error && <div className="text-sm text-red-600">{error}</div>}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">重要设备总数</p>
              <p className="text-3xl font-semibold text-gray-900 mt-2">{equipment.length}</p>
            </div>
            <div className="w-12 h-12 bg-blue-50 rounded-lg flex items-center justify-center">
              <Wrench className="w-6 h-6 text-blue-600" />
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">平均使用率</p>
              <p className="text-3xl font-semibold text-gray-900 mt-2">80%</p>
            </div>
            <div className="w-12 h-12 bg-green-50 rounded-lg flex items-center justify-center">
              <TrendingUp className="w-6 h-6 text-green-600" />
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">待保养设备</p>
              <p className="text-3xl font-semibold text-gray-900 mt-2">2</p>
            </div>
            <div className="w-12 h-12 bg-yellow-50 rounded-lg flex items-center justify-center">
              <AlertCircle className="w-6 h-6 text-yellow-600" />
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">本月保养次数</p>
              <p className="text-3xl font-semibold text-gray-900 mt-2">8</p>
            </div>
            <div className="w-12 h-12 bg-purple-50 rounded-lg flex items-center justify-center">
              <Calendar className="w-6 h-6 text-purple-600" />
            </div>
          </div>
        </div>
      </div>

      {/* 智能提醒 */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <Bell className="w-5 h-5 text-yellow-600" />
          智能提醒
        </h3>
        <div className="space-y-3">
          {alerts.map((alert) => (
            <div 
              key={alert.id} 
              className={`p-4 rounded-lg border-l-4 ${
                alert.type === 'danger' ? 'bg-red-50 border-red-500' :
                alert.type === 'warning' ? 'bg-yellow-50 border-yellow-500' :
                'bg-blue-50 border-blue-500'
              }`}
            >
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-medium text-gray-900">{alert.equipment}</p>
                  <p className="text-sm text-gray-600 mt-1">{alert.message}</p>
                </div>
                <div className="flex gap-2">
                  <button className="px-3 py-1.5 text-sm font-medium text-blue-700 bg-blue-100 hover:bg-blue-200 rounded transition-colors">
                    查看详情
                  </button>
                  <button className="px-3 py-1.5 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded transition-colors">
                    发起保养
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 设备使用率趋势 */}
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">设备使用率趋势</h3>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={usageTrend} isAnimationActive={false}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey="CNC-05" stroke="#3b82f6" strokeWidth={2} />
              <Line type="monotone" dataKey="LC-08" stroke="#10b981" strokeWidth={2} />
              <Line type="monotone" dataKey="RB-12" stroke="#f59e0b" strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* 保养统计 */}
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">保养次数统计</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={equipment} isAnimationActive={false}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="id" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey="maintenanceCount" name="保养次数" fill="#3b82f6" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* 设备列表 */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">重要设备列表</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">设备编号</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">设备名称</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">使用率</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">上次保养</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">下次保养</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">保养状态</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">保养次数</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
               {equipment.map((eq) => (
                <tr key={eq.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 text-sm font-medium text-blue-600">{eq.id}</td>
                  <td className="px-6 py-4 text-sm text-gray-900">{eq.name}</td>
                  <td className="px-6 py-4 text-sm">
                    <div className="flex items-center gap-2">
                      <div className="flex-1 w-24 h-2 bg-gray-200 rounded-full overflow-hidden">
                        <div 
                          className={`h-full ${
                            eq.usageRate >= 80 ? 'bg-green-500' :
                            eq.usageRate >= 60 ? 'bg-blue-500' :
                            'bg-yellow-500'
                          }`}
                          style={{ width: `${eq.usageRate}%` }}
                        ></div>
                      </div>
                      <span className="text-gray-900 font-medium">{eq.usageRate}%</span>
                    </div>
                  </td>
                   <td className="px-6 py-4 text-sm text-gray-600">{eq.lastMaintenance}</td>
                   <td className="px-6 py-4 text-sm text-gray-600">{eq.nextMaintenance}</td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                      eq.maintenanceStatus === '正常' ? 'bg-green-100 text-green-800' :
                      eq.maintenanceStatus === '即将到期' ? 'bg-yellow-100 text-yellow-800' :
                      'bg-red-100 text-red-800'
                    }`}>
                      {eq.maintenanceStatus}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-900">{eq.maintenanceCount}</td>
                  <td className="px-6 py-4 text-sm">
                    <div className="flex items-center gap-2">
                      <button onClick={() => setDetailItem(equipment)} className="p-1 hover:bg-gray-100 rounded transition-colors" title="查看详情">
                        <Eye className="w-4 h-4 text-gray-600" />
                      </button>
                      <button className="p-1 hover:bg-gray-100 rounded transition-colors" title="编辑">
                        <Edit className="w-4 h-4 text-gray-600" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* 保养记录 */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">保养记录</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">设备</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">日期</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">类型</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">技术员</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">耗时</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">费用</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">状态</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
               {maintenanceRecords.map((record) => (
                <tr key={record.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 text-sm font-medium text-gray-900">{record.equipment || record.equipmentName || record.assetName}</td>
                  <td className="px-6 py-4 text-sm text-gray-600">{record.date}</td>
                  <td className="px-6 py-4 text-sm text-gray-600">{record.type}</td>
                  <td className="px-6 py-4 text-sm text-gray-600">{record.technician}</td>
                  <td className="px-6 py-4 text-sm text-gray-600">{record.duration}</td>
                  <td className="px-6 py-4 text-sm font-medium text-gray-900">{record.cost}</td>
                  <td className="px-6 py-4">
                    <span className="px-2 py-1 text-xs font-medium bg-green-100 text-green-800 rounded-full">
                      {record.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* 新增保养记录模态框 */}
      {showMaintenanceModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg w-full max-w-2xl mx-4">
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">新增保养记录</h3>
              <button 
                onClick={() => setShowMaintenanceModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                ✕
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">选择设备 *</label>
                   <select value={maintenanceForm.equipmentId} onChange={(e) => setMaintenanceForm(prev => ({ ...prev, equipmentId: e.target.value }))} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                    <option>请选择设备</option>
                    {equipment.map(eq => (
                      <option key={eq.id} value={eq.id}>{eq.name} ({eq.id})</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">保养类型 *</label>
                   <select value={maintenanceForm.type} onChange={(e) => setMaintenanceForm(prev => ({ ...prev, type: e.target.value }))} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                    <option>定期保养</option>
                    <option>故障维修</option>
                    <option>校准检测</option>
                    <option>升级改造</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">保养日期 *</label>
                   <input value={maintenanceForm.date} onChange={(e) => setMaintenanceForm(prev => ({ ...prev, date: e.target.value }))} type="date" className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">技术员 *</label>
                   <input value={maintenanceForm.technician} onChange={(e) => setMaintenanceForm(prev => ({ ...prev, technician: e.target.value }))} type="text" className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">耗时 (小时)</label>
                   <input value={maintenanceForm.duration} onChange={(e) => setMaintenanceForm(prev => ({ ...prev, duration: e.target.value }))} type="number" step="0.5" className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">费用 (元)</label>
                   <input value={maintenanceForm.cost} onChange={(e) => setMaintenanceForm(prev => ({ ...prev, cost: e.target.value }))} type="number" className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">保养内容 *</label>
                 <textarea value={maintenanceForm.content} onChange={(e) => setMaintenanceForm(prev => ({ ...prev, content: e.target.value }))} rows={4} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="请详细描述保养内容..."></textarea>
              </div>
            </div>
            <div className="px-6 py-4 border-t border-gray-200 flex justify-end gap-3">
              <button 
                onClick={() => setShowMaintenanceModal(false)}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 rounded-lg transition-colors"
              >
                取消
              </button>
               <button onClick={handleCreateMaintenance} className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors">
                 保存记录
               </button>
            </div>
          </div>
        </div>
      )}

      {/* 详情弹窗 */}
      {detailItem && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setDetailItem(null)}>
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[80vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">设备详情</h3>
              <button onClick={() => setDetailItem(null)} className="text-gray-400 hover:text-gray-600 text-xl">&times;</button>
            </div>
            <div className="p-6 space-y-3">
              {Object.entries(detailItem).map(([key, value]) => (
                <div key={key} className="flex items-start gap-3 text-sm">
                  <span className="text-gray-500 min-w-[120px]">{key}:</span>
                  <span className="text-gray-900">{value === null || value === undefined ? '-' : String(value)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
