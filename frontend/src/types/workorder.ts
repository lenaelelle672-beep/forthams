/**
 * @file types/workorder.ts
 * @description 工单管理核心类型 — 权威版本（整合自 workorder.types.ts + approval.ts）
 *
 * 注意：
 * - PaginatedResponse 统一从 types/common.ts 导入，此处不重复定义
 * - 工单 id 为 number（后端 Long）
 */

export {
  WorkOrderStatus,
  ApprovalAction,
  ApprovalLevel,
  WorkOrderPriority,
  WorkOrderType,
  WorkOrderErrorCode,
  VALID_TRANSITIONS,
  WORK_ORDER_STATUS_CONFIG,
  APPROVAL_LEVEL_CONFIG,
  isValidTransition,
} from './workorder.types';

export type {
  WorkOrder,
  ApprovalRecord,
  CreateWorkOrderRequest,
  SubmitWorkOrderRequest,
  ApproveWorkOrderRequest,
  RejectWorkOrderRequest,
  CancelWorkOrderRequest,
  WorkOrderListQuery,
  ApprovalListQuery,
  WorkOrderListItem,
  ApprovalListItem,
  ApprovalActionResponse,
  WorkOrderDetailResponse,
  ApprovalDashboardStats,
  ApprovalFormData,
  ApprovalFormValidation,
  ApprovalFormError,
  WorkOrderStatusConfig,
} from './workorder.types';
