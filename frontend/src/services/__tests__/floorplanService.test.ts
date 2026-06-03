import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/utils/http', () => ({ default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() } }));

import http from '@/utils/http';
import floorplanService from '../floorplanService';
const mockedHttp = vi.mocked(http);

describe('floorplanService', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('list should call /floor-plans with defaults', async () => {
    mockedHttp.get.mockResolvedValueOnce({ records: [], total: 0 });
    await floorplanService.list();
    expect(mockedHttp.get).toHaveBeenCalledWith('/floor-plans', { params: { page: 1, pageSize: 20 } });
  });
  it('list should include keyword', async () => {
    mockedHttp.get.mockResolvedValueOnce({ records: [], total: 0 });
    await floorplanService.list({ page: 2, pageSize: 10, keyword: '厂房' });
    expect(mockedHttp.get).toHaveBeenCalledWith('/floor-plans', { params: { page: 2, pageSize: 10, keyword: '厂房' } });
  });
  it('getById should call /floor-plans/{id}', async () => {
    mockedHttp.get.mockResolvedValueOnce({ id: 1, name: '平面图A' });
    const r = await floorplanService.getById(1);
    expect(mockedHttp.get).toHaveBeenCalledWith('/floor-plans/1');
    expect(r.name).toBe('平面图A');
  });
  it('create should call POST /floor-plans', async () => {
    mockedHttp.post.mockResolvedValueOnce({ id: 1, name: '新平面图' });
    const r = await floorplanService.create({ name: '新平面图' });
    expect(mockedHttp.post).toHaveBeenCalledWith('/floor-plans', { name: '新平面图' });
    expect(r.id).toBe(1);
  });
  it('update should call PUT /floor-plans/{id}', async () => {
    mockedHttp.put.mockResolvedValueOnce({ id: 1, name: '更新' });
    const r = await floorplanService.update(1, { name: '更新' });
    expect(mockedHttp.put).toHaveBeenCalledWith('/floor-plans/1', { name: '更新' });
    expect(r.name).toBe('更新');
  });
  it('remove should call DELETE /floor-plans/{id}', async () => {
    mockedHttp.delete.mockResolvedValueOnce(undefined);
    await floorplanService.remove(1);
    expect(mockedHttp.delete).toHaveBeenCalledWith('/floor-plans/1');
  });
  it('getAssets should call /floor-plans/{planId}/assets', async () => {
    mockedHttp.get.mockResolvedValueOnce([]);
    await floorplanService.getAssets(1);
    expect(mockedHttp.get).toHaveBeenCalledWith('/floor-plans/1/assets');
  });
  it('addAsset should call POST /floor-plans/{planId}/assets', async () => {
    mockedHttp.post.mockResolvedValueOnce({ id: 1, planId: 1, assetId: 101 });
    const r = await floorplanService.addAsset(1, { assetId: 101, posX: 10.5, posY: 20.3, label: '标记' });
    expect(mockedHttp.post).toHaveBeenCalledWith('/floor-plans/1/assets', { assetId: 101, posX: 10.5, posY: 20.3, label: '标记' });
    expect(r.assetId).toBe(101);
  });
  it('removeAsset should call DELETE /floor-plans/{planId}/assets/{assetId}', async () => {
    mockedHttp.delete.mockResolvedValueOnce(undefined);
    await floorplanService.removeAsset(1, 101);
    expect(mockedHttp.delete).toHaveBeenCalledWith('/floor-plans/1/assets/101');
  });
});
