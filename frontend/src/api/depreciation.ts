import http from '@/utils/http';

export interface DepreciationScheduleItem {
  id: number;
  assetId: number;
  assetNo: string;
  assetName: string;
  period: string;
  depreciationAmount: number;
  accumulatedDepreciation: number;
  netValue: number;
  depreciationRate?: number;
  assetStatus?: string;
  depreciationMethod?: string;
}

export interface DepreciationFilter {
  assetNo?: string;
  period?: string;
  method?: string;
  page?: number;
  pageSize?: number;
}

export interface DepreciationScheduleResponse {
  data: DepreciationScheduleItem[];
  total: number;
  page: number;
  pageSize: number;
}

export interface BatchCalculateRequest {
  assetIds: number[];
}

export interface BatchCalculateResponse {
  processedCount?: number;
  message?: string;
}

export interface DepreciationMethod {
  code: string;
  label: string;
}

export interface DepreciationRecord {
  id: number;
  assetId: number;
  assetNo?: string;
  assetName?: string;
  method: string;
  periodStart: string;
  periodEnd: string;
  depreciationAmount: number;
  bookValueBefore: number;
  bookValueAfter: number;
  createTime: string;
}

export const PERIOD_REGEX = /^\d{4}-(?:0[1-9]|1[0-2])$/;

export async function getDepreciationSchedules(
  filters?: DepreciationFilter,
): Promise<DepreciationScheduleResponse> {
  const params: Record<string, string | number> = {};
  if (filters?.assetNo) params.assetNo = filters.assetNo;
  if (filters?.period) params.period = filters.period;
  if (filters?.method) params.method = filters.method;
  if (filters?.page) params.page = filters.page;
  if (filters?.pageSize) params.size = filters.pageSize;
  return http.get<DepreciationScheduleResponse>('/depreciation/schedules', { params });
}

export async function batchCalculateDepreciation(
  request: BatchCalculateRequest,
): Promise<BatchCalculateResponse> {
  return http.post<BatchCalculateResponse>('/depreciation/calculate', request);
}

export async function getDepreciationMethods(): Promise<DepreciationMethod[]> {
  return http.get<DepreciationMethod[]>('/depreciation/methods');
}

export async function getDepreciationRecords(params: {
  assetId?: number;
  periodStart?: string;
  periodEnd?: string;
  page?: number;
  pageSize?: number;
}): Promise<any> {
  return http.get<any>('/depreciation/records', { params });
}

export async function getDepreciationHistory(
  assetId: number,
  page: number = 1,
  pageSize: number = 20,
): Promise<DepreciationScheduleResponse> {
  return http.get<DepreciationScheduleResponse>(
    `/assets/${assetId}/depreciation-schedule`,
    { params: { page, pageSize } },
  );
}
