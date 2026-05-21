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

  const handleViewDetail = useCallback(async (item: DisposalRecord) => {
    try {
      const applications = await api.get<Array<{ id: number; assetId: number }>>(
        `/v1/retirement/asset/${item.assetId}`,
      );
      if (applications && applications.length > 0) {
        navigate(`/retirement/${applications[0].id}`);
        return;
      }
    } catch {
      // fallback to modal
    }
    setSelectedRecord(item);
  }, [navigate]);

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
          <p className="text-gray-500 mt-1">管理资产转移、清退、报废转让及赔偿等全生命周期处置流程</p>
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
                    : 'border-transparent text-gray-400 hover:text-gray-700 hover:border-gray-200'
                }`}
              >
                <Icon className={`w-5 h-5 mr-2 ${isActive ? 'text-blue-500' : 'text-gray-400 group-hover:text-gray-400'}`} />
                {tab.name}
              </button>
            );
          })}
        </nav>
      </div>

      <div className="bg-white rounded-b-lg border border-gray-200 border-t-0 p-6">
        {loading && <div className="mb-4 text-sm text-gray-400">加载中...</div>}
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
                className="w-64 pl-10 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
          <div className="text-sm text-gray-400">
            共 {totalCount} 条记录，第 {page} / {totalPages} 页
          </div>
        </div>

        <div className="overflow-x-auto border border-gray-200 rounded-lg">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase">日志ID</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase">资产ID</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase">变更类型</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase">操作人ID</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase">创建时间</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase">原因</th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-400 uppercase">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1e3a5f]">
              {filteredData.map((item) => (
                <tr key={item.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 text-sm font-medium text-blue-600">{item.id}</td>
                  <td className="px-6 py-4 text-sm text-gray-900">{item.assetId ?? '-'}</td>
                  <td className="px-6 py-4 text-sm text-gray-500">{changeTypeLabels[item.changeType ?? ''] ?? item.changeType ?? '-'}</td>
                  <td className="px-6 py-4 text-sm text-gray-900">{item.operatorId ?? '-'}</td>
                  <td className="px-6 py-4 text-sm text-gray-500">{item.createTime ?? '-'}</td>
                  <td className="px-6 py-4 text-sm text-gray-500">{item.reason ?? '-'}</td>
                    <td className="px-6 py-4 text-center">
                      <button
                        onClick={() => handleViewDetail(item)}
                        className="inline-flex items-center justify-center p-1 rounded transition-colors hover:bg-blue-50"
                        title="查看详情"
                      >
                        <Eye className="w-4 h-4 text-gray-500" />
                      </button>
                    </td>
                </tr>
              ))}
              {filteredData.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-6 py-8 text-center text-gray-400 text-sm">暂无数据</td>
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
              className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
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
                  className={`px-3 py-1.5 text-sm rounded-lg ${p === page ? 'bg-blue-600 text-white' : 'border border-gray-200 hover:bg-gray-50'}`}
                >
                  {p}
                </button>
              );
            })}
            <button
              onClick={() => setPage(Math.min(totalPages, page + 1))}
              disabled={page >= totalPages}
              className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              下一页
            </button>
          </div>
        )}
      </div>

      {selectedRecord && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setSelectedRecord(null)}>
          <div className="w-full max-w-2xl rounded-xl bg-white shadow-xl mx-4 max-h-[85vh] overflow-y-auto" onClick={(event) => event.stopPropagation()}>
            {/* Header */}
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between bg-gray-50/50">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-50 rounded-lg">
                  <Eye className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">处置记录详情</h3>
                  <p className="text-sm text-gray-400">日志ID：{selectedRecord.id}</p>
                </div>
              </div>
              <button onClick={() => setSelectedRecord(null)} className="text-gray-400 hover:text-gray-500 text-xl">&times;</button>
            </div>

            {/* Status Overview */}
            <div className="px-6 py-5 border-b border-gray-200">
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <p className="text-sm text-gray-400 mb-1">变更类型</p>
                  <span className="inline-block px-3 py-1 text-sm font-medium rounded-full bg-blue-50 text-blue-700">
                    {changeTypeLabels[selectedRecord.changeType ?? ''] ?? selectedRecord.changeType ?? '-'}
                  </span>
                </div>
                <div>
                  <p className="text-sm text-gray-400 mb-1">资产ID</p>
                  <p className="text-base font-semibold text-gray-900">{selectedRecord.assetId ?? '-'}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-400 mb-1">操作人</p>
                  <p className="text-base text-gray-900">操作人 #{selectedRecord.operatorId ?? '-'}</p>
                </div>
              </div>
            </div>

            {/* Change Details */}
            <div className="px-6 py-5 border-b border-gray-200">
              <h4 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                <span className="w-1 h-4 bg-blue-500 rounded-full"></span>
                变更详情
              </h4>
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-red-50/50 rounded-lg p-4">
                  <p className="text-sm text-gray-400 mb-1">变更前</p>
                  <p className="text-sm text-gray-700 whitespace-pre-wrap">{selectedRecord.oldValue || '-'}</p>
                </div>
                <div className="bg-green-50/50 rounded-lg p-4">
                  <p className="text-sm text-gray-400 mb-1">变更后</p>
                  <p className="text-sm text-gray-700 whitespace-pre-wrap">{selectedRecord.newValue || '-'}</p>
                </div>
              </div>
            </div>

            {/* Reason */}
            <div className="px-6 py-5 border-b border-gray-200">
              <h4 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                <span className="w-1 h-4 bg-blue-500 rounded-full"></span>
                处置原因
              </h4>
              <p className="text-sm text-gray-700 whitespace-pre-wrap p-3 bg-gray-50 rounded-md">
                {selectedRecord.reason || '-'}
              </p>
            </div>

            {/* Footer */}
            <div className="px-6 py-4 flex items-center justify-between bg-gray-50/50">
              <p className="text-xs text-gray-400">创建时间：{selectedRecord.createTime ?? '-'}</p>
              <button onClick={() => setSelectedRecord(null)} className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-200 hover:bg-gray-50 rounded-lg transition-colors">关闭</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
