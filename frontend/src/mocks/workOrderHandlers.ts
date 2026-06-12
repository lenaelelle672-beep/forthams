/**
 * 工单审批流程 Mock Handlers - Iteration 7
 * 
 * 实现 SPEC 中的审批操作：
 * - approve: 审批通过 (PENDING → APPROVED)
 * - reject: 审批驳回 (PENDING → REJECTED)
 * - return: 审批退回 (PENDING → RETURNED)
 * 
 * 状态机流转规则参考 spec/markdown/SWARM-2025-Q2-P0-003-工单审批流程.md
 * 
 * @module mocks/workOrderHandlers
 */

import { http, HttpResponse, delay } from 'msw';

/** 工单操作类型枚举 */
export type OperationType = 'submit' | 'approve' | 'reject' | 'return' | 'resubmit' | 'cancel';

/** Mock 审批流程使用旧版 SPEC DTO，避免与当前真实 WorkOrder 表结构耦合 */
export type MockWorkOrderStatus = 'DRAFT' | 'PENDING' | 'RETURNED' | 'APPROVED' | 'REJECTED' | 'CANCELLED';
export type MockWorkOrderPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export interface MockApprovalHistoryEntry {
  id: string;
  work_order_id: string;
  operation: OperationType;
  operator_id: string;
  comment: string;
  created_at: string;
  previous_status: MockWorkOrderStatus;
  new_status: MockWorkOrderStatus;
}

export interface MockWorkOrder {
  id: string;
  title: string;
  description: string;
  status: MockWorkOrderStatus;
  priority: MockWorkOrderPriority;
  requester_id: string;
  assignee_id: string;
  created_at: string;
  updated_at: string;
  approval_history: MockApprovalHistoryEntry[];
}

interface NotificationTriggerRequest {
  work_order_id?: string;
  status?: MockWorkOrderStatus;
  operator_id?: string;
  created_at?: string;
}

/** 审批操作请求参数 */
export interface ApprovalOperationRequest {
  operation: OperationType;
  comment?: string;
  operator_id: string;
}

/** 审批操作响应 */
export interface ApprovalOperationResponse {
  success: boolean;
  work_order: MockWorkOrder;
  notification_sent: boolean;
  message?: string;
}

/** 状态转换映射表 */
const STATE_TRANSITIONS: Record<string, { targetStatus: MockWorkOrderStatus; allowedOperations: string[] }> = {
  'DRAFT': { targetStatus: 'DRAFT', allowedOperations: ['submit'] },
  'PENDING': { targetStatus: 'PENDING', allowedOperations: ['approve', 'reject', 'return', 'cancel'] },
  'RETURNED': { targetStatus: 'RETURNED', allowedOperations: ['resubmit'] },
  'APPROVED': { targetStatus: 'APPROVED', allowedOperations: [] },
  'REJECTED': { targetStatus: 'REJECTED', allowedOperations: [] },
  'CANCELLED': { targetStatus: 'CANCELLED', allowedOperations: [] },
};

/** 终态枚举 */
const TERMINAL_STATES: MockWorkOrderStatus[] = ['APPROVED', 'REJECTED', 'CANCELLED'];

/** 需要触发通知的状态 */
const NOTIFICATION_TRIGGER_STATES: MockWorkOrderStatus[] = ['APPROVED', 'REJECTED', 'RETURNED'];

/** 模拟工单数据存储 */
let mockWorkOrders: Map<string, MockWorkOrder> = new Map();

/** 幂等性缓存 */
const idempotencyCache: Map<string, { result: ApprovalOperationResponse; timestamp: number }> = new Map();
const IDEMPOTENCY_TTL_MS = 5 * 60 * 1000; // 5 分钟

/**
 * 生成幂等 Key
 * @param workOrderId 工单ID
 * @param operatorId 操作者ID
 * @param operationType 操作类型
 * @returns 幂等 Key
 */
function generateIdempotencyKey(workOrderId: string, operatorId: string, operationType: string): string {
  const timeSlot = Math.floor(Date.now() / IDEMPOTENCY_TTL_MS);
  return `${workOrderId}-${operatorId}-${operationType}-${timeSlot}`;
}

/**
 * 校验状态转换是否合法
 * @param currentStatus 当前状态
 * @param operation 操作类型
 * @returns 是否合法
 */
function isValidTransition(currentStatus: string, operation: string): boolean {
  const transition = STATE_TRANSITIONS[currentStatus];
  if (!transition) return false;
  return transition.allowedOperations.includes(operation);
}

/**
 * 获取操作对应的目标状态
 * @param operation 操作类型
 * @returns 目标状态
 */
function getTargetStatus(operation: OperationType): MockWorkOrderStatus {
  switch (operation) {
    case 'submit':
    case 'resubmit':
      return 'PENDING';
    case 'approve':
      return 'APPROVED';
    case 'reject':
      return 'REJECTED';
    case 'return':
      return 'RETURNED';
    case 'cancel':
      return 'CANCELLED';
    default:
      throw new Error(`Unknown operation: ${operation}`);
  }
}

