/**
 * 资产折旧明细 API 服务层
 *
 * 提供获取资产折旧明细时间线的 API 请求方法，
 * 对接后端 GET /api/assets/{id}/depreciation-schedule 接口。
 *
 * @module services/assetApi
 * @since SWARM-013
 */

import { api } from '../utils/api';

// ---------------------------------------------------------------------------
// TypeScript 接口定义
// ---------------------------------------------------------------------------

/**
 * 折旧方法枚举
 *
 * @description 标识当前资产使用的折旧计算方法
 */
export type DepreciationMethodType = 'straight_line' | 'double_declining_balance' | string;

/**
 * 折旧明细单条记录
 *
 * @description 描述某一折旧周期（通常为月度）的折旧计算结果。
 * 每条记录对应时间线上的一个节点。
 */
export interface DepreciationDetailItem {
  /** 唯一标识 */
  id: string | number;
  /** 期间标识，如 "2025-01" */
  period: string;
  /** 本期折旧额 */
  depreciationAmount: number;
  /** 截至本期累计折旧 */
  accumulatedDepreciation: number;
  /** 本期末账面净值 */
  netValue: number;
  /** 折旧率（双倍余额递减法场景） */
  depreciationRate?: number;
}

/**
 * 折旧计划汇总 DTO
 *
 * @description 包含折旧方法参数摘要及逐期折旧明细。
 * 由后端 GET /api/assets/{id}/depreciation-schedule 返回。
 */
export interface DepreciationScheduleDTO {
  /** 资产 ID */
  assetId: string | number;
  /** 资产编号 */
  assetNo?: string;
  /** 资产名称 */
  assetName?: string;
  /** 折旧方法名称（中文），如 "直线法"、"双倍余额递减法" */
  methodName: string;
  /** 折旧方法标识 */
  method: DepreciationMethodType;
  /** 资产原值 */
  originalValue: number;
  /** 预计残值 */
  salvageValue: number;
  /** 残值率（百分比） */
  salvageRate?: number;
  /** 折旧年限（年） */
  usefulLifeYears: number;
  /** 折旧开始日期 */
  startDate?: string;
  /** 折旧明细列表 */
  details: DepreciationDetailItem[];
  /** 资产当前状态（用于已报废资产截断渲染） */
  assetStatus?: string;
}

// ---------------------------------------------------------------------------
// API 请求方法
// ---------------------------------------------------------------------------

/**
 * 获取指定资产的折旧明细时间线
 *
 * @param assetId - 资产 ID（对应 Asset 实体的 id）
 * @returns 折旧计划 DTO；若资产无折旧数据（如土地类资产），后端返回空 details 数组
 *
 * @example
 * ```ts
 * const schedule = await getAssetDepreciationSchedule('42');
 * console.log(schedule.methodName); // "直线法"
 * console.log(schedule.details.length); // 12
 * ```
 */
export async function getAssetDepreciationSchedule(
  assetId: string,
): Promise<DepreciationScheduleDTO> {
  return api.get<DepreciationScheduleDTO>(
    `/assets/${assetId}/depreciation-schedule`,
  );
}
