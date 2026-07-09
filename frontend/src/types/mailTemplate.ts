/**
 * @file types/mailTemplate.ts
 * @description 邮件模板 & 发送日志类型定义
 */

/** 邮件模板 */
export interface MailTemplate {
  id: number;
  tenantId?: string;
  templateCode: string;
  templateName: string;
  category?: string;
  subjectTemplate: string;
  contentTemplate: string;
  contentType?: string;
  variables?: string;
  isBuiltin?: number;
  status: number;
  createBy?: string;
  createTime?: string;
  updateBy?: string;
  updateTime?: string;
  tenantScoped?: boolean;
  readonlyBoundary?: string;
}

/** 创建邮件模板请求 */
export interface CreateMailTemplateRequest {
  templateCode: string;
  templateName: string;
  category?: string;
  subjectTemplate: string;
  contentTemplate: string;
  contentType?: string;
  variables?: string;
  status?: number;
}

/** 更新邮件模板请求 */
export interface UpdateMailTemplateRequest {
  templateName?: string;
  category?: string;
  subjectTemplate?: string;
  contentTemplate?: string;
  contentType?: string;
  variables?: string;
  status?: number;
}

/** 邮件发送日志 */
export interface MailLog {
  id: number;
  tenantId?: string;
  templateCode?: string;
  maskedMailFrom?: string;
  maskedMailTo?: string;
  maskedMailCc?: string;
  maskedMailBcc?: string;
  maskedSubject?: string;
  maskedBodySummary?: string;
  sendStatus: string;
  diagnosticSummary?: string;
  retryCount?: number;
  maxRetry?: number;
  bizType?: string;
  bizId?: number;
  sendTime?: string;
  createTime?: string;
  updateTime?: string;
  redacted?: boolean;
  tenantScoped?: boolean;
  readOnly?: boolean;
  readonlyBoundary?: string;
  redactionPolicy?: string[];
  nonGoals?: string[];
  /** @deprecated 仅为旧 settings 页兼容；Workbench V3 只能使用 maskedMailTo。 */
  mailTo?: string;
  /** @deprecated 仅为旧 settings 页兼容；Workbench V3 只能使用 maskedMailCc。 */
  mailCc?: string;
  /** @deprecated 仅为旧 settings 页兼容；Workbench V3 只能使用 maskedMailBcc。 */
  mailBcc?: string;
  /** @deprecated 仅为旧 settings 页兼容；Workbench V3 只能使用 maskedSubject。 */
  subject?: string;
  /** @deprecated 仅为旧 settings 页兼容；Workbench V3 只能使用 contentSummary。 */
  content?: string;
  /** @deprecated 仅为旧 settings 页兼容；Workbench V3 只能使用 diagnosticSummary。 */
  errorMessage?: string;
}

/** 分页响应 */
export interface PageResponse<T> {
  records: T[];
  total: number;
  size: number;
  current: number;
  pages: number;
  tenantScoped?: boolean;
  readonlyBoundary?: string;
  redacted?: boolean;
  readOnly?: boolean;
  redactionPolicy?: string[];
}

export interface MailLogMeta {
  sendStatuses: MailTemplateMetaOption[];
  bizTypes: MailTemplateMetaOption[];
  templateCodes: MailTemplateMetaOption[];
  redactionPolicy: string[];
  nonGoals: string[];
  redacted?: boolean;
  tenantScoped?: boolean;
  readOnly?: boolean;
  collectionGuaranteed?: boolean;
  readonlyBoundary?: string;
}

export interface MailTemplateMetaOption {
  value: string;
  label: string;
}

export interface MailTemplatePreviewVariablePolicy {
  htmlEscaped: boolean;
  whitelistOnly: boolean;
  nonPersistent: boolean;
  sensitiveVariableNames: string[];
  examples?: string[];
}

export interface MailTemplateMeta {
  categories: MailTemplateMetaOption[];
  contentTypes: MailTemplateMetaOption[];
  statuses: MailTemplateMetaOption[];
  previewVariablePolicy: MailTemplatePreviewVariablePolicy;
  tenantScoped?: boolean;
  readonlyBoundary?: string;
  nonGoals?: string[];
}

export interface MailTemplatePreviewRequest {
  templateId?: number;
  templateCode?: string;
  subjectTemplate?: string;
  contentTemplate?: string;
  variables: Record<string, string>;
}

export interface RejectedPreviewVariable {
  name: string;
  reason: string;
}

export interface MailTemplatePreviewResponse {
  renderedSubject: string;
  renderedContent: string;
  missingVariables: string[];
  rejectedVariables: RejectedPreviewVariable[];
  usedVariables: string[];
  nonPersistent: true;
  htmlEscaped?: boolean;
  tenantScoped?: boolean;
  readonlyBoundary?: string;
}

/** 模板分类选项 */
export const TEMPLATE_CATEGORIES: Record<string, string> = {
  retirement: '退休/报废',
  maintenance: '维保',
  approval: '审批',
  general: '通用',
};

/** 发送状态映射 */
export const SEND_STATUS_LABELS: Record<string, string> = {
  PENDING: '待发送',
  SUCCESS: '发送成功',
  FAILED: '发送失败',
};

export const SEND_STATUS_COLORS: Record<string, string> = {
  PENDING: 'bg-amber-100 text-amber-700',
  SUCCESS: 'bg-green-100 text-green-700',
  FAILED: 'bg-red-100 text-red-700',
};
