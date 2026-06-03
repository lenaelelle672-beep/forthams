/**
 * 维保计划类型定义 — 与后端 MaintenancePlan Entity 严格对齐
 */

export interface MaintenancePlan {
  id: number;
  tenantId?: string;
  planName: string;
  assetId: number;
  triggerType: string;           // manual/daily/weekly/monthly/yearly
  intervalDays?: number;         // manual 时使用
  dayOfWeek?: number;            // 1=周一, 7=周日（weekly 时使用）
  dayOfMonth?: number;           // 1-31（monthly 时使用）
  monthOfYear?: number;          // 1-12（yearly 时使用）
  startDate: string;
  endDate?: string;
  lastGeneratedDate?: string;
  nextDueDate?: string;
  estimatedCost?: number;
  defaultExecutor?: string;
  defaultContent?: string;
  priority: string;              // URGENT/HIGH/NORMAL/LOW
  status: string;                // ACTIVE/PAUSED/COMPLETED/CANCELED
  vendorId?: number;
  remark?: string;
  createBy?: number;
  createTime?: string;
  updateTime?: string;
}

export interface CreateMaintenancePlanRequest {
  planName: string;
  assetId: number;
  triggerType: string;
  intervalDays?: number;
  dayOfWeek?: number;
  dayOfMonth?: number;
  monthOfYear?: number;
  startDate: string;
  endDate?: string;
  estimatedCost?: number;
  defaultExecutor?: string;
  defaultContent?: string;
  priority?: string;
  status?: string;
  vendorId?: number;
  remark?: string;
}

export type UpdateMaintenancePlanRequest = Partial<CreateMaintenancePlanRequest>;

export interface MaintenancePlanQueryParams {
  page?: number;
  pageSize?: number;
  assetId?: number;
  triggerType?: string;
  status?: string;
}

export interface PageResponse<T> {
  records: T[];
  total: number;
  size: number;
  current: number;
  pages?: number;
}

// ─── 展示常量 ────────────────────────────────────────────────────────────────

export const TRIGGER_TYPE_LABELS: Record<string, string> = {
  manual: '手动',
  daily: '每日',
  weekly: '每周',
  monthly: '每月',
  yearly: '每年',
};

export const PRIORITY_LABELS: Record<string, string> = {
  URGENT: '紧急',
  HIGH: '高',
  NORMAL: '中',
  LOW: '低',
};

export const PRIORITY_COLORS: Record<string, string> = {
  URGENT: 'bg-red-100 text-red-700',
  HIGH: 'bg-orange-100 text-orange-700',
  NORMAL: 'bg-yellow-100 text-yellow-700',
  LOW: 'bg-blue-100 text-blue-700',
};

export const STATUS_LABELS: Record<string, string> = {
  ACTIVE: '启用',
  PAUSED: '暂停',
  COMPLETED: '已完成',
  CANCELED: '已取消',
};

export const STATUS_COLORS: Record<string, string> = {
  ACTIVE: 'bg-green-100 text-green-700',
  PAUSED: 'bg-yellow-100 text-yellow-700',
  COMPLETED: 'bg-blue-100 text-blue-700',
  CANCELED: 'bg-gray-100 text-gray-500',
};
