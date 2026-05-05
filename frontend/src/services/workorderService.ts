/**
 * WorkOrder Service - 工单审批流程服务
 * 
 * 提供工单审批相关的前端服务层封装，包括：
 * - 审批列表查询
 * - 审批详情查询
 * - 审批通过/拒绝操作
 * - 状态机状态枚举定义
 * 
 * @version SWARM-2025-Q2-P0-003-Iteration-8
 */

import { http } from '@/utils/http';
import type { AxiosRequestConfig } from 'axios';

// ==================== 类型定义 ====================

/**
 * 工单状态枚举
 * @description 定义工单的全生命周期状态
 */
export enum WorkOrderState {
  /** 待审批 - 初始状态，等待审批人员处理 */
  PENDING = 'PENDING',
  /** 审批中 - 正在审批流程中 */
  IN_PROGRESS = 'IN_PROGRESS',
  /** 已通过 - 审批通过 */
  APPROVED = 'APPROVED',
  /** 已拒绝 - 审批被拒绝 */
  REJECTED = 'REJECTED',
  /** 已关闭 - 工单已关闭/归档 */
  CLOSED = 'CLOSED'
}

/**
 * 审批操作类型
 */
export enum ApprovalAction {
  APPROVE = 'APPROVE',
  REJECT = 'REJECT'
}

/**
 * 工单基础信息
 */
export interface WorkOrderBase {
  id: string;
  title: string;
  content?: string;
  state: WorkOrderState;
  version: number;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * 工单列表项（用于审批列表页）
 */
export interface WorkOrderListItem {
  id: string;
  title: string;
  creator: string;
  createdAt: string;
  state: WorkOrderState;
}

/**
 * 工单详情（用于审批详情页）
 */
export interface WorkOrderDetail extends WorkOrderBase {
  content: string;
  attachments?: string[];
  history: ApprovalHistoryItem[];
}

/**
 * 审批历史记录项
 */
export interface ApprovalHistoryItem {
  id: string;
  operatorId: string;
  operatorName: string;
  action: ApprovalAction;
  reason?: string;
  createdAt: string;
}

/**
 * 审批通过请求参数
 * @description 审批通过时提交的参数
 */
export interface ApproveRequest {
  /** 工单ID */
  id: string;
  /** 审批意见（可选，最大500字符） */
  reason?: string;
  /** 版本号（用于乐观锁冲突检测） */
  version: number;
}

/**
 * 审批拒绝请求参数
 * @description 审批拒绝时提交的参数
 */
export interface RejectRequest {
  /** 工单ID */
  id: string;
  /** 审批意见（可选，最大500字符） */
  reason?: string;
  /** 版本号（用于乐观锁冲突检测） */
  version: number;
}

/**
 * 审批响应
 * @description 审批操作后的响应数据
 */
export interface ApprovalResponse {
  id: string;
  state: WorkOrderState;
  version: number;
  updatedAt: string;
}

/**
 * 工单列表响应
 * @description 分页工单列表响应
 */
export interface WorkOrderListResponse {
  items: WorkOrderListItem[];
  total: number;
  page: number;
  pageSize: number;
}

/**
 * 审批列表查询参数
 */
export interface PendingListQuery {
  page?: number;
  pageSize?: number;
  state?: WorkOrderState;
}

/**
 * 审批错误信息
 */
export interface ApprovalError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
}

// ==================== 常量定义 ====================

/**
 * API 基础路径
 */
const API_BASE_PATH = '/api/v1/work-orders';

/**
 * 审批意见最大字符数
 */
const MAX_REASON_LENGTH = 500;

/**
 * 默认分页大小
 */
const DEFAULT_PAGE_SIZE = 20;

/**
 * 审批超时时间（毫秒）
 * @description 根据规格要求，响应时间不超过2秒
 */
const APPROVAL_TIMEOUT = 2000;

// ==================== 工具函数 ====================

