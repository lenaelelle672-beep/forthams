/**
 * WorkOrderApprovePage.tsx
 * 
 * 工单审批流程前端页面组件
 * 
 * 功能模块：
 * - 工单提交表单 (WorkOrderSubmitForm)
 * - 工单列表视图 (WorkOrderListView)
 * - 工单详情视图 (WorkOrderDetailView，含审批进度时间轴)
 * - 审批操作面板 (ApprovalActionPanel，通过/拒绝按钮 + 意见输入)
 * 
 * 对应后端服务：
 * - backend/api/v1/approval.py (ApprovalService, NotificationService)
 * - backend/state_machine/workorder_state.py (WorkOrderStateMachine)
 * 
 * @module WorkOrderApprovePage
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

// ============================================================================
// Types / Interfaces
// ============================================================================

/**
 * 工单状态枚举
 * @description 对应后端 WorkOrderStatus 状态机
 */
export enum WorkOrderStatus {
  DRAFT = 'DRAFT',
  PENDING_APPROVAL = 'PENDING_APPROVAL',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
}

/**
 * 工单基础信息
 */
export interface WorkOrder {
  id: string;
  title: string;
  description: string;
  status: WorkOrderStatus;
  creatorId: string;
  creatorName: string;
  approverId: string;
  approverName: string;
  createdAt: string;
  updatedAt: string;
  version: number;
}

/**
 * 状态流转历史记录
 */
export interface StatusHistoryEntry {
  id: string;
  fromStatus: WorkOrderStatus | null;
  toStatus: WorkOrderStatus;
  operatorId: string;
  operatorName: string;
  comment: string;
  timestamp: string;
}

/**
 * 通知记录
 */
export interface NotificationRecord {
  id: string;
  recipientId: string;
  title: string;
  content: string;
  isRead: boolean;
  relatedWorkOrderId: string | null;
  createdAt: string;
}

/**
 * 审批操作请求参数
 */
export interface ApprovalActionParams {
  workOrderId: string;
  action: 'approve' | 'reject';
  comment: string;
  approverId: string;
}

/**
 * 工单提交表单数据
 */
export interface WorkOrderSubmitFormData {
  title: string;
  description: string;
  approverId: string;
}

// ============================================================================
// API Service Functions
// ============================================================================

/**
 * 工单服务 API
 * @description 封装工单相关的后端 API 调用
 */
