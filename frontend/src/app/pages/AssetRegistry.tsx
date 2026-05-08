import { ChangeEvent, useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { Plus, Search, Filter, Download, Upload, Edit, Trash2, Eye, ArrowRightLeft, ShieldAlert, LogOut, DollarSign } from "lucide-react";
import { AssetDetailModal } from "../components/AssetDetailModal";
import { ASSET_STATUS_OPTIONS, getAssetStatusMeta } from "../constants/assetStatus";
import { assetService } from "../services/assetService";

const categories = ['全部分类', '电子设备', '办公设备', '生产设备', '移动设备', '摄影设备'];

export function AssetRegistry() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('全部分类');
  const [selectedStatus, setSelectedStatus] = useState('');
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [locationFilter, setLocationFilter] = useState('');
  const [minValueFilter, setMinValueFilter] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [assets, setAssets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
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
      if (selectedStatus) params.status = selectedStatus;
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
    const keyword = searchParams.get('keyword');
    if (keyword !== null) setSearchTerm(keyword);
  }, [searchParams]);

  useEffect(() => {
    loadAssets();
  }, [searchTerm, selectedCategory, selectedStatus]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, selectedCategory, selectedStatus, locationFilter, minValueFilter, assets.length]);

  const getAssetId = (asset: any) => asset.id ?? asset.assetId ?? asset.assetNo;

  const openCreateModal = () => {
    setSelectedAsset(null);
    setAssetForm({});
    setFormError(null);
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
    setFormError(null);
    setShowAddModal(true);
  };

  const getAssetValue = (asset: any) => Number(asset.value ?? asset.assetValue ?? 0) || 0;

  const validateAssetForm = () => {
    const requiredFields = [
      ['name', '资产名称'],
      ['category', '资产分类'],
      ['department', '使用部门'],
      ['location', '存放位置'],
      ['value', '资产价值'],
      ['purchaseDate', '采购日期'],
    ];
    const missing = requiredFields
      .filter(([field]) => !String(assetForm[field] ?? '').trim() || String(assetForm[field]).startsWith('请选择'))
      .map(([, label]) => label);
    if (missing.length > 0) {
      setFormError(`请填写必填项：${missing.join('、')}`);
      return false;
    }
    if (Number(assetForm.value) <= 0) {
      setFormError('资产价值必须大于 0');
      return false;
    }
    setFormError(null);
    return true;
  };

  const handleSaveAsset = async () => {
    if (!validateAssetForm()) return;
    try {
      if (selectedAsset) {
        await assetService.update(getAssetId(selectedAsset), assetForm);
      } else {
        await assetService.create(assetForm);
      }
      setShowAddModal(false);
      setMessage({ type: 'success', text: selectedAsset ? '资产已更新' : '资产已新增' });
      await loadAssets();
    } catch (err) {
      console.error('Failed to save asset:', err);
      setFormError('保存资产失败，请检查网络或稍后重试');
    }
  };

  const handleDeleteAsset = async (asset: any) => {
    if (!window.confirm(`确认删除资产“${asset.name || asset.assetName || getAssetId(asset)}”？`)) return;
    try {
      await assetService.delete(getAssetId(asset));
      setMessage({ type: 'success', text: '资产已删除' });
      await loadAssets();
    } catch (err) {
      console.error('Failed to delete asset:', err);
      setMessage({ type: 'error', text: '删除资产失败，请稍后重试' });
    }
  };

  const handleImportClick = () => fileInputRef.current?.click();

  const handleImportFile = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      setMessage({ type: 'info', text: '未选择导入文件' });
      return;
    }
    setMessage({ type: 'info', text: `已选择导入文件：${file.name}。请在导入模块完成解析和提交。` });
    event.target.value = '';
  };

  const escapeCsv = (value: unknown) => `"${String(value ?? '').replace(/"/g, '""')}"`;

  const handleExportCsv = () => {
    if (filteredAssets.length === 0) {
      setMessage({ type: 'error', text: '当前列表为空，无法导出' });
      return;
    }
    const headers = ['资产编号', '资产名称', '分类', '使用部门', '使用人', '存放位置', '状态', '资产价值'];
    const rows = filteredAssets.map((asset) => [
      asset.id || asset.assetNo || asset.assetId,
      asset.name || asset.assetName,
      asset.category,
      asset.department,
      asset.user || asset.userName || '',
      asset.location || asset.storageLocation || '',
      getAssetStatusMeta(asset.status).label,
      asset.value || asset.assetValue || '',
    ]);
    const csv = [headers, ...rows].map((row) => row.map(escapeCsv).join(',')).join('\n');
    const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `assets-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    setMessage({ type: 'success', text: `已导出 ${filteredAssets.length} 条资产数据` });
  };

  const filteredAssets = assets.filter((asset) => {
    const locationMatched = !locationFilter.trim() || String(asset.location || asset.storageLocation || '').includes(locationFilter.trim());
    const minValue = Number(minValueFilter);
    const valueMatched = !minValueFilter || getAssetValue(asset) >= minValue;
    return locationMatched && valueMatched;
  });
  const totalPages = Math.max(1, Math.ceil(filteredAssets.length / pageSize));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const pagedAssets = filteredAssets.slice((safeCurrentPage - 1) * pageSize, safeCurrentPage * pageSize);

  return (
    <div className="space-y-6 bg-white min-h-screen">
      {/* 页面标题 */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-gray-900">资产台账管理</h2>
          <p className="text-gray-600 mt-1">管理企业全部资产信息与生命周期</p>
        </div>
        <div className="flex gap-3">
          <input ref={fileInputRef} type="file" accept=".csv,.xlsx,.xls" className="hidden" onChange={handleImportFile} />
          <button onClick={handleImportClick} className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 rounded-lg transition-colors flex items-center gap-2">
            <Upload className="w-4 h-4" />
            批量导入
          </button>
          <button onClick={handleExportCsv} className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 rounded-lg transition-colors flex items-center gap-2">
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

      {message && (
        <div className={`rounded-lg border px-4 py-3 text-sm ${message.type === 'error' ? 'border-red-200 bg-red-50 text-red-700' : message.type === 'success' ? 'border-green-200 bg-green-50 text-green-700' : 'border-blue-200 bg-blue-50 text-blue-700'}`}>
          {message.text}
        </div>
      )}

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
            {ASSET_STATUS_OPTIONS.map(status => (
              <option key={status.value || 'ALL'} value={status.value}>{status.label}</option>
            ))}
          </select>
          <button onClick={() => setShowAdvancedFilters((prev) => !prev)} className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 rounded-lg transition-colors flex items-center gap-2">
            <Filter className="w-4 h-4" />
            高级筛选
          </button>
        </div>
        {showAdvancedFilters && (
          <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4 border-t border-gray-100 pt-4">
            <input value={locationFilter} onChange={(e) => setLocationFilter(e.target.value)} placeholder="按存放位置筛选" className="px-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            <input value={minValueFilter} onChange={(e) => setMinValueFilter(e.target.value)} type="number" min="0" placeholder="最低资产价值" className="px-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            <button onClick={() => { setLocationFilter(''); setMinValueFilter(''); }} className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 rounded-lg transition-colors">
              清空高级筛选
            </button>
          </div>
        )}
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
              {pagedAssets.map((asset) => {
                const statusMeta = getAssetStatusMeta(asset.status);
                return (
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
                    <span className={`px-2 py-1 text-xs font-medium rounded-full ${statusMeta.badgeClass}`}>
                      {statusMeta.label}
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
                );
              })}
            </tbody>
          </table>
        </div>
        
        {/* 分页 */}
        <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-between">
          <div className="text-sm text-gray-600">
            显示 <span className="font-medium">{filteredAssets.length === 0 ? 0 : (safeCurrentPage - 1) * pageSize + 1}-{Math.min(safeCurrentPage * pageSize, filteredAssets.length)}</span> 条结果，共 <span className="font-medium">{filteredAssets.length}</span> 条
          </div>
          <div className="flex items-center gap-2">
            <select value={pageSize} onChange={(e) => { setPageSize(Number(e.target.value)); setCurrentPage(1); }} className="px-2 py-1 text-sm border border-gray-300 rounded">
              {[5, 10, 20, 50].map(size => <option key={size} value={size}>{size} 条/页</option>)}
            </select>
            <button onClick={() => setCurrentPage((page) => Math.max(1, page - 1))} className="px-3 py-1 text-sm font-medium text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed" disabled={safeCurrentPage <= 1}>
              上一页
            </button>
            <span className="px-3 py-1 text-sm font-medium text-white bg-blue-600 rounded">{safeCurrentPage} / {totalPages}</span>
            <button onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))} className="px-3 py-1 text-sm font-medium text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed" disabled={safeCurrentPage >= totalPages}>
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
              {formError && <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{formError}</div>}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">资产名称 *</label>
                  <input required value={assetForm.name || ''} onChange={(e) => setAssetForm(prev => ({ ...prev, name: e.target.value }))} type="text" className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">资产分类 *</label>
                  <select required value={assetForm.category || ''} onChange={(e) => setAssetForm(prev => ({ ...prev, category: e.target.value }))} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                    <option value="">请选择分类</option>
                    <option>电子设备</option>
                    <option>办公设备</option>
                    <option>生产设备</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">使用部门 *</label>
                  <select required value={assetForm.department || ''} onChange={(e) => setAssetForm(prev => ({ ...prev, department: e.target.value }))} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                    <option value="">请选择部门</option>
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
                  <input required value={assetForm.location || ''} onChange={(e) => setAssetForm(prev => ({ ...prev, location: e.target.value }))} type="text" className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">资产价值 (元) *</label>
                  <input required min="0.01" value={assetForm.value || ''} onChange={(e) => setAssetForm(prev => ({ ...prev, value: e.target.value }))} type="number" className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">采购日期 *</label>
                  <input required value={assetForm.purchaseDate || ''} onChange={(e) => setAssetForm(prev => ({ ...prev, purchaseDate: e.target.value }))} type="date" className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
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
