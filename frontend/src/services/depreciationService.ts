/**
 * 资产折旧服务 (DepreciationService)
 * 
 * 提供固定资产折旧计算相关的 API 调用和业务逻辑封装。
 * 支持直线法和双倍余额递减法两种折旧计算方式。
 * 
 * @module services/depreciationService
 * @version 1.0.0
 */

import http from '@/utils/http';
import type { Asset } from '@/types/asset';

// ============================================================
// 类型定义
// ============================================================

/**
 * 折旧方法枚举
 */
export enum DepreciationMethod {
  /** 直线法 */
  STRAIGHT_LINE = 'straight_line',
  /** 双倍余额递减法 */
  DOUBLE_DECLINING_BALANCE = 'double_declining_balance',
}

/**
 * 折旧记录数据结构
 */
export interface DepreciationRecord {
  /** 记录ID */
  id: number;
  /** 资产ID */
  assetId: number;
  /** 期间年份 */
  periodYear: number;
  /** 期间月份 */
  periodMonth: number;
  /** 当期折旧额 */
  monthlyDepreciation: number;
  /** 累计折旧额 */
  accumulatedDepreciation: number;
  /** 账面价值 */
  bookValue: number;
  /** 计算时间 */
  calculatedAt: string;
}

/**
 * 折旧报表汇总数据
 */
export interface DepreciationSummary {
  /** 资产ID */
  assetId: number;
  /** 资产名称 */
  assetName: string;
  /** 原始价值 */
  originalValue: number;
  /** 残值 */
  salvageValue: number;
  /** 预计使用年限（年） */
  usefulLifeYears: number;
  /** 折旧方法 */
  depreciationMethod: DepreciationMethod;
  /** 当前账面价值 */
  currentBookValue: number;
  /** 累计折旧 */
  accumulatedDepreciation: number;
  /** 已计提月份数 */
  depreciatedMonths: number;
  /** 剩余使用月份数 */
  remainingMonths: number;
  /** 预计折旧完成日期 */
  estimatedCompletionDate: string;
}

/**
 * 月度折旧详情
 */
export interface MonthlyDepreciationDetail {
  /** 年份 */
  year: number;
  /** 月份 */
  month: number;
  /** 当期折旧 */
  monthlyDepreciation: number;
  /** 累计折旧 */
  accumulatedDepreciation: number;
  /** 账面价值 */
  bookValue: number;
}

/**
 * 折旧报表查询参数
 */
export interface DepreciationQueryParams {
  /** 资产ID */
  assetId: number;
  /** 查询年份 */
  year?: number;
  /** 查询月份 */
  month?: number;
  /** 折旧方法 */
  method?: DepreciationMethod;
}

/**
 * 手动重算请求参数
 */
export interface RecalculateRequest {
  /** 资产ID */
  assetId: number;
  /** 起始期间 */
  startPeriod: {
    year: number;
    month: number;
  };
  /** 结束期间 */
  endPeriod: {
    year: number;
    month: number;
  };
}

/**
 * 批量折旧计算请求
 */
export interface BatchDepreciationRequest {
  /** 资产ID列表 */
  assetIds: number[];
  /** 计算期间 */
  period: {
    year: number;
    month: number;
  };
}

/**
 * API 响应结构
 */
interface ApiResponse<T> {
  code: number;
  message: string;
  data: T;
}

// ============================================================
// 服务类
// ============================================================

/**
 * 资产折旧服务类
 * 
 * 提供折旧计算、报表查询、定时任务触发等业务功能。
 * 
 * @example
 * ```typescript
 * const service = new DepreciationService();
 * const report = await service.getDepreciationReport(123, 2024, 6);
 * ```
 */
export class DepreciationService {
  /** API 基础路径 */
  private readonly basePath = '/depreciation';

  /**
   * 获取资产折旧报表
   * 
   * @param assetId - 资产ID
   * @param year - 查询年份（可选，默认当前年份）
   * @param month - 查询月份（可选，默认当前月份）
   * @returns 折旧汇总数据
   * @throws {Error} 资产不存在或API调用失败
   * 
   * @example
   * ```typescript
   * const summary = await service.getDepreciationReport(123, 2024, 6);
   * console.log(`当前账面价值: ¥${summary.currentBookValue}`);
   * ```
   */
  async getDepreciationReport(
    assetId: number,
    year?: number,
    month?: number
  ): Promise<DepreciationSummary> {
    const params: Record<string, string | number> = { assetId };
    
    if (year !== undefined) {
      params.year = year;
    }
    if (month !== undefined) {
      params.month = month;
    }

    const response = await http.get<ApiResponse<DepreciationSummary>>(
      `${this.basePath}/report`,
      { params }
    );

    // http 拦截器已解包 response.data，response 现在就是 ApiResponse<T>
    const apiResponse = response as any as ApiResponse<DepreciationSummary>;
    if (apiResponse.code !== 200) {
      throw new Error(apiResponse.message || '获取折旧报表失败');
    }

    return apiResponse.data;
  }

