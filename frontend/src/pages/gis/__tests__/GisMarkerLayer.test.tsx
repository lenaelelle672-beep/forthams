import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import React from 'react';

const mockMarker = { bindPopup: vi.fn().mockReturnThis(), bindTooltip: vi.fn().mockReturnThis(), on: vi.fn() };
const mockMCG = { addLayers: vi.fn(), on: vi.fn() };

vi.mock('leaflet', () => ({
  default: { marker: () => ({ ...mockMarker }), divIcon: () => ({}), latLngBounds: () => ({ extend: vi.fn() }), point: () => ({}), markerClusterGroup: () => ({ ...mockMCG }) },
  marker: () => ({ ...mockMarker }), divIcon: () => ({}), latLngBounds: () => ({ extend: vi.fn() }), point: () => ({}), markerClusterGroup: () => ({ ...mockMCG }),
}));

vi.mock('react-leaflet', () => ({
  useMap: () => ({ addLayer: vi.fn(), removeLayer: vi.fn(), fitBounds: vi.fn() }),
  MapContainer: ({ children }: { children: React.ReactNode }) => React.createElement('div', null, children),
}));

vi.mock('leaflet.markercluster', () => ({}));

import { GisMarkerLayer } from '../components/GisMarkerLayer';
import type { GisAsset } from '@/services/gisService';

describe('GisMarkerLayer', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('should render nothing when assets is empty', () => {
    const { container } = render(React.createElement(GisMarkerLayer, { assets: [] }));
    expect(container.innerHTML).toBe('');
  });

  it('should create markers for each asset', () => {
    const assets: GisAsset[] = [
      { id: 1, assetNo: 'A-001', assetName: '资产1', status: 'IN_USE', locationLat: 39.9, locationLng: 116.4 },
      { id: 2, assetNo: 'A-002', assetName: '资产2', status: 'MAINTENANCE', locationLat: 40.0, locationLng: 116.5 },
    ];
    render(React.createElement(GisMarkerLayer, { assets }));
    expect(mockMarker.on).toHaveBeenCalled();
  });

  it('should register click handler', () => {
    const assets: GisAsset[] = [
      { id: 1, assetNo: 'A-001', assetName: '资产1', status: 'IN_USE', locationLat: 39.9, locationLng: 116.4 },
    ];
    render(React.createElement(GisMarkerLayer, { assets, onAssetSelect: vi.fn() }));
    expect(mockMarker.on).toHaveBeenCalledWith('click', expect.any(Function));
  });
});
