import { useEffect, useState } from "react";
import { DollarSign, Plus, AlertCircle, CheckCircle, Clock, FileText } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { useNavigate } from "react-router";
import { compensationService } from "../services/compensationService";
import { formatStatusLabel } from "../constants/assetStatus";

export function Compensation() {
  const navigate = useNavigate();
  const [detailItem, setDetailItem] = useState<any | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedType, setSelectedType] = useState('全部类型');
  const [compensations, setCompensations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [valuationBasis, setValuationBasis] = useState<string | null>(null);
  const [valuationLoading, setValuationLoading] = useState(false);
  const [formData, setFormData] = useState<Record<string, any>>({
    assetId: '',
    type: '设备损坏',
    employee: '',
    department: '研发部',
    amount: '',
    date: '',
    reason: '',
  });

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      const result = await compensationService.list();
      setCompensations(Array.isArray(result) ? result : (result as { records?: unknown[] })?.records || []);
    } catch (err) {
      console.error('Failed to load compensation data:', err);
      setError('赔偿数据加载失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleCreateCompensation = () => {
    setShowAddModal(false);
    navigate('/disposals/compensation/new');
  };

  const handleEstimateCompensation = async () => {
    if (!formData.assetId) {
      setValuationBasis('请先填写资产编号');
      return;
    }
    try {
      setValuationLoading(true);
      setValuationBasis(null);
      const valuation = await compensationService.estimate(formData) as Record<string, unknown>;
      setFormData(prev => ({
        ...prev,
        amount: String(valuation.estimatedAmount ?? prev.amount),
      }));
      setValuationBasis(String(valuation.valuationBasis || '已按系统规则生成估值'));
    } catch (err) {
      console.error('Failed to estimate compensation:', err);
      setValuationBasis('系统估值失败，请确认资产编号存在后重试，或人工填写金额');
    } finally {
      setValuationLoading(false);
    }
  };

  const monthlyStats = Object.values(
    compensations.reduce((acc: Record<string, any>, item: any) => {
      const month = (item.submitDate || item.date || '').toString().slice(5, 7) || '未知';
      if (!acc[month]) acc[month] = { month: `${month}月`, 赔偿金额: 0, 赔偿次数: 0 };
      acc[month].赔偿金额 += Number(item.amount || 0);
      acc[month].赔偿次数 += 1;
      return acc;
    }, {})
  );

  const typeColors: Record<string, string> = {
    设备损坏: '#3b82f6',
    设备丢失: '#ef4444',
    人为故障: '#f59e0b',
    其他: '#6b7280',
  };
  const typeDistribution = Object.values(
    compensations.reduce((acc: Record<string, any>, item: any) => {
      const name = item.type || '其他';
      if (!acc[name]) acc[name] = { name, value: 0, color: typeColors[name] || '#6b7280' };
      acc[name].value += 1;
      return acc;
    }, {})
  );

  const deptStats = Object.values(
    compensations.reduce((acc: Record<string, any>, item: any) => {
      const dept = item.department || '未知部门';
      if (!acc[dept]) acc[dept] = { dept, amount: 0, count: 0 };
      acc[dept].amount += Number(item.amount || 0);
      acc[dept].count += 1;
      return acc;
    }, {})
  );

  const filteredCompensations = selectedType === '全部类型' 
    ? compensations 
    : compensations.filter(c => c.type === selectedType);

  return (
    <div className="space-y-6">
      {/* 页面标题 */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-gray-900">资产赔偿管理</h2>
          <p className="text-gray-500 mt-1">规范资产赔偿流程,实现损失核算与追溯</p>
        </div>
        <button 
          onClick={() => navigate('/disposals/compensation/new')}
          className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          新增赔偿申请
        </button>
      </div>

      {/* 统计卡片 */}
      {loading && <div className="text-sm text-gray-400">加载中...</div>}
      {error && <div className="text-sm text-red-600">{error}</div>}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">本月赔偿金额</p>
              <p className="text-3xl font-semibold text-gray-900 mt-2">¥16.5K</p>
            </div>
            <div className="w-12 h-12 bg-red-50 rounded-lg flex items-center justify-center">
              <DollarSign className="w-6 h-6 text-red-600" />
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">待审批申请</p>
              <p className="text-3xl font-semibold text-gray-900 mt-2">
                {compensations.filter(c => c.status === '待审批').length}
              </p>
            </div>
            <div className="w-12 h-12 bg-yellow-50 rounded-lg flex items-center justify-center">
              <Clock className="w-6 h-6 text-yellow-600" />
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">已批准申请</p>
              <p className="text-3xl font-semibold text-gray-900 mt-2">
                {compensations.filter(c => c.status === '已批准').length}
              </p>
            </div>
            <div className="w-12 h-12 bg-green-50 rounded-lg flex items-center justify-center">
              <CheckCircle className="w-6 h-6 text-green-600" />
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">累计赔偿金额</p>
              <p className="text-3xl font-semibold text-gray-900 mt-2">¥46.5K</p>
            </div>
            <div className="w-12 h-12 bg-purple-50 rounded-lg flex items-center justify-center">
              <FileText className="w-6 h-6 text-purple-600" />
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 月度赔偿趋势 */}
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">月度赔偿趋势</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={monthlyStats} isAnimationActive={false}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" />
              <YAxis yAxisId="left" orientation="left" stroke="#3b82f6" />
              <YAxis yAxisId="right" orientation="right" stroke="#10b981" />
              <Tooltip />
              <Legend />
              <Bar yAxisId="left" dataKey="赔偿金额" fill="#3b82f6" name="赔偿金额 (元)" />
              <Bar yAxisId="right" dataKey="赔偿次数" fill="#10b981" name="赔偿次数" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* 赔偿类型分布 */}
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">赔偿类型分布</h3>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={typeDistribution}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                outerRadius={100}
                fill="#8884d8"
                dataKey="value"
                isAnimationActive={false}
              >
                {typeDistribution.map((entry, index) => (
                  <Cell key={`cell-compensation-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* 部门赔偿统计 */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">部门赔偿统计</h3>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {deptStats.map((dept) => (
            <div key={dept.dept} className="border border-gray-200 rounded-lg p-4">
              <h4 className="text-sm font-medium text-gray-500 mb-2">{dept.dept}</h4>
              <p className="text-2xl font-semibold text-gray-900">¥{dept.amount.toLocaleString()}</p>
              <p className="text-sm text-gray-400 mt-1">{dept.count}次赔偿</p>
            </div>
          ))}
        </div>
      </div>

      {/* 赔偿申请列表 */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900">赔偿申请列表</h3>
          <select
            value={selectedType}
            onChange={(e) => setSelectedType(e.target.value)}
            className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option>全部类型</option>
            <option>设备损坏</option>
            <option>设备丢失</option>
            <option>人为故障</option>
          </select>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase">申请编号</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase">资产信息</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase">类型</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase">责任人</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase">部门</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase">赔偿金额</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase">状态</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1e3a5f]">
              {filteredCompensations.map((comp) => (
                <tr key={comp.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 text-sm font-medium text-blue-600">{comp.id || comp.compensationNo}</td>
                  <td className="px-6 py-4 text-sm">
                    <div>
                      <p className="font-medium text-gray-900">{comp.assetName || '-'}</p>
                      <p className="text-xs text-gray-400">{comp.assetId || '-'}</p>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm">
                    <span className={`px-2 py-1 text-xs font-medium rounded ${
                      comp.type === '设备损坏' ? 'bg-blue-100 text-blue-800' :
                      comp.type === '设备丢失' ? 'bg-red-100 text-red-800' :
                      'bg-yellow-100 text-yellow-800'
                    }`}>
                      {comp.type}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-900">{comp.employee}</td>
                  <td className="px-6 py-4 text-sm text-gray-500">{comp.department}</td>
                   <td className="px-6 py-4 text-sm font-semibold text-red-600">¥{Number(comp.amount || 0).toLocaleString()}</td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                      comp.status === '待审批' ? 'bg-yellow-100 text-yellow-800' :
                      comp.status === '已批准' ? 'bg-green-100 text-green-800' :
                      comp.status === '审批中' ? 'bg-blue-100 text-blue-800' :
                      'bg-red-100 text-red-800'
                    }`}>
                      {formatStatusLabel(comp.status)}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm">
                    <div className="flex gap-2">
                      {comp.status === '待审批' && (
                        <button onClick={() => navigate('/approval')} className="px-3 py-1 text-xs font-medium text-blue-700 bg-blue-100 hover:bg-blue-200 rounded transition-colors">
                          去审批中心
                        </button>
                      )}
                      <button onClick={() => setDetailItem(comp)} className="px-3 py-1 text-xs font-medium text-blue-700 bg-blue-100 hover:bg-blue-200 rounded transition-colors">
                        详情
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* 新增赔偿申请模态框 */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">新增赔偿申请</h3>
              <button 
                onClick={() => setShowAddModal(false)}
                className="text-gray-400 hover:text-gray-500"
              >
                ✕
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">资产编号 *</label>
                   <input value={formData.assetId} onChange={(e) => setFormData(prev => ({ ...prev, assetId: e.target.value }))} type="text" className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="AS-2024-XXX" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">赔偿类型 *</label>
                   <select value={formData.type} onChange={(e) => setFormData(prev => ({ ...prev, type: e.target.value }))} className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                    <option>设备损坏</option>
                    <option>设备丢失</option>
                    <option>人为故障</option>
                    <option>其他</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">责任人 *</label>
                   <input value={formData.employee} onChange={(e) => setFormData(prev => ({ ...prev, employee: e.target.value }))} type="text" className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">所属部门 *</label>
                   <select value={formData.department} onChange={(e) => setFormData(prev => ({ ...prev, department: e.target.value }))} className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                    <option>研发部</option>
                    <option>销售部</option>
                    <option>设计部</option>
                    <option>行政部</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">赔偿金额 (元) *</label>
                  <div className="flex gap-2">
                    <input value={formData.amount} onChange={(e) => setFormData(prev => ({ ...prev, amount: e.target.value }))} type="number" className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
                    <button type="button" onClick={handleEstimateCompensation} disabled={valuationLoading} className="shrink-0 px-3 py-2 text-sm font-medium text-blue-700 bg-blue-50 border border-blue-200 hover:bg-blue-100 disabled:opacity-60 rounded-lg transition-colors">
                      {valuationLoading ? '估值中' : '系统估值'}
                    </button>
                  </div>
                  {valuationBasis && <p className="mt-1 text-xs text-gray-400">{valuationBasis}</p>}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">发生日期 *</label>
                   <input value={formData.date} onChange={(e) => setFormData(prev => ({ ...prev, date: e.target.value }))} type="date" className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">赔偿事由 *</label>
                 <textarea value={formData.reason} onChange={(e) => setFormData(prev => ({ ...prev, reason: e.target.value }))} rows={4} className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="请详细描述损坏/丢失情况..."></textarea>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">证明材料</label>
                <div className="border-2 border-dashed border-gray-200 rounded-lg p-6 text-center">
                  <input type="file" className="hidden" id="file-upload" multiple />
                  <label htmlFor="file-upload" className="cursor-pointer">
                    <div className="text-gray-500">
                      <p className="text-sm">点击上传或拖拽文件至此</p>
                      <p className="text-xs text-gray-400 mt-1">支持 JPG、PNG、PDF 格式</p>
                    </div>
                  </label>
                </div>
              </div>
            </div>
            <div className="px-6 py-4 border-t border-gray-200 flex justify-end gap-3">
              <button 
                onClick={() => setShowAddModal(false)}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-200 hover:bg-gray-50 rounded-lg transition-colors"
              >
                取消
              </button>
               <button onClick={handleCreateCompensation} className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors">
                 提交申请
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
              <h3 className="text-lg font-semibold text-gray-900">赔偿详情</h3>
              <button onClick={() => setDetailItem(null)} className="text-gray-400 hover:text-gray-500 text-xl">&times;</button>
            </div>
            <div className="p-6 space-y-3">
              {Object.entries(detailItem).map(([key, value]) => (
                <div key={key} className="flex items-start gap-3 text-sm">
                  <span className="text-gray-400 min-w-[120px]">{key}:</span>
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
