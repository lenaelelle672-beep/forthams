import type React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router';

const apiMocks = vi.hoisted(() => ({
  getInventoryTasks: vi.fn(),
  createInventoryTask: vi.fn(),
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));
vi.mock('recharts', () => ({
  BarChart: () => null,
  Bar: () => null,
  XAxis: () => null,
  YAxis: () => null,
  CartesianGrid: () => null,
  Tooltip: () => null,
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));
vi.mock('@/api/inventory', () => ({
  getInventoryTasks: apiMocks.getInventoryTasks,
  createInventoryTask: apiMocks.createInventoryTask,
}));
vi.mock('@/components/ui/Card', () => ({
  Card: ({ children }: { children: React.ReactNode }) => <section>{children}</section>,
}));
vi.mock('@/components/ui/Button', () => ({
  Button: ({
    children,
    onClick,
    disabled,
  }: {
    children: React.ReactNode;
    onClick?: () => void;
    disabled?: boolean;
  }) => (
    <button type="button" onClick={onClick} disabled={disabled}>{children}</button>
  ),
}));
vi.mock('@/components/ui/DataTable', () => ({
  DataTable: () => <div data-testid="inventory-table" />,
}));
vi.mock('@/components/ui/Dialog', () => ({
  Dialog: ({ children, open }: { children: React.ReactNode; open?: boolean }) => (open ? <div>{children}</div> : null),
  DialogContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogTitle: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogFooter: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));
vi.mock('@/components/ui/Input', () => ({
  Input: ({
    label,
    value,
    onChange,
    placeholder,
  }: {
    label?: string;
    value?: string;
    placeholder?: string;
    onChange?: React.ChangeEventHandler<HTMLInputElement>;
  }) => (
    <label>
      {label}
      <input value={value ?? ''} placeholder={placeholder} onChange={onChange} />
    </label>
  ),
}));
vi.mock('@/components/ui/Select', () => ({
  Select: ({
    label,
    value,
    onValueChange,
    children,
  }: {
    label?: string;
    value?: string;
    onValueChange?: (value: string) => void;
    children: React.ReactNode;
  }) => (
    <label>
      {label}
      <select value={value} onChange={(event) => onValueChange?.(event.target.value)}>{children}</select>
    </label>
  ),
  SelectItem: ({ value, children }: { value: string; children: React.ReactNode }) => (
    <option value={value}>{children}</option>
  ),
}));

import InventoryTasksPage from './InventoryTasksPage';

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <InventoryTasksPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('InventoryTasksPage create contract', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    apiMocks.getInventoryTasks.mockResolvedValue({ records: [], total: 0, size: 20, current: 1 });
  });

  it('submits inventoryType and deptIds and surfaces backend validation errors', async () => {
    apiMocks.createInventoryTask.mockRejectedValue(new Error('盘点部门范围必须是逗号分隔的正整数ID'));
    renderPage();

    await userEvent.click((await screen.findAllByRole('button', { name: 'inventory:taskList.createTaskBtn' }))[0]);
    await userEvent.type(screen.getByLabelText('inventory:dialog.taskName'), '一季度抽盘');
    await userEvent.selectOptions(screen.getByLabelText('inventory:dialog.inventoryType'), 'PARTIAL');
    await userEvent.type(screen.getByLabelText('inventory:dialog.deptIds'), '3,5');
    await userEvent.click(screen.getByRole('button', { name: 'inventory:dialog.confirm' }));

    await waitFor(() => {
      expect(apiMocks.createInventoryTask).toHaveBeenCalledWith({
        taskName: '一季度抽盘',
        inventoryType: 'PARTIAL',
        deptIds: '3,5',
      }, expect.anything());
    });
    expect(await screen.findByTestId('inventory-create-error')).toHaveTextContent('盘点部门范围必须是逗号分隔的正整数ID');
  });
});
