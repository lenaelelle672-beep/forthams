import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/utils/http', () => ({ default: { get: vi.fn(), put: vi.fn() } }));

import http from '@/utils/http';
import gisService from '../gisService';
const mockedHttp = vi.mocked(http);

describe('gisService', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('getAssets should call /gis/assets with params', async () => {
    mockedHttp.get.mockResolvedValueOnce([{ id: 1 }]);
    await gisService.getAssets({ categoryId: 1, status: 'IN_USE' });
    expect(mockedHttp.get).toHaveBeenCalledWith('/gis/assets', { params: { categoryId: 1, status: 'IN_USE' } });
  });
  it('getAssets should call with empty params', async () => {
    mockedHttp.get.mockResolvedValueOnce([]);
    await gisService.getAssets();
    expect(mockedHttp.get).toHaveBeenCalledWith('/gis/assets', { params: {} });
  });
  it('getStats should call /gis/stats', async () => {
    mockedHttp.get.mockResolvedValueOnce({ total: 100, byStatus: {}, byCategory: {} });
    const r = await gisService.getStats();
    expect(mockedHttp.get).toHaveBeenCalledWith('/gis/stats');
    expect(r.total).toBe(100);
  });
  it('updateAssetLocation should call PUT with lat/lng', async () => {
    mockedHttp.put.mockResolvedValueOnce(undefined);
    await gisService.updateAssetLocation(1, 39.9, 116.4);
    expect(mockedHttp.put).toHaveBeenCalledWith('/gis/assets/1/location', { lat: 39.9, lng: 116.4 });
  });
  it('getLocationAssets should call /energy/locations/{id}/assets', async () => {
    mockedHttp.get.mockResolvedValueOnce([]);
    await gisService.getLocationAssets(1, { withEnergy: true });
    expect(mockedHttp.get).toHaveBeenCalledWith('/energy/locations/1/assets', { params: { withEnergy: true } });
  });
  it('getRanking should call /energy/ranking', async () => {
    mockedHttp.get.mockResolvedValueOnce([]);
    await gisService.getRanking({ scope: 'building', meterType: 'ELECTRICITY', limit: 10 });
    expect(mockedHttp.get).toHaveBeenCalledWith('/energy/ranking', { params: { scope: 'building', meterType: 'ELECTRICITY', limit: 10 } });
  });
});
