/**
 * @file api/savedReport.ts
 * @description 已保存报表 API 封装
 */

import http from '@/utils/http';
import type { SavedReport } from '@/types/savedReport';
import type { PageData } from '@/types/common';

export function getSavedReports(
  reportType?: string,
  keyword?: string,
  pageNum = 1,
  pageSize = 10,
): Promise<PageData<SavedReport>> {
  return http.get('/saved-reports', { params: { reportType, keyword, pageNum, pageSize } });
}

export function getSavedReport(id: number): Promise<SavedReport> {
  return http.get(`/saved-reports/${id}`);
}

export function createSavedReport(data: Partial<SavedReport>): Promise<SavedReport> {
  return http.post('/saved-reports', data);
}

export function updateSavedReport(id: number, data: Partial<SavedReport>): Promise<SavedReport> {
  return http.put(`/saved-reports/${id}`, data);
}

export function deleteSavedReport(id: number): Promise<void> {
  return http.delete(`/saved-reports/${id}`);
}

export function executeSavedReport(id: number): Promise<Record<string, any>[]> {
  return http.post(`/saved-reports/${id}/execute`);
}
