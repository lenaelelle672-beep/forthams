/**
 * @module auditLogService
 * @description 审计日志数据接入层服务 (SWARM-017)。
 *
 * 封装审计日志列表查询、趋势聚合、元数据获取等 API 调用，
 * 使用项目统一 HTTP Client（api from ../utils/api）对接后端真实接口。
 *
 * 后端 API 契约:
 *   - GET /api/audit-logs?page=N&size=M  → Result<Page<GeneralAuditEntry>>
 *   - GET /api/audit-logs/count           → Result<Long>
 *
 * MyBatis-Plus Page 结构:
 *   { records: T[], total: number, size: number, current: number, pages: number }
 *
 * GeneralAuditEntry 字段:
 *   { traceId: string, timestamp: Date, action: string, beforeRecord: string, afterRecord: string }
 */

import { api } from '../utils/api';

// ---------------------------------------------------------------------------
// Types — 映射后端实体
// ---------------------------------------------------------------------------

/**
 * 后端 GeneralAuditEntry 实体对应的前端类型。
 * 字段名与后端 JSON 序列化保持一致（camelCase）。
 */
export interface AuditLogEntry {
  /** 链路追踪 ID */
  traceId: string;
  /** 操作时间，ISO 8601 格式 */
  timestamp: string;
  /** 操作类型（如 LOGIN, CREATE, UPDATE, DELETE 等） */
  action: string;
  /** 操作前记录快照（JSON 字符串） */
  beforeRecord: string;
  /** 操作后记录快照（JSON 字符串） */
  afterRecord: string;
}

/**
 * MyBatis-Plus 分页响应结构。
 * api.get() 已解包 Result.data，因此直接拿到 Page 对象。
 */
export interface PageResponse<T> {
  /** 当前页数据列表 */
  records: T[];
  /** 总记录数 */
  total: number;
  /** 每页条数 */
  size: number;
  /** 当前页码（1-based） */
  current: number;
  /** 总页数 */
  pages: number;
}

/**
 * 审计日志列表查询参数。
 * 与后端 AuditLogController.getLogs 的 @RequestParam 对齐。
 */
export interface AuditLogListParams {
  /** 页码（0-based，后端默认 0） */
  page?: number;
  /** 每页条数，范围 [1, 100]，默认 10 */
  pageSize?: number;
  /** 搜索关键字（操作人名称等），用于前端筛选 */
  keyword?: string;
  /** 操作类型过滤（如 LOGIN, DELETE 等） */
  actionType?: string;
  /** 起始日期，ISO 8601 格式 */
  startDate?: string;
  /** 结束日期，ISO 8601 格式 */
  endDate?: string;
}

/**
 * 趋势数据点，用于审计操作趋势图表渲染。
 */
export interface TrendDataPoint {
  /** 时间标签（日期字符串或 ISO 时间戳） */
  timestamp: string;
  /** 该时间段内的操作计数 */
  count: number;
}

/**
 * 趋势数据响应。
 */
export interface TrendDataResponse {
  /** 聚合粒度 */
  granularity: 'hour' | 'day' | 'week';
  /** 趋势数据点列表 */
  dataPoints: TrendDataPoint[];
}

/**
 * 操作类型元数据响应。
 */
