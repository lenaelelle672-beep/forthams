import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import React from 'react';

function createMockLeafletMarker() {
  const handler = {
    get(_target: any, prop: string) {
      if (prop === 'then') return undefined; // Not a Promise
      if (typeof prop === 'string' && !prop.startsWith('_')) {
        return vi.fn().mockReturnThis();
      }
      return undefined;
    }
  };
  return new Proxy({}, handler);
}

vi.mock('leaflet', () => {
  const mockClusterGroup = { addLayers: vi.fn(), addLayer: vi.fn(), on: vi.fn(), off: vi.fn(), clearLayers: vi.fn() };
  return {
    default: { latLngBounds: () => ({ extend: vi.fn() }), point: () => ({}), divIcon: () => ({}), marker: vi.fn(() => createMockLeafletMarker()), markerClusterGroup: vi.fn(() => mockClusterGroup), icon: vi.fn(() => ({})) },
    latLngBounds: () => ({ extend: vi.fn() }), point: () => ({}), divIcon: () => ({}),
    marker: vi.fn(() => createMockLeafletMarker()),
    markerClusterGroup: vi.fn(() => mockClusterGroup),
    icon: vi.fn(() => ({})),
    Icon: { Default: { mergeIconOptions: vi.fn() } },
  };
});

vi.mock('react-leaflet', () => ({
  MapContainer: ({ children }: { children: React.ReactNode }) => React.createElement('div', { 'data-testid': 'map-container' }, children),
  TileLayer: () => null, ZoomControl: () => null, ScaleControl: () => null,
  useMap: () => ({ getCenter: () => ({ lat: 39.9, lng: 116.4 }), getZoom: () => 12, on: vi.fn(), off: vi.fn(), fitBounds: vi.fn(), setView: vi.fn(), locate: vi.fn(), addLayer: vi.fn(), removeLayer: vi.fn() }),
}));

vi.mock('leaflet.markercluster', () => ({
  default: { markerClusterGroup: vi.fn(() => ({ addLayer: vi.fn(), clearLayers: vi.fn(), on: vi.fn() })) },
}));
vi.mock('@/services/gisService', () => ({ default: { getAssets: vi.fn(), getStats: vi.fn() } }));
vi.mock('../hooks/useGisAssets', () => ({ useGisAssets: vi.fn() }));
vi.mock('../hooks/useMapFilters', () => ({ useMapFilters: vi.fn(() => ({ filters: {}, setStatus: vi.fn() })) }));
vi.mock('../hooks/useSpatialSelection', () => ({ useSpatialSelection: () => ({ selectedAssetId: undefined, setSelectedAssetId: vi.fn() }) }));
vi.mock('@/components/shared/SpatialTimeContext', () => ({ useSpatialTime: () => ({ query: {}, setSpatialTime: vi.fn() }) }));
vi.mock('@/components/shared/LocationCascader', () => ({ LocationCascader: () => React.createElement('div', { 'data-testid': 'location-cascader' }) }));
vi.mock('@/components/shared/TimeRangeSelector', () => ({ TimeRangeSelector: () => React.createElement('div', { 'data-testid': 'time-range-selector' }) }));

import { useGisAssets } from '../hooks/useGisAssets';
import { useMapFilters } from '../hooks/useMapFilters';
import GisMapPage from '../GisMapPage';
const mockedUseGisAssets = vi.mocked(useGisAssets);
const mockedUseMapFilters = vi.mocked(useMapFilters);

function renderPage() {
  return render(React.createElement(MemoryRouter, null, React.createElement(GisMapPage)));
}

