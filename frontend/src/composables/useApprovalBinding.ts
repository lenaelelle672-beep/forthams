/**
 * useApprovalBinding — 多级审批工作流绑定 Composable
 *
 * 职责：
 * 1. 将审批动作（通过 / 驳回 / 取消）绑定到工单实体，封装完整的审批交互流程。
 * 2. 前端状态机校验：在发起请求前预校验当前状态是否允许目标动作，减少无效请求。
 * 3. 驳回原因校验：非空、最大 500 字符。
 * 4. 乐观锁版本管理：请求时携带 version，响应后同步更新本地版本。
 * 5. 后端错误码映射：409 Conflict（INVALID_STATE_TRANSITION / OPTIMISTIC_LOCK）、400 Bad Request。
 * 6. 审批记录留痕：维护本地 approvalRecords 列表，支持轮询刷新。
 *
 * 状态机流转（后端严格校验，前端仅做预检）：
 *   PENDING → APPROVING_LEVEL_1 → APPROVING_LEVEL_2 → APPROVED
 *   APPROVING_LEVEL_* → REJECTED
 *   PENDING → CANCELLED
 *
 * @see SPEC Phase 1: 核心审批流与基础工作台
 * @see ATB-1 ~ ATB-5
 */

import { ref, computed, readonly, type Ref, type DeepReadonly } from 'vue'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** 工单审批状态枚举，与后端 OrderStatus 保持一致 */
export type OrderStatus =
  | 'PENDING'
  | 'APPROVING_LEVEL_1'
  | 'APPROVING_LEVEL_2'
  | 'APPROVED'
  | 'REJECTED'
  | 'CANCELLED'

/** 审批动作类型 */
export type ApprovalAction = 'APPROVE' | 'REJECT' | 'CANCEL'

/** 审批记录 */
export interface ApprovalRecord {
  id: string
  orderId: string
  operatorId: string
  operatorName: string
  action: ApprovalAction
  comment: string | null
  rejectionReason: string | null
  createdAt: string // ISO 8601
}

/** 审批请求参数 */
export interface ApproveRequest {
  version: number
}

/** 驳回请求参数 */
export interface RejectRequest {
  rejectionReason: string
  version: number
}

/** 取消请求参数 */
export interface CancelRequest {
  version: number
}

/** 审批操作响应 */
export interface ApprovalResponse {
  id: string
  status: OrderStatus
  version: number
  approvalRecord: ApprovalRecord
}

/** 后端业务错误码 */
export const ApprovalErrorCode = {
  /** 非法状态流转 */
  INVALID_STATE_TRANSITION: 'INVALID_STATE_TRANSITION',
  /** 乐观锁冲突 */
  OPTIMISTIC_LOCK_CONFLICT: 'OPTIMISTIC_LOCK_CONFLICT',
  /** 驳回原因缺失 */
  REJECTION_REASON_REQUIRED: 'REJECTION_REASON_REQUIRED',
  /** 权限不足 */
  PERMISSION_DENIED: 'PERMISSION_DENIED',
} as const

export type ApprovalErrorCodeType =
  (typeof ApprovalErrorCode)[keyof typeof ApprovalErrorCode]

/** 审批操作错误 */
export class ApprovalBindingError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
    public readonly errorCode: ApprovalErrorCodeType | null,
    public readonly action: ApprovalAction,
  ) {
    super(message)
    this.name = 'ApprovalBindingError'
  }
}

// ---------------------------------------------------------------------------
// State Machine — 前端预检表
// ---------------------------------------------------------------------------

/**
 * 合法状态-动作映射表。
 * 前端仅用于 UI 按钮显隐与预校验，最终以服务端状态机为准。
 */
const STATE_ACTION_MAP: Record<OrderStatus, ApprovalAction[]> = {
  PENDING: ['CANCEL'],
  APPROVING_LEVEL_1: ['APPROVE', 'REJECT'],
  APPROVING_LEVEL_2: ['APPROVE', 'REJECT'],
  APPROVED: [],
  REJECTED: [],
  CANCELLED: [],
}