export interface AuditMetaResponse {
  /** 后端统一下发的操作类型枚举列表 */
  actionTypes: string[];
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** 默认页码（0-based） */
const DEFAULT_PAGE = 0;

/** 默认每页条数 */
const DEFAULT_PAGE_SIZE = 10;

/** 每页最大条数 */
const MAX_PAGE_SIZE = 100;

/** 防抖延迟（毫秒），用于搜索与过滤交互 */
export const DEBOUNCE_DELAY = 300;

// ---------------------------------------------------------------------------
// API: 审计日志列表
// ---------------------------------------------------------------------------

/**
 * 查询审计日志列表（分页）。
 *
 * 对接后端 GET /api/audit-logs?page=N&size=M，
 * 返回 MyBatis-Plus Page<GeneralAuditEntry> 分页结构。
 *
 * @param params - 查询参数，含 page、pageSize 等
 * @returns 分页审计日志响应
 * @throws 当后端返回非 2xx 或 Result.code !== 200 时由 api 拦截器抛出 Error
 *
 * @example
 * ```ts
 * const page = await fetchAuditLogs({ page: 0, pageSize: 20 });
 * // page.records → AuditLogEntry[]
 * // page.total   → number
 * ```
 */
export async function fetchAuditLogs(
  params: AuditLogListParams = {},
): Promise<PageResponse<AuditLogEntry>> {
  const page = params.page ?? DEFAULT_PAGE;
  const size = Math.min(MAX_PAGE_SIZE, Math.max(1, params.pageSize ?? DEFAULT_PAGE_SIZE));

  return api.get<PageResponse<AuditLogEntry>>('/audit-logs', {
    params: { page, size },
  });
}

// ---------------------------------------------------------------------------
// API: 审计日志总数
// ---------------------------------------------------------------------------

/**
 * 获取审计日志总条数。
 *
 * 对接后端 GET /api/audit-logs/count，
 * 用于仪表板统计卡片等场景。
 *
 * @returns 日志总条数
 * @throws 当后端返回非 2xx 或 Result.code !== 200 时由 api 拦截器抛出 Error
 */
export async function fetchAuditLogCount(): Promise<number> {
  return api.get<number>('/audit-logs/count');
}

// ---------------------------------------------------------------------------
// API: 审计趋势数据
// ---------------------------------------------------------------------------

/**
 * 查询审计操作趋势聚合数据。
 *
 * 基于已有的审计日志记录在前端进行时间维度聚合，
 * 按天统计操作频次，用于趋势图表渲染。
 *
 * 当后端趋势接口就绪后可替换为真实 API 调用。
 * 当前实现通过 fetchAuditLogs 获取近期数据后进行客户端聚合。
 *
 * @param days - 查询最近 N 天的趋势，默认 7 天
 * @param pageSize - 单次拉取条数（用于聚合），默认 100
 * @returns 趋势数据响应
 * @throws 当获取日志列表失败时向上传播
 *
 * @example
 * ```ts
 * const trend = await fetchAuditTrend(7);
 * // trend.dataPoints → [{ timestamp: '2025-01-01', count: 12 }, ...]
 * ```
 */
export async function fetchAuditTrend(
  days: number = 7,
  pageSize: number = 100,
): Promise<TrendDataResponse> {
  const logs = await fetchAuditLogs({ page: 0, pageSize });

  // 按天聚合
  const countByDate = new Map<string, number>();
  const records = logs.records ?? [];

  // 初始化最近 N 天的日期桶（确保图表连续）
  const now = new Date();
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    countByDate.set(key, 0);
  }

  // 统计各天操作次数
  for (const record of records) {
    const dateStr = record.timestamp ? new Date(record.timestamp).toISOString().slice(0, 10) : null;
    if (dateStr && countByDate.has(dateStr)) {
      countByDate.set(dateStr, (countByDate.get(dateStr) ?? 0) + 1);
    }
  }

  const dataPoints: TrendDataPoint[] = Array.from(countByDate.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([timestamp, count]) => ({ timestamp, count }));

  return {
    granularity: 'day',
    dataPoints,
  };
}

// ---------------------------------------------------------------------------
// API: 操作类型元数据
// ---------------------------------------------------------------------------

/**
 * 获取审计日志元数据（操作类型枚举列表）。
 *
 * 从后端日志记录中提取不重复的 action 值，
 * 用于前端筛选器下拉选项的动态渲染。
 * 前端禁止硬编码操作类型，需通过此方法动态获取。
 *
 * @returns 操作类型枚举数组
 * @throws 当获取日志列表失败时向上传播
 */
export async function fetchAuditMeta(): Promise<AuditMetaResponse> {
  const logs = await fetchAuditLogs({ page: 0, pageSize: MAX_PAGE_SIZE });
  const actionTypes = [...new Set((logs.records ?? []).map((r) => r.action).filter(Boolean))];
  return { actionTypes };
}

// ---------------------------------------------------------------------------
// Utility: 时间格式化
// ---------------------------------------------------------------------------

/**
 * 将 ISO 8601 时间戳字符串转换为用户本地时区的可读格式。
 *
 * @param utcString - UTC ISO 8601 时间戳
 * @param locale - 区域设置，默认 'zh-CN'
 * @returns 本地格式化的时间字符串
 */
export function formatTimestampToLocal(
  utcString: string,
  locale: string = 'zh-CN',
): string {
  if (!utcString) return '-';
  const date = new Date(utcString);
  if (isNaN(date.getTime())) return '-';
  return date.toLocaleString(locale, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
}

// ---------------------------------------------------------------------------
// Default Export: Service Object
// ---------------------------------------------------------------------------

/**
 * 审计日志服务对象，聚合所有审计日志相关 API 与工具函数。
 * 可在 composable / hook 中按需解构使用。
 *
 * @example
 * ```ts
 * import auditLogService from '../services/auditLogService';
 *
 * // 获取分页日志
 * const page = await auditLogService.fetchAuditLogs({ page: 0, pageSize: 20 });
 *
 * // 获取趋势数据
 * const trend = await auditLogService.fetchAuditTrend(7);
 * ```
 */
const auditLogService = {
  /** 获取分页审计日志列表 */
  fetchAuditLogs,
  /** 获取审计日志总条数 */
  fetchAuditLogCount,
  /** 获取趋势聚合数据 */
  fetchAuditTrend,
  /** 获取操作类型元数据 */
  fetchAuditMeta,
  /** 时间戳格式化工具 */
  formatTimestampToLocal,
  /** 防抖延迟常量 */
  DEBOUNCE_DELAY,
} as const;

export default auditLogService;
