import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/utils/http', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
  },
}));

import http from '@/utils/http';
import {
  batchGenerateLabels,
  getAssetLabel,
  getAssetLabelImage,
  getAssetQrCode,
} from '@/api/barcode';

const mockedHttp = vi.mocked(http);

describe('api/barcode', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('uses unified baseURL paths without duplicating /api', async () => {
    mockedHttp.get.mockResolvedValue({});
    mockedHttp.post.mockResolvedValue([]);

    await getAssetQrCode(7);
    await getAssetLabel(7);
    await getAssetLabelImage(7);
    await batchGenerateLabels([7, 8]);

    expect(mockedHttp.get).toHaveBeenNthCalledWith(1, '/barcodes/asset/7', { responseType: 'blob' });
    expect(mockedHttp.get).toHaveBeenNthCalledWith(2, '/barcodes/asset/7/label');
    expect(mockedHttp.get).toHaveBeenNthCalledWith(3, '/barcodes/asset/7/label-image', { responseType: 'blob' });
    expect(mockedHttp.post).toHaveBeenCalledWith('/barcodes/batch', { assetIds: [7, 8] });
  });
});
