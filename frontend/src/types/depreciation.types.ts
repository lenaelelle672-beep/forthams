/**
 * 资产折旧计算模块 - 类型定义
 *
 * 支持直线法和双倍余额递减法两种折旧计算方式
 * 用于资产详情页展示当前折旧值与净值
 *
 * @module depreciation.types
 * @version 1.0.0
 */

import type { ApiResponse } from './common';

/**
 * 折旧计算方法枚举
 *
 * @description
 * - STRAIGHT_LINE: 直线法，每期折旧额固定
 * - DOUBLE_DECLINING_BALANCE: 双倍余额递减法，前期折旧额高、后期低
 */
export enum DepreciationMethod {
  /** 直线法 */
  STRAIGHT_LINE = 'STRAIGHT_LINE',
  /** 双倍余额递减法 */
  DOUBLE_DECLINING_BALANCE = 'DOUBLE_DECLINING_BALANCE',
}

/**
 * 折旧计算请求参数
 *
 * @description 发起折旧计算时所需的输入参数
 */
export interface DepreciationCalculationParams {
  /** 资产ID */
  assetId: string;
  /** 购置价格 */
  purchasePrice: number;
  /** 购置日期 */
  purchaseDate: Date;
  /** 预计使用寿命（年） */
  usefulLifeYears: number;
  /** 预计残值 */
  salvageValue: number;
  /** 折旧计算方法 */
  method: DepreciationMethod;
  /** 基准日期，默认为当天 */
  referenceDate?: Date;
}

/**
 * 单次折旧计算结果
 *
 * @description 包含折旧计算的各项数值结果
 */
export interface DepreciationResult {
  /** 资产ID */
  assetId: string;
  /** 折旧计算方法 */
  method: DepreciationMethod;
  /** 基准日期 */
  referenceDate: Date;
  /** 月折旧额 */
  monthlyDepreciation: number;
  /** 年折旧额 */
  annualDepreciation: number;
  /** 累计已提折旧 */
  accumulatedDepreciation: number;
  /** 账面净值 */
  netBookValue: number;
  /** 使用寿命（年） */
  usefulLifeYears: number;
  /** 剩余使用寿命（月） */
  remainingLifeMonths: number;
  /** 已计提月份数 */
  periodsElapsed: number;
}

/**
 * 资产当前折旧状态
 *
 * @description 用于前端展示资产详情页的折旧信息卡片
 */
export interface DepreciationStatus {
  /** 资产ID */
  assetId: string;
  /** 当前折旧信息 */
  currentDepreciation: DepreciationResult;
  /** 折旧率（双倍余额递减法使用） */
  depreciationRate: number;
  /** 最后计算日期 */
  lastCalculationDate: Date;
  /** 下次计算日期 */
  nextCalculationDate: Date;
}

/**
 * 折旧记录详情
 *
 * @description 包含每期折旧计算明细
 */
export interface DepreciationRecordDetail {
  /** 记录ID */
  id: string;
  /** 资产ID */
  assetId: string;
  /** 折旧计算方法 */
  method: DepreciationMethod;
  /** 计算日期 */
  calculatedDate: Date;
  /** 期间年份 */
  periodYear: number;
  /** 期间月份 */
  periodMonth: number;
  /** 本期折旧额 */
  periodDepreciation: number;
  /** 累计折旧 */
  accumulatedDepreciation: number;
  /** 账面净值 */
  netBookValue: number;
}

/**
 * 直线法折旧数据
 *
 * @description 直线法特有的折旧展示数据
 */
export interface StraightLineDepreciationData {
  /** 折旧方法标识 */
  methodType: 'straight_line';
  /** 月折旧额 */
  monthlyDepreciation: number;
  /** 年折旧额 */
  annualDepreciation: number;
  /** 累计折旧 */
  accumulatedDepreciation: number;
  /** 账面净值 */
  netBookValue: number;
}

/**
 * 双倍余额递减法折旧数据
 *
 * @description 双倍余额递减法特有的折旧展示数据
 */
