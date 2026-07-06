import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';

vi.mock('@/services/floorplanService', () => ({
  default: { create: vi.fn() },
}));
vi.mock('antd', () => ({ message: { success: vi.fn(), warning: vi.fn(), error: vi.fn() } }));

import floorplanService from '@/services/floorplanService';
import { FloorPlanCreateDialog } from '../components/FloorPlanCreateDialog';
const mockedCreate = vi.mocked(floorplanService.create);

describe('FloorPlanCreateDialog', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('should render nothing when closed', () => {
    const { container } = render(React.createElement(FloorPlanCreateDialog, {
      open: false, onOpenChange: vi.fn(), onCreated: vi.fn(),
    }));
    expect(container.innerHTML).toBe('');
  });

  it('should render dialog when open', () => {
    render(React.createElement(FloorPlanCreateDialog, {
      open: true, onOpenChange: vi.fn(), onCreated: vi.fn(),
    }));
    expect(screen.getByText('新建平面图')).toBeInTheDocument();
    expect(screen.getByText('创建')).toBeInTheDocument();
    expect(screen.getByText('取消')).toBeInTheDocument();
  });

  it('should not call onCreated when name is empty on submit', async () => {
    const onCreated = vi.fn();
    render(React.createElement(FloorPlanCreateDialog, {
      open: true, onOpenChange: vi.fn(), onCreated,
    }));
    await userEvent.click(screen.getByText('创建'));
    // 名称为空时不应调用 onCreated
    expect(onCreated).not.toHaveBeenCalled();
  });

  it('should call create service on valid submit', async () => {
    const onCreated = vi.fn();
    mockedCreate.mockResolvedValueOnce({ id: 1, name: '新平面图' } as any);
    render(React.createElement(FloorPlanCreateDialog, {
      open: true, onOpenChange: vi.fn(), onCreated,
    }));
    const nameInput = screen.getByPlaceholderText('平面图名称');
    await userEvent.type(nameInput, '新平面图');
    await userEvent.click(screen.getByText('创建'));
    await waitFor(() => {
      expect(mockedCreate).toHaveBeenCalled();
    });
    await waitFor(() => {
      expect(onCreated).toHaveBeenCalled();
    });
  });

  it('should call onOpenChange(false) when cancel clicked', async () => {
    const onOpenChange = vi.fn();
    render(React.createElement(FloorPlanCreateDialog, {
      open: true, onOpenChange, onCreated: vi.fn(),
    }));
    await userEvent.click(screen.getByText('取消'));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
