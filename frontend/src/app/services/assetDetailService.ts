/**
 * Asset Detail Service
 *
 * Provides centralized API methods for the Asset Detail page,
 * including depreciation schedule and related work orders.
 *
 * @module services/assetDetailService
 * @since SWARM-015
 */

import { api } from '../utils/api';
import type { DepreciationScheduleDTO } from './assetApi';
import type { WorkOrderRecord } from './workOrderService';
import type { PagedResult } from './assetService';

// ---------------------------------------------------------------------------
// TypeScript 接口定义
// ---------------------------------------------------------------------------

/**
 * 资产处置历史记录
 *
 * @description 描述资产的处置流程记录，包括退役、报废、转让等操作。
 */
export interface DisposalHistoryItem {
  /** 记录唯一标识 */
  id: number | string;
  /** 处置类型：RETIRE / SCRAP / TRANSFER / COMPENSATION */
  disposalType: string;
  /** 处置类型显示名称 */
  disposalTypeLabel?: string;
  /** 工单编号 */
  workOrderNo?: string;
  /** 处置状态 */
  status: string;
  /** 申请人 */
  applicantName?: string;
  /** 审批人 */
  approverName?: string;
  /** 申请日期 */
  applyDate?: string;
  /** 完成日期 */
  completedDate?: string;
  /** 处置原因 / 备注 */
  remark?: string;
  /** 原值 */
  originalValue?: number;
  /** 处置金额 */
  disposalValue?: number;
  /** 关联工单 ID */
  workOrderId?: number;
  /** 创建时间 */
  createTime?: string;
}

/**
 * 资产处置历史分页响应
 */
export interface DisposalHistoryResponse {
  /** 处置记录列表 */
  records: DisposalHistoryItem[];
  /** 总数 */
  total: number;
}

/**
 * 资产详情聚合数据
 *
 * @description 将资产基本信息、折旧计划、关联工单和处置历史
 * 聚合到一个统一的数据结构中，供 AssetDetailPage 使用。
 */
export interface AssetDetailAggregate {
  /** 资产基本信息 */
  asset: Record<string, unknown>;
  /** 折旧计划（可能为 null，如土地类资产无折旧） */
  depreciationSchedule: DepreciationScheduleDTO | null;
  /** 关联工单列表 */
  workOrders: WorkOrderRecord[];
  /** 处置历史 */
  disposalHistory: DisposalHistoryItem[];
}

// ---------------------------------------------------------------------------
// API 请求方法
// ---------------------------------------------------------------------------

/**
 * 获取指定资产的折旧明细时间线
 *
 * @param assetId - 资产 ID
 * @returns 折旧计划 DTO；若资产无折旧数据则返回 null
 *
 * @example
 * ```ts
 * const schedule = await fetchDepreciationSchedule('42');
 * console.log(schedule.methodName); // "直线法"
 * ```
 */
export async function fetchDepreciationSchedule(
  assetId: string,
): Promise<DepreciationScheduleDTO | null> {
  try {
    return await api.get<DepreciationScheduleDTO>(
      `/assets/${assetId}/depreciation-schedule`,
    );
  } catch (error) {
    // 部分资产（如土地）可能没有折旧数据，返回 null 而非抛出异常
    console.warn(`No depreciation schedule for asset ${assetId}:`, error);
    return null;
  }
}

/**
 * 获取与指定资产关联的工单列表
 *
 * @param assetId - 资产 ID
 * @param params - 分页与筛选参数
 * @returns 分页工单列表
 *
 * @example
 * ```ts
 * const { records } = fetchRelatedWorkOrders('42', { page: 1, pageSize: 10 });
 * ```
 */
export async function fetchRelatedWorkOrders(
  assetId: string,
  params?: { page?: number; pageSize?: number; status?: string },
): Promise<PagedResult<WorkOrderRecord>> {
  return api.get<PagedResult<WorkOrderRecord>>(`/workorders`, {
    params: {
      assetId,
      page: params?.page ?? 1,
      pageSize: params?.pageSize ?? 10,
      status: params?.status,
    },
  });
}

/**
 * 获取指定资产的处置历史记录
 *
 * @param assetId - 资产 ID
 * @param params - 分页参数
 * @returns 处置历史记录列表
 *
 * @example
 * ```ts
 * const history = await fetchDisposalHistory('42');
 * ```
 */
export async function fetchDisposalHistory(
  assetId: string,
  params?: { page?: number; pageSize?: number },
): Promise<DisposalHistoryResponse> {
  return api.get<DisposalHistoryResponse>(
    `/assets/${assetId}/disposal-history`,
    {
      params: {
        page: params?.page ?? 1,
        pageSize: params?.pageSize ?? 20,
      },
    },
  );
}
