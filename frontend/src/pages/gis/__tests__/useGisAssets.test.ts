import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useGisAssets } from '../hooks/useGisAssets';

vi.mock('@/services/gisService', () => ({ default: { getAssets: vi.fn() } }));

import gisService from '@/services/gisService';
const mockedGisService = vi.mocked(gisService);

function createWrapper() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: queryClient }, children);
}

describe('useGisAssets', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('should fetch assets with default empty params', async () => {
    mockedGisService.getAssets.mockResolvedValueOnce([{ id: 1, assetNo: 'A-001', assetName: '资产1', status: 'IN_USE', locationLat: 39.9, locationLng: 116.4 }]);
    const { result } = renderHook(() => useGisAssets(), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockedGisService.getAssets).toHaveBeenCalledWith({});
    expect(result.current.data).toHaveLength(1);
  });

  it('should pass params to getAssets', async () => {
    mockedGisService.getAssets.mockResolvedValueOnce([]);
    renderHook(() => useGisAssets({ status: 'IN_USE', categoryId: 1, locationId: 2 }), { wrapper: createWrapper() });
    await waitFor(() => expect(mockedGisService.getAssets).toHaveBeenCalledWith({ status: 'IN_USE', categoryId: 1, locationId: 2 }));
  });

  it('should handle error state', async () => {
    mockedGisService.getAssets.mockRejectedValueOnce(new Error('Network error'));
    const { result } = renderHook(() => useGisAssets(), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error!.message).toBe('Network error');
  });
});
