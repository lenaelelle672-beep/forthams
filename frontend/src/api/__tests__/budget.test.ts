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
  checkBudget,
  createBudget,
  deleteBudget,
  getBudgetDetail,
  getBudgets,
  getExecutionRate,
  getOverBudgetAlerts,
  updateBudget,
} from '@/api/budget';

const mockedHttp = vi.mocked(http);

describe('api/budget', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('uses budget endpoints and direct unwrapped return types', async () => {
    const params = { page: 1, pageSize: 10, budgetYear: 2026 };
    const payload = { budgetYear: 2026, budgetType: 'PURCHASE' as const, totalAmount: 1000 };

    mockedHttp.get.mockResolvedValue({});
    mockedHttp.post.mockResolvedValue({});
    mockedHttp.put.mockResolvedValue({});
    mockedHttp.delete.mockResolvedValue(undefined);

    await getBudgets(params);
    await getBudgetDetail(8);
    await createBudget(payload);
    await updateBudget(8, { totalAmount: 1200 });
    await deleteBudget(8);
    await checkBudget({ deptId: 1, categoryId: 2, budgetType: 'PURCHASE', amount: 100 });
    await getExecutionRate({ budgetYear: 2026 });
    await getOverBudgetAlerts();

    expect(mockedHttp.get).toHaveBeenNthCalledWith(1, '/budgets', { params });
    expect(mockedHttp.get).toHaveBeenNthCalledWith(2, '/budgets/8');
    expect(mockedHttp.post).toHaveBeenNthCalledWith(1, '/budgets', payload);
    expect(mockedHttp.put).toHaveBeenCalledWith('/budgets/8', { totalAmount: 1200 });
    expect(mockedHttp.delete).toHaveBeenCalledWith('/budgets/8');
    expect(mockedHttp.post).toHaveBeenNthCalledWith(2, '/budgets/check', {
      deptId: 1,
      categoryId: 2,
      budgetType: 'PURCHASE',
      amount: 100,
    });
    expect(mockedHttp.get).toHaveBeenNthCalledWith(3, '/budgets/execution-rate', { params: { budgetYear: 2026 } });
    expect(mockedHttp.get).toHaveBeenNthCalledWith(4, '/budgets/over-budget-alerts');
  });
});
