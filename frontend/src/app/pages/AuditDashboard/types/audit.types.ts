/**
 * @module audit.types
 * @description 审计日志仪表板核心类型定义。
 * 遵循前后端 API 契约，覆盖审计日志实体、查询参数、分页响应及趋势图表数据结构。
 * 架构约束：React 18 + TypeScript + Ant Design Pro + @ant-design/charts 单一主 scaffold。
 */

// =============================================================================
// 枚举与常量
// =============================================================================

/**
 * 操作类型枚举，对应后端 audit_logs.action_type 字段。
 * 扩展时需同步更新后端枚举与前端筛选器选项。
 */
export enum ActionType {
  /** 用户登录 */
  LOGIN = 'LOGIN',
  /** 用户登出 */
  LOGOUT = 'LOGOUT',
  /** 创建资源 */
  CREATE = 'CREATE',
  /** 更新资源 */
  UPDATE = 'UPDATE',
  /** 删除资源 */
  DELETE = 'DELETE',
  /** 导出数据 */
  EXPORT = 'EXPORT',
  /** 导入数据 */
  IMPORT = 'IMPORT',
  /** 审批操作 */
  APPROVE = 'APPROVE',
  /** 拒绝操作 */
  REJECT = 'REJECT',
  /** 资产退役 */
  RETIRE = 'RETIRE',
}

/**
 * 允许访问审计仪表板的角色集合。
 * 权限约束：仅限 admin 与 auditor 角色访问，前端路由守卫与后端接口鉴权均需校验。
 */
export const AUDIT_ALLOWED_ROLES: readonly string[] = ['admin', 'auditor'] as const;

/**
 * 时间范围筛选约束常量。
 * 默认锁定最近 7 天，最大查询跨度不超过 90 天。
 */
export const TIME_RANGE_CONSTRAINTS = {
  /** 默认查询天数 */
  DEFAULT_DAYS: 7,
  /** 最大允许查询天数 */
  MAX_DAYS: 90,
} as const;

/**
 * 分页默认值常量。
 * 前端仅负责分页渲染，严禁在前端进行超 1000 条日志的本地计算或全量遍历。
 */
export const PAGINATION_DEFAULTS = {
  /** 默认页码 */
  DEFAULT_PAGE: 1,
  /** 默认每页条数 */
  DEFAULT_PAGE_SIZE: 20,
  /** 可选每页条数 */
  PAGE_SIZE_OPTIONS: [10, 20, 50, 100] as readonly number[],
} as const;

// =============================================================================
// 审计日志实体
// =============================================================================

/**
 * 审计日志实体，对应后端 /api/audit-logs 返回的单条日志记录。
 * 字段命名与后端 OpenAPI 规范保持一致（snake_case → camelCase 映射在 API 层处理）。
 */
export interface AuditLog {
  /** 日志唯一标识 */
  id: number;
  /** 操作类型，参见 ActionType 枚举 */
  actionType: ActionType;
  /** 操作人用户名 */
  operator: string;
  /** 操作人 ID */
  operatorId: number;
  /** 操作目标资源类型（如 asset、workorder、retirement） */
  targetType: string;
  /** 操作目标资源 ID */
  targetId: string;
  /** 操作详细描述 */
  detail: string;
  /** 操作来源 IP 地址 */
  ipAddress: string;
  /** 操作时间，ISO 8601 格式 */
  timestamp: string;
  /** 附加元数据，用于存储操作上下文信息 */
  metadata?: Record<string, unknown>;
}

// =============================================================================
// 查询参数
// =============================================================================

/**
 * 审计日志查询参数，对应 /api/audit-logs 的请求参数。
 * 三维度筛选器（时间/类型/操作人）联动时，参数合并发送。
 */
export interface AuditLogQuery {
  /** 查询起始时间，ISO 8601 格式（如 2025-01-01T00:00:00Z） */
  startTime: string;
  /** 查询结束时间，ISO 8601 格式（如 2025-01-07T23:59:59Z） */
  endTime: string;
  /** 操作类型筛选，不传则查询全部类型 */
  actionType?: ActionType;
  /** 操作人筛选，支持模糊匹配 */
  operator?: string;
  /** 当前页码，从 1 开始 */
  page: number;
  /** 每页条数 */
  limit: number;
}

