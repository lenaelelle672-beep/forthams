import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { approvalService } from '../../services/approvalService';

/**
 * Approval node status enum
 * Represents the possible states of an approval node in the workflow
 */
export enum ApprovalNodeStatus {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
  CANCELLED = 'CANCELLED'
}

/**
 * Approval node interface
 * Represents a single node in the approval chain
 */
export interface ApprovalNode {
  id: string;
  approvalId: string;
  parentNodeId: string | null;
  status: ApprovalNodeStatus;
  approverId: string;
  approverName: string;
  comment: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * Approval progress interface
 * Represents the complete approval progress including all nodes
 */
export interface ApprovalProgress {
  approvalId: string;
  workOrderId: string;
  currentStatus: ApprovalNodeStatus;
  currentNodeId: string;
  nodes: ApprovalNode[];
  createdAt: string;
  updatedAt: string;
}

/**
 * Approval history item interface
 * Represents a single approval history record for display
 */
export interface ApprovalHistoryItem {
  id: string;
  workOrderId: string;
  workOrderTitle: string;
  status: ApprovalNodeStatus;
  initiatedBy: string;
  initiatedByName: string;
  currentNodeId: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * Props interface for ApprovalHistory component
 */
export interface ApprovalHistoryProps {
  /** Work order ID to fetch approval history for */
  workOrderId: string;
  /** Optional callback when approval is created */
  onApprovalCreated?: (approvalId: string) => void;
  /** Optional callback when approval is clicked */
  onApprovalClick?: (approvalId: string) => void;
  /** Maximum number of history items to display */
  maxItems?: number;
}

/**
 * ApprovalHistory Component
 * Displays approval history records for a work order and allows initiating new approval requests
 * 
 * Features:
 * - View approval history records
 * - Initiate new approval requests
 * - View approval progress details
 * 
 * @param workOrderId - The work order ID to display approval history for
 * @param onApprovalCreated - Optional callback when approval is successfully created
 * @param onApprovalClick - Optional callback when an approval is clicked
 * @param maxItems - Maximum number of history items to display (default: 50)
 * 
 * @example
 * ```tsx
 * <ApprovalHistory 
 *   workOrderId="WO-001" 
 *   onApprovalCreated={(id) => console.log('Created:', id)}
 *   maxItems={10}
 * />
 * ```
 */
export const ApprovalHistory: React.FC<ApprovalHistoryProps> = ({
  workOrderId,
  onApprovalCreated,
  onApprovalClick,
  maxItems = 50
}) => {
  const [history, setHistory] = useState<ApprovalHistoryItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<ApprovalProgress | null>(null);
  const [showProgressModal, setShowProgressModal] = useState<boolean>(false);

  /**
   * Fetches approval history for the work order
   * @returns Promise resolving to array of approval history items
   */
  const fetchHistory = async (): Promise<void> => {
    try {
      setLoading(true);
      setError(null);
      const data = await approvalService.getApprovalHistory(workOrderId, { page_size: maxItems });
      setHistory(data.items || []);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch approval history';
      setError(errorMessage);
      console.error('Error fetching approval history:', err);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Fetches approval progress for a specific approval
   * @param approvalId - The approval ID to fetch progress for
   */
  const fetchProgress = async (approvalId: string): Promise<void> => {
    try {
      const data = await approvalService.getApprovalProgress(approvalId);
      setProgress(data);
      setShowProgressModal(true);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch approval progress';
      setError(errorMessage);
      console.error('Error fetching approval progress:', err);
    }
  };

  /**
   * Initiates a new approval request for the work order
   * @returns Promise resolving to the created approval ID
   */
  const createApprovalRequest = async (): Promise<string | null> => {
    try {
      setLoading(true);
      setError(null);
      const result = await approvalService.createApprovalRequest(workOrderId);
      
      if (onApprovalCreated && result.id) {
        onApprovalCreated(result.id);
      }
      
      // Refresh history after creating approval
      await fetchHistory();
      return result.id;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to create approval request';
      setError(errorMessage);
      console.error('Error creating approval request:', err);
      return null;
    } finally {
      setLoading(false);
    }
  };

  /**
   * Handles approval item click
   * @param approvalId - The approval ID that was clicked
   */
  const handleApprovalClick = (approvalId: string): void => {
    if (onApprovalClick) {
      onApprovalClick(approvalId);
    }
    fetchProgress(approvalId);
  };

  /**
   * Closes the progress modal
   */
  const closeProgressModal = (): void => {
    setShowProgressModal(false);
    setProgress(null);
  };

  /**
   * Formats a date string to locale format
   * @param dateString - ISO date string to format
   * @returns Formatted date string
   */
  const formatDate = (dateString: string): string => {
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('zh-CN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return dateString;
    }
  };

  /**
   * Gets display text for approval status
   * @param status - The approval status
   * @returns Human-readable status text
   */
  const getStatusText = (status: ApprovalNodeStatus): string => {
    const statusMap: Record<ApprovalNodeStatus, string> = {
      [ApprovalNodeStatus.PENDING]: '待审批',
      [ApprovalNodeStatus.APPROVED]: '已通过',
      [ApprovalNodeStatus.REJECTED]: '已驳回',
      [ApprovalNodeStatus.CANCELLED]: '已取消'
    };
    return statusMap[status] || status;
  };

  /**
   * Gets CSS class for status badge
   * @param status - The approval status
   * @returns CSS class name for status badge
   */
  const getStatusBadgeClass = (status: ApprovalNodeStatus): string => {
    const classMap: Record<ApprovalNodeStatus, string> = {
      [ApprovalNodeStatus.PENDING]: 'bg-yellow-100 text-yellow-800',
      [ApprovalNodeStatus.APPROVED]: 'bg-green-100 text-green-800',
      [ApprovalNodeStatus.REJECTED]: 'bg-red-100 text-red-800',
      [ApprovalNodeStatus.CANCELLED]: 'bg-gray-100 text-gray-800'
    };
    return classMap[status] || 'bg-gray-100 text-gray-800';
  };

  // Fetch history on mount and when workOrderId changes
  useEffect(() => {
    fetchHistory();
  }, [workOrderId]);

  if (loading && history.length === 0) {
    return (
      <div className="approval-history loading" data-testid="approval-history-loading">
        <div className="spinner-border" role="status">
          <span className="visually-hidden">加载中...</span>
        </div>
      </div>
    );
  }

  if (error && history.length === 0) {
    return (
      <div className="approval-history error" data-testid="approval-history-error">
        <div className="alert alert-danger" role="alert">
          <span className="error-message">{error}</span>
          <button 
            className="btn btn-link" 
            onClick={fetchHistory}
            aria-label="重试"
          >
            重试
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="approval-history" data-testid="approval-history-container">
      {/* Header with create button */}
      <div className="approval-history-header" data-testid="approval-history-header">
        <h3 className="approval-history-title">审批历史</h3>
        <button
          className="btn btn-primary"
          data-testid="btn-create-approval"
          onClick={createApprovalRequest}
          disabled={loading}
          aria-label="发起审批申请"
        >
          {loading ? '提交中...' : '发起审批'}
        </button>
      </div>

      {/* Error message display */}
      {error && (
        <div className="alert alert-warning" role="alert" data-testid="approval-history-warning">
          {error}
        </div>
      )}

      {/* History list */}
      <div 
        className="approval-history-list" 
        data-testid="approval-history-list"
        role="list"
        aria-label="审批历史记录列表"
      >
        {history.length === 0 ? (
          <div className="empty-state" data-testid="approval-history-empty">
            <p>暂无审批记录</p>
          </div>
        ) : (
          history.map((item, index) => (
            <div 
              key={item.id}
              className="history-item"
              data-testid={`approval-history-item-${index}`}
              role="listitem"
              onClick={() => handleApprovalClick(item.id)}
              style={{ cursor: 'pointer' }}
            >
              <div className="history-item-header">
                <span className="history-item-title" data-testid={`history-item-title-${index}`}>
                  {item.workOrderTitle || `工单 ${item.workOrderId}`}
                </span>
                <span 
                  className={`history-item-status ${getStatusBadgeClass(item.status)}`}
                  data-testid={`history-item-status-${index}`}
                >
                  {getStatusText(item.status)}
                </span>
              </div>
              <div className="history-item-details">
                <span className="history-item-initiator" data-testid={`history-item-initiator-${index}`}>
                  发起人: {item.initiatedByName || item.initiatedBy}
                </span>
                <span className="history-item-date" data-testid={`history-item-date-${index}`}>
                  {formatDate(item.createdAt)}
                </span>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Progress Modal */}
      {showProgressModal && progress && (
        <div 
          className="modal fade show d-block" 
          data-testid="approval-progress-modal"
          role="dialog"
          aria-labelledby="progressModalLabel"
          aria-modal="true"
        >
          <div className="modal-dialog modal-lg">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title" id="progressModalLabel" data-testid="progress-modal-title">
                  审批进度
                </h5>
                <button 
                  type="button" 
                  className="btn-close" 
                  onClick={closeProgressModal}
                  aria-label="关闭"
                ></button>
              </div>
              <div className="modal-body" data-testid="approval-progress-panel">
                <div className="progress-info">
                  <p>
                    <strong>当前状态:</strong>
                    <span className={`status-badge ${getStatusBadgeClass(progress.currentStatus)}`}>
                      {getStatusText(progress.currentStatus)}
                    </span>
                  </p>
                  <p>
                    <strong>创建时间:</strong> {formatDate(progress.createdAt)}
                  </p>
                </div>
                
                <div className="progress-nodes" data-testid="approval-nodes-list">
                  <h6>审批节点:</h6>
                  {progress.nodes.length === 0 ? (
                    <p className="text-muted">暂无审批节点</p>
                  ) : (
                    <ul className="node-list">
                      {progress.nodes.map((node, nodeIndex) => (
                        <li 
                          key={node.id}
                          className="node-item"
                          data-testid={`approval-node-${nodeIndex}`}
                        >
                          <div className="node-header">
                            <span className="node-index">节点 {nodeIndex + 1}</span>
                            <span className={`node-status ${getStatusBadgeClass(node.status)}`}>
                              {getStatusText(node.status)}
                            </span>
                          </div>
                          <div className="node-details">
                            <p>
                              <strong>审批人:</strong> {node.approverName || node.approverId}
                            </p>
                            {node.comment && (
                              <p>
                                <strong>意见:</strong> {node.comment}
                              </p>
                            )}
                            <p className="node-time">
                              <strong>时间:</strong> {formatDate(node.createdAt)}
                            </p>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
              <div className="modal-footer">
                <button 
                  type="button" 
                  className="btn btn-secondary" 
                  onClick={closeProgressModal}
                >
                  关闭
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Backdrop for modal */}
      {showProgressModal && (
        <div 
          className="modal-backdrop fade show" 
          onClick={closeProgressModal}
          data-testid="approval-progress-backdrop"
        ></div>
      )}
    </div>
  );
};

/**
 * Default export for ApprovalHistory component
 */
export default ApprovalHistory;