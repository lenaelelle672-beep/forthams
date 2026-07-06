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
  consumePart,
  createSparePart,
  deleteSparePart,
  getLowStockAlerts,
  getPurchaseSuggestions,
  getSparePartDetail,
  getSparePartList,
  getUsageBySparePart,
  getUsageByWorkOrder,
  updateSparePart,
} from '@/api/sparePart';

const mockedHttp = vi.mocked(http);

describe('api/sparePart', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('uses unified spare part paths and relies on the shared http unwrapping contract', async () => {
    const params = { page: 1, pageSize: 20, keyword: 'pump' };
    const payload = {
      partNo: 'SP-001',
      partName: '泵密封圈',
      unit: '个',
      currentStock: 10,
      safetyStock: 5,
    };
    const usage = { sparePartId: 9, workOrderId: 18, quantity: 2, note: '维修领用' };

    mockedHttp.get.mockResolvedValue({});
    mockedHttp.post.mockResolvedValue({});
    mockedHttp.put.mockResolvedValue({});
    mockedHttp.delete.mockResolvedValue(undefined);

    await getSparePartList(params);
    await getSparePartDetail(9);
    await createSparePart(payload);
    await updateSparePart(9, { ...payload, status: 'ENABLED' });
    await deleteSparePart(9);
    await consumePart(usage);
    await getUsageByWorkOrder(18);
    await getUsageBySparePart(9);
    await getLowStockAlerts();
    await getPurchaseSuggestions();

    expect(mockedHttp.get).toHaveBeenNthCalledWith(1, '/spare-parts', { params });
    expect(mockedHttp.get).toHaveBeenNthCalledWith(2, '/spare-parts/9');
    expect(mockedHttp.post).toHaveBeenNthCalledWith(1, '/spare-parts', payload);
    expect(mockedHttp.put).toHaveBeenCalledWith('/spare-parts/9', { ...payload, status: 'ENABLED' });
    expect(mockedHttp.delete).toHaveBeenCalledWith('/spare-parts/9');
    expect(mockedHttp.post).toHaveBeenNthCalledWith(2, '/spare-part-usages', usage);
    expect(mockedHttp.get).toHaveBeenNthCalledWith(3, '/spare-parts/by-work-order/18');
    expect(mockedHttp.get).toHaveBeenNthCalledWith(4, '/spare-parts/9/usages');
    expect(mockedHttp.get).toHaveBeenNthCalledWith(5, '/spare-parts/low-stock');
    expect(mockedHttp.get).toHaveBeenNthCalledWith(6, '/spare-parts/purchase-suggestions');
  });
});
