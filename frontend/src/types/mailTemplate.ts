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
  mailFrom?: string;
  mailTo: string;
  mailCc?: string;
  mailBcc?: string;
  subject?: string;
  content?: string;
  sendStatus: string;
  errorMessage?: string;
  retryCount?: number;
  maxRetry?: number;
  bizType?: string;
  bizId?: number;
  sendTime?: string;
  createTime?: string;
}

/** 分页响应 */
export interface PageResponse<T> {
  records: T[];
  total: number;
  size: number;
  current: number;
  pages: number;
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
