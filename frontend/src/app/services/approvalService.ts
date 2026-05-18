/**
 * @module frontend/src/app/services/approvalService
 * @description Legacy approval service — delegates to the typed SDK in ./approval/api.ts
 *
 * This module is maintained for backward compatibility with consumers that import
 * from `approvalService`. All actual API calls go through the typed approval SDK.
 *
 * New code should prefer importing directly from `./approval/api.ts`.
 */

import {
  fetchPendingApprovals as apiFetchPending,
  approve as apiApprove,
  reject as apiReject,
  getApprovalHistory as apiGetHistory,
  getApprovalList as apiGetList,
  getPendingCount as apiGetPendingCount,
  createProcess as apiCreateProcess,
  cancelProcess as apiCancelProcess,
} from "./approval/api";
import type { ApprovalItem, ApprovalDetailResponse } from "./approval/types";

/** @deprecated Use ApprovalItem from ./approval/types instead */
export interface ApprovalRecord {
  id: number;
  [key: string]: unknown;
}

export const approvalService = {
  async list(params?: Record<string, unknown>) {
    const result = await apiGetList({
      page: params?.page as number | undefined,
      pageSize: params?.pageSize as number | undefined,
      status: params?.status as string | undefined,
      processType: params?.processType as string | undefined,
      keyword: params?.keyword as string | undefined,
    });
    return result.records;
  },

  async getById(id: number | string): Promise<ApprovalDetailResponse> {
    return apiGetHistory(Number(id));
  },

  async create(data: Record<string, unknown>): Promise<ApprovalItem> {
    return apiCreateProcess({
      processType: data.processType as string,
      businessId: data.businessId as number | undefined,
      businessData: data.businessData as string | undefined,
    });
  },

  async approve(id: number | string, data: Record<string, unknown>): Promise<ApprovalItem> {
    const approved = data.approved !== false;
    if (approved) {
      return apiApprove(Number(id), (data.comment ?? data.opinion ?? "") as string);
    } else {
      return apiReject(Number(id), (data.comment ?? data.opinion ?? "") as string);
    }
  },

  async getPending(): Promise<ApprovalItem[]> {
    return apiFetchPending();
  },

  async getPendingCount(): Promise<number> {
    return apiGetPendingCount();
  },
};
