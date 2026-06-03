import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';

vi.mock('@/services/floorplanService', () => ({
  default: { addAsset: vi.fn() },
}));
vi.mock('antd', () => ({ message: { success: vi.fn(), warning: vi.fn(), error: vi.fn() } }));

import { FloorPlanCanvas } from '../components/FloorPlanCanvas';
import type { FloorPlan, PlanAsset } from '@/services/floorplanService';

const mockPlan: FloorPlan = { id: 1, name: 'A栋平面图', building: 'A栋', floor: '1F', imageUrl: '' };
const mockAssets: PlanAsset[] = [
  { id: 1, planId: 1, assetId: 101, posX: 50, posY: 30, label: '空调A', assetName: '空调主机A', assetStatus: 'IN_USE' },
  { id: 2, planId: 1, assetId: 102, posX: 70, posY: 60, label: '电表B', assetName: '电表B', assetStatus: 'MAINTENANCE' },
];

describe('FloorPlanCanvas', () => {
  it('should render SVG container', () => {
    const { container } = render(React.createElement(FloorPlanCanvas, { plan: mockPlan, assets: [], onAssetAdded: vi.fn() }));
    const svg = container.querySelector('svg');
    expect(svg).toBeInTheDocument();
  });

  it('should render asset markers on canvas', () => {
    render(React.createElement(FloorPlanCanvas, { plan: mockPlan, assets: mockAssets, onAssetAdded: vi.fn() }));
    expect(screen.getByText('空调主机A（IN_USE）')).toBeInTheDocument();
    expect(screen.getByText('电表B（MAINTENANCE）')).toBeInTheDocument();
  });

  it('should show asset label when assetName absent', () => {
    const assetsNoName: PlanAsset[] = [
      { id: 3, planId: 1, assetId: 103, posX: 10, posY: 20, label: '仅标记名', assetStatus: 'IDLE' },
    ];
    render(React.createElement(FloorPlanCanvas, { plan: mockPlan, assets: assetsNoName, onAssetAdded: vi.fn() }));
    expect(screen.getByText('仅标记名（IDLE）')).toBeInTheDocument();
  });

  it('should render empty canvas when no assets', () => {
    const { container } = render(React.createElement(FloorPlanCanvas, { plan: mockPlan, assets: [], onAssetAdded: vi.fn() }));
    const svg = container.querySelector('svg');
    expect(svg).toBeInTheDocument();
    expect(screen.queryByText(/（/)).not.toBeInTheDocument();
  });
});
