/**
 * @file api/reports.ts
 * @description 报表中心 API — 封装后端 ReportController
 *
 * 对应后端 ReportController (/api/reports)：
 * - GET /api/reports/summary     — 资产汇总统计
 * - GET /api/reports/by-category — 按分类统计
 * - GET /api/reports/trend       — 月度趋势
 * - GET /api/reports/depreciation-stats  — 折旧月度统计
 * - GET /api/reports/maintenance-stats   — 维保月度统计
 * - GET /api/reports/retirement-stats    — 退役处置月度统计
 *
 * @see backend/src/main/java/com/ams/controller/ReportController.java
 */

import http from '@/utils/http';
import type { ApiResponse } from '@/types/common';

// ── 响应类型定义 ──────────────────────────────────────────────────────────────

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

/** 月度趋势数据（对应 TrendReportDTO） */
export interface TrendReport {
  month: string;
  assetCount: number;
  totalValue: number;
}

/** 名称-数值对（对应 StatusDistributionDTO / DeptPendingDTO） */
export interface NameValueItem {
  name: string;
  value: number;
}

/** 月度统计数据（对应 ReportMonthlyDTO） */
export interface ReportMonthly {
  /** 月份标签，如 "1月"、"12月" */
  month: string;
  /** 当月统计数值 */
  value: number;
}

// ── API 函数 ──────────────────────────────────────────────────────────────────

/** 获取资产汇总统计 */
export const getReportSummary = () =>
  http.get<ApiResponse<ReportSummary>>('/reports/summary');

/** 获取按分类统计的资产数据 */
export const getReportByCategory = () =>
  http.get<ApiResponse<CategoryReport[]>>('/reports/by-category');

/** 获取月度资产趋势 */
export const getReportTrend = (months = 12) =>
  http.get<ApiResponse<TrendReport[]>>('/reports/trend', { params: { months } });

/** 获取折旧月度统计 */
export const getDepreciationStats = () =>
  http.get<ApiResponse<ReportMonthly[]>>('/reports/depreciation-stats');

/** 获取维保月度统计 */
export const getMaintenanceStats = () =>
  http.get<ApiResponse<ReportMonthly[]>>('/reports/maintenance-stats');

/** 获取退役处置月度统计 */
export const getRetirementStats = () =>
  http.get<ApiResponse<ReportMonthly[]>>('/reports/retirement-stats');

/** 获取工单状态分布统计 */
export const getWorkOrderStatusDistribution = () =>
  http.get<ApiResponse<NameValueItem[]>>('/workorders/status-distribution');

/** 获取各部门待处理工单数量 */
export const getWorkOrderDeptPending = () =>
  http.get<ApiResponse<NameValueItem[]>>('/workorders/dept-pending');
