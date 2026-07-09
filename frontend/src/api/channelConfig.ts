/**
 * @file api/channelConfig.ts
 * @description 通知渠道配置 API
 *
 * API Endpoints:
 *   GET    /system/channel-configs       — 分页查询
 *   GET    /system/channel-configs/{id}   — 详情
 *   GET    /system/channel-configs/meta  — 只读元数据
 *   POST   /system/channel-configs/preview — 无持久化、无发送预览
 *   POST   /system/channel-configs        — 旧兼容创建 helper
 *   PUT    /system/channel-configs/{id}   — 旧兼容更新 helper
 *   DELETE /system/channel-configs/{id}   — 旧兼容删除 helper
 *   POST   /system/channel-configs/{channelType}/test — 旧兼容测试 helper，Workbench V3 不调用
 */

import http from '@/utils/http';

export interface ChannelConfig {
  id: number;
  channelType: string;
  configName: string;
  webhookUrlMasked?: string;
  webhookUrlConfigured?: boolean;
  signatureConfigured?: boolean;
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
  page?: number;
  pageSize?: number;
  current?: number;
  size?: number;
  pages?: number;
  tenantScoped?: boolean;
  readonlyBoundary?: string;
}

export interface ChannelConfigMetaOption {
  value: string;
  label: string;
}

export interface ChannelConfigMeta {
  channelTypes: ChannelConfigMetaOption[];
  statuses: ChannelConfigMetaOption[];
  previewPolicy: {
    tenantScoped: boolean;
    noPersistence: boolean;
    noSend: boolean;
    runtimeEffect: boolean;
    forbiddenOperations?: string[];
    rejectedInputFields?: string[];
  };
  tenantScoped: boolean;
  readOnly: boolean;
  noPersistencePreview: boolean;
  noSend: boolean;
  runtimeEffect: boolean;
  readonlyBoundary: string;
  nonGoals: string[];
}

export interface ChannelConfigPreviewRequest {
  channelType?: string;
  configName?: string;
  webhookUrlConfigured?: boolean;
  signatureConfigured?: boolean;
  enabled?: number;
  sampleEndpoint?: string;
}

export interface ChannelConfigPreviewResponse {
  channelType?: string;
  configName?: string;
  configured: boolean;
  webhookUrlConfigured: boolean;
  webhookUrlMasked: string;
  signatureConfigured: boolean;
  enabled: number;
  sampleEndpointAccepted: boolean;
  previewAccepted: boolean;
  rejectedInputs: Array<{ field: string; reason: string }>;
  tenantScoped: boolean;
  noPersistence: boolean;
  noSend: boolean;
  runtimeEffect: boolean;
  readonlyBoundary: string;
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

  /** 只读元数据 */
  meta() {
    return http.get<ChannelConfigMeta>('/system/channel-configs/meta');
  },

  /** 无持久化、无发送、无外联预览 */
  preview(data: ChannelConfigPreviewRequest) {
    return http.post<ChannelConfigPreviewResponse>('/system/channel-configs/preview', data);
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
