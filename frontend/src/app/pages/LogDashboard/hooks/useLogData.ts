/**
 * LogDashboard Data Hook - 核心业务流入口
 * 
 * 本模块负责从后端折旧服务获取数据，并转换为前端可用的格式。
 * 折旧计算支持两种方法：
 *   - 直线法 (Straight-Line): 年折旧额 = (原值 - 残值) / 预计使用年限
 *   - 双倍余额递减法 (Double Declining Balance): 年折旧率 = 2 / 预计使用年限 × 100%
 * 
 * @module LogDashboard/useLogData
 * @version SWARM-S5-003 Iteration 1
 */

import { useState, useEffect, useCallback } from 'react';
import { dashboardService } from '@app/services/dashboardService';
import { depreciationService } from '@app/services/depreciationService';
import type { DashboardStats } from '@app/types/audit.types';
import type { DepreciationRecord, DepreciationMethod } from '@app/types/depreciation.types';

/** 折旧计算结果数据结构 */
export interface DepreciationResult {
  /** 资产编号 */
  assetCode: string;
  /** 资产名称 */
  assetName: string;
  /** 折旧方法 */
  method: DepreciationMethod;
  /** 原值 (人民币 CNY) */
  originalValue: number;
  /** 残值 */
  residualValue: number;
  /** 预计使用年限 (1-50年) */
  usefulLifeYears: number;
  /** 当前年度折旧额 */
  annualDepreciation: number;
  /** 累计折旧 */
  accumulatedDepreciation: number;
  /** 账面价值 */
  bookValue: number;
  /** 折旧进度百分比 */
  progressPercentage: number;
  /** 到期预警 (提前30天) */
  expiringSoon: boolean;
  /** 折旧到期日期 */
  expirationDate: string;
}

/** 日志数据查询参数 */
export interface LogDataQueryParams {
  /** 开始日期 */
  startDate?: string;
  /** 结束日期 */
  endDate?: string;
  /** 资产类别 */
  assetCategory?: string;
  /** 使用部门 */
  department?: string;
  /** 折旧方法筛选 */
  depreciationMethod?: DepreciationMethod;
  /** 页码 */
  page?: number;
  /** 每页条数 */
  pageSize?: number;
}

/** 日志数据Hook返回值 */
export interface UseLogDataReturn {
  /** 折旧记录列表 */
  records: DepreciationResult[];
  /** 是否加载中 */
  loading: boolean;
  /** 错误信息 */
  error: string | null;
  /** 总记录数 */
  totalCount: number;
  /** 当前页码 */
  currentPage: number;
  /** 每页条数 */
  pageSize: number;
  /** 刷新数据 */
  refresh: () => Promise<void>;
  /** 计算指定资产的折旧 (直线法) */
  calculateStraightLine: (assetCode: string, originalValue: number, residualRate: number, years: number) => number;
  /** 计算指定资产的折旧 (双倍余额递减法) */
  calculateDoubleDeclining: (assetCode: string, originalValue: number, years: number) => DepreciationResult;
}

/**
 * 计算直线法折旧
 * 
 * 公式: 年折旧额 = (原值 - 原值 × 残值率) / 预计使用年限
 * 
 * @param originalValue - 资产原值，必须 > 0
 * @param residualRate - 残值率，必须 >= 0% 且 <= 20%
 * @param years - 预计使用年限，必须 >= 1 且 <= 50
 * @returns 年折旧额 (保留两位小数)
 * @throws Error 当参数超出边界约束范围
 * 
 * @example
 * // 原值100000, 残值率5%, 年限5年 => 年折旧19000
 * const annual = calculateStraightLine(100000, 0.05, 5); // 19000
 */
