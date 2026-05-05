import { api } from "../utils/api";
import type { PagedResult } from "./assetService";

export interface WorkOrderRecord {
  id: number;
  workOrderNo?: string;
  title?: string;
  description?: string;
  status?: string;
  priority?: string;
  assetName?: string;
  assetCode?: string;
  reporterName?: string;
  assigneeName?: string;
  createTime?: string;
  [key: string]: unknown;
}

export const workOrderService = {
  list(params?: Record<string, unknown>) {
    return api.get<PagedResult<WorkOrderRecord>>("/workorders", { params });
  },

  submit(id: number | string) {
    return api.post<WorkOrderRecord>(`/workorders/${id}/submit`);
  },

  operate(id: number | string, operation: string, comment?: string) {
    return api.post<WorkOrderRecord>(`/workorders/${id}/operate`, { operation, comment });
  },
};
