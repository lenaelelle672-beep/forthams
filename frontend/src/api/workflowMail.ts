import { api } from '../app/utils/api';

export interface WorkflowMailConfigRecord {
  id: number;
  businessType: string;
  nodeKey: string;
  nodeName?: string;
  triggerEvent: string;
  triggerEventLabel: string;
  templateCode?: string;
  enabled: boolean;
  recipientScope: string;
  recipientScopeLabel: string;
  riskNote?: string;
  createdAt?: string;
}

export interface WorkflowMailConfigList {
  records: WorkflowMailConfigRecord[];
  total: number;
}

export interface WorkflowMailMeta {
  triggerEvents: string[];
  recipientScopes: string[];
  readOnlyNotice: string;
}

export interface WorkflowMailQuery {
  page?: number;
  pageSize?: number;
  businessType?: string;
  enabled?: number;
}

export function listWorkflowMailConfigs(params: WorkflowMailQuery = {}) {
  return api.get<WorkflowMailConfigList>('/system/workflow-mail', { params });
}

export function getWorkflowMailConfigDetail(id: number) {
  return api.get<WorkflowMailConfigRecord>(`/system/workflow-mail/${id}`);
}

export function getWorkflowMailMeta() {
  return api.get<WorkflowMailMeta>('/system/workflow-mail/meta');
}
