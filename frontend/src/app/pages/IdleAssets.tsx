import { useEffect, useState } from "react";
import { Archive, Plus, Send, CheckCircle, Clock } from "lucide-react";
import { idleAssetService } from "../services/idleAssetService";

export function IdleAssets() {
  const [detailItem, setDetailItem] = useState<any | null>(null);
  const [showPublishModal, setShowPublishModal] = useState(false);
  const [showClaimModal, setShowClaimModal] = useState(false);
  const [idleAssets, setIdleAssets] = useState<any[]>([]);
  const [announcements, setAnnouncements] = useState<any[]>([]);
  const [disposalHistory, setDisposalHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      const result = await idleAssetService.list();
      const list = (Array.isArray(result) ? result : (result as any)?.records) || [];
      setIdleAssets(list);
      setAnnouncements(
        list
          .filter((a: any) => a.status === '已发布' || a.status === '进行中')
          .map((a: any) => ({
            id: a.id,
            title: a.title || `${a.name || a.assetName} 闲置公告`,
            content: a.content || a.reason || '闲置资产公告',
            assets: a.assets || 1,
            publishDate: a.publishDate || '-',
            deadline: a.deadline || '-',
            publisher: a.publisher || a.originalDept || '-',
            status: a.announcementStatus || (a.status === '已发布' ? '进行中' : a.status),
          }))
      );
      setDisposalHistory(list.filter((a: any) => a.status === '已认领' || a.status === '已处置'));
    } catch (err) {
      console.error('Failed to load idle assets:', err);
      setError('闲置资产数据加载失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const getIdleAssetId = (asset: any) => asset.id ?? asset.assetId;

  const handlePublish = async (asset?: any) => {
    try {
      await idleAssetService.publish(asset ? { id: getIdleAssetId(asset) } : { type: 'announcement' });
      setShowPublishModal(false);
      await loadData();
    } catch (err) {
      console.error('Failed to publish idle asset:', err);
    }
  };

  const handleClaim = async () => {
    try {
      const target = idleAssets.find((a) => a.status === '已发布');
      if (!target) return;
      await idleAssetService.claim(getIdleAssetId(target), 1);
      setShowClaimModal(false);
      await loadData();
    } catch (err) {
      console.error('Failed to claim idle asset:', err);
    }
  };

  const handleCancelPublish = async (asset: any) => {
    try {
      await idleAssetService.cancel(getIdleAssetId(asset));
      await loadData();
    } catch (err) {
      console.error('Failed to cancel idle asset publish:', err);
    }
  };

  return (
    <div className="space-y-6">
      {/* 页面标题 */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-gray-900">闲置资产管理</h2>
          <p className="text-gray-600 mt-1">规范闲置资产处置流程,提升资源利用效率</p>
        </div>
        <button 
          onClick={() => setShowPublishModal(true)}
          className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors flex items-center gap-2"
        >
          <Send className="w-4 h-4" />
          发布闲置公告
        </button>
      </div>

      {/* 统计卡片 */}
      {loading && <div className="text-sm text-gray-500">加载中...</div>}
      {error && <div className="text-sm text-red-600">{error}</div>}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">闲置资产总数</p>
              <p className="text-3xl font-semibold text-gray-900 mt-2">{idleAssets.length}</p>
            </div>
            <div className="w-12 h-12 bg-yellow-50 rounded-lg flex items-center justify-center">
              <Archive className="w-6 h-6 text-yellow-600" />
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">已发布公告</p>
              <p className="text-3xl font-semibold text-gray-900 mt-2">2</p>
            </div>
            <div className="w-12 h-12 bg-blue-50 rounded-lg flex items-center justify-center">
              <Send className="w-6 h-6 text-blue-600" />
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">已认领资产</p>
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
              <p className="text-sm text-gray-600">闲置资产价值</p>
              <p className="text-3xl font-semibold text-gray-900 mt-2">¥73K</p>
            </div>
            <div className="w-12 h-12 bg-purple-50 rounded-lg flex items-center justify-center">
              <Clock className="w-6 h-6 text-purple-600" />
            </div>
          </div>
        </div>
      </div>

      {/* 闲置公告 */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">闲置资产公告</h3>
        </div>
        <div className="p-6 space-y-4">
          {announcements.map((announcement) => (
            <div key={announcement.id} className="border border-gray-200 rounded-lg p-5 hover:border-blue-300 transition-colors">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <h4 className="text-lg font-semibold text-gray-900">{announcement.title}</h4>
                    <span className={`px-2.5 py-0.5 text-xs font-medium rounded-full ${
                      announcement.status === '进行中' ? 'bg-blue-100 text-blue-800' :
                      'bg-green-100 text-green-800'
                    }`}>
                      {announcement.status}
                    </span>
                  </div>
                  <p className="text-sm text-gray-600 mb-3">{announcement.content}</p>
                  <div className="flex items-center gap-6 text-sm text-gray-600">
                    <span>涉及资产: {announcement.assets}项</span>
                    <span>发布部门: {announcement.publisher}</span>
                    <span>发布时间: {announcement.publishDate}</span>
                    <span>截止时间: {announcement.deadline}</span>
                  </div>
                </div>
                <button 
                  onClick={() => setShowClaimModal(true)}
                  className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                    announcement.status === '进行中' 
                      ? 'text-white bg-blue-600 hover:bg-blue-700'
                      : 'text-gray-700 bg-gray-100 cursor-not-allowed'
                  }`}
                  disabled={announcement.status !== '进行中'}
                  onClick={() => setDetailItem(announcement)}
                >
                  {announcement.status === '进行中' ? '查看详情' : '已结束'}
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 闲置资产列表 */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900">闲置资产列表</h3>
          <div className="flex gap-2">
            <button onClick={() => setDetailItem({type: 'filter', info: '筛选功能'})} className="px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 rounded transition-colors">
              全部状态
            </button>
            <button onClick={() => setDetailItem({type: 'filter', info: '筛选功能'})} className="px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 rounded transition-colors">
              全部分类
            </button>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">闲置编号</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">资产名称</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">分类</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">原部门</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">闲置天数</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">资产价值</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">状态</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
               {idleAssets.map((asset) => (
                <tr key={asset.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 text-sm font-medium text-blue-600">{asset.id}</td>
                  <td className="px-6 py-4 text-sm text-gray-900">
                    <div>
                      <p className="font-medium">{asset.name}</p>
                      <p className="text-xs text-gray-500">资产编号: {asset.assetId}</p>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">{asset.category}</td>
                  <td className="px-6 py-4 text-sm text-gray-600">{asset.originalDept}</td>
                  <td className="px-6 py-4 text-sm">
                    <span className={`font-medium ${
                      asset.idleDays > 60 ? 'text-red-600' :
                      asset.idleDays > 30 ? 'text-yellow-600' :
                      'text-gray-900'
                    }`}>
                      {asset.idleDays}天
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm font-medium text-gray-900">{asset.value}</td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                      asset.status === '已发布' ? 'bg-blue-100 text-blue-800' :
                      asset.status === '已认领' ? 'bg-green-100 text-green-800' :
                      'bg-gray-100 text-gray-800'
                    }`}>
                      {asset.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm">
                    <div className="flex gap-2">
                      {asset.status === '待发布' && (
                        <button 
                           onClick={() => handlePublish(asset)}
                          className="px-3 py-1 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 rounded transition-colors"
                        >
                          发布
                        </button>
                      )}
                      {asset.status === '已发布' && (
                        <>
                          <button className="px-3 py-1 text-xs font-medium text-blue-700 bg-blue-100 hover:bg-blue-200 rounded transition-colors">
                            {asset.viewCount}次查看
                          </button>
                           <button onClick={() => handleCancelPublish(asset)} className="px-3 py-1 text-xs font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded transition-colors">
                             取消发布
                           </button>
                        </>
                      )}
                      {asset.status === '已认领' && (
                        <button className="px-3 py-1 text-xs font-medium text-green-700 bg-green-100 rounded">
                          {asset.claimDept}
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* 处置记录 */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">处置记录</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">资产编号</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">资产名称</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">处置方式</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">原部门</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">目标部门</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">处理人</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">处理日期</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
               {disposalHistory.map((record, idx) => (
                <tr key={record.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 text-sm font-medium text-blue-600">{record.assetId || record.id || idx + 1}</td>
                  <td className="px-6 py-4 text-sm text-gray-900">{record.name || record.assetName}</td>
                  <td className="px-6 py-4 text-sm">
                    <span className={`px-2 py-1 text-xs font-medium rounded ${
                      (record.type || '内部调拨') === '内部调拨' ? 'bg-blue-100 text-blue-800' :
                      'bg-red-100 text-red-800'
                    }`}>
                      {record.type || '内部调拨'}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">{record.fromDept || record.originalDept || '-'}</td>
                  <td className="px-6 py-4 text-sm text-gray-600">{record.toDept || record.claimDept || '-'}</td>
                  <td className="px-6 py-4 text-sm text-gray-600">{record.handler || record.operator || '-'}</td>
                  <td className="px-6 py-4 text-sm text-gray-600">{record.date || record.claimDate || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* 发布公告模态框 */}
      {showPublishModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg w-full max-w-2xl mx-4">
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">发布闲置资产公告</h3>
              <button 
                onClick={() => setShowPublishModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                ✕
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">公告标题 *</label>
                <input type="text" className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="例: 办公设备闲置资产处置公告" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">选择闲置资产 *</label>
                <div className="border border-gray-300 rounded-lg p-3 max-h-40 overflow-y-auto">
                  {idleAssets.filter(a => a.status === '待发布').map((asset) => (
                    <label key={asset.id} className="flex items-center gap-2 p-2 hover:bg-gray-50 rounded cursor-pointer">
                      <input type="checkbox" className="w-4 h-4 text-blue-600" />
                      <span className="text-sm text-gray-900">{asset.name} - {asset.value}</span>
                    </label>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">发布部门 *</label>
                  <select className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                    <option>行政部</option>
                    <option>财务部</option>
                    <option>研发部</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">认领截止日期 *</label>
                  <input type="date" className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">处置方式 *</label>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2">
                    <input type="radio" name="disposal" className="w-4 h-4 text-blue-600" defaultChecked />
                    <span className="text-sm text-gray-700">内部调拨</span>
                  </label>
                  <label className="flex items-center gap-2">
                    <input type="radio" name="disposal" className="w-4 h-4 text-blue-600" />
                    <span className="text-sm text-gray-700">报废处理</span>
                  </label>
                  <label className="flex items-center gap-2">
                    <input type="radio" name="disposal" className="w-4 h-4 text-blue-600" />
                    <span className="text-sm text-gray-700">出售</span>
                  </label>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">公告内容 *</label>
                <textarea rows={4} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="请详细描述闲置资产情况及处置要求..."></textarea>
              </div>
            </div>
            <div className="px-6 py-4 border-t border-gray-200 flex justify-end gap-3">
              <button 
                onClick={() => setShowPublishModal(false)}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 rounded-lg transition-colors"
              >
                取消
              </button>
               <button onClick={() => handlePublish()} className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors">
                 发布公告
               </button>
            </div>
          </div>
        </div>
      )}

      {/* 认领资产模态框 */}
      {showClaimModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg w-full max-w-3xl mx-4 max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">闲置资产认领</h3>
              <button 
                onClick={() => setShowClaimModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                ✕
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h4 className="font-medium text-gray-900 mb-2">办公设备闲置资产处置公告</h4>
                <p className="text-sm text-gray-600">发布部门: 行政部 | 截止日期: 2024-03-15</p>
              </div>

              <div className="space-y-3">
                <label className="block text-sm font-medium text-gray-700">选择需要认领的资产:</label>
                {idleAssets.filter(a => a.status === '已发布').map((asset) => (
                  <div key={asset.id} className="border border-gray-200 rounded-lg p-4 hover:border-blue-300 transition-colors">
                    <label className="flex items-start gap-3 cursor-pointer">
                      <input type="checkbox" className="w-5 h-5 text-blue-600 mt-1" />
                      <div className="flex-1">
                        <div className="flex items-center justify-between mb-2">
                          <h5 className="font-medium text-gray-900">{asset.name}</h5>
                          <span className="text-sm font-medium text-gray-900">{asset.value}</span>
                        </div>
                        <div className="grid grid-cols-3 gap-4 text-sm text-gray-600">
                          <div>
                            <span className="text-gray-500">原部门:</span> {asset.originalDept}
                          </div>
                          <div>
                            <span className="text-gray-500">状态:</span> {asset.condition}
                          </div>
                          <div>
                            <span className="text-gray-500">闲置:</span> {asset.idleDays}天
                          </div>
                        </div>
                        <p className="text-sm text-gray-600 mt-2">闲置原因: {asset.reason}</p>
                      </div>
                    </label>
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">认领部门 *</label>
                  <select className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                    <option>人事部</option>
                    <option>市场部</option>
                    <option>研发部</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">认领人 *</label>
                  <input type="text" className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">认领用途 *</label>
                <textarea rows={3} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="请说明资产认领后的具体用途..."></textarea>
              </div>
            </div>
            <div className="px-6 py-4 border-t border-gray-200 flex justify-end gap-3">
              <button 
                onClick={() => setShowClaimModal(false)}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 rounded-lg transition-colors"
              >
                取消
              </button>
               <button onClick={handleClaim} className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors">
                 提交认领申请
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
              <h3 className="text-lg font-semibold text-gray-900">闲置详情</h3>
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
