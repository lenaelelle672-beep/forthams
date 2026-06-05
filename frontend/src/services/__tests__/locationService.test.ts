import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/utils/http', () => ({ default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() } }));

import http from '@/utils/http';
import locationService from '../locationService';
const mockedHttp = vi.mocked(http);

describe('locationService', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('getList should call /locations/list', async () => {
    mockedHttp.get.mockResolvedValueOnce([]);
    await locationService.getList();
    expect(mockedHttp.get).toHaveBeenCalledWith('/locations/list');
  });
  it('getTree should call /locations/tree', async () => {
    mockedHttp.get.mockResolvedValueOnce([]);
    await locationService.getTree();
    expect(mockedHttp.get).toHaveBeenCalledWith('/locations/tree');
  });
  it('getCascade should call /locations/cascade', async () => {
    mockedHttp.get.mockResolvedValueOnce([]);
    await locationService.getCascade();
    expect(mockedHttp.get).toHaveBeenCalledWith('/locations/cascade');
  });
  it('getById should call /locations/{id}', async () => {
    mockedHttp.get.mockResolvedValueOnce({ id: 1, name: '位置1' });
    const r = await locationService.getById(1);
    expect(mockedHttp.get).toHaveBeenCalledWith('/locations/1');
    expect(r.name).toBe('位置1');
  });
  it('getChildren should call without type', async () => {
    mockedHttp.get.mockResolvedValueOnce([]);
    await locationService.getChildren(1);
    expect(mockedHttp.get).toHaveBeenCalledWith('/locations/1/children', { params: {} });
  });
  it('getChildren should include type param', async () => {
    mockedHttp.get.mockResolvedValueOnce([]);
    await locationService.getChildren(1, 'BUILDING');
    expect(mockedHttp.get).toHaveBeenCalledWith('/locations/1/children', { params: { type: 'BUILDING' } });
  });
  it('create should call POST /locations', async () => {
    mockedHttp.post.mockResolvedValueOnce({ id: 1, name: '新位置' });
    const r = await locationService.create({ name: '新位置' });
    expect(mockedHttp.post).toHaveBeenCalledWith('/locations', { name: '新位置' });
    expect(r.id).toBe(1);
  });
  it('update should call PUT /locations/{id}', async () => {
    mockedHttp.put.mockResolvedValueOnce({ id: 1, name: '更新' });
    const r = await locationService.update(1, { name: '更新' });
    expect(mockedHttp.put).toHaveBeenCalledWith('/locations/1', { name: '更新' });
    expect(r.name).toBe('更新');
  });
  it('remove should call DELETE /locations/{id}', async () => {
    mockedHttp.delete.mockResolvedValueOnce(undefined);
    await locationService.remove(1);
    expect(mockedHttp.delete).toHaveBeenCalledWith('/locations/1');
  });
});
