/**
 * @file api/stats.ts
 * @description 统计与报表 API — 封装后端 StatsController
 *
 * 对应后端：
 * - StatsController  (/api/stats)
 *
 * ⚠️ 通用报表类型（ReportSummary、CategoryReport）和函数（getReportSummary、
 *    getReportByCategory）已迁移至 api/reports.ts，此处通过 re-export 保持
 *    向后兼容。新代码请直接从 api/reports 导入。
 *
 * @see backend/src/main/java/com/ams/controller/StatsController.java
 * @see frontend/src/api/reports.ts
 */

import http from '@/utils/http';
import type { ApiResponse } from '@/types/common';

// ── StatsController 专用类型 ───────────────────────────────────────────────────

/** 系统统计概览（对应 StatsResponse） */
export interface StatsOverview {
  totalUsers: number;
  totalAssets: number;
  pendingActions: number;
  lastUpdated: string;
}

// ── StatsController (/api/stats) ─────────────────────────────────────────────

/** 获取系统统计概览 */
export const getStatsOverview = () =>
  http.get<ApiResponse<StatsOverview>>('/stats/overview');

// ── 从 api/reports.ts re-export（向后兼容） ────────────────────────────────────

export type {
  ReportSummary,
  CategoryReport,
} from '@/api/reports';

export {
  getReportSummary,
  getReportByCategory,
} from '@/api/reports';


export interface UtilizationOverview { utilizationRate: number; overallUtilizationRate?: number; activeAssets: number; idleAssets: number; totalAssets: number; idleAssetCount?: number; inUseAssetCount?: number; highUtilizationCount?: number; }
export interface UtilizationTrend { date: string; month?: string; utilizationRate: number; usedHours?: number; activeCount: number; idleCount: number; }
export interface UtilizationSummary { label: string; value: number; change?: number; byCategory?: { name?: string; category?: string; value: number; utilizationRate?: number }[]; }
export interface AssetUtilization { id: string | number; assetId?: string | number; assetName: string; assetNo?: string; assetCode?: string; utilizationRate: number; usedHours?: number; usageHours?: number; idleDays?: number; status?: string; }

export const getUtilizationOverview = (..._args: unknown[]) => http.get<UtilizationOverview>('/utilization/overview');
export const getUtilizationTrend = (..._args: unknown[]) => http.get<UtilizationTrend[]>('/utilization/trend');
export const getUtilizationSummary = (..._args: unknown[]) => http.get<UtilizationSummary[]>('/utilization/summary');
export const getTopUtilized = (..._args: unknown[]) => http.get<AssetUtilization[]>('/utilization/top');
export const getIdleAssets = (..._args: unknown[]) => http.get<AssetUtilization[]>('/utilization/idle');
