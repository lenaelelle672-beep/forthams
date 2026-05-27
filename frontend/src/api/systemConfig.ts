/**
 * @file api/systemConfig.ts
 * @description 系统配置 API — 对接 SystemConfigController
 *
 * 替代原有的 localStorage 持久化方案。
 * SYSTEM 分组：公司名称、系统名称、维保预警天数、默认货币、时区、备份频率
 * SECURITY 分组：密码策略、会话设置、双因素认证、操作日志
 */

import http from '@/utils/http';

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