  /**
   * 获取资产月度折旧明细
   * 
   * @param assetId - 资产ID
   * @param year - 查询年份
   * @param month - 查询月份
   * @returns 月度折旧记录列表
   * @throws {Error} API调用失败
   */
  async getMonthlyDepreciation(
    assetId: number,
    year: number,
    month: number
  ): Promise<DepreciationRecord[]> {
    const response = await http.get<ApiResponse<DepreciationRecord[]>>(
      `${this.basePath}/monthly`,
      {
        params: { assetId, year, month },
      }
    );

    const apiResponse = response as any as ApiResponse<DepreciationRecord[]>;
    if (apiResponse.code !== 200) {
      throw new Error(apiResponse.message || '获取月度折旧明细失败');
    }

    return apiResponse.data;
  }

  /**
   * 获取折旧记录列表
   * 
   * @param params - 查询参数
   * @returns 折旧记录列表
   */
  async getDepreciationRecords(
    params: DepreciationQueryParams
  ): Promise<DepreciationRecord[]> {
    const queryParams: Record<string, string | number> = {
      assetId: params.assetId,
    };

    if (params.year !== undefined) {
      queryParams.year = params.year;
    }
    if (params.month !== undefined) {
      queryParams.month = params.month;
    }
    if (params.method !== undefined) {
      queryParams.method = params.method;
    }

    const response = await http.get<ApiResponse<DepreciationRecord[]>>(
      `${this.basePath}/records`,
      { params: queryParams }
    );

    const apiResponse = response as any as ApiResponse<DepreciationRecord[]>;
    if (apiResponse.code !== 200) {
      throw new Error(apiResponse.message || '获取折旧记录失败');
    }

    return apiResponse.data;
  }

  /**
   * 手动触发折旧重算
   * 
   * 用于资产信息变更后重新计算折旧。
   * 
   * @param assetId - 资产ID
   * @param startPeriod - 起始期间
   * @param endPeriod - 结束期间
   * @returns 重算结果
   * @throws {Error} 资产不存在或重算失败
   */
  async recalculateDepreciation(
    assetId: number,
    startPeriod: { year: number; month: number },
    endPeriod: { year: number; month: number }
  ): Promise<{ affectedRecords: number }> {
    const request: RecalculateRequest = {
      assetId,
      startPeriod,
      endPeriod,
    };

    const response = await http.post<ApiResponse<{ affectedRecords: number }>>(
      `${this.basePath}/recalculate`,
      request
    );

    const apiResponse = response as any as ApiResponse<{ affectedRecords: number }>;
    if (apiResponse.code !== 200) {
      throw new Error(apiResponse.message || '折旧重算失败');
    }

    return apiResponse.data;
  }

  /**
   * 批量计算折旧
   * 
   * 定时任务或手动触发批量资产折旧计算。
   * 
   * @param assetIds - 资产ID数组
   * @param period - 计算期间
   * @returns 批量计算结果
   */
  async batchCalculate(
    assetIds: number[],
    period: { year: number; month: number }
  ): Promise<{ successCount: number; failedCount: number; errors: string[] }> {
    const request: BatchDepreciationRequest = {
      assetIds,
      period,
    };

    const response = await http.post<
      ApiResponse<{ successCount: number; failedCount: number; errors: string[] }>
    >(`${this.basePath}/batch-calculate`, request);

    const apiResponse = response as any as ApiResponse<{ successCount: number; failedCount: number; errors: string[] }>;
    if (apiResponse.code !== 200) {
      throw new Error(apiResponse.message || '批量计算失败');
    }

    return apiResponse.data;
  }

  /**
   * 获取资产折旧趋势数据
   * 
   * 用于绘制折旧趋势图表。
   * 
   * @param assetId - 资产ID
   * @param startYear - 起始年份
   * @param startMonth - 起始月份
   * @param endYear - 结束年份
   * @param endMonth - 结束月份
   * @returns 趋势数据点列表
   */
  async getDepreciationTrend(
    assetId: number,
    startYear: number,
    startMonth: number,
    endYear: number,
    endMonth: number
  ): Promise<MonthlyDepreciationDetail[]> {
    const response = await http.get<
      ApiResponse<MonthlyDepreciationDetail[]>
    >(`${this.basePath}/trend`, {
      params: {
        assetId,
        startYear,
        startMonth,
        endYear,
        endMonth,
      },
    });

    const apiResponse = response as any as ApiResponse<MonthlyDepreciationDetail[]>;
    if (apiResponse.code !== 200) {
      throw new Error(apiResponse.message || '获取折旧趋势失败');
    }

    return apiResponse.data;
  }

