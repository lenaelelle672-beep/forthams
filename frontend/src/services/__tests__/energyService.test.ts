import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/utils/http', () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() },
}));

import http from '@/utils/http';
import {
  getDashboard, getSummaryByLocation, getConsumptionAggregate, getBySpace,
  getConsumption, getCompare, getRanking, getAnomalies, getLocationAssets,
  isEnergyDashboard, toSafeNumber,
} from '../energyService';

const mockedHttp = vi.mocked(http);

describe('energyService', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  describe('getDashboard', () => {
    it('should call /energy/dashboard with params', async () => {
      mockedHttp.get.mockResolvedValueOnce({ byType: {}, trend: {}, assetRanking: [], total: 100 });
      const result = await getDashboard({ startDate: '2026-01-01', periodType: 'MONTH' });
      expect(mockedHttp.get).toHaveBeenCalledWith('/energy/dashboard', { params: { startDate: '2026-01-01', periodType: 'MONTH' } });
      expect(result.total).toBe(100);
    });
    it('should call with empty params by default', async () => {
      mockedHttp.get.mockResolvedValueOnce({ byType: {}, trend: {}, assetRanking: [], total: 0 });
      await getDashboard();
      expect(mockedHttp.get).toHaveBeenCalledWith('/energy/dashboard', { params: {} });
    });
  });

  describe('getSummaryByLocation', () => {
    it('should call /energy/summary/by-location', async () => {
      mockedHttp.get.mockResolvedValueOnce({});
      await getSummaryByLocation({ locationId: 1, periodType: 'MONTH' });
      expect(mockedHttp.get).toHaveBeenCalledWith('/energy/summary/by-location', { params: { locationId: 1, periodType: 'MONTH' } });
    });
  });

  describe('getConsumptionAggregate', () => {
    it('should call /energy/consumption/aggregate', async () => {
      mockedHttp.get.mockResolvedValueOnce([]);
      await getConsumptionAggregate({ locationId: 1 });
      expect(mockedHttp.get).toHaveBeenCalledWith('/energy/consumption/aggregate', { params: { locationId: 1 } });
    });
  });

  describe('getBySpace', () => {
    it('should call /energy/by-space with type BUILDING', async () => {
      mockedHttp.get.mockResolvedValueOnce([]);
      await getBySpace({ type: 'BUILDING', periodType: 'MONTH' });
      expect(mockedHttp.get).toHaveBeenCalledWith('/energy/by-space', { params: { type: 'BUILDING', periodType: 'MONTH' } });
    });
    it('should include parentId', async () => {
      mockedHttp.get.mockResolvedValueOnce([]);
      await getBySpace({ type: 'FLOOR', parentId: 1 });
      expect(mockedHttp.get).toHaveBeenCalledWith('/energy/by-space', { params: { type: 'FLOOR', parentId: 1 } });
    });
  });

  describe('getConsumption', () => {
    it('should call /energy/consumption with params', async () => {
      mockedHttp.get.mockResolvedValueOnce([]);
      await getConsumption({ assetId: 1, meterType: 'ELECTRICITY', periodType: 'MONTH' });
      expect(mockedHttp.get).toHaveBeenCalledWith('/energy/consumption', { params: { assetId: 1, meterType: 'ELECTRICITY', periodType: 'MONTH' } });
    });
    it('should call without params', async () => {
      mockedHttp.get.mockResolvedValueOnce([]);
      await getConsumption();
      expect(mockedHttp.get).toHaveBeenCalledWith('/energy/consumption', { params: {} });
    });
  });

  describe('getCompare', () => {
    it('should call /energy/compare with all params', async () => {
      mockedHttp.get.mockResolvedValueOnce({ current: {}, previous: {}, changeRate: 0 });
      await getCompare({ currentStart: '2026-01-01', currentEnd: '2026-03-31', previousStart: '2025-01-01', previousEnd: '2025-03-31', groupBy: 'MONTH' });
      expect(mockedHttp.get).toHaveBeenCalledWith('/energy/compare', {
        params: { currentStart: '2026-01-01', currentEnd: '2026-03-31', previousStart: '2025-01-01', previousEnd: '2025-03-31', groupBy: 'MONTH' },
      });
    });
  });

  describe('getRanking', () => {
    it('should call /energy/ranking with scope', async () => {
      mockedHttp.get.mockResolvedValueOnce([]);
      await getRanking({ scope: 'asset', meterType: 'ELECTRICITY', limit: 10 });
      expect(mockedHttp.get).toHaveBeenCalledWith('/energy/ranking', { params: { scope: 'asset', meterType: 'ELECTRICITY', limit: 10 } });
    });
  });

  describe('getAnomalies', () => {
    it('should call /energy/anomalies with params', async () => {
      mockedHttp.get.mockResolvedValueOnce([]);
      await getAnomalies({ periodType: 'MONTH', method: 'zscore', threshold: 1.5 });
      expect(mockedHttp.get).toHaveBeenCalledWith('/energy/anomalies', { params: { periodType: 'MONTH', method: 'zscore', threshold: 1.5 } });
    });
  });

  describe('getLocationAssets', () => {
    it('should call /energy/locations/{id}/assets', async () => {
      mockedHttp.get.mockResolvedValueOnce([]);
      await getLocationAssets(1, { withEnergy: true });
      expect(mockedHttp.get).toHaveBeenCalledWith('/energy/locations/1/assets', { params: { withEnergy: true } });
    });
    it('should call with default empty params', async () => {
      mockedHttp.get.mockResolvedValueOnce([]);
      await getLocationAssets(1);
      expect(mockedHttp.get).toHaveBeenCalledWith('/energy/locations/1/assets', { params: {} });
    });
  });

  describe('isEnergyDashboard', () => {
    it('should return true for valid dashboard', () => {
      expect(isEnergyDashboard({ byType: {}, trend: {}, assetRanking: [], total: 100 })).toBe(true);
    });
    it('should return true for partial match', () => {
      expect(isEnergyDashboard({ byType: {} })).toBe(true);
      expect(isEnergyDashboard({ total: 0 })).toBe(true);
    });
    it('should return false for null/undefined/primitives', () => {
      expect(isEnergyDashboard(null)).toBe(false);
      expect(isEnergyDashboard(undefined)).toBe(false);
      expect(isEnergyDashboard(42)).toBe(false);
      expect(isEnergyDashboard('string')).toBe(false);
    });
    it('should return false for empty object', () => {
      expect(isEnergyDashboard({})).toBe(false);
    });
  });

  describe('toSafeNumber', () => {
    it('should return number as-is', () => { expect(toSafeNumber(42)).toBe(42); expect(toSafeNumber(-1.5)).toBe(-1.5); });
    it('should parse numeric strings', () => { expect(toSafeNumber('42')).toBe(42); expect(toSafeNumber('3.14')).toBe(3.14); });
    it('should return fallback for null/undefined', () => { expect(toSafeNumber(null)).toBe(0); expect(toSafeNumber(undefined)).toBe(0); });
    it('should return fallback for NaN/Infinity', () => { expect(toSafeNumber(NaN)).toBe(0); expect(toSafeNumber(Infinity)).toBe(0); });
    it('should return fallback for non-numeric strings', () => { expect(toSafeNumber('abc')).toBe(0); expect(toSafeNumber('')).toBe(0); });
    it('should use custom fallback', () => { expect(toSafeNumber(null, -1)).toBe(-1); expect(toSafeNumber('invalid', 100)).toBe(100); });
    it('should handle objects', () => { expect(toSafeNumber({})).toBe(0); expect(toSafeNumber([])).toBe(0); });
  });
});
