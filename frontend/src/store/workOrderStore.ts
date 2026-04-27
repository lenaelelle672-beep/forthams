/**
 * Work Order Store — SWARM-001 工单审批流程
 *
 * 核心职责:
 *  - 管理工单状态机的前端视图状态（基于 DRAFT/PENDING/APPROVED/REJECTED/CLOSED 五状态）
 *  - 与后端 API 交互，驱动状态转换事件（SUBMIT / APPROVE / REJECT / CLOSE）
 *  - 触发通知事件（SUBMIT → 通知审批人；其余事件 → 通知申请人）
 *  - 维护状态变更审计历史
 *
 * 状态机定义:
 *   DRAFT → PENDING → APPROVED → CLOSED
 *                ↓
 *            REJECTED → CLOSED
 *
 * CLOSED 为终态，不可逆。
 */

import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import type {
  WorkOrder,
  WorkOrderCreatePayload,
  WorkOrderState,
  WorkOrderEvent,
  WorkOrderTransitionResult,
  WorkOrderAuditEntry,
} from '@/types/workorder.types';
import { workOrderApi } from '@/api/workorder';

// ---------------------------------------------------------------------------
// 状态机规则（与 backend/state_machine/workorder_state.py 保持一致）
// ---------------------------------------------------------------------------

/** 合法的状态转换映射表: from_state + event → to_state */
const STATE_TRANSITION_MAP: Record<string, Record<string, WorkOrderState>> = {
  DRAFT: {
    SUBMIT: 'PENDING',
  },
  PENDING: {
    APPROVE: 'APPROVED',
    REJECT: 'REJECTED',
  },
  APPROVED: {
    CLOSE: 'CLOSED',
  },
  REJECTED: {
    CLOSE: 'CLOSED',
  },
};

/** 终态集合 — 禁止从终态触发任何事件 */
const TERMINAL_STATES: WorkOrderState[] = ['CLOSED'];

/**
 * 校验状态转换是否合法
 * @param currentState 当前状态
 * @param event 触发事件
 * @returns 合法转换的目标状态，或 null（非法转换）
 */
function validateTransition(
  currentState: WorkOrderState,
  event: WorkOrderEvent
): WorkOrderState | null {
  if (TERMINAL_STATES.includes(currentState)) {
    return null;
  }
  const nextState = STATE_TRANSITION_MAP[currentState]?.[event];
  return nextState ?? null;
}

// ---------------------------------------------------------------------------
// Store 定义
// ---------------------------------------------------------------------------

export interface WorkOrderStoreState {
  /** 当前工单列表 */
  workOrders: WorkOrder[];
  /** 正在操作的工单 ID */
  activeWorkOrderId: string | null;
  /** 加载状态 */
  loading: boolean;
  /** 错误信息 */
  error: string | null;
  /** 状态变更历史缓存 */
  auditLogCache: Record<string, WorkOrderAuditEntry[]>;
}

