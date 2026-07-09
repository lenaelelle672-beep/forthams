import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  fetchDepreciationData,
  transformApiResponse,
  type DepreciationApiResponse,
} from './DepreciationCard';

const comparisonResponse: DepreciationApiResponse = {
  current_depreciation: 0,
  accumulated_depreciation: 3000,
  net_book_value: 9000,
  monthly_depreciation: 400,
  method: 'double_declining',
  calculated_at: '2026-06',
};

describe('DepreciationCard data mapping', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('maps the selected depreciation method from the backend comparison response', () => {
    const data = transformApiResponse(comparisonResponse);

    expect(data.method).toBe('double_declining');
    expect(data.methodLabel).toBe('双倍余额递减法');
    expect(data.monthlyDepreciation.amount).toBe(400);
    expect(data.currentYearDepreciation).toBe(4800);
    expect(data.accumulatedDepreciation).toBe(3000);
    expect(data.netBookValue).toBe(9000);
    expect(data.calculatedAt).toBe('2026-06');
  });

  it('uses the shared http client and current depreciation comparison endpoint', async () => {
    const mockJson = vi.fn().mockResolvedValue(comparisonResponse);
    const mockFetch = vi.fn().mockResolvedValue({ ok: true, json: mockJson });
    vi.stubGlobal('fetch', mockFetch);
    const controller = new AbortController();

    const result = await fetchDepreciationData('42', 'straight_line', '2026-06-09', controller.signal);

    expect(mockFetch).toHaveBeenCalledWith(
      '/api/v1/assets/42/depreciation?method=straight_line&reference_date=2026-06-09',
      { signal: controller.signal },
    );
    expect(result.method).toBe('double_declining');
  });
});
