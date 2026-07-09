/**
 * @file types/notificationTemplate.ts
 * @description 通知模板 & 用户偏好类型定义
 */

/** 通知模板 */
export interface NotificationTemplate {
  id: number;
  tenantId?: string;
  templateCode: string;
  templateName: string;
  category?: string;
  channelType: string;
  titleTemplate: string;
  contentTemplate: string;
  variables?: string;
  isBuiltin?: number;
  status: number;
  createBy?: string;
  createTime?: string;
  updateBy?: string;
  updateTime?: string;
}

/** 创建通知模板请求 */
export interface CreateNotificationTemplateRequest {
  templateCode: string;
  templateName: string;
  category?: string;
  channelType?: string;
  titleTemplate: string;
  contentTemplate: string;
  variables?: string;
  status?: number;
}

/** 更新通知模板请求 */
export interface UpdateNotificationTemplateRequest {
  templateName?: string;
  category?: string;
  channelType?: string;
  titleTemplate?: string;
  contentTemplate?: string;
  variables?: string;
  status?: number;
}

/** 用户通知偏好 */
export interface NotificationPreference {
  id?: number;
  tenantId?: string;
  userId?: number;
  category: string;
  categoryLabel?: string;
  inApp: number;
  email: number;
  quietStart?: string;
  quietEnd?: string;
  status?: number;
  missingPreference?: boolean;
  tenantScoped?: boolean;
  readonlyBoundary?: string;
  createTime?: string;
  updateTime?: string;
}

export interface NotificationPreferenceMetaOption {
  value: string;
  label: string;
}

export interface NotificationPreferenceQuietWindowPolicy {
  format: string;
  crossMidnightSupported: boolean;
  examples?: string[];
}

export interface NotificationPreferencePreviewPolicy {
  tenantScoped: boolean;
  noPersistence: boolean;
  noSend: boolean;
  runtimeEffect: false;
  rejectedInputFields?: string[];
}

export interface NotificationPreferenceMeta {
  categories: NotificationPreferenceMetaOption[];
  channelTypes: NotificationPreferenceMetaOption[];
  statuses: NotificationPreferenceMetaOption[];
  quietWindowPolicy: NotificationPreferenceQuietWindowPolicy;
  previewPolicy: NotificationPreferencePreviewPolicy;
  reservedCategoryWords?: string[];
  tenantScoped?: boolean;
  readOnly?: boolean;
  noPersistencePreview?: boolean;
  runtimeEffect: false;
  readonlyBoundary?: string;
  nonGoals?: string[];
}

export interface NotificationPreferencePreviewRequest {
  category?: string;
  channelType?: 'ALL' | 'IN_APP' | 'EMAIL';
  sampleTime?: string;
  quietStart?: string;
  quietEnd?: string;
}

export interface RejectedPreferencePreviewInput {
  field: string;
  reason: string;
}

export interface NotificationPreferencePreviewResponse {
  wouldReceive: boolean;
  inAppEnabled: boolean;
  emailEnabled: boolean;
  quietWindowMatched: boolean;
  missingPreferences: string[];
  rejectedInputs: RejectedPreferencePreviewInput[];
  tenantScoped: boolean;
  noPersistence: true;
  runtimeEffect: false;
  readonlyBoundary: string;
}

export interface NotificationBizSwitchMetaOption {
  value: string;
  label: string;
}

export interface NotificationBizSwitchPreviewPolicy {
  tenantScoped: boolean;
  noPersistence: boolean;
  noSend: boolean;
  workflowRuntimeEffect: false;
  rejectedInputFields?: string[];
  readonlyBoundary?: string;
}

export interface NotificationBizSwitchMeta {
  bizTypes: NotificationBizSwitchMetaOption[];
  events: NotificationBizSwitchMetaOption[];
  channelTypes: NotificationBizSwitchMetaOption[];
  statuses: NotificationBizSwitchMetaOption[];
  previewPolicy: NotificationBizSwitchPreviewPolicy;
  tenantScoped?: boolean;
  readOnly?: boolean;
  noPersistencePreview?: boolean;
  noSend?: boolean;
  workflowRuntimeEffect: false;
  readonlyBoundary?: string;
  nonGoals?: string[];
}