export function calculateStraightLine(
  originalValue: number,
  residualRate: number,
  years: number
): number {
  // 边界约束校验
  if (originalValue <= 0) {
    throw new Error('原值必须大于零 (DEP-004)');
  }
  if (years < 1 || years > 50) {
    throw new Error('无效的使用年限，必须在1-50年之间 (DEP-001)');
  }
  if (residualRate < 0 || residualRate > 0.2) {
    throw new Error('残值率超出允许范围，必须在0%-20%之间 (DEP-002)');
  }

  const residualValue = originalValue * residualRate;
  const depreciableAmount = originalValue - residualValue;
  const annualDepreciation = depreciableAmount / years;

  // 精度处理：保留两位小数，第三位四舍五入
  return Math.round(annualDepreciation * 100) / 100;
}

/**
 * 计算双倍余额递减法折旧
 * 
 * 公式: 年折旧率 = 2 / 预计使用年限 × 100%
 * 当剩余年限 × 当前折旧额 < 账面值 - 残值时，提前切换为直线法
 * 
 * @param originalValue - 资产原值，必须 > 0
 * @param years - 预计使用年限，必须 >= 1 且 <= 50
 * @param currentYear - 当前折旧年度 (从1开始)
 * @returns 包含年折旧额、累计折旧、账面价值的折旧结果
 * 
 * @example
 * // 原值100000, 年限5年, 第1年 => 折旧40000
 * const result = calculateDoubleDeclining(100000, 5, 1);
 */
export function calculateDoubleDeclining(
  originalValue: number,
  years: number,
  currentYear: number
): { annualDepreciation: number; accumulatedDepreciation: number; bookValue: number } {
  // 边界约束校验
  if (originalValue <= 0) {
    throw new Error('原值必须大于零 (DEP-004)');
  }
  if (years < 1 || years > 50) {
    throw new Error('无效的使用年限，必须在1-50年之间 (DEP-001)');
  }

  // 双倍折旧率
  const decliningRate = 2 / years;
  
  let bookValue = originalValue;
  let accumulatedDepreciation = 0;
  const residualValue = originalValue * 0.05; // 默认残值率5%

  for (let year = 1; year <= currentYear; year++) {
    const remainingYears = years - year + 1;
    const potentialDecliningDepreciation = bookValue * decliningRate;
    const straightLineAmount = (bookValue - residualValue) / remainingYears;

    // 判断是否需要切换为直线法 (提前2年切换)
    const switchYear = years - 2;
    if (year >= switchYear && switchYear > 0) {
      // 切换后使用直线法平摊
      bookValue = bookValue - straightLineAmount;
      accumulatedDepreciation += straightLineAmount;
    } else {
      // 双倍余额递减
      const depreciation = potentialDecliningDepreciation > straightLineAmount 
        ? potentialDecliningDepreciation 
        : straightLineAmount;
      
      // 确保账面值不低于残值
      if (bookValue - depreciation < residualValue) {
        bookValue = residualValue;
        accumulatedDepreciation += bookValue - residualValue;
      } else {
        bookValue -= depreciation;
        accumulatedDepreciation += depreciation;
      }
    }
  }

  return {
    annualDepreciation: Math.round(potentialDecliningDepreciation * 100) / 100,
    accumulatedDepreciation: Math.round(accumulatedDepreciation * 100) / 100,
    bookValue: Math.round(bookValue * 100) / 100
  };
}

/**
 * LogDashboard 数据获取 Hook
 * 
 * @param params - 查询参数
 * @returns 折旧记录数据和操作方法
 */
