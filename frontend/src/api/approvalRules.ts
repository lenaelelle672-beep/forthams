import http from '@/utils/http';

export type ApprovalRuleStatus = 'ACTIVE' | 'DISABLED' | string;

export interface ApprovalRule {
  id: number;
  processKey: string;
  businessType?: string | null;
  nodeKey: string;
  ruleName: string;
  priority: number;
  conditionExpression?: string | null;
  conditionSummary?: string | null;
  approverStrategy?: string | null;
  approverSummary?: string | null;
  status: ApprovalRuleStatus;
  auditSummary?: string | null;
  enabledBy?: number | null;
  enabledAt?: string | null;
  disabledBy?: number | null;
  disabledAt?: string | null;
  disabledReason?: string | null;
  createTime?: string | null;
  updateTime?: string | null;
}

export interface ApprovalRuleQuery {
  processKey?: string;
  nodeKey?: string;
  status?: ApprovalRuleStatus;
  keyword?: string;
}

export interface ApprovalRuleSavePayload {
  processKey: string;
  businessType?: string;
  nodeKey: string;
  ruleName: string;
  priority: number;
  conditionExpression: string;
  approverStrategy: string;
  status?: ApprovalRuleStatus;
  reason?: string;
  auditEvidence?: string;
}

export interface ApprovalRuleOperationPayload {
  confirmed: true;
  reason?: string;
  auditEvidence?: string;
  impactScope?: string;
}

export interface ApprovalRuleSimulationPayload {
  processKey: string;
  businessType?: string;
  nodeKey: string;
  context: Record<string, unknown>;
  reason?: string;
  auditEvidence?: string;
}

export interface ApprovalRuleSimulationResult {
  processKey: string;
  businessType?: string;
  nodeKey: string;
  matchedRuleIds: number[];
  matchedRules: ApprovalRule[];
  safeExplanation: string;
  approverSummary?: string | null;
  warnings: string[];
  auditSummary?: string | null;
  tenantScoped?: boolean;
  simulatedAt?: string | null;
}

export interface ApprovalRuleConflict {
  ruleId?: number;
  conflictRuleId?: number;
  processKey?: string;
  nodeKey?: string;
  priority?: number;
  conditionSummary?: string;
  conflictSummary: string;
  severity?: string;
  auditSummary?: string | null;
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

const APPROVAL_RULES_BASE = '/approval-rules';
const approvalRulePath = (ruleId: number | string, suffix = '') => `${APPROVAL_RULES_BASE}/${encodeURIComponent(String(ruleId))}${suffix}`;

export const approvalRulesApi = {
  listApprovalRules: (query?: ApprovalRuleQuery) =>
    http.get<ApprovalRule[]>(APPROVAL_RULES_BASE, { params: query }),

  getApprovalRule: (ruleId: number | string) =>
    http.get<ApprovalRule>(approvalRulePath(ruleId)),

  createApprovalRule: (payload: ApprovalRuleSavePayload) =>
    http.post<ApprovalRule>(APPROVAL_RULES_BASE, {
      ...payload,
      operatorId: getOperatorId(),
    }),

  updateApprovalRule: (ruleId: number | string, payload: ApprovalRuleSavePayload) =>
    http.put<ApprovalRule>(approvalRulePath(ruleId), {
      ...payload,
      operatorId: getOperatorId(),
    }),

  enableApprovalRule: (ruleId: number | string, payload: ApprovalRuleOperationPayload) =>
    http.post<ApprovalRule>(approvalRulePath(ruleId, '/enable'), {
      ...payload,
      operatorId: getOperatorId(),
    }),

  disableApprovalRule: (ruleId: number | string, payload: ApprovalRuleOperationPayload) =>
    http.post<ApprovalRule>(approvalRulePath(ruleId, '/disable'), {
      ...payload,
      operatorId: getOperatorId(),
    }),

  simulateApprovalRules: (payload: ApprovalRuleSimulationPayload) =>
    http.post<ApprovalRuleSimulationResult>(`${APPROVAL_RULES_BASE}/simulate`, {
      ...payload,
      operatorId: getOperatorId(),
    }),

  detectApprovalRuleConflicts: (payload: ApprovalRuleSimulationPayload) =>
    http.post<ApprovalRuleConflict[]>(`${APPROVAL_RULES_BASE}/conflicts`, {
      ...payload,
      operatorId: getOperatorId(),
    }),
};
