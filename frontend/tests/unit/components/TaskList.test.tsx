/**
 * @fileoverview Unit tests for the TaskList component (P3-010-A).
 *
 * Covers ATB-001 acceptance criteria:
 * - Task list rendering with data, empty state, loading
 * - Each row displays: task name, scope label, status badge, creation time, progress
 * - Status filtering (draft / in_progress / completed / submitted)
 * - Pagination (20 items per page)
 * - Task selection via onTaskSelect callback
 * - Error handling with toast notification and retry
 * - Default sort order (creation time descending)
 */

import { describe, it, expect, vi, beforeEach, afterEach, type Mock } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { message } from 'antd';
import TaskList from '../../../src/components/inventory/TaskList';
import { fetchInventoryTasks } from '../../../src/api/inventory';

// ---------------------------------------------------------------------------
// Mock: inventory API module
// ---------------------------------------------------------------------------
vi.mock('../../../src/api/inventory', () => ({
  fetchInventoryTasks: vi.fn(),
}));

// ---------------------------------------------------------------------------
// Types (aligned with spec data constraints)
// ---------------------------------------------------------------------------

/** Inventory task fields used in the list view (see spec "数据约束") */
interface InventoryTask {
  taskId: string;
  taskName: string;
  scopeType: 'location' | 'category' | 'all';
  scopeIds: string[];
  status: 'draft' | 'in_progress' | 'completed' | 'submitted';
  progress: number;
  totalAssets: number;
  countedAssets: number;
  uncountedAssets: number;
  surplusAssets: number;
  deficitAssets: number;
  createdAt: string;
}

/** Paginated response wrapper expected from the API */
interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

// ---------------------------------------------------------------------------
// Mock data factories
// ---------------------------------------------------------------------------

/** Creates a single mock inventory task with sensible defaults. */
const createMockTask = (overrides: Partial<InventoryTask> = {}): InventoryTask => ({
  taskId: 'task-001',
  taskName: '2024Q4办公室盘点',
  scopeType: 'location',
  scopeIds: ['loc-001'],
  status: 'draft',
  progress: 0,
  totalAssets: 100,
  countedAssets: 0,
  uncountedAssets: 100,
  surplusAssets: 0,
  deficitAssets: 0,
  createdAt: '2024-12-01T10:00:00Z',
  ...overrides,
});

/** Three tasks with different statuses (ATB-001 Step 3). */
const threeMockTasks: InventoryTask[] = [
  createMockTask({
    taskId: 'task-001',
    taskName: '2024Q4办公室盘点',
    status: 'draft',
    scopeType: 'location',
    createdAt: '2024-12-01T10:00:00Z',
    progress: 0,
  }),
  createMockTask({
    taskId: 'task-002',
    taskName: 'IT设备抽盘',
    status: 'in_progress',
    scopeType: 'category',
    progress: 60.0,
    totalAssets: 100,
    countedAssets: 60,
    uncountedAssets: 40,
    createdAt: '2024-12-05T14:30:00Z',
  }),
  createMockTask({
    taskId: 'task-003',
    taskName: '仓库B季度盘点',
    status: 'completed',
    scopeType: 'all',
    progress: 100,
    totalAssets: 80,
    countedAssets: 80,
    uncountedAssets: 0,
    createdAt: '2024-11-15T09:00:00Z',
  }),
];

/** Generates N tasks for pagination testing (ATB-001 Step 5). */
const generateTasks = (count: number): InventoryTask[] =>
  Array.from({ length: count }, (_, i) =>
    createMockTask({
      taskId: `task-${String(i + 1).padStart(3, '0')}`,
      taskName: `盘点任务 ${i + 1}`,
      status: (['draft', 'in_progress', 'completed', 'submitted'] as const)[i % 4],
      createdAt: new Date(Date.now() - i * 86_400_000).toISOString(),
    }),
  );

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Typed reference to the mocked API function. */
const mockedFetchTasks = fetchInventoryTasks as Mock;

/** Creates a fresh QueryClient per test to avoid cache pollution. */
const createQueryClient = () =>
  new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

interface RenderOptions {
  onTaskSelect?: (taskId: string) => void;
  selectedTaskId?: string;
}

/** Renders the TaskList component wrapped in required providers. */
const renderTaskList = (options: RenderOptions = {}) => {
  const onTaskSelect = options.onTaskSelect ?? vi.fn();
  const queryClient = createQueryClient();

  const utils = render(
    <QueryClientProvider client={queryClient}>
      <TaskList onTaskSelect={onTaskSelect} selectedTaskId={options.selectedTaskId} />
    </QueryClientProvider>,
  );

  return { ...utils, onTaskSelect, queryClient };
};

// ---------------------------------------------------------------------------
// Test Suite
// ---------------------------------------------------------------------------

