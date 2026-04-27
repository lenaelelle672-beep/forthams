/**
 * ApprovalPanel.tsx - 工单审批流程核心业务流入口
 * 
 * 功能描述：
 * - 审批人查看待审批工单列表
 * - 执行通过/驳回审批操作
 * - 查看工单详情及状态变更历史
 * 
 * @module ApprovalPanel
 * @version 1.0.0
 * @iteration SWARM-001-Iteration-1
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { 
  TicketStatus, 
  WorkOrderStatus, 
  ApprovalAction, 
  WorkOrder 
} from '@/types/workorder.types';
import { useApprovalStore } from '@/stores/approvalStore';
import { useApprovalPermission } from '@/composables/useApprovalPermission';
import { getCurrentUser } from '@/mocks/workOrderHandlers';

// ============================================================================
// 类型定义
// ============================================================================

/** 审批面板 Props */
interface ApprovalPanelProps {
  /** 工单ID */
  ticketId?: string;
  /** 审批完成回调 */
  onApprovalComplete?: (ticketId: string, action: ApprovalAction) => void;
  /** 审批拒绝回调 */
  onApprovalReject?: (ticketId: string, reason: string) => void;
}

/** 审批表单数据 */
interface ApprovalFormData {
  /** 审批意见 */
  comment: string;
  /** 驳回原因（驳回时必填） */
  rejectionReason?: string;
}

/** 状态历史记录项 */
interface StatusHistoryItem {
  id: string;
  status: WorkOrderStatus;
  timestamp: Date;
  operator: string;
  comment?: string;
}

// ============================================================================
// 常量定义
// ============================================================================

/** 有效状态转换映射 */
const VALID_TRANSITIONS: Record<WorkOrderStatus, WorkOrderStatus[]> = {
  [WorkOrderStatus.DRAFT]: [WorkOrderStatus.PENDING],
  [WorkOrderStatus.PENDING]: [WorkOrderStatus.APPROVED, WorkOrderStatus.REJECTED],
  [WorkOrderStatus.APPROVED]: [WorkOrderStatus.ARCHIVED],
  [WorkOrderStatus.REJECTED]: [WorkOrderStatus.DRAFT],
  [WorkOrderStatus.ARCHIVED]: [],
};

/** 状态中文标签映射 */
const STATUS_LABELS: Record<WorkOrderStatus, string> = {
  [WorkOrderStatus.DRAFT]: '草稿',
  [WorkOrderStatus.PENDING]: '待审批',
  [WorkOrderStatus.APPROVED]: '已通过',
  [WorkOrderStatus.REJECTED]: '已驳回',
  [WorkOrderStatus.ARCHIVED]: '已归档',
};

/** 审批操作类型 */
const ACTION_LABELS: Record<ApprovalAction, string> = {
  [ApprovalAction.APPROVE]: '通过',
  [ApprovalAction.REJECT]: '驳回',
  [ApprovalAction.ARCHIVE]: '归档',
};

// ============================================================================
// 工具函数
// ============================================================================

/**
 * 校验状态转换是否合法
 * @param currentStatus 当前状态
 * @param targetStatus 目标状态
 * @returns 是否合法
 */
function isValidTransition(
  currentStatus: WorkOrderStatus, 
  targetStatus: WorkOrderStatus
): boolean {
  return VALID_TRANSITIONS[currentStatus]?.includes(targetStatus) ?? false;
}

/**
 * 格式化日期为可读字符串
 * @param date 日期对象
 * @returns 格式化后的字符串
 */
