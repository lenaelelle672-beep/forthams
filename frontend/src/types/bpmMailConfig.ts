export interface BpmMailConfig {
  id: number;
  processType: string;
  processName?: string;
  nodeId?: string;
  nodeName?: string;
  subjectTemplate?: string;
  contentTemplate?: string;
  toRecipients?: string;
  ccRecipients?: string;
  enabled: number;
  remark?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface BpmMailVariable {
  id: number;
  varKey: string;
  varName: string;
  defaultValue?: string;
  remark?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface CreateBpmMailConfigRequest {
  processType: string;
  processName?: string;
  nodeId?: string;
  nodeName?: string;
  subjectTemplate?: string;
  contentTemplate?: string;
  toRecipients?: string;
  ccRecipients?: string;
  enabled?: number;
  remark?: string;
}

export interface UpdateBpmMailConfigRequest {
  processName?: string;
  nodeId?: string;
  nodeName?: string;
  subjectTemplate?: string;
  contentTemplate?: string;
  toRecipients?: string;
  ccRecipients?: string;
  enabled?: number;
  remark?: string;
}

export interface CreateBpmMailVariableRequest {
  varKey: string;
  varName: string;
  defaultValue?: string;
  remark?: string;
}

export interface UpdateBpmMailVariableRequest {
  varName?: string;
  defaultValue?: string;
  remark?: string;
}

export const PROCESS_TYPES: Record<string, string> = {
  RETIREMENT: '报废流程',
  WORK_ORDER: '工单流程',
  PURCHASE: '采购流程',
  MAINTENANCE: '维保流程',
  INVENTORY: '盘点流程',
};
