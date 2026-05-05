/**
 * WorkOrderDetailView.tsx
 * 
 * 工单详情视图组件
 * 用于展示工单详情、审批进度时间轴、以及审批操作按钮
 * 
 * @module WorkOrder
 * @version SWARM-WO-001
 * 
 * 功能描述:
 * - 工单详情展示（标题、描述、状态、创建人、审批人）
 * - 审批进度时间轴显示（展示状态流转历史）
 * - 审批操作（通过/拒绝按钮 + 审批意见输入）
 * - 通知状态显示
 * 
 * @description 基于规格文档 SWARM-WO-001 实现
 * 
 * 状态流转:
 * - DRAFT → PENDING_APPROVAL (提交)
 * - PENDING_APPROVAL → APPROVED (审批通过)
 * - PENDING_APPROVAL → REJECTED (审批拒绝)
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Textarea } from '@/components/ui/Textarea';
import { Toast } from '@/components/ui/Toast';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { Timeline } from '@/components/ui/Timeline';
import { Avatar } from '@/components/ui/Avatar';
import { workOrderApi } from '@/api/workorder';
import { useWorkOrderPermission } from '@/composables/useWorkOrderPermission';
import type { WorkOrder, WorkOrderStatus, StatusHistoryItem } from '@/types/workorder.types';

// ============================================================================
// 类型定义
// ============================================================================

/** 审批操作类型 */
export type ApprovalAction = 'APPROVE' | 'REJECT';

/** 审批操作结果 */
export interface ApprovalResult {
  success: boolean;
  message: string;
  newStatus?: WorkOrderStatus;
}

/** 审批操作参数 */
export interface ApprovalParams {
  workOrderId: string;
  action: ApprovalAction;
  comment?: string;
}

/** 时间轴节点状态 */
export type TimelineNodeStatus = 'completed' | 'current' | 'pending';

// ============================================================================
// 常量定义
// ============================================================================

/** 工单状态映射（中文显示） */
const STATUS_LABELS: Record<WorkOrderStatus, string> = {
  'DRAFT': '草稿',
  'PENDING_APPROVAL': '待审批',
  'APPROVED': '已通过',
  'REJECTED': '已拒绝',
};

/** 状态对应的颜色样式 */
const STATUS_STYLES: Record<WorkOrderStatus, { bg: string; text: string; border: string }> = {
  'DRAFT': { bg: 'bg-gray-100', text: 'text-gray-700', border: 'border-gray-300' },
  'PENDING_APPROVAL': { bg: 'bg-yellow-100', text: 'text-yellow-700', border: 'border-yellow-400' },
  'APPROVED': { bg: 'bg-green-100', text: 'text-green-700', border: 'border-green-400' },
  'REJECTED': { bg: 'bg-red-100', text: 'text-red-700', border: 'border-red-400' },
};

/** 时间轴节点映射 */
const TIMELINE_NODES: { status: WorkOrderStatus; label: string; icon: string }[] = [
  { status: 'DRAFT', label: '创建工单', icon: '📝' },
  { status: 'PENDING_APPROVAL', label: '提交审批', icon: '📤' },
  { status: 'APPROVED', label: '审批通过', icon: '✅' },
];

// ============================================================================
// 组件接口
// ============================================================================

export interface WorkOrderDetailViewProps {
  /** 工单ID（可选，默认从路由参数获取） */
  workOrderId?: string;
  /** 是否显示审批操作按钮 */
  showApprovalActions?: boolean;
  /** 审批通过回调 */
  onApprove?: (workOrderId: string, comment: string) => Promise<void>;
  /** 审批拒绝回调 */
  onReject?: (workOrderId: string, comment: string) => Promise<void>;
}

// ============================================================================
// 主组件
// ============================================================================

/**
 * WorkOrderDetailView - 工单详情视图组件
 * 
 * @description 
 * 展示工单详情信息，包括：
 * - 基本信息（标题、描述、创建时间）
 * - 审批人信息
 * - 状态流转时间轴
 * - 审批操作面板（通过/拒绝）
 * 
 * @param {WorkOrderDetailViewProps} props - 组件属性
 * @returns {JSX.Element} 工单详情视图
 * 
 * @example
 * ```tsx
 * <WorkOrderDetailView 
 *   workOrderId="wo-123"
 *   showApprovalActions={true}
 *   onApprove={handleApprove}
 *   onReject={handleReject}
 * />
 * ```
 */