export function useLogData(params: LogDataQueryParams = {}): UseLogDataReturn {
  // 状态管理
  const [records, setRecords] = useState<DepreciationResult[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [totalCount, setTotalCount] = useState<number>(0);
  const [currentPage, setCurrentPage] = useState<number>(params.page || 1);
  const [pageSize, setPageSize] = useState<number>(params.pageSize || 20);

  /**
   * 从折旧记录计算进度和预警状态
   * 
   * @param record - 折旧记录
   * @param acquisitionDate - 购置日期
   * @returns 处理后的折旧结果
   */
  const processDepreciationRecord = useCallback((
    record: DepreciationRecord,
    acquisitionDate: string
  ): DepreciationResult => {
    const now = new Date();
    const acquireDate = new Date(acquisitionDate);
    const yearsElapsed = (now.getTime() - acquireDate.getTime()) / (365.25 * 24 * 60 * 60 * 1000);
    
    // 计算到期日期
    const expirationDate = new Date(acquireDate);
    expirationDate.setFullYear(expirationDate.getFullYear() + record.usefulLifeYears);
    
    // 提前30天预警
    const warningThreshold = 30 * 24 * 60 * 60 * 1000; // 30天毫秒数
    const daysUntilExpiration = expirationDate.getTime() - now.getTime();
    const expiringSoon = daysUntilExpiration > 0 && daysUntilExpiration <= warningThreshold;
    
    // 进度百分比
    const progressPercentage = Math.min((yearsElapsed / record.usefulLifeYears) * 100, 100);

    return {
      assetCode: record.assetCode,
      assetName: record.assetName,
      method: record.depreciationMethod,
      originalValue: record.originalValue,
      residualValue: record.residualValue,
      usefulLifeYears: record.usefulLifeYears,
      annualDepreciation: record.annualDepreciation,
      accumulatedDepreciation: record.accumulatedDepreciation,
      bookValue: record.bookValue,
      progressPercentage: Math.round(progressPercentage * 100) / 100,
      expiringSoon,
      expirationDate: expirationDate.toISOString().split('T')[0]
    };
  }, []);

  /**
   * 从后端获取折旧数据
   */
  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      // 调用后端折旧服务获取数据
      const response = await depreciationService.getDepreciationRecords({
        startDate: params.startDate,
        endDate: params.endDate,
        assetCategory: params.assetCategory,
        department: params.department,
        depreciationMethod: params.depreciationMethod,
        page: currentPage,
        pageSize
      });

      // 处理折旧记录，添加预警状态
      const processedRecords: DepreciationResult[] = response.records.map((record) => 
        processDepreciationRecord(record, record.acquisitionDate)
      );

      setRecords(processedRecords);
      setTotalCount(response.totalCount);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '获取折旧数据失败';
      setError(errorMessage);
      console.error('[useLogData] Fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, [params, currentPage, pageSize, processDepreciationRecord]);

  /**
   * 刷新数据
   */
  const refresh = useCallback(async () => {
    await fetchData();
  }, [fetchData]);

  /**
   * 计算指定资产的直线法折旧
   * 
   * @param assetCode - 资产编号
   * @param originalValue - 原值
   * @param residualRate - 残值率
   * @param years - 使用年限
   * @returns 年折旧额
   */
  const calcStraightLine = useCallback((
    assetCode: string,
    originalValue: number,
    residualRate: number,
    years: number
  ): number => {
    try {
      return calculateStraightLine(originalValue, residualRate, years);
    } catch (err) {
      console.error(`[useLogData] Straight-line calculation error for ${assetCode}:`, err);
      throw err;
    }
  }, []);

  /**
   * 计算指定资产的双倍余额递减法折旧
   * 
   * @param assetCode - 资产编号
   * @param originalValue - 原值
   * @param years - 使用年限
   * @returns 折旧计算结果
   */
  const calcDoubleDeclining = useCallback((
    assetCode: string,
    originalValue: number,
    years: number
  ): DepreciationResult => {
    try {
      const result = calculateDoubleDeclining(originalValue, years, 1);
      return {
        assetCode,
        assetName: '',
        method: 'DOUBLE_DECLINING' as DepreciationMethod,
        originalValue,
        residualValue: originalValue * 0.05,
        usefulLifeYears: years,
        annualDepreciation: result.annualDepreciation,
        accumulatedDepreciation: result.accumulatedDepreciation,
        bookValue: result.bookValue,
        progressPercentage: 0,
        expiringSoon: false,
        expirationDate: ''
      };
    } catch (err) {
      console.error(`[useLogData] Double-declining calculation error for ${assetCode}:`, err);
      throw err;
    }
  }, []);

  // 初始加载和参数变化时重新获取数据
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return {
    records,
    loading,
    error,
    totalCount,
    currentPage,
    pageSize,
    refresh,
    calculateStraightLine: calcStraightLine,
    calculateDoubleDeclining: calcDoubleDeclining
  };
}

export default useLogData;