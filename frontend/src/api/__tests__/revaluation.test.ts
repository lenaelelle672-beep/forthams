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
  approveRevaluation,
  createRevaluation,
  deleteRevaluation,
  getRevaluationDetail,
  getRevaluations,
  updateRevaluation,
} from '@/api/revaluation';

const mockedHttp = {
  get: vi.mocked(http.get),
  post: vi.mocked(http.post),
  put: vi.mocked(http.put),
  delete: vi.mocked(http.delete),
};

describe('api/revaluation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('uses revaluation endpoints and direct unwrapped return types', async () => {
    const params = { page: 1, pageSize: 10, status: 'PENDING' };
    const payload = {
      assetId: 8,
      revaluationType: 'IMPAIRMENT' as const,
      previousValue: 1000,
      newValue: 800,
      reason: '资产减值',
    };

    mockedHttp.get.mockResolvedValue({});
    mockedHttp.post.mockResolvedValue({});
    mockedHttp.put.mockResolvedValue({});
    mockedHttp.delete.mockResolvedValue(undefined);

    await getRevaluations(params);
    await getRevaluationDetail(9);
    await createRevaluation(payload);
    await updateRevaluation(9, { newValue: 900 });
    await deleteRevaluation(9);
    await approveRevaluation(9, { status: 'APPROVED' });

    expect(mockedHttp.get).toHaveBeenNthCalledWith(1, '/revaluations', { params });
    expect(mockedHttp.get).toHaveBeenNthCalledWith(2, '/revaluations/9');
    expect(mockedHttp.post).toHaveBeenNthCalledWith(1, '/revaluations', payload);
    expect(mockedHttp.put).toHaveBeenCalledWith('/revaluations/9', { newValue: 900 });
    expect(mockedHttp.delete).toHaveBeenCalledWith('/revaluations/9');
    expect(mockedHttp.post).toHaveBeenNthCalledWith(2, '/revaluations/9/approve', { status: 'APPROVED' });
  });
});