export interface DoubleDecliningDepreciationData {
  /** 折旧方法标识 */
  methodType: 'double_declining_balance';
  /** 当前年折旧率 */
  currentDepreciationRate: number;
  /** 本期折旧额 */
  currentPeriodDepreciation: number;
  /** 累计折旧 */
  accumulatedDepreciation: number;
  /** 账面净值 */
  netBookValue: number;
  /** 是否已转换为直线法 */
  isConvertedToStraightLine: boolean;
  /** 转换年份 */
  conversionYear?: number;
}

/**
 * 统一折旧展示数据
 *
 * @description 根据折旧方法类型包含对应的展示数据
 */
export type DepreciationDisplayData =
  | StraightLineDepreciationData
  | DoubleDecliningDepreciationData;

/**
 * 资产折旧信息卡片数据
 *
 * @description 用于前端资产详情页的折旧信息展示
 */
export interface AssetDepreciationCard {
  /** 资产ID */
  assetId: string;
  /** 折旧展示数据（根据方法类型不同结构） */
  depreciationData: DepreciationDisplayData;
  /** 购置日期 */
  purchaseDate: Date;
  /** 使用寿命（年） */
  usefulLifeYears: number;
  /** 购置价格 */
  purchasePrice: number;
  /** 预计残值 */
  salvageValue: number;
  /** 最后更新日期 */
  lastUpdated: Date;
}

/**
 * 折旧计算历史记录
 *
 * @description 资产折旧计算的完整历史
 */
export interface DepreciationHistoryRecord {
  /** 资产ID */
  assetId: string;
  /** 历史记录列表 */
  records: DepreciationRecordDetail[];
  /** 记录总数 */
  totalCount: number;
}

/**
 * 折旧计算请求参数（API请求格式）
 *
 * @description API请求时的参数结构
 */
export interface DepreciationCalculateRequest {
  /** 资产ID */
  assetId: string;
  /** 折旧计算方法 */
  method: DepreciationMethod;
  /** 基准日期（ISO格式字符串） */
  referenceDate?: string;
}

/**
 * 折旧计算响应数据（API响应格式）
 *
 * @description API响应的数据结构
 */
export interface DepreciationCalculateResponse {
  /** 资产ID */
  assetId: string;
  /** 折旧计算方法 */
  method: DepreciationMethod;
  /** 基准日期 */
  referenceDate: string;
  /** 月折旧额 */
  monthlyDepreciation: string;
  /** 年折旧额 */
  annualDepreciation: string;
  /** 累计折旧 */
  accumulatedDepreciation: string;
  /** 账面净值 */
  net_book_value: string;
  /** 使用寿命（年） */
  useful_life_years: number;
  /** 剩余使用寿命（月） */
  remaining_life_months: number;
  /** 已计提月份数 */
  periods_elapsed: number;
}

/**
 * 完整API响应封装
 *
 * @description 包含折旧计算结果的完整API响应
 */
export type DepreciationApiResponse = ApiResponse<DepreciationCalculateResponse>;

/**
 * 折旧状态查询参数
 *
 * @description 查询资产折旧状态时的过滤条件
 */
export interface DepreciationStatusQuery {
  /** 资产ID */
  assetId: string;
  /** 可选的截止日期过滤 */
  endDate?: Date;
}

/**
 * 批量折旧计算请求
 *
 * @description 批量计算资产折旧时的请求参数
 */
export interface BatchDepreciationCalculateRequest {
  /** 资产ID列表 */
  assetIds: string[];
  /** 折旧计算方法 */
  method: DepreciationMethod;
  /** 基准日期 */
  referenceDate?: Date;
}

/**
 * 批量折旧计算结果项
 *
 * @description 批量计算中单个资产的结果
 */
export interface BatchDepreciationResultItem {
  /** 资产ID */
  assetId: string;
  /** 是否成功 */
  success: boolean;
  /** 错误信息（失败时） */
  error?: string;
  /** 折旧结果（成功时） */
  result?: DepreciationResult;
}

/**
 * 批量折旧计算响应
 *
 * @description 批量计算资产的完整响应
 */
export interface BatchDepreciationResponse {
  /** 总数 */
  total: number;
  /** 成功数 */
  successCount: number;
  /** 失败数 */
  failureCount: number;
  /** 结果列表 */
  results: BatchDepreciationResultItem[];
}