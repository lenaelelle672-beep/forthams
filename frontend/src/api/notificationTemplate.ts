/**
 * @file api/notificationTemplate.ts
 * @description 通知模板 & 用户偏好 API 服务
 *
 * API Endpoints:
 *   GET    /notification-templates/list         — 分页查询
 *   GET    /notification-templates/{id}          — 详情
 *   GET    /notification-templates/code/{code}   — 按编码查询
 *   POST   /notification-templates               — 创建
 *   PUT    /notification-templates/{id}          — 更新
 *   DELETE /notification-templates/{id}          — 删除
 *   GET    /notification-preferences             — 用户偏好列表
 *   GET    /notification-preferences/{category}  — 按分类查询
 *   PUT    /notification-preferences             — 保存单条
 *   PUT    /notification-preferences/batch       — 批量保存
 *   DELETE /notification-preferences/{id}        — 删除
 */

import http from '@/utils/http';
import type {
  NotificationTemplate,
  CreateNotificationTemplateRequest,
  UpdateNotificationTemplateRequest,
  NotificationPreference,
  NotificationBizSwitch,
  PageResponse,
} from '@/types/notificationTemplate';

export const notificationTemplateApi = {
  /** 分页查询通知模板 */
  list(params?: { page?: number; pageSize?: number; category?: string; keyword?: string }) {
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

  /** 保存单条偏好 */
  save(data: NotificationPreference) {
    return http.put<NotificationPreference>('/notification-preferences', data);
  },

  /** 批量保存偏好 */
  batchSave(data: NotificationPreference[]) {
    return http.put<void>('/notification-preferences/batch', data);
  },
};

// ---------------------------------------------------------------------------
// 以下为向后兼容 API（供旧的 NotificationBizSwitchTab.tsx 使用）
// ---------------------------------------------------------------------------

/** @deprecated 流程通知开关 API（旧版） */
export const notificationSwitchApi = {
  list() {
    return http.get<NotificationBizSwitch[]>('/notification-biz-switches');
  },
  updateEnabled(id: number, enabled: number) {
    return http.put<void>(`/notification-biz-switches/${id}/enabled`, { enabled });
  },
};