export const useWorkOrderStore = defineStore('workOrder', () => {
  // -------------------------------------------------------------------------
  // State
  // -------------------------------------------------------------------------
  const workOrders = ref<WorkOrder[]>([]);
  const activeWorkOrderId = ref<string | null>(null);
  const loading = ref(false);
  const error = ref<string | null>(null);
  const auditLogCache = ref<Record<string, WorkOrderAuditEntry[]>>({});

  // -------------------------------------------------------------------------
  // Getters
  // -------------------------------------------------------------------------

  const activeWorkOrder = computed<WorkOrder | null>(() =>
    workOrders.value.find((wo) => wo.id === activeWorkOrderId.value) ?? null
  );

  const draftWorkOrders = computed<WorkOrder[]>(() =>
    workOrders.value.filter((wo) => wo.current_state === 'DRAFT')
  );

  const pendingWorkOrders = computed<WorkOrder[]>(() =>
    workOrders.value.filter((wo) => wo.current_state === 'PENDING')
  );

  const closedWorkOrders = computed<WorkOrder[]>(() =>
    workOrders.value.filter((wo) => wo.current_state === 'CLOSED')
  );

  const isLoading = computed<boolean>(() => loading.value);

  const hasError = computed<boolean>(() => error.value !== null);

  /**
   * 根据工单 ID 获取其状态变更历史
   */
  function getAuditLog(workOrderId: string): WorkOrderAuditEntry[] {
    return auditLogCache.value[workOrderId] ?? [];
  }

  /**
   * 判断指定工单是否处于终态
   */
  function isTerminalState(workOrderId: string): boolean {
    const wo = workOrders.value.find((w) => w.id === workOrderId);
    return wo ? TERMINAL_STATES.includes(wo.current_state) : false;
  }

  /**
   * 获取当前用户对指定工单可执行的动作列表
   */
  function getAvailableActions(workOrderId: string): WorkOrderEvent[] {
    const wo = workOrders.value.find((w) => w.id === workOrderId);
    if (!wo || TERMINAL_STATES.includes(wo.current_state)) {
      return [];
    }
    const stateTransitions = STATE_TRANSITION_MAP[wo.current_state];
    return stateTransitions ? (Object.keys(stateTransitions) as WorkOrderEvent[]) : [];
  }

  // -------------------------------------------------------------------------
  // Actions
  // -------------------------------------------------------------------------

  /**
   * 加载工单列表
   */
  async function fetchWorkOrders(): Promise<void> {
    loading.value = true;
    error.value = null;
    try {
      const data = await workOrderApi.list();
      workOrders.value = data;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : '加载工单列表失败';
      error.value = message;
      throw new Error(message);
    } finally {
      loading.value = false;
    }
  }

  /**
   * 创建新工单（初始状态为 DRAFT）
   */
  async function createWorkOrder(
    payload: WorkOrderCreatePayload
  ): Promise<WorkOrder> {
    loading.value = true;
    error.value = null;
    try {
      const newWorkOrder = await workOrderApi.create(payload);
      workOrders.value.push(newWorkOrder);
      return newWorkOrder;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : '创建工单失败';
      error.value = message;
      throw new Error(message);
    } finally {
      loading.value = false;
    }
  }

  /**
   * 更新工单（仅允许 DRAFT 状态修改）
   */
  async function updateWorkOrder(
    workOrderId: string,
    payload: Partial<WorkOrderCreatePayload>
  ): Promise<void> {
    const wo = workOrders.value.find((w) => w.id === workOrderId);
    if (!wo) {
      throw new Error('工单不存在');
    }
    if (wo.current_state !== 'DRAFT') {
      throw new Error('仅草稿状态的工单允许修改');
    }
    loading.value = true;
    error.value = null;
    try {
      const updated = await workOrderApi.update(workOrderId, payload);
      const index = workOrders.value.findIndex((w) => w.id === workOrderId);
      if (index !== -1) {
        workOrders.value[index] = updated;
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : '更新工单失败';
      error.value = message;
      throw new Error(message);
    } finally {
      loading.value = false;
    }
  }

  /**
   * 内部执行状态转换（带前端预校验 + 后端实际转换）
   *
   * 前端预校验用于即时反馈；后端为实际可信数据源。
   * 两层校验确保用户体验与数据一致性兼得。
   *
   * @param workOrderId 工单 ID
   * @param event 触发事件（SUBMIT / APPROVE / REJECT / CLOSE）
   * @param extra 额外参数（如驳回原因 reject_reason）
   */
  async function _executeTransition(
    workOrderId: string,
    event: WorkOrderEvent,
    extra?: Record<string, unknown>
  ): Promise<WorkOrderTransitionResult> {
    const wo = workOrders.value.find((w) => w.id === workOrderId);
    if (!wo) {
      throw new Error('工单不存在');
    }

    // 前端预校验
    const nextState = validateTransition(wo.current_state, event);
    if (!nextState) {
      throw new Error(
        `非法状态转换: 当前状态 [${wo.current_state}] 不可接受事件 [${event}]`
      );
    }

    loading.value = true;
    error.value = null;
    try {
      let result: WorkOrderTransitionResult;

      switch (event) {
        case 'SUBMIT':
          result = await workOrderApi.submit(workOrderId);
          // 通知: SUBMIT 事件触发 → 通知审批人（由后端 notification_service 处理）
          break;
        case 'APPROVE':
          result = await workOrderApi.approve(workOrderId);
          // 通知: APPROVE 事件触发 → 通知申请人（由后端 notification_service 处理）
          break;
        case 'REJECT':
          if (!extra?.reject_reason) {
            throw new Error('驳回工单必须提供原因（reject_reason）');
          }
          result = await workOrderApi.reject(workOrderId, {
            reject_reason: extra.reject_reason as string,
          });
          // 通知: REJECT 事件触发 → 通知申请人（由后端 notification_service 处理）
          break;
        case 'CLOSE':
          result = await workOrderApi.close(workOrderId);
          // 通知: CLOSE 事件触发 → 通知申请人（由后端 notification_service 处理）
          break;
        default:
          throw new Error(`未知事件类型: ${event}`);
      }

      // 同步前端状态
      const index = workOrders.value.findIndex((w) => w.id === workOrderId);
      if (index !== -1) {
        workOrders.value[index] = {
          ...workOrders.value[index],
          current_state: result.new_state,
          updated_at: result.transitioned_at,
        };
      }

      return result;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : '状态转换失败';
      error.value = message;
      throw new Error(message);
    } finally {
      loading.value = false;
    }
  }

  /**
   * 提交工单（DRAFT → PENDING）
   */
  async function submitWorkOrder(workOrderId: string): Promise<WorkOrderTransitionResult> {
    return _executeTransition(workOrderId, 'SUBMIT');
  }

  /**
   * 审批通过（PENDING → APPROVED）
   */
  async function approveWorkOrder(workOrderId: string): Promise<WorkOrderTransitionResult> {
    return _executeTransition(workOrderId, 'APPROVE');
  }

  /**
   * 审批驳回（PENDING → REJECTED）
   * @param reason 驳回原因
   */
  async function rejectWorkOrder(
    workOrderId: string,
    reason: string
  ): Promise<WorkOrderTransitionResult> {
    return _executeTransition(workOrderId, 'REJECT', { reject_reason: reason });
  }

  /**
   * 关闭工单（APPROVED/REJECTED → CLOSED）
   */
  async function closeWorkOrder(workOrderId: string): Promise<WorkOrderTransitionResult> {
    return _executeTransition(workOrderId, 'CLOSE');
  }

  /**
   * 加载工单详情
   */
  async function fetchWorkOrderById(workOrderId: string): Promise<WorkOrder> {
    loading.value = true;
    error.value = null;
    try {
      const wo = await workOrderApi.getById(workOrderId);
      const index = workOrders.value.findIndex((w) => w.id === workOrderId);
      if (index !== -1) {
        workOrders.value[index] = wo;
      } else {
        workOrders.value.push(wo);
      }
      activeWorkOrderId.value = workOrderId;
      return wo;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : '加载工单详情失败';
      error.value = message;
      throw new Error(message);
    } finally {
      loading.value = false;
    }
  }

  /**
   * 加载工单状态变更历史（审计日志）
   */
  async function fetchAuditLog(workOrderId: string): Promise<WorkOrderAuditEntry[]> {
    try {
      const log = await workOrderApi.getAuditLog(workOrderId);
      auditLogCache.value[workOrderId] = log;
      return log;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : '加载审计日志失败';
      error.value = message;
      throw new Error(message);
    }
  }

  /**
   * 清空错误状态
   */
  function clearError(): void {
    error.value = null;
  }

  /**
   * 重置 store 状态
   */
  function $reset(): void {
    workOrders.value = [];
    activeWorkOrderId.value = null;
    loading.value = false;
    error.value = null;
    auditLogCache.value = {};
  }

  return {
    // State
    workOrders,
    activeWorkOrderId,
    loading,
    error,
    auditLogCache,
    // Getters
    activeWorkOrder,
    draftWorkOrders,
    pendingWorkOrders,
    closedWorkOrders,
    isLoading,
    hasError,
    getAuditLog,
    isTerminalState,
    getAvailableActions,
    // Actions
    fetchWorkOrders,
    createWorkOrder,
    updateWorkOrder,
    submitWorkOrder,
    approveWorkOrder,
    rejectWorkOrder,
    closeWorkOrder,
    fetchWorkOrderById,
    fetchAuditLog,
    clearError,
    $reset,
    // Expose for testing
    _validateTransition: validateTransition,
  };
});