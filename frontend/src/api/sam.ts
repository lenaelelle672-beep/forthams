/**
 * @file api/sam.ts
 * @description SAM 合规 API
 */

import http from '@/utils/http';
import type { PageData } from '@/types/common';

export interface SamComplianceScan {
  id: number;
  scanDate: string;
  totalLicenses: number;
  compliantCount: number;
  overusedCount: number;
  underusedCount: number;
  expiredCount: number;
  complianceRate: number;
  status: string;
  createdAt: string;
}

export interface SamDetailItem {
  id: number;
  scanId: number;
  licenseId: number;
  softwareName: string;
  licenseType: string;
  totalSeats: number;
  usedSeats: number;
  complianceStatus: string;
  riskLevel: string;
  recommendation: string;
  expiryDate?: string;
}

export interface SamDashboardData {
  hasData: boolean;
  complianceRate: number;
  totalLicenses: number;
  compliantCount: number;
  overusedCount: number;
  underusedCount: number;
  expiredCount: number;
  highRiskItems: SamDetailItem[];
  byLicenseType: Record<string, number>;
  upcomingExpiry?: SamDetailItem[];
  scanId: number;
  scanDate: string;
}

export interface SamScanDetails {
  details: SamDetailItem[];
}

export const runSamComplianceScan = () =>
  http.post<SamComplianceScan>('/sam/scan');

export const getSamDashboard = () =>
  http.get<SamDashboardData>('/sam/dashboard');

export const getSamHistory = (params?: { page?: number; pageSize?: number }) =>
  http.get<PageData<SamComplianceScan>>('/sam/history', { params });

export const getSamScanDetails = (scanId: number) =>
  http.get<SamScanDetails>(`/sam/${scanId}/details`);
