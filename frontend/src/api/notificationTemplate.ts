/**
 * @file api/notificationTemplate.ts
 * @description 通知模板 & 用户偏好 API 服务
 *
 * API Endpoints:
 *   GET    /notification-templates/list         — 分页查询
 *   GET    /notification-templates/{id}          — 详情
 *   GET    /notification-templates/code/{code}   — 按编码查询
 *   GET    /notification-templates/meta          — 模板元数据
 *   POST   /notification-templates/preview       — 无持久化安全预览
 *   POST   /notification-templates               — 创建
 *   PUT    /notification-templates/{id}          — 更新
 *   DELETE /notification-templates/{id}          — 删除
 *   GET    /notification-preferences             — 用户偏好列表
 *   GET    /notification-preferences/{category}  — 按分类查询
 *   GET    /notification-preferences/meta        — 偏好只读元数据
 *   POST   /notification-preferences/preview     — 无持久化偏好决策预览
 *   PUT    /notification-preferences             — 旧兼容保存单条
 *   PUT    /notification-preferences/batch       — 旧兼容批量保存
 *   GET    /notification-switches/list           — 流程通知开关列表
 *   GET    /notification-switches/biz-type/{type} — 按业务类型查询流程通知开关
 *   GET    /notification-switches/meta           — 流程通知开关只读元数据
 *   POST   /notification-switches/preview        — 流程通知开关无持久化预览
 *   PUT    /notification-switches/{id}           — 更新流程通知开关启停
 */

import http from '@/utils/http';
import type {
  NotificationTemplate,
  CreateNotificationTemplateRequest,
  UpdateNotificationTemplateRequest,
  NotificationPreference,
  NotificationBizSwitch,
  PageResponse,
  NotificationTemplateMeta,
  NotificationTemplatePreviewRequest,
  NotificationTemplatePreviewResponse,
  NotificationPreferenceMeta,
  NotificationPreferencePreviewRequest,
  NotificationPreferencePreviewResponse,
  NotificationBizSwitchMeta,
  NotificationBizSwitchPreviewRequest,
  NotificationBizSwitchPreviewResponse,
} from '@/types/notificationTemplate';

export const notificationTemplateApi = {
  /** 分页查询通知模板 */
  list(params?: { page?: number; pageSize?: number; category?: string; channelType?: string; status?: number; keyword?: string }) {
    return http.get<PageResponse<NotificationTemplate>>('/notification-templates/list', { params });
  },

  /** 模板详情 */
  getById(id: number) {
    return http.get<NotificationTemplate>(`/notification-templates/${id}`);
  },

  /** 按编码查询 */
  getByCode(code: string) {
    return http.get<NotificationTemplate>(`/notification-templates/code/${code}`);
  },

  /** 模板 catalog 元数据 */
  meta() {
    return http.get<NotificationTemplateMeta>('/notification-templates/meta');
  },

  /** 无持久化安全预览 */
  preview(data: NotificationTemplatePreviewRequest) {
    return http.post<NotificationTemplatePreviewResponse>('/notification-templates/preview', data);
  },

  /** 创建模板 */
  create(data: CreateNotificationTemplateRequest) {
    return http.post<NotificationTemplate>('/notification-templates', data);
  },

  /** 更新模板 */
  update(id: number, data: UpdateNotificationTemplateRequest) {
    return http.put<NotificationTemplate>(`/notification-templates/${id}`, data);
  },

  /** 删除模板 */
  delete(id: number) {
    return http.delete<void>(`/notification-templates/${id}`);
  },
};

export const notificationPreferenceApi = {
  /** 获取当前用户所有偏好 */
  list() {
    return http.get<NotificationPreference[]>('/notification-preferences');
  },

  /** 获取指定分类偏好 */
  getByCategory(category: string) {
    return http.get<NotificationPreference>(`/notification-preferences/${category}`);
  },

  /** 获取只读偏好目录元数据 */
  meta() {
    return http.get<NotificationPreferenceMeta>('/notification-preferences/meta');
  },

  /** 无持久化偏好决策预览 */
  preview(data: NotificationPreferencePreviewRequest) {
    return http.post<NotificationPreferencePreviewResponse>('/notification-preferences/preview', data);
  },

  /** 保存单条偏好 */
  save(data: NotificationPreference) {
    return http.put<NotificationPreference>('/notification-preferences', data);
  },

  /** 批量保存偏好 */
  batchSave(data: NotificationPreference[]) {
    return http.put<void>('/notification-preferences/batch', data);
  },
};

/** 流程通知开关 API */
export const notificationSwitchApi = {
  list() {
    return http.get<NotificationBizSwitch[]>('/notification-switches/list');
  },
  getByBizType(bizType: string) {
    return http.get<NotificationBizSwitch[]>(`/notification-switches/biz-type/${bizType}`);
  },
  meta() {
    return http.get<NotificationBizSwitchMeta>('/notification-switches/meta');
  },
  preview(data: NotificationBizSwitchPreviewRequest) {
    return http.post<NotificationBizSwitchPreviewResponse>('/notification-switches/preview', data);
  },
  updateEnabled(id: number, enabled: number) {
    return http.put<void>(`/notification-switches/${id}`, null, { params: { enabled } });
  },
};
