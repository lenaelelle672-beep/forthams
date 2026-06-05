/**
 * @file api/budget.ts
 * @description 预算管理 API 封装
 */
import http from '@/utils/http';
import type { Budget, BudgetQuery, ExecutionRate, OverBudgetAlert } from '@/types/budget';

export const getBudgets = (params?: BudgetQuery) =>
  http.get<any>('/budgets', { params });

export const getBudgetDetail = (id: number) =>
  http.get<Budget>('/budgets/' + id);

export const createBudget = (data: Partial<Budget>) =>
  http.post<Budget>('/budgets', data);

export const updateBudget = (id: number, data: Partial<Budget>) =>
  http.put<Budget>('/budgets/' + id, data);

export const deleteBudget = (id: number) =>
  http.delete('/budgets/' + id);

export const checkBudget = (data: { deptId: number; categoryId: number; budgetType: string; amount: number }) =>
  http.post<{ available: boolean; budgetId: number; remaining: number }>('/budgets/check', data);

export const getExecutionRate = (params?: { budgetYear?: number }) =>
  http.get<ExecutionRate[]>('/budgets/execution-rate', { params });

export const getOverBudgetAlerts = () =>
  http.get<OverBudgetAlert[]>('/budgets/over-budget-alerts');
