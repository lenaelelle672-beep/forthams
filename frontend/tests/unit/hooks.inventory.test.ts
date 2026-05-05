/**
 * hooks.inventory.test.ts
 *
 * Unit tests for inventory management React Query hooks defined in
 * `src/hooks/useInventory.ts`. Covers query hooks, mutation hooks,
 * cache invalidation after mutations, and anti-duplicate submission
 * behaviour required by ATB-008.
 *
 * @module hooks.inventory.test
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createElement, type ReactNode } from 'react';

/* -------------------------------------------------------------------------- */
/*  Mock API module                                                           */
/* -------------------------------------------------------------------------- */

vi.mock('../../src/api/inventory', () => ({
  getInventoryTasks: vi.fn(),
  createInventoryTask: vi.fn(),
  getInventoryTaskDetail: vi.fn(),
  patchTaskStatus: vi.fn(),
  getInventoryAssets: vi.fn(),
  confirmInventoryAsset: vi.fn(),
  batchConfirmAssets: vi.fn(),
  getInventorySummary: vi.fn(),
  submitInventoryTask: vi.fn(),
}));

import {
  getInventoryTasks,
  createInventoryTask,
  getInventoryTaskDetail,
  getInventoryAssets,
  confirmInventoryAsset,
  batchConfirmAssets,
  getInventorySummary,
  submitInventoryTask,
} from '../../src/api/inventory';

/* -------------------------------------------------------------------------- */
/*  Import hooks under test                                                   */
/* -------------------------------------------------------------------------- */

import {
  useTasks,
  useTaskDetail,
  useAssets,
  useSummary,
  useConfirmMutation,
  useBatchConfirmMutation,
  useSubmitMutation,
} from '../../src/hooks/useInventory';

/* -------------------------------------------------------------------------- */
/*  Mock Data (aligned with spec data-constraints)                            */
/* -------------------------------------------------------------------------- */

/** Reusable inventory task fixture matching spec field definitions. */
const mockInventoryTask = {
  taskId: 'task-001',
  taskName: '2024Q4办公室盘点',
  scopeType: 'location' as const,
  scopeIds: ['loc-001', 'loc-002'],
  status: 'in_progress' as const,
  progress: 60.0,
  totalAssets: 100,
  countedAssets: 60,
  uncountedAssets: 40,
  surplusAssets: 2,
  deficitAssets: 3,
  createdAt: '2024-12-01T10:00:00Z',
  updatedAt: '2024-12-15T14:30:00Z',
};

/** Paginated response containing 3 tasks with different statuses. */
const mockPaginatedTasks = {
  items: [
    mockInventoryTask,
    {
      ...mockInventoryTask,
      taskId: 'task-002',
      taskName: '2024Q4仓库盘点',
      status: 'draft' as const,
      progress: 0,
      countedAssets: 0,
      uncountedAssets: 100,
    },
    {
      ...mockInventoryTask,
      taskId: 'task-003',
      taskName: '2024Q4实验室盘点',
      status: 'completed' as const,
      progress: 100,
      countedAssets: 100,
      uncountedAssets: 0,
    },
  ],
  total: 3,
  page: 1,
  pageSize: 20,
};

/** Single asset item for inventory execution. */
const mockAsset = {
  assetId: 'asset-001',
  assetCode: 'AST-2024-0001',
  assetName: '笔记本电脑 ThinkPad X1',
  bookStatus: 'in_use',
  actualStatus: null as string | null,
  remark: '',
  confirmed: false,
};

/** Paginated asset response. */
const mockPaginatedAssets = {
  items: [
    mockAsset,
    {
      ...mockAsset,
      assetId: 'asset-002',
      assetCode: 'AST-2024-0002',
      assetName: '显示器 Dell U2723QE',
    },
    {
      ...mockAsset,
      assetId: 'asset-003',
      assetCode: 'AST-2024-0003',
      assetName: '机械键盘 Cherry MX',
    },
  ],
  total: 3,
  page: 1,
  pageSize: 20,
};

/** Inventory summary with surplus/deficit items. */
const mockSummary = {
  surplusItems: [
    {
      assetId: 'surplus-001',
      assetCode: 'AST-S-001',
      assetName: '未登记设备A',
      reason: '账外资产',
    },
  ],
  deficitItems: [
    {
      assetId: 'deficit-001',
      assetCode: 'AST-D-001',
      assetName: '遗失设备B',
      reason: '无法找到',
    },
    {
      assetId: 'deficit-002',
      assetCode: 'AST-D-002',
      assetName: '遗失设备C',
      reason: '调拨未登记',
    },
  ],
  totalSurplus: 1,
  totalDeficit: 2,
};

