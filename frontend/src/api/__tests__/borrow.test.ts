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
  approveBorrow,
  borrowAsset,
  cancelBorrow,
  createBorrow,
  deleteBorrow,
  getBorrow,
  getBorrows,
  rejectBorrow,
  returnBorrow,
  submitBorrow,
  updateBorrow,
} from '@/api/borrow';

const mockedHttp = vi.mocked(http);

describe('api/borrow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('uses unified borrow paths and relies on the shared http unwrapping contract', async () => {
    const params = { page: 2, pageSize: 20, status: 'APPROVED' };
    const payload = { assetId: 8, expectedReturnDate: '2026-06-30', purpose: '演示' };
    const patch = { remark: '更新备注' };

    mockedHttp.get.mockResolvedValue({});
    mockedHttp.post.mockResolvedValue({});
    mockedHttp.put.mockResolvedValue({});
    mockedHttp.delete.mockResolvedValue(undefined);

    await getBorrows(params);
    await getBorrow(21);
    await createBorrow(payload);
    await updateBorrow(21, patch);
    await deleteBorrow(21);
    await submitBorrow(21);
    await approveBorrow(21);
    await rejectBorrow(21, '超出借用范围');
    await borrowAsset(21);
    await returnBorrow(21, '已归还');
    await cancelBorrow(21);

    expect(mockedHttp.get).toHaveBeenNthCalledWith(1, '/borrows', { params });
    expect(mockedHttp.get).toHaveBeenNthCalledWith(2, '/borrows/21');
    expect(mockedHttp.post).toHaveBeenNthCalledWith(1, '/borrows', payload);
    expect(mockedHttp.put).toHaveBeenCalledWith('/borrows/21', patch);
    expect(mockedHttp.delete).toHaveBeenCalledWith('/borrows/21');
    expect(mockedHttp.post).toHaveBeenNthCalledWith(2, '/borrows/21/submit');
    expect(mockedHttp.post).toHaveBeenNthCalledWith(3, '/borrows/21/approve');
    expect(mockedHttp.post).toHaveBeenNthCalledWith(4, '/borrows/21/reject', null, { params: { reason: '超出借用范围' } });
    expect(mockedHttp.post).toHaveBeenNthCalledWith(5, '/borrows/21/borrow');
    expect(mockedHttp.post).toHaveBeenNthCalledWith(6, '/borrows/21/return', null, { params: { remark: '已归还' } });
    expect(mockedHttp.post).toHaveBeenNthCalledWith(7, '/borrows/21/cancel');
  });
});
