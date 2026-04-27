/**
 * 工单审批服务
 * 
 * 实现工单审批流程的核心业务逻辑，包括：
 * - 审批通过 (APPROVED)
 * - 审批驳回 (REJECTED)
 * - 审批转签 (TRANSFERRED)
 * - 审批历史查询
 * 
 * 遵循状态机驱动模式，每个操作都会触发对应的通知事件。
 * 
 * @module approval_service
 * @version SWARM-2025-Q2-P0-003 Iteration 10
 */

import type { AxiosInstance } from 'axios';
import { request } from '@/utils/http';
import type { WorkOrder } from '@/types/workorder.types';

// =============================================================================
// 类型定义
// =============================================================================

/**
 * 审批操作类型
 */
export type ApprovalAction = 'APPROVED' | 'REJECTED' | 'TRANSFERRED';

/**
 * 审批结果
 */
export interface ApprovalResult {
  /** 工单ID */
  workOrderId: string;
  /** 操作结果 */
  success: boolean;
  /** 消息 */
  message: string;
  /** 审批记录ID */
  recordId?: string;
}

/**
 * 审批历史项
 */
export interface ApprovalHistoryItem {
  /** 记录ID */
  id: string;
  /** 工单ID */
  workOrderId: string;
  /** 操作人 */
  actor: string;
  /** 操作类型 */
  action: ApprovalAction;
  /** 原状态 */
  fromState: string;
  /** 目标状态 */
  toState: string;
  /** 备注/原因 */
  comment?: string;
  /** 创建时间 */
  createdAt: string;
}

/**
 * 审批请求参数 - 通过
 */
export interface ApproveWorkOrderParams {
  /** 工单ID */
  workOrderId: string;
  /** 审批意见（可选） */
  comment?: string;
  /** 幂等键（可选） */
  idempotencyKey?: string;
}

/**
 * 审批请求参数 - 驳回
 */
export interface RejectWorkOrderParams {
  /** 工单ID */
  workOrderId: string;
  /** 驳回原因（必填） */
  reason: string;
  /** 幂等键（可选） */
  idempotencyKey?: string;
}

/**
 * 审批请求参数 - 转签
 */
export interface TransferWorkOrderParams {
  /** 工单ID */
  workOrderId: string;
  /** 目标审批人ID */
  targetUserId: string;
  /** 转签原因（可选） */
  reason?: string;
  /** 幂等键（可选） */
  idempotencyKey?: string;
}

// =============================================================================
// 状态机定义
// =============================================================================

/**
 * 工单状态枚举
 */
export enum WorkOrderState {
  DRAFT = 'DRAFT',
  PENDING_APPROVAL = 'PENDING_APPROVAL',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
  TRANSFERRED = 'TRANSFERRED',
  CLOSED = 'CLOSED',
}

/**
 * 状态转换矩阵
 * 定义合法的状态转换路径
 */
const STATE_TRANSITIONS: Record<WorkOrderState, WorkOrderState[]> = {
  [WorkOrderState.DRAFT]: [WorkOrderState.PENDING_APPROVAL],
  [WorkOrderState.PENDING_APPROVAL]: [
    WorkOrderState.APPROVED,
    WorkOrderState.REJECTED,
    WorkOrderState.TRANSFERRED,
  ],
  [WorkOrderState.APPROVED]: [WorkOrderState.CLOSED],
  [WorkOrderState.REJECTED]: [], // 终态，无后续转换
  [WorkOrderState.TRANSFERRED]: [WorkOrderState.PENDING_APPROVAL],
  [WorkOrderState.CLOSED]: [], // 终态，无后续转换
};

// =============================================================================
// 通知事件类型
// =============================================================================

/**
 * 状态变更通知事件
 */
export interface StateChangedEvent {
  /** 事件类型 */
  type: 'WORK_ORDER_APPROVED' | 'WORK_ORDER_REJECTED' | 'WORK_ORDER_TRANSFERRED';
  /** 工单ID */
  workOrderId: string;
  /** 原状态 */
  fromState: string;
  /** 目标状态 */
  toState: string;
  /** 操作人 */
  actor: string;
  /** 时间戳 */
  timestamp: string;
  /** 额外数据 */
  metadata?: Record<string, unknown>;
}

/**
 * 审批事件类型到通知事件的映射
 */
const ACTION_TO_EVENT_TYPE: Record<ApprovalAction, StateChangedEvent['type']> = {
  APPROVED: 'WORK_ORDER_APPROVED',
  REJECTED: 'WORK_ORDER_REJECTED',
  TRANSFERRED: 'WORK_ORDER_TRANSFERRED',
};

// =============================================================================
// 内部辅助函数
// =============================================================================

/**
 * 检查状态转换是否合法
 * 
 * @param fromState - 原状态
 * @param toState - 目标状态
 * @returns 是否合法
 */
