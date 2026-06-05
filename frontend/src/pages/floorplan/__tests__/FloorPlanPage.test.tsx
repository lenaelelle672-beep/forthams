import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import React from 'react';

vi.mock('@/services/floorplanService', () => ({
  default: {
    list: vi.fn(),
    getAssets: vi.fn(),
    create: vi.fn(),
  },
}));

vi.mock('@/components/shared/SpatialTimeContext', () => ({
  useSpatialTime: () => ({ query: {}, setSpatialTime: vi.fn() }),
}));
vi.mock('@/components/shared/LocationCascader', () => ({
  LocationCascader: () => React.createElement('div', { 'data-testid': 'location-cascader' }),
}));
vi.mock('@/components/ui', () => ({
  PageTransition: ({ children }: { children: React.ReactNode }) => React.createElement('div', null, children),
  ErrorState: ({ title, description, onRetry }: any) =>
    React.createElement('div', { 'data-testid': 'error-state' },
      React.createElement('div', null, title),
      React.createElement('div', null, description),
      onRetry && React.createElement('button', { onClick: onRetry, 'data-testid': 'retry-btn' }, '重试'),
    ),
  EmptyState: ({ title }: any) => React.createElement('div', { 'data-testid': 'empty-state' }, title),
  SkeletonCard: ({ className }: any) => React.createElement('div', { className, 'data-testid': 'skeleton-card' }),
}));

vi.mock('../components/FloorPlanCanvas', () => ({
  FloorPlanCanvas: ({ plan, assets }: any) =>
    React.createElement('div', { 'data-testid': 'floorplan-canvas' },
      `画布: ${plan?.name}`,
    ),
}));

vi.mock('../components/FloorPlanCreateDialog', () => ({
  FloorPlanCreateDialog: ({ open, onOpenChange, onCreated }: any) =>
    open ? React.createElement('div', { 'data-testid': 'create-dialog' }, '新建对话框') : null,
}));

import floorplanService from '@/services/floorplanService';
import FloorPlanPage from '../FloorPlanPage';
const mockedService = vi.mocked(floorplanService);

function renderPage() {
  return render(React.createElement(MemoryRouter, null, React.createElement(FloorPlanPage)));
}

describe('FloorPlanPage', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('should render page header', () => {
    mockedService.list.mockResolvedValueOnce({ records: [], total: 0 });
    renderPage();
    expect(screen.getByText('2D/3D 平面图')).toBeInTheDocument();
  });

  it('should render plan list from API', async () => {
    mockedService.list.mockResolvedValueOnce({
      records: [
        { id: 1, name: 'A栋平面图', building: 'A栋', floor: '1F', imageUrl: '/plans/a.jpg' },
        { id: 2, name: 'B栋平面图', building: 'B栋', floor: '2F', imageUrl: '/plans/b.jpg' },
      ],
      total: 2,
    });
    renderPage();
    await waitFor(() => {
      expect(screen.getByText('A栋平面图')).toBeInTheDocument();
      expect(screen.getByText('B栋平面图')).toBeInTheDocument();
    });
  });

  it('should show empty state when no plans', async () => {
    mockedService.list.mockResolvedValueOnce({ records: [], total: 0 });
    renderPage();
    await waitFor(() => {
      expect(screen.getByTestId('empty-state')).toBeInTheDocument();
    });
  });

  it('should show error state on API failure', async () => {
    mockedService.list.mockRejectedValueOnce(new Error('网络错误'));
    renderPage();
    await waitFor(() => {
      expect(screen.getByTestId('error-state')).toBeInTheDocument();
      expect(screen.getByText('网络错误')).toBeInTheDocument();
    });
  });

  it('should retry after error', async () => {
    mockedService.list.mockRejectedValueOnce(new Error('网络错误'));
    mockedService.list.mockResolvedValueOnce({ records: [{ id: 1, name: '重试成功', building: 'A栋', floor: '1F', imageUrl: '/plans/a.jpg' }], total: 1 });
    renderPage();
    await waitFor(() => {
      expect(screen.getByTestId('retry-btn')).toBeInTheDocument();
    });
    await userEvent.click(screen.getByTestId('retry-btn'));
    await waitFor(() => {
      expect(screen.getByText('重试成功')).toBeInTheDocument();
    });
  });

  it('should select plan and load assets', async () => {
    mockedService.list.mockResolvedValueOnce({
      records: [{ id: 1, name: 'A栋平面图', building: 'A栋', floor: '1F', imageUrl: '/plans/a.jpg' }],
      total: 1,
    });
    mockedService.getAssets.mockResolvedValueOnce([
      { id: 1, planId: 1, assetId: 101, posX: 10, posY: 20, label: '空调A' },
    ]);
    renderPage();
    await waitFor(() => {
      expect(screen.getByText('A栋平面图')).toBeInTheDocument();
    });
    await userEvent.click(screen.getByText('A栋平面图'));
    await waitFor(() => {
      expect(screen.getByTestId('floorplan-canvas')).toBeInTheDocument();
    });
  });

  it('should open create dialog on new button click', async () => {
    mockedService.list.mockResolvedValueOnce({ records: [], total: 0 });
    renderPage();
    await waitFor(() => {
      expect(screen.queryByTestId('create-dialog')).not.toBeInTheDocument();
    });
    await userEvent.click(screen.getByText('新建'));
    await waitFor(() => {
      expect(screen.getByTestId('create-dialog')).toBeInTheDocument();
    });
  });

  it('should render LocationCascader', () => {
    mockedService.list.mockResolvedValueOnce({ records: [], total: 0 });
    renderPage();
    expect(screen.getByTestId('location-cascader')).toBeInTheDocument();
  });

  it('should show default placeholder when no plan selected', async () => {
    mockedService.list.mockResolvedValueOnce({ records: [], total: 0 });
    renderPage();
    await waitFor(() => {
      expect(screen.getByText('请从左侧选择一个平面图')).toBeInTheDocument();
    });
  });
});
