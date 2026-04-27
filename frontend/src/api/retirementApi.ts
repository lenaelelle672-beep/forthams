/**
 * 资产报废退役流程与审批链 API
 * 
 * 功能范围:
 * - 报废/退役申请提交与修改
 * - 多级审批链执行（通过/驳回/转交）
 * - 资产生命周期历史记录查询
 * 
 * @module retirementApi
 * @version SWARM-2026-Q2-002 Iteration 4
 */

import { request } from '@/utils/http';
import type { 
  RetirementApplication, 
  RetirementRequest, 
  RetirementStatus,
  ApprovalTask,
  LifecycleEvent 
} from '@/types/retirement.types';

/**
 * 报废申请请求参数
 */
export interface RetirementApplyParams {
  /** 资产ID */
  asset_id: string;
  /** 报废原因 */
  reason: string;
  /** 预估残值 */
  estimated_residual_value: number;
  /** 报废类型: scrap | retirement */
  retirement_type?: 'scrap' | 'retirement';
  /** 附件URL列表 */
  attachments?: string[];
  /** 备注 */
  remark?: string;
}

/**
 * 报废申请修改参数（驳回后重提）
 */
export interface RetirementUpdateParams {
  /** 报废原因 */
  reason?: string;
  /** 预估残值 */
  estimated_residual_value?: number;
  /** 报废类型 */
  retirement_type?: 'scrap' | 'retirement';
  /** 附件URL列表 */
  attachments?: string[];
  /** 备注 */
  remark?: string;
}

/**
 * 审批操作参数
 */
export interface ApprovalActionParams {
  /** 审批决策: approve | reject | delegate */
  decision: 'approve' | 'reject' | 'delegate';
  /** 审批意见/驳回原因 */
  comment?: string;
  /** 转交目标用户ID（仅当 decision=delegate 时） */
  delegate_to?: string;
}

/**
 * 生命周期查询参数
 */
export interface LifecycleQueryParams {
  /** 资产ID */
  asset_id: string;
  /** 时间范围-开始 */
  start_date?: string;
  /** 时间范围-结束 */
  end_date?: string;
  /** 事件类型过滤 */
  event_types?: string[];
  /** 排序: asc | desc */
  order?: 'asc' | 'desc';
  /** 分页页码 */
  page?: number;
  /** 每页数量 */
  page_size?: number;
}

/**
 * 提交报废申请
 * 
 * @description 用户发起资产报废/退役申请，系统自动锁定资产状态并生成首级审批任务
 * @param params - 报废申请参数
 * @returns 申请记录（含状态、当前审批人信息）
 * 
 * @throws {400} 参数校验失败
 * @throws {409} 资产状态不允许申请（已报废/退役/审批中）
 * 
 * @example
 * ```typescript
 * const result = await submitRetirementApplication({
 *   asset_id: 'AST-2024-001',
 *   reason: '设备老化无法使用',
 *   estimated_residual_value: 500.00
 * });
 * console.log(result.status); // '审批中'
 * ```
 */
export async function submitRetirementApplication(
  params: RetirementApplyParams
): Promise<RetirementApplication> {
  const response = await request.post<RetirementApplication>(
    '/api/v1/retirement/apply',
    params
  );
  return response.data;
}

/**
 * 查询报废申请详情
 * 
 * @description 根据申请ID查询报废申请详细信息
 * @param applicationId - 申请记录ID
 * @returns 申请详情（含审批链进度）
 */
export async function getRetirementApplication(
  applicationId: string
): Promise<RetirementApplication> {
  const response = await request.get<RetirementApplication>(
    `/api/v1/retirement/${applicationId}`
  );
  return response.data;
}

/**
 * 查询用户的报废申请列表
 * 
 * @description 查询当前用户提交的报废申请记录
 * @param status - 状态过滤（可选）
 * @returns 申请列表
 */
export async function listMyRetirementApplications(
  status?: RetirementStatus
): Promise<RetirementApplication[]> {
  const params = status ? { status } : {};
  const response = await request.get<RetirementApplication[]>(
    '/api/v1/retirement/my-applications',
    { params }
  );
  return response.data;
}

/**
 * 修改报废申请（驳回后重提）
 * 
 * @description 当申请被驳回后，申请人可修改信息重新提交
 * @param applicationId - 申请ID
 * @param params - 修改后的申请参数
 * @returns 更新后的申请记录
 * 
 * @throws {403} 申请状态不允许修改（非驳回状态）
 */
export async function updateRetirementApplication(
  applicationId: string,
  params: RetirementUpdateParams
): Promise<RetirementApplication> {
  const response = await request.put<RetirementApplication>(
    `/api/v1/retirement/${applicationId}`,
    params
  );
  return response.data;
}

/**
 * 撤销报废申请
 * 
 * @description 申请人可在审批开始前撤销申请
 * @param applicationId - 申请ID
 */
export async function cancelRetirementApplication(
  applicationId: string
): Promise<void> {
  await request.delete(`/api/v1/retirement/${applicationId}`);
}

/**
 * 获取待审批任务列表
 * 
 * @description 查询当前用户待处理的审批任务
 * @param include_types - 包含的任务类型（可选）
 * @returns 待审批任务列表
 */
