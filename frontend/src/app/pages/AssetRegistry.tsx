import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { Plus, Search, Filter, Download, Upload, Edit, Trash2, Eye, ArrowRightLeft, ShieldAlert, LogOut, DollarSign } from "lucide-react";
import { AssetDetailModal } from "../components/AssetDetailModal";
import { assetService } from "../services/assetService";

const categories = ['全部分类', '电子设备', '办公设备', '生产设备', '移动设备', '摄影设备'];
const statuses = ['全部状态', '在用', '闲置', '维修中', '报废'];

export function AssetRegistry() {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('全部分类');
  const [selectedStatus, setSelectedStatus] = useState('全部状态');
  const [assets, setAssets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showDisposalModal, setShowDisposalModal] = useState(false);
  const [selectedAsset, setSelectedAsset] = useState<any | null>(null);
  const [assetForm, setAssetForm] = useState<Record<string, any>>({});

  const loadAssets = async () => {
    try {
      setLoading(true);
      setError(null);
      const params: Record<string, unknown> = {
        keyword: searchTerm || undefined,
      };
      if (selectedCategory !== '全部分类') params.category = selectedCategory;
      if (selectedStatus !== '全部状态') params.status = selectedStatus;
      const result = await assetService.list(params);
      setAssets(result?.records || result || []);
    } catch (err) {
      console.error('Failed to load assets:', err);
      setError('资产数据加载失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAssets();
  }, [searchTerm, selectedCategory, selectedStatus]);

  const getAssetId = (asset: any) => asset.id ?? asset.assetId ?? asset.assetNo;

  const openCreateModal = () => {
    setSelectedAsset(null);
    setAssetForm({});
    setShowAddModal(true);
  };

  const openEditModal = (asset: any) => {
    setSelectedAsset(asset);
    setAssetForm({
      name: asset.name || '',
      category: asset.category || '',
      department: asset.department || '',
      user: asset.user || '',
      location: asset.location || '',
      value: asset.value || '',
      purchaseDate: asset.purchaseDate || '',
      supplier: asset.supplier || '',
      remark: asset.remark || '',
    });
    setShowAddModal(true);
  };

  const handleSaveAsset = async () => {
    try {
      if (selectedAsset) {
        await assetService.update(getAssetId(selectedAsset), assetForm);
      } else {
        await assetService.create(assetForm);
      }
      setShowAddModal(false);
      await loadAssets();
    } catch (err) {
      console.error('Failed to save asset:', err);
    }
  };

  const handleDeleteAsset = async (asset: any) => {
    try {
      await assetService.delete(getAssetId(asset));
      await loadAssets();
    } catch (err) {
      console.error('Failed to delete asset:', err);
    }
  };

  const filteredAssets = assets;

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
            onClick={openCreateModal}
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
        {loading && <div className="px-6 py-4 text-sm text-gray-500">加载中...</div>}
        {error && <div className="px-6 py-4 text-sm text-red-600">{error}</div>}
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
                <tr key={getAssetId(asset)} className="hover:bg-gray-50 group">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-blue-600">
                    {asset.id || asset.assetNo || asset.assetId}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {asset.name || asset.assetName}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                    {asset.category}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                    {asset.department}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                    {asset.user || asset.userName || '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                    {asset.location || asset.storageLocation || '-'}
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
                    {asset.value || asset.assetValue || '-'}
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
                      <button onClick={() => openEditModal(asset)} className="p-1 hover:bg-gray-100 rounded transition-colors" title="编辑">
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
                      <button onClick={() => handleDeleteAsset(asset)} className="p-1 hover:bg-red-50 text-red-600 rounded transition-colors" title="删除">
                        <Trash2 className="w-4 h-4" />
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
              <h3 className="text-lg font-semibold text-gray-900">{selectedAsset ? '编辑资产' : '新增资产'}</h3>
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
                  <input value={assetForm.name || ''} onChange={(e) => setAssetForm(prev => ({ ...prev, name: e.target.value }))} type="text" className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">资产分类 *</label>
                  <select value={assetForm.category || ''} onChange={(e) => setAssetForm(prev => ({ ...prev, category: e.target.value }))} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                    <option>请选择分类</option>
                    <option>电子设备</option>
                    <option>办公设备</option>
                    <option>生产设备</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">使用部门 *</label>
                  <select value={assetForm.department || ''} onChange={(e) => setAssetForm(prev => ({ ...prev, department: e.target.value }))} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                    <option>请选择部门</option>
                    <option>研发部</option>
                    <option>销售部</option>
                    <option>生产部</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">使用人</label>
                  <input value={assetForm.user || ''} onChange={(e) => setAssetForm(prev => ({ ...prev, user: e.target.value }))} type="text" className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">存放位置 *</label>
                  <input value={assetForm.location || ''} onChange={(e) => setAssetForm(prev => ({ ...prev, location: e.target.value }))} type="text" className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">资产价值 (元) *</label>
                  <input value={assetForm.value || ''} onChange={(e) => setAssetForm(prev => ({ ...prev, value: e.target.value }))} type="number" className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">采购日期 *</label>
                  <input value={assetForm.purchaseDate || ''} onChange={(e) => setAssetForm(prev => ({ ...prev, purchaseDate: e.target.value }))} type="date" className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">供应商</label>
                  <input value={assetForm.supplier || ''} onChange={(e) => setAssetForm(prev => ({ ...prev, supplier: e.target.value }))} type="text" className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">备注</label>
                <textarea value={assetForm.remark || ''} onChange={(e) => setAssetForm(prev => ({ ...prev, remark: e.target.value }))} rows={3} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"></textarea>
              </div>
            </div>
            <div className="px-6 py-4 border-t border-gray-200 flex justify-end gap-3">
              <button 
                onClick={() => setShowAddModal(false)}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 rounded-lg transition-colors"
              >
                取消
              </button>
              <button onClick={handleSaveAsset} className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors">
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
