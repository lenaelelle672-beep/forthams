import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { ArrowRightLeft, LogOut, Trash2, DollarSign, Plus, Filter, Search } from "lucide-react";
import { disposalService } from "../services/disposalService";

const tabs = [
  { id: 'transfer', name: '资产转移', icon: ArrowRightLeft },
  { id: 'clearance', name: '资产清退', icon: LogOut },
  { id: 'scrap', name: '资产报废转让', icon: Trash2 },
  { id: 'compensation', name: '资产赔偿', icon: DollarSign },
];

export function Disposals() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('transfer');
  const [showModal, setShowModal] = useState(false);
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      const result = await disposalService.getHistory();
      setData(result || []);
    } catch (err) {
      console.error('Failed to load disposal history:', err);
      setError('处置历史加载失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-gray-900">资产处置管理</h2>
          <p className="text-gray-600 mt-1">管理资产转移、清退、报废转让及赔偿等全生命周期处置流程</p>
        </div>
        <button 
          onClick={() => setShowModal(true)}
          className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          发起处置申请
        </button>
      </div>

      {/* Tabs */}
      <div className="bg-white border-b border-gray-200 rounded-t-lg">
        <nav className="flex -mb-px" aria-label="Tabs">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`w-1/4 group inline-flex items-center justify-center py-4 px-1 border-b-2 font-medium text-sm ${
                  isActive
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <Icon className={`w-5 h-5 mr-2 ${isActive ? 'text-blue-500' : 'text-gray-400 group-hover:text-gray-500'}`} />
                {tab.name}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Content Area */}
      <div className="bg-white rounded-b-lg border border-gray-200 border-t-0 p-6">
        {loading && <div className="mb-4 text-sm text-gray-500">加载中...</div>}
        {error && <div className="mb-4 text-sm text-red-600">{error}</div>}
        <div className="flex items-center justify-between mb-6">
          <div className="flex gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="搜索申请单号或资产名称..."
                className="w-64 pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <button className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 rounded-lg transition-colors flex items-center gap-2">
              <Filter className="w-4 h-4" />
              筛选
            </button>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto border border-gray-200 rounded-lg">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">申请单号</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">资产名称</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">处置类型</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">申请人</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">申请日期</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">状态</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {data.filter(d => tabs.find(t => t.id === activeTab)?.name === d.type || activeTab === 'all').map((item, idx) => (
                <tr key={idx} className="hover:bg-gray-50">
                  <td className="px-6 py-4 text-sm font-medium text-blue-600">{item.id}</td>
                  <td className="px-6 py-4 text-sm text-gray-900">{item.assetName}</td>
                  <td className="px-6 py-4 text-sm text-gray-600">{item.type}</td>
                  <td className="px-6 py-4 text-sm text-gray-900">{item.applicant}</td>
                  <td className="px-6 py-4 text-sm text-gray-600">{item.date}</td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                      item.status === '审批中' ? 'bg-yellow-100 text-yellow-800' :
                      item.status === '已完成' ? 'bg-green-100 text-green-800' :
                      'bg-red-100 text-red-800'
                    }`}>
                      {item.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm">
                    <button className="text-blue-600 hover:text-blue-800 font-medium">查看详情</button>
                  </td>
                </tr>
              ))}
              {data.filter(d => tabs.find(t => t.id === activeTab)?.name === d.type).length === 0 && (
                <tr>
                  <td colSpan={7} className="px-6 py-8 text-center text-gray-500 text-sm">暂无数据</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 处置申请模态框占位 */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg w-full max-w-lg mx-4">
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">发起资产处置</h3>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600">✕</button>
            </div>
            <div className="p-6">
              <p className="text-sm text-gray-500 mb-4">请选择您要进行的处置类型，具体表单流程将在后续版本中细化。</p>
              <div className="grid grid-cols-2 gap-4">
                {tabs.map(tab => (
                  <button 
                    key={tab.id} 
                    onClick={() => {
                      if (tab.id === 'transfer') {
                        navigate('/disposals/transfer/new');
                      } else if (tab.id === 'clearance') {
                        navigate('/disposals/clearance/new');
                      } else if (tab.id === 'scrap') {
                        navigate('/disposals/scrap/new');
                      } else if (tab.id === 'compensation') {
                        navigate('/disposals/compensation/new');
                      } else {
                        // Other forms placeholder
                      }
                    }}
                    className="p-4 border border-gray-200 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition-colors flex flex-col items-center justify-center gap-2"
                  >
                    <tab.icon className="w-8 h-8 text-blue-600" />
                    <span className="font-medium text-gray-900">{tab.name}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
