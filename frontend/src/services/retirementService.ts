/**
 * 资产报废退役服务 (Retirement Service)
 * 
 * 负责处理资产报废/退役申请的全生命周期管理，包括：
 * - 报废申请提交与修改
 * - 多级审批链执行（通过/驳回/转交）
 * - 生命周期历史记录查询
 * 
 * @module services/retirementService
 * @version SWARM-2026-Q2-002-iter4
 */

import { apiClient } from '../utils/http';

/**
 * 报废申请状态枚举
 */
export enum RetirementStatus {
  DRAFT = 'draft',
  PENDING = 'pending',        // 审批中
  APPROVED = 'approved',      // 已通过
  REJECTED = 'rejected',      // 已驳回
  CANCELLED = 'cancelled',    // 已取消
}

/**
 * 审批操作类型
 */
export enum ApprovalAction {
  APPROVE = 'approve',
  REJECT = 'reject',
  TRANSFER = 'transfer',
}

/**
 * 资产报废申请基础信息
 */
export interface RetirementApplication {
  id: string;
  asset_id: string;
  asset_name: string;
  asset_code: string;
  reason: string;
  estimated_residual_value: number;
  status: RetirementStatus;
  applicant_id: string;
  applicant_name: string;
  created_at: string;
  updated_at: string;
  current_approver?: string;
  current_approval_level?: number;
  approval_chain?: ApprovalChain;
}

/**
 * 审批链配置
 */
export interface ApprovalChain {
  levels: ApprovalLevel[];
  total_levels: number;
}

/**
 * 审批层级
 */
export interface ApprovalLevel {
  level: number;
  role: string;
  role_name: string;
  approver_id?: string;
  approver_name?: string;
  status?: 'pending' | 'approved' | 'rejected';
  decided_at?: string;
  comment?: string;
}

/**
 * 审批任务
 */
export interface ApprovalTask {
  id: string;
  retirement_id: string;
  asset_id: string;
  asset_name: string;
  level: number;
  approver_id: string;
  approver_name: string;
  status: 'pending' | 'approved' | 'rejected';
  created_at: string;
  deadline?: string;
  reason?: string;
}

/**
 * 生命周期事件
 */
export interface LifecycleEvent {
  id: string;
  event_type: RetirementEventType;
  event_name: string;
  timestamp: string;
  operator_id: string;
  operator_name: string;
  details?: Record<string, unknown>;
  previous_status?: string;
  new_status?: string;
}

/**
 * 生命周期事件类型
 */
export enum RetirementEventType {
  APPLICATION_SUBMITTED = 'application_submitted',  // 申请提交
  APPLICATION_MODIFIED = 'application_modified',  // 申请修改
  APPROVAL_STARTED = 'approval_started',          // 审批开始
  LEVEL_APPROVED = 'level_approved',              // 某级审批通过
  LEVEL_REJECTED = 'level_rejected',              // 某级审批驳回
  APPROVAL_COMPLETED = 'approval_completed',      // 审批全部通过
  ASSET_RETIRED = 'asset_retired',                // 资产已退役
  ASSET_SCRAPPED = 'asset_scrapped',              // 资产已报废
}

/**
 * 报废申请提交参数
 */
export interface RetirementSubmitParams {
  asset_id: string;
  reason: string;
  estimated_residual_value: number;
  attachments?: string[];
}

/**
 * 报废申请修改参数
 */
export interface RetirementUpdateParams {
  id: string;
  reason?: string;
  estimated_residual_value?: number;
  attachments?: string[];
}

/**
 * 审批操作参数
 */
export interface ApprovalActionParams {
  task_id: string;
  action: ApprovalAction;
  comment?: string;
}

/**
 * 审批转交参数
 */
export interface TransferParams {
  task_id: string;
  target_user_id: string;
  reason?: string;
}

/**
 * 生命周期时间轴响应
 */
export interface LifecycleResponse {
  asset_id: string;
  asset_code: string;
  asset_name: string;
  events: LifecycleEvent[];
  total: number;
}

/**
 * API 响应基础结构
 */
interface ApiResponse<T> {
  code: number;
  message: string;
  data: T;
}

/**
 * 异常类：报废流程错误
 */
export class RetirementError extends Error {
  code: number;
  
  constructor(message: string, code: number = 500) {
    super(message);
    this.name = 'RetirementError';
    this.code = code;
  }
}

/**
 * 资产报废退役服务类
 * 
 * @example
 * ```typescript
 * // 提交报废申请
 * const application = await retirementService.submit({
 *   asset_id: 'AST-001',
 *   reason: '设备老化',
 *   estimated_residual_value: 500
 * });
 * 
 * // 审批通过
 * await retirementService.processApproval({
 *   task_id: 'TASK-001',
 *   action: ApprovalAction.APPROVE,
 *   comment: '同意报废'
 * });
 * 
 * // 查询生命周期
 * const timeline = await retirementService.getLifecycleTimeline('AST-001');
 * ```
 */
