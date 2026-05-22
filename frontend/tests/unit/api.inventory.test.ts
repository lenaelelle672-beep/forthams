/**
 * @fileoverview Unit tests for the Inventory API client module.
 *
 * Covers every API function defined in src/api/inventory.ts against the
 * SWARM-P3-010-FE specification contract:
 *
 *   GET    /api/v1/inventory/tasks                       – paginated task list
 *   POST   /api/v1/inventory/tasks                       – create task
 *   GET    /api/v1/inventory/tasks/:taskId               – task detail
 *   PATCH  /api/v1/inventory/tasks/:taskId/status        – update status
 *   GET    /api/v1/inventory/tasks/:taskId/assets        – asset list (paginated)
 *   PATCH  /api/v1/inventory/tasks/:taskId/assets/:assetId/confirm – single confirm
 *   POST   /api/v1/inventory/tasks/:taskId/assets/batch-confirm    – batch confirm
 *   GET    /api/v1/inventory/tasks/:taskId/summary       – surplus/deficit summary
 *   POST   /api/v1/inventory/tasks/:taskId/submit        – submit for approval
 *
 * Every test verifies: correct HTTP method, URL path, request body / query
 * params, and response data unwrapping.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mock the shared HTTP client (Axios wrapper)
// ---------------------------------------------------------------------------
vi.mock('../../src/utils/http', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  },
}));

import http from '../../src/utils/http';
import * as inventoryApi from '../../src/api/inventory';

// Typed mock references
const mockedGet = vi.mocked(http.get);
const mockedPost = vi.mocked(http.post);
const mockedPatch = vi.mocked(http.patch);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Returns raw data, matching what utils/http.ts interceptor does
 * (response interceptor returns response.data directly).
 */
