import { api } from "../utils/api";

export interface WorkflowDefinitionDTO {
  id?: number;
  businessType: string;
  name: string;
  description: string;
  definition: Record<string, unknown>;
  status: "UNCONFIGURED" | "DRAFT" | "PUBLISHED" | "DISABLED";
  version: number;
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

  saveDraft(businessType: string, payload: { name: string; description: string; definition: Record<string, unknown> }) {
    return api.put<WorkflowDefinitionDTO>(`/workflows/${businessType}/draft`, payload);
  },

  publish(businessType: string) {
    return api.post<WorkflowDefinitionDTO>(`/workflows/${businessType}/publish`, {});
  },

  updateStatus(businessType: string, status: "ENABLED" | "DISABLED") {
    return api.post<WorkflowDefinitionDTO>(`/workflows/${businessType}/status`, { status });
  },
};
