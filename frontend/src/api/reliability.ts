/**
 * @file api/reliability.ts
 * @description 可靠性分析 API
 */

import http from '@/utils/http';
import type { ApiResponse } from '@/types/common';
import type { ReliabilitySummary, ReliabilityTrend, ReliabilityRanking } from '@/types/reliability';

/** 获取可靠性概览 */
export const getReliabilitySummary = (params?: { assetId?: number; startDate?: string; endDate?: string }) =>
  http.get<ApiResponse<ReliabilitySummary>>('/reliability/summary', { params });

/** 获取可靠性趋势 */
export const getReliabilityTrend = (params?: { period?: string; startDate?: string; endDate?: string }) =>
  http.get<ApiResponse<ReliabilityTrend[]>>('/reliability/trend', { params });

/** 获取可靠性排名 */
export const getReliabilityRanking = (params?: { sortBy?: string; limit?: number }) =>
  http.get<ApiResponse<ReliabilityRanking[]>>('/reliability/ranking', { params });

/** 获取指定资产可靠性 */
export const getReliabilityByAsset = (assetId: number) =>
  http.get<ApiResponse<any>>(`/reliability/asset/${assetId}`);