/**
 * 审计日志查询参数的默认值工厂函数。
 * 默认时间范围锁定最近 7 天，页码为 1，每页 20 条。
 *
 * @returns 包含默认值的审计日志查询参数对象
 */
export function createDefaultAuditLogQuery(): AuditLogQuery {
  const now = new Date();
  const startDate = new Date(now);
  startDate.setDate(startDate.getDate() - TIME_RANGE_CONSTRAINTS.DEFAULT_DAYS);
  startDate.setHours(0, 0, 0, 0);

  return {
    startTime: startDate.toISOString(),
    endTime: now.toISOString(),
    page: PAGINATION_DEFAULTS.DEFAULT_PAGE,
    limit: PAGINATION_DEFAULTS.DEFAULT_PAGE_SIZE,
  };
}

/**
 * 校验时间范围是否满足约束条件。
 * 最大查询跨度不超过 90 天。
 *
 * @param startTime - 起始时间，ISO 8601 格式
 * @param endTime - 结束时间，ISO 8601 格式
 * @returns 校验结果对象，包含是否合法及错误信息
 */
export function validateTimeRange(
  startTime: string,
  endTime: string,
): { valid: boolean; error?: string } {
  const start = new Date(startTime);
  const end = new Date(endTime);

  if (isNaN(start.getTime()) || isNaN(end.getTime())) {
    return { valid: false, error: '无效的时间格式' };
  }

  if (start >= end) {
    return { valid: false, error: '起始时间必须早于结束时间' };
  }

  const diffMs = end.getTime() - start.getTime();
  const diffDays = diffMs / (1000 * 60 * 60 * 24);

  if (diffDays > TIME_RANGE_CONSTRAINTS.MAX_DAYS) {
    return { valid: false, error: `查询跨度不能超过 ${TIME_RANGE_CONSTRAINTS.MAX_DAYS} 天` };
  }

  return { valid: true };
}

// =============================================================================
// API 响应
// =============================================================================

/**
 * 审计日志分页响应，对应 /api/audit-logs 的返回结构。
 * items 数组长度等于 limit 参数值（最后一页可能不足）。
 */
export interface AuditLogResponse {
  /** 日志记录列表 */
  items: AuditLog[];
  /** 符合筛选条件的总记录数 */
  total: number;
  /** 当前页码 */
  page: number;
  /** 每页条数 */
  limit: number;
}

/**
 * 趋势图表数据点，由后端聚合返回。
 * 前端仅负责图表渲染，严禁在前端进行超 1000 条日志的本地聚合计算。
 */
export interface TrendDataPoint {
  /** 日期，格式 YYYY-MM-DD */
  date: string;
  /** 当日操作总数 */
  count: number;
  /** 按操作类型分组的计数（可选，用于多线折线图） */
  breakdown?: Record<ActionType, number>;
}

/**
 * 趋势数据响应，对应后端趋势数据聚合接口的返回结构。
 */
export interface TrendDataResponse {
  /** 趋势数据点列表 */
  items: TrendDataPoint[];
}

// =============================================================================
// 仪表板状态
// =============================================================================

/**
 * 审计仪表板整体状态，用于 UmiJS Model 数据流管理。
 * 封装列表请求、趋势数据请求、分页状态与筛选参数缓存。
 */
export interface AuditDashboardState {
  /** 审计日志列表响应数据 */
  logResponse: AuditLogResponse | null;
  /** 趋势图表数据响应 */
  trendResponse: TrendDataResponse | null;
  /** 当前查询参数 */
  query: AuditLogQuery;
  /** 列表数据加载状态 */
  logLoading: boolean;
  /** 趋势数据加载状态 */
  trendLoading: boolean;
  /** 错误信息 */
  error: string | null;
}

/**
 * 审计仪表板状态默认值工厂函数。
 * 初始化空数据、默认查询参数与加载状态。
 *
 * @returns 审计仪表板初始状态对象
 */
export function createDefaultAuditDashboardState(): AuditDashboardState {
  return {
    logResponse: null,
    trendResponse: null,
    query: createDefaultAuditLogQuery(),
    logLoading: false,
    trendLoading: false,
    error: null,
  };
}