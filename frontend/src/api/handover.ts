import { api } from '../app/utils/api';

export interface HandoverRecord {
  id: number;
  title: string;
  outgoingUserId?: number;
  outgoingUserName?: string;
  incomingUserId?: number;
  incomingUserName?: string;
  status: string;
  statusLabel: string;
  assetCount: number;
  workorderCount: number;
  approvalCount: number;
  summary?: string;
  riskNote?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface HandoverList {
  records: HandoverRecord[];
  total: number;
}

export interface HandoverMeta {
  statuses: string[];
  readOnlyNotice: string;
}

export interface HandoverQuery {
  page?: number;
  pageSize?: number;
  status?: string;
  keyword?: string;
}

export function listHandoverTasks(params: HandoverQuery = {}) {
  return api.get<HandoverList>('/system/handover', { params });
}

export function getHandoverDetail(id: number) {
  return api.get<HandoverRecord>(`/system/handover/${id}`);
}

export function getHandoverMeta() {
  return api.get<HandoverMeta>('/system/handover/meta');
}
