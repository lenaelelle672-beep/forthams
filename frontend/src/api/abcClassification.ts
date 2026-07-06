/**
 * @file api/abcClassification.ts
 * @description ABC 分类 API 客户端
 */

import http from '@/utils/http';

// ---------------------------------------------------------------------------
// 类型定义
// ---------------------------------------------------------------------------

/**
 * 批量操作结果
 */
export interface BatchResult {
  total: number;
  success: number;
  failure: number;
  message?: string;
}

/**
 * 分类统计数据
 */
export interface ClassificationStatistics {
  A_count: number;
  B_count: number;
  C_count: number;
  CATEGORY_count: number;
  total_value?: number;
  A_total_value?: number;
  B_total_value?: number;
  C_total_value?: number;
  CATEGORY_total_value?: number;
}

/**
 * API 响应包装（与后端 Result<T> 对应）
 */
export interface ApiResponse<T> {
  code: number;
  message: string;
  data: T;
}

// ---------------------------------------------------------------------------
// ABC 分类 API
// ---------------------------------------------------------------------------

/**
 * ABC 分类 API 客户端
 */
export const abcClassificationApi = {
  /**
   * 批量重新分类所有资产
   */
  reclassifyAll: (): Promise<BatchResult> => {
    return http.post<BatchResult>('/abc/reclassify');
  },

  /**
   * 单个资产重新分类
   */
  reclassifyAsset: (assetId: number): Promise<string> => {
    return http.post<string>(`/abc/reclassify/${assetId}`);
  },

  /**
   * 按分类 ID 批量重新分类
   */
  reclassifyByCategoryIds: (categoryIds: number[]): Promise<BatchResult> => {
    return http.post<BatchResult>('/abc/reclassify/by-category', categoryIds);
  },

  /**
   * 获取分类统计
   */
  getStatistics: (): Promise<ClassificationStatistics> => {
    return http.get<ClassificationStatistics>('/abc/statistics');
  },

  /**
   * 查询资产当前分类
   */
  getByAssetId: (assetId: number): Promise<string> => {
    return http.get<string>(`/abc/${assetId}`);
  },
};

export default abcClassificationApi;