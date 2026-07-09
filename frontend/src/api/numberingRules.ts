import http from '@/utils/http';

export type NumberingRule = {
  id?: number;
  tenantId?: string;
  ruleKey: string;
  name: string;
  template: string;
  source?: string;
  authority?: string;
  defaultRule?: boolean;
  tenantScoped?: boolean;
  readOnly?: boolean;
  readonlyBoundary?: string;
  variables?: string[];
  updateTime?: string;
};

export type NumberingRuleVariableOption = {
  value: string;
  label: string;
};

export type NumberingRuleMeta = {
  defaultRules: NumberingRule[];
  allowedVariables: NumberingRuleVariableOption[];
  previewPolicy: {
    deterministic: boolean;
    noPersistence: boolean;
    noSequenceReserved: boolean;
    runtimeEffect: boolean;
    cacheRefreshed: boolean;
    sequenceAllocated: boolean;
    persistent: boolean;
    readonlyBoundary?: string;
    rejectedInputFields?: string[];
  };
  tenantScoped: boolean;
  readOnly: boolean;
  noPersistencePreview: boolean;
  noSequenceReserved: boolean;
  runtimeEffect: boolean;
  cacheRefreshed: boolean;
  sequenceAllocated: boolean;
  persistent: boolean;
  authority: string;
  readonlyBoundary: string;
  nonGoals: string[];
};

export type NumberingRulePreviewRequest = {
  ruleKey?: string;
  template?: string;
  sampleAt?: string;
  sampleSequence?: string;
};

export type NumberingRulePreviewResponse = {
  ruleKey?: string;
  template: string;
  previewValue: string;
  usedVariables: string[];
  missingVariables: string[];
  rejectedVariables: string[];
  authority: string;
  warnings: string[];
  tenantScoped: boolean;
  noPersistence: boolean;
  noSequenceReserved: boolean;
  runtimeEffect: boolean;
  cacheRefreshed: boolean;
  sequenceAllocated: boolean;
  persistent: boolean;
  readonlyBoundary: string;
};

export const numberingRulesApi = {
  list() {
    return http.get<NumberingRule[]>('/numbering-rules');
  },
  detail(ruleKey: string) {
    return http.get<NumberingRule>(`/numbering-rules/${encodeURIComponent(ruleKey)}`);
  },
  meta() {
    return http.get<NumberingRuleMeta>('/numbering-rules/meta');
  },
  preview(data: NumberingRulePreviewRequest) {
    return http.post<NumberingRulePreviewResponse>('/numbering-rules/preview', data);
  },
};
