/**
 * @file types/budget.ts
 * @description 预算管理类型定义
 */
export interface Budget {
  id?: number;
  budgetYear: number;
  deptId?: number;
  categoryId?: number;
  budgetType: 'PURCHASE' | 'MAINTENANCE' | 'OPERATION';
  totalAmount: number;
  usedAmount: number;
  committedAmount: number;
  status: 'DRAFT' | 'APPROVED' | 'CLOSED';
  approvedBy?: number;
  createTime?: string;
  updateTime?: string;
  deptName?: string;
  categoryName?: string;
}

export interface BudgetQuery {
  budgetYear?: number;
  deptId?: number;
  categoryId?: number;
  budgetType?: string;
  status?: string;
  page?: number;
  pageSize?: number;
}

export interface ExecutionRate {
  budgetId: number;
  budgetYear: number;
  budgetType: string;
  totalAmount: number;
  usedAmount: number;
  committedAmount: number;
  executionRate: number;
  status: string;
}

export interface OverBudgetAlert {
  budgetId: number;
  budgetYear: number;
  budgetType: string;
  totalAmount: number;
  usedAmount: number;
  overshoot: number;
  status: string;
}
