/**
 * @file hooks/useReports.ts
 * @description 报表中心 TanStack Query hooks
 */

import { useQuery } from '@tanstack/react-query';
import { getReportSummary, getReportByCategory } from '@/api/stats';
import http from '@/utils/http';
import type { ApiResponse } from '@/types/common';

// ── 类型 ──────────────────────────────────────────────────────────────────────

export interface ReportTrend {
  month: string;
  totalValue: number;
  netValue: number;
}

// ── API 调用 ──────────────────────────────────────────────────────────────────

/** 获取月度趋势数据 */
export const getReportTrend = () =>
  http.get<ApiResponse<ReportTrend[]>>('/reports/trend');

// ── Query keys ────────────────────────────────────────────────────────────────

export const reportKeys = {
  all:        ['reports'] as const,
  summary:    () => [...reportKeys.all, 'summary'] as const,
  byCategory: () => [...reportKeys.all, 'by-category'] as const,
  trend:      () => [...reportKeys.all, 'trend'] as const,
};

// ── Hooks ─────────────────────────────────────────────────────────────────────

export function useReportSummary() {
  return useQuery({
    queryKey: reportKeys.summary(),
    queryFn:  getReportSummary,
    staleTime: 1000 * 60 * 5,
  });
}

export function useReportByCategory() {
  return useQuery({
    queryKey: reportKeys.byCategory(),
    queryFn:  getReportByCategory,
    staleTime: 1000 * 60 * 5,
  });
}

export function useReportTrend() {
  return useQuery({
    queryKey: reportKeys.trend(),
    queryFn:  getReportTrend,
    staleTime: 1000 * 60 * 5,
  });
}