export interface NotificationBizSwitchPreviewRequest {
  bizType?: string;
  event?: string;
  channelType?: string;
  enabled?: number;
  [key: string]: unknown;
}

export interface RejectedNotificationBizSwitchInput {
  field: string;
  reason: string;
}

export interface NotificationBizSwitchPreviewResponse {
  wouldNotify: boolean;
  blockedBySwitch: boolean;
  matchedSwitches: NotificationBizSwitch[];
  missingSwitches: string[];
  rejectedInputs: RejectedNotificationBizSwitchInput[];
  tenantScoped: boolean;
  noPersistence: true;
  noSend: true;
  workflowRuntimeEffect: false;
  readonlyBoundary: string;
}

/** 分页响应（与 mailTemplate 保持一致） */
export interface PageResponse<T> {
  records: T[];
  total: number;
  size: number;
  current: number;
  pages: number;
  tenantScoped?: boolean;
  readonlyBoundary?: string;
}

export interface NotificationTemplateMetaOption {
  value: string;
  label: string;
}

export interface NotificationTemplatePreviewVariablePolicy {
  htmlEscaped: boolean;
  whitelistOnly: boolean;
  nonPersistent: boolean;
  sensitiveVariableNames: string[];
  examples?: string[];
}

export interface NotificationTemplateMeta {
  categories: NotificationTemplateMetaOption[];
  channelTypes: NotificationTemplateMetaOption[];
  statuses: NotificationTemplateMetaOption[];
  previewVariablePolicy: NotificationTemplatePreviewVariablePolicy;
  tenantScoped?: boolean;
  readonlyBoundary?: string;
  nonGoals?: string[];
}

export interface NotificationTemplatePreviewRequest {
  templateId?: number;
  templateCode?: string;
  titleTemplate?: string;
  contentTemplate?: string;
  variables: Record<string, string>;
}

export interface RejectedPreviewVariable {
  name: string;
  reason: string;
}

export interface NotificationTemplatePreviewResponse {
  renderedTitle: string;
  renderedContent: string;
  missingVariables: string[];
  rejectedVariables: RejectedPreviewVariable[];
  usedVariables: string[];
  nonPersistent: true;
  htmlEscaped?: boolean;
  tenantScoped?: boolean;
  readonlyBoundary?: string;
}

/** 通知分类选项 */
export const NOTIFICATION_CATEGORIES: Record<string, string> = {
  retirement: '退休/报废',
  maintenance: '维保',
  approval: '审批',
  system: '系统',
  general: '通用',
};

/** 通知渠道选项 */
export const CHANNEL_TYPE_OPTIONS: { value: string; label: string }[] = [
  { value: 'ALL', label: '全部渠道' },
  { value: 'IN_APP', label: '仅站内信' },
  { value: 'EMAIL', label: '仅邮件' },
];

export const CHANNEL_TYPE_LABELS: Record<string, string> = {
  ALL: '全部渠道',
  IN_APP: '站内信',
  EMAIL: '邮件',
};

// ---------------------------------------------------------------------------
// 以下为向后兼容导出（供旧的 NotificationBizSwitchTab.tsx 使用）
// ---------------------------------------------------------------------------

/** 流程通知开关（旧 V2_3 表兼容） */
export interface NotificationBizSwitch {
  id: number;
  tenantId?: string;
  bizType: string;
  event: string;
  channelType?: string;
  enabled: number;
  templateCode?: string;
  description?: string;
  tenantScoped?: boolean;
  readonlyBoundary?: string;
  createTime?: string;
  updateTime?: string;
}

/** 业务类型标签映射 */
export const BIZ_TYPE_LABELS: Record<string, string> = {
  retirement: '退休/报废',
  maintenance: '维保',
  approval: '审批',
  system: '系统',
};
