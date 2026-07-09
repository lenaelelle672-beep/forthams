/**
 * @file api/mailTemplate.ts
 * @description 邮件模板 & 发送日志 API 服务
 *
 * API Endpoints:
 *   GET    /mail-templates/list          — 分页查询模板
 *   GET    /mail-templates/{id}          — 模板详情
 *   GET    /mail-templates/code/{code}   — 按编码查询
 *   GET    /mail-templates/meta          — 模板元数据
 *   POST   /mail-templates/preview       — 无持久化安全预览
 *   POST   /mail-templates               — 创建模板
 *   PUT    /mail-templates/{id}          — 更新模板
 *   DELETE /mail-templates/{id}          — 删除模板
 *   GET    /mail-logs/list               — 分页查询日志
 *   GET    /mail-logs/{id}               — 日志详情
 *   GET    /mail-logs/biz                — 按业务查询
 *   GET    /mail-logs/meta               — 日志筛选元数据
 *   POST   /mail-logs/{id}/retry         — 重试发送
 */

import http from '@/utils/http';
import type {
  MailTemplate,
  CreateMailTemplateRequest,
  UpdateMailTemplateRequest,
  MailLog,
  MailLogMeta,
  PageResponse,
  MailTemplateMeta,
  MailTemplatePreviewRequest,
  MailTemplatePreviewResponse,
} from '@/types/mailTemplate';

export const mailTemplateApi = {
  /** 分页查询邮件模板 */
  list(params?: { page?: number; pageSize?: number; category?: string; keyword?: string }) {
    return http.get<PageResponse<MailTemplate>>('/mail-templates/list', { params });
  },

  /** 模板详情 */
  getById(id: number) {
    return http.get<MailTemplate>(`/mail-templates/${id}`);
  },

  /** 按编码查询 */
  getByCode(code: string) {
    return http.get<MailTemplate>(`/mail-templates/code/${code}`);
  },

  /** 模板 catalog 元数据 */
  meta() {
    return http.get<MailTemplateMeta>('/mail-templates/meta');
  },

  /** 无持久化安全预览 */
  preview(data: MailTemplatePreviewRequest) {
    return http.post<MailTemplatePreviewResponse>('/mail-templates/preview', data);
  },

  /** 创建模板 */
  create(data: CreateMailTemplateRequest) {
    return http.post<MailTemplate>('/mail-templates', data);
  },

  /** 更新模板 */
  update(id: number, data: UpdateMailTemplateRequest) {
    return http.put<MailTemplate>(`/mail-templates/${id}`, data);
  },

  /** 删除模板 */
  delete(id: number) {
    return http.delete<void>(`/mail-templates/${id}`);
  },
};

export const mailLogApi = {
  /** 分页查询发送日志 */
  list(params?: { page?: number; pageSize?: number; templateCode?: string; sendStatus?: string; bizType?: string; bizId?: number }) {
    return http.get<PageResponse<MailLog>>('/mail-logs/list', { params });
  },

  /** 日志详情 */
  getById(id: number) {
    return http.get<MailLog>(`/mail-logs/${id}`);
  },

  /** 按业务查询 */
  getByBiz(bizType: string, bizId: number) {
    return http.get<MailLog[]>('/mail-logs/biz', { params: { bizType, bizId } });
  },

  /** 日志只读元数据 */
  meta() {
    return http.get<MailLogMeta>('/mail-logs/meta');
  },

  /** 重试发送 */
  retry(id: number) {
    return http.post<void>(`/mail-logs/${id}/retry`);
  },
};
