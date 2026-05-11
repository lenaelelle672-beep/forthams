import { api } from '../utils/api';
import type {
  RetirementApplication,
  RetirementStatus,
} from '@/app/types/retirement.types';

/**
 * 审批记录
 */
interface ApprovalRecord {
  id: string;
  applicationId: string;
  action: string;
  comment?: string;
  operator?: string;
  createdAt: string;
}

/**
 * 分页查询参数
 */
interface ApplicationListParams {
  assetId?: string;
  status?: RetirementStatus;
  keyword?: string;
  startDate?: string;
  endDate?: string;
  page?: number;
  pageSize?: number;
}

/**
 * 分页响应
 */
interface PaginatedResult<T> {
  items: T[];
  total: number;
  page?: number;
  pageSize?: number;
}

/**
 * 资产退役服务
 * 提供资产报废退役流程的完整功能，包括：
 * - 退役申请创建与提交
 * - 状态流转与审批链管理
 * - 历史记录查询与持久化
 */
export class RetirementService {
  /**
   * 创建退役申请
   * @param assetId - 资产ID
   * @param reason - 退役原因
   * @param expectedDate - 预期退役日期
   * @returns 创建的退役申请记录
   */
  async createApplication(
    assetId: string,
    reason: string,
    expectedDate?: string
  ): Promise<RetirementApplication> {
    return api.post<RetirementApplication>('/retirement/applications', {
      assetId,
      reason,
      expectedDate,
    });
  }

  /**
   * 提交退役申请
   * @param applicationId - 申请ID
   * @returns 提交结果
   */
  async submitApplication(applicationId: string): Promise<RetirementApplication> {
    return api.post<RetirementApplication>(`/retirement/applications/${applicationId}/submit`);
  }

  /**
   * 获取退役申请详情
   * @param applicationId - 申请ID
   * @returns 退役申请详情
   */
  async getApplication(applicationId: string): Promise<RetirementApplication> {
    return api.get<RetirementApplication>(`/retirement/applications/${applicationId}`);
  }

  /**
   * 获取资产退役申请列表
   * @param params - 查询参数
   * @returns 分页的退役申请列表
   */
  async listApplications(params?: ApplicationListParams): Promise<PaginatedResult<RetirementApplication>> {
    return api.get<PaginatedResult<RetirementApplication>>('/retirement/applications', { params });
  }

  /**
   * 审批退役申请（通过）
   * @param applicationId - 申请ID
   * @param comment - 审批意见
   * @param approverId - 审批人ID
   * @returns 审批结果
   */
  async approveApplication(
    applicationId: string,
    comment?: string,
    approverId?: string
  ): Promise<RetirementApplication> {
    return api.post<RetirementApplication>(`/retirement/applications/${applicationId}/approve`, {
      comment,
      approverId,
    });
  }

  /**
   * 驳回退役申请
   * @param applicationId - 申请ID
   * @param reason - 驳回原因
   * @param approverId - 审批人ID
   * @returns 驳回结果
   */
  async rejectApplication(
    applicationId: string,
    reason: string,
    approverId?: string
  ): Promise<RetirementApplication> {
    return api.post<RetirementApplication>(`/retirement/applications/${applicationId}/reject`, {
      reason,
      approverId,
    });
  }

  /**
   * 获取审批历史记录
   * @param applicationId - 申请ID
   * @returns 审批记录列表
   */
  async getApprovalHistory(applicationId: string): Promise<ApprovalRecord[]> {
    return api.get<ApprovalRecord[]>(`/retirement/applications/${applicationId}/approval-history`);
  }

  /**
   * 获取资产状态流转历史
   * @param assetId - 资产ID
   * @returns 状态变更历史列表
   */
  async getAssetStateHistory(
    assetId: string
  ): Promise<{ assetId: string; history: Array<{ fromStatus: string; toStatus: string; timestamp: string; operator: string }> }> {
    return api.get(`/retirement/assets/${assetId}/state-history`);
  }

  /**
   * 获取待审批的退役申请列表
   * @param approverId - 审批人ID
   * @returns 待审批的退役申请列表
   */
  async getPendingApprovals(approverId?: string): Promise<RetirementApplication[]> {
    const params = approverId ? { approverId } : {};
    return api.get<RetirementApplication[]>('/retirement/pending', { params });
  }

  /**
   * 取消退役申请
   * @param applicationId - 申请ID
   * @returns 取消结果
   */
  async cancelApplication(applicationId: string): Promise<RetirementApplication> {
    return api.post<RetirementApplication>(`/retirement/applications/${applicationId}/cancel`);
  }

  /**
   * 确认退役完成
   * @param applicationId - 申请ID
   * @param actualDate - 实际退役日期
   * @returns 完成结果
   */
  async completeRetirement(
    applicationId: string,
    actualDate?: string
  ): Promise<RetirementApplication> {
    return api.post<RetirementApplication>(`/retirement/applications/${applicationId}/complete`, {
      actualDate,
    });
  }

  // ── 别名方法（页面直接引用） ──────────────────────────────

  /**
   * 获取退役申请列表（别名 → listApplications）
   * @param params - 查询参数
   * @returns 分页的退役申请列表
   */
  async getApplications(params?: ApplicationListParams): Promise<PaginatedResult<RetirementApplication>> {
    return this.listApplications(params);
  }

  /**
   * 获取退役申请详情（别名 → getApplication）
   * @param applicationId - 申请ID
   * @returns 退役申请详情
   */
  async getApplicationById(applicationId: string): Promise<RetirementApplication> {
    return this.getApplication(applicationId);
  }

  /**
   * 获取退役历史记录
   * @param assetId - 资产ID
   * @returns 退役历史记录列表
   */
  async getRetirementHistory(assetId: string): Promise<Array<{ id: string; assetId: string; action: string; fromStatus: string; toStatus: string; timestamp: string; operator: string; reason?: string }>> {
    const result = await this.getAssetStateHistory(assetId);
    return (result.history || []).map((h, idx) => ({
      id: `${assetId}-history-${idx}`,
      assetId: result.assetId,
      action: h.toStatus,
      fromStatus: h.fromStatus,
      toStatus: h.toStatus,
      timestamp: h.timestamp,
      operator: h.operator,
    }));
  }

  /**
   * 删除退役记录
   * @param applicationId - 申请ID
   */
  async deleteRetirement(applicationId: string): Promise<void> {
    await api.delete(`/retirement/applications/${applicationId}`);
  }
}

// 导出单例实例
export const retirementService = new RetirementService();
