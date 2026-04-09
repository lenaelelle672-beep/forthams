import { useState } from "react";
import { useNavigate } from "react-router";
import { Plus, Search, Filter, Download, Upload, Edit, Trash2, Eye, MoreHorizontal, ArrowRightLeft, ShieldAlert, LogOut, DollarSign } from "lucide-react";
import { AssetDetailModal } from "../components/AssetDetailModal";

const assets = [
  { id: 'AS-2024-001', name: 'ThinkPad X1 Carbon', category: '电子���备', department: '研发部', user: '张三', location: 'A栋3楼', status: '在用', value: '¥8,500', purchaseDate: '2023-05-15' },
  { id: 'AS-2024-002', name: 'HP LaserJet Pro', category: '办公设备', department: '行政部', user: '李四', location: 'B栋1楼', status: '在用', value: '¥3,200', purchaseDate: '2023-06-20' },
  { id: 'AS-2024-003', name: 'Dell OptiPlex 7090', category: '电子设备', department: '财务部', user: '王五', location: 'A栋2楼', status: '在用', value: '¥6,800', purchaseDate: '2023-07-10' },
  { id: 'AS-2024-004', name: 'iPhone 14 Pro', category: '移动设备', department: '销售部', user: '赵六', location: 'C栋2楼', status: '在用', value: '¥9,999', purchaseDate: '2023-08-05' },
  { id: 'AS-2024-005', name: 'Epson EB-2250U', category: '办公设备', department: '会议室', user: '公用', location: 'A栋5楼', status: '闲置', value: '¥12,000', purchaseDate: '2023-03-22' },
  { id: 'AS-2024-006', name: '数控机床 CNC-05', category: '生产设备', department: '生产部', user: '孙七', location: '车间1', status: '在用', value: '¥450,000', purchaseDate: '2022-12-10' },
  { id: 'AS-2024-007', name: 'MacBook Pro 16"', category: '电子设备', department: '设计部', user: '周八', location: 'B栋3楼', status: '在用', value: '¥18,999', purchaseDate: '2023-09-15' },
  { id: 'AS-2024-008', name: 'Canon EOS R5', category: '摄影设备', department: '市场部', user: '吴九', location: 'C栋1楼', status: '维修中', value: '¥25,999', purchaseDate: '2023-04-18' },
];

const categories = ['全部分类', '电子设备', '办公设备', '生产设备', '移动设备', '摄影设备'];
const statuses = ['全部状态', '在用', '闲置', '维修中', '报废'];