/**
 * 验证审批意见长度
 * @param reason - 审批意见
 * @returns 是否有效
 */
function validateReasonLength(reason?: string): boolean {
  if (!reason) return true;
  return reason.length <= MAX_REASON_LENGTH;
}

/**
 * 创建审批请求配置
 * @param data - 请求数据
 * @param timeout - 超时时间
 * @returns Axios请求配置
 */
function createApprovalConfig<T>(
  data: T,
  timeout: number = APPROVAL_TIMEOUT
): AxiosRequestConfig {
  return {
    timeout,
    headers: {
      'Content-Type': 'application/json'
    }
  };
}

// ==================== 服务类 ====================

/**
 * 工单服务类
 * @description 提供工单审批流程的完整服务封装
 */
export class WorkOrderService {
  /**
   * 获取待审批工单列表
   * @description 查询当前用户的待审批工单列表
   * @param query - 查询参数
   * @returns 工单列表响应
   * 
   * @example
   * ```ts
   * const result = await WorkOrderService.getPendingList({ page: 1, pageSize: 20 });
   * console.log(result.items);
   * ```
   */
  static async getPendingList(
    query: PendingListQuery = {}
  ): Promise<WorkOrderListResponse> {
    const { page = 1, pageSize = DEFAULT_PAGE_SIZE, state = WorkOrderState.PENDING } = query;
    
    const params = new URLSearchParams({
      page: String(page),
      pageSize: String(pageSize),
      state
    });

    const response = await http.get<WorkOrderListResponse>(
      `${API_BASE_PATH}/pending?${params.toString()}`
    );

    return response.data;
  }

  /**
   * 获取工单详情
   * @description 获取指定工单的完整信息
   * @param id - 工单ID
   * @returns 工单详情
   * 
   * @example
   * ```ts
   * const detail = await WorkOrderService.getDetail('WO-2025-001');
   * console.log(detail.content, detail.history);
   * ```
   */
  static async getDetail(id: string): Promise<WorkOrderDetail> {
    const response = await http.get<WorkOrderDetail>(`${API_BASE_PATH}/${id}`);
    return response.data;
  }

  /**
   * 审批通过
   * @description 同意工单申请，执行审批通过操作
   * @param request - 审批请求参数
   * @returns 审批响应
   * @throws {Error} 当版本号冲突时抛出错误
   * 
   * @example
   * ```ts
   * const result = await WorkOrderService.approve({
   *   id: 'WO-2025-001',
   *   reason: '同意此工单申请',
   *   version: 1
   * });
   * ```
   */
  static async approve(request: ApproveRequest): Promise<ApprovalResponse> {
    const { id, reason, version } = request;

    // 参数校验
    if (!validateReasonLength(reason)) {
      return Promise.reject({
        code: 'REASON_TOO_LONG',
        message: `审批意见不能超过${MAX_REASON_LENGTH}个字符`
      });
    }

    const response = await http.post<ApprovalResponse>(
      `${API_BASE_PATH}/${id}/approve`,
      { reason, version },
      createApprovalConfig({ id, reason, version })
    );

    return response.data;
  }

  /**
   * 审批拒绝
   * @description 拒绝工单申请，执行审批拒绝操作
   * @param request - 审批请求参数
   * @returns 审批响应
   * @throws {Error} 当版本号冲突时抛出错误
   * 
   * @example
   * ```ts
   * const result = await WorkOrderService.reject({
   *   id: 'WO-2025-001',
   *   reason: '申请理由不充分',
   *   version: 1
   * });
   * ```
   */
  static async reject(request: RejectRequest): Promise<ApprovalResponse> {
    const { id, reason, version } = request;

    // 参数校验
    if (!validateReasonLength(reason)) {
      return Promise.reject({
        code: 'REASON_TOO_LONG',
        message: `审批意见不能超过${MAX_REASON_LENGTH}个字符`
      });
    }

    const response = await http.post<ApprovalResponse>(
      `${API_BASE_PATH}/${id}/reject`,
      { reason, version },
      createApprovalConfig({ id, reason, version })
    );

    return response.data;
  }

