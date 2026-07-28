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
  acceptIntakeOrder,
  cancelIntakeOrder,
  createIntakeOrder,
  deleteIntakeOrder,
  getIntakeOrder,
  getIntakeOrders,
  inspectIntakeOrder,
  rejectIntakeOrder,
  submitIntakeOrder,
  updateIntakeOrder,
} from '@/api/intake';

const mockedHttp = {
  get: vi.mocked(http.get),
  post: vi.mocked(http.post),
  put: vi.mocked(http.put),
  delete: vi.mocked(http.delete),
};

describe('api/intake', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('uses unified intake paths and relies on the shared http unwrapping contract', async () => {
    const params = { page: 1, pageSize: 10, status: 'DRAFT' };
    const payload = {
      vendorId: 5,
      checkItems: [{ itemName: '外观', expectedValue: '完好' }],
      intakeAssets: [{ assetName: '测试资产' }],
    };
    const patch = { remark: '更新备注' };
    const checkItems = [{ id: 1, itemName: '外观', actualValue: '完好', result: 'PASS' }];

    mockedHttp.get.mockResolvedValue({});
    mockedHttp.post.mockResolvedValue({});
    mockedHttp.put.mockResolvedValue({});
    mockedHttp.delete.mockResolvedValue(undefined);

    await getIntakeOrders(params);
    await getIntakeOrder(31);
    await createIntakeOrder(payload);
    await updateIntakeOrder(31, patch);
    await deleteIntakeOrder(31);
    await submitIntakeOrder(31);
    await inspectIntakeOrder(31, checkItems);
    await acceptIntakeOrder(31);
    await rejectIntakeOrder(31, '验收不通过');
    await cancelIntakeOrder(31);

    expect(mockedHttp.get).toHaveBeenNthCalledWith(1, '/intake-orders', { params });
    expect(mockedHttp.get).toHaveBeenNthCalledWith(2, '/intake-orders/31');
    expect(mockedHttp.post).toHaveBeenNthCalledWith(1, '/intake-orders', payload);
    expect(mockedHttp.put).toHaveBeenCalledWith('/intake-orders/31', patch);
    expect(mockedHttp.delete).toHaveBeenCalledWith('/intake-orders/31');
    expect(mockedHttp.post).toHaveBeenNthCalledWith(2, '/intake-orders/31/submit');
    expect(mockedHttp.post).toHaveBeenNthCalledWith(3, '/intake-orders/31/inspect', checkItems);
    expect(mockedHttp.post).toHaveBeenNthCalledWith(4, '/intake-orders/31/accept');
    expect(mockedHttp.post).toHaveBeenNthCalledWith(5, '/intake-orders/31/reject', null, { params: { reason: '验收不通过' } });
    expect(mockedHttp.post).toHaveBeenNthCalledWith(6, '/intake-orders/31/cancel');
  });
});