describe('TaskList (P3-010-A)', () => {
  let messageErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    messageErrorSpy = vi.spyOn(message, 'error').mockImplementation((() => {}) as any);

    mockedFetchTasks.mockResolvedValue({
      items: threeMockTasks,
      total: threeMockTasks.length,
      page: 1,
      pageSize: 20,
      totalPages: 1,
    });
  });

  afterEach(() => {
    messageErrorSpy.mockRestore();
  });

  // =========================================================================
  // ATB-001 Step 1 & Step 2: Basic Rendering & Empty State
  // =========================================================================

  it('renders the task list container as the left panel', async () => {
    renderTaskList();

    await waitFor(() => {
      expect(screen.getByTestId('task-list')).toBeInTheDocument();
    });
  });

  it('displays "暂无盘点任务" empty state placeholder when no tasks exist', async () => {
    mockedFetchTasks.mockResolvedValue({
      items: [],
      total: 0,
      page: 1,
      pageSize: 20,
      totalPages: 0,
    });

    renderTaskList();

    await waitFor(() => {
      expect(screen.getByText('暂无盘点任务')).toBeInTheDocument();
    });
  });

  it('shows a loading indicator while fetching data', () => {
    // Keep the promise pending so loading state persists
    mockedFetchTasks.mockReturnValue(new Promise(() => {}));

    renderTaskList();

    expect(screen.getByTestId('task-list-loading')).toBeInTheDocument();
  });

  // =========================================================================
  // ATB-001 Step 3: Task Row Content
  // =========================================================================

  it('renders the correct number of task rows matching the API response', async () => {
    renderTaskList();

    await waitFor(() => {
      expect(screen.getAllByTestId('task-list-item')).toHaveLength(3);
    });
  });

  it('displays task names in each row', async () => {
    renderTaskList();

    await waitFor(() => {
      expect(screen.getByText('2024Q4办公室盘点')).toBeInTheDocument();
      expect(screen.getByText('IT设备抽盘')).toBeInTheDocument();
      expect(screen.getByText('仓库B季度盘点')).toBeInTheDocument();
    });
  });

  it('displays status badges with correct Chinese labels per spec', async () => {
    renderTaskList();

    await waitFor(() => {
      expect(screen.getByText('草稿')).toBeInTheDocument(); // draft
      expect(screen.getByText('进行中')).toBeInTheDocument(); // in_progress
      expect(screen.getByText('已完成')).toBeInTheDocument(); // completed
    });
  });

  it('displays scope type labels in each row', async () => {
    renderTaskList();

    await waitFor(() => {
      expect(screen.getByText('按位置')).toBeInTheDocument(); // location
      expect(screen.getByText('按分类')).toBeInTheDocument(); // category
      expect(screen.getByText('全部资产')).toBeInTheDocument(); // all
    });
  });

  it('displays creation time formatted as YYYY-MM-DD HH:mm', async () => {
    renderTaskList();

    await waitFor(() => {
      expect(screen.getByText('2024-12-01 10:00')).toBeInTheDocument();
      expect(screen.getByText('2024-12-05 14:30')).toBeInTheDocument();
      expect(screen.getByText('2024-11-15 09:00')).toBeInTheDocument();
    });
  });

  it('displays progress percentage with one decimal place (e.g. 60.0%)', async () => {
    renderTaskList();

    await waitFor(() => {
      expect(screen.getByText('0.0%')).toBeInTheDocument();
      expect(screen.getByText('60.0%')).toBeInTheDocument();
      expect(screen.getByText('100.0%')).toBeInTheDocument();
    });
  });

  it('renders a progress bar element in each task row', async () => {
    renderTaskList();

    await waitFor(() => {
      const progressBars = screen.getAllByRole('progressbar');
      expect(progressBars).toHaveLength(3);
      // Ant Design Progress sets aria-valuenow to the percent value
      expect(progressBars[0]).toHaveAttribute('aria-valuenow', '0');
      expect(progressBars[1]).toHaveAttribute('aria-valuenow', '60');
      expect(progressBars[2]).toHaveAttribute('aria-valuenow', '100');
    });
  });

  // =========================================================================
  // ATB-001 Step 4: Status Filtering
  // =========================================================================

  it('filters tasks to show only "in_progress" when "进行中" is selected in the status dropdown', async () => {
    renderTaskList();

    await waitFor(() => {
      expect(screen.getByText('IT设备抽盘')).toBeInTheDocument();
    });

    // Open the status filter dropdown (Ant Design Select uses mouseDown)
    fireEvent.mouseDown(screen.getByLabelText('状态筛选'));

    // Select the "进行中" option from the dropdown portal
    const inProgressOption = await screen.findByText('进行中');
    fireEvent.click(inProgressOption);

    // Verify the API is called with the correct status filter
    await waitFor(() => {
      expect(mockedFetchTasks).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'in_progress' }),
      );
    });
  });

  // =========================================================================
  // ATB-001 Step 5: Pagination
  // =========================================================================

  it('requests page 1 with pageSize 20 by default', async () => {
    renderTaskList();

    await waitFor(() => {
      expect(mockedFetchTasks).toHaveBeenCalledWith(
        expect.objectContaining({ page: 1, pageSize: 20 }),
      );
    });
  });

  it('shows 20 items on the first page for 25 total tasks', async () => {
    const tasks = generateTasks(25);

    mockedFetchTasks.mockResolvedValue({
      items: tasks.slice(0, 20),
      total: 25,
      page: 1,
      pageSize: 20,
      totalPages: 2,
    });

    renderTaskList();

    await waitFor(() => {
      const rows = screen.getAllByTestId('task-list-item');
      expect(rows).toHaveLength(20);
    });

    // Pagination should display total of 2 pages
    expect(screen.getByRole('button', { name: '2' })).toBeInTheDocument();
  });

  it('navigates to page 2 when the pagination control is clicked', async () => {
    const tasks = generateTasks(25);

    // First page
    mockedFetchTasks.mockResolvedValueOnce({
      items: tasks.slice(0, 20),
      total: 25,
      page: 1,
      pageSize: 20,
      totalPages: 2,
    });

    renderTaskList();

    await waitFor(() => {
      expect(screen.getAllByTestId('task-list-item')).toHaveLength(20);
    });

    // Mock second page response
    mockedFetchTasks.mockResolvedValueOnce({
      items: tasks.slice(20, 25),
      total: 25,
      page: 2,
      pageSize: 20,
      totalPages: 2,
    });

    fireEvent.click(screen.getByRole('button', { name: '2' }));

    await waitFor(() => {
      expect(mockedFetchTasks).toHaveBeenLastCalledWith(
        expect.objectContaining({ page: 2 }),
      );
    });
  });

  // =========================================================================
  // Task Selection
  // =========================================================================

  it('calls onTaskSelect with the correct taskId when a task row is clicked', async () => {
    const onTaskSelect = vi.fn();
    renderTaskList({ onTaskSelect });

    await waitFor(() => {
      expect(screen.getByText('2024Q4办公室盘点')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('2024Q4办公室盘点'));

    expect(onTaskSelect).toHaveBeenCalledTimes(1);
    expect(onTaskSelect).toHaveBeenCalledWith('task-001');
  });

  it('visually highlights the row matching the selectedTaskId prop', async () => {
    renderTaskList({ selectedTaskId: 'task-002' });

    await waitFor(() => {
      const rows = screen.getAllByTestId('task-list-item');
      const selectedRow = rows.find(
        (row) => row.dataset.taskId === 'task-002',
      );
      expect(selectedRow).toBeDefined();
      expect(selectedRow!.className).toMatch(/selected|active/i);
    });
  });

  // =========================================================================
  // Error Handling
  // =========================================================================

  it('displays an error toast notification via antd message.error when the API request fails', async () => {
    mockedFetchTasks.mockRejectedValue(new Error('Network error'));

    renderTaskList();

    await waitFor(() => {
      expect(messageErrorSpy).toHaveBeenCalled();
    });
  });

  it('shows a retry button when data loading fails', async () => {
    mockedFetchTasks.mockRejectedValue(new Error('Network error'));

    renderTaskList();

    await waitFor(() => {
      expect(
        screen.getByRole('button', { name: /重试/i }),
      ).toBeInTheDocument();
    });
  });

  it('re-fetches data when the retry button is clicked', async () => {
    // First call fails
    mockedFetchTasks.mockRejectedValueOnce(new Error('Network error'));

    renderTaskList();

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /重试/i })).toBeInTheDocument();
    });

    // Second call succeeds
    mockedFetchTasks.mockResolvedValueOnce({
      items: threeMockTasks,
      total: 3,
      page: 1,
      pageSize: 20,
      totalPages: 1,
    });

    fireEvent.click(screen.getByRole('button', { name: /重试/i }));

    await waitFor(() => {
      expect(screen.getByText('2024Q4办公室盘点')).toBeInTheDocument();
    });

    expect(mockedFetchTasks).toHaveBeenCalledTimes(2);
  });

  // =========================================================================
  // Default Sort Order
  // =========================================================================

  it('requests tasks sorted by creation time in descending order by default', async () => {
    renderTaskList();

    await waitFor(() => {
      expect(mockedFetchTasks).toHaveBeenCalledWith(
        expect.objectContaining({
          sortBy: expect.stringContaining('created'),
          sortOrder: 'desc',
        }),
      );
    });
  });
});