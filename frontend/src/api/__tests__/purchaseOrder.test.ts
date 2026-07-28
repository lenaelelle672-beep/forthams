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
  approvePurchaseOrder,
  cancelPurchaseOrder,
  createPurchaseOrder,
  deletePurchaseOrder,
  getPurchaseOrderDetail,
  getPurchaseOrderItems,
  getPurchaseOrderList,
  getPurchaseOrderStats,
  receivePurchaseOrder,
  submitPurchaseOrder,
  updatePurchaseOrder,
} from '@/api/purchaseOrder';

const mockedHttp = {
  get: vi.mocked(http.get),
  post: vi.mocked(http.post),
  put: vi.mocked(http.put),
  delete: vi.mocked(http.delete),
};

describe('api/purchaseOrder', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('uses unified purchase order paths and relies on the shared http unwrapping contract', async () => {
    const params = { page: 1, pageSize: 10, status: 'DRAFT' };
    const payload = {
      orderNo: 'PO-001',
      orderName: '办公设备采购',
      vendorId: 7,
      items: [{ assetName: '笔记本', quantity: 2, unitPrice: 5000 }],
    };
    const patch = { remark: '更新备注' };

    mockedHttp.get.mockResolvedValue({});
    mockedHttp.post.mockResolvedValue({});
    mockedHttp.put.mockResolvedValue({});
    mockedHttp.delete.mockResolvedValue(undefined);

    await getPurchaseOrderList(params);
    await getPurchaseOrderDetail(11);
    await getPurchaseOrderItems(11);
    await createPurchaseOrder(payload);
    await updatePurchaseOrder(11, patch);
    await deletePurchaseOrder(11);
    await submitPurchaseOrder(11);
    await approvePurchaseOrder(11);
    await receivePurchaseOrder(11);
    await cancelPurchaseOrder(11);
    await getPurchaseOrderStats();

    expect(mockedHttp.get).toHaveBeenNthCalledWith(1, '/purchase-orders', { params });
    expect(mockedHttp.get).toHaveBeenNthCalledWith(2, '/purchase-orders/11');
    expect(mockedHttp.get).toHaveBeenNthCalledWith(3, '/purchase-orders/11/items');
    expect(mockedHttp.post).toHaveBeenNthCalledWith(1, '/purchase-orders', payload);
    expect(mockedHttp.put).toHaveBeenCalledWith('/purchase-orders/11', patch);
    expect(mockedHttp.delete).toHaveBeenCalledWith('/purchase-orders/11');
    expect(mockedHttp.post).toHaveBeenNthCalledWith(2, '/purchase-orders/11/submit');
    expect(mockedHttp.post).toHaveBeenNthCalledWith(3, '/purchase-orders/11/approve');
    expect(mockedHttp.post).toHaveBeenNthCalledWith(4, '/purchase-orders/11/receive');
    expect(mockedHttp.post).toHaveBeenNthCalledWith(5, '/purchase-orders/11/cancel');
    expect(mockedHttp.get).toHaveBeenNthCalledWith(4, '/purchase-orders/stats');
  });
});