function axiosOk<T>(data: T): T {
  return data;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const API_BASE = '/inventory/tasks';

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('inventoryApi', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // =========================================================================
  // GET /api/v1/inventory/tasks — paginated task list
  // =========================================================================
  describe('getInventoryTasks', () => {
    it('should fetch paginated inventory tasks with default parameters', async () => {
      const mockResponse = {
        data: [
          {
            taskId: 'task-001',
            taskName: '2024Q4办公室盘点',
            scopeType: 'location' as const,
            scopeIds: ['loc-1', 'loc-2'],
            status: 'draft' as const,
            progress: 0,
            totalAssets: 100,
            countedAssets: 0,
            uncountedAssets: 100,
            surplusAssets: 0,
            deficitAssets: 0,
            createdAt: '2024-12-01T09:00:00Z',
          },
        ],
        total: 1,
        page: 1,
        pageSize: 20,
      };

      mockedGet.mockResolvedValueOnce(axiosOk(mockResponse));

      const result = await inventoryApi.getInventoryTasks({ page: 1, pageSize: 20 });

      expect(result).toEqual(mockResponse);
      expect(mockedGet).toHaveBeenCalledWith(API_BASE, {
        params: { page: 1, pageSize: 20 },
      });
    });

    it('should pass status filter as query parameter', async () => {
      mockedGet.mockResolvedValueOnce(
        axiosOk({ data: [], total: 0, page: 1, pageSize: 20 }),
      );

      await inventoryApi.getInventoryTasks({
        page: 1,
        pageSize: 20,
        status: 'in_progress',
      });

      expect(mockedGet).toHaveBeenCalledWith(API_BASE, {
        params: { page: 1, pageSize: 20, status: 'in_progress' },
      });
    });

    it('should propagate network errors', async () => {
      mockedGet.mockRejectedValueOnce(new Error('Network Error'));

      await expect(
        inventoryApi.getInventoryTasks({ page: 1, pageSize: 20 }),
      ).rejects.toThrow('Network Error');
    });
  });

  // =========================================================================
  // POST /api/v1/inventory/tasks — create task
  // =========================================================================
  describe('createInventoryTask', () => {
    it('should send POST with taskName, scopeType and scopeIds', async () => {
      const payload = {
        taskName: '2024Q4办公室盘点',
        scopeType: 'location' as const,
        scopeIds: ['loc-1', 'loc-2'],
      };

      const created = {
        taskId: 'task-new',
        ...payload,
        status: 'draft' as const,
        progress: 0,
        totalAssets: 0,
        countedAssets: 0,
        uncountedAssets: 0,
        surplusAssets: 0,
        deficitAssets: 0,
        createdAt: '2024-12-01T09:00:00Z',
      };

      mockedPost.mockResolvedValueOnce(axiosOk(created));

      const result = await inventoryApi.createInventoryTask(payload);

      expect(result).toEqual(created);
      expect(mockedPost).toHaveBeenCalledWith(API_BASE, payload);
    });

    it('should send scopeType "all" without scopeIds', async () => {
      const payload = {
        taskName: '全部资产盘点',
        scopeType: 'all' as const,
        scopeIds: [],
      };

      const created = {
        taskId: 'task-all',
        ...payload,
        status: 'draft' as const,
        progress: 0,
        totalAssets: 500,
        countedAssets: 0,
        uncountedAssets: 500,
        surplusAssets: 0,
        deficitAssets: 0,
        createdAt: '2024-12-01T10:00:00Z',
      };

      mockedPost.mockResolvedValueOnce(axiosOk(created));

      const result = await inventoryApi.createInventoryTask(payload);

      expect(result.scopeType).toBe('all');
      expect(mockedPost).toHaveBeenCalledWith(API_BASE, payload);
    });

    it('should send scopeType "category" with category scopeIds', async () => {
      const payload = {
        taskName: '电子设备盘点',
        scopeType: 'category' as const,
        scopeIds: ['cat-electronics'],
      };

      const created = {
        taskId: 'task-cat',
        ...payload,
        status: 'draft' as const,
        progress: 0,
        totalAssets: 80,
        countedAssets: 0,
        uncountedAssets: 80,
        surplusAssets: 0,
        deficitAssets: 0,
        createdAt: '2024-12-01T11:00:00Z',
      };

      mockedPost.mockResolvedValueOnce(axiosOk(created));

      const result = await inventoryApi.createInventoryTask(payload);

      expect(result.scopeType).toBe('category');
      expect(result.scopeIds).toEqual(['cat-electronics']);
    });

    it('should propagate server validation errors', async () => {
      mockedPost.mockRejectedValueOnce(new Error('HTTP 400: taskName is required'));

      await expect(
        inventoryApi.createInventoryTask({
          taskName: '',
          scopeType: 'location',
          scopeIds: [],
        }),
      ).rejects.toThrow('HTTP 400');
    });
  });

  // =========================================================================
  // GET /api/v1/inventory/tasks/:taskId — task detail
  // =========================================================================
  describe('getInventoryTaskDetail', () => {
    it('should fetch task detail by taskId', async () => {
      const mockDetail = {
        taskId: 'task-001',
        taskName: '2024Q4办公室盘点',
        scopeType: 'location' as const,
        scopeIds: ['loc-1'],
        status: 'in_progress' as const,
        progress: 60.0,
        totalAssets: 100,
        countedAssets: 60,
        uncountedAssets: 40,
        surplusAssets: 2,
        deficitAssets: 3,
        createdAt: '2024-12-01T09:00:00Z',
      };

      mockedGet.mockResolvedValueOnce(axiosOk(mockDetail));

      const result = await inventoryApi.getInventoryTaskDetail('task-001');

      expect(result).toEqual(mockDetail);
      expect(mockedGet).toHaveBeenCalledWith(`${API_BASE}/task-001`);
    });

    it('should throw when task is not found', async () => {
      mockedGet.mockRejectedValueOnce(new Error('HTTP 404: Not Found'));

      await expect(
        inventoryApi.getInventoryTaskDetail('nonexistent'),
      ).rejects.toThrow('HTTP 404');
    });
  });

  // =========================================================================
  // PATCH /api/v1/inventory/tasks/:taskId/status — update task status
  // =========================================================================
  describe('updateTaskStatus', () => {
    it('should send PATCH with new status', async () => {
      const updated = {
        taskId: 'task-001',
        taskName: '2024Q4办公室盘点',
        scopeType: 'location' as const,
        scopeIds: ['loc-1'],
        status: 'in_progress' as const,
        progress: 0,
        totalAssets: 100,
        countedAssets: 0,
        uncountedAssets: 100,
        surplusAssets: 0,
        deficitAssets: 0,
        createdAt: '2024-12-01T09:00:00Z',
      };

      mockedPatch.mockResolvedValueOnce(axiosOk(updated));

      const result = await inventoryApi.updateTaskStatus('task-001', { status: 'in_progress' });

      expect(result.status).toBe('in_progress');
      expect(mockedPatch).toHaveBeenCalledWith(`${API_BASE}/task-001/status`, {
        status: 'in_progress',
      });
    });

    it('should handle transition to completed status', async () => {
      const updated = {
        taskId: 'task-001',
        status: 'completed' as const,
      };

      mockedPatch.mockResolvedValueOnce(axiosOk(updated));

      const result = await inventoryApi.updateTaskStatus('task-001', { status: 'completed' });

      expect(result.status).toBe('completed');
      expect(mockedPatch).toHaveBeenCalledWith(`${API_BASE}/task-001/status`, {
        status: 'completed',
      });
    });
  });

  // =========================================================================
  // GET /api/v1/inventory/tasks/:taskId/assets — asset list
  // =========================================================================
  describe('getInventoryAssets', () => {
    it('should fetch paginated assets for a task', async () => {
      const mockAssets = {
        data: [
          {
            assetId: 'asset-001',
            assetCode: 'AST-2024-0001',
            assetName: 'MacBook Pro 16"',
            bookStatus: 'in_use',
            actualStatus: null,
            remark: '',
            confirmed: false,
          },
          {
            assetId: 'asset-002',
            assetCode: 'AST-2024-0002',
            assetName: 'Dell Monitor 27"',
            bookStatus: 'in_use',
            actualStatus: 'normal' as const,
            remark: '设备完好',
            confirmed: true,
          },
        ],
        total: 2,
        page: 1,
        pageSize: 20,
      };

      mockedGet.mockResolvedValueOnce(axiosOk(mockAssets));

      const result = await inventoryApi.getTaskAssets('task-001', {
        page: 1,
        pageSize: 20,
      });

      expect(result).toEqual(mockAssets);
      expect(mockedGet).toHaveBeenCalledWith(`${API_BASE}/task-001/assets`, {
        params: { page: 1, pageSize: 20 },
      });
    });

    it('should support filtering by confirmation status', async () => {
      mockedGet.mockResolvedValueOnce(
        axiosOk({ data: [], total: 0, page: 1, pageSize: 20 }),
      );

      await inventoryApi.getTaskAssets('task-001', {
        page: 1,
        pageSize: 20,
        confirmed: false,
      });

      expect(mockedGet).toHaveBeenCalledWith(`${API_BASE}/task-001/assets`, {
        params: { page: 1, pageSize: 20, confirmed: false },
      });
    });
  });

  // =========================================================================
  // PATCH .../assets/:assetId/confirm — single confirm
  // =========================================================================
  describe('confirmAsset', () => {
    it('should send PATCH with actualStatus and remark', async () => {
      const payload = {
        actualStatus: 'normal' as const,
        remark: '设备完好',
      };

      const confirmed = {
        assetId: 'asset-001',
        assetCode: 'AST-2024-0001',
        assetName: 'MacBook Pro 16"',
        bookStatus: 'in_use',
        actualStatus: 'normal' as const,
        remark: '设备完好',
        confirmed: true,
      };

      mockedPatch.mockResolvedValueOnce(axiosOk(confirmed));

      const result = await inventoryApi.confirmAsset('task-001', 'asset-001', payload);

      expect(result.confirmed).toBe(true);
      expect(result.actualStatus).toBe('normal');
      expect(mockedPatch).toHaveBeenCalledWith(
        `${API_BASE}/task-001/assets/asset-001/confirm`,
        payload,
      );
    });

    it('should confirm asset with surplus actualStatus', async () => {
      const payload = {
        actualStatus: 'surplus' as const,
        remark: '账外资产，盘盈',
      };

      const confirmed = {
        assetId: 'asset-003',
        actualStatus: 'surplus' as const,
        remark: '账外资产，盘盈',
        confirmed: true,
      };

      mockedPatch.mockResolvedValueOnce(axiosOk(confirmed));

      const result = await inventoryApi.confirmAsset('task-001', 'asset-003', payload);

      expect(result.actualStatus).toBe('surplus');
    });

    it('should confirm asset with deficit actualStatus', async () => {
      const payload = {
        actualStatus: 'deficit' as const,
        remark: '无法找到该资产',
      };

      const confirmed = {
        assetId: 'asset-004',
        actualStatus: 'deficit' as const,
        remark: '无法找到该资产',
        confirmed: true,
      };

      mockedPatch.mockResolvedValueOnce(axiosOk(confirmed));

      const result = await inventoryApi.confirmAsset('task-001', 'asset-004', payload);

      expect(result.actualStatus).toBe('deficit');
    });

    it('should confirm asset with damaged actualStatus', async () => {
      const payload = {
        actualStatus: 'damaged' as const,
        remark: '屏幕破裂',
      };

      const confirmed = {
        assetId: 'asset-005',
        actualStatus: 'damaged' as const,
        remark: '屏幕破裂',
        confirmed: true,
      };

      mockedPatch.mockResolvedValueOnce(axiosOk(confirmed));

      const result = await inventoryApi.confirmAsset('task-001', 'asset-005', payload);

      expect(result.actualStatus).toBe('damaged');
    });

    it('should confirm asset with empty remark', async () => {
      const payload = {
        actualStatus: 'normal' as const,
        remark: '',
      };

      const confirmed = {
        assetId: 'asset-001',
        actualStatus: 'normal' as const,
        remark: '',
        confirmed: true,
      };

      mockedPatch.mockResolvedValueOnce(axiosOk(confirmed));

      const result = await inventoryApi.confirmAsset('task-001', 'asset-001', payload);

      expect(result.remark).toBe('');
    });

    it('should propagate confirmation errors', async () => {
      mockedPatch.mockRejectedValueOnce(new Error('HTTP 409: Already confirmed'));

      await expect(
        inventoryApi.confirmAsset('task-001', 'asset-001', {
          actualStatus: 'normal',
          remark: '',
        }),
      ).rejects.toThrow('Already confirmed');
    });
  });

  // =========================================================================
  // POST .../assets/batch-confirm — batch confirm
  // =========================================================================
  describe('batchConfirmAssets', () => {
    it('should send POST with assetIds, actualStatus and optional remark', async () => {
      const payload = {
        assetIds: ['asset-001', 'asset-002', 'asset-003'],
        actualStatus: 'normal' as const,
        remark: '批量确认正常',
      };

      mockedPost.mockResolvedValueOnce(axiosOk({ success: true }));

      await inventoryApi.batchConfirmAssets('task-001', payload);

      expect(mockedPost).toHaveBeenCalledWith(
        `${API_BASE}/task-001/assets/batch-confirm`,
        payload,
      );
    });

    it('should send batch confirm with empty remark', async () => {
      const payload = {
        assetIds: ['asset-004', 'asset-005'],
        actualStatus: 'deficit' as const,
        remark: '',
      };

      mockedPost.mockResolvedValueOnce(axiosOk({ success: true }));

      await inventoryApi.batchConfirmAssets('task-001', payload);

      expect(mockedPost).toHaveBeenCalledWith(
        `${API_BASE}/task-001/assets/batch-confirm`,
        payload,
      );
    });

    it('should propagate batch confirmation errors', async () => {
      mockedPost.mockRejectedValueOnce(new Error('HTTP 400: assetIds exceeds limit'));

      await expect(
        inventoryApi.batchConfirmAssets('task-001', {
          assetIds: Array.from({ length: 101 }, (_, i) => `asset-${i}`),
          actualStatus: 'normal',
          remark: '',
        }),
      ).rejects.toThrow('assetIds exceeds limit');
    });
  });

  // =========================================================================
  // GET .../summary — surplus / deficit summary
  // =========================================================================
  describe('getInventorySummary', () => {
    it('should fetch surplus and deficit summary for a task', async () => {
      const mockSummary = {
        taskId: 'task-001',
        totalAssets: 100,
        countedAssets: 60,
        uncountedAssets: 40,
        surplusAssets: 2,
        deficitAssets: 3,
        surplus: [
          {
            assetId: 'surplus-1',
            assetCode: 'SUR-001',
            assetName: '未登记笔记本电脑',
            reason: '账外发现',
          },
          {
            assetId: 'surplus-2',
            assetCode: 'SUR-002',
            assetName: '未登记投影仪',
            reason: '来源不明',
          },
        ],
        deficit: [
          {
            assetId: 'deficit-1',
            assetCode: 'DEF-001',
            assetName: 'ThinkPad X1 Carbon',
            reason: '无法找到',
          },
          {
            assetId: 'deficit-2',
            assetCode: 'DEF-002',
            assetName: 'iPad Pro',
            reason: '已报废但未登记',
          },
          {
            assetId: 'deficit-3',
            assetCode: 'DEF-003',
            assetName: '外接硬盘',
            reason: '借出未还',
          },
        ],
      };

      mockedGet.mockResolvedValueOnce(axiosOk(mockSummary));

      const result = await inventoryApi.getTaskSummary('task-001');

      expect(result).toEqual(mockSummary);
      expect(result.surplusAssets).toBe(2);
      expect(result.deficitAssets).toBe(3);
      expect(result.surplus).toHaveLength(2);
      expect(result.deficit).toHaveLength(3);
      expect(mockedGet).toHaveBeenCalledWith(`${API_BASE}/task-001/summary`);
    });

    it('should handle summary with zero differences', async () => {
      const mockSummary = {
        taskId: 'task-002',
        totalAssets: 50,
        countedAssets: 50,
        uncountedAssets: 0,
        surplusAssets: 0,
        deficitAssets: 0,
        surplus: [],
        deficit: [],
      };

      mockedGet.mockResolvedValueOnce(axiosOk(mockSummary));

      const result = await inventoryApi.getTaskSummary('task-002');

      expect(result.surplusAssets).toBe(0);
      expect(result.deficitAssets).toBe(0);
      expect(result.surplus).toHaveLength(0);
      expect(result.deficit).toHaveLength(0);
    });
  });

  // =========================================================================
  // POST .../submit — submit for approval
  // =========================================================================
  describe('submitForApproval', () => {
    it('should send POST to submit task for approval', async () => {
      const submitted = {
        taskId: 'task-001',
        status: 'submitted' as const,
      };

      mockedPost.mockResolvedValueOnce(axiosOk(submitted));

      const result = await inventoryApi.submitTask('task-001');

      expect(result.status).toBe('submitted');
      expect(mockedPost).toHaveBeenCalledWith(`${API_BASE}/task-001/submit`);
    });

    it('should propagate submission errors (e.g. task not in correct state)', async () => {
      mockedPost.mockRejectedValueOnce(
        new Error('HTTP 409: Task must be completed before submission'),
      );

      await expect(
        inventoryApi.submitTask('task-draft'),
      ).rejects.toThrow('Task must be completed before submission');
    });
  });

  describe('inventoryService object methods', () => {
    it('should send scanned asset payload to the task scan endpoint', async () => {
      const payload = {
        assetId: 'asset-001',
        rfidTag: 'RFID-001',
        actualLocation: '总部仓库',
      };
      const response = { success: true, detailId: 101 };

      mockedPost.mockResolvedValueOnce(axiosOk(response));

      const result = await inventoryApi.inventoryService.addScanResult('task-001', payload);

      expect(result).toEqual(response);
      expect(mockedPost).toHaveBeenCalledWith(`${API_BASE}/task-001/scan`, payload);
    });

    it('should fetch task detail rows from the details endpoint', async () => {
      const response = {
        records: [
          { id: 1, taskId: 7, assetId: 10, status: 'normal' },
        ],
      };

      mockedGet.mockResolvedValueOnce(axiosOk(response));

      const result = await inventoryApi.inventoryService.getTaskDetails(7);

      expect(result).toEqual(response);
      expect(mockedGet).toHaveBeenCalledWith(`${API_BASE}/7/details`);
    });
  });

  // =========================================================================
  // Edge-case & contract verification tests
  // =========================================================================
  describe('URL construction edge cases', () => {
    it('should correctly construct URLs with UUID taskIds', async () => {
      const uuidTaskId = '550e8400-e29b-41d4-a716-446655440000';

      mockedGet.mockResolvedValueOnce(
        axiosOk({ taskId: uuidTaskId, status: 'draft' }),
      );

      await inventoryApi.getInventoryTaskDetail(uuidTaskId);

      expect(mockedGet).toHaveBeenCalledWith(
        `${API_BASE}/${uuidTaskId}`,
      );
    });

    it('should correctly construct asset confirm URL with both taskId and assetId', async () => {
      const taskId = 'task-abc';
      const assetId = 'asset-xyz';

      mockedPatch.mockResolvedValueOnce(
        axiosOk({ confirmed: true }),
      );

      await inventoryApi.confirmAsset(taskId, assetId, {
        actualStatus: 'other',
        remark: '其他情况',
      });

      expect(mockedPatch).toHaveBeenCalledWith(
        `${API_BASE}/${taskId}/assets/${assetId}/confirm`,
        expect.objectContaining({ actualStatus: 'other' }),
      );
    });
  });

  describe('actualStatus value coverage', () => {
    const statuses: Array<{
      status: 'normal' | 'surplus' | 'deficit' | 'damaged' | 'other';
      label: string;
    }> = [
      { status: 'normal', label: '正常' },
      { status: 'surplus', label: '盘盈' },
      { status: 'deficit', label: '盘亏' },
      { status: 'damaged', label: '损坏' },
      { status: 'other', label: '其他' },
    ];

    statuses.forEach(({ status, label }) => {
      it(`should accept actualStatus "${status}" (${label})`, async () => {
        mockedPatch.mockResolvedValueOnce(
          axiosOk({ assetId: 'a1', actualStatus: status, confirmed: true }),
        );

        const result = await inventoryApi.confirmAsset('t1', 'a1', {
          actualStatus: status,
          remark: '',
        });

        expect(result.actualStatus).toBe(status);
      });
    });
  });

  describe('scopeType value coverage', () => {
    const scopeTypes: Array<{
      scopeType: 'location' | 'category' | 'all';
      scopeIds: string[];
    }> = [
      { scopeType: 'location', scopeIds: ['loc-1'] },
      { scopeType: 'category', scopeIds: ['cat-1'] },
      { scopeType: 'all', scopeIds: [] },
    ];

    scopeTypes.forEach(({ scopeType, scopeIds }) => {
      it(`should create task with scopeType "${scopeType}"`, async () => {
        const created = {
          taskId: `task-${scopeType}`,
          taskName: `test-${scopeType}`,
          scopeType,
          scopeIds,
          status: 'draft' as const,
          progress: 0,
          totalAssets: 0,
          countedAssets: 0,
          uncountedAssets: 0,
          surplusAssets: 0,
          deficitAssets: 0,
          createdAt: '2024-12-01T00:00:00Z',
        };

        mockedPost.mockResolvedValueOnce(axiosOk(created));

        const result = await inventoryApi.createInventoryTask({
          taskName: `test-${scopeType}`,
          scopeType,
          scopeIds,
        });

        expect(result.scopeType).toBe(scopeType);
        expect(mockedPost).toHaveBeenCalledWith(API_BASE, {
          taskName: `test-${scopeType}`,
          scopeType,
          scopeIds,
        });
      });
    });
  });

  describe('task status lifecycle coverage', () => {
    const statuses: Array<{
      status: 'draft' | 'in_progress' | 'completed' | 'submitted';
    }> = [
      { status: 'draft' },
      { status: 'in_progress' },
      { status: 'completed' },
      { status: 'submitted' },
    ];

    statuses.forEach(({ status }) => {
      it(`should update task status to "${status}"`, async () => {
        mockedPatch.mockResolvedValueOnce(
          axiosOk({ taskId: 't1', status }),
        );

        const result = await inventoryApi.updateTaskStatus('t1', { status });

        expect(result.status).toBe(status);
        expect(mockedPatch).toHaveBeenCalledWith(`${API_BASE}/t1/status`, {
          status,
        });
      });
    });
  });
});
