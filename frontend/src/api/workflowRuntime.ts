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

const WORKFLOW_RUNTIME_LIST = '/approvals/list';
const WORKFLOW_RUNTIME_PENDING_COUNT = '/approvals/pending/count';

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