export function AssetRegistry() {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('全部分类');
  const [selectedStatus, setSelectedStatus] = useState('全部状态');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showDisposalModal, setShowDisposalModal] = useState(false);
  const [selectedAsset, setSelectedAsset] = useState<typeof assets[0] | null>(null);

  const filteredAssets = assets.filter(asset => {
    const matchesSearch = asset.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         asset.id.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = selectedCategory === '全部分类' || asset.category === selectedCategory;
    const matchesStatus = selectedStatus === '全部状态' || asset.status === selectedStatus;
    return matchesSearch && matchesCategory && matchesStatus;
  });

  return (
    <div className="space-y-6">
      {/* 页面标题 */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-gray-900">资产台账管理</h2>
          <p className="text-gray-600 mt-1">管理企业全部资产信息与生命周期</p>
        </div>
        <div className="flex gap-3">
          <button className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 rounded-lg transition-colors flex items-center gap-2">
            <Upload className="w-4 h-4" />
            批量导入
          </button>
          <button className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 rounded-lg transition-colors flex items-center gap-2">
            <Download className="w-4 h-4" />
            导出数据
          </button>
          <button 
            onClick={() => setShowAddModal(true)}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            新增资产
          </button>
        </div>
      </div>

      {/* 筛选和搜索 */}
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <div className="flex flex-wrap gap-4">
          <div className="flex-1 min-w-[200px]">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="搜索资产名称或编号..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {categories.map(cat => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>
          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {statuses.map(status => (
              <option key={status} value={status}>{status}</option>
            ))}
          </select>
          <button className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 rounded-lg transition-colors flex items-center gap-2">
            <Filter className="w-4 h-4" />
            高级筛选
          </button>
        </div>
      </div>

      {/* 资产列表 */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  资产编号
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  资产名称
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  分类
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  使用部门
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  使用人
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  存放位置
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  状态
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  资产价值
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider sticky right-0 bg-gray-50 z-10 shadow-[-1px_0_0_0_#e5e7eb]">
                  操作
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredAssets.map((asset) => (
                <tr key={asset.id} className="hover:bg-gray-50 group">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-blue-600">
                    {asset.id}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {asset.name}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                    {asset.category}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                    {asset.department}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                    {asset.user}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                    {asset.location}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                      asset.status === '在用' ? 'bg-green-100 text-green-800' :
                      asset.status === '闲置' ? 'bg-yellow-100 text-yellow-800' :
                      asset.status === '维修中' ? 'bg-red-100 text-red-800' :
                      'bg-gray-100 text-gray-800'
                    }`}>
                      {asset.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {asset.value}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 sticky right-0 bg-white group-hover:bg-gray-50 z-10 shadow-[-1px_0_0_0_#e5e7eb]">
                    <div className="flex items-center gap-2">
                      <button 
                        onClick={() => {
                          setSelectedAsset(asset);
                          setShowDetailModal(true);
                        }}
                        className="p-1 hover:bg-gray-100 rounded transition-colors" title="查看详情">
                        <Eye className="w-4 h-4 text-gray-600" />
                      </button>
                      <button className="p-1 hover:bg-gray-100 rounded transition-colors" title="编辑">
                        <Edit className="w-4 h-4 text-gray-600" />
                      </button>
                      <button 
                        onClick={() => {
                          setSelectedAsset(asset);
                          setShowDisposalModal(true);
                        }}
                        className="p-1 hover:bg-red-50 text-red-600 rounded transition-colors" title="资产处置">
                        <ShieldAlert className="w-4 h-4" />
                      </button>
                      <button className="p-1 hover:bg-gray-100 rounded transition-colors" title="更多">
                        <MoreHorizontal className="w-4 h-4 text-gray-600" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        
        {/* 分页 */}
        <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-between">
          <div className="text-sm text-gray-600">
            显示 <span className="font-medium">{filteredAssets.length}</span> 条结果，共 <span className="font-medium">{assets.length}</span> 条
          </div>
          <div className="flex gap-2">
            <button className="px-3 py-1 text-sm font-medium text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed" disabled>
              上一页
            </button>
            <button className="px-3 py-1 text-sm font-medium text-white bg-blue-600 rounded">
              1
            </button>
            <button className="px-3 py-1 text-sm font-medium text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 rounded transition-colors">
              2
            </button>
            <button className="px-3 py-1 text-sm font-medium text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 rounded transition-colors">
              下一页
            </button>
          </div>
        </div>
      </div>

      {/* 新增资产模态框 */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">新增资产</h3>
              <button 
                onClick={() => setShowAddModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                ✕
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">资产名称 *</label>
                  <input type="text" className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">资产分类 *</label>
                  <select className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                    <option>请选择分类</option>
                    <option>电子设备</option>
                    <option>办公设备</option>
                    <option>生产设备</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">使用部门 *</label>
                  <select className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                    <option>请选择部门</option>
                    <option>研发部</option>
                    <option>销售部</option>
                    <option>生产部</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">使用人</label>
                  <input type="text" className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">存放位置 *</label>
                  <input type="text" className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">资产价值 (元) *</label>
                  <input type="number" className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">采购日期 *</label>
                  <input type="date" className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">供应商</label>
                  <input type="text" className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">备注</label>
                <textarea rows={3} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"></textarea>
              </div>
            </div>
            <div className="px-6 py-4 border-t border-gray-200 flex justify-end gap-3">
              <button 
                onClick={() => setShowAddModal(false)}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 rounded-lg transition-colors"
              >
                取消
              </button>
              <button className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors">
                保存并同步ERP
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 资产详情模态框 */}
      <AssetDetailModal
        isOpen={showDetailModal}
        asset={selectedAsset || undefined}
        onClose={() => setShowDetailModal(false)}
      />

      {/* 资产处置模态框 */}
      {showDisposalModal && selectedAsset && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg w-full max-w-md mx-4">
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">资产处置快捷入口</h3>
              <button 
                onClick={() => setShowDisposalModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                ✕
              </button>
            </div>
            <div className="p-6">
              <div className="mb-6 p-4 bg-gray-50 rounded-lg">
                <p className="text-sm text-gray-500 mb-1">当前选择资产：</p>
                <p className="font-medium text-gray-900">{selectedAsset.id} - {selectedAsset.name}</p>
              </div>
              <p className="text-sm text-gray-600 mb-4">请选择对该资产要进行的处置操作：</p>
              <div className="grid grid-cols-2 gap-4">
                <button 
                  onClick={() => {
                    navigate('/disposals/transfer/new');
                  }}
                  className="flex flex-col items-center justify-center p-4 border border-gray-200 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition-colors gap-2">
                  <ArrowRightLeft className="w-6 h-6 text-blue-600" />
                  <span className="text-sm font-medium text-gray-900">资产转移</span>
                </button>
                <button 
                  onClick={() => {
                    navigate('/disposals/clearance/new');
                  }}
                  className="flex flex-col items-center justify-center p-4 border border-gray-200 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition-colors gap-2">
                  <LogOut className="w-6 h-6 text-blue-600" />
                  <span className="text-sm font-medium text-gray-900">资产清退</span>
                </button>
                <button 
                  onClick={() => {
                    navigate('/disposals/scrap/new');
                  }}
                  className="flex flex-col items-center justify-center p-4 border border-gray-200 rounded-lg hover:border-red-500 hover:bg-red-50 transition-colors gap-2">
                  <Trash2 className="w-6 h-6 text-red-600" />
                  <span className="text-sm font-medium text-gray-900">报废转让</span>
                </button>
                <button 
                  onClick={() => {
                    navigate('/disposals/compensation/new');
                  }}
                  className="flex flex-col items-center justify-center p-4 border border-gray-200 rounded-lg hover:border-yellow-500 hover:bg-yellow-50 transition-colors gap-2">
                  <DollarSign className="w-6 h-6 text-yellow-600" />
                  <span className="text-sm font-medium text-gray-900">资产赔偿</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}