import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/utils/http', () => ({
  default: {
    get: vi.fn(),
  },
}));

import http from '@/utils/http';
import {
  fetchDepreciationData,
  transformApiResponse,
  type DepreciationApiResponse,
} from './DepreciationCard';

const mockedHttp = vi.mocked(http);

const comparisonResponse: DepreciationApiResponse = {
  assetId: 42,
  assetNo: 'AMS-042',
  assetName: '测试资产',
  originalValue: 12000,
  currentValue: 9000,
  usefulLifeYears: 5,
  period: '2026-06',
  data: [
    {
      methodCode: 'STRAIGHT_LINE',
      methodName: '直线法',
      monthlyDepreciation: 200,
      annualDepreciation: 2400,
      annualRate: 20,
      accumulatedDepreciation: 3000,
      netValue: 9000,
    },
    {
      methodCode: 'DOUBLE_DECLINING',
      methodName: '双倍余额递减法',
      monthlyDepreciation: 400,
      annualDepreciation: 4800,
      annualRate: 40,
      accumulatedDepreciation: 3000,
      netValue: 9000,
    },
  ],
};

describe('DepreciationCard data mapping', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('maps the selected depreciation method from the backend comparison response', () => {
    const data = transformApiResponse(comparisonResponse, 'double_declining');

    expect(data.method).toBe('double_declining');
    expect(data.methodLabel).toBe('双倍余额递减法');
    expect(data.purchasePrice).toBe(12000);
    expect(data.usefulLifeYears).toBe(5);
    expect(data.monthlyDepreciation.amount).toBe(400);
    expect(data.currentYearDepreciation).toBe(4800);
    expect(data.accumulatedDepreciation).toBe(3000);
    expect(data.netBookValue).toBe(9000);
    expect(data.depreciationRate).toBe(0.4);
    expect(data.calculatedAt).toBe('2026-06');
  });

  it('uses the shared http client and current depreciation comparison endpoint', async () => {
    mockedHttp.get.mockResolvedValue(comparisonResponse);
    const controller = new AbortController();

    await fetchDepreciationData('42', 'straight_line', '2026-06-09', controller.signal);

    expect(mockedHttp.get).toHaveBeenCalledWith('/depreciation/comparison/42', {
      params: { period: '2026-06' },
      signal: controller.signal,
    });
  });
});
