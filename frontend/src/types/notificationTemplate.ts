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
  inApp: number;
  email: number;
  quietStart?: string;
  quietEnd?: string;
  createTime?: string;
  updateTime?: string;
}

/** 分页响应（与 mailTemplate 保持一致） */
export interface PageResponse<T> {
  records: T[];
  total: number;
  size: number;
  current: number;
  pages: number;
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
  bizType: string;
  event: string;
  enabled: number;
  templateCode?: string;
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