export const workOrderService = {
  /**
   * 创建工单
   * @param data - 工单创建参数
   * @returns 创建的工单信息
   */
  async create(data: WorkOrderSubmitFormData): Promise<WorkOrder> {
    const response = await fetch('/api/workorders/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!response.ok) {
      throw new Error(`创建工单失败: ${response.statusText}`);
    }
    return response.json();
  },

  /**
   * 提交工单（状态流转: DRAFT -> PENDING_APPROVAL）
   * @param workOrderId - 工单ID
   * @returns 更新后的工单信息
   */
  async submit(workOrderId: string): Promise<WorkOrder> {
    const response = await fetch(`/api/workorders/${workOrderId}/submit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
    if (!response.ok) {
      throw new Error(`提交工单失败: ${response.statusText}`);
    }
    return response.json();
  },

  /**
   * 审批工单（通过/拒绝）
   * @param params - 审批操作参数
   * @returns 审批结果
   */
  async approve(params: ApprovalActionParams): Promise<{ status: WorkOrderStatus }> {
    const endpoint = params.action === 'approve' 
      ? `/api/workorders/${params.workOrderId}/approve` 
      : `/api/workorders/${params.workOrderId}/reject`;
    
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        comment: params.comment,
        approver_id: params.approverId,
      }),
    });
    if (!response.ok) {
      throw new Error(`审批操作失败: ${response.statusText}`);
    }
    return response.json();
  },

  /**
   * 获取工单详情
   * @param workOrderId - 工单ID
   * @returns 工单详情（含状态流转历史）
   */
  async getDetail(workOrderId: string): Promise<WorkOrder & { statusHistory: StatusHistoryEntry[] }> {
    const response = await fetch(`/api/workorders/${workOrderId}/`);
    if (!response.ok) {
      throw new Error(`获取工单详情失败: ${response.statusText}`);
    }
    return response.json();
  },

  /**
   * 获取工单列表
   * @param filters - 过滤条件
   * @returns 工单列表
   */
  async list(filters?: { status?: WorkOrderStatus; creatorId?: string }): Promise<WorkOrder[]> {
    const queryParams = new URLSearchParams();
    if (filters?.status) queryParams.set('status', filters.status);
    if (filters?.creatorId) queryParams.set('creator_id', filters.creatorId);
    
    const response = await fetch(`/api/workorders/?${queryParams}`);
    if (!response.ok) {
      throw new Error(`获取工单列表失败: ${response.statusText}`);
    }
    return response.json();
  },
};

/**
 * 通知服务 API
 * @description 封装通知相关的后端 API 调用
 */
export const notificationService = {
  /**
   * 获取当前用户未读通知数
   * @returns 未读通知数
   */
  async getUnreadCount(): Promise<number> {
    const response = await fetch('/api/notifications/unread-count');
    if (!response.ok) {
      throw new Error(`获取未读通知数失败: ${response.statusText}`);
    }
    const data = await response.json();
    return data.count;
  },

  /**
   * 标记通知为已读
   * @param notificationId - 通知ID
   */
  async markAsRead(notificationId: string): Promise<void> {
    const response = await fetch(`/api/notifications/${notificationId}/read`, {
      method: 'PUT',
    });
    if (!response.ok) {
      throw new Error(`标记通知已读失败: ${response.statusText}`);
    }
  },

  /**
   * 获取通知列表
   * @returns 通知列表
   */
  async list(): Promise<NotificationRecord[]> {
    const response = await fetch('/api/notifications/');
    if (!response.ok) {
      throw new Error(`获取通知列表失败: ${response.statusText}`);
    }
    return response.json();
  },
};

// ============================================================================
// Sub-Components
// ============================================================================

/**
 * 审批进度时间轴组件
 * @description 显示工单状态流转历史的时间轴
 * @param statusHistory - 状态流转历史记录列表
 * @param currentStatus - 当前工单状态
 */
interface ApprovalTimelineProps {
  statusHistory: StatusHistoryEntry[];
  currentStatus: WorkOrderStatus;
}

const ApprovalTimeline: React.FC<ApprovalTimelineProps> = ({ statusHistory, currentStatus }) => {
  /**
   * 获取状态显示文本
   * @param status - 状态值
   * @returns 状态中文描述
   */
  const getStatusLabel = (status: WorkOrderStatus | null): string => {
    const statusMap: Record<string, string> = {
      [WorkOrderStatus.DRAFT]: '草稿',
      [WorkOrderStatus.PENDING_APPROVAL]: '待审批',
      [WorkOrderStatus.APPROVED]: '已完成',
      [WorkOrderStatus.REJECTED]: '已拒绝',
    };
    return status ? statusMap[status] || status : '初始状态';
  };

  /**
   * 判断状态是否为当前状态
   * @param status - 状态值
   * @returns 是否为当前状态
   */
  const isCurrentStatus = (status: WorkOrderStatus): boolean => {
    return status === currentStatus;
  };

  return (
    <div className="approval-timeline" data-testid="approval-timeline">
      {statusHistory.map((entry, index) => (
        <div 
          key={entry.id} 
          className={`timeline-item ${isCurrentStatus(entry.toStatus) ? 'current' : ''}`}
        >
          <div className="timeline-marker">
            {isCurrentStatus(entry.toStatus) ? (
              <span className="current-indicator">●</span>
            ) : (
              <span className="completed-indicator">✓</span>
            )}
          </div>
          <div className="timeline-content">
            <div className="timeline-status">{getStatusLabel(entry.toStatus)}</div>
            <div className="timeline-operator">{entry.operatorName}</div>
            <div className="timeline-time">{new Date(entry.timestamp).toLocaleString()}</div>
            {entry.comment && (
              <div className="timeline-comment">{entry.comment}</div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
};

/**
 * 工单提交表单组件
 * @description 用于创建和提交新工单
 */
interface WorkOrderSubmitFormProps {
  onSubmitSuccess: (workOrder: WorkOrder) => void;
  onCancel: () => void;
}

const WorkOrderSubmitForm: React.FC<WorkOrderSubmitFormProps> = ({ onSubmitSuccess, onCancel }) => {
  const [formData, setFormData] = useState<WorkOrderSubmitFormData>({
    title: '',
    description: '',
    approverId: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * 处理表单提交
   * @param e - 表单提交事件
   */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      // 1. 创建工单
      const workOrder = await workOrderService.create(formData);
      // 2. 提交工单（自动流转至待审批状态）
      await workOrderService.submit(workOrder.id);
      // 3. 通知成功
      onSubmitSuccess(workOrder);
    } catch (err) {
      setError(err instanceof Error ? err.message : '提交失败');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="workorder-submit-form">
      <div className="form-group">
        <label htmlFor="title">工单标题</label>
        <input
          type="text"
          id="title"
          name="title"
          value={formData.title}
          onChange={(e) => setFormData({ ...formData, title: e.target.value })}
          maxLength={200}
          required
          placeholder="请输入工单标题（最大200字符）"
        />
      </div>

      <div className="form-group">
        <label htmlFor="description">工单描述</label>
        <textarea
          id="description"
          name="description"
          value={formData.description}
          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          maxLength={5000}
          required
          rows={5}
          placeholder="请输入工单描述（最大5000字符）"
        />
      </div>

      <div className="form-group">
        <label htmlFor="approver">审批人</label>
        <select
          id="approver"
          name="approver"
          value={formData.approverId}
          onChange={(e) => setFormData({ ...formData, approverId: e.target.value })}
          required
        >
          <option value="">请选择审批人</option>
          <option value="user_admin_001">系统管理员</option>
          <option value="user_admin_002">运维主管</option>
        </select>
      </div>

      {error && (
        <div className="form-error" role="alert">
          {error}
        </div>
      )}

      <div className="form-actions">
        <button type="button" onClick={onCancel} disabled={isSubmitting}>
          取消
        </button>
        <button type="submit" disabled={isSubmitting}>
          {isSubmitting ? '提交中...' : '提交工单'}
        </button>
      </div>
    </form>
  );
};

/**
 * 审批操作面板组件
 * @description 提供通过/拒绝按钮和意见输入
 */
interface ApprovalActionPanelProps {
  workOrderId: string;
  currentStatus: WorkOrderStatus;
  onActionComplete: () => void;
}

const ApprovalActionPanel: React.FC<ApprovalActionPanelProps> = ({
  workOrderId,
  currentStatus,
  onActionComplete,
}) => {
  const [comment, setComment] = useState('');
  const [showCommentInput, setShowCommentInput] = useState(false);
  const [pendingAction, setPendingAction] = useState<'approve' | 'reject' | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * 处理审批操作确认
   */
  const handleConfirm = async () => {
    if (!pendingAction) return;
    
    setIsProcessing(true);
    setError(null);

    try {
      await workOrderService.approve({
        workOrderId,
        action: pendingAction,
        comment,
        approverId: 'current_user_id', // TODO: 从登录上下文获取
      });
      onActionComplete();
    } catch (err) {
      setError(err instanceof Error ? err.message : '审批操作失败');
    } finally {
      setIsProcessing(false);
      setShowCommentInput(false);
      setPendingAction(null);
      setComment('');
    }
  };

  /**
   * 处理取消操作
   */
  const handleCancel = () => {
    setShowCommentInput(false);
    setPendingAction(null);
    setComment('');
  };

  /**
   * 初始化审批操作
   * @param action - 审批动作（approve/reject）
   */
  const initiateAction = (action: 'approve' | 'reject') => {
    setPendingAction(action);
    setShowCommentInput(true);
  };

  // 仅在待审批状态下显示审批操作面板
  if (currentStatus !== WorkOrderStatus.PENDING_APPROVAL) {
    return null;
  }

  return (
    <div className="approval-action-panel" data-testid="approval-action-panel">
      {!showCommentInput ? (
        <div className="action-buttons">
          <button
            className="btn-approve"
            onClick={() => initiateAction('approve')}
          >
            通过
          </button>
          <button
            className="btn-reject"
            onClick={() => initiateAction('reject')}
          >
            拒绝
          </button>
        </div>
      ) : (
        <div className="comment-input-section">
          <label htmlFor="comment">审批意见</label>
          <textarea
            id="comment"
            name="comment"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            maxLength={1000}
            rows={3}
            placeholder="请输入审批意见（最大1000字符）"
          />
          
          {error && (
            <div className="action-error" role="alert">
              {error}
            </div>
          )}
          
          <div className="action-buttons">
            <button
              type="button"
              onClick={handleCancel}
              disabled={isProcessing}
            >
              取消
            </button>
            <button
              type="button"
              className={pendingAction === 'approve' ? 'btn-approve' : 'btn-reject'}
              onClick={handleConfirm}
              disabled={isProcessing}
            >
              {isProcessing ? '处理中...' : '确认'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

/**
 * 工单列表视图组件
 * @description 显示工单列表，支持状态筛选
 */
interface WorkOrderListViewProps {
  onSelectWorkOrder: (workOrderId: string) => void;
}

const WorkOrderListView: React.FC<WorkOrderListViewProps> = ({ onSelectWorkOrder }) => {
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<WorkOrderStatus | ''>('');

  /**
   * 加载工单列表
   */
  const loadWorkOrders = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const filters = statusFilter ? { status: statusFilter as WorkOrderStatus } : undefined;
      const data = await workOrderService.list(filters);
      setWorkOrders(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载失败');
    } finally {
      setIsLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    loadWorkOrders();
  }, [loadWorkOrders]);

  /**
   * 获取状态显示标签
   * @param status - 状态值
   * @returns 状态中文标签
   */
  const getStatusBadge = (status: WorkOrderStatus): React.ReactNode => {
    const statusClasses: Record<string, string> = {
      [WorkOrderStatus.DRAFT]: 'badge-draft',
      [WorkOrderStatus.PENDING_APPROVAL]: 'badge-pending',
      [WorkOrderStatus.APPROVED]: 'badge-approved',
      [WorkOrderStatus.REJECTED]: 'badge-rejected',
    };
    const statusLabels: Record<string, string> = {
      [WorkOrderStatus.DRAFT]: '草稿',
      [WorkOrderStatus.PENDING_APPROVAL]: '待审批',
      [WorkOrderStatus.APPROVED]: '已通过',
      [WorkOrderStatus.REJECTED]: '已拒绝',
    };
    return (
      <span className={`status-badge ${statusClasses[status]}`}>
        {statusLabels[status]}
      </span>
    );
  };

  if (isLoading) {
    return <div className="loading-indicator">加载中...</div>;
  }

  return (
    <div className="workorder-list-view">
      <div className="list-header">
        <h2>工单列表</h2>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as WorkOrderStatus | '')}
          className="status-filter"
        >
          <option value="">全部状态</option>
          <option value={WorkOrderStatus.DRAFT}>草稿</option>
          <option value={WorkOrderStatus.PENDING_APPROVAL}>待审批</option>
          <option value={WorkOrderStatus.APPROVED}>已通过</option>
          <option value={WorkOrderStatus.REJECTED}>已拒绝</option>
        </select>
      </div>

      {error && (
        <div className="list-error" role="alert">
          {error}
          <button onClick={loadWorkOrders}>重试</button>
        </div>
      )}

      <div className="workorder-table">
        <table>
          <thead>
            <tr>
              <th>工单标题</th>
              <th>申请人</th>
              <th>审批人</th>
              <th>状态</th>
              <th>创建时间</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            {workOrders.length === 0 ? (
              <tr>
                <td colSpan={6} className="empty-state">
                  暂无工单数据
                </td>
              </tr>
            ) : (
              workOrders.map((wo) => (
                <tr key={wo.id}>
                  <td className="cell-title">{wo.title}</td>
                  <td>{wo.creatorName}</td>
                  <td>{wo.approverName}</td>
                  <td>{getStatusBadge(wo.status)}</td>
                  <td>{new Date(wo.createdAt).toLocaleString()}</td>
                  <td>
                    <button
                      onClick={() => onSelectWorkOrder(wo.id)}
                      className="btn-view-detail"
                    >
                      查看详情
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

/**
 * 工单详情视图组件
 * @description 显示工单详情和审批进度时间轴
 */
interface WorkOrderDetailViewProps {
  workOrderId: string;
  onBack: () => void;
}

const WorkOrderDetailView: React.FC<WorkOrderDetailViewProps> = ({ workOrderId, onBack }) => {
  const [workOrder, setWorkOrder] = useState<(WorkOrder & { statusHistory: StatusHistoryEntry[] }) | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  /**
   * 加载工单详情
   */
  const loadDetail = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await workOrderService.getDetail(workOrderId);
      setWorkOrder(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载失败');
    } finally {
      setIsLoading(false);
    }
  }, [workOrderId]);

  useEffect(() => {
    loadDetail();
  }, [loadDetail]);

  if (isLoading) {
    return <div className="loading-indicator">加载中...</div>;
  }

  if (error) {
    return (
      <div className="detail-error" role="alert">
        <p>{error}</p>
        <button onClick={loadDetail}>重试</button>
        <button onClick={onBack}>返回列表</button>
      </div>
    );
  }

  if (!workOrder) {
    return null;
  }

  return (
    <div className="workorder-detail-view">
      <div className="detail-header">
        <button onClick={onBack} className="btn-back">← 返回列表</button>
        <h2>{workOrder.title}</h2>
      </div>

      <div className="detail-content">
        <div className="detail-section">
          <h3>工单信息</h3>
          <dl className="detail-list">
            <dt>状态</dt>
            <dd className="status-badge">{workOrder.status}</dd>
            
            <dt>申请人</dt>
            <dd>{workOrder.creatorName}</dd>
            
            <dt>审批人</dt>
            <dd>{workOrder.approverName}</dd>
            
            <dt>创建时间</dt>
            <dd>{new Date(workOrder.createdAt).toLocaleString()}</dd>
            
            <dt>最后更新</dt>
            <dd>{new Date(workOrder.updatedAt).toLocaleString()}</dd>
            
            <dt>工单描述</dt>
            <dd className="description-text">{workOrder.description}</dd>
          </dl>
        </div>

        <div className="detail-section">
          <h3>审批进度</h3>
          <ApprovalTimeline
            statusHistory={workOrder.statusHistory}
            currentStatus={workOrder.status}
          />
        </div>

        <div className="detail-section">
          <ApprovalActionPanel
            workOrderId={workOrder.id}
            currentStatus={workOrder.status}
            onActionComplete={loadDetail}
          />
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// Main Page Component
// ============================================================================

/**
 * 工单审批主页面
 * @description 整合工单提交、列表、详情和审批操作的完整页面
 * 
 * 功能流程：
 * 1. 用户可提交新工单
 * 2. 查看工单列表和审批进度
 * 3. 审批人可执行通过/拒绝操作
 * 4. 审批完成后通知申请人
 * 
 * @example
 * // 路由配置
 * <Route path="/workorder/*" element={<WorkOrderApprovePage />} />
 */
const WorkOrderApprovePage: React.FC = () => {
  const navigate = useNavigate();
  const { workOrderId } = useParams<{ workOrderId?: string }>();

  // 当前视图状态：'list' | 'submit' | 'detail'
  const [currentView, setCurrentView] = useState<'list' | 'submit' | 'detail'>(
    workOrderId ? 'detail' : 'list'
  );

  /**
   * 跳转到工单列表
   */
  const goToList = useCallback(() => {
    setCurrentView('list');
    navigate('/workorder/list');
  }, [navigate]);

  /**
   * 跳转到工单提交表单
   */
  const goToSubmit = useCallback(() => {
    setCurrentView('submit');
    navigate('/workorder/submit');
  }, [navigate]);

  /**
   * 跳转到工单详情
   * @param id - 工单ID
   */
  const goToDetail = useCallback((id: string) => {
    setCurrentView('detail');
    navigate(`/workorder/${id}`);
  }, [navigate]);

  /**
   * 处理工单提交成功
   * @param workOrder - 创建的工单
   */
  const handleSubmitSuccess = useCallback((workOrder: WorkOrder) => {
    // 显示成功提示（通过 toast 组件）
    const toastElement = document.querySelector('.toast-success');
    if (toastElement) {
      toastElement.dispatchEvent(new CustomEvent('show-toast', {
        detail: { message: '工单提交成功', type: 'success' }
      }));
    }
    // 跳转到列表页
    goToList();
  }, [goToList]);

  /**
   * 处理审批操作完成
   */
  const handleApprovalComplete = useCallback(() => {
    // 显示成功提示
    const toastElement = document.querySelector('.toast-success');
    if (toastElement) {
      toastElement.dispatchEvent(new CustomEvent('show-toast', {
        detail: { message: '审批操作成功', type: 'success' }
      }));
    }
  }, []);

  return (
    <div className="workorder-approve-page">
      <header className="page-header">
        <h1>工单审批</h1>
        <nav className="page-nav">
          <button
            className={currentView === 'list' ? 'active' : ''}
            onClick={goToList}
          >
            工单列表
          </button>
          <button
            className={currentView === 'submit' ? 'active' : ''}
            onClick={goToSubmit}
          >
            提交工单
          </button>
        </nav>
      </header>

      <main className="page-content">
        {currentView === 'list' && (
          <WorkOrderListView onSelectWorkOrder={goToDetail} />
        )}
        
        {currentView === 'submit' && (
          <div className="submit-view">
            <h2>提交新工单</h2>
            <WorkOrderSubmitForm
              onSubmitSuccess={handleSubmitSuccess}
              onCancel={goToList}
            />
          </div>
        )}
        
        {currentView === 'detail' && workOrderId && (
          <WorkOrderDetailView
            workOrderId={workOrderId}
            onBack={goToList}
          />
        )}
      </main>
    </div>
  );
};

export default WorkOrderApprovePage;
export { WorkOrderApprovePage };
export type {
  WorkOrder,
  WorkOrderStatus,
  StatusHistoryEntry,
  WorkOrderSubmitFormData,
  ApprovalActionParams,
  NotificationRecord,
};