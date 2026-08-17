import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/utils/http', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
}));

import http from '@/utils/http';
import {
  approveTask,
  batchConfirmAssets,
  confirmAsset,
  createInventoryTask,
  getInventoryTasks,
  submitTask,
  toInventoryCreateBody,
  updateTaskStatus,
} from '@/api/inventory';

const mockedHttp = {
  get: vi.mocked(http.get),
  post: vi.mocked(http.post),
  put: vi.mocked(http.put),
  patch: vi.mocked(http.patch),
  delete: vi.mocked(http.delete),
};

describe('api/inventory', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('uses task-scoped confirm endpoints for inventory detail confirmation', async () => {
    mockedHttp.patch.mockResolvedValueOnce({ data: {} });
    mockedHttp.post.mockResolvedValueOnce(undefined);

    await confirmAsset(7, 11, { actualStatus: 'damaged', remark: '屏幕破损' });
    await batchConfirmAssets(7, { assetIds: [11, 12], actualStatus: 'normal', remark: '批量确认' });

    expect(mockedHttp.patch).toHaveBeenCalledWith('/inventory/tasks/7/assets/11/confirm', {
      actualStatus: 'damaged',
      remark: '屏幕破损',
    });
    expect(mockedHttp.post).toHaveBeenCalledWith('/inventory/tasks/7/assets/batch-confirm', {
      assetIds: [11, 12],
      actualStatus: 'normal',
      remark: '批量确认',
    });
  });

  it('submits and approves inventory tasks through approval workflow endpoints', async () => {
    mockedHttp.post.mockResolvedValue({ data: {} });

    await submitTask(7);
    await approveTask(7);

    expect(mockedHttp.post).toHaveBeenNthCalledWith(1, '/inventory/tasks/7/submit');
    expect(mockedHttp.post).toHaveBeenNthCalledWith(2, '/inventory/tasks/7/approve');
  });

  it('patches task status through the route supported by the backend alias', async () => {
    mockedHttp.patch.mockResolvedValueOnce({ data: { id: 7, status: 'COMPLETED' } });

    await updateTaskStatus(7, { status: 'COMPLETED' });

    expect(mockedHttp.patch).toHaveBeenCalledWith('/inventory/tasks/7/status', {
      status: 'COMPLETED',
    });
  });

  it('lists and creates inventory tasks against /inventory/tasks with inventoryType and deptIds', async () => {
    mockedHttp.get.mockResolvedValueOnce({ records: [], total: 0, size: 20, current: 1 });
    mockedHttp.post.mockResolvedValueOnce({ id: 9, taskName: '一季度抽盘' });

    await getInventoryTasks({ page: 1, pageSize: 20 });
    await createInventoryTask({
      taskName: '一季度抽盘',
      inventoryType: 'PARTIAL',
      deptIds: '3,5',
    });

    expect(mockedHttp.get).toHaveBeenCalledWith('/inventory/tasks', { params: { page: 1, pageSize: 20 } });
    expect(mockedHttp.post).toHaveBeenCalledWith('/inventory/tasks', {
      taskName: '一季度抽盘',
      inventoryType: 'PARTIAL',
      deptIds: '3,5',
    });
    expect(toInventoryCreateBody({
      taskName: '全盘',
      inventoryType: 'FULL',
    })).toEqual({
      taskName: '全盘',
      inventoryType: 'FULL',
    });
  });
});