export function canTransition(fromState: WorkOrderState, toState: WorkOrderState): boolean {
  const allowedTargets = STATE_TRANSITIONS[fromState];
  return allowedTargets?.includes(toState) ?? false;
}

/**
 * 生成幂等键
 * 
 * @param workOrderId - 工单ID
 * @param action - 操作类型
 * @returns 幂等键
 */
function generateIdempotencyKey(workOrderId: string, action: ApprovalAction): string {
  return `${workOrderId}_${action}_${Date.now()}`;
}

/**
 * 发布状态变更事件
 * 
 * @param event - 状态变更事件
 */
async function publishStateChangedEvent(event: StateChangedEvent): Promise<void> {
  // 通知触发时机：仅在 APPROVED、REJECTED、TRANSFERRED 时触发
  try {
    await request.post('/api/v1/events/state-changed', event);
  } catch (error) {
    // 通知投递失败应写入 notification_failures 表，由补偿 Job 重试
    console.error('Failed to publish state changed event:', error);
    throw error;
  }
}

// =============================================================================
// 核心业务函数
// =============================================================================

/**
 * 审批通过
 * 
 * 将工单状态从 PENDING_APPROVAL 转换为 APPROVED，
 * 并创建审批记录、发布通知事件。
 * 
 * @param workOrderId - 工单ID
 * @param comment - 审批意见（可选）
 * @returns 审批结果
 * 
 * @example
 * ```typescript
 * const result = await approveWorkOrder('WO-001', '同意报废请求');
 * if (result.success) {
 *   console.log('审批通过，记录ID:', result.recordId);
 * }
 * ```
 */
export async function approveWorkOrder(
  workOrderId: string,
  comment?: string
): Promise<ApprovalResult> {
  try {
    const idempotencyKey = generateIdempotencyKey(workOrderId, 'APPROVED');
    
    const response = await request.post<{
      success: boolean;
      workOrderId: string;
      recordId?: string;
      message: string;
    }>(`/api/v1/work-orders/${workOrderId}/approve`, {
      comment,
      idempotencyKey,
    });

    if (response.success) {
      // 发布通知事件
      await publishStateChangedEvent({
        type: 'WORK_ORDER_APPROVED',
        workOrderId,
        fromState: WorkOrderState.PENDING_APPROVAL,
        toState: WorkOrderState.APPROVED,
        actor: 'current_user', // 应从 context 获取
        timestamp: new Date().toISOString(),
      });
    }

    return {
      workOrderId,
      success: response.success,
      message: response.message,
      recordId: response.recordId,
    };
  } catch (error: unknown) {
    const err = error as { response?: { status?: number }; message?: string };
    // 幂等性：同一工单 5 秒内重复提交审批请求，返回 409 Conflict
    if (err.response?.status === 409) {
      return {
        workOrderId,
        success: false,
        message: '重复提交，请稍后重试',
      };
    }
    throw error;
  }
}

/**
 * 审批驳回
 * 
 * 将工单状态从 PENDING_APPROVAL 转换为 REJECTED，
 * 并创建审批记录、发布通知事件。
 * 
 * @param workOrderId - 工单ID
 * @param reason - 驳回原因（必填）
 * @returns 审批结果
 * 
 * @throws {Error} reason 为空时抛出错误
 * 
 * @example
 * ```typescript
 * const result = await rejectWorkOrder('WO-001', '资产尚在使用中，不适合报废');
 * if (result.success) {
 *   console.log('审批驳回，记录ID:', result.recordId);
 * }
 * ```
 */
export async function rejectWorkOrder(
  workOrderId: string,
  reason: string
): Promise<ApprovalResult> {
  // 前端应拦截空提交，但后端仍需校验
  if (!reason || reason.trim() === '') {
    throw new Error('驳回原因不能为空');
  }

  try {
    const idempotencyKey = generateIdempotencyKey(workOrderId, 'REJECTED');
    
    const response = await request.post<{
      success: boolean;
      workOrderId: string;
      recordId?: string;
      message: string;
    }>(`/api/v1/work-orders/${workOrderId}/reject`, {
      reason,
      idempotencyKey,
    });

    if (response.success) {
      // 发布通知事件
      await publishStateChangedEvent({
        type: 'WORK_ORDER_REJECTED',
        workOrderId,
        fromState: WorkOrderState.PENDING_APPROVAL,
        toState: WorkOrderState.REJECTED,
        actor: 'current_user', // 应从 context 获取
        timestamp: new Date().toISOString(),
      });
    }

    return {
      workOrderId,
      success: response.success,
      message: response.message,
      recordId: response.recordId,
    };
  } catch (error: unknown) {
    const err = error as { response?: { status?: number }; message?: string };
    if (err.response?.status === 409) {
      return {
        workOrderId,
        success: false,
        message: '重复提交，请稍后重试',
      };
    }
    throw error;
  }
}