/** 终态集合，终态不允许任何审批动作 */
const TERMINAL_STATES: ReadonlySet<OrderStatus> = new Set([
  'APPROVED',
  'REJECTED',
  'CANCELLED',
])

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** 驳回原因最大长度 */
const MAX_REJECTION_REASON_LENGTH = 500

/** 轮询间隔（毫秒） */
const POLL_INTERVAL_MS = 10_000

// ---------------------------------------------------------------------------
// Composable
// ---------------------------------------------------------------------------

export interface UseApprovalBindingOptions {
  /** 工单实体（响应式引用） */
  order: Ref<WorkOrderBindingTarget | null>
  /** 审批 API 适配器，默认使用内置 fetch 实现 */
  api?: ApprovalApiAdapter
  /** 是否启用自动轮询审批状态，默认 false */
  enablePolling?: boolean
  /** 轮询间隔（毫秒），默认 10000 */
  pollInterval?: number
}

/** 工单绑定目标的最小接口 */
export interface WorkOrderBindingTarget {
  id: string
  status: OrderStatus
  version: number
}

/** 审批 API 适配器接口，便于测试时 mock */
export interface ApprovalApiAdapter {
  approve(orderId: string, body: ApproveRequest): Promise<ApprovalResponse>
  reject(orderId: string, body: RejectRequest): Promise<ApprovalResponse>
  cancel(orderId: string, body: CancelRequest): Promise<ApprovalResponse>
  fetchRecords(orderId: string): Promise<ApprovalRecord[]>
}

/**
 * 默认 API 适配器 — 基于 fetch 的 RESTful 调用。
 * 生产环境可替换为 Axios 封装。
 */
class DefaultApprovalApiAdapter implements ApprovalApiAdapter {
  private readonly baseUrl: string

  constructor(baseUrl = '/api/orders') {
    this.baseUrl = baseUrl
  }

