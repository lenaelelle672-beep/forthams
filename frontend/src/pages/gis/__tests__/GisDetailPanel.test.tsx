import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import GisDetailPanel from '../components/GisDetailPanel';
import type { GisAsset } from '@/services/gisService';

const mockAsset: GisAsset = {
  id: 1, assetNo: 'A-001', assetName: '测试资产', status: 'IN_USE',
  locationLat: 39.9042, locationLng: 116.4074,
};

describe('GisDetailPanel', () => {
  it('should render nothing when asset is null', () => {
    const { container } = render(<GisDetailPanel asset={null} />);
    expect(container.innerHTML).toBe('');
  });

  it('should render asset info when asset is provided', () => {
    render(<GisDetailPanel asset={mockAsset} />);
    expect(screen.getByText('测试资产')).toBeInTheDocument();
    expect(screen.getByText('A-001')).toBeInTheDocument();
  });

  it('should render onClose button when provided', () => {
    const onClose = vi.fn();
    render(<GisDetailPanel asset={mockAsset} onClose={onClose} />);
    fireEvent.click(screen.getByTitle('关闭详情'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('should not render onClose when not provided', () => {
    render(<GisDetailPanel asset={mockAsset} />);
    expect(screen.queryByTitle('关闭详情')).not.toBeInTheDocument();
  });

  it('should render onViewEnergy button when provided', () => {
    const onViewEnergy = vi.fn();
    render(<GisDetailPanel asset={mockAsset} onViewEnergy={onViewEnergy} />);
    fireEvent.click(screen.getByText('查看此资产能耗 →'));
    expect(onViewEnergy).toHaveBeenCalledWith(mockAsset);
  });

  it('should not render onViewEnergy when not provided', () => {
    render(<GisDetailPanel asset={mockAsset} />);
    expect(screen.queryByText('查看此资产能耗 →')).not.toBeInTheDocument();
  });

  it('should render status label for known status', () => {
    render(<GisDetailPanel asset={mockAsset} />);
    expect(screen.getByText('在用')).toBeInTheDocument();
  });

  it('should render asset ID in footer', () => {
    render(<GisDetailPanel asset={mockAsset} />);
    expect(screen.getByText('ID: 1')).toBeInTheDocument();
  });
});
