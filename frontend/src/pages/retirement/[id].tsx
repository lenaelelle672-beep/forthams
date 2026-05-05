/**
 * 资产报废退役流程 - 详情页
 * 
 * 核心业务流入口
 * 
 * 功能说明：
 * - 获取并展示报废请求详情
 * - 提交报废申请
 * - 执行多级审批（L1/L2/L3）
 * - 拒绝/驳回申请
 * - 查看审批历史记录
 * 
 * @module retirement/[id].tsx
 */

import React, { useEffect, useState, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { 
  ArrowLeft, 
  Clock, 
  CheckCircle, 
  XCircle, 
  AlertTriangle,
  FileText,
  User,
  Building2,
  Calendar
} from 'lucide-react';

/**
 * 报废请求状态枚举
 */
export enum RetirementStatus {
  DRAFT = 'DRAFT',
  PENDING_APPROVAL = 'PENDING_APPROVAL',
  LEVEL_1_APPROVAL = 'LEVEL_1_APPROVAL',
  LEVEL_2_APPROVAL = 'LEVEL_2_APPROVAL',
  LEVEL_3_APPROVAL = 'LEVEL_3_APPROVAL',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED'
}

/**
 * 审批动作枚举
 */
export type ApprovalAction = 
  | 'SUBMIT'
  | 'APPROVE_L1'
  | 'APPROVE_L2'
  | 'APPROVE_L3'
  | 'REJECT'
  | 'RESUBMIT'
  | 'CANCEL';

/**
 * 资产报废请求数据模型
 */
export interface RetirementRequest {
  id: string;
  assetId: string;
  assetName: string;
  assetCode: string;
  status: RetirementStatus;
  currentLevel: number | null;
  totalLevels: number;
  reason: string;
  estimatedSalvageValue: number;
  disposalMethod: 'SCRAPPED' | 'TRANSFERRED' | 'RECYCLED' | 'OTHER';
  description: string;
  attachments: Attachment[];
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  submittedAt: string | null;
  completedAt: string | null;
  metadata: Record<string, unknown>;
}

/**
 * 附件数据模型
 */
export interface Attachment {
  id: string;
  name: string;
  url: string;
  type: string;
  size: number;
  uploadedAt: string;
}

/**
 * 审批历史记录项
 */
export interface ApprovalHistoryItem {
  id: string;
  action: ApprovalAction;
  operator: string;
  operatorName: string;
  operatorDept: string;
  timestamp: string;
  comment: string | null;
  level: number | null;
  previousStatus: RetirementStatus;
  newStatus: RetirementStatus;
}

/**
 * 进度追踪响应
 */
export interface ProgressResponse {
  requestId: string;
  currentStatus: RetirementStatus;
  currentLevel: number | null;
  totalLevels: number;
  pendingApprovers: PendingApprover[];
  completedLevels: CompletedLevel[];
  isFinalApproval: boolean;
}

/**
 * 待审批人信息
 */
export interface PendingApprover {
  level: number;
  approverId: string;
  approverName: string;
  dueDate: string | null;
}

/**
 * 已完成审批级别
 */
export interface CompletedLevel {
  level: number;
  approverId: string;
  approverName: string;
  approvedAt: string;
  comment: string | null;
}

/**
 * API 错误响应
 */
export interface ApiError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
}

/**
 * 错误代码映射
 */
export const ERROR_CODES: Record<string, { code: string; message: string }> = {
  RET_NOT_FOUND: { code: 'RET_NOT_FOUND', message: '报废请求不存在' },
  INVALID_TRANSITION: { code: 'INVALID_TRANSITION', message: '无效的状态转换' },
  UNAUTHORIZED: { code: 'UNAUTHORIZED', message: '无权限操作' },
  VERSION_CONFLICT: { code: 'VERSION_CONFLICT', message: '数据版本冲突，请刷新后重试' },
  ASSET_NOT_RETIRABLE: { code: 'ASSET_NOT_RETIRABLE', message: '资产当前状态不允许报废' },
};

/**
 * 状态显示配置
 */
export const STATUS_CONFIG: Record<RetirementStatus, { label: string; color: string; icon: React.ReactNode }> = {
  [RetirementStatus.DRAFT]: { label: '草稿', color: 'gray', icon: <FileText className="w-4 h-4" /> },
  [RetirementStatus.PENDING_APPROVAL]: { label: '待提交', color: 'blue', icon: <Clock className="w-4 h-4" /> },
  [RetirementStatus.LEVEL_1_APPROVAL]: { label: '一级审批中', color: 'yellow', icon: <Clock className="w-4 h-4" /> },
  [RetirementStatus.LEVEL_2_APPROVAL]: { label: '二级审批中', color: 'yellow', icon: <Clock className="w-4 h-4" /> },
  [RetirementStatus.LEVEL_3_APPROVAL]: { label: '三级审批中', color: 'yellow', icon: <Clock className="w-4 h-4" /> },
  [RetirementStatus.APPROVED]: { label: '已审批通过', color: 'green', icon: <CheckCircle className="w-4 h-4" /> },
  [RetirementStatus.REJECTED]: { label: '已驳回', color: 'red', icon: <XCircle className="w-4 h-4" /> },
  [RetirementStatus.COMPLETED]: { label: '已完成', color: 'green', icon: <CheckCircle className="w-4 h-4" /> },
  [RetirementStatus.CANCELLED]: { label: '已取消', color: 'gray', icon: <XCircle className="w-4 h-4" /> },
};

/**
 * 获取报废请求详情
 * 
 * @param id - 报废请求ID
 * @returns Promise<RetirementRequest>
 * @throws Error 当请求失败时抛出错误
 */
async function fetchRetirementDetail(id: string): Promise<RetirementRequest> {
  const response = await fetch(`/api/retirements/${id}`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json'
    }
  });

  if (!response.ok) {
    const error: ApiError = await response.json();
    throw new Error(ERROR_CODES[error.code]?.message || '获取详情失败');
  }

  return response.json();
}

/**
 * 内部函数：执行状态转换
 * 
 * @param id - 报废请求ID
 * @param action - 审批动作
 * @param comment - 审批意见（可选）
 * @returns Promise<RetirementRequest>
 * @throws Error 当状态转换失败时抛出错误
 */
async function transitionStatus(
  id: string, 
  action: ApprovalAction, 
  comment?: string
): Promise<RetirementRequest> {
  const payload: { action: ApprovalAction; comment?: string } = { action };
  
  if (comment) {
    payload.comment = comment;
  }

  const response = await fetch(`/api/retirements/${id}/transition`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const error: ApiError = await response.json();
    throw new Error(ERROR_CODES[error.code]?.message || '操作失败');
  }

  return response.json();
}

/**
 * 提交报废请求
 * 
 * 将报废请求从草稿状态提交，进入审批流程
 * 
 * @param id - 报废请求ID
 * @returns Promise<RetirementRequest>
 * @throws Error 当提交失败时抛出错误
 */
async function submitRetirement(id: string): Promise<RetirementRequest> {
  return transitionStatus(id, 'SUBMIT');
}

/**
 * 执行审批操作
 * 
 * 根据审批级别执行通过操作
 * 
 * @param id - 报废请求ID
 * @param level - 审批级别（1、2、3）
 * @param comment - 审批意见（可选）
 * @returns Promise<RetirementRequest>
 * @throws Error 当审批失败时抛出错误
 */
async function approveRetirement(
  id: string,
  level: 1 | 2 | 3,
  comment?: string
): Promise<RetirementRequest> {
  const actionMap: Record<1 | 2 | 3, ApprovalAction> = {
    1: 'APPROVE_L1',
    2: 'APPROVE_L2',
    3: 'APPROVE_L3'
  };
  return transitionStatus(id, actionMap[level], comment);
}

/**
 * 拒绝报废请求
 * 
 * 审批人驳回报废申请，申请人需要修改后重新提交
 * 
 * @param id - 报废请求ID
 * @param reason - 拒绝原因
 * @returns Promise<RetirementRequest>
 * @throws Error 当拒绝失败时抛出错误
 */
async function rejectRetirement(
  id: string,
  reason: string
): Promise<RetirementRequest> {
  return transitionStatus(id, 'REJECT', reason);
}