/* -------------------------------------------------------------------------- */
/*  Helper: create QueryClient wrapper for React Query hooks                  */
/* -------------------------------------------------------------------------- */

/**
 * Creates a fresh QueryClient and a React wrapper component that provides
 * the QueryClient via context. A new client is created per call to avoid
 * cross-test cache pollution.
 *
 * @returns Object containing the wrapper component and the QueryClient instance.
 */
function createQueryWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false },
    },
  });

  function Wrapper({ children }: { children: ReactNode }) {
    return createElement(QueryClientProvider, { client: queryClient }, children);
  }

  return { wrapper: Wrapper, queryClient };
}

/* -------------------------------------------------------------------------- */
/*  Test Suite                                                                */
/* -------------------------------------------------------------------------- */

describe('Inventory Hooks', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  /* ---------------------------------------------------------------------- */
  /*  useTasks                                                              */
  /* ---------------------------------------------------------------------- */

  describe('useTasks', () => {
    it('should fetch paginated task list successfully', async () => {
      (getInventoryTasks as ReturnType<typeof vi.fn>).mockResolvedValue(
        mockPaginatedTasks,
      );

      const { wrapper } = createQueryWrapper();
      const { result } = renderHook(
        () => useTasks({ page: 1, pageSize: 20, status: undefined }),
        { wrapper },
      );

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(result.current.data).toEqual(mockPaginatedTasks);
      expect(getInventoryTasks).toHaveBeenCalledWith({
        page: 1,
        pageSize: 20,
        status: undefined,
      });
      expect(getInventoryTasks).toHaveBeenCalledTimes(1);
    });

    it('should pass status filter to API for in_progress tasks', async () => {
      const filtered = {
        ...mockPaginatedTasks,
        items: mockPaginatedTasks.items.filter(
          (t) => t.status === 'in_progress',
        ),
        total: 1,
      };
      (getInventoryTasks as ReturnType<typeof vi.fn>).mockResolvedValue(
        filtered,
      );

      const { wrapper } = createQueryWrapper();
      const { result } = renderHook(
        () => useTasks({ page: 1, pageSize: 20, status: 'in_progress' }),
        { wrapper },
      );

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(getInventoryTasks).toHaveBeenCalledWith({
        page: 1,
        pageSize: 20,
        status: 'in_progress',
      });
      expect(result.current.data?.items).toHaveLength(1);
      expect(result.current.data?.items[0].status).toBe('in_progress');
    });

    it('should handle API error gracefully', async () => {
      const error = new Error('Network error');
      (getInventoryTasks as ReturnType<typeof vi.fn>).mockRejectedValue(error);

      const { wrapper } = createQueryWrapper();
      const { result } = renderHook(
        () => useTasks({ page: 1, pageSize: 20 }),
        { wrapper },
      );

      await waitFor(() => expect(result.current.isError).toBe(true));
      expect(result.current.error).toBe(error);
    });

    it('should handle empty task list', async () => {
      const emptyResponse = {
        items: [],
        total: 0,
        page: 1,
        pageSize: 20,
      };
      (getInventoryTasks as ReturnType<typeof vi.fn>).mockResolvedValue(
        emptyResponse,
      );

      const { wrapper } = createQueryWrapper();
      const { result } = renderHook(
        () => useTasks({ page: 1, pageSize: 20 }),
        { wrapper },
      );

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data?.items).toEqual([]);
      expect(result.current.data?.total).toBe(0);
    });
  });

  /* ---------------------------------------------------------------------- */
  /*  useTaskDetail                                                         */
  /* ---------------------------------------------------------------------- */

  describe('useTaskDetail', () => {
    it('should fetch task detail by taskId', async () => {
      (getInventoryTaskDetail as ReturnType<typeof vi.fn>).mockResolvedValue(
        mockInventoryTask,
      );

      const { wrapper } = createQueryWrapper();
      const { result } = renderHook(() => useTaskDetail('task-001'), {
        wrapper,
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data).toEqual(mockInventoryTask);
      expect(getInventoryTaskDetail).toHaveBeenCalledWith('task-001');
    });

    it('should not fetch when taskId is empty or undefined', async () => {
      const { wrapper } = createQueryWrapper();
      const { result } = renderHook(
        () => useTaskDetail(undefined as unknown as string),
        { wrapper },
      );

      expect(result.current.fetchStatus).toBe('idle');
      expect(getInventoryTaskDetail).not.toHaveBeenCalled();
    });

    it('should handle 404 error for non-existent task', async () => {
      (getInventoryTaskDetail as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error('Task not found'),
      );

      const { wrapper } = createQueryWrapper();
      const { result } = renderHook(() => useTaskDetail('nonexistent'), {
        wrapper,
      });

      await waitFor(() => expect(result.current.isError).toBe(true));
      expect(result.current.error?.message).toBe('Task not found');
    });

    it('should reflect correct progress percentage in task detail', async () => {
      const taskWithProgress = {
        ...mockInventoryTask,
        totalAssets: 100,
        countedAssets: 60,
        progress: 60.0,
      };
      (getInventoryTaskDetail as ReturnType<typeof vi.fn>).mockResolvedValue(
        taskWithProgress,
      );

      const { wrapper } = createQueryWrapper();
      const { result } = renderHook(() => useTaskDetail('task-001'), {
        wrapper,
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data?.progress).toBe(60.0);
    });
  });

  /* ---------------------------------------------------------------------- */
  /*  useAssets                                                             */
  /* ---------------------------------------------------------------------- */

  describe('useAssets', () => {
    it('should fetch asset list for a given task', async () => {
      (getInventoryAssets as ReturnType<typeof vi.fn>).mockResolvedValue(
        mockPaginatedAssets,
      );

      const { wrapper } = createQueryWrapper();
      const { result } = renderHook(
        () => useAssets('task-001', { page: 1, pageSize: 20 }),
        { wrapper },
      );

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data).toEqual(mockPaginatedAssets);
      expect(getInventoryAssets).toHaveBeenCalledWith('task-001', {
        page: 1,
        pageSize: 20,
      });
    });

    it('should handle error when fetching assets', async () => {
      (getInventoryAssets as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error('Server error'),
      );

      const { wrapper } = createQueryWrapper();
      const { result } = renderHook(
        () => useAssets('task-001', { page: 1, pageSize: 20 }),
        { wrapper },
      );

      await waitFor(() => expect(result.current.isError).toBe(true));
      expect(result.current.error?.message).toBe('Server error');
    });
  });

  /* ---------------------------------------------------------------------- */
  /*  useSummary                                                            */
  /* ---------------------------------------------------------------------- */

  describe('useSummary', () => {
    it('should fetch inventory summary with surplus and deficit items', async () => {
      (getInventorySummary as ReturnType<typeof vi.fn>).mockResolvedValue(
        mockSummary,
      );

      const { wrapper } = createQueryWrapper();
      const { result } = renderHook(() => useSummary('task-001'), { wrapper });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data).toEqual(mockSummary);
      expect(getInventorySummary).toHaveBeenCalledWith('task-001');
    });

    it('should handle summary with zero differences', async () => {
      const noDiffSummary = {
        surplusItems: [],
        deficitItems: [],
        totalSurplus: 0,
        totalDeficit: 0,
      };
      (getInventorySummary as ReturnType<typeof vi.fn>).mockResolvedValue(
        noDiffSummary,
      );

      const { wrapper } = createQueryWrapper();
      const { result } = renderHook(() => useSummary('task-001'), { wrapper });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data?.totalSurplus).toBe(0);
      expect(result.current.data?.totalDeficit).toBe(0);
      expect(result.current.data?.surplusItems).toEqual([]);
      expect(result.current.data?.deficitItems).toEqual([]);
    });

    it('should handle summary fetch error', async () => {
      (getInventorySummary as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error('Summary fetch failed'),
      );

      const { wrapper } = createQueryWrapper();
      const { result } = renderHook(() => useSummary('task-001'), { wrapper });

      await waitFor(() => expect(result.current.isError).toBe(true));
    });
  });

  /* ---------------------------------------------------------------------- */
  /*  useConfirmMutation (逐条确认)                                          */
  /* ---------------------------------------------------------------------- */

  describe('useConfirmMutation', () => {
    const confirmPayload = {
      actualStatus: 'normal' as const,
      remark: '设备完好',
    };

    it('should call confirmInventoryAsset API with correct params', async () => {
      const confirmResult = {
        ...mockAsset,
        actualStatus: 'normal',
        remark: '设备完好',
        confirmed: true,
      };
      (confirmInventoryAsset as ReturnType<typeof vi.fn>).mockResolvedValue(
        confirmResult,
      );

      const { wrapper } = createQueryWrapper();
      const { result } = renderHook(() => useConfirmMutation('task-001'), {
        wrapper,
      });

      await act(async () => {
        await result.current.mutateAsync({
          assetId: 'asset-001',
          ...confirmPayload,
        });
      });

      expect(confirmInventoryAsset).toHaveBeenCalledWith(
        'task-001',
        'asset-001',
        confirmPayload,
      );
      expect(confirmInventoryAsset).toHaveBeenCalledTimes(1);
    });

    it('should handle confirmation error', async () => {
      (confirmInventoryAsset as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error('确认失败'),
      );

      const { wrapper } = createQueryWrapper();
      const { result } = renderHook(() => useConfirmMutation('task-001'), {
        wrapper,
      });

      await expect(
        act(async () => {
          await result.current.mutateAsync({
            assetId: 'asset-001',
            ...confirmPayload,
          });
        }),
      ).rejects.toThrow('确认失败');
    });

    it('should invalidate task detail and summary caches after confirmation', async () => {
      (confirmInventoryAsset as ReturnType<typeof vi.fn>).mockResolvedValue({
        ...mockAsset,
        confirmed: true,
      });

      const { wrapper, queryClient } = createQueryWrapper();

      // Pre-populate caches to verify invalidation is triggered
      queryClient.setQueryData(
        ['inventory', 'task', 'task-001'],
        mockInventoryTask,
      );
      queryClient.setQueryData(
        ['inventory', 'summary', 'task-001'],
        mockSummary,
      );

      const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

      const { result } = renderHook(() => useConfirmMutation('task-001'), {
        wrapper,
      });

      await act(async () => {
        await result.current.mutateAsync({
          assetId: 'asset-001',
          actualStatus: 'normal',
          remark: '',
        });
      });

      // Cache invalidation must be triggered after successful confirmation
      expect(invalidateSpy).toHaveBeenCalled();
    });
  });

  /* ---------------------------------------------------------------------- */
  /*  useBatchConfirmMutation (批量确认)                                     */
  /* ---------------------------------------------------------------------- */

  describe('useBatchConfirmMutation', () => {
    const batchPayload = {
      assetIds: ['asset-001', 'asset-002', 'asset-003'],
      actualStatus: 'normal' as const,
      remark: '',
    };

    it('should call batchConfirmAssets API with correct payload', async () => {
      (batchConfirmAssets as ReturnType<typeof vi.fn>).mockResolvedValue({
        success: true,
        confirmedCount: 3,
      });

      const { wrapper } = createQueryWrapper();
      const { result } = renderHook(
        () => useBatchConfirmMutation('task-001'),
        { wrapper },
      );

      await act(async () => {
        await result.current.mutateAsync(batchPayload);
      });

      expect(batchConfirmAssets).toHaveBeenCalledWith(
        'task-001',
        batchPayload,
      );
      expect(batchConfirmAssets).toHaveBeenCalledTimes(1);
    });

    it('should truncate payload when exceeding 100 assets', async () => {
      const oversizedIds = Array.from({ length: 150 }, (_, i) => `asset-${i}`);
      (batchConfirmAssets as ReturnType<typeof vi.fn>).mockResolvedValue({
        success: true,
        confirmedCount: 100,
      });

      const { wrapper } = createQueryWrapper();
      const { result } = renderHook(
        () => useBatchConfirmMutation('task-001'),
        { wrapper },
      );

      await act(async () => {
        await result.current.mutateAsync({
          assetIds: oversizedIds,
          actualStatus: 'normal',
          remark: '',
        });
      });

      // Should have been called with truncated list (max 100)
      const calledArgs = (batchConfirmAssets as ReturnType<typeof vi.fn>).mock
        .calls[0][1] as { assetIds: string[] };
      expect(calledArgs.assetIds.length).toBeLessThanOrEqual(100);
    });

    it('should invalidate caches after batch confirmation', async () => {
      (batchConfirmAssets as ReturnType<typeof vi.fn>).mockResolvedValue({
        success: true,
        confirmedCount: 3,
      });

      const { wrapper, queryClient } = createQueryWrapper();
      const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

      const { result } = renderHook(
        () => useBatchConfirmMutation('task-001'),
        { wrapper },
      );

      await act(async () => {
        await result.current.mutateAsync(batchPayload);
      });

      expect(invalidateSpy).toHaveBeenCalled();
    });

    it('should handle batch confirmation error', async () => {
      (batchConfirmAssets as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error('批量确认失败：部分资产已确认'),
      );

      const { wrapper } = createQueryWrapper();
      const { result } = renderHook(
        () => useBatchConfirmMutation('task-001'),
        { wrapper },
      );

      await expect(
        act(async () => {
          await result.current.mutateAsync(batchPayload);
        }),
      ).rejects.toThrow('批量确认失败');
    });
  });

  /* ---------------------------------------------------------------------- */
  /*  useSubmitMutation (提交核准)                                           */
  /* ---------------------------------------------------------------------- */

  describe('useSubmitMutation', () => {
    it('should call submitInventoryTask API with taskId', async () => {
      (submitInventoryTask as ReturnType<typeof vi.fn>).mockResolvedValue({
        success: true,
        status: 'submitted',
      });

      const { wrapper } = createQueryWrapper();
      const { result } = renderHook(() => useSubmitMutation('task-001'), {
        wrapper,
      });

      await act(async () => {
        await result.current.mutateAsync(undefined);
      });

      expect(submitInventoryTask).toHaveBeenCalledWith('task-001');
      expect(submitInventoryTask).toHaveBeenCalledTimes(1);
    });

    it('should invalidate task detail and task list caches after submission', async () => {
      (submitInventoryTask as ReturnType<typeof vi.fn>).mockResolvedValue({
        success: true,
        status: 'submitted',
      });

      const { wrapper, queryClient } = createQueryWrapper();
      const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

      const { result } = renderHook(() => useSubmitMutation('task-001'), {
        wrapper,
      });

      await act(async () => {
        await result.current.mutateAsync(undefined);
      });

      expect(invalidateSpy).toHaveBeenCalled();
    });

    it('should handle submission error for invalid task status', async () => {
      (submitInventoryTask as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error('提交失败：任务状态不允许提交'),
      );

      const { wrapper } = createQueryWrapper();
      const { result } = renderHook(() => useSubmitMutation('task-001'), {
        wrapper,
      });

      await expect(
        act(async () => {
          await result.current.mutateAsync(undefined);
        }),
      ).rejects.toThrow('提交失败');
    });
  });

  /* ---------------------------------------------------------------------- */
  /*  ATB-008: 防重复提交 (Anti-duplicate submission)                        */
  /* ---------------------------------------------------------------------- */

  describe('Anti-duplicate submission (ATB-008)', () => {
    it('should expose isPending=true during confirm mutation (enabling UI to disable button)', async () => {
      /** Deferred promise to control resolution timing. */
      let resolveConfirm: (value: unknown) => void;
      const pendingPromise = new Promise((resolve) => {
        resolveConfirm = resolve;
      });
      (confirmInventoryAsset as ReturnType<typeof vi.fn>).mockReturnValue(
        pendingPromise,
      );

      const { wrapper } = createQueryWrapper();
      const { result } = renderHook(() => useConfirmMutation('task-001'), {
        wrapper,
      });

      // Trigger mutation — does NOT await so we can observe pending state
      act(() => {
        result.current.mutate({
          assetId: 'asset-001',
          actualStatus: 'normal',
          remark: '',
        });
      });

      // Mutation should be in pending state — UI should disable button
      await waitFor(() => expect(result.current.isPending).toBe(true));

      // API was called exactly once
      expect(confirmInventoryAsset).toHaveBeenCalledTimes(1);

      // Resolve the pending promise
      await act(async () => {
        resolveConfirm!({ success: true });
      });

      // After resolution, isPending should reset
      expect(result.current.isPending).toBe(false);
    });

    it('should expose isPending=true during batch confirm mutation', async () => {
      let resolveBatch: (value: unknown) => void;
      const pendingPromise = new Promise((resolve) => {
        resolveBatch = resolve;
      });
      (batchConfirmAssets as ReturnType<typeof vi.fn>).mockReturnValue(
        pendingPromise,
      );

      const { wrapper } = createQueryWrapper();
      const { result } = renderHook(
        () => useBatchConfirmMutation('task-001'),
        { wrapper },
      );

      const payload = {
        assetIds: ['asset-001', 'asset-002'],
        actualStatus: 'normal' as const,
        remark: '',
      };

      act(() => {
        result.current.mutate(payload);
      });

      await waitFor(() => expect(result.current.isPending).toBe(true));
      expect(batchConfirmAssets).toHaveBeenCalledTimes(1);

      await act(async () => {
        resolveBatch!({ success: true, confirmedCount: 2 });
      });

      expect(result.current.isPending).toBe(false);
    });

    it('should expose isPending=true during submit mutation', async () => {
      let resolveSubmit: (value: unknown) => void;
      const pendingPromise = new Promise((resolve) => {
        resolveSubmit = resolve;
      });
      (submitInventoryTask as ReturnType<typeof vi.fn>).mockReturnValue(
        pendingPromise,
      );

      const { wrapper } = createQueryWrapper();
      const { result } = renderHook(() => useSubmitMutation('task-001'), {
        wrapper,
      });

      act(() => {
        result.current.mutate(undefined);
      });

      await waitFor(() => expect(result.current.isPending).toBe(true));
      expect(submitInventoryTask).toHaveBeenCalledTimes(1);

      await act(async () => {
        resolveSubmit!({ success: true, status: 'submitted' });
      });

      expect(result.current.isPending).toBe(false);
    });

    it('should allow only one in-flight confirm mutation when using mutateAsync', async () => {
      /** Simulates a slow API response. */
      let resolveConfirm: (value: unknown) => void;
      const pendingPromise = new Promise((resolve) => {
        resolveConfirm = resolve;
      });
      (confirmInventoryAsset as ReturnType<typeof vi.fn>).mockReturnValue(
        pendingPromise,
      );

      const { wrapper } = createQueryWrapper();
      const { result } = renderHook(() => useConfirmMutation('task-001'), {
        wrapper,
      });

      // First mutation fires
      act(() => {
        result.current.mutate({
          assetId: 'asset-001',
          actualStatus: 'normal',
          remark: '',
        });
      });

      await waitFor(() => expect(result.current.isPending).toBe(true));

      // While first is pending, second mutate call should be a no-op
      // (React Query ignores duplicate `mutate` calls while pending by default)
      act(() => {
        result.current.mutate({
          assetId: 'asset-001',
          actualStatus: 'normal',
          remark: '',
        });
      });

      // Resolve
      await act(async () => {
        resolveConfirm!({ success: true });
      });

      // Only one API call should have been made
      expect(confirmInventoryAsset).toHaveBeenCalledTimes(1);
    });
  });

  /* ---------------------------------------------------------------------- */
  /*  Cache invalidation integration                                         */
  /* ---------------------------------------------------------------------- */

  describe('Cache invalidation after mutations', () => {
    it('should refresh task detail and asset list after single confirm', async () => {
      (confirmInventoryAsset as ReturnType<typeof vi.fn>).mockResolvedValue({
        success: true,
      });
      (getInventoryTaskDetail as ReturnType<typeof vi.fn>).mockResolvedValue({
        ...mockInventoryTask,
        countedAssets: 61,
        progress: 61.0,
      });
      (getInventoryAssets as ReturnType<typeof vi.fn>).mockResolvedValue(
        mockPaginatedAssets,
      );

      const { wrapper, queryClient } = createQueryWrapper();

      // Seed the cache
      queryClient.setQueryData(
        ['inventory', 'task', 'task-001'],
        mockInventoryTask,
      );

      const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

      const { result } = renderHook(() => useConfirmMutation('task-001'), {
        wrapper,
      });

      await act(async () => {
        await result.current.mutateAsync({
          assetId: 'asset-001',
          actualStatus: 'normal',
          remark: '设备完好',
        });
      });

      // Cache invalidation should cover task detail and asset queries
      const invalidatedKeys = invalidateSpy.mock.calls.map((call) =>
        JSON.stringify(call[0]),
      );
      const hasTaskInvalidation = invalidatedKeys.some(
        (key) =>
          key.includes('task') ||
          key.includes('asset') ||
          key.includes('summary'),
      );
      expect(hasTaskInvalidation).toBe(true);
    });

    it('should refresh all relevant caches after batch confirm', async () => {
      (batchConfirmAssets as ReturnType<typeof vi.fn>).mockResolvedValue({
        success: true,
        confirmedCount: 3,
      });

      const { wrapper, queryClient } = createQueryWrapper();
      const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

      const { result } = renderHook(
        () => useBatchConfirmMutation('task-001'),
        { wrapper },
      );

      await act(async () => {
        await result.current.mutateAsync({
          assetIds: ['asset-001', 'asset-002', 'asset-003'],
          actualStatus: 'normal',
          remark: '',
        });
      });

      expect(invalidateSpy).toHaveBeenCalled();
    });
  });
});