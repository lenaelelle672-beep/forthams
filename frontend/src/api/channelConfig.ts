/**
 * @file api/channelConfig.ts
 * @description 通知渠道配置 API
 *
 * API Endpoints:
 *   GET    /system/channel-configs       — 分页查询
 *   GET    /system/channel-configs/{id}   — 详情
 *   POST   /system/channel-configs        — 创建
 *   PUT    /system/channel-configs/{id}   — 更新
 *   DELETE /system/channel-configs/{id}   — 删除
 *   POST   /system/channel-configs/{channelType}/test — 发送测试
 */

import http from '@/utils/http';

export interface ChannelConfig {
  id: number;
  channelType: string;
  configName: string;
  webhookUrl: string;
  secret?: string;
  enabled: number;
  description?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateChannelConfigRequest {
  channelType: string;
  configName: string;
  webhookUrl: string;
  secret?: string;
  enabled?: number;
  description?: string;
}

export interface UpdateChannelConfigRequest {
  channelType?: string;
  configName?: string;
  webhookUrl?: string;
  secret?: string;
  enabled?: number;
  description?: string;
}

export interface PageResponse<T> {
  records: T[];
  total: number;
  page: number;
  pageSize: number;
}

export const channelConfigApi = {
  /** 分页查询 */
  list(params?: { page?: number; pageSize?: number; channelType?: string; keyword?: string }) {
    return http.get<PageResponse<ChannelConfig>>('/system/channel-configs', { params });
  },

  /** 详情 */
  getById(id: number) {
    return http.get<ChannelConfig>(`/system/channel-configs/${id}`);
  },

  /** 创建 */
  create(data: CreateChannelConfigRequest) {
    return http.post<ChannelConfig>('/system/channel-configs', data);
  },

  /** 更新 */
  update(id: number, data: UpdateChannelConfigRequest) {
    return http.put<ChannelConfig>(`/system/channel-configs/${id}`, data);
  },

  /** 删除 */
  delete(id: number) {
    return http.delete<void>(`/system/channel-configs/${id}`);
  },

  /** 发送测试消息 */
  test(channelType: string) {
    return http.post<string>(`/system/channel-configs/${channelType}/test`);
  },
};

export const CHANNEL_TYPE_LABELS: Record<string, string> = {
  DINGTALK: '钉钉',
  WECHAT: '企业微信',
  EMAIL: '邮件',
};
