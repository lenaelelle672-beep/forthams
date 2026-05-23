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