/**
 * 模拟审批操作执行
 * @param workOrder 工单
 * @param operation 操作类型
 * @param operatorId 操作者ID
 * @param comment 审批意见
 * @returns 审批操作响应
 */
function executeApprovalOperation(
  workOrder: MockWorkOrder,
  operation: OperationType,
  operatorId: string,
  comment?: string
): ApprovalOperationResponse {
  const currentStatus = workOrder.status;

  // ATB-1.4: 终态不可再转换
  if (TERMINAL_STATES.includes(currentStatus)) {
    throw {
      code: 'INVALID_TRANSITION',
      message: `终端状态 ${currentStatus} 不允许任何状态转换`,
      httpStatus: 422
    };
  }

  // ATB-1.7: 无效状态转移校验
  if (!isValidTransition(currentStatus, operation)) {
    throw {
      code: 'INVALID_TRANSITION',
      message: `当前状态 ${currentStatus} 不允许执行 ${operation} 操作`,
      httpStatus: 422
    };
  }

  // 计算目标状态
  const targetStatus = getTargetStatus(operation);

  // 更新工单状态
  const updatedWorkOrder: MockWorkOrder = {
    ...workOrder,
    status: targetStatus,
    updated_at: new Date().toISOString(),
    approval_history: [
      ...(workOrder.approval_history || []),
      {
        id: `ah-${Date.now()}`,
        work_order_id: workOrder.id,
        operation,
        operator_id: operatorId,
        comment: comment || '',
        created_at: new Date().toISOString(),
        previous_status: currentStatus,
        new_status: targetStatus
      }
    ]
  };

  // 检查是否需要触发通知
  const notificationSent = NOTIFICATION_TRIGGER_STATES.includes(targetStatus);

  return {
    success: true,
    work_order: updatedWorkOrder,
    notification_sent: notificationSent,
    message: `工单 ${operation} 操作成功`
  };
}

/**
 * 工作单审批操作 Handler
 * POST /api/work-orders/:id/operate
 * 
 * ATB-3: 审批 API 接口测试
 */
export const workOrderApproveHandler = http.post<
  { id: string },
  ApprovalOperationRequest
>(
  '/api/work-orders/:id/operate',
  async ({ params, request }) => {
    // 模拟网络延迟 100-300ms
    await delay(100 + Math.random() * 200);

    const workOrderId = params.id;
    const body = await request.json();
    const { operation, comment, operator_id } = body as ApprovalOperationRequest;

    // ATB-3.2: 必填字段校验
    if (!operation) {
      return HttpResponse.json(
        {
          success: false,
          error: 'operation is required',
          code: 'MISSING_REQUIRED_FIELD'
        },
        { status: 400 }
      );
    }

    if (!operator_id) {
      return HttpResponse.json(
        {
          success: false,
          error: 'operator_id is required',
          code: 'MISSING_REQUIRED_FIELD'
        },
        { status: 400 }
      );
    }

    // 查找工单
    let workOrder = mockWorkOrders.get(workOrderId);

    // 如果 mock 中没有，创建一个模拟工单用于测试
    if (!workOrder) {
      // 模拟工单不存在的情况 (ATB-3.3)
      // 这里返回模拟数据以便测试
      workOrder = {
        id: workOrderId,
        title: `工单-${workOrderId}`,
        description: '测试工单',
        status: 'PENDING',
        priority: 'MEDIUM',
        requester_id: 'user-001',
        assignee_id: operator_id,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        approval_history: []
      };
      mockWorkOrders.set(workOrderId, workOrder);
    }

    // 幂等性检查 (ATB-2)
    const idempotencyKey = generateIdempotencyKey(workOrderId, operator_id, operation);
    const cachedResult = idempotencyCache.get(idempotencyKey);

    if (cachedResult && Date.now() - cachedResult.timestamp < IDEMPOTENCY_TTL_MS) {
      // 在幂等窗口内，返回缓存结果 (ATB-2.1)
      return HttpResponse.json(cachedResult.result);
    }

    // ATB-1.6: 自审禁止校验
    if (operation === 'approve' && workOrder.requester_id === operator_id) {
      return HttpResponse.json(
        {
          success: false,
          error: '禁止自审',
          code: 'SELF_APPROVAL_FORBIDDEN'
        },
        { status: 403 }
      );
    }

    try {
      const result = executeApprovalOperation(workOrder, operation as OperationType, operator_id, comment);

      // 更新 mock 数据
      mockWorkOrders.set(workOrderId, result.work_order);

      // 缓存结果
      idempotencyCache.set(idempotencyKey, {
        result,
        timestamp: Date.now()
      });

      // ATB-3.1: 正常审批响应
      return HttpResponse.json(result);

    } catch (error: any) {
      if (error.httpStatus === 422) {
        // ATB-1.4, ATB-1.7: 无效状态转换
        return HttpResponse.json(
          {
            success: false,
            error: error.message,
            code: 'INVALID_TRANSITION'
          },
          { status: 422 }
        );
      }

      if (error.code === 'SELF_APPROVAL_FORBIDDEN') {
        // ATB-1.6: 自审禁止
        return HttpResponse.json(
          {
            success: false,
            error: error.message,
            code: 'SELF_APPROVAL_FORBIDDEN'
          },
          { status: 403 }
        );
      }

      // 其他错误
      return HttpResponse.json(
        {
          success: false,
          error: error.message || '审批操作失败',
          code: 'INTERNAL_ERROR'
        },
        { status: 500 }
      );
    }
  }
);

