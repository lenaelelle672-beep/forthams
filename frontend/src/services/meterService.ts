/**
 * @file services/meterService.ts
 * @description 能耗仪表读数 API 收敛层
 *
 * 后端：EnergyController（/energy/meters GET/POST）
 */
import http from '@/utils/http';

export interface EnergyMeter {
  id?: number;
  assetId: number;
  meterType: string;
  readingValue: number;
  unit?: string;
  readingDate?: string;
  reader?: string;
  remark?: string;
}

export interface MeterQuery {
  assetId?: number;
  meterType?: string;
  startDate?: string;
  endDate?: string;
}

/** 仪表读数列表 */
export function getReadings(params: MeterQuery = {}): Promise<EnergyMeter[]> {
  return http.get<EnergyMeter[]>('/energy/meters', { params });
}

/** 新增一条读数 */
export function addReading(data: Partial<EnergyMeter>): Promise<EnergyMeter> {
  return http.post<EnergyMeter>('/energy/meters', data);
}

const meterService = {
  getReadings,
  addReading,
};

export default meterService;
