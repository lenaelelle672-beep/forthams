import { api } from "../utils/api";

export interface DisposalRecord {
  id?: number;
  [key: string]: unknown;
}

export const disposalService = {
  transfer(data: Record<string, unknown>) {
    return api.post<DisposalRecord>("/disposals/transfer", data);
  },

  clearance(data: Record<string, unknown>) {
    return api.post<DisposalRecord>("/disposals/clearance", data);
  },

  scrap(data: Record<string, unknown>) {
    return api.post<DisposalRecord>("/disposals/scrap", data);
  },

  getHistory(params?: Record<string, unknown>) {
    return api.get<DisposalRecord[]>("/disposals/history", { params });
  },
};
