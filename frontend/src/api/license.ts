import http from '@/utils/http';

export interface SoftwareLicense {
  id?: number;
  licenseName: string;
  licenseKey?: string;
  softwareType?: string;
  manufacturer?: string;
  version?: string;
  licenseType?: string;
  totalSeats?: number;
  purchaseDate?: string;
  expiryDate?: string;
  purchasePrice?: number;
  purchaseOrderNo?: string;
  status?: string;
  fileUrl?: string;
  remark?: string;
}

export const getLicenses = (params?: Record<string, any>) =>
  http.get<any>('/licenses', { params });

export const getLicenseSummary = () =>
  http.get<any>('/licenses/summary');

export const getExpiringLicenses = (days = 30) =>
  http.get<SoftwareLicense[]>('/licenses/expiring', { params: { days } });

export const getLicenseDetail = (id: number) =>
  http.get<any>(`/licenses/${id}`);

export const getLicenseAssignments = (id: number) =>
  http.get<any[]>(`/licenses/${id}/assignments`);

export const createLicense = (data: SoftwareLicense) =>
  http.post<SoftwareLicense>('/licenses', data);

export const updateLicense = (id: number, data: SoftwareLicense) =>
  http.put<SoftwareLicense>(`/licenses/${id}`, data);

export const deleteLicense = (id: number) =>
  http.delete(`/licenses/${id}`);

export const assignLicense = (id: number, data: { assetId?: number; userId?: number; notes?: string }) =>
  http.post<any>(`/licenses/${id}/assign`, data);

export const returnLicense = (id: number, assignmentId: number, notes?: string) =>
  http.post(`/licenses/${id}/return`, { assignmentId, notes });
