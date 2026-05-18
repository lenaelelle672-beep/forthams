import { api } from "../utils/api";

export interface DisposalRecord {
  id?: number;
  [key: string]: unknown;
}

export const disposalService = {
  getHistory(params?: Record<string, unknown>) {
    return api.get<DisposalRecord[]>("/disposals/history", { params });
  },
};
