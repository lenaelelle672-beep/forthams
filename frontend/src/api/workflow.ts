import http from '@/utils/http';
import {
  decodeUnwrappedResponse,
  getStoredOperatorId,
  readNullableApiRecord,
  readNullableNonNegativeInteger,
  readNullableString,
  readOptionalNonNegativeInteger,
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

export interface WorkflowDefinitionDTO {
  id?: number;
  businessType: string;
  name: string;
  description: string;
  definition: Record<string, unknown>;
  status: 'UNCONFIGURED' | 'DRAFT' | 'PUBLISHED' | 'DISABLED' | 'ENABLED';
  version: number;
  /** 仅草稿响应携带的 CAS revision；已发布 version 绝不能作为草稿 revision 使用。 */
  draftRevision?: number | null;
  updatedBy?: number;
  publishedBy?: number;
  publishedAt?: string;
  createTime?: string;
  updateTime?: string;
}

export interface WorkflowDesignerDraftDTO extends WorkflowDefinitionDTO {
  /** null 表示不存在草稿编辑基线；0 仅可能是迁移前的真实草稿 revision。 */
  revision: number | null;
  publishedDefinitionId?: number | null;
  publishedVersion?: number | null;
  publishedStatus?: 'PUBLISHED' | 'DISABLED' | string | null;
}

export interface WorkflowDraftSavePayload {
  name: string;
  description: string;
  definition: Record<string, unknown> | null;
  /** null 仅用于首次创建；已有草稿必须传回服务端返回的精确 revision。 */
  expectedRevision: number | null;
}

export interface WorkflowAssigneePreviewRequest {
  definition: Record<string, unknown>;
  businessData?: Record<string, unknown> | string;
}

export interface WorkflowRuntimeAssigneePreviewRequest {
  businessData?: Record<string, unknown> | string;
  currentStep?: number;
}

export interface WorkflowAssigneePreviewResponse {
  businessType: string;
  calculable: boolean;
  reason?: string;
  missingFields: string[];
  nodes: Array<{
    stepNo: number;
    nodeId: string;
    nodeCode?: string;
    label?: string;
    approverType?: string;
    approverRole?: string;
    approverId?: string;
    resolved: boolean;
    assigneeCount?: number;
    reason?: string;
    assignees: Array<{ userId: string }>;
  }>;
}

export interface WorkflowStartAvailability {
  businessType: string;
  canStart: boolean;
  status: 'UNCONFIGURED' | 'DRAFT' | 'PUBLISHED' | 'DISABLED' | string;
  version: number;
  definitionId?: number | null;
  entryUrl: string;
  blockReason: string;
}

export interface WorkflowDefinitionVersionDTO {
  id: number;
  definitionId: number;
  businessType: string;
  version: number;
  actionType: 'PUBLISH' | 'ROLLBACK' | string;
  status: 'PUBLISHED' | string;
  name: string;
  description?: string;
  definition?: Record<string, unknown>;
  publishNote?: string;
  impactScope?: string;
  rollbackPlan?: string;
  rollbackSourceVersion?: number | null;
  operatorId?: number;
  publishedAt?: string;
  createTime?: string;
}

export interface WorkflowPublishPayload {
  /** 发布人审阅到的草稿 revision；服务端拒绝过期值。 */
  expectedDraftRevision: number;
  confirmed?: boolean;
  publishNote?: string;
  impactScope?: string;
  rollbackPlan?: string;
}

export interface WorkflowRollbackPayload {
  /** 有草稿时的审阅 revision；0 只匹配真实的历史 revision=0。 */
  expectedDraftRevision?: number;
  /** 无草稿时必须显式确认该审阅基线，不能以 0 代替。 */
  expectedDraftAbsent?: boolean;
  /** 回滚人审阅到的当前已发布版本，防止陈旧回滚。 */
  expectedPublishedVersion: number;
  confirmed?: boolean;
  reason?: string;
  impactScope?: string;
  rollbackPlan?: string;
}

function parseWorkflowStatus(value: unknown, label: string): WorkflowDefinitionDTO['status'] {
  switch (value) {
    case 'UNCONFIGURED':
    case 'DRAFT':
    case 'PUBLISHED':
    case 'DISABLED':
    case 'ENABLED':
      return value;
    default:
      throw new Error(`${label}响应中的status无效`);
  }
}

function parseWorkflowDefinition(value: unknown, label: string): WorkflowDefinitionDTO {
  const record = requireApiRecord(value, label);
  return {
    id: readOptionalPositiveInteger(record, 'id', label),
    businessType: requireNonBlankString(record, 'businessType', label),
    name: requireString(record, 'name', label),
    description: requireString(record, 'description', label),
    definition: requireApiRecord(record.definition, `${label}响应中的definition`),
    status: parseWorkflowStatus(record.status, label),
    version: requireNonNegativeInteger(record, 'version', label),
    draftRevision: readNullableNonNegativeInteger(record, 'draftRevision', label),
    updatedBy: readOptionalPositiveInteger(record, 'updatedBy', label),
    publishedBy: readOptionalPositiveInteger(record, 'publishedBy', label),
    publishedAt: readOptionalString(record, 'publishedAt', label),
    createTime: readOptionalString(record, 'createTime', label),
    updateTime: readOptionalString(record, 'updateTime', label),
  };
}

function parseWorkflowDesignerDraft(value: unknown, label: string): WorkflowDesignerDraftDTO {
  const record = requireApiRecord(value, label);
  const definition = parseWorkflowDefinition(record, label);
  return {
    ...definition,
    revision: readNullableNonNegativeInteger(record, 'revision', label),
    publishedDefinitionId: readOptionalPositiveInteger(record, 'publishedDefinitionId', label) ?? null,
    publishedVersion: readOptionalNonNegativeInteger(record, 'publishedVersion', label) ?? null,
    publishedStatus: readNullableString(record, 'publishedStatus', label),
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

function parseAssigneePreview(value: unknown, label: string): WorkflowAssigneePreviewResponse {
  const record = requireApiRecord(value, label);
  const nodes = requireApiArray(record.nodes, `${label}响应中的nodes`).map((node, index) => {
    const nodeRecord = requireApiRecord(node, `${label}响应中的nodes[${index}]`);
    const assignees = requireApiArray(nodeRecord.assignees, `${label}响应中的nodes[${index}].assignees`)
      .map((assignee, assigneeIndex) => {
        const assigneeRecord = requireApiRecord(
          assignee,
          `${label}响应中的nodes[${index}].assignees[${assigneeIndex}]`,
        );
        return { userId: requireNonBlankString(assigneeRecord, 'userId', label) };
      });
    return {
      stepNo: requireNonNegativeInteger(nodeRecord, 'stepNo', label),
      nodeId: requireNonBlankString(nodeRecord, 'nodeId', label),
      nodeCode: readOptionalString(nodeRecord, 'nodeCode', label),
      label: readOptionalString(nodeRecord, 'label', label),
      approverType: readOptionalString(nodeRecord, 'approverType', label),
      approverRole: readOptionalString(nodeRecord, 'approverRole', label),
      approverId: readOptionalString(nodeRecord, 'approverId', label),
      resolved: requireBoolean(nodeRecord, 'resolved', label),
      assigneeCount: readOptionalNonNegativeInteger(nodeRecord, 'assigneeCount', label),
      reason: readOptionalString(nodeRecord, 'reason', label),
      assignees,
    };
  });
  return {
    businessType: requireNonBlankString(record, 'businessType', label),
    calculable: requireBoolean(record, 'calculable', label),
    reason: readOptionalString(record, 'reason', label),
    missingFields: requireApiArray(record.missingFields, `${label}响应中的missingFields`).map((field, index) => {
      if (typeof field !== 'string') {
        throw new Error(`${label}响应中的missingFields[${index}]无效`);
      }
      return field;
    }),
    nodes,
  };
}

function parseStartAvailability(value: unknown, label: string): WorkflowStartAvailability {
  const record = requireApiRecord(value, label);
  return {
    businessType: requireNonBlankString(record, 'businessType', label),
    canStart: requireBoolean(record, 'canStart', label),
    status: requireNonBlankString(record, 'status', label),
    version: requireNonNegativeInteger(record, 'version', label),
    definitionId: readOptionalPositiveInteger(record, 'definitionId', label) ?? null,
    entryUrl: requireString(record, 'entryUrl', label),
    blockReason: requireString(record, 'blockReason', label),
  };
}

function parseRole(value: unknown, label: string): RoleRecord {
  const record = requireApiRecord(value, label);
  const role: RoleRecord = { ...record, id: requirePositiveInteger(record, 'id', label) };
  const roleCode = readOptionalString(record, 'roleCode', label);
  const roleName = readOptionalString(record, 'roleName', label);
  if (roleCode !== undefined) {
    role.roleCode = roleCode;
  }
  if (roleName !== undefined) {
    role.roleName = roleName;
  }
  return role;
}

function parseUser(value: unknown, label: string): UserRecord {
  const record = requireApiRecord(value, label);
  const user: UserRecord = { ...record, id: requirePositiveInteger(record, 'id', label) };
  const username = readOptionalString(record, 'username', label);
  const realName = readOptionalString(record, 'realName', label);
  const phone = readOptionalString(record, 'phone', label);
  if (username !== undefined) {
    user.username = username;
  }
  if (realName !== undefined) {
    user.realName = realName;
  }
  if (phone !== undefined) {
    user.phone = phone;
  }
  return user;
}

function parseVoid(value: unknown, label: string): void {
  if (value !== null && value !== undefined) {
    throw new Error(`${label}响应格式无效`);
  }
}

export const workflowApi = {
  list: (): Promise<WorkflowDefinitionDTO[]> =>
    decodeUnwrappedResponse(http.get<unknown>('/workflows'), '流程列表', (value, label) =>
      requireApiArray(value, label).map((item, index) => parseWorkflowDefinition(item, `${label}[${index}]`))),

  get: (businessType: string): Promise<WorkflowDefinitionDTO> =>
    decodeUnwrappedResponse(http.get<unknown>(`/workflows/${businessType}`), '流程定义', parseWorkflowDefinition),

  getDesignerDraft: (businessType: string): Promise<WorkflowDesignerDraftDTO> =>
    decodeUnwrappedResponse(http.get<unknown>(`/workflows/${businessType}/designer`), '流程草稿', parseWorkflowDesignerDraft),

  saveDraft: (businessType: string, payload: WorkflowDraftSavePayload): Promise<WorkflowDefinitionDTO> =>
    decodeUnwrappedResponse(http.put<unknown>(`/workflows/${businessType}/draft`, {
      ...payload,
      operatorId: getStoredOperatorId(),
    }), '流程草稿保存', parseWorkflowDefinition),

  publish: (businessType: string, payload: WorkflowPublishPayload): Promise<WorkflowDefinitionDTO> =>
    decodeUnwrappedResponse(http.post<unknown>(`/workflows/${businessType}/publish`, {
      confirmed: true,
      ...payload,
      operatorId: getStoredOperatorId(),
    }), '流程发布', parseWorkflowDefinition),

  updateStatus: (businessType: string, status: string): Promise<WorkflowDefinitionDTO> =>
    decodeUnwrappedResponse(http.post<unknown>(`/workflows/${businessType}/status`, {
      status,
      operatorId: getStoredOperatorId(),
    }), '流程状态更新', parseWorkflowDefinition),

  listVersions: (businessType: string): Promise<WorkflowDefinitionVersionDTO[]> =>
    decodeUnwrappedResponse(http.get<unknown>(`/workflows/${businessType}/versions`), '流程版本列表', (value, label) =>
      requireApiArray(value, label).map((item, index) => parseWorkflowVersion(item, `${label}[${index}]`))),

  getVersion: (businessType: string, version: number): Promise<WorkflowDefinitionVersionDTO> =>
    decodeUnwrappedResponse(http.get<unknown>(`/workflows/${businessType}/versions/${version}`), '流程版本', parseWorkflowVersion),

  rollback: (businessType: string, version: number, payload: WorkflowRollbackPayload): Promise<WorkflowDefinitionDTO> =>
    decodeUnwrappedResponse(http.post<unknown>(`/workflows/${businessType}/versions/${version}/rollback`, {
      confirmed: true,
      ...payload,
      operatorId: getStoredOperatorId(),
    }), '流程回滚', parseWorkflowDefinition),

  previewAssignees: (businessType: string, payload: WorkflowAssigneePreviewRequest): Promise<WorkflowAssigneePreviewResponse> =>
    decodeUnwrappedResponse(http.post<unknown>(`/workflows/${businessType}/assignees/preview`, payload), '流程处理人预览', parseAssigneePreview),

  getStartAvailability: (businessType: string): Promise<WorkflowStartAvailability> =>
    decodeUnwrappedResponse(http.get<unknown>(`/workflow-runtime/${businessType}/start-availability`), '流程发起可用性', parseStartAvailability),

  previewRuntimeAssignees: (businessType: string, payload: WorkflowRuntimeAssigneePreviewRequest = {}): Promise<WorkflowAssigneePreviewResponse> =>
    decodeUnwrappedResponse(http.post<unknown>(`/workflow-runtime/${businessType}/assignees/preview`, payload), '运行时处理人预览', parseAssigneePreview),

  createCustomWorkflow: (businessType: string, name: string, description: string): Promise<WorkflowDefinitionDTO> =>
    decodeUnwrappedResponse(http.post<unknown>('/workflows/custom', {
      businessType,
      name,
      description,
      operatorId: getStoredOperatorId(),
    }), '自定义流程创建', parseWorkflowDefinition),

  delete: (businessType: string): Promise<void> =>
    decodeUnwrappedResponse(http.delete<unknown>(`/workflows/${businessType}`), '流程删除', parseVoid),
};

export interface RoleRecord {
  id: number;
  roleCode?: string;
  roleName?: string;
  [key: string]: unknown;
}

export const roleApi = {
  getAll: (): Promise<RoleRecord[]> =>
    decodeUnwrappedResponse(http.get<unknown>('/roles/all'), '角色列表', (value, label) =>
      requireApiArray(value, label).map((item, index) => parseRole(item, `${label}[${index}]`))),
};

export interface UserRecord {
  id: number;
  username?: string;
  realName?: string;
  phone?: string;
  [key: string]: unknown;
}

export const userApi = {
  search: (keyword?: string): Promise<UserRecord[]> =>
    decodeUnwrappedResponse(http.get<unknown>('/users/search', { params: keyword ? { keyword } : {} }), '用户搜索', (value, label) =>
      requireApiArray(value, label).map((item, index) => parseUser(item, `${label}[${index}]`))),
  getById: (id: string | number): Promise<UserRecord> =>
    decodeUnwrappedResponse(http.get<unknown>(`/users/${id}`), '用户详情', parseUser),
};