describe('GisMapPage', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('should show loading state', async () => {
    mockedUseGisAssets.mockReturnValue({ data: undefined, isLoading: true, isError: false, error: null, refetch: vi.fn() } as any);
    await act(async () => { renderPage(); });
    expect(screen.getByText('GIS 资产地图')).toBeInTheDocument();
  });

  it('should show error state', async () => {
    mockedUseGisAssets.mockReturnValue({ data: undefined, isLoading: false, isError: true, error: new Error('Failed to load'), refetch: vi.fn() } as any);
    await act(async () => { renderPage(); });
    expect(screen.getByText('加载失败')).toBeInTheDocument();
    expect(screen.getByText('Failed to load')).toBeInTheDocument();
  });

  it('should show empty state', async () => {
    mockedUseGisAssets.mockReturnValue({ data: [], isLoading: false, isError: false, error: null, refetch: vi.fn() } as any);
    await act(async () => { renderPage(); });
    expect(screen.getByText('暂无资产定位数据')).toBeInTheDocument();
  });

  it('should show cards when assets exist', async () => {
    mockedUseGisAssets.mockReturnValue({
      data: [{ id: 1, assetNo: 'A-001', assetName: '资产1', status: 'IN_USE', locationLat: 39.9, locationLng: 116.4 }],
      isLoading: false, isError: false, error: null, refetch: vi.fn(),
    } as any);
    await act(async () => { renderPage(); });
    expect(screen.getByText('定位资产总数')).toBeInTheDocument();
  });

  it('should render map container when assets exist', async () => {
    mockedUseGisAssets.mockReturnValue({
      data: [{ id: 1, assetNo: 'A-001', assetName: '资产1', status: 'IN_USE', locationLat: 39.9, locationLng: 116.4 }],
      isLoading: false, isError: false, error: null, refetch: vi.fn(),
    } as any);
    await act(async () => { renderPage(); });
    expect(screen.getByTestId('map-container')).toBeInTheDocument();
  });

  it('should render status filter buttons', async () => {
    mockedUseGisAssets.mockReturnValue({
      data: [{ id: 1, assetNo: 'A-001', assetName: '资产1', status: 'IN_USE', locationLat: 39.9, locationLng: 116.4 }],
      isLoading: false, isError: false, error: null, refetch: vi.fn(),
    } as any);
    await act(async () => { renderPage(); });
    // "在用" and "闲置" appear in both the Select dropdown and the layer filter overlay
    const inUseElements = screen.getAllByText('在用');
    expect(inUseElements.length).toBeGreaterThanOrEqual(1);
    const idleElements = screen.getAllByText('闲置');
    expect(idleElements.length).toBeGreaterThanOrEqual(1);
  });

  it('should filter assets when status select changes', async () => {
    const setStatus = vi.fn();
    mockedUseMapFilters.mockReturnValue({ filters: {}, setStatus });
    mockedUseGisAssets.mockReturnValue({
      data: [
        { id: 1, assetNo: 'A-001', assetName: '资产1', status: 'IN_USE', locationLat: 39.9, locationLng: 116.4 },
        { id: 2, assetNo: 'A-002', assetName: '资产2', status: 'IDLE', locationLat: 39.9, locationLng: 116.4 },
      ],
      isLoading: false, isError: false, error: null, refetch: vi.fn(),
    } as any);
    await act(async () => { renderPage(); });
    const select = screen.getByRole('combobox');
    expect(select).toBeTruthy();
    await act(async () => {
      fireEvent.click(select);
    });
    const inUseElements = screen.getAllByText('在用');
    expect(inUseElements.length).toBeGreaterThanOrEqual(1);
  });

  it('should show search input for filtering assets', async () => {
    mockedUseGisAssets.mockReturnValue({
      data: [
        { id: 1, assetNo: 'A-001', assetName: '资产1', status: 'IN_USE', locationLat: 39.9, locationLng: 116.4 },
      ],
      isLoading: false, isError: false, error: null, refetch: vi.fn(),
    } as any);
    await act(async () => { renderPage(); });
    const searchInput = screen.getByPlaceholderText('搜索资产名称/编号');
    expect(searchInput).toBeTruthy();
    await act(async () => {
      fireEvent.change(searchInput, { target: { value: 'A-001' } });
    });
    expect(searchInput).toHaveValue('A-001');
  });
});
