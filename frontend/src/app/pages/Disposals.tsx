import { useEffect, useState, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { ArrowRightLeft, LogOut, Trash2, DollarSign, Plus, Search, Eye } from "lucide-react";
import { api } from "../utils/api";

const tabs = [
  { id: 'transfer', name: '资产转移', icon: ArrowRightLeft, changeType: 'TRANSFER' },
  { id: 'clearance', name: '资产清退', icon: LogOut, changeType: 'CLEARANCE' },
  { id: 'scrap', name: '资产报废转让', icon: Trash2, changeType: 'SCRAP' },
  { id: 'compensation', name: '资产赔偿', icon: DollarSign, changeType: undefined },
];

const changeTypeLabels: Record<string, string> = {
  TRANSFER: '资产转移',
  CLEARANCE: '资产清退',
  SCRAP: '资产报废转让',
};

interface DisposalRecord {
  id: number;
  assetId: number;
  changeType: string;
  operatorId: number;
  oldValue: string;
  newValue: string;
  reason: string;
  createTime: string;
}

interface PageResult<T> {
  records: T[];
  total: number;
  current: number;
  size: number;
  pages: number;
}

export function Disposals() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState('transfer');
  const [data, setData] = useState<DisposalRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedRecord, setSelectedRecord] = useState<DisposalRecord | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  const pageSize = 20;
  const activeTabConfig = tabs.find(t => t.id === activeTab);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const params = new URLSearchParams();
      params.set('page', String(page));
      params.set('pageSize', String(pageSize));
      if (activeTabConfig?.changeType) {
        params.set('changeType', activeTabConfig.changeType);
      }
      const result = await api.get<PageResult<DisposalRecord>>(
        `/disposals/history?${params.toString()}`
      );
      setData(result?.records ?? []);
      setTotalPages(result?.pages ?? 1);
      setTotalCount(result?.total ?? 0);
    } catch (err) {
      console.error('Failed to load disposal history:', err);
      setError('处置历史加载失败');
    } finally {
      setLoading(false);
    }
  }, [page, activeTabConfig?.changeType]);

  useEffect(() => {
    setPage(1);
  }, [activeTab]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const filteredData = searchTerm.trim()
    ? data.filter((item) => {
        const keyword = searchTerm.trim().toLowerCase();
        return [String(item.id), String(item.assetId), item.reason, item.changeType]
          .some((v) => v?.toLowerCase().includes(keyword));
      })
    : data;

  const routeMap: Record<string, string> = {
    transfer: '/disposals/transfer/new',
    clearance: '/disposals/clearance/new',
    scrap: '/disposals/scrap/new',
    compensation: '/disposals/compensation/new',
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-gray-900">资产处置管理</h2>
          <p className="text-gray-600 mt-1">管理资产转移、清退、报废转让及赔偿等全生命周期处置流程</p>
        </div>
        <button
          onClick={() => {
            const route = routeMap[activeTab];
            const assetId = searchParams.get('assetId');
            if (route) navigate(assetId ? `${route}?assetId=${encodeURIComponent(assetId)}` : route);
          }}
          className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          发起{activeTabConfig?.name ?? '处置'}申请
        </button>
      </div>

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

      <div className="bg-white rounded-b-lg border border-gray-200 border-t-0 p-6">
        {loading && <div className="mb-4 text-sm text-gray-500">加载中...</div>}
        {error && <div className="mb-4 text-sm text-red-600">{error}</div>}
        <div className="flex items-center justify-between mb-6">
          <div className="flex gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="搜索申请单号或资产ID..."
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                className="w-64 pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
          <div className="text-sm text-gray-500">
            共 {totalCount} 条记录，第 {page} / {totalPages} 页
          </div>
        </div>

        <div className="overflow-x-auto border border-gray-200 rounded-lg">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">日志ID</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">资产ID</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">变更类型</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">操作人ID</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">创建时间</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">原因</th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredData.map((item) => (
                <tr key={item.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 text-sm font-medium text-blue-600">{item.id}</td>
                  <td className="px-6 py-4 text-sm text-gray-900">{item.assetId ?? '-'}</td>
                  <td className="px-6 py-4 text-sm text-gray-600">{changeTypeLabels[item.changeType ?? ''] ?? item.changeType ?? '-'}</td>
                  <td className="px-6 py-4 text-sm text-gray-900">{item.operatorId ?? '-'}</td>
                  <td className="px-6 py-4 text-sm text-gray-600">{item.createTime ?? '-'}</td>
                  <td className="px-6 py-4 text-sm text-gray-600">{item.reason ?? '-'}</td>
                  <td className="px-6 py-4 text-center">
                    <button
                      onClick={() => setSelectedRecord(item)}
                      className="inline-flex items-center justify-center p-1 rounded transition-colors hover:bg-gray-100"
                      title="查看详情"
                    >
                      <Eye className="w-4 h-4 text-gray-600" />
                    </button>
                  </td>
                </tr>
              ))}
              {filteredData.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-6 py-8 text-center text-gray-500 text-sm">暂无数据</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-2 mt-4 pt-4 border-t border-gray-200">
            <button
              onClick={() => setPage(Math.max(1, page - 1))}
              disabled={page <= 1}
              className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              上一页
            </button>
            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
              const start = Math.max(1, Math.min(page - 2, totalPages - 4));
              const p = start + i;
              if (p > totalPages) return null;
              return (
                <button
                  key={p}
                  onClick={() => setPage(p)}
                  className={`px-3 py-1.5 text-sm rounded-lg ${p === page ? 'bg-blue-600 text-white' : 'border border-gray-300 hover:bg-gray-50'}`}
                >
                  {p}
                </button>
              );
            })}
            <button
              onClick={() => setPage(Math.min(totalPages, page + 1))}
              disabled={page >= totalPages}
              className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              下一页
            </button>
          </div>
        )}
      </div>

      {selectedRecord && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setSelectedRecord(null)}>
          <div className="w-full max-w-xl rounded-lg bg-white shadow-xl mx-4" onClick={(event) => event.stopPropagation()}>
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">处置记录详情</h3>
              <button onClick={() => setSelectedRecord(null)} className="text-gray-400 hover:text-gray-600">✕</button>
            </div>
            <div className="p-6 grid grid-cols-2 gap-4 text-sm">
              <div><span className="text-gray-500">日志ID：</span><span className="font-medium">{selectedRecord.id}</span></div>
              <div><span className="text-gray-500">资产ID：</span><span className="font-medium">{selectedRecord.assetId ?? '-'}</span></div>
              <div><span className="text-gray-500">变更类型：</span><span className="font-medium">{changeTypeLabels[selectedRecord.changeType ?? ''] ?? selectedRecord.changeType ?? '-'}</span></div>
              <div><span className="text-gray-500">操作人ID：</span><span className="font-medium">{selectedRecord.operatorId ?? '-'}</span></div>
              <div className="col-span-2"><span className="text-gray-500">创建时间：</span><span className="font-medium">{selectedRecord.createTime ?? '-'}</span></div>
              <div className="col-span-2"><span className="text-gray-500">变更前：</span><p className="mt-1 rounded bg-gray-50 p-3 text-gray-700">{selectedRecord.oldValue || '-'}</p></div>
              <div className="col-span-2"><span className="text-gray-500">变更后：</span><p className="mt-1 rounded bg-gray-50 p-3 text-gray-700">{selectedRecord.newValue || '-'}</p></div>
              <div className="col-span-2"><span className="text-gray-500">原因：</span><p className="mt-1 rounded bg-gray-50 p-3 text-gray-700">{selectedRecord.reason || '-'}</p></div>
            </div>
            <div className="px-6 py-4 border-t border-gray-200 flex justify-end">
              <button onClick={() => setSelectedRecord(null)} className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 rounded-lg transition-colors">关闭</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