  /**
   * 检查状态转换是否合法
   * @description 根据状态机规则判断状态转换是否允许
   * @param currentState - 当前状态
   * @param targetState - 目标状态
   * @returns 是否允许转换
   * 
   * @example
   * ```ts
   * const canTransition = WorkOrderService.canTransition(
   *   WorkOrderState.PENDING,
   *   WorkOrderState.APPROVED
   * );
   * ```
   */
  static canTransition(currentState: WorkOrderState, targetState: WorkOrderState): boolean {
    // 状态转换规则定义
    const validTransitions: Record<WorkOrderState, WorkOrderState[]> = {
      [WorkOrderState.PENDING]: [WorkOrderState.IN_PROGRESS, WorkOrderState.REJECTED],
      [WorkOrderState.IN_PROGRESS]: [WorkOrderState.APPROVED, WorkOrderState.REJECTED],
      [WorkOrderState.APPROVED]: [WorkOrderState.CLOSED],
      [WorkOrderState.REJECTED]: [WorkOrderState.PENDING], // 可退回至发起状态
      [WorkOrderState.CLOSED]: [] // 终态，不可转换
    };

    return validTransitions[currentState]?.includes(targetState) ?? false;
  }

  /**
   * 获取状态显示文本
   * @description 根据状态枚举值获取友好的显示文本
   * @param state - 状态枚举值
   * @returns 显示文本
   */
  static getStateDisplayText(state: WorkOrderState): string {
    const stateDisplayMap: Record<WorkOrderState, string> = {
      [WorkOrderState.PENDING]: '待审批',
      [WorkOrderState.IN_PROGRESS]: '审批中',
      [WorkOrderState.APPROVED]: '已通过',
      [WorkOrderState.REJECTED]: '已拒绝',
      [WorkOrderState.CLOSED]: '已关闭'
    };

    return stateDisplayMap[state] ?? '未知状态';
  }

  /**
   * 获取状态对应的颜色
   * @description 根据状态枚举值获取对应的UI颜色标识
   * @param state - 状态枚举值
   * @returns 颜色值
   */
  static getStateColor(state: WorkOrderState): string {
    const stateColorMap: Record<WorkOrderState, string> = {
      [WorkOrderState.PENDING]: '#FFA500', // 橙色
      [WorkOrderState.IN_PROGRESS]: '#1890FF', // 蓝色
      [WorkOrderState.APPROVED]: '#52C41A', // 绿色
      [WorkOrderState.REJECTED]: '#F5222D', // 红色
      [WorkOrderState.CLOSED]: '#8C8C8C' // 灰色
    };

    return stateColorMap[state] ?? '#8C8C8C';
  }
}

// ==================== 导出快捷函数 ====================

/**
 * 获取待审批工单列表
 * @deprecated 请使用 WorkOrderService.getPendingList
 */
export const getPendingWorkOrders = (query?: PendingListQuery) =>
  WorkOrderService.getPendingList(query);

/**
 * 获取工单详情
 * @deprecated 请使用 WorkOrderService.getDetail
 */
export const getWorkOrderDetail = (id: string) =>
  WorkOrderService.getDetail(id);

/**
 * 审批通过工单
 * @deprecated 请使用 WorkOrderService.approve
 */
export const approveWorkOrder = (request: ApproveRequest) =>
  WorkOrderService.approve(request);

/**
 * 审批拒绝工单
 * @deprecated 请使用 WorkOrderService.reject
 */
export const rejectWorkOrder = (request: RejectRequest) =>
  WorkOrderService.reject(request);

// ==================== 导出类型常量 ====================

export {
  API_BASE_PATH,
  MAX_REASON_LENGTH,
  DEFAULT_PAGE_SIZE,
  APPROVAL_TIMEOUT
};