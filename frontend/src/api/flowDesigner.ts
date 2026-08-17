import http from '@/utils/http';
import {
  decodeUnwrappedResponse,
  getStoredOperatorId,
  readNullableApiRecord,
  readNullableNonNegativeInteger,
  readNullableString,
  readOptionalPositiveInteger,
  readOptionalString,
  requireApiArray,
  requireApiRecord,
  requireBoolean,
  requireNonBlankString,
  requireNonNegativeInteger,
  requirePositiveInteger,
  requireString,
} from './apiBoundary';

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
  expectedRevision: number | null;
}

export interface FlowDesignerOperationPayload {
  confirmed: true;
  reason?: string;
  publishNote?: string;
  impactScope?: string;
  rollbackPlan?: string;
  expectedDraftRevision?: number;
  expectedDraftAbsent?: boolean;
  expectedPublishedVersion?: number;
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
  revision?: number | null;
  publishedDefinitionId?: number | null;
  publishedVersion?: number | null;
  publishedStatus?: string | null;
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

const workflowPath = (businessType: string, suffix = '') => `/workflows/${encodeURIComponent(businessType)}${suffix}`;

function parseFlowDesignerDefinition(value: unknown, label: string): FlowDesignerDefinitionDTO {
  const record = requireApiRecord(value, label);
  return {
    id: readOptionalPositiveInteger(record, 'id', label),
    businessType: requireNonBlankString(record, 'businessType', label),
    name: requireString(record, 'name', label),
    description: readNullableString(record, 'description', label),
    definition: readNullableApiRecord(record, 'definition', label),
    status: readNullableString(record, 'status', label),
    version: readNullableNonNegativeInteger(record, 'version', label),
    revision: readNullableNonNegativeInteger(record, 'revision', label),
    publishedDefinitionId: readOptionalPositiveInteger(record, 'publishedDefinitionId', label) ?? null,
    publishedVersion: readNullableNonNegativeInteger(record, 'publishedVersion', label),
    publishedStatus: readNullableString(record, 'publishedStatus', label),
    updatedBy: readOptionalPositiveInteger(record, 'updatedBy', label) ?? null,
    publishedBy: readOptionalPositiveInteger(record, 'publishedBy', label) ?? null,
    publishedAt: readNullableString(record, 'publishedAt', label),
    updateTime: readNullableString(record, 'updateTime', label),
  };
}

function parseValidationResult(value: unknown, label: string): FlowDesignerValidationResult {
  const record = requireApiRecord(value, label);
  const parseMessages = (key: 'errors' | 'warnings') => requireApiArray(record[key], `${label}响应中的${key}`)
    .map((message, index) => {
      if (typeof message !== 'string') {
        throw new Error(`${label}响应中的${key}[${index}]无效`);
      }
      return message;
    });
  return {
    valid: requireBoolean(record, 'valid', label),
    errors: parseMessages('errors'),
    warnings: parseMessages('warnings'),
    nodeCount: requireNonNegativeInteger(record, 'nodeCount', label),
    edgeCount: requireNonNegativeInteger(record, 'edgeCount', label),
  };
}

function parseWorkflowVersion(value: unknown, label: string): WorkflowDefinitionVersionDTO {
  const record = requireApiRecord(value, label);
  return {
    id: requirePositiveInteger(record, 'id', label),
    definitionId: requirePositiveInteger(record, 'definitionId', label),
    businessType: requireNonBlankString(record, 'businessType', label),
    version: requirePositiveInteger(record, 'version', label),
    actionType: requireNonBlankString(record, 'actionType', label),
    status: requireNonBlankString(record, 'status', label),
    name: requireString(record, 'name', label),
    description: readOptionalString(record, 'description', label),
    definition: readNullableApiRecord(record, 'definition', label) ?? undefined,
    publishNote: readOptionalString(record, 'publishNote', label),
    impactScope: readOptionalString(record, 'impactScope', label),
    rollbackPlan: readOptionalString(record, 'rollbackPlan', label),
    rollbackSourceVersion: readNullableNonNegativeInteger(record, 'rollbackSourceVersion', label),
    operatorId: readOptionalPositiveInteger(record, 'operatorId', label),
    publishedAt: readOptionalString(record, 'publishedAt', label),
    createTime: readOptionalString(record, 'createTime', label),
  };
}

export const flowDesignerApi = {
  listDefinitions: (): Promise<FlowDesignerDefinitionDTO[]> =>
    decodeUnwrappedResponse(http.get<unknown>('/workflows'), '流程定义列表', (value, label) =>
      requireApiArray(value, label).map((item, index) => parseFlowDesignerDefinition(item, `${label}[${index}]`))),

  getDesigner: (businessType: string): Promise<FlowDesignerDefinitionDTO> =>
    decodeUnwrappedResponse(http.get<unknown>(workflowPath(businessType, '/designer')), '流程设计器草稿', parseFlowDesignerDefinition),

  saveDraft: (businessType: string, payload: FlowDesignerDraftPayload): Promise<FlowDesignerDefinitionDTO> =>
    decodeUnwrappedResponse(http.put<unknown>(workflowPath(businessType, '/designer/draft'), {
      ...payload,
      operatorId: getStoredOperatorId(),
    }), '流程设计器草稿保存', parseFlowDesignerDefinition),

  validateGraph: (businessType: string, graph: FlowDesignerGraphDTO): Promise<FlowDesignerValidationResult> =>
    decodeUnwrappedResponse(http.post<unknown>(workflowPath(businessType, '/designer/validate'), graph), '流程图校验', parseValidationResult),

  publish: (businessType: string, payload: FlowDesignerOperationPayload): Promise<FlowDesignerDefinitionDTO> =>
    decodeUnwrappedResponse(http.post<unknown>(workflowPath(businessType, '/publish'), {
      ...payload,
      operatorId: getStoredOperatorId(),
    }), '流程设计器发布', parseFlowDesignerDefinition),

  listVersions: (businessType: string): Promise<WorkflowDefinitionVersionDTO[]> =>
    decodeUnwrappedResponse(http.get<unknown>(workflowPath(businessType, '/versions')), '流程版本列表', (value, label) =>
      requireApiArray(value, label).map((item, index) => parseWorkflowVersion(item, `${label}[${index}]`))),

  rollback: (businessType: string, version: number, payload: FlowDesignerOperationPayload): Promise<FlowDesignerDefinitionDTO> =>
    decodeUnwrappedResponse(http.post<unknown>(workflowPath(businessType, `/versions/${version}/rollback`), {
      ...payload,
      operatorId: getStoredOperatorId(),
    }), '流程设计器回滚', parseFlowDesignerDefinition),
};
