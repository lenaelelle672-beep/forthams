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
import { approveTask, batchConfirmAssets, confirmAsset, submitTask, updateTaskStatus } from '@/api/inventory';

const mockedHttp = vi.mocked(http);

describe('api/inventory', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('uses task-scoped confirm endpoints for inventory detail confirmation', async () => {
    mockedHttp.patch.mockResolvedValueOnce({ data: {} });
    mockedHttp.post.mockResolvedValueOnce(undefined);

    await confirmAsset(7, 11, { actualStatus: 'damaged', remark: '屏幕破损' });
    await batchConfirmAssets(7, { assetIds: [11, 12], actualStatus: 'normal', remark: '批量确认' });

    expect(mockedHttp.patch).toHaveBeenCalledWith('/api/v1/inventory/tasks/7/assets/11/confirm', {
      actualStatus: 'damaged',
      remark: '屏幕破损',
    });
    expect(mockedHttp.post).toHaveBeenCalledWith('/api/v1/inventory/tasks/7/assets/batch-confirm', {
      assetIds: [11, 12],
      actualStatus: 'normal',
      remark: '批量确认',
    });
  });

  it('submits and approves inventory tasks through approval workflow endpoints', async () => {
    mockedHttp.post.mockResolvedValue({ data: {} });

    await submitTask(7);
    await approveTask(7);

    expect(mockedHttp.post).toHaveBeenNthCalledWith(1, '/api/v1/inventory/tasks/7/submit');
    expect(mockedHttp.post).toHaveBeenNthCalledWith(2, '/api/v1/inventory/tasks/7/approve');
  });

  it('patches task status through the route supported by the backend alias', async () => {
    mockedHttp.patch.mockResolvedValueOnce({ data: { id: 7, status: 'COMPLETED' } });

    await updateTaskStatus(7, { status: 'COMPLETED' });

    expect(mockedHttp.patch).toHaveBeenCalledWith('/api/v1/inventory/tasks/7/status', {
      status: 'COMPLETED',
    });
  });
});