  /**
   * 导出折旧报表
   * 
   * @param assetId - 资产ID
   * @param year - 报表年份
   * @param format - 导出格式（默认 'excel'）
   * @returns 下载链接
   */
  async exportDepreciationReport(
    assetId: number,
    year: number,
    format: 'excel' | 'pdf' = 'excel'
  ): Promise<string> {
    const response = await http.get<ApiResponse<{ downloadUrl: string }>>(
      `${this.basePath}/export`,
      {
        params: { assetId, year, format },
      }
    );

    const apiResponse = response as any as ApiResponse<{ downloadUrl: string }>;
    if (apiResponse.code !== 200) {
      throw new Error(apiResponse.message || '导出报表失败');
    }

    return apiResponse.data.downloadUrl;
  }

  /**
   * 获取折旧配置
   * 
   * @returns 当前系统折旧配置
   */
  async getDepreciationConfig(): Promise<{
    defaultMethod: DepreciationMethod;
    defaultUsefulLifeYears: number;
    defaultSalvageRate: number;
    updateSchedule: string;
  }> {
    const response = await http.get<
      ApiResponse<{
        defaultMethod: DepreciationMethod;
        defaultUsefulLifeYears: number;
        defaultSalvageRate: number;
        updateSchedule: string;
      }>
    >(`${this.basePath}/config`);

    const apiResponse = response as any as ApiResponse<{
      defaultMethod: DepreciationMethod;
      defaultUsefulLifeYears: number;
      defaultSalvageRate: number;
      updateSchedule: string;
    }>;
    if (apiResponse.code !== 200) {
      throw new Error(apiResponse.message || '获取折旧配置失败');
    }

    return apiResponse.data;
  }

  /**
   * 验证资产折旧参数
   * 
   * @param params - 折旧参数
   * @returns 验证结果
   */
  validateDepreciationParams(params: {
    originalValue?: number;
    salvageValue?: number;
    usefulLifeYears?: number;
    method?: DepreciationMethod;
  }): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (params.originalValue !== undefined) {
      if (params.originalValue <= 0) {
        errors.push('原始价值必须大于0');
      }
      if (!Number.isFinite(params.originalValue)) {
        errors.push('原始价值必须是有效数字');
      }
    }

    if (params.salvageValue !== undefined && params.originalValue !== undefined) {
      if (params.salvageValue < 0) {
        errors.push('残值不能为负数');
      }
      if (params.salvageValue >= params.originalValue) {
        errors.push('残值必须小于原始价值');
      }
    }

    if (params.usefulLifeYears !== undefined) {
      if (!Number.isInteger(params.usefulLifeYears)) {
        errors.push('预计使用年限必须是整数');
      }
      if (params.usefulLifeYears < 1 || params.usefulLifeYears > 50) {
        errors.push('预计使用年限必须在1-50年之间');
      }
    }

    if (params.method !== undefined) {
      if (!Object.values(DepreciationMethod).includes(params.method)) {
        errors.push('无效的折旧方法');
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * 计算直线法月折旧额
   * 
   * @param originalValue - 原始价值
   * @param salvageValue - 残值
   * @param usefulLifeYears - 预计使用年限
   * @returns 月折旧额
   * 
   * @example
   * ```typescript
   * const monthlyDepr = DepreciationService.calculateStraightLineMonthly(
   *   100000, 10000, 5
   * );
   * // 返回 1500
   * ```
   */
  static calculateStraightLineMonthly(
    originalValue: number,
    salvageValue: number,
    usefulLifeYears: number
  ): number {
    const depreciableAmount = originalValue - salvageValue;
    const totalMonths = usefulLifeYears * 12;
    return Math.round((depreciableAmount / totalMonths) * 100) / 100;
  }

  /**
   * 计算双倍余额递减法折旧率
   * 
   * @param usefulLifeYears - 预计使用年限
   * @returns 年折旧率
   * 
   * @example
   * ```typescript
   * const rate = DepreciationService.calculateDecliningBalanceRate(5);
   * // 返回 0.4 (40%)
   * ```
   */
  static calculateDecliningBalanceRate(usefulLifeYears: number): number {
    return 2 / usefulLifeYears;
  }

  /**
   * 计算双倍余额递减法月折旧额
   * 
   * @param bookValue - 期初账面价值
   * @param usefulLifeYears - 预计使用年限
   * @returns 月折旧额
   */
  static calculateDecliningBalanceMonthly(
    bookValue: number,
    usefulLifeYears: number
  ): number {
    const annualRate = DepreciationService.calculateDecliningBalanceRate(
      usefulLifeYears
    );
    const monthlyRate = annualRate / 12;
    return Math.round(bookValue * monthlyRate * 100) / 100;
  }
}

// ============================================================
// 导出单例实例
// ============================================================

/**
 * 折旧服务单例实例
 */
export const depreciationService = new DepreciationService();

// ============================================================
// 导出类型（供外部使用）
// ============================================================

export type {
  DepreciationRecord,
  DepreciationSummary,
  MonthlyDepreciationDetail,
  DepreciationQueryParams,
  RecalculateRequest,
  BatchDepreciationRequest,
};