export const WorkOrderDetailView: React.FC<WorkOrderDetailViewProps> = ({
  workOrderId: propWorkOrderId,
  showApprovalActions = true,
  onApprove,
  onReject,
}) => {
  // ============================================================================
  // 状态定义
  // ============================================================================
  
  /** 工单数据 */
  const [workOrder, setWorkOrder] = useState<WorkOrder | null>(null);
  
  /** 状态流转历史 */
  const [statusHistory, setStatusHistory] = useState<StatusHistoryItem[]>([]);
  
  /** 加载状态 */
  const [isLoading, setIsLoading] = useState(true);
  
  /** 错误信息 */
  const [error, setError] = useState<string | null>(null);
  
  /** 审批意见 */
  const [approvalComment, setApprovalComment] = useState('');
  
  /** 提交中状态 */
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  /** Toast 显示状态 */
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'warning' } | null>(null);
  
  /** 是否显示审批意见输入框 */
  const [showCommentInput, setShowCommentInput] = useState(false);
  
  /** 当前选择的审批操作 */
  const [currentAction, setCurrentAction] = useState<ApprovalAction | null>(null);

  // ============================================================================
  // 路由与权限
  // ============================================================================
  
  const params = useParams();
  const navigate = useNavigate();
  const resolvedWorkOrderId = propWorkOrderId || params.workOrderId || '';
  
  /** 权限检查 */
  const { 
    canApprove, 
    canView, 
    isCreator 
  } = useWorkOrderPermission(resolvedWorkOrderId);

  // ============================================================================
  // 数据加载
  // ============================================================================
  
  /**
   * 加载工单详情数据
   * 
   * @description 
   * 调用 workOrderApi 获取工单详情及状态流转历史
   */
  const loadWorkOrderDetail = useCallback(async () => {
    if (!resolvedWorkOrderId) {
      setError('工单ID无效');
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      setError(null);
      
      const response = await workOrderApi.getWorkOrderDetail(resolvedWorkOrderId);
      
      setWorkOrder(response.workOrder);
      setStatusHistory(response.statusHistory || []);
      
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '加载工单详情失败';
      setError(errorMessage);
      showToast(errorMessage, 'error');
    } finally {
      setIsLoading(false);
    }
  }, [resolvedWorkOrderId]);

  // 初始化加载
  useEffect(() => {
    loadWorkOrderDetail();
  }, [loadWorkOrderDetail]);

  // ============================================================================
  // 审批操作处理
  // ============================================================================
  
  /**
   * 处理审批操作点击
   * 
   * @param {ApprovalAction} action - 审批操作类型
   * 
   * @description
   * 用户点击通过/拒绝按钮时调用，显示审批意见输入框
   */
  const handleApprovalActionClick = (action: ApprovalAction) => {
    if (!canApprove) {
      showToast('您没有审批权限', 'warning');
      return;
    }
    
    setCurrentAction(action);
    setShowCommentInput(true);
    setApprovalComment('');
  };

  /**
   * 取消审批操作
   */
  const handleCancelApproval = () => {
    setShowCommentInput(false);
    setCurrentAction(null);
    setApprovalComment('');
  };

  /**
   * 提交审批操作
   * 
   * @description
   * 执行审批通过或拒绝操作：
   * - 调用对应的回调函数
   * - 处理成功/失败结果
   * - 更新本地状态
   */
  const handleSubmitApproval = async () => {
    if (!workOrder || !currentAction) {
      return;
    }

    // 验证审批意见长度
    if (approvalComment.length > 1000) {
      showToast('审批意见不能超过1000字符', 'warning');
      return;
    }

    try {
      setIsSubmitting(true);
      
      if (currentAction === 'APPROVE') {
        if (onApprove) {
          await onApprove(workOrder.id, approvalComment);
        } else {
          await handleApproveWorkOrder(workOrder.id, approvalComment);
        }
      } else {
        if (onReject) {
          await onReject(workOrder.id, approvalComment);
        } else {
          await handleRejectWorkOrder(workOrder.id, approvalComment);
        }
      }
      
      showToast(currentAction === 'APPROVE' ? '审批通过' : '审批已拒绝', 'success');
      
      // 重新加载工单详情
      await loadWorkOrderDetail();
      
      // 重置状态
      setShowCommentInput(false);
      setCurrentAction(null);
      setApprovalComment('');
      
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '审批操作失败';
      showToast(errorMessage, 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  /**
   * 内部审批通过处理
   * 
   * @param {string} woId - 工单ID
   * @param {string} comment - 审批意见
   */
  const handleApproveWorkOrder = async (woId: string, comment: string): Promise<void> => {
    const result = await workOrderApi.approve(woId, comment);
    if (!result.success) {
      throw new Error(result.message || '审批通过失败');
    }
  };

  /**
   * 内部审批拒绝处理
   * 
   * @param {string} woId - 工单ID
   * @param {string} comment - 审批意见
   */
  const handleRejectWorkOrder = async (woId: string, comment: string): Promise<void> => {
    const result = await workOrderApi.reject(woId, comment);
    if (!result.success) {
      throw new Error(result.message || '审批拒绝失败');
    }
  };

  // ============================================================================
  // 辅助函数
  // ============================================================================
  
  /**
   * 显示 Toast 消息
   * 
   * @param {string} message - 消息内容
   * @param {'success' | 'error' | 'warning'} type - 消息类型
   */
  const showToast = (message: string, type: 'success' | 'error' | 'warning') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  /**
   * 计算时间轴节点状态
   * 
   * @param {WorkOrderStatus} status - 节点状态
   * @returns {TimelineNodeStatus} 时间轴节点状态
   * 
   * @description
   * 根据当前工单状态计算时间轴中各节点的状态：
   * - completed: 已完成的状态
   * - current: 当前状态
   * - pending: 待处理状态
   */
  const getTimelineNodeStatus = (status: WorkOrderStatus): TimelineNodeStatus => {
    if (!workOrder) return 'pending';
    
    const statusOrder: WorkOrderStatus[] = ['DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'REJECTED'];
    const currentIndex = statusOrder.indexOf(workOrder.status);
    const nodeIndex = statusOrder.indexOf(status);
    
    if (workOrder.status === 'REJECTED' && status === 'REJECTED') {
      return 'current';
    }
    
    if (nodeIndex < currentIndex) {
      return 'completed';
    } else if (nodeIndex === currentIndex) {
      return 'current';
    }
    return 'pending';
  };

  /**
   * 格式化日期时间
   * 
   * @param {string} dateString - ISO 日期字符串
   * @returns {string} 格式化后的日期时间字符串
   */
  const formatDateTime = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  /**
   * 获取状态样式
   * 
   * @param {WorkOrderStatus} status - 工单状态
   * @returns {object} 样式对象
   */
  const getStatusStyle = (status: WorkOrderStatus) => {
    return STATUS_STYLES[status] || STATUS_STYLES['DRAFT'];
  };

  // ============================================================================
  // 渲染逻辑
  // ============================================================================
  
  /** 渲染加载状态 */
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <LoadingSpinner size="large" />
      </div>
    );
  }

  /** 渲染错误状态 */
  if (error || !workOrder) {
    return (
      <Card className="p-6">
        <div className="text-center text-red-600">
          <p className="text-lg mb-4">{error || '工单不存在'}</p>
          <Button variant="secondary" onClick={() => navigate('/workorder/list')}>
            返回工单列表
          </Button>
        </div>
      </Card>
    );
  }

  return (
    <div className="work-order-detail-view max-w-4xl mx-auto p-4">
      {/* 工单基本信息卡片 */}
      <Card className="mb-6">
        <div className="p-6">
          {/* 标题与状态 */}
          <div className="flex items-start justify-between mb-4">
            <h1 className="text-2xl font-semibold text-gray-900">
              {workOrder.title}
            </h1>
            <Badge 
              className={`${getStatusStyle(workOrder.status).bg} ${getStatusStyle(workOrder.status).text}`}
            >
              {STATUS_LABELS[workOrder.status]}
            </Badge>
          </div>

          {/* 描述 */}
          <div className="mb-6">
            <h3 className="text-sm font-medium text-gray-500 mb-2">工单描述</h3>
            <p className="text-gray-700 whitespace-pre-wrap">
              {workOrder.description || '暂无描述'}
            </p>
          </div>

          {/* 元信息 */}
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-gray-500">创建人：</span>
              <span className="text-gray-900">{workOrder.creatorName || '未知'}</span>
            </div>
            <div>
              <span className="text-gray-500">创建时间：</span>
              <span className="text-gray-900">{formatDateTime(workOrder.createdAt)}</span>
            </div>
            <div>
              <span className="text-gray-500">当前审批人：</span>
              <span className="text-gray-900">{workOrder.approverName || '未指定'}</span>
            </div>
            <div>
              <span className="text-gray-500">工单ID：</span>
              <span className="text-gray-900 font-mono text-xs">{workOrder.id}</span>
            </div>
          </div>
        </div>
      </Card>

      {/* 审批进度时间轴 */}
      <Card className="mb-6">
        <div className="p-6">
          <h2 className="text-lg font-medium text-gray-900 mb-4">审批进度</h2>
          
          <Timeline>
            {TIMELINE_NODES.map((node, index) => {
              const nodeStatus = getTimelineNodeStatus(node.status);
              const historyItem = statusHistory.find(h => h.toStatus === node.status);
              
              return (
                <Timeline.Item
                  key={node.status}
                  status={nodeStatus}
                  icon={node.icon}
                  title={node.label}
                  description={historyItem ? `${historyItem.operatorName} · ${formatDateTime(historyItem.timestamp)}` : undefined}
                >
                  {historyItem?.comment && (
                    <p className="text-sm text-gray-600 mt-1">
                      意见：{historyItem.comment}
                    </p>
                  )}
                </Timeline.Item>
              );
            })}
            
            {/* 拒绝状态单独显示 */}
            {workOrder.status === 'REJECTED' && (
              <Timeline.Item
                status="current"
                icon="❌"
                title="审批拒绝"
                description={statusHistory.find(h => h.toStatus === 'REJECTED') ? 
                  `${statusHistory.find(h => h.toStatus === 'REJECTED')!.operatorName} · ${formatDateTime(statusHistory.find(h => h.toStatus === 'REJECTED')!.timestamp)}` : 
                  undefined}
              />
            )}
          </Timeline>
        </div>
      </Card>

      {/* 审批操作面板 */}
      {showApprovalActions && workOrder.status === 'PENDING_APPROVAL' && canApprove && (
        <Card className="mb-6">
          <div className="p-6">
            <h2 className="text-lg font-medium text-gray-900 mb-4">审批操作</h2>
            
            {!showCommentInput ? (
              <div className="flex gap-4">
                <Button 
                  variant="primary"
                  onClick={() => handleApprovalActionClick('APPROVE')}
                  disabled={isSubmitting}
                >
                  ✅ 通过
                </Button>
                <Button 
                  variant="danger"
                  onClick={() => handleApprovalActionClick('REJECT')}
                  disabled={isSubmitting}
                >
                  ❌ 拒绝
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="text-sm text-gray-600 mb-2">
                  {currentAction === 'APPROVE' ? '审批通过' : '审批拒绝'} - 请输入审批意见
                </div>
                
                <Textarea
                  value={approvalComment}
                  onChange={(e) => setApprovalComment(e.target.value)}
                  placeholder="请输入审批意见（可选）"
                  maxLength={1000}
                  rows={4}
                  className="w-full"
                />
                
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-400">
                    {approvalComment.length}/1000
                  </span>
                  <div className="flex gap-2">
                    <Button 
                      variant="secondary"
                      onClick={handleCancelApproval}
                      disabled={isSubmitting}
                    >
                      取消
                    </Button>
                    <Button 
                      variant={currentAction === 'APPROVE' ? 'primary' : 'danger'}
                      onClick={handleSubmitApproval}
                      disabled={isSubmitting}
                    >
                      {isSubmitting ? '处理中...' : '确认'}
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </Card>
      )}

      {/* 通知提示区域 */}
      {workOrder.status === 'APPROVED' && isCreator && (
        <Card className="mb-6 border-green-200 bg-green-50">
          <div className="p-4 flex items-center">
            <span className="text-green-600 text-xl mr-3">📬</span>
            <div>
              <p className="font-medium text-green-800">审批已完成</p>
              <p className="text-sm text-green-600">您会收到审批结果的通知</p>
            </div>
          </div>
        </Card>
      )}

      {/* Toast 提示 */}
      {toast && (
        <Toast 
          message={toast.message} 
          type={toast.type} 
          onClose={() => setToast(null)}
        />
      )}
    </div>
  );
};

// ============================================================================
// 导出
// ============================================================================

export default WorkOrderDetailView;

export { 
  WorkOrderDetailView, 
  STATUS_LABELS, 
  STATUS_STYLES,
  TIMELINE_NODES,
};

export type { 
  WorkOrderDetailViewProps, 
  ApprovalAction, 
  ApprovalResult, 
  ApprovalParams,
  TimelineNodeStatus,
};