/**
 * 审批转签
 * 
 * 将工单状态从 PENDING_APPROVAL 转换为 TRANSFERRED，
 * 并更新当前审批人为目标审批人。
 * 
 * @param workOrderId - 工单ID
 * @param targetUserId - 目标审批人ID
 * @param reason - 转签原因（可选）
 * @returns 审批结果
 * 
 * @throws {Error} targetUserId 为空时抛出错误
 * 
 * @example
 * ```typescript
 * const result = await transferWorkOrder('WO-001', 'user_Y', '原审批人出差');
 * if (result.success) {
 *   console.log('转签成功，新审批人:', targetUserId);
 * }
 * ```
 */
export async function transferWorkOrder(
  workOrderId: string,
  targetUserId: string,
  reason?: string
): Promise<ApprovalResult> {
  // 转签规则：必须指定目标审批人
  if (!targetUserId || targetUserId.trim() === '') {
    throw new Error('转签目标审批人不能为空');
  }

  try {
    const idempotencyKey = generateIdempotencyKey(workOrderId, 'TRANSFERRED');
    
    const response = await request.post<{
      success: boolean;
      workOrderId: string;
      recordId?: string;
      message: string;
    }>(`/api/v1/work-orders/${workOrderId}/transfer`, {
      targetUserId,
      reason,
      idempotencyKey,
    });

    if (response.success) {
      // 发布通知事件
      await publishStateChangedEvent({
        type: 'WORK_ORDER_TRANSFERRED',
        workOrderId,
        fromState: WorkOrderState.PENDING_APPROVAL,
        toState: WorkOrderState.TRANSFERRED,
        actor: 'current_user', // 应从 context 获取
        timestamp: new Date().toISOString(),
        metadata: {
          targetUserId,
        },
      });
    }

    return {
      workOrderId,
      success: response.success,
      message: response.message,
      recordId: response.recordId,
    };
  } catch (error: unknown) {
    const err = error as { response?: { status?: number }; message?: string };
    if (err.response?.status === 409) {
      return {
        workOrderId,
        success: false,
        message: '重复提交，请稍后重试',
      };
    }
    throw error;
  }
}

/**
 * 获取审批历史
 * 
 * 查询指定工单的审批历史记录列表，
 * 按时间倒序排列。
 * 
 * @param workOrderId - 工单ID
 * @returns 审批历史列表
 * 
 * @example
 * ```typescript
 * const history = await getApprovalHistory('WO-001');
 * history.forEach(item => {
 *   console.log(`${item.action} by ${item.actor} at ${item.createdAt}`);
 * });
 * ```
 */
export async function getApprovalHistory(
  workOrderId: string
): Promise<ApprovalHistoryItem[]> {
  try {
    const response = await request.get<ApprovalHistoryItem[]>(
      `/api/v1/work-orders/${workOrderId}/approval-history`
    );
    return response;
  } catch (error) {
    console.error('Failed to get approval history:', error);
    throw error;
  }
}

// =============================================================================
// 状态机集成接口（供内部测试使用）
// =============================================================================

/**
 * 状态机转换验证接口
 * 用于单元测试和集成测试
 */
export interface StateTransitionResult {
  /** 新状态 */
  newState: WorkOrderState;
  /** 事件是否已发布 */
  eventPublished: boolean;
  /** 错误信息 */
  error?: string;
}

/**
 * 执行状态转换
 * 
 * @param workOrderId - 工单ID
 * @param targetState - 目标状态
 * @param actor - 操作人
 * @param params - 额外参数
 * @returns 转换结果
 */
export async function executeTransition(
  workOrderId: string,
  targetState: WorkOrderState,
  actor: string,
  params?: {
    targetUserId?: string;
    comment?: string;
    reason?: string;
  }
): Promise<StateTransitionResult> {
  try {
    let result: ApprovalResult;

    switch (targetState) {
      case WorkOrderState.APPROVED:
        result = await approveWorkOrder(workOrderId, params?.comment);
        break;
      case WorkOrderState.REJECTED:
        result = await rejectWorkOrder(workOrderId, params?.reason || '');
        break;
      case WorkOrderState.TRANSFERRED:
        if (!params?.targetUserId) {
          return {
            newState: targetState,
            eventPublished: false,
            error: '转签必须指定目标审批人',
          };
        }
        result = await transferWorkOrder(workOrderId, params.targetUserId, params?.reason);
        break;
      default:
        return {
          newState: targetState,
          eventPublished: false,
          error: `不支持的目标状态: ${targetState}`,
        };
    }

    return {
      newState: result.success ? targetState : WorkOrderState.PENDING_APPROVAL,
      eventPublished: result.success,
    };
  } catch (error) {
    return {
      newState: targetState,
      eventPublished: false,
      error: error instanceof Error ? error.message : '未知错误',
    };
  }
}

// =============================================================================
// 导出
// =============================================================================

export default {
  approveWorkOrder,
  rejectWorkOrder,
  transferWorkOrder,
  getApprovalHistory,
  executeTransition,
  canTransition,
  WorkOrderState,
};