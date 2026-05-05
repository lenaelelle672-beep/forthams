import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import XxxComponent from './XxxComponent';
import * as xxxService from '@/app/services/xxxService';

vi.mock('@/app/services/xxxService');

describe('XxxComponent', () => {
  const mockData = {
    id: 1,
    name: 'Test Item',
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render component correctly', () => {
    render(<XxxComponent />);
    
    expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument();
  });

  it('should load data on mount', async () => {
    vi.mocked(xxxService.getList).mockResolvedValue({
      data: [mockData],
      total: 1,
    });

    render(<XxxComponent />);

    await waitFor(() => {
      expect(screen.getByText('Test Item')).toBeInTheDocument();
    });

    expect(xxxService.getList).toHaveBeenCalledTimes(1);
  });

  it('should handle search box input', async () => {
    const user = userEvent.setup();
    render(<XxxComponent />);

    const searchInput = screen.getByPlaceholderText(/搜索/i);
    await user.type(searchInput, 'test query');

    expect(searchInput).toHaveValue('test query');
  });

  it('should call API when clicking save button', async () => {
    const user = userEvent.setup();
    vi.mocked(xxxService.create).mockResolvedValue({ id: 2 });

    render(<XxxComponent />);

    const saveButton = screen.getByRole('button', { name: /保存/i });
    await user.click(saveButton);

    await waitFor(() => {
      expect(xxxService.create).toHaveBeenCalled();
    });
  });

  it('should call API when submitting form', async () => {
    const user = userEvent.setup();
    vi.mocked(xxxService.create).mockResolvedValue({ id: 2 });

    render(<XxxComponent />);

    const nameInput = screen.getByLabelText(/名称/i);
    await user.type(nameInput, 'New Item');

    const submitButton = screen.getByRole('button', { name: /提交/i });
    await user.click(submitButton);

    await waitFor(() => {
      expect(xxxService.create).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'New Item' })
      );
    });
  });

  it('should show error message when API fails', async () => {
    const user = userEvent.setup();
    vi.mocked(xxxService.create).mockRejectedValue(new Error('API Error'));

    render(<XxxComponent />);

    const saveButton = screen.getByRole('button', { name: /保存/i });
    await user.click(saveButton);

    await waitFor(() => {
      expect(screen.getByText(/错误/i)).toBeInTheDocument();
    });
  });

  it('should update list after successful deletion', async () => {
    const user = userEvent.setup();
    vi.mocked(xxxService.getList).mockResolvedValue({
      data: [mockData],
      total: 1,
    });
    vi.mocked(xxxService.deleteById).mockResolvedValue(undefined);

    render(<XxxComponent />);

    await waitFor(() => {
      expect(screen.getByText('Test Item')).toBeInTheDocument();
    });

    const deleteButton = screen.getByRole('button', { name: /删除/i });
    await user.click(deleteButton);

    await waitFor(() => {
      expect(xxxService.deleteById).toHaveBeenCalled();
      expect(xxxService.getList).toHaveBeenCalledTimes(2);
    });
  });
});
