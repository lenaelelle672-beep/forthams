import { api } from '../app/utils/api';

export interface WorkflowDefinitionNode {
  id?: string;
  name?: string;
  type?: string;
  [key: string]: unknown;
}

export interface WorkflowDefinitionEdge {
  id?: string;
  source?: string;
  target?: string;
  [key: string]: unknown;
}

export interface WorkflowDefinitionShape {
  id?: string;
  name?: string;
  description?: string;
  nodes?: WorkflowDefinitionNode[];
  edges?: WorkflowDefinitionEdge[];
  [key: string]: unknown;
}

export interface WorkflowDefinitionRecord {
  id?: number;
  businessType: string;
  name: string;
  description?: string | null;
  definition?: WorkflowDefinitionShape | null;
  status?: string | null;
  version?: number | null;
  updatedBy?: number | null;
  updateTime?: string | null;
}

const WORKFLOW_DEFINITIONS_BASE = '/workflows';

export function listWorkflowDefinitions() {
  return api.get<WorkflowDefinitionRecord[]>(WORKFLOW_DEFINITIONS_BASE);
}

export function getWorkflowDefinition(businessType: string) {
  return api.get<WorkflowDefinitionRecord>(`${WORKFLOW_DEFINITIONS_BASE}/${encodeURIComponent(businessType)}`);
}