/**
 * 获取进度追踪信息
 * 
 * 获取报废请求的当前审批进度和待审批人信息
 * 
 * @param id - 报废请求ID
 * @returns Promise<ProgressResponse>
 * @throws Error 当获取失败时抛出错误
 */
async function fetchProgress(id: string): Promise<ProgressResponse> {
  const response = await fetch(`/api/retirements/${id}/progress`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json'
    }
  });

  if (!response.ok) {
    const error: ApiError = await response.json();
    throw new Error(ERROR_CODES[error.code]?.message || '获取进度失败');
  }

  return response.json();
}

/**
 * 获取审批历史记录
 * 
 * 获取报废申请的全链路操作历史
 * 
 * @param id - 报废请求ID
 * @returns Promise<ApprovalHistoryItem[]>
 * @throws Error 当获取失败时抛出错误
 */
async function fetchApprovalHistory(id: string): Promise<ApprovalHistoryItem[]> {
  const response = await fetch(`/api/retirements/${id}/history`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json'
    }
  });

  if (!response.ok) {
    const error: ApiError = await response.json();
    throw new Error(ERROR_CODES[error.code]?.message || '获取历史记录失败');
  }

  return response.json();
}

/**
 * 格式化日期时间
 * 
 * @param dateString - ISO 格式日期字符串
 * @returns 格式化后的日期字符串
 */
function formatDateTime(dateString: string | null): string {
  if (!dateString) return '-';
  const date = new Date(dateString);
  return date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  });
}

/**
 * 格式化货币
 * 
 * @param value - 金额数值
 * @returns 格式化后的货币字符串
 */
function formatCurrency(value: number): string {
  return new Intl.NumberFormat('zh-CN', {
    style: 'currency',
    currency: 'CNY'
  }).format(value);
}

/**
 * 获取处置方式标签
 * 
 * @param method - 处置方式代码
 * @returns 处置方式中文标签
 */
function getDisposalMethodLabel(method: string): string {
  const labels: Record<string, string> = {
    'SCRAPPED': '报废处理',
    'TRANSFERRED': '转让处理',
    'RECYCLED': '回收处理',
    'OTHER': '其他方式'
  };
  return labels[method] || method;
}

/**
 * 资产报废详情页主组件
 * 
 * @returns React.ReactElement
 */
