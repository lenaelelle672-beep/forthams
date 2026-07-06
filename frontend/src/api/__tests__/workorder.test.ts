import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/utils/http', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
}));

import http from '@/utils/http';
import {
  acceptWorkOrder,
  approveWorkOrder,
  cancelWorkOrder,
  createWorkOrder,
  deleteWorkOrder,
  getPendingApprovals,
  getWorkOrderDetail,
  getWorkOrderList,
  holdWorkOrder,
  rejectAcceptance,
  rejectWorkOrder,
  resumeWorkOrder,
  submitForAcceptance,
  submitWorkOrder,
  updateWorkOrder,
} from '@/api/workorder';

const mockedHttp = vi.mocked(http);

describe('api/workorder', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('uses unified workorder paths and relies on the shared http unwrapping contract', async () => {
    const params = { page: 1, pageSize: 10, status: 'DRAFT' as const };
    const payload = {
      title: '维修打印机',
      priority: 'HIGH' as const,
      assetId: 3,
      assigneeId: 7,
      plannedEndDate: '2026-06-10T23:59:00',
      collaborators: ['李四'],
    };

    mockedHttp.get.mockResolvedValue({});
    mockedHttp.post.mockResolvedValue({});
    mockedHttp.put.mockResolvedValue({});
    mockedHttp.delete.mockResolvedValue(undefined);

    await getWorkOrderList(params);
    await getWorkOrderDetail(12);
    await createWorkOrder(payload);
    await updateWorkOrder(12, { title: '维修打印机 A' });
    await deleteWorkOrder(12);
    await submitWorkOrder(12);
    await approveWorkOrder(12, { comment: '同意' });
    await rejectWorkOrder(12, { rejectionReason: '资料不完整' });
    await cancelWorkOrder(12, { reason: '重复提交' });
    await holdWorkOrder(12, { reason: '等待备件', holdEndTime: '2026-06-11T10:00:00' });
    await resumeWorkOrder(12, { note: '备件到位' });
    await submitForAcceptance(12, { comment: '请验收' });
    await acceptWorkOrder(12, { comment: '通过' });
    await rejectAcceptance(12, { comment: '返工' });
    await getPendingApprovals({ page: 2, pageSize: 20, keyword: '打印机' });

    expect(mockedHttp.get).toHaveBeenNthCalledWith(1, '/workorders', { params });
    expect(mockedHttp.get).toHaveBeenNthCalledWith(2, '/workorders/12');
    expect(mockedHttp.post).toHaveBeenNthCalledWith(1, '/workorders', payload);
    expect(mockedHttp.put).toHaveBeenCalledWith('/workorders/12', { title: '维修打印机 A' });
    expect(mockedHttp.delete).toHaveBeenCalledWith('/workorders/12');
    expect(mockedHttp.post).toHaveBeenNthCalledWith(2, '/workorders/12/submit');
    expect(mockedHttp.post).toHaveBeenNthCalledWith(3, '/workorders/12/approve', { comment: '同意' });
    expect(mockedHttp.post).toHaveBeenNthCalledWith(4, '/workorders/12/reject', { rejectionReason: '资料不完整' });
    expect(mockedHttp.post).toHaveBeenNthCalledWith(5, '/workorders/12/operate', {
      operation: 'cancel',
      reason: '重复提交',
    });
    expect(mockedHttp.post).toHaveBeenNthCalledWith(6, '/workorders/12/hold', {
      reason: '等待备件',
      holdEndTime: '2026-06-11T10:00:00',
    });
    expect(mockedHttp.post).toHaveBeenNthCalledWith(7, '/workorders/12/resume', { note: '备件到位' });
    expect(mockedHttp.post).toHaveBeenNthCalledWith(8, '/workorders/12/submit-acceptance', { comment: '请验收' });
    expect(mockedHttp.post).toHaveBeenNthCalledWith(9, '/workorders/12/accept', { comment: '通过' });
    expect(mockedHttp.post).toHaveBeenNthCalledWith(10, '/workorders/12/reject-acceptance', { comment: '返工' });
    expect(mockedHttp.get).toHaveBeenNthCalledWith(3, '/workorders', {
      params: {
        page: 2,
        pageSize: 20,
        keyword: '打印机',
        status: 'PENDING',
      },
    });
  });
});