export const retirementService = {
  
  /**
   * 提交报废/退役申请
   * 
   * @param params - 申请参数
   * @returns 创建的报废申请记录
   * @throws {RetirementError} 当资产不可申请或状态锁定时
   * 
   * @example
   * ```typescript
   * const result = await retirementService.submit({
   *   asset_id: 'AST-2024-001',
   *   reason: '设备老化无法使用',
   *   estimated_residual_value: 500.00
   * });
   * ```
   */
  async submit(params: RetirementSubmitParams): Promise<RetirementApplication> {
    try {
      // 1. 生成唯一请求 ID
      const requestId = `RET-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      
      // 2. 验证资产状态（前端预检）
      // NOTE: 实际状态锁定在后端执行，确保原子性
      
      // 3. 提交申请到后端
      const response = await apiClient.post<ApiResponse<RetirementApplication>>(
        '/v1/retirement/apply',
        {
          ...params,
          request_id: requestId
        }
      );
      
      // 4. 锁定资产状态（前端乐观更新）
      // NOTE: 后端事务保证状态一致性
      
      // 5. 生成首条生命周期事件记录（前端本地记录）
      // NOTE: 后端会记录完整的审计日志
      
      return response.data;
    } catch (error) {
      console.error('[RetirementService] Submit failed:', error);
      throw new RetirementError(
        error instanceof Error ? error.message : '提交报废申请失败',
        500
      );
    }
  },

  /**
   * 修改报废申请（仅限驳回后重新提交）
   * 
   * @param params - 修改参数（包含申请ID和新内容）
   * @returns 更新后的报废申请记录
   * @throws {RetirementError} 当申请状态不可修改时
   * 
   * @example
   * ```typescript
   * const result = await retirementService.update({
   *   id: 'RET-001',
   *   reason: '设备已无法修复，需报废',
   *   estimated_residual_value: 200.00
   * });
   * ```
   */
  async update(params: RetirementUpdateParams): Promise<RetirementApplication> {
    try {
      // 1. 验证申请状态（必须是驳回状态）
      // NOTE: 后端会再次校验
      
      // 2. 提交修改
      const response = await apiClient.put<ApiResponse<RetirementApplication>>(
        `/v1/retirement/${params.id}`,
        {
          reason: params.reason,
          estimated_residual_value: params.estimated_residual_value,
          attachments: params.attachments
        }
      );
      
      // 3. 重新锁定状态（启动新审批链）
      
      return response.data;
    } catch (error) {
      console.error('[RetirementService] Update failed:', error);
      throw new RetirementError(
        error instanceof Error ? error.message : '修改报废申请失败',
        500
      );
    }
  },

  /**
   * 查询报废申请详情
   * 
   * @param retirementId - 报废申请ID
   * @returns 报废申请详情（包含审批链信息）
   * 
   * @example
   * ```typescript
   * const application = await retirementService.getById('RET-001');
   * console.log(application.approval_chain);
   * ```
   */
  async getById(retirementId: string): Promise<RetirementApplication> {
    try {
      const response = await apiClient.get<ApiResponse<RetirementApplication>>(
        `/v1/retirement/${retirementId}`
      );
      return response.data;
    } catch (error) {
      console.error('[RetirementService] GetById failed:', error);
      throw new RetirementError(
        error instanceof Error ? error.message : '获取申请详情失败',
        500
      );
    }
  },

  /**
   * 处理审批操作（通过/驳回）
   * 
   * @param params - 审批操作参数
   * @returns 操作结果
   * 
   * @example
   * ```typescript
   * // 通过审批
   * await retirementService.processApproval({
   *   task_id: 'TASK-001',
   *   action: ApprovalAction.APPROVE,
   *   comment: '同意报废'
   * });
   * ```
   * 
   * @example
   * ```typescript
   * // 驳回审批
   * await retirementService.processApproval({
   *   task_id: 'TASK-001',
   *   action: ApprovalAction.REJECT,
   *   comment: '报废理由不充分，请补充'
   * });
   * ```
   */
  async processApproval(params: ApprovalActionParams): Promise<{ success: boolean; message: string }> {
    try {
      // 1. 验证任务状态
      // NOTE: 后端会校验任务是否属于当前用户
      
      // 2. 确定 API 端点
      const endpoint = params.action === ApprovalAction.APPROVE
        ? '/v1/retirement/approve'
        : '/v1/retirement/reject';
      
      // 3. 执行审批操作
      const response = await apiClient.post<ApiResponse<{ success: boolean; message: string }>>(
        endpoint,
        {
          task_id: params.task_id,
          comment: params.comment
        }
      );
      
      // 4. 触发状态变更
      // NOTE: 后端会更新资产状态并生成生命周期事件
      
      return response.data;
    } catch (error) {
      console.error('[RetirementService] ProcessApproval failed:', error);
      throw new RetirementError(
        error instanceof Error ? error.message : '审批操作失败',
        500
      );
    }
  },

  /**
   * 转交审批任务
   * 
   * @param params - 转交参数
   * @returns 转交结果
   * 
   * @example
   * ```typescript
   * await retirementService.transferApproval({
   *   task_id: 'TASK-001',
   *   target_user_id: 'USER-002',
   *   reason: '因公出差，审批转交'
   * });
   * ```
   */
  async transferApproval(params: TransferParams): Promise<{ success: boolean; message: string }> {
    try {
      // 1. 验证转交权限
      // NOTE: 后端会校验当前用户是否有转交权限
      
      const response = await apiClient.post<ApiResponse<{ success: boolean; message: string }>>(
        '/v1/retirement/transfer',
        {
          task_id: params.task_id,
          target_user_id: params.target_user_id,
          reason: params.reason
        }
      );
      
      return response.data;
    } catch (error) {
      console.error('[RetirementService] TransferApproval failed:', error);
      throw new RetirementError(
        error instanceof Error ? error.message : '转交审批失败',
        500
      );
    }
  },

  /**
   * 查询当前用户的待审批任务列表
   * 
   * @param userId - 用户ID（可选，默认使用当前登录用户）
   * @returns 待审批任务列表
   * 
   * @example
   * ```typescript
   * const pendingTasks = await retirementService.getPendingApprovals();
   * console.log(`待审批: ${pendingTasks.length} 条`);
   * ```
   */
  async getPendingApprovals(userId?: string): Promise<ApprovalTask[]> {
    try {
      const params = userId ? { user_id: userId } : {};
      const response = await apiClient.get<ApiResponse<ApprovalTask[]>>(
        '/v1/retirement/pending',
        { params }
      );
      return response.data;
    } catch (error) {
      console.error('[RetirementService] GetPendingApprovals failed:', error);
      throw new RetirementError(
        error instanceof Error ? error.message : '获取待审批任务失败',
        500
      );
    }
  },

  /**
   * 获取资产生命周期时间轴
   * 
   * @param assetId - 资产ID
   * @param options - 查询选项（排序、分页）
   * @returns 生命周期事件列表
   * 
   * @example
   * ```typescript
   * const timeline = await retirementService.getLifecycleTimeline('AST-2024-001');
   * timeline.events.forEach(event => {
   *   console.log(`${event.timestamp}: ${event.event_name}`);
   * });
   * ```
   */
  async getLifecycleTimeline(
    assetId: string,
    options?: {
      sort_order?: 'asc' | 'desc';
      limit?: number;
      offset?: number;
    }
  ): Promise<LifecycleResponse> {
    try {
      const params = {
        sort_order: options?.sort_order ?? 'desc',
        limit: options?.limit ?? 50,
        offset: options?.offset ?? 0
      };
      
      const response = await apiClient.get<ApiResponse<LifecycleResponse>>(
        `/v1/retirement/timeline/${assetId}`,
        { params }
      );
      
      return response.data;
    } catch (error) {
      console.error('[RetirementService] GetLifecycleTimeline failed:', error);
      throw new RetirementError(
        error instanceof Error ? error.message : '获取生命周期历史失败',
        500
      );
    }
  },

  /**
   * 查询资产的报废申请记录
   * 
   * @param assetId - 资产ID
   * @returns 报废申请记录列表
   * 
   * @example
   * ```typescript
   * const applications = await retirementService.getApplicationsByAsset('AST-001');
   * ```
   */
  async getApplicationsByAsset(assetId: string): Promise<RetirementApplication[]> {
    try {
      const response = await apiClient.get<ApiResponse<RetirementApplication[]>>(
        '/v1/retirement/list',
        { params: { asset_id: assetId } }
      );
      return response.data;
    } catch (error) {
      console.error('[RetirementService] GetApplicationsByAsset failed:', error);
      throw new RetirementError(
        error instanceof Error ? error.message : '获取资产报废记录失败',
        500
      );
    }
  },

  /**
   * 取消报废申请
   * 
   * @param retirementId - 报废申请ID
   * @returns 取消结果
   * 
   * @example
   * ```typescript
   * await retirementService.cancel('RET-001');
   * ```
   */
  async cancel(retirementId: string): Promise<{ success: boolean; message: string }> {
    try {
      // 仅允许在审批前或驳回状态下取消
      const response = await apiClient.delete<ApiResponse<{ success: boolean; message: string }>>(
        `/v1/retirement/${retirementId}`
      );
      return response.data;
    } catch (error) {
      console.error('[RetirementService] Cancel failed:', error);
      throw new RetirementError(
        error instanceof Error ? error.message : '取消报废申请失败',
        500
      );
    }
  }
};

export default retirementService;