export async function getPendingApprovals(
  include_types?: ('retirement' | 'workorder' | 'transfer')[]
): Promise<ApprovalTask[]> {
  const params = include_types ? { include_types } : {};
  const response = await request.get<ApprovalTask[]>(
    '/api/v1/approvals/pending',
    { params }
  );
  return response.data;
}

/**
 * 执行审批操作
 * 
 * @description 审批人对任务进行通过/驳回/转交操作
 * @param taskId - 审批任务ID
 * @param params - 审批操作参数
 * @returns 审批结果（含下一级任务信息，如适用）
 * 
 * @throws {400} 参数校验失败
 * @throws {403} 无权执行该审批操作
 * @throws {409} 任务已被其他审批人处理
 */
export async function processApproval(
  taskId: string,
  params: ApprovalActionParams
): Promise<{
  status: 'completed' | 'pending_next_level';
  next_approver?: string;
  completed_at?: string;
}> {
  const response = await request.post<{
    status: 'completed' | 'pending_next_level';
    next_approver?: string;
    completed_at?: string;
  }>(`/api/v1/approvals/${taskId}`, params);
  return response.data;
}

/**
 * 查询审批任务详情
 * 
 * @param taskId - 审批任务ID
 * @returns 任务详情（含审批历史）
 */
export async function getApprovalTask(taskId: string): Promise<ApprovalTask> {
  const response = await request.get<ApprovalTask>(
    `/api/v1/approvals/tasks/${taskId}`
  );
  return response.data;
}

/**
 * 转交审批任务
 * 
 * @description 将审批任务转交给其他用户
 * @param taskId - 任务ID
 * @param targetUserId - 目标用户ID
 * @param reason - 转交原因
 */
export async function delegateApprovalTask(
  taskId: string,
  targetUserId: string,
  reason?: string
): Promise<void> {
  await request.post(`/api/v1/approvals/${taskId}/delegate`, {
    target_user_id: targetUserId,
    reason
  });
}

/**
 * 查询资产生命周期历史
 * 
 * @description 获取资产从采购到当前的全生命周期状态变更记录
 * @param params - 查询参数
 * @returns 生命周期事件时间轴
 * 
 * @example
 * ```typescript
 * const timeline = await getAssetLifecycle({
 *   asset_id: 'AST-2024-001',
 *   order: 'asc'
 * });
 * // timeline = [
 * //   { event: '采购入库', timestamp: '2024-01-15T10:00:00Z', operator: 'admin' },
 * //   { event: '领用', timestamp: '2024-02-01T14:30:00Z', operator: 'user1' },
 * //   { event: '报废申请', timestamp: '2026-04-20T09:00:00Z', operator: 'user2' },
 * //   { event: '审批完成', timestamp: '2026-04-22T16:00:00Z', operator: 'manager' }
 * // ]
 * ```
 */
export async function getAssetLifecycle(
  params: LifecycleQueryParams
): Promise<{
  asset_id: string;
  timeline: LifecycleEvent[];
  total: number;
}> {
  const response = await request.get<{
    asset_id: string;
    timeline: LifecycleEvent[];
    total: number;
  }>(`/api/v1/assets/${params.asset_id}/lifecycle`, {
    params: {
      start_date: params.start_date,
      end_date: params.end_date,
      event_types: params.event_types?.join(','),
      order: params.order || 'desc',
      page: params.page || 1,
      page_size: params.page_size || 50
    }
  });
  return response.data;
}

/**
 * 查询特定资产的报废申请记录
 * 
 * @param assetId - 资产ID
 * @returns 资产的报废申请历史
 */
export async function getAssetRetirementHistory(
  assetId: string
): Promise<RetirementApplication[]> {
  const response = await request.get<RetirementApplication[]>(
    `/api/v1/retirement/asset/${assetId}`
  );
  return response.data;
}

/**
 * 获取审批链配置
 * 
 * @description 查询当前系统的审批链配置（层级、节点）
 * @returns 审批链配置信息
 */
export async function getApprovalChainConfig(): Promise<{
  levels: Array<{
    level: number;
    name: string;
    approver_type: 'role' | 'user';
    approver_id?: string;
    role_code?: string;
  }>;
}> {
  const response = await request.get<{
    levels: Array<{
      level: number;
      name: string;
      approver_type: 'role' | 'user';
      approver_id?: string;
      role_code?: string;
    }>;
  }>('/api/v1/approval/chain/config');
  return response.data;
}

/**
 * 获取报废统计报表
 * 
 * @description 查询报废申请的统计信息
 * @param startDate - 开始日期
 * @param endDate - 结束日期
 * @returns 统计结果
 */
export async function getRetirementStatistics(params: {
  start_date: string;
  end_date: string;
}): Promise<{
  total_count: number;
  approved_count: number;
  rejected_count: number;
  pending_count: number;
  total_residual_value: number;
  by_type: Record<string, number>;
}> {
  const response = await request.get<{
    total_count: number;
    approved_count: number;
    rejected_count: number;
    pending_count: number;
    total_residual_value: number;
    by_type: Record<string, number>;
  }>('/api/v1/retirement/statistics', { params });
  return response.data;
}