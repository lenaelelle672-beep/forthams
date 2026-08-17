import { api } from "../utils/api";

export interface WorkflowDefinitionDTO {
  id?: number;
  businessType: string;
  name: string;
  description: string;
  definition: Record<string, unknown>;
  status: "UNCONFIGURED" | "DRAFT" | "PUBLISHED" | "DISABLED";
  version: number;
  draftRevision?: number | null;
  revision?: number | null;
  publishedVersion?: number | null;
  updatedBy?: number;
  publishedBy?: number;
  publishedAt?: string;
  createTime?: string;
  updateTime?: string;
}

export const workflowDefinitionService = {
  list() {
    return api.get<WorkflowDefinitionDTO[]>("/workflows");
  },

  get(businessType: string) {
    return api.get<WorkflowDefinitionDTO>(`/workflows/${businessType}`);
  },

  getDesigner(businessType: string) {
    return api.get<WorkflowDefinitionDTO>(`/workflows/${businessType}/designer`);
  },

  saveDraft(businessType: string, payload: {
    name: string;
    description: string;
    definition: Record<string, unknown>;
    expectedRevision: number | null;
  }) {
    return api.put<WorkflowDefinitionDTO>(`/workflows/${businessType}/draft`, payload);
  },

  publish(businessType: string, expectedDraftRevision: number) {
    return api.post<WorkflowDefinitionDTO>(`/workflows/${businessType}/publish`, {
      confirmed: true,
      expectedDraftRevision,
      publishNote: "流程中心发布",
      impactScope: "仅影响后续新发起审批实例",
      rollbackPlan: "通过版本历史恢复至已发布稳定版本",
    });
  },

  updateStatus(businessType: string, status: "ENABLED" | "DISABLED") {
    return api.post<WorkflowDefinitionDTO>(`/workflows/${businessType}/status`, { status });
  },
};
