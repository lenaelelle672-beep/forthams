import { api } from '../app/utils/api';

export interface SupportTicketRecord {
  id: number;
  title: string;
  category: string;
  priority: string;
  priorityLabel: string;
  status: string;
  statusLabel: string;
  requesterName?: string;
  assigneeName?: string;
  diagnosticPackageAttached: boolean;
  diagnosticPackageMasked: boolean;
  summary?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface SupportTicketList {
  records: SupportTicketRecord[];
  total: number;
}

export interface TechSupportMeta {
  priorities: string[];
  statuses: string[];
  readOnlyNotice: string;
}

export interface SupportTicketQuery {
  page?: number;
  pageSize?: number;
  status?: string;
  priority?: string;
  keyword?: string;
}

export function listSupportTickets(params: SupportTicketQuery = {}) {
  return api.get<SupportTicketList>('/system/tech-support', { params });
}

export function getSupportTicketDetail(id: number) {
  return api.get<SupportTicketRecord>(`/system/tech-support/${id}`);
}

export function getTechSupportMeta() {
  return api.get<TechSupportMeta>('/system/tech-support/meta');
}
