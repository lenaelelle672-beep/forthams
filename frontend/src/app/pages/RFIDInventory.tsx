import { useEffect, useState } from "react";
import { Radio, Plus, Play, CheckCircle, AlertTriangle, MapPin, BarChart } from "lucide-react";
import { inventoryService } from "../services/inventoryService";

export function RFIDInventory() {
  const [showCreateTask, setShowCreateTask] = useState(false);
  const [showScanning, setShowScanning] = useState(false);
  const [inventoryTasks, setInventoryTasks] = useState<any[]>([]);
  const [discrepancies, setDiscrepancies] = useState<any[]>([]);
  const [recentScans, setRecentScans] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [taskForm, setTaskForm] = useState<Record<string, any>>({
    name: "",
    method: "RFID盘点",
    scope: "按部门",
    department: "",
    location: "",
    responsible: "",
    startDate: "",
    endDate: "",
    description: "",
  });

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      const tasks = await inventoryService.listTasks();
      setInventoryTasks(Array.isArray(tasks) ? tasks : (tasks as any)?.records || []);
      const firstTask = (tasks || [])[0];
      if (firstTask?.id) {
        const details = await inventoryService.getTaskDetails(firstTask.id);
        setDiscrepancies(details?.discrepancies || []);
        setRecentScans(details?.recentScans || []);
      } else {
        setDiscrepancies([]);
        setRecentScans([]);
      }
    } catch (err) {
      console.error('Failed to load inventory tasks:', err);
      setError('盘点数据加载失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleCreateTask = async () => {
    try {
      await inventoryService.createTask(taskForm);
      setShowCreateTask(false);
      await loadData();
    } catch (err) {
      console.error('Failed to create inventory task:', err);
    }
  };

  const handleAddScanResult = async () => {
    try {
      const runningTask = inventoryTasks.find((t) => t.status === '进行中') || inventoryTasks[0];
      if (!runningTask?.id) return;
      const payload = {
        scanner: 'RFID-01',
        scanTime: new Date().toISOString(),
        assetId: `AS-${Date.now()}`,
      };
      await inventoryService.addScanResult(runningTask.id, payload);
      await loadData();
    } catch (err) {
      console.error('Failed to add scan result:', err);
    }
  };

  return (
    <div className="space-y-6">
      {/* 页面标题 */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-gray-900">RFID资产盘点</h2>
          <p className="text-gray-600 mt-1">使用RFID技术实现高效批量盘点</p>
        </div>
        <div className="flex gap-3">
          <button 
            onClick={() => setShowScanning(true)}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 rounded-lg transition-colors flex items-center gap-2"
          >
            <Play className="w-4 h-4" />
            开始RFID扫描
          </button>
          <button 
            onClick={() => setShowCreateTask(true)}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            创建盘点任务
          </button>
        </div>
      </div>

      {/* 统计卡片 */}
      {loading && <div className="text-sm text-gray-500">加载中...</div>}
      {error && <div className="text-sm text-red-600">{error}</div>}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">进行中任务</p>
              <p className="text-3xl font-semibold text-gray-900 mt-2">1</p>
            </div>
            <div className="w-12 h-12 bg-blue-50 rounded-lg flex items-center justify-center">
              <Play className="w-6 h-6 text-blue-600" />
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">已完成任务</p>
              <p className="text-3xl font-semibold text-gray-900 mt-2">1</p>
            </div>
            <div className="w-12 h-12 bg-green-50 rounded-lg flex items-center justify-center">
              <CheckCircle className="w-6 h-6 text-green-600" />
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">账实差异</p>
              <p className="text-3xl font-semibold text-gray-900 mt-2">{discrepancies.length}</p>
            </div>
            <div className="w-12 h-12 bg-yellow-50 rounded-lg flex items-center justify-center">
              <AlertTriangle className="w-6 h-6 text-yellow-600" />
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">平均盘点率</p>
              <p className="text-3xl font-semibold text-gray-900 mt-2">99.8%</p>
            </div>
            <div className="w-12 h-12 bg-purple-50 rounded-lg flex items-center justify-center">
              <BarChart className="w-6 h-6 text-purple-600" />
            </div>
          </div>
        </div>
      </div>

      {/* 盘点任务列表 */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">盘点任务</h3>
        </div>
        <div className="p-6 space-y-4">
          {inventoryTasks.map((task) => (
                <div key={task.id || task.taskNo} className="border border-gray-200 rounded-lg p-5 hover:border-blue-300 transition-colors">
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h4 className="text-lg font-semibold text-gray-900">{task.name}</h4>
                    <span className={`px-2.5 py-0.5 text-xs font-medium rounded-full ${
                      task.status === '进行中' ? 'bg-blue-100 text-blue-800' :
                      task.status === '已完成' ? 'bg-green-100 text-green-800' :
                      'bg-gray-100 text-gray-800'
                    }`}>
                      {task.status}
                    </span>
                    <span className="px-2.5 py-0.5 text-xs font-medium bg-purple-100 text-purple-800 rounded-full flex items-center gap-1">
                      <Radio className="w-3 h-3" />
                      {task.method}
                    </span>
                  </div>
                  <div className="flex items-center gap-6 text-sm text-gray-600">
                    <span className="flex items-center gap-1">
                      <MapPin className="w-4 h-4" />
                      {task.location}
                    </span>
                    <span>负责人: {task.responsible}</span>
                    <span>部门: {task.department}</span>
                    <span>任务编号: {task.id}</span>
                  </div>
                </div>
                <div className="flex gap-2">
                  {task.status === '进行中' && (
                    <button 
                      onClick={() => setShowScanning(true)}
                      className="px-3 py-1.5 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded transition-colors"
                    >
                      继续盘点
                    </button>
                  )}
                  {task.status === '待开始' && (
                    <button className="px-3 py-1.5 text-sm font-medium text-white bg-green-600 hover:bg-green-700 rounded transition-colors">
                      开始盘点
                    </button>
                  )}
                  {task.status === '已完成' && (
                    <button className="px-3 py-1.5 text-sm font-medium text-blue-700 bg-blue-100 hover:bg-blue-200 rounded transition-colors">
                      查看报告
                    </button>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-4 gap-4 mb-4">
                <div className="text-center p-3 bg-gray-50 rounded-lg">
                  <p className="text-sm text-gray-600">资产总数</p>
                  <p className="text-2xl font-semibold text-gray-900 mt-1">{task.totalAssets || 0}</p>
                </div>
                <div className="text-center p-3 bg-gray-50 rounded-lg">
                  <p className="text-sm text-gray-600">已盘点</p>
                  <p className="text-2xl font-semibold text-blue-600 mt-1">{task.scanned || 0}</p>
                </div>
                <div className="text-center p-3 bg-gray-50 rounded-lg">
                  <p className="text-sm text-gray-600">未盘点</p>
                  <p className="text-2xl font-semibold text-gray-900 mt-1">{(task.totalAssets || 0) - (task.scanned || 0)}</p>
                </div>
                <div className="text-center p-3 bg-gray-50 rounded-lg">
                  <p className="text-sm text-gray-600">盘点率</p>
                  <p className="text-2xl font-semibold text-green-600 mt-1">{task.progress || 0}%</p>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between text-sm text-gray-600 mb-2">
                  <span>盘点进度</span>
                   <span>{task.scanned || 0} / {task.totalAssets || 0}</span>
                </div>
                <div className="w-full h-3 bg-gray-200 rounded-full overflow-hidden">
                  <div 
                    className={`h-full transition-all ${
                      task.progress === 100 ? 'bg-green-500' :
                      task.progress >= 90 ? 'bg-blue-500' :
                      'bg-yellow-500'
                    }`}
                     style={{ width: `${task.progress || 0}%` }}
                  ></div>
                </div>
              </div>

              <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-200">
                <div className="text-sm text-gray-600">
                  <span>开始: {task.startDate}</span>
                  <span className="mx-2">|</span>
                  <span>结束: {task.endDate}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 账实差异 */}
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
            <h3 className="text-lg font-semibold text-gray-900">账实差异</h3>
            <span className="px-2.5 py-0.5 text-xs font-medium bg-yellow-100 text-yellow-800 rounded-full">
              {discrepancies.filter(d => d.status === '待处理').length}项待处理
            </span>
          </div>
          <div className="divide-y divide-gray-200">
            {discrepancies.map((item) => (
              <div key={item.id} className="p-4 hover:bg-gray-50">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium text-gray-900">{item.name}</span>
                      <span className={`px-2 py-0.5 text-xs font-medium rounded ${
                        item.type === '盘亏' ? 'bg-red-100 text-red-800' :
                        item.type === '盘盈' ? 'bg-green-100 text-green-800' :
                        'bg-yellow-100 text-yellow-800'
                      }`}>
                        {item.type}
                      </span>
                    </div>
                     <p className="text-sm text-gray-600">资产编号: {item.assetId}</p>
                    <p className="text-sm text-gray-600">位置: {item.location}</p>
                    <p className="text-sm text-gray-600">原使用人: {item.originalUser}</p>
                  </div>
                  <div className="flex flex-col gap-2">
                    {item.status === '待处理' ? (
                      <>
                        <button className="px-3 py-1 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 rounded transition-colors">
                          调整
                        </button>
                        <button className="px-3 py-1 text-xs font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded transition-colors">
                          详情
                        </button>
                      </>
                    ) : (
                      <span className="px-2 py-1 text-xs font-medium bg-green-100 text-green-800 rounded">
                        {item.status}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 最近扫描 */}
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
            <h3 className="text-lg font-semibold text-gray-900">最近扫描记录</h3>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
              <span className="text-sm text-gray-600">实时更新</span>
            </div>
          </div>
          <div className="divide-y divide-gray-200 max-h-[400px] overflow-y-auto">
            {recentScans.map((scan) => (
              <div key={scan.id} className="p-4 hover:bg-gray-50 flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <CheckCircle className="w-4 h-4 text-green-500" />
                    <span className="font-medium text-gray-900">{scan.name}</span>
                  </div>
                  <p className="text-sm text-gray-600">编号: {scan.assetId}</p>
                  <p className="text-xs text-gray-500">扫描器: {scan.scanner}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-medium text-gray-900">{scan.time}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 创建盘点任务模态框 */}
      {showCreateTask && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg w-full max-w-2xl mx-4">
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">创建盘点任务</h3>
              <button 
                onClick={() => setShowCreateTask(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                ✕
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">任务名称 *</label>
                 <input value={taskForm.name} onChange={(e) => setTaskForm(prev => ({ ...prev, name: e.target.value }))} type="text" className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="例: 第二车间季度盘点" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">盘点方式 *</label>
                   <select value={taskForm.method} onChange={(e) => setTaskForm(prev => ({ ...prev, method: e.target.value }))} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                    <option>RFID盘点</option>
                    <option>扫码盘点</option>
                    <option>混合盘点</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">盘点范围 *</label>
                   <select value={taskForm.scope} onChange={(e) => setTaskForm(prev => ({ ...prev, scope: e.target.value }))} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                    <option>按部门</option>
                    <option>按地点</option>
                    <option>按资产类型</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">所属部门 *</label>
                   <select value={taskForm.department} onChange={(e) => setTaskForm(prev => ({ ...prev, department: e.target.value }))} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                    <option>生产部</option>
                    <option>研发部</option>
                    <option>行政部</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">盘点位置 *</label>
                   <input value={taskForm.location} onChange={(e) => setTaskForm(prev => ({ ...prev, location: e.target.value }))} type="text" className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="例: 第一车间" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">负责人 *</label>
                   <input value={taskForm.responsible} onChange={(e) => setTaskForm(prev => ({ ...prev, responsible: e.target.value }))} type="text" className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">开始日期 *</label>
                   <input value={taskForm.startDate} onChange={(e) => setTaskForm(prev => ({ ...prev, startDate: e.target.value }))} type="date" className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">结束日期 *</label>
                   <input value={taskForm.endDate} onChange={(e) => setTaskForm(prev => ({ ...prev, endDate: e.target.value }))} type="date" className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">任务说明</label>
                 <textarea value={taskForm.description} onChange={(e) => setTaskForm(prev => ({ ...prev, description: e.target.value }))} rows={3} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="请输入任务说明..."></textarea>
              </div>
            </div>
            <div className="px-6 py-4 border-t border-gray-200 flex justify-end gap-3">
              <button 
                onClick={() => setShowCreateTask(false)}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 rounded-lg transition-colors"
              >
                取消
              </button>
               <button onClick={handleCreateTask} className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors">
                 创建任务
               </button>
            </div>
          </div>
        </div>
      )}

      {/* RFID扫描界面 */}
      {showScanning && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg w-full max-w-4xl mx-4 max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Radio className="w-6 h-6 text-blue-600" />
                <h3 className="text-lg font-semibold text-gray-900">RFID批量扫描</h3>
                <span className="px-2.5 py-0.5 text-xs font-medium bg-green-100 text-green-800 rounded-full flex items-center gap-1">
                  <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
                  扫描中
                </span>
              </div>
              <button 
                onClick={() => setShowScanning(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                ✕
              </button>
            </div>
            <div className="p-6 space-y-6">
              <div className="grid grid-cols-3 gap-4">
                <div className="text-center p-4 bg-blue-50 rounded-lg">
                  <p className="text-sm text-gray-600">已扫描</p>
                  <p className="text-3xl font-semibold text-blue-600 mt-2">448</p>
                </div>
                <div className="text-center p-4 bg-green-50 rounded-lg">
                  <p className="text-sm text-gray-600">扫描速度</p>
                  <p className="text-3xl font-semibold text-green-600 mt-2">35/分</p>
                </div>
                <div className="text-center p-4 bg-purple-50 rounded-lg">
                  <p className="text-sm text-gray-600">准确率</p>
                  <p className="text-3xl font-semibold text-purple-600 mt-2">99.5%</p>
                </div>
              </div>

              <div className="bg-gray-900 text-green-400 p-4 rounded-lg font-mono text-sm h-64 overflow-y-auto">
                <div className="space-y-1">
                  <p>[14:32:19] 已连接RFID扫描器 RFID-01</p>
                  <p>[14:32:20] 开始扫描...</p>
                  <p>[14:32:21] ✓ AS-2024-401 ThinkPad X1 Carbon</p>
                  <p>[14:32:21] ✓ AS-2024-402 iPhone 14 Pro</p>
                  <p>[14:32:22] ✓ AS-2024-403 MacBook Pro 16"</p>
                  <p>[14:32:22] ✓ AS-2024-404 iPad Air</p>
                  <p>[14:32:23] ✓ AS-2024-405 Apple Watch</p>
                  <p>[14:32:23] ✓ AS-2024-406 Dell OptiPlex</p>
                  <p>[14:32:24] ✓ AS-2024-407 HP LaserJet</p>
                  <p className="text-yellow-400">[14:32:24] ! AS-2024-408 资产位置异常</p>
                  <p>[14:32:25] ✓ AS-2024-409 Epson投影仪</p>
                  <p>[14:32:25] ✓ AS-2024-410 Canon相机</p>
                  <p className="animate-pulse">[14:32:26] 扫描中...</p>
                </div>
              </div>

              <div className="flex gap-3">
                <button className="flex-1 px-4 py-3 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors">
                  停止扫描
                </button>
                <button className="flex-1 px-4 py-3 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors">
                  暂停扫描
                </button>
                 <button onClick={handleAddScanResult} className="flex-1 px-4 py-3 text-sm font-medium text-white bg-green-600 hover:bg-green-700 rounded-lg transition-colors">
                   完成盘点
                 </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
