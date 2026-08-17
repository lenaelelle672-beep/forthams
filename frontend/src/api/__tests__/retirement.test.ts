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
  approveRetirement,
  createRetirement,
  getAssetRetirementHistory,
  getRetirementDetail,
  getRetirementList,
  rejectRetirement,
  withdrawRetirement,
} from '@/api/retirement';

const mockedHttp = {
  get: vi.mocked(http.get),
  post: vi.mocked(http.post),
  put: vi.mocked(http.put),
  delete: vi.mocked(http.delete),
};

describe('api/retirement', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('uses backend retirement paths and direct unwrapped return types', async () => {
    const params = { page: 1, pageSize: 20, status: 'PENDING' as const };
    const payload = { assetId: 8, reason: '设备老化', residualValue: 200, notes: '批量退役' };

    mockedHttp.get
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({ records: [{ id: 77, processType: 'RETIREMENT', businessId: 12, status: 'PENDING' }] })
      .mockResolvedValueOnce({ records: [{ id: 77, processType: 'RETIREMENT', businessId: 12, status: 'PENDING' }] });
    mockedHttp.post.mockResolvedValue({});

    await createRetirement(payload);
    await getRetirementList(params);
    await getRetirementDetail(12);
    await getAssetRetirementHistory(8);
    await withdrawRetirement(12);
    await approveRetirement(12);
    await rejectRetirement(12, '资料不完整');

    expect(mockedHttp.post).toHaveBeenNthCalledWith(1, '/retirement/apply', {
      assetId: 8,
      reason: '设备老化',
      estimatedResidualValue: 200,
      remark: '批量退役',
      attachments: undefined,
    });
    expect(mockedHttp.get).toHaveBeenNthCalledWith(1, '/retirement/list', { params });
    expect(mockedHttp.get).toHaveBeenNthCalledWith(2, '/retirement/12');
    expect(mockedHttp.get).toHaveBeenNthCalledWith(3, '/retirement/asset/8');
    expect(mockedHttp.post).toHaveBeenNthCalledWith(2, '/retirement/12/cancel');
    expect(mockedHttp.post).toHaveBeenNthCalledWith(3, '/approvals/77/approve', { result: 'APPROVED', opinion: '' });
    expect(mockedHttp.post).toHaveBeenNthCalledWith(4, '/approvals/77/approve', { result: 'REJECTED', opinion: '资料不完整' });
    expect(mockedHttp.post).not.toHaveBeenCalledWith('/retirement/12/approve');
    expect(mockedHttp.post).not.toHaveBeenCalledWith('/retirement/12/reject', expect.anything());
  });
});
