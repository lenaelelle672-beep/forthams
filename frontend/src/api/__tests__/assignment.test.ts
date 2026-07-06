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
  approveAssignment,
  approveReturnAssignment,
  cancelAssignment,
  checkoutAssignment,
  createAssignment,
  deleteAssignment,
  getAssignment,
  getAssignments,
  rejectAssignment,
  returnRequestAssignment,
  submitAssignment,
  updateAssignment,
} from '@/api/assignment';

const mockedHttp = vi.mocked(http);

describe('api/assignment', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('uses unified assignment paths and relies on the shared http unwrapping contract', async () => {
    const params = { page: 1, pageSize: 10, status: 'DRAFT' };
    const payload = { assetId: 3, assignedToUserId: 9, allocationType: 'ASSIGNMENT' };
    const patch = { assignedToDeptId: 2, remark: '更新备注' };

    mockedHttp.get.mockResolvedValue({});
    mockedHttp.post.mockResolvedValue({});
    mockedHttp.put.mockResolvedValue({});
    mockedHttp.delete.mockResolvedValue(undefined);

    await getAssignments(params);
    await getAssignment(12);
    await createAssignment(payload);
    await updateAssignment(12, patch);
    await deleteAssignment(12);
    await submitAssignment(12);
    await approveAssignment(12);
    await rejectAssignment(12, '资料不完整');
    await checkoutAssignment(12);
    await returnRequestAssignment(12);
    await approveReturnAssignment(12, 'GOOD');
    await cancelAssignment(12);

    expect(mockedHttp.get).toHaveBeenNthCalledWith(1, '/assignments', { params });
    expect(mockedHttp.get).toHaveBeenNthCalledWith(2, '/assignments/12');
    expect(mockedHttp.post).toHaveBeenNthCalledWith(1, '/assignments', payload);
    expect(mockedHttp.put).toHaveBeenCalledWith('/assignments/12', patch);
    expect(mockedHttp.delete).toHaveBeenCalledWith('/assignments/12');
    expect(mockedHttp.post).toHaveBeenNthCalledWith(2, '/assignments/12/submit');
    expect(mockedHttp.post).toHaveBeenNthCalledWith(3, '/assignments/12/approve');
    expect(mockedHttp.post).toHaveBeenNthCalledWith(4, '/assignments/12/reject', null, { params: { reason: '资料不完整' } });
    expect(mockedHttp.post).toHaveBeenNthCalledWith(5, '/assignments/12/checkout');
    expect(mockedHttp.post).toHaveBeenNthCalledWith(6, '/assignments/12/return-request');
    expect(mockedHttp.post).toHaveBeenNthCalledWith(7, '/assignments/12/approve-return', null, { params: { returnCondition: 'GOOD' } });
    expect(mockedHttp.post).toHaveBeenNthCalledWith(8, '/assignments/12/cancel');
  });
});