/**
 * 工单详情查询 Handler
 * GET /api/work-orders/:id
 */
export const workOrderDetailHandler = http.get<{ id: string }>(
  '/api/work-orders/:id',
  async ({ params }) => {
    await delay(50 + Math.random() * 50);

    const workOrderId = params.id;
    const workOrder = mockWorkOrders.get(workOrderId);

    if (!workOrder) {
      return HttpResponse.json(
        {
          success: false,
          error: 'WORK_ORDER_NOT_FOUND',
          code: 'WORK_ORDER_NOT_FOUND'
        },
        { status: 404 }
      );
    }

    return HttpResponse.json({
      success: true,
      data: workOrder
    });
  }
);

/**
 * 工单列表查询 Handler
 * GET /api/work-orders
 */
export const workOrderListHandler = http.get(
  '/api/work-orders',
  async ({ request }) => {
    await delay(100 + Math.random() * 100);

    const url = new URL(request.url);
    const status = url.searchParams.get('status');
    const page = parseInt(url.searchParams.get('page') || '1', 10);
    const pageSize = parseInt(url.searchParams.get('page_size') || '20', 10);

    let workOrders = Array.from(mockWorkOrders.values());

    // 状态过滤
    if (status) {
      workOrders = workOrders.filter(wo => wo.status === status);
    }

    // 分页
    const startIndex = (page - 1) * pageSize;
    const endIndex = startIndex + pageSize;
    const paginatedWorkOrders = workOrders.slice(startIndex, endIndex);

    return HttpResponse.json({
      success: true,
      data: paginatedWorkOrders,
      pagination: {
        page,
        page_size: pageSize,
        total: workOrders.length,
        total_pages: Math.ceil(workOrders.length / pageSize)
      }
    });
  }
);

/**
 * ATB-4: 通知机制 Mock Handler
 * 模拟通知触发后的回调
 */
export const notificationTriggerHandler = http.post(
  '/api/notifications/trigger',
  async ({ request }) => {
    await delay(50);

    const body = await request.json() as NotificationTriggerRequest;
    const { work_order_id, status, operator_id, created_at } = body;

    // ATB-4.1-4.4: 验证通知内容
    if (!work_order_id || !status || !operator_id || !created_at) {
      return HttpResponse.json(
        {
          success: false,
          error: 'Missing required notification fields'
        },
        { status: 400 }
      );
    }

    // 验证时间戳精确到秒
    const timestamp = new Date(created_at);
    if (isNaN(timestamp.getTime())) {
      return HttpResponse.json(
        {
          success: false,
          error: 'Invalid timestamp format'
        },
        { status: 400 }
      );
    }

    return HttpResponse.json({
      success: true,
      notification_id: `notif-${Date.now()}`,
      delivered: true
    });
  }
);

/**
 * 初始化测试工单数据
 * 用于集成测试前初始化状态
 */
export function initializeMockWorkOrders(testData?: MockWorkOrder[]): void {
  mockWorkOrders.clear();
  
  const defaultWorkOrders: MockWorkOrder[] = testData || [
    {
      id: 'WO-2025-0001',
      title: '测试工单-待审批',
      description: '用于测试审批流程的工单',
      status: 'PENDING',
      priority: 'HIGH',
      requester_id: 'user-001',
      assignee_id: 'user-002',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      approval_history: []
    },
    {
      id: 'WO-2025-0002',
      title: '测试工单-已通过',
      description: '已审批通过的工单',
      status: 'APPROVED',
      priority: 'MEDIUM',
      requester_id: 'user-001',
      assignee_id: 'user-002',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      approval_history: []
    },
    {
      id: 'WO-2025-0003',
      title: '测试工单-已退回',
      description: '被退回需修改的工单',
      status: 'RETURNED',
      priority: 'LOW',
      requester_id: 'user-003',
      assignee_id: 'user-002',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      approval_history: []
    }
  ];

  defaultWorkOrders.forEach(wo => {
    mockWorkOrders.set(wo.id, wo);
  });
}

/**
 * 清除幂等性缓存
 * 用于测试隔离
 */
export function clearIdempotencyCache(): void {
  idempotencyCache.clear();
}

/**
 * 重置所有 Mock 数据
 */
export function resetMockData(): void {
  mockWorkOrders.clear();
  idempotencyCache.clear();
}

/** 导出所有 handlers */
export const workOrderHandlers = [
  workOrderApproveHandler,
  workOrderDetailHandler,
  workOrderListHandler,
  notificationTriggerHandler
];