function formatDate(date: Date): string {
  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

/**
 * 生成唯一ID
 * @returns 唯一标识符
 */
function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

// ============================================================================
// 核心业务组件
// ============================================================================

/**
 * ApprovalPanel - 工单审批流程核心业务流入口组件
 * 
 * @description 提供审批人执行工单审批操作的完整界面
 * 
 * @example
 * ```tsx
 * <ApprovalPanel 
 *   ticketId="WO-001" 
 *   onApprovalComplete={(id, action) => console.log(id, action)} 
 * />
 * ```
 */
export const ApprovalPanel: React.FC<ApprovalPanelProps> = React.memo(({
  ticketId,
  onApprovalComplete,
  onApprovalReject,
}) => {
  // ---------------------------------------------------------------------------
  // 状态管理
  // ---------------------------------------------------------------------------
  
  const [selectedTicket, setSelectedTicket] = useState<WorkOrder | null>(null);
  const [statusHistory, setStatusHistory] = useState<StatusHistoryItem[]>([]);
  const [formData, setFormData] = useState<ApprovalFormData>({
    comment: '',
    rejectionReason: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [pendingAction, setPendingAction] = useState<ApprovalAction | null>(null);
  const [error, setError] = useState<string | null>(null);

  // ---------------------------------------------------------------------------
  // Store & Hooks
  // ---------------------------------------------------------------------------
  
  const { 
    pendingTickets, 
    loadPendingTickets, 
    approveTicket, 
    rejectTicket,
    refreshTickets 
  } = useApprovalStore();

  const { 
    canApprove, 
    canReject,
    checkPermission 
  } = useApprovalPermission();

  const currentUserId = useMemo(() => getCurrentUser(), []);

  // ---------------------------------------------------------------------------
  // 副作用处理
  // ---------------------------------------------------------------------------
  
  /** 加载待审批工单列表 */
  useEffect(() => {
    loadPendingTickets();
  }, [loadPendingTickets]);

  /** 根据ticketId加载工单详情 */
  useEffect(() => {
    if (ticketId) {
      const ticket = pendingTickets.find(t => t.id === ticketId);
      setSelectedTicket(ticket || null);
      if (ticket) {
        loadStatusHistory(ticketId);
      }
    }
  }, [ticketId, pendingTickets]);

  // ---------------------------------------------------------------------------
  // 业务方法
  // ---------------------------------------------------------------------------

  /**
   * 加载工单状态变更历史
   * @param ticketId 工单ID
   */
  const loadStatusHistory = useCallback(async (ticketId: string) => {
    // 模拟从后端获取状态历史
    const mockHistory: StatusHistoryItem[] = [
      {
        id: generateId(),
        status: WorkOrderStatus.DRAFT,
        timestamp: new Date(Date.now() - 86400000 * 2),
        operator: 'requester-001',
        comment: '创建工单',
      },
      {
        id: generateId(),
        status: WorkOrderStatus.PENDING,
        timestamp: new Date(Date.now() - 86400000),
        operator: 'requester-001',
        comment: '提交审批',
      },
    ];
    setStatusHistory(mockHistory);
  }, []);

  /**
   * 执行审批操作
   * @param action 审批动作
   * @param reason 驳回原因（仅驳回时需要）
   */
  const executeApproval = useCallback(async (
    action: ApprovalAction,
    reason?: string
  ) => {
    if (!selectedTicket) {
      setError('请先选择一个工单');
      return false;
    }

    // 权限校验
    if (action === ApprovalAction.APPROVE && !canApprove(selectedTicket)) {
      setError('您没有该工单的审批权限');
      return false;
    }

    if (action === ApprovalAction.REJECT && !canReject(selectedTicket)) {
      setError('您没有该工单的驳回权限');
      return false;
    }

    // 状态转换校验
    const currentStatus = selectedTicket.status;
    const targetStatus = action === ApprovalAction.APPROVE 
      ? WorkOrderStatus.APPROVED 
      : WorkOrderStatus.REJECTED;

    if (!isValidTransition(currentStatus, targetStatus)) {
      setError(`非法状态转换: ${STATUS_LABELS[currentStatus]} → ${STATUS_LABELS[targetStatus]}`);
      return false;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      if (action === ApprovalAction.APPROVE) {
        await approveTicket(selectedTicket.id, {
          approverId: currentUserId,
          comment: formData.comment,
        });
        onApprovalComplete?.(selectedTicket.id, action);
      } else if (action === ApprovalAction.REJECT) {
        if (!reason && !formData.rejectionReason) {
          setError('驳回操作必须填写原因');
          setIsSubmitting(false);
          return false;
        }
        await rejectTicket(selectedTicket.id, {
          approverId: currentUserId,
          reason: reason || formData.rejectionReason || '',
        });
        onApprovalReject?.(selectedTicket.id, reason || formData.rejectionReason || '');
      }

      // 更新状态历史
      const newHistoryItem: StatusHistoryItem = {
        id: generateId(),
        status: targetStatus,
        timestamp: new Date(),
        operator: currentUserId,
        comment: action === ApprovalAction.APPROVE 
          ? formData.comment 
          : reason || formData.rejectionReason,
      };
      setStatusHistory(prev => [...prev, newHistoryItem]);
      
      // 刷新列表
      await refreshTickets();
      
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : '审批操作失败');
      return false;
    } finally {
      setIsSubmitting(false);
      setShowConfirmDialog(false);
      setPendingAction(null);
    }
  }, [
    selectedTicket, 
    currentUserId, 
    formData, 
    canApprove, 
    canReject,
    approveTicket, 
    rejectTicket, 
    refreshTickets,
    onApprovalComplete,
    onApprovalReject,
  ]);

  /**
   * 预处理审批操作（显示确认对话框）
   * @param action 审批动作
   */
  const handlePreApprove = useCallback((action: ApprovalAction) => {
    if (action === ApprovalAction.REJECT) {
      if (!formData.rejectionReason?.trim()) {
        setError('请填写驳回原因');
        return;
      }
    }
    setPendingAction(action);
    setShowConfirmDialog(true);
  }, [formData.rejectionReason]);

  /**
   * 取消审批操作
   */
  const handleCancel = useCallback(() => {
    setShowConfirmDialog(false);
    setPendingAction(null);
    setFormData({ comment: '', rejectionReason: '' });
  }, []);

  /**
   * 处理表单输入变更
   * @param field 字段名
   * @param value 字段值
   */
  const handleInputChange = useCallback((
    field: keyof ApprovalFormData, 
    value: string
  ) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (error) setError(null);
  }, [error]);

  /**
   * 选中工单
   * @param ticket 工单对象
   */
  const handleSelectTicket = useCallback((ticket: WorkOrder) => {
    setSelectedTicket(ticket);
    loadStatusHistory(ticket.id);
    setError(null);
  }, [loadStatusHistory]);

  // ---------------------------------------------------------------------------
  // 渲染逻辑
  // ---------------------------------------------------------------------------

  return (
    <div className="approval-panel" data-testid="approval-panel">
      {/* 错误提示 */}
      {error && (
        <div className="error-banner" data-testid="error-banner">
          <span>{error}</span>
          <button onClick={() => setError(null)}>×</button>
        </div>
      )}

      <div className="approval-layout">
        {/* 左侧：待审批列表 */}
        <div className="pending-list-section">
          <h3 className="section-title">待审批工单</h3>
          <div className="ticket-list" data-testid="pending-ticket-list">
            {pendingTickets.length === 0 ? (
              <div className="empty-state" data-testid="empty-pending-list">
                暂无待审批工单
              </div>
            ) : (
              pendingTickets.map(ticket => (
                <div
                  key={ticket.id}
                  className={`ticket-item ${selectedTicket?.id === ticket.id ? 'selected' : ''}`}
                  data-testid={`pending-ticket-item-${ticket.id}`}
                  onClick={() => handleSelectTicket(ticket)}
                >
                  <div className="ticket-header">
                    <span className="ticket-id">{ticket.id}</span>
                    <span className="ticket-status" data-testid={`ticket-status-${ticket.id}`}>
                      {STATUS_LABELS[ticket.status]}
                    </span>
                  </div>
                  <div className="ticket-title">{ticket.title}</div>
                  <div className="ticket-meta">
                    <span>申请人: {ticket.requesterId}</span>
                    <span>{formatDate(new Date(ticket.createdAt))}</span>
                  </div>
                </div>
              ))
            )}
          </div>
          <button 
            className="refresh-btn"
            onClick={() => loadPendingTickets()}
            disabled={isSubmitting}
          >
            刷新列表
          </button>
        </div>

        {/* 右侧：审批详情 */}
        <div className="approval-detail-section">
          {selectedTicket ? (
            <>
              <div className="ticket-info-panel">
                <h3 className="section-title">工单详情</h3>
                <div className="info-grid">
                  <div className="info-item">
                    <label>工单ID:</label>
                    <span>{selectedTicket.id}</span>
                  </div>
                  <div className="info-item">
                    <label>标题:</label>
                    <span>{selectedTicket.title}</span>
                  </div>
                  <div className="info-item">
                    <label>状态:</label>
                    <span className="status-badge" data-testid="ticket-status">
                      {STATUS_LABELS[selectedTicket.status]}
                    </span>
                  </div>
                  <div className="info-item">
                    <label>申请人:</label>
                    <span>{selectedTicket.requesterId}</span>
                  </div>
                  <div className="info-item full-width">
                    <label>描述:</label>
                    <span>{selectedTicket.description}</span>
                  </div>
                </div>
              </div>

              {/* 审批操作区 */}
              <div className="approval-action-panel" data-testid="approval-action-panel">
                <h3 className="section-title">审批操作</h3>
                
                <div className="form-group">
                  <label htmlFor="comment">审批意见:</label>
                  <textarea
                    id="comment"
                    data-testid="approval-comment"
                    value={formData.comment}
                    onChange={(e) => handleInputChange('comment', e.target.value)}
                    placeholder="请输入审批意见（可选）"
                    rows={3}
                    disabled={isSubmitting}
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="rejectionReason">驳回原因:</label>
                  <textarea
                    id="rejectionReason"
                    data-testid="rejection-reason"
                    value={formData.rejectionReason}
                    onChange={(e) => handleInputChange('rejectionReason', e.target.value)}
                    placeholder="请输入驳回原因（驳回时必填）"
                    rows={3}
                    disabled={isSubmitting}
                  />
                  {error?.includes('驳回原因') && (
                    <span className="field-error" data-testid="reason-error">
                      请填写驳回原因
                    </span>
                  )}
                </div>

                <div className="action-buttons">
                  <button
                    className="btn-approve"
                    data-testid="btn-approve"
                    onClick={() => handlePreApprove(ApprovalAction.APPROVE)}
                    disabled={isSubmitting || !canApprove(selectedTicket)}
                  >
                    {isSubmitting ? '处理中...' : '通过'}
                  </button>
                  <button
                    className="btn-reject"
                    data-testid="btn-reject"
                    onClick={() => handlePreApprove(ApprovalAction.REJECT)}
                    disabled={isSubmitting || !canReject(selectedTicket)}
                  >
                    驳回
                  </button>
                </div>
              </div>

              {/* 状态历史时间线 */}
              <div className="status-history-panel">
                <h3 className="section-title">状态变更历史</h3>
                <div className="status-timeline" data-testid="status-timeline">
                  {statusHistory.map((item, index) => (
                    <div key={item.id} className="timeline-item">
                      <div className="timeline-dot" />
                      <div className="timeline-content">
                        <div className="timeline-header">
                          <span className="timeline-status">
                            {STATUS_LABELS[item.status]}
                          </span>
                          <span className="timeline-time">
                            {formatDate(item.timestamp)}
                          </span>
                        </div>
                        <div className="timeline-operator">
                          操作人: {item.operator}
                        </div>
                        {item.comment && (
                          <div className="timeline-comment">
                            {item.comment}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          ) : (
            <div className="empty-detail" data-testid="empty-detail">
              请从左侧列表选择一个工单进行审批
            </div>
          )}
        </div>
      </div>

      {/* 确认对话框 */}
      {showConfirmDialog && (
        <div className="confirm-dialog-overlay" data-testid="confirm-dialog-overlay">
          <div className="confirm-dialog" data-testid="confirm-dialog">
            <div className="dialog-header">
              <h4>确认{pendingAction === ApprovalAction.APPROVE ? '通过' : '驳回'}审批</h4>
            </div>
            <div className="dialog-body">
              <p>
                确定要{pendingAction === ApprovalAction.APPROVE ? '通过' : '驳回'}
                工单 <strong>{selectedTicket?.id}</strong> 吗？
                {pendingAction === ApprovalAction.REJECT && formData.rejectionReason && (
                  <span className="rejection-preview">
                    <br />
                    驳回原因: {formData.rejectionReason}
                  </span>
                )}
              </p>
            </div>
            <div className="dialog-footer">
              <button 
                className="btn-cancel"
                onClick={handleCancel}
                disabled={isSubmitting}
              >
                取消
              </button>
              <button
                className={pendingAction === ApprovalAction.APPROVE ? 'btn-confirm-approve' : 'btn-confirm-reject'}
                onClick={() => executeApproval(pendingAction!, formData.rejectionReason)}
                disabled={isSubmitting}
              >
                {isSubmitting ? '处理中...' : '确认'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
});

// ============================================================================
// 样式定义（内联）
// ============================================================================

const styles = `
.approval-panel {
  padding: 16px;
  background: #fff;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.error-banner {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  background: #fef2f2;
  border: 1px solid #fecaca;
  border-radius: 6px;
  color: #dc2626;
  margin-bottom: 16px;
}

.error-banner button {
  background: none;
  border: none;
  font-size: 18px;
  cursor: pointer;
  color: #dc2626;
}

.approval-layout {
  display: flex;
  gap: 24px;
}

.pending-list-section {
  width: 300px;
  flex-shrink: 0;
}

.section-title {
  font-size: 16px;
  font-weight: 600;
  margin-bottom: 12px;
  color: #1f2937;
}

.ticket-list {
  max-height: 400px;
  overflow-y: auto;
  border: 1px solid #e5e7eb;
  border-radius: 6px;
}

.empty-state {
  padding: 24px;
  text-align: center;
  color: #6b7280;
}

.ticket-item {
  padding: 12px;
  border-bottom: 1px solid #e5e7eb;
  cursor: pointer;
  transition: background 0.15s;
}

.ticket-item:hover {
  background: #f9fafb;
}

.ticket-item.selected {
  background: #eff6ff;
  border-left: 3px solid #3b82f6;
}

.ticket-header {
  display: flex;
  justify-content: space-between;
  margin-bottom: 4px;
}

.ticket-id {
  font-weight: 600;
  color: #3b82f6;
}

.ticket-status {
  font-size: 12px;
  padding: 2px 8px;
  border-radius: 4px;
  background: #fef3c7;
  color: #92400e;
}

.ticket-title {
  font-size: 14px;
  color: #374151;
  margin-bottom: 4px;
}

.ticket-meta {
  font-size: 12px;
  color: #6b7280;
  display: flex;
  justify-content: space-between;
}

.refresh-btn {
  width: 100%;
  margin-top: 12px;
  padding: 8px 16px;
  background: #f3f4f6;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  cursor: pointer;
  transition: background 0.15s;
}

.refresh-btn:hover:not(:disabled) {
  background: #e5e7eb;
}

.refresh-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.approval-detail-section {
  flex: 1;
  min-width: 0;
}

.empty-detail {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 300px;
  color: #6b7280;
  border: 2px dashed #e5e7eb;
  border-radius: 8px;
}

.ticket-info-panel,
.approval-action-panel,
.status-history-panel {
  margin-bottom: 20px;
  padding: 16px;
  background: #f9fafb;
  border-radius: 8px;
}

.info-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}

.info-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.info-item.full-width {
  grid-column: 1 / -1;
}

.info-item label {
  font-size: 12px;
  color: #6b7280;
}

.info-item span {
  font-size: 14px;
  color: #1f2937;
}

.status-badge {
  display: inline-block;
  padding: 4px 12px;
  background: #dbeafe;
  color: #1e40af;
  border-radius: 4px;
  font-weight: 500;
}

.form-group {
  margin-bottom: 16px;
}

.form-group label {
  display: block;
  margin-bottom: 6px;
  font-size: 14px;
  font-weight: 500;
  color: #374151;
}

.form-group textarea {
  width: 100%;
  padding: 10px 12px;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  font-size: 14px;
  resize: vertical;
  transition: border-color 0.15s;
}

.form-group textarea:focus {
  outline: none;
  border-color: #3b82f6;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}

.form-group textarea:disabled {
  background: #f3f4f6;
  cursor: not-allowed;
}

.field-error {
  display: block;
  margin-top: 4px;
  font-size: 12px;
  color: #dc2626;
}

.action-buttons {
  display: flex;
  gap: 12px;
}

.btn-approve,
.btn-reject {
  flex: 1;
  padding: 10px 16px;
  border: none;
  border-radius: 6px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: opacity 0.15s;
}

.btn-approve {
  background: #10b981;
  color: #fff;
}

.btn-approve:hover:not(:disabled) {
  background: #059669;
}

.btn-reject {
  background: #ef4444;
  color: #fff;
}

.btn-reject:hover:not(:disabled) {
  background: #dc2626;
}

.btn-approve:disabled,
.btn-reject:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.status-timeline {
  position: relative;
  padding-left: 20px;
}

.timeline-item {
  position: relative;
  padding-bottom: 16px;
  padding-left: 20px;
  border-left: 2px solid #e5e7eb;
}

.timeline-item:last-child {
  border-left: none;
  padding-bottom: 0;
}

.timeline-dot {
  position: absolute;
  left: -6px;
  top: 0;
  width: 10px;
  height: 10px;
  background: #3b82f6;
  border-radius: 50%;
}

.timeline-content {
  background: #fff;
  padding: 8px 12px;
  border-radius: 6px;
  border: 1px solid #e5e7eb;
}

.timeline-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 4px;
}

.timeline-status {
  font-weight: 600;
  color: #1f2937;
}

.timeline-time {
  font-size: 12px;
  color: #6b7280;
}

.timeline-operator {
  font-size: 12px;
  color: #4b5563;
}

.timeline-comment {
  margin-top: 4px;
  font-size: 13px;
  color: #6b7280;
  font-style: italic;
}

.confirm-dialog-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.confirm-dialog {
  background: #fff;
  border-radius: 8px;
  width: 400px;
  max-width: 90%;
  box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1);
}

.dialog-header {
  padding: 16px 20px;
  border-bottom: 1px solid #e5e7eb;
}

.dialog-header h4 {
  margin: 0;
  font-size: 16px;
  color: #1f2937;
}

.dialog-body {
  padding: 20px;
}

.dialog-body p {
  margin: 0;
  color: #4b5563;
}

.rejection-preview {
  color: #dc2626;
}

.dialog-footer {
  padding: 16px 20px;
  border-top: 1px solid #e5e7eb;
  display: flex;
  justify-content: flex-end;
  gap: 12px;
}

.btn-cancel {
  padding: 8px 16px;
  background: #f3f4f6;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  cursor: pointer;
}

.btn-cancel:hover:not(:disabled) {
  background: #e5e7eb;
}

.btn-confirm-approve {
  padding: 8px 16px;
  background: #10b981;
  color: #fff;
  border: none;
  border-radius: 6px;
  cursor: pointer;
}

.btn-confirm-approve:hover:not(:disabled) {
  background: #059669;
}

.btn-confirm-reject {
  padding: 8px 16px;
  background: #ef4444;
  color: #fff;
  border: none;
  border-radius: 6px;
  cursor: pointer;
}

.btn-confirm-reject:hover:not(:disabled) {
  background: #dc2626;
}

.btn-cancel:disabled,
.btn-confirm-approve:disabled,
.btn-confirm-reject:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
`;

// 注入样式
if (typeof document !== 'undefined') {
  const styleSheet = document.createElement('style');
  styleSheet.textContent = styles;
  document.head.appendChild(styleSheet);
}

// ============================================================================
// 导出
// ============================================================================

export type { ApprovalPanelProps, ApprovalFormData, StatusHistoryItem };
export default ApprovalPanel;