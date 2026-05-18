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

function getCurrentOperatorId() {
  if (typeof window === "undefined") return undefined;
  const rawUser = window.localStorage.getItem("ams_auth_user") || window.localStorage.getItem("auth_user");
  if (!rawUser) return undefined;

  try {
    const user = JSON.parse(rawUser) as { id?: number | string; userId?: number | string };
    const id = user.id ?? user.userId;
    if (id === undefined || id === null || id === "") return undefined;
    const numericId = Number(id);
    return Number.isFinite(numericId) ? numericId : undefined;
  } catch {
    return undefined;
  }
}

/** 工作流定义 API 服务 — 所有接口对接后端 /workflows 端点 */
export const workflowDefinitionService = {
  list() {
    return api.get<WorkflowDefinitionDTO[]>("/workflows");
  },

  get(businessType: string) {
    return api.get<WorkflowDefinitionDTO>(`/workflows/${businessType}`);
  },

  saveDraft(businessType: string, payload: { name: string; description: string; definition: Record<string, unknown> }) {
    return api.put<WorkflowDefinitionDTO>(`/workflows/${businessType}/draft`, {
      ...payload,
      operatorId: getCurrentOperatorId(),
    });
  },

  publish(businessType: string) {
    return api.post<WorkflowDefinitionDTO>(`/workflows/${businessType}/publish`, { operatorId: getCurrentOperatorId() });
  },

  updateStatus(businessType: string, status: "ENABLED" | "DISABLED") {
    return api.post<WorkflowDefinitionDTO>(`/workflows/${businessType}/status`, { status, operatorId: getCurrentOperatorId() });
  },
};
