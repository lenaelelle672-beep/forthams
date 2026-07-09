import http from '@/utils/http';

export type FlowDesignerNodeType =
  | 'START'
  | 'END'
  | 'APPROVAL'
  | 'TASK'
  | 'USER_TASK'
  | 'SERVICE_TASK'
  | 'FORM'
  | 'NOTIFY'
  | 'EXCLUSIVE_GATEWAY'
  | 'PARALLEL_GATEWAY';

export interface FlowDesignerNodeDTO {
  id: string;
  type: FlowDesignerNodeType | string;
  label?: string;
  config?: Record<string, unknown>;
}

export interface FlowDesignerEdgeDTO {
  id?: string;
  source: string;
  target: string;
  label?: string;
}

export interface FlowDesignerGraphDTO {
  id?: string;
  name?: string;
  description?: string;
  nodes: FlowDesignerNodeDTO[];
  edges: FlowDesignerEdgeDTO[];
}

export interface FlowDesignerDraftPayload {
  name: string;
  description?: string;
  graph: FlowDesignerGraphDTO;
}

export interface FlowDesignerOperationPayload {
  confirmed: true;
  reason?: string;
  publishNote?: string;
  impactScope?: string;
  rollbackPlan?: string;
}

export interface FlowDesignerValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  nodeCount: number;
  edgeCount: number;
}

export interface FlowDesignerDefinitionDTO {
  id?: number;
  businessType: string;
  name: string;
  description?: string | null;
  definition?: FlowDesignerGraphDTO | Record<string, unknown> | null;
  status?: string | null;
  version?: number | null;
  updatedBy?: number | null;
  publishedBy?: number | null;
  publishedAt?: string | null;
  updateTime?: string | null;
}

export interface WorkflowDefinitionVersionDTO {
  id: number;
  definitionId: number;
  businessType: string;
  version: number;
  actionType: 'PUBLISH' | 'ROLLBACK' | string;
  status: string;
  name: string;
  description?: string;
  definition?: FlowDesignerGraphDTO | Record<string, unknown>;
  publishNote?: string;
  impactScope?: string;
  rollbackPlan?: string;
  rollbackSourceVersion?: number | null;
  operatorId?: number;
  publishedAt?: string;
  createTime?: string;
}

function getOperatorId(): number | undefined {
  if (typeof window === 'undefined') return undefined;
  const raw = window.sessionStorage.getItem('user_info') || window.localStorage.getItem('user_info');
  if (!raw) return undefined;
  try {
    const user = JSON.parse(raw);
    const id = user.id ?? user.userId ?? user.uid;
    return id != null && id !== '' ? Number(id) : undefined;
  } catch {
    return undefined;
  }
}

const workflowPath = (businessType: string, suffix = '') => `/workflows/${encodeURIComponent(businessType)}${suffix}`;

export const flowDesignerApi = {
  listDefinitions: () =>
    http.get<FlowDesignerDefinitionDTO[]>('/workflows'),

  getDesigner: (businessType: string) =>
    http.get<FlowDesignerDefinitionDTO>(workflowPath(businessType, '/designer')),

  saveDraft: (businessType: string, payload: FlowDesignerDraftPayload) =>
    http.put<FlowDesignerDefinitionDTO>(workflowPath(businessType, '/designer/draft'), {
      ...payload,
      operatorId: getOperatorId(),
    }),

  validateGraph: (businessType: string, graph: FlowDesignerGraphDTO) =>
    http.post<FlowDesignerValidationResult>(workflowPath(businessType, '/designer/validate'), graph),

  publish: (businessType: string, payload: FlowDesignerOperationPayload) =>
    http.post<FlowDesignerDefinitionDTO>(workflowPath(businessType, '/publish'), {
      ...payload,
      operatorId: getOperatorId(),
    }),

  listVersions: (businessType: string) =>
    http.get<WorkflowDefinitionVersionDTO[]>(workflowPath(businessType, '/versions')),

  rollback: (businessType: string, version: number, payload: FlowDesignerOperationPayload) =>
    http.post<FlowDesignerDefinitionDTO>(workflowPath(businessType, `/versions/${version}/rollback`), {
      ...payload,
      operatorId: getOperatorId(),
    }),
};
