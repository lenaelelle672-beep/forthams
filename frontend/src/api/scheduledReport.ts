/**
 * @file api/scheduledReport.ts
 * @description 定时报表 API 封装
 */

import http from '@/utils/http';
import type { ScheduledReport } from '@/types/scheduledReport';
import type { PageData } from '@/types/common';

export function getScheduledReports(
  pageNum = 1,
  pageSize = 10,
  status?: string,
): Promise<PageData<ScheduledReport>> {
  return http.get('/scheduled-reports', { params: { pageNum, pageSize, status } });
}

export function getScheduledReport(id: number): Promise<ScheduledReport> {
  return http.get(`/scheduled-reports/${id}`);
}

export function createScheduledReport(data: Partial<ScheduledReport>): Promise<ScheduledReport> {
  return http.post('/scheduled-reports', data);
}

export function updateScheduledReport(id: number, data: Partial<ScheduledReport>): Promise<ScheduledReport> {
  return http.put(`/scheduled-reports/${id}`, data);
}

export function deleteScheduledReport(id: number): Promise<void> {
  return http.delete(`/scheduled-reports/${id}`);
}

export function toggleScheduledReport(id: number): Promise<ScheduledReport> {
  return http.put(`/scheduled-reports/${id}/toggle`);
}
