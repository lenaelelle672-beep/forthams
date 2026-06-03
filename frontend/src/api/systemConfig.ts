/**
 * @file api/systemConfig.ts
 * @description 系统配置 API — 对接 SystemConfigController
 *
 * 替代原有的 localStorage 持久化方案。
 * SYSTEM 分组：公司名称、系统名称、维保预警天数、默认货币、时区、备份频率
 * SECURITY 分组：密码策略、会话设置、双因素认证、操作日志
 */

import http from '@/utils/http';

export interface SysConfigItem {
  id: number;
  tenantId?: string;
  configGroup?: 'SYSTEM' | 'SECURITY' | string;
  configKey: string;
  configValue?: string;
  configName?: string;
  configType?: 'Y' | 'N' | string;
  remark?: string;
  status?: number;
  createTime?: string;
  updateTime?: string;
}

export interface SysConfigPageResult {
  records: SysConfigItem[];
  total: number;
  size: number;
  current: number;
  pages?: number;
}

export interface SysConfigListParams {
  page?: number;
  pageSize?: number;
  configName?: string;
  configKey?: string;
}

export type SysConfigPayload = Partial<Omit<SysConfigItem, 'id' | 'createTime' | 'updateTime'>>;

// ── API ───────────────────────────────────────────────────────────────────────

/** 获取系统配置（SYSTEM 分组） */
export const getSystemConfig = () =>
  http.get<Record<string, string>>('/system-config/system');

/** 保存系统配置（SYSTEM 分组） */
export const saveSystemConfig = (config: Record<string, string>) =>
  http.put<void>('/system-config/system', config);

/** 获取安全配置（SECURITY 分组） */
export const getSecurityConfig = () =>
  http.get<Record<string, string>>('/system-config/security');

/** 保存安全配置（SECURITY 分组） */
export const saveSecurityConfig = (config: Record<string, string>) =>
  http.put<void>('/system-config/security', config);

/** 获取系统参数分页列表（RuoYi 风格管理页） */
export const getSysConfigList = (params: SysConfigListParams = {}) =>
  http.get<SysConfigPageResult>('/system/configs', { params });

/** 新增系统参数 */
export const createSysConfig = (config: SysConfigPayload) =>
  http.post<SysConfigItem>('/system/configs', config);

/** 更新系统参数 */
export const updateSysConfig = (id: number, config: SysConfigPayload) =>
  http.put<SysConfigItem>(`/system/configs/${id}`, config);

/** 删除系统参数 */
export const deleteSysConfig = (id: number) =>
  http.delete<void>(`/system/configs/${id}`);

/** 刷新系统参数缓存 */
export const refreshSysConfigCache = () =>
  http.post<void>('/system/configs/refresh-cache');