  /** POST /api/orders/{id}/approve */
  async approve(orderId: string, body: ApproveRequest): Promise<ApprovalResponse> {
    const res = await fetch(`${this.baseUrl}/${orderId}/approve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    return this.handleResponse(res)
  }

  /** POST /api/orders/{id}/reject */
  async reject(orderId: string, body: RejectRequest): Promise<ApprovalResponse> {
    const res = await fetch(`${this.baseUrl}/${orderId}/reject`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    return this.handleResponse(res)
  }

  /** POST /api/orders/{id}/cancel */
  async cancel(orderId: string, body: CancelRequest): Promise<ApprovalResponse> {
    const res = await fetch(`${this.baseUrl}/${orderId}/cancel`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    return this.handleResponse(res)
  }

  /** GET /api/orders/{id}/approval-records */
  async fetchRecords(orderId: string): Promise<ApprovalRecord[]> {
    const res = await fetch(`${this.baseUrl}/${orderId}/approval-records`)
    if (!res.ok) {
      throw new ApprovalBindingError(
        '获取审批记录失败',
        res.status,
        null,
        'APPROVE',
      )
    }
    return res.json()
  }

  /** 统一响应处理 */
  private async handleResponse(res: Response): Promise<ApprovalResponse> {
    const data = await res.json().catch(() => ({}))

    if (res.status === 409) {
      const code: string = data?.code ?? ''
      const isInvalidTransition = code === ApprovalErrorCode.INVALID_STATE_TRANSITION
      throw new ApprovalBindingError(
        isInvalidTransition
          ? '工单状态已变更，无法执行此审批操作'
          : '数据已被其他用户修改，请刷新后重试',
        409,
        isInvalidTransition
          ? ApprovalErrorCode.INVALID_STATE_TRANSITION
          : ApprovalErrorCode.OPTIMISTIC_LOCK_CONFLICT,
        'APPROVE',
      )
    }

    if (res.status === 400) {
      throw new ApprovalBindingError(
        data?.message ?? '请求参数校验失败',
        400,
        ApprovalErrorCode.REJECTION_REASON_REQUIRED,
        'REJECT',
      )
    }

    if (res.status === 403) {
      throw new ApprovalBindingError(
        '当前用户无权执行此审批操作',
        403,
        ApprovalErrorCode.PERMISSION_DENIED,
        'APPROVE',
      )
    }

    if (!res.ok) {
      throw new ApprovalBindingError(
        data?.message ?? `审批操作失败 (HTTP ${res.status})`,
        res.status,
        null,
        'APPROVE',
      )
    }

    return data as ApprovalResponse
  }
}

/**
 * useApprovalBinding — 多级审批工作流绑定 Composable
 *
 * @param options - 配置选项
 * @returns 审批绑定状态与操作方法
 *
 * @example
 * ```ts
 * const order = ref({ id: 'WO-001', status: 'APPROVING_LEVEL_1', version: 1 })
 * const {
 *   canApprove, canReject, canCancel,
 *   approve, reject, cancel,
 *   loading, error, errorCode,
 *   approvalRecords, refreshRecords,
 * } = useApprovalBinding({ order })
 * ```
 */
export function useApprovalBinding(options: UseApprovalBindingOptions) {
  const { order, enablePolling = false, pollInterval = POLL_INTERVAL_MS } = options
  const api: ApprovalApiAdapter = options.api ?? new DefaultApprovalApiAdapter()

  // -----------------------------------------------------------------------
  // Reactive State
  // -----------------------------------------------------------------------

  /** 操作进行中标志 */
  const loading = ref(false)

  /** 最近一次操作的错误消息 */
  const error = ref<string | null>(null)

  /** 最近一次操作的错误码 */
  const errorCode = ref<ApprovalErrorCodeType | null>(null)

  /** 最近一次执行的审批动作 */
  const lastAction = ref<ApprovalAction | null>(null)

  /** 审批记录列表 */
  const approvalRecords = ref<ApprovalRecord[]>([])

  /** 轮询定时器 ID */
  let pollTimerId: ReturnType<typeof setInterval> | null = null

  // -----------------------------------------------------------------------
  // Computed — 状态机派生
  // -----------------------------------------------------------------------

  /** 当前工单状态 */
  const currentStatus = computed<OrderStatus | null>(() => order.value?.status ?? null)

  /** 当前工单版本号（乐观锁） */
  const currentVersion = computed<number>(() => order.value?.version ?? 0)

  /** 当前状态是否为终态 */
  const isTerminal = computed<boolean>(() =>
    currentStatus.value !== null && TERMINAL_STATES.has(currentStatus.value),
  )

  /** 当前状态允许的审批动作列表 */
  const availableActions = computed<ApprovalAction[]>(() => {
    const status = currentStatus.value
    if (status === null) return []
    return STATE_ACTION_MAP[status] ?? []
  })

  /** 是否可以执行"通过"操作 */
  const canApprove = computed<boolean>(() => availableActions.value.includes('APPROVE'))

  /** 是否可以执行"驳回"操作 */
  const canReject = computed<boolean>(() => availableActions.value.includes('REJECT'))

  /** 是否可以执行"取消"操作 */
  const canCancel = computed<boolean>(() => availableActions.value.includes('CANCEL'))

  /** 当前审批层级描述（用于 UI 展示） */
  const approvalLevelLabel = computed<string>(() => {
    switch (currentStatus.value) {
      case 'PENDING':
        return '待提交'
      case 'APPROVING_LEVEL_1':
        return '部门主管审批中'
      case 'APPROVING_LEVEL_2':
        return '资产管理员审批中'
      case 'APPROVED':
        return '审批通过'
      case 'REJECTED':
        return '已驳回'
      case 'CANCELLED':
        return '已取消'
      default:
        return '未知状态'
    }
  })

  // -----------------------------------------------------------------------
  // Validation
  // -----------------------------------------------------------------------

  /**
   * 校验驳回原因。
   *
   * @param reason - 驳回原因文本
   * @returns 校验错误消息，null 表示通过
   */
  function validateRejectionReason(reason: string): string | null {
    if (reason === null || reason === undefined) {
      return '驳回原因不能为空'
    }
    const trimmed = reason.trim()
    if (trimmed.length === 0) {
      return '驳回原因不能为空'
    }
    if (trimmed.length > MAX_REJECTION_REASON_LENGTH) {
      return `驳回原因不能超过 ${MAX_REJECTION_REASON_LENGTH} 个字符（当前 ${trimmed.length} 个）`
    }
    return null
  }

  /**
   * 前端状态机预校验：检查当前状态是否允许目标动作。
   *
   * @param action - 目标审批动作
   * @throws {ApprovalBindingError} 当状态不允许该动作时抛出
   */
  function validateStateTransition(action: ApprovalAction): void {
    if (!order.value) {
      throw new ApprovalBindingError(
        '工单数据不存在',
        0,
        null,
        action,
      )
    }

    const allowed = STATE_ACTION_MAP[order.value.status] ?? []
    if (!allowed.includes(action)) {
      throw new ApprovalBindingError(
        `当前状态 "${order.value.status}" 不允许执行 "${action}" 操作`,
        409,
        ApprovalErrorCode.INVALID_STATE_TRANSITION,
        action,
      )
    }
  }

  // -----------------------------------------------------------------------
  // Local State Sync
  // -----------------------------------------------------------------------

  /**
   * 将审批响应同步到本地工单状态。
   *
   * @param response - 审批操作响应
   */
  function syncLocalState(response: ApprovalResponse): void {
    if (order.value && order.value.id === response.id) {
      order.value.status = response.status
      order.value.version = response.version
    }
    // 将新的审批记录插入列表头部
    approvalRecords.value.unshift(response.approvalRecord)
  }

  /**
   * 清除错误状态。
   */
  function clearError(): void {
    error.value = null
    errorCode.value = null
  }

  // -----------------------------------------------------------------------
  // Actions
  // -----------------------------------------------------------------------

  /**
   * 执行审批通过操作。
   *
   * 流程：前端状态预校验 → 携带 version 发起请求 → 同步本地状态。
   *
   * @param orderId - 工单 ID（可选，默认使用绑定工单 ID）
   * @returns 审批响应
   * @throws {ApprovalBindingError} 状态校验失败或请求失败
   */
  async function approve(orderId?: string): Promise<ApprovalResponse> {
    const targetId = orderId ?? order.value?.id
    if (!targetId) {
      throw new ApprovalBindingError('工单 ID 不存在', 0, null, 'APPROVE')
    }

    // 前端预校验
    validateStateTransition('APPROVE')

    loading.value = true
    error.value = null
    errorCode.value = null
    lastAction.value = 'APPROVE'

    try {
      const response = await api.approve(targetId, {
        version: currentVersion.value,
      })
      syncLocalState(response)
      return response
    } catch (err) {
      if (err instanceof ApprovalBindingError) {
        error.value = err.message
        errorCode.value = err.errorCode
      } else {
        error.value = '审批通过操作失败，请稍后重试'
        errorCode.value = null
      }
      throw err
    } finally {
      loading.value = false
    }
  }

  /**
   * 执行驳回操作。
   *
   * 流程：驳回原因校验 → 前端状态预校验 → 携带 version + rejectionReason 发起请求 → 同步本地状态。
   *
   * @param reason - 驳回原因（非空，最大 500 字符）
   * @param orderId - 工单 ID（可选，默认使用绑定工单 ID）
   * @returns 审批响应
   * @throws {ApprovalBindingError} 校验失败或请求失败
   */
  async function reject(reason: string, orderId?: string): Promise<ApprovalResponse> {
    const targetId = orderId ?? order.value?.id
    if (!targetId) {
      throw new ApprovalBindingError('工单 ID 不存在', 0, null, 'REJECT')
    }

    // 驳回原因校验
    const validationError = validateRejectionReason(reason)
    if (validationError) {
      error.value = validationError
      errorCode.value = ApprovalErrorCode.REJECTION_REASON_REQUIRED
      throw new ApprovalBindingError(
        validationError,
        400,
        ApprovalErrorCode.REJECTION_REASON_REQUIRED,
        'REJECT',
      )
    }

    // 前端状态预校验
    validateStateTransition('REJECT')

    loading.value = true
    error.value = null
    errorCode.value = null
    lastAction.value = 'REJECT'

    try {
      const response = await api.reject(targetId, {
        rejectionReason: reason.trim(),
        version: currentVersion.value,
      })
      syncLocalState(response)
      return response
    } catch (err) {
      if (err instanceof ApprovalBindingError) {
        error.value = err.message
        errorCode.value = err.errorCode
      } else {
        error.value = '驳回操作失败，请稍后重试'
        errorCode.value = null
      }
      throw err
    } finally {
      loading.value = false
    }
  }

  /**
   * 执行取消操作（仅 PENDING 状态允许）。
   *
   * @param orderId - 工单 ID（可选，默认使用绑定工单 ID）
   * @returns 审批响应
   * @throws {ApprovalBindingError} 状态校验失败或请求失败
   */
  async function cancel(orderId?: string): Promise<ApprovalResponse> {
    const targetId = orderId ?? order.value?.id
    if (!targetId) {
      throw new ApprovalBindingError('工单 ID 不存在', 0, null, 'CANCEL')
    }

    // 前端状态预校验
    validateStateTransition('CANCEL')

    loading.value = true
    error.value = null
    errorCode.value = null
    lastAction.value = 'CANCEL'

    try {
      const response = await api.cancel(targetId, {
        version: currentVersion.value,
      })
      syncLocalState(response)
      return response
    } catch (err) {
      if (err instanceof ApprovalBindingError) {
        error.value = err.message
        errorCode.value = err.errorCode
      } else {
        error.value = '取消操作失败，请稍后重试'
        errorCode.value = null
      }
      throw err
    } finally {
      loading.value = false
    }
  }

  // -----------------------------------------------------------------------
  // Approval Records
  // -----------------------------------------------------------------------

  /**
   * 刷新审批记录列表。
   *
   * @param orderId - 工单 ID（可选，默认使用绑定工单 ID）
   */
  async function refreshRecords(orderId?: string): Promise<void> {
    const targetId = orderId ?? order.value?.id
    if (!targetId) return

    try {
      approvalRecords.value = await api.fetchRecords(targetId)
    } catch {
      // 静默失败，不影响主流程
    }
  }

  // -----------------------------------------------------------------------
  // Polling
  // -----------------------------------------------------------------------

  /**
   * 启动审批状态轮询。
   * 仅在非终态时轮询，到达终态后自动停止。
   */
  function startPolling(): void {
    stopPolling()
    if (!enablePolling) return

    pollTimerId = setInterval(async () => {
      if (isTerminal.value || !order.value) {
        stopPolling()
        return
      }
      await refreshRecords()
    }, pollInterval)
  }

  /**
   * 停止审批状态轮询。
   */
  function stopPolling(): void {
    if (pollTimerId !== null) {
      clearInterval(pollTimerId)
      pollTimerId = null
    }
  }

  // -----------------------------------------------------------------------
  // Lifecycle
  // -----------------------------------------------------------------------

  /**
   * 清理资源（停止轮询等）。
   * 应在组件 onUnmounted 中调用。
   */
  function dispose(): void {
    stopPolling()
    clearError()
    approvalRecords.value = []
    lastAction.value = null
  }

  // 自动启动轮询
  if (enablePolling) {
    startPolling()
  }

  // -----------------------------------------------------------------------
  // Return
  // -----------------------------------------------------------------------

  return {
    // --- 响应式状态（只读） ---
    loading: readonly(loading) as DeepReadonly<typeof loading>,
    error: readonly(error) as DeepReadonly<typeof error>,
    errorCode: readonly(errorCode) as DeepReadonly<typeof errorCode>,
    lastAction: readonly(lastAction) as DeepReadonly<typeof lastAction>,
    approvalRecords: readonly(approvalRecords) as DeepReadonly<typeof approvalRecords>,

    // --- 计算属性 ---
    currentStatus,
    currentVersion,
    isTerminal,
    availableActions,
    canApprove,
    canReject,
    canCancel,
    approvalLevelLabel,

    // --- 校验方法 ---
    validateRejectionReason,
    validateStateTransition,

    // --- 操作方法 ---
    approve,
    reject,
    cancel,
    refreshRecords,

    // --- 工具方法 ---
    clearError,
    startPolling,
    stopPolling,
    dispose,
  }
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

export type UseApprovalBindingReturn = ReturnType<typeof useApprovalBinding>

export default useApprovalBinding