import { useEffect, useState } from "react";
import { ClipboardCheck, Clock, CheckCircle, XCircle, AlertCircle } from "lucide-react";
import { approvalService } from "../services/approvalService";

const workOrders: any[] = [];

export function Approval() {
  const [activeTab, setActiveTab] = useState<'approval' | 'workorder'>('approval');
  const [statusFilter, setStatusFilter] = useState('全部状态');
  const [approvals, setApprovals] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      const result = await approvalService.list() as any;
      setApprovals(Array.isArray(result) ? result : result?.records || []);
    } catch (err) {
      console.error('Failed to load approvals:', err);
      setError('审批数据加载失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleApprove = async (id: string | number, approved: boolean) => {
    try {
      await approvalService.approve(id, { approved, comment: approved ? '同意' : '驳回' });
      await loadData();
    } catch (err) {
      console.error('Failed to approve:', err);
    }
  };

  const filteredApprovals = statusFilter === '全部状态' 
    ? approvals 
    : approvals.filter(a => a.status === statusFilter);

  return (
    <div className="space-y-6">
      {/* 页面标题 */}
      <div>
        <h2 className="text-2xl font-semibold text-gray-900">审批流程管理</h2>
        <p className="text-gray-600 mt-1">管理资产相关审批流程与工单</p>
      </div>

      {/* 统计卡片 */}
      {loading && <div className="text-sm text-gray-500">加载中...</div>}
      {error && <div className="text-sm text-red-600">{error}</div>}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">待审批</p>
              <p className="text-3xl font-semibold text-gray-900 mt-2">
                {approvals.filter(a => a.status === '待审批').length}
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
              <p className="text-sm text-gray-600">审批中</p>
              <p className="text-3xl font-semibold text-gray-900 mt-2">
                {approvals.filter(a => a.status === '审批中').length}
              </p>
            </div>
            <div className="w-12 h-12 bg-blue-50 rounded-lg flex items-center justify-center">
              <ClipboardCheck className="w-6 h-6 text-blue-600" />
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">已批准</p>
              <p className="text-3xl font-semibold text-gray-900 mt-2">
                {approvals.filter(a => a.status === '已批准').length}
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
              <p className="text-sm text-gray-600">待处理工单</p>
              <p className="text-3xl font-semibold text-gray-900 mt-2">
                {workOrders.filter(w => w.status !== '已完成').length}
              </p>
            </div>
            <div className="w-12 h-12 bg-purple-50 rounded-lg flex items-center justify-center">
              <AlertCircle className="w-6 h-6 text-purple-600" />
            </div>
          </div>
        </div>
      </div>

      {/* 标签页切换 */}
      <div className="bg-white rounded-lg border border-gray-200">
        <div className="border-b border-gray-200">
          <div className="flex">
            <button
              onClick={() => setActiveTab('approval')}
              className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'approval'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-600 hover:text-gray-900'
              }`}
            >
              审批流程
            </button>
            <button
              onClick={() => setActiveTab('workorder')}
              className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'workorder'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-600 hover:text-gray-900'
              }`}
            >
              工单管理
            </button>
          </div>
        </div>

        {/* 审批流程内容 */}
        {activeTab === 'approval' && (
          <div>
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">审批列表</h3>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option>全部状态</option>
                <option>待审批</option>
                <option>审批中</option>
                <option>已批准</option>
                <option>已驳回</option>
              </select>
            </div>
            <div className="p-6 space-y-4">
              {filteredApprovals.map((approval) => (
                <div key={approval.id} className="border border-gray-200 rounded-lg p-5 hover:border-blue-300 transition-colors">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h4 className="text-lg font-semibold text-gray-900">{approval.title}</h4>
                        <span className={`px-2.5 py-0.5 text-xs font-medium rounded-full ${
                          approval.status === '待审批' ? 'bg-yellow-100 text-yellow-800' :
                          approval.status === '审批中' ? 'bg-blue-100 text-blue-800' :
                          approval.status === '已批准' ? 'bg-green-100 text-green-800' :
                          'bg-red-100 text-red-800'
                        }`}>
                          {approval.status}
                        </span>
                        <span className={`px-2 py-0.5 text-xs font-medium rounded ${
                          approval.urgency === '紧急' ? 'bg-red-100 text-red-800' :
                          'bg-gray-100 text-gray-800'
                        }`}>
                          {approval.urgency}
                        </span>
                        <span className="px-2 py-0.5 text-xs font-medium bg-purple-100 text-purple-800 rounded">
                          {approval.type}
                        </span>
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm text-gray-600">
                        <div>
                          <span className="text-gray-500">申请编号:</span> {approval.id}
                        </div>
                        <div>
                          <span className="text-gray-500">申请人:</span> {approval.applicant}
                        </div>
                        <div>
                          <span className="text-gray-500">部门:</span> {approval.department}
                        </div>
                        <div>
                          <span className="text-gray-500">金额:</span> {approval.amount}
                        </div>
                        <div>
                          <span className="text-gray-500">提交时间:</span> {approval.submitDate}
                        </div>
                        {approval.currentApprover && (
                          <div>
                            <span className="text-gray-500">当前审批人:</span> {approval.currentApprover}
                          </div>
                        )}
                        {approval.completeDate && (
                          <div>
                            <span className="text-gray-500">完成时间:</span> {approval.completeDate}
                          </div>
                        )}
                      </div>
                      {approval.details && (
                        <p className="text-sm text-gray-600 mt-2">{approval.details}</p>
                      )}
                    </div>
                    <div className="flex gap-2 ml-4">
                      {approval.status === '待审批' && (
                        <>
                           <button onClick={() => handleApprove(approval.id, true)} className="px-4 py-2 text-sm font-medium text-white bg-green-600 hover:bg-green-700 rounded-lg transition-colors">
                             批准
                           </button>
                           <button onClick={() => handleApprove(approval.id, false)} className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors">
                             驳回
                           </button>
                        </>
                      )}
                      <button className="px-4 py-2 text-sm font-medium text-blue-700 bg-blue-100 hover:bg-blue-200 rounded-lg transition-colors">
                        详情
                      </button>
                    </div>
                  </div>

                  {/* 审批历史 */}
                  {approval.approvalHistory && approval.approvalHistory.length > 0 && (
                    <div className="mt-4 pt-4 border-t border-gray-200">
                      <h5 className="text-sm font-medium text-gray-900 mb-2">审批历史</h5>
                      <div className="space-y-2">
                        {approval.approvalHistory.map((history, index) => (
                          <div key={index} className="flex items-start gap-3 text-sm">
                            {history.result === '已通过' ? (
                              <CheckCircle className="w-4 h-4 text-green-600 mt-0.5" />
                            ) : (
                              <XCircle className="w-4 h-4 text-red-600 mt-0.5" />
                            )}
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <span className="font-medium text-gray-900">{history.approver}</span>
                                <span className={`text-xs ${
                                  history.result === '已通过' ? 'text-green-600' : 'text-red-600'
                                }`}>
                                  {history.result}
                                </span>
                                <span className="text-xs text-gray-500">{history.time}</span>
                              </div>
                              {history.comment && (
                                <p className="text-gray-600 mt-1">{history.comment}</p>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 工单管理内容 */}
        {activeTab === 'workorder' && (
          <div>
            <div className="px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">工单列表</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">工单编号</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">类型</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">设备</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">报修人</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">优先级</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">指派给</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">状态</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">创建时间</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">操作</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {workOrders.map((order) => (
                    <tr key={order.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 text-sm font-medium text-blue-600">{order.id}</td>
                      <td className="px-6 py-4 text-sm text-gray-900">{order.type}</td>
                      <td className="px-6 py-4 text-sm text-gray-900">{order.equipment}</td>
                      <td className="px-6 py-4 text-sm text-gray-600">{order.reporter}</td>
                      <td className="px-6 py-4">
                        <span className={`px-2 py-1 text-xs font-medium rounded ${
                          order.priority === '高' ? 'bg-red-100 text-red-800' :
                          order.priority === '中' ? 'bg-yellow-100 text-yellow-800' :
                          'bg-gray-100 text-gray-800'
                        }`}>
                          {order.priority}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">{order.assignee}</td>
                      <td className="px-6 py-4">
                        <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                          order.status === '处理中' ? 'bg-blue-100 text-blue-800' :
                          order.status === '待派工' ? 'bg-yellow-100 text-yellow-800' :
                          'bg-green-100 text-green-800'
                        }`}>
                          {order.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">{order.createTime}</td>
                      <td className="px-6 py-4 text-sm">
                        <div className="flex gap-2">
                          {order.status === '待派工' && (
                            <button className="px-3 py-1 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 rounded transition-colors">
                              派工
                            </button>
                          )}
                          {order.status === '处理中' && (
                            <button className="px-3 py-1 text-xs font-medium text-white bg-green-600 hover:bg-green-700 rounded transition-colors">
                              完成
                            </button>
                          )}
                          <button className="px-3 py-1 text-xs font-medium text-blue-700 bg-blue-100 hover:bg-blue-200 rounded transition-colors">
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
        )}
      </div>
    </div>
  );
}
