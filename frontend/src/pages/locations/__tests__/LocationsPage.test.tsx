import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import React from 'react';
import { MemoryRouter } from 'react-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

vi.mock('@/api/base', () => ({
  getLocationTree: vi.fn().mockResolvedValue([]),
  createLocation: vi.fn(),
  updateLocation: vi.fn(),
  deleteLocation: vi.fn(),
}));

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import { getLocationTree, createLocation, deleteLocation } from '@/api/base';
const mockedGetTree = vi.mocked(getLocationTree);
const mockedCreate = vi.mocked(createLocation);
const mockedDelete = vi.mocked(deleteLocation);

import LocationsPage from '../LocationsPage';

function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false },
    },
  });
}

function renderPage() {
  const queryClient = createTestQueryClient();
  return render(
    React.createElement(QueryClientProvider, { client: queryClient },
      React.createElement(MemoryRouter, null, React.createElement(LocationsPage))
    )
  );
}

describe('LocationsPage', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('should show loading state initially', async () => {
    await act(async () => { renderPage(); });
    expect(screen.getByText('位置管理')).toBeInTheDocument();
  });

  it('should show empty state when no locations', async () => {
    mockedGetTree.mockResolvedValueOnce([]);
    await act(async () => { renderPage(); });
    await waitFor(() => expect(screen.getByText('暂无位置数据')).toBeInTheDocument());
  });

  it('should render tree nodes when locations exist', async () => {
    mockedGetTree.mockResolvedValueOnce([
      { id: 1, name: '北京市', locationCode: 'BJ', parentId: null, children: [
        { id: 2, name: '海淀区', locationCode: 'HD', parentId: 1, children: [] },
      ]},
    ]);
    await act(async () => { renderPage(); });
    await waitFor(() => {
      expect(screen.getByText('北京市')).toBeInTheDocument();
    });
  });

  it('should show create dialog when add button clicked', async () => {
    mockedGetTree.mockResolvedValueOnce([
      { id: 1, name: '北京市', locationCode: 'BJ', parentId: null, children: [] },
    ]);
    await act(async () => { renderPage(); });
    await waitFor(() => expect(screen.getByText('北京市')).toBeInTheDocument());
    await act(async () => {
      fireEvent.click(screen.getByText('新增顶级位置'));
    });
    expect(screen.getByText('新增位置')).toBeInTheDocument();
  });

  it('should handle create submission', async () => {
    mockedGetTree.mockResolvedValueOnce([]);
    mockedCreate.mockResolvedValueOnce({ id: 3, name: '新位置' } as any);
    await act(async () => { renderPage(); });
    await waitFor(() => expect(screen.getByText('暂无位置数据')).toBeInTheDocument());
    await act(async () => {
      fireEvent.click(screen.getAllByText('新增顶级位置')[0]);
    });
    await waitFor(() => expect(screen.getByText('新增位置')).toBeInTheDocument());
    const nameInput = screen.getByPlaceholderText('如 A栋3层');
    await act(async () => {
      fireEvent.change(nameInput, { target: { value: '新仓库' } });
      fireEvent.click(screen.getByText('确认新增'));
    });
    await waitFor(() => { expect(mockedCreate).toHaveBeenCalled(); });
  });
});
