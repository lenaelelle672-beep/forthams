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
  displayValue?: string;
  configName?: string;
  configType?: 'STRING' | 'NUMBER' | 'BOOLEAN' | 'SELECT' | 'JSON' | 'Y' | 'N' | string;
  remark?: string;
  status?: number;
  sensitiveMasked?: boolean;
  lastOperatorId?: number;
  lastOperation?: string;
  lastOperationReason?: string;
  auditEvidenceSummary?: string;
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
  configGroup?: 'SYSTEM' | 'SECURITY' | string;
}

export type SysConfigPayload = Partial<Omit<SysConfigItem, 'id' | 'createTime' | 'updateTime'>>;

export interface SystemConfigAuditPayload {
  operatorId: number;
  reason?: string;
  auditEvidence?: string;
  confirmed?: boolean;
}

export interface SystemConfigMapSavePayload extends SystemConfigAuditPayload {
  configs: Record<string, string>;
  configType?: SysConfigItem['configType'];
}

export interface SystemConfigPreviewResult {
  configGroup: 'SYSTEM' | 'SECURITY' | string;
  changedKeys: string[];
  beforeMasked: Record<string, string>;
  afterMasked: Record<string, string>;
  impactModules: string[];
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | string;
  validationErrors: string[];
  persistent: boolean;
  cacheRefreshed: boolean;
  runtimeEffect: boolean;
  summary?: string;
}

export interface SystemConfigRefreshNamespaceResult {
  namespace: string;
  status: 'REFRESHED' | 'SKIPPED' | 'DEGRADED' | string;
  itemCount?: number;
  message: string;
  remediation?: string;
}

export interface SystemConfigRefreshResult {
  overallStatus: 'REFRESHED' | 'SKIPPED' | 'DEGRADED' | string;
  namespaceResults: SystemConfigRefreshNamespaceResult[];
  refreshedCount: number;
  degradedCount: number;
  message: string;
}

export interface SystemConfigRefreshPayload extends SystemConfigAuditPayload {
  namespaces?: string[];
}

// ── API ───────────────────────────────────────────────────────────────────────

/** 获取系统配置（SYSTEM 分组） */
export const getSystemConfig = () =>
  http.get<Record<string, string>>('/system-config/system');

/** 保存系统配置（SYSTEM 分组） */
export const saveSystemConfig = (config: Record<string, string>, audit?: SystemConfigAuditPayload) =>
  http.put<Record<string, string>>('/system-config/system', audit ? { configs: config, ...audit } : config);

/** 获取安全配置（SECURITY 分组） */
export const getSecurityConfig = () =>
  http.get<Record<string, string>>('/system-config/security');

/** 保存安全配置（SECURITY 分组） */
export const saveSecurityConfig = (config: Record<string, string>, audit?: SystemConfigAuditPayload) =>
  http.put<Record<string, string>>('/system-config/security', audit ? { configs: config, ...audit } : config);

/** SECURITY 安全策略影响预演：只返回配置态结果，不持久化不刷新缓存 */
export const previewSecurityConfig = (payload: SystemConfigMapSavePayload) =>
  http.post<SystemConfigPreviewResult>('/system-config/security/preview', payload);

/** 获取系统参数分页列表（RuoYi 风格管理页） */
export const getSysConfigList = (params: SysConfigListParams = {}) =>
  http.get<SysConfigPageResult>('/system/configs', { params });

/** 获取 SYSTEM 基础参数目录 */
export const getSystemBaseParamList = (params: Omit<SysConfigListParams, 'configGroup'> = {}) =>
  getSysConfigList({ ...params, configGroup: 'SYSTEM' });

/** 新增系统参数 */
export const createSysConfig = (config: SysConfigPayload) =>
  http.post<SysConfigItem>('/system/configs', config);

/** 更新系统参数 */
export const updateSysConfig = (id: number, config: SysConfigPayload) =>
  http.put<SysConfigItem>(`/system/configs/${id}`, config);

/** 删除系统参数 */
export const deleteSysConfig = (id: number, operation?: SystemConfigAuditPayload) =>
  http.delete<void>(`/system/configs/${id}`, operation ? { data: operation } : undefined);

/** SYSTEM 基础参数影响预演（兼容 /system-config/system/preview） */
export const previewSystemConfig = (payload: SystemConfigMapSavePayload) =>
  http.post<SystemConfigPreviewResult>('/system-config/system/preview', payload);

/** 系统参数目录级影响预演 */
export const previewSysConfig = (payload: SysConfigPayload & SystemConfigAuditPayload) =>
  http.post<SystemConfigPreviewResult>('/system/configs/preview', payload);

/** 刷新系统参数缓存 */
export const refreshSysConfigCache = (payload?: SystemConfigRefreshPayload) =>
  http.post<SystemConfigRefreshResult>('/system/configs/refresh-cache', payload ?? {});
