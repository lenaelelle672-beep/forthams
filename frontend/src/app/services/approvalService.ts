import { api } from "../utils/api";

export interface ApprovalRecord {
  id: number;
  [key: string]: unknown;
}

export const approvalService = {
  list(params?: Record<string, unknown>) {
    return api.get<ApprovalRecord[]>("/approvals/list", { params });
  },

  getById(id: number | string) {
    return api.get<ApprovalRecord>(`/approvals/${id}`);
  },

  create(data: Record<string, unknown>) {
    return api.post<ApprovalRecord>("/approvals", data);
  },

  approve(id: number | string, data: Record<string, unknown>) {
    return api.post<ApprovalRecord>(`/approvals/${id}/approve`, data);
  },

  getPending() {
    return api.get<ApprovalRecord[]>("/approvals/pending");
  },

  getPendingCount() {
    return api.get<number>("/approvals/pending/count");
  },
};
