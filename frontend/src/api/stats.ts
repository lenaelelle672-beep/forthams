/**
 * @file api/stats.ts
 * @description 统计与报表 API — 封装后端 StatsController 和 ReportController
 *
 * 对应后端：
 * - StatsController  (/api/stats)
 * - ReportController (/api/reports)
 *
 * @see backend/src/main/java/com/ams/controller/StatsController.java
 * @see backend/src/main/java/com/ams/controller/ReportController.java
 */

import http from '@/utils/http';
import type { ApiResponse } from '@/types/common';

// ── 响应类型定义 ──────────────────────────────────────────────────────────────

/** 系统统计概览（对应 StatsResponse） */
export interface StatsOverview {
  totalUsers: number;
  totalAssets: number;
  pendingActions: number;
  lastUpdated: string;
}

/** 资产汇总统计（对应 ReportSummaryDTO） */
export interface ReportSummary {
  totalAssets: number;
  activeAssets: number;
  pendingApproval: number;
  recentlyRetired: number;
}

/** 分类统计项（对应 CategoryReportDTO） */
export interface CategoryReport {
  categoryName: string;
  assetCount: number;
  totalValue: number;
}

// ── StatsController (/api/stats) ─────────────────────────────────────────────

/** 获取系统统计概览 */
export const getStatsOverview = () =>
  http.get<ApiResponse<StatsOverview>>('/api/stats/overview');

// ── ReportController (/api/reports) ──────────────────────────────────────────

/** 获取资产汇总统计 */
export const getReportSummary = () =>
  http.get<ApiResponse<ReportSummary>>('/api/reports/summary');

/** 获取按分类统计的资产数据 */
export const getReportByCategory = () =>
  http.get<ApiResponse<CategoryReport[]>>('/api/reports/by-category');
