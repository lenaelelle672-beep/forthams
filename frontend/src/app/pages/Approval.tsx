import { useEffect, useState } from "react";
import { ClipboardCheck, Clock, CheckCircle, XCircle, AlertCircle } from "lucide-react";
import { approvalService } from "../services/approvalService";
import { workOrderService } from "../services/workOrderService";

export function Approval() {
  const [activeTab, setActiveTab] = useState<'approval' | 'workorder'>('approval');
  const [statusFilter, setStatusFilter] = useState('全部状态');
  const [approvals, setApprovals] = useState<Record<string, unknown>[]>([]);
  const [workOrders, setWorkOrders] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [detailItem, setDetailItem] = useState<Record<string, unknown> | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      const [result, workOrderResult] = await Promise.all([
        approvalService.list(),
        workOrderService.list({ pageSize: 50 }),
      ]) as [unknown, unknown];
      const resultList = result as Record<string, unknown>;
      const woResult = workOrderResult as Record<string, unknown>;
      setApprovals(Array.isArray(result) ? result as Record<string, unknown>[] : (resultList?.records as Record<string, unknown>[]) || []);
      setWorkOrders(Array.isArray(workOrderResult) ? workOrderResult as Record<string, unknown>[] : (woResult?.records as Record<string, unknown>[]) || []);
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
      setNotice(approved ? '审批已批准' : '审批已驳回');
      await loadData();
    } catch (err) {
      console.error('Failed to approve:', err);
      setError('审批操作失败');
    }
  };

  const handleWorkOrderOperation = async (order: Record<string, unknown>, operation: 'submit' | 'start' | 'complete') => {
    try {
      if (operation === 'submit') {
        await workOrderService.submit(order.id);
        setNotice('工单已提交审批');
      } else {
        await workOrderService.operate(order.id, operation, operation === 'complete' ? '处理完成' : undefined);
        setNotice(operation === 'start' ? '工单已开始执行' : '工单已完成');
      }
      await loadData();
    } catch (err) {
      console.error('Failed to operate work order:', err);
      setError('工单操作失败');
    }
  };

  const getWorkOrderStatusLabel = (status?: string) => ({
    DRAFT: '草稿',
    PENDING: '待审批',
    APPROVED: '待派工',
    EXECUTING: '处理中',
    COMPLETED: '已完成',
    REJECTED: '已驳回',
    CANCELLED: '已取消',
  }[status || ''] || status || '-');

  const getPriorityLabel = (priority?: string) => ({
    NORMAL: '中',
    URGENT: '高',
    EMERGENCY: '紧急',
  }[priority || ''] || priority || '-');

  const getApprovalStatusLabel = (status?: string) => ({
    PENDING: '待审批',
    APPROVING: '审批中',
    IN_PROGRESS: '审批中',
    APPROVED: '已批准',
    REJECTED: '已驳回',
    CANCELLED: '已取消',
  }[status || ''] || status || '-');

  const filteredApprovals = statusFilter === '全部状态' 
    ? approvals 
    : approvals.filter(a => getApprovalStatusLabel(a.status) === statusFilter);

  return (
    <div className="space-y-6">
      {/* 页面标题 */}
      <div>
        <h2 className="text-2xl font-semibold text-gray-900">审批流程管理</h2>
        <p className="text-gray-500 mt-1">管理资产相关审批流程与工单</p>
      </div>

      {/* 统计卡片 */}
      {loading && <div className="text-sm text-gray-400">加载中...</div>}
      {error && <div className="text-sm text-red-600">{error}</div>}
      {notice && <div className="text-sm text-green-700 bg-green-50 border border-green-100 rounded-lg px-4 py-3">{notice}</div>}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">待审批</p>
              <p className="text-3xl font-semibold text-gray-900 mt-2">
                {approvals.filter(a => getApprovalStatusLabel(a.status) === '待审批').length}
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
              <p className="text-sm text-gray-500">审批中</p>
              <p className="text-3xl font-semibold text-gray-900 mt-2">
                {approvals.filter(a => getApprovalStatusLabel(a.status) === '审批中').length}
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
              <p className="text-sm text-gray-500">已批准</p>
              <p className="text-3xl font-semibold text-gray-900 mt-2">
                {approvals.filter(a => getApprovalStatusLabel(a.status) === '已批准').length}
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
              <p className="text-sm text-gray-500">待处理工单</p>
              <p className="text-3xl font-semibold text-gray-900 mt-2">
                {workOrders.filter(w => w.status !== 'COMPLETED' && w.status !== '已完成').length}
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
                  : 'border-transparent text-gray-500 hover:text-gray-900'
              }`}
            >
              审批流程
            </button>
            <button
              onClick={() => setActiveTab('workorder')}
              className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'workorder'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-900'
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
                className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                          getApprovalStatusLabel(approval.status) === '待审批' ? 'bg-yellow-100 text-yellow-800' :
                          getApprovalStatusLabel(approval.status) === '审批中' ? 'bg-blue-100 text-blue-800' :
                          getApprovalStatusLabel(approval.status) === '已批准' ? 'bg-green-100 text-green-800' :
                          'bg-red-100 text-red-800'
                        }`}>
                          {getApprovalStatusLabel(approval.status)}
                        </span>
                        <span className={`px-2 py-0.5 text-xs font-medium rounded ${
                          approval.urgency === '紧急' ? 'bg-red-100 text-red-800' :
                          'bg-blue-50 text-gray-800'
                        }`}>
                          {approval.urgency}
                        </span>
                        <span className="px-2 py-0.5 text-xs font-medium bg-purple-100 text-purple-800 rounded">
                          {approval.type || approval.processType || '-'}
                        </span>
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm text-gray-500">
                        <div>
                          <span className="text-gray-400">申请编号:</span> {approval.processNo || approval.id}
                        </div>
                        <div>
                          <span className="text-gray-400">申请人:</span> {approval.applicant}
                        </div>
                        <div>
                          <span className="text-gray-400">部门:</span> {approval.department}
                        </div>
                        <div>
                          <span className="text-gray-400">金额:</span> {approval.amount}
                        </div>
                        <div>
                          <span className="text-gray-400">提交时间:</span> {approval.submitDate || approval.applyTime || approval.createTime || '-'}
                        </div>
                        {approval.currentApprover && (
                          <div>
                            <span className="text-gray-400">当前审批人:</span> {approval.currentApprover}
                          </div>
                        )}
                        {approval.completeDate && (
                          <div>
                            <span className="text-gray-400">完成时间:</span> {approval.completeDate}
                          </div>
                        )}
                      </div>
                      {approval.details && (
                        <p className="text-sm text-gray-500 mt-2">{approval.details}</p>
                      )}
                    </div>
                    <div className="flex gap-2 ml-4">
                      {getApprovalStatusLabel(approval.status) === '待审批' && (
                        <>
                           <button onClick={() => handleApprove(approval.id, true)} className="px-4 py-2 text-sm font-medium text-white bg-green-600 hover:bg-green-700 rounded-lg transition-colors">
                             批准
                           </button>
                           <button onClick={() => handleApprove(approval.id, false)} className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors">
                             驳回
                           </button>
                        </>
                      )}
                      <button onClick={() => setDetailItem(approval)} className="px-4 py-2 text-sm font-medium text-blue-700 bg-blue-100 hover:bg-blue-200 rounded-lg transition-colors">
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
                                <span className="text-xs text-gray-400">{history.time}</span>
                              </div>
                              {history.comment && (
                                <p className="text-gray-500 mt-1">{history.comment}</p>
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
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase">工单编号</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase">类型</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase">设备</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase">报修人</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase">优先级</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase">指派给</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase">状态</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase">创建时间</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase">操作</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#1e3a5f]">
                  {workOrders.map((order) => (
                    <tr key={order.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 text-sm font-medium text-blue-600">{order.workOrderNo || order.id}</td>
                      <td className="px-6 py-4 text-sm text-gray-900">{order.title || order.type || '-'}</td>
                      <td className="px-6 py-4 text-sm text-gray-900">{order.assetName || order.equipment || '-'}</td>
                      <td className="px-6 py-4 text-sm text-gray-500">{order.reporterName || order.reporter || '-'}</td>
                      <td className="px-6 py-4">
                        <span className={`px-2 py-1 text-xs font-medium rounded ${
                          getPriorityLabel(order.priority) === '高' || getPriorityLabel(order.priority) === '紧急' ? 'bg-red-100 text-red-800' :
                          getPriorityLabel(order.priority) === '中' ? 'bg-yellow-100 text-yellow-800' :
                          'bg-blue-50 text-gray-800'
                        }`}>
                          {getPriorityLabel(order.priority)}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500">{order.assigneeName || order.assignee || '-'}</td>
                      <td className="px-6 py-4">
                        <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                          order.status === 'EXECUTING' || order.status === '处理中' ? 'bg-blue-100 text-blue-800' :
                          order.status === 'APPROVED' || order.status === '待派工' ? 'bg-yellow-100 text-yellow-800' :
                          'bg-green-100 text-green-800'
                        }`}>
                          {getWorkOrderStatusLabel(order.status)}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500">{order.createTime || '-'}</td>
                      <td className="px-6 py-4 text-sm">
                        <div className="flex gap-2">
                          {order.status === 'DRAFT' && (
                            <button onClick={() => handleWorkOrderOperation(order, 'submit')} className="px-3 py-1 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 rounded transition-colors">
                              提交
                            </button>
                          )}
                          {order.status === 'APPROVED' && (
                            <button onClick={() => handleWorkOrderOperation(order, 'start')} className="px-3 py-1 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 rounded transition-colors">
                              开始执行
                            </button>
                          )}
                          {order.status === 'EXECUTING' && (
                            <button onClick={() => handleWorkOrderOperation(order, 'complete')} className="px-3 py-1 text-xs font-medium text-white bg-green-600 hover:bg-green-700 rounded transition-colors">
                              完成
                            </button>
                          )}
                          <button onClick={() => setDetailItem(order)} className="px-3 py-1 text-xs font-medium text-blue-700 bg-blue-100 hover:bg-blue-200 rounded transition-colors">
                            详情
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {workOrders.length === 0 && <div className="px-6 py-8 text-sm text-gray-400">暂无工单数据</div>}
            </div>
          </div>
        )}
      </div>

      {/* 详情弹窗 */}
      {detailItem && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setDetailItem(null)}>
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[80vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">详情</h3>
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