export function RetirementDetailPage(): React.ReactElement {
  const { id } = useParams<{ id: string }>();
  const [retirement, setRetirement] = useState<RetirementRequest | null>(null);
  const [progress, setProgress] = useState<ProgressResponse | null>(null);
  const [history, setHistory] = useState<ApprovalHistoryItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'detail' | 'progress' | 'history'>('detail');

  /**
   * 加载数据
   */
  const loadData = useCallback(async () => {
    if (!id) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const [detailData, progressData, historyData] = await Promise.all([
        fetchRetirementDetail(id),
        fetchProgress(id),
        fetchApprovalHistory(id)
      ]);
      
      setRetirement(detailData);
      setProgress(progressData);
      setHistory(historyData);
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载数据失败');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  /**
   * 处理提交
   */
  const handleSubmit = async () => {
    if (!id) return;
    
    try {
      const updated = await submitRetirement(id);
      setRetirement(updated);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : '提交失败');
    }
  };

  /**
   * 处理审批通过
   */
  const handleApprove = async (level: 1 | 2 | 3, comment?: string) => {
    if (!id) return;
    
    try {
      const updated = await approveRetirement(id, level, comment);
      setRetirement(updated);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : '审批失败');
    }
  };

  /**
   * 处理拒绝
   */
  const handleReject = async (reason: string) => {
    if (!id) return;
    
    try {
      const updated = await rejectRetirement(id, reason);
      setRetirement(updated);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : '拒绝失败');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">加载中...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <AlertTriangle className="w-12 h-12 text-red-500 mx-auto" />
          <p className="mt-4 text-red-600">{error}</p>
          <button 
            onClick={loadData}
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            重试
          </button>
        </div>
      </div>
    );
  }

  if (!retirement) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <FileText className="w-12 h-12 text-gray-400 mx-auto" />
          <p className="mt-4 text-gray-600">报废请求不存在</p>
        </div>
      </div>
    );
  }

  const statusConfig = STATUS_CONFIG[retirement.status];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 头部 */}
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <button 
                onClick={() => window.history.back()}
                className="mr-4 p-2 hover:bg-gray-100 rounded"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">
                  资产报废详情
                </h1>
                <p className="text-sm text-gray-500">
                  报废单号：{retirement.id}
                </p>
              </div>
            </div>
            <div className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium
              ${retirement.status === RetirementStatus.COMPLETED ? 'bg-green-100 text-green-800' :
                retirement.status === RetirementStatus.REJECTED ? 'bg-red-100 text-red-800' :
                retirement.status.includes('APPROVAL') ? 'bg-yellow-100 text-yellow-800' :
                'bg-gray-100 text-gray-800'}`}>
              {statusConfig.icon}
              <span className="ml-2">{statusConfig.label}</span>
            </div>
          </div>
        </div>
      </header>

      {/* 主内容 */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* 标签页 */}
        <div className="border-b border-gray-200 mb-6">
          <nav className="-mb-px flex space-x-8">
            {(['detail', 'progress', 'history'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors
                  ${activeTab === tab
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
              >
                {tab === 'detail' ? '详情信息' : tab === 'progress' ? '审批进度' : '操作历史'}
              </button>
            ))}
          </nav>
        </div>

        {/* 详情页 */}
        {activeTab === 'detail' && (
          <div className="bg-white shadow rounded-lg overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-lg font-medium text-gray-900">资产信息</h2>
            </div>
            <div className="p-6">
              <dl className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-6">
                <div>
                  <dt className="text-sm font-medium text-gray-500">资产编号</dt>
                  <dd className="mt-1 text-sm text-gray-900">{retirement.assetCode}</dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-gray-500">资产名称</dt>
                  <dd className="mt-1 text-sm text-gray-900">{retirement.assetName}</dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-gray-500">报废原因</dt>
                  <dd className="mt-1 text-sm text-gray-900">{retirement.reason}</dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-gray-500">处置方式</dt>
                  <dd className="mt-1 text-sm text-gray-900">{getDisposalMethodLabel(retirement.disposalMethod)}</dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-gray-500">预估残值</dt>
                  <dd className="mt-1 text-sm text-gray-900">{formatCurrency(retirement.estimatedSalvageValue)}</dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-gray-500">申请时间</dt>
                  <dd className="mt-1 text-sm text-gray-900 flex items-center">
                    <Calendar className="w-4 h-4 mr-1" />
                    {formatDateTime(retirement.createdAt)}
                  </dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-gray-500">申请人</dt>
                  <dd className="mt-1 text-sm text-gray-900 flex items-center">
                    <User className="w-4 h-4 mr-1" />
                    {retirement.createdBy}
                  </dd>
                </div>
                {retirement.description && (
                  <div className="col-span-2">
                    <dt className="text-sm font-medium text-gray-500">详细说明</dt>
                    <dd className="mt-1 text-sm text-gray-900">{retirement.description}</dd>
                  </div>
                )}
              </dl>
            </div>
          </div>
        )}

        {/* 进度页 */}
        {activeTab === 'progress' && progress && (
          <div className="bg-white shadow rounded-lg overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-lg font-medium text-gray-900">审批进度</h2>
            </div>
            <div className="p-6">
              {/* 进度步骤 */}
              <div className="flex items-center justify-between mb-8">
                {Array.from({ length: progress.totalLevels }, (_, i) => {
                  const level = i + 1;
                  const completedLevel = progress.completedLevels.find(l => l.level === level);
                  const pendingApprover = progress.pendingApprovers.find(p => p.level === level);
                  const isActive = progress.currentLevel === level;
                  
                  return (
                    <div key={level} className="flex-1 flex flex-col items-center">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center
                        ${completedLevel ? 'bg-green-500 text-white' :
                          isActive ? 'bg-yellow-500 text-white' :
                          'bg-gray-200 text-gray-500'}`}>
                        {completedLevel ? (
                          <CheckCircle className="w-6 h-6" />
                        ) : (
                          <span>{level}</span>
                        )}
                      </div>
                      <p className="mt-2 text-sm font-medium text-gray-900">
                        {level === 1 ? '一级审批' : level === 2 ? '二级审批' : '三级审批'}
                      </p>
                      {completedLevel && (
                        <p className="mt-1 text-xs text-gray-500">
                          {completedLevel.approverName}
                        </p>
                      )}
                      {pendingApprover && (
                        <p className="mt-1 text-xs text-yellow-600">
                          待{pendingApprover.approverName}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* 待审批人信息 */}
              {progress.pendingApprovers.length > 0 && (
                <div className="mt-6">
                  <h3 className="text-sm font-medium text-gray-900 mb-2">待审批人</h3>
                  <ul className="divide-y divide-gray-200">
                    {progress.pendingApprovers.map((approver) => (
                      <li key={approver.level} className="py-3 flex items-center justify-between">
                        <div className="flex items-center">
                          <User className="w-5 h-5 text-gray-400 mr-2" />
                          <span className="text-sm text-gray-900">
                            第{approver.level}级审批 - {approver.approverName}
                          </span>
                        </div>
                        {approver.dueDate && (
                          <span className="text-xs text-gray-500">
                            截止：{formatDateTime(approver.dueDate)}
                          </span>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* 已完成审批 */}
              {progress.completedLevels.length > 0 && (
                <div className="mt-6">
                  <h3 className="text-sm font-medium text-gray-900 mb-2">已完成审批</h3>
                  <ul className="divide-y divide-gray-200">
                    {progress.completedLevels.map((level) => (
                      <li key={level.level} className="py-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center">
                            <CheckCircle className="w-5 h-5 text-green-500 mr-2" />
                            <span className="text-sm text-gray-900">
                              第{level.level}级审批 - {level.approverName}
                            </span>
                          </div>
                          <span className="text-xs text-gray-500">
                            {formatDateTime(level.approvedAt)}
                          </span>
                        </div>
                        {level.comment && (
                          <p className="mt-1 text-sm text-gray-600 ml-7">{level.comment}</p>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        )}

        {/* 历史页 */}
        {activeTab === 'history' && (
          <div className="bg-white shadow rounded-lg overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-lg font-medium text-gray-900">操作历史</h2>
            </div>
            <div className="p-6">
              {history.length === 0 ? (
                <p className="text-center text-gray-500 py-8">暂无操作记录</p>
              ) : (
                <ul className="space-y-4">
                  {history.map((item) => (
                    <li key={item.id} className="border-l-2 border-gray-200 pl-4 pb-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center">
                          <span className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium
                            ${item.action === 'SUBMIT' ? 'bg-blue-100 text-blue-800' :
                              item.action.includes('APPROVE') ? 'bg-green-100 text-green-800' :
                              item.action === 'REJECT' ? 'bg-red-100 text-red-800' :
                              'bg-gray-100 text-gray-800'}`}>
                            {item.action === 'SUBMIT' ? '提交' :
                             item.action.includes('APPROVE') ? `审批通过(L${item.level})` :
                             item.action === 'REJECT' ? '驳回' :
                             item.action}
                          </span>
                          <span className="ml-2 text-sm text-gray-900">{item.operatorName}</span>
                        </div>
                        <span className="text-xs text-gray-500">{formatDateTime(item.timestamp)}</span>
                      </div>
                      {item.operatorDept && (
                        <p className="mt-1 text-xs text-gray-500 flex items-center">
                          <Building2 className="w-3 h-3 mr-1" />
                          {item.operatorDept}
                        </p>
                      )}
                      {item.comment && (
                        <p className="mt-2 text-sm text-gray-600">{item.comment}</p>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}

        {/* 操作按钮 */}
        <div className="mt-6 flex justify-end space-x-4">
          {retirement.status === RetirementStatus.DRAFT && (
            <button
              onClick={handleSubmit}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              提交申请
            </button>
          )}
          {retirement.status.includes('APPROVAL') && progress?.currentLevel && (
            <>
              <button
                onClick={() => handleApprove(progress.currentLevel as 1 | 2 | 3)}
                className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
              >
                审批通过
              </button>
              <button
                onClick={() => {
                  const reason = prompt('请输入驳回原因：');
                  if (reason) handleReject(reason);
                }}
                className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
              >
                驳回
              </button>
            </>
          )}
        </div>
      </main>
    </div>
  );
}

export default RetirementDetailPage;