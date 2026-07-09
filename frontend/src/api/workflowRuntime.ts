import { api } from '../app/utils/api';

export interface WorkflowRuntimeProcess {
  id: number;
  processNo?: string | null;
  processType?: string | null;
  businessId?: number | null;
  businessData?: string | null;
  tenantId?: string | null;
  status?: string | null;
  currentStep?: number | null;
  applicantId?: number | null;
  applyTime?: string | null;
  updateTime?: string | null;
  deleted?: number | null;
}

export interface WorkflowRuntimePage {
  records: WorkflowRuntimeProcess[];
  total: number;
  size: number;
  current: number;
  pages: number;
}

export interface WorkflowRuntimeListParams {
  page?: number;
  pageSize?: number;
  status?: string;
  processType?: string;
}

export interface WorkflowRuntimeSlaTimeoutRecord {
  id: number;
  configId?: number | null;
  processInstanceId?: string | null;
  processKey?: string | null;
  businessType?: string | null;
  nodeKey?: string | null;
  nodeName?: string | null;
  priority?: string | null;
  resolveDueAt?: string | null;
  timeoutAt?: string | null;
  timeoutMinutes?: number | null;
  riskLevel?: string | null;
  status?: string | null;
  maskedBusinessSummary?: string | null;
  applicantMasked?: string | null;
  assigneeMasked?: string | null;
  auditSummary?: string | null;
  masked?: boolean;
}

export interface WorkflowRuntimeSlaSummary {
  totalConfigs: number;
  activeConfigs: number;
  overdueCount: number;
  warningCount: number;
  criticalCount: number;
  timeoutRecordCount: number;
  riskCounts?: Record<string, number>;
  nodeDurationSummary?: string[];
  abnormalTraceSummary?: string[];
  recentTimeoutRecords?: WorkflowRuntimeSlaTimeoutRecord[];
  exportMaskingNotice?: string | null;
  readOnly?: boolean;
  tenantScoped?: boolean;
  generatedAt?: string | null;
}

export interface WorkflowRuntimeSlaTimeoutQuery {
  processKey?: string;
  nodeKey?: string;
  status?: string;
  riskLevel?: string;
}

const WORKFLOW_RUNTIME_LIST = '/approvals/list';
const WORKFLOW_RUNTIME_PENDING_COUNT = '/approvals/pending/count';
const SLA_RUNTIME_SUMMARY = '/sla-config/runtime-summary';
const SLA_TIMEOUT_RECORDS = '/sla-config/timeout-records';

export function listWorkflowRuntime(params: WorkflowRuntimeListParams = {}) {
  const status = params.status?.trim();
  const processType = params.processType?.trim();

  return api.get<WorkflowRuntimePage>(WORKFLOW_RUNTIME_LIST, {
    params: {
      page: params.page ?? 1,
      pageSize: params.pageSize ?? 50,
      ...(status ? { status } : {}),
      ...(processType ? { keyword: processType } : {}),
    },
  });
}

export function getWorkflowRuntimePendingCount() {
  return api.get<number>(WORKFLOW_RUNTIME_PENDING_COUNT);
}

export function getWorkflowRuntimeSlaSummary() {
  return api.get<WorkflowRuntimeSlaSummary>(SLA_RUNTIME_SUMMARY);
}

export function listWorkflowRuntimeSlaTimeoutRecords(params: WorkflowRuntimeSlaTimeoutQuery = {}) {
  return api.get<WorkflowRuntimeSlaTimeoutRecord[]>(SLA_TIMEOUT_RECORDS, { params });
}
