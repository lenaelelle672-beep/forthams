/**
 * @module audit.types
 * @description 审计日志仪表板核心类型定义。
 * 确立前后端日志查询 API 契约，覆盖审计日志条目、查询参数、趋势数据及响应结构。
 * 本文件为唯一主 scaffold (React 18 + TypeScript + Ant Design Pro + @ant-design/charts) 的类型契约源。
 *
 * @convention
 * - 时间字段统一使用 ISO 8601 字符串格式 (RFC 3339)
 * - 分页参数由前端传递，后端返回分页元数据
 * - 趋势图表数据必须由后端聚合返回，前端严禁本地计算超过 1000 条日志
 * - 时间范围筛选器默认锁定最近 7 天，最大查询跨度不超过 90 天
 * - 仪表板仅限 admin 与 auditor 角色访问
 */

// =============================================================================
// 枚举与常量
// =============================================================================

/**
 * 审计操作类型枚举。
 * 对应后端 audit_logs.action_type 字段的可选值。
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
  /** 权限变更 */
  PERMISSION_CHANGE = 'PERMISSION_CHANGE',
}

/**
 * 审计操作状态枚举。
 * 标识单条审计日志对应操作的执行结果。
 */
export enum AuditActionStatus {
  /** 操作成功 */
  SUCCESS = 'SUCCESS',
  /** 操作失败 */
  FAILURE = 'FAILURE',
  /** 操作部分成功 */
  PARTIAL = 'PARTIAL',
}

/**
 * 仪表板访问角色枚举。
 * 仅 admin 与 auditor 角色有权访问审计日志仪表板。
 */
export enum AuditDashboardRole {
  /** 系统管理员 */
  ADMIN = 'admin',
  /** 审计员 */
  AUDITOR = 'auditor',
}

/**
 * 时间范围约束常量。
 * 前端筛选器需遵守这些约束，后端也应做对应校验。
 */
export const AUDIT_TIME_CONSTRAINTS = {
  /** 默认查询时间范围：最近 7 天 */
  DEFAULT_RANGE_DAYS: 7,
  /** 最大查询时间跨度：90 天 */
  MAX_RANGE_DAYS: 90,
} as const;

/**
 * 分页约束常量。
 * 前端仅负责分页渲染，严禁在前端进行超 1000 条日志的本地计算或全量遍历。
 */
export const AUDIT_PAGINATION_CONSTRAINTS = {
  /** 默认每页条数 */
  DEFAULT_PAGE_SIZE: 20,
  /** 可选每页条数 */
  PAGE_SIZE_OPTIONS: [10, 20, 50, 100],
  /** 前端本地计算上限 */
  MAX_LOCAL_COMPUTATION_LIMIT: 1000,
} as const;

// =============================================================================
// 核心数据模型
// =============================================================================

/**
 * 审计日志条目接口。
 * 对应后端 `/api/audit-logs` 返回的 items 数组中的单条记录。
 */
export interface AuditLog {
  /** 日志唯一标识 */
  id: string;
  /** 操作类型 */
  action_type: ActionType;
  /** 操作人用户名 */
  operator: string;
  /** 操作人用户 ID */
  operator_id: string;
  /** 操作目标资源类型 (如 asset, workorder, retirement) */
  target_type: string;
  /** 操作目标资源 ID */
  target_id: string;
  /** 操作详细描述 */
  detail: string;
  /** 操作人 IP 地址 */
  ip_address: string;
  /** 操作时间 (ISO 8601 格式) */
  timestamp: string;
  /** 操作执行状态 */
  status: AuditActionStatus;
  /** 请求追踪 ID，用于链路追踪 */
  trace_id?: string;
  /** 租户 ID (多租户场景) */
  tenant_id?: string;
  /** 扩展元数据 (键值对，存储操作上下文) */
  metadata?: Record<string, unknown>;
}

/**
 * 审计日志查询参数接口。
 * 对应前端筛选器联动产生的查询参数，映射为后端 API 的 query string。
 *
 * @constraint start_time 与 end_time 的跨度不得超过 90 天
 * @constraint 默认时间范围为最近 7 天
 */
export interface AuditLogQuery {
  /** 查询起始时间 (ISO 8601 格式，含) */
  start_time: string;
  /** 查询结束时间 (ISO 8601 格式，含) */
  end_time: string;
  /** 操作类型筛选 (可选，不传则查询全部类型) */
  action_type?: ActionType;
  /** 操作人筛选 (可选，模糊匹配用户名) */
  operator?: string;
  /** 当前页码 (从 1 开始) */
  page: number;
  /** 每页条数 */
  limit: number;
}

/**
 * 趋势数据点接口。
 * 对应后端趋势聚合接口返回的单个数据点，用于折线图渲染。
 * 趋势数据必须由后端聚合返回，前端严禁本地计算。
 */
export interface TrendDataPoint {
  /** 数据点日期 (ISO 8601 日期格式 YYYY-MM-DD) */
  date: string;
  /** 该日期的操作计数 */
  count: number;
  /** 按操作类型分组的计数 (可选，用于多系列折线图) */
  breakdown?: Record<ActionType, number>;
}

/**
 * 趋势数据查询参数接口。
 * 与 AuditLogQuery 共享时间范围约束，但不含分页参数。
 */
export interface TrendDataQuery {
  /** 查询起始时间 (ISO 8601 格式，含) */
  start_time: string;
  /** 查询结束时间 (ISO 8601 格式，含) */
  end_time: string;
  /** 操作类型筛选 (可选，用于单类型趋势) */
  action_type?: ActionType;
  /** 操作人筛选 (可选) */
  operator?: string;
}

// =============================================================================
// API 响应结构
// =============================================================================

/**
 * 审计日志列表 API 响应接口。
 * 对应 `GET /api/audit-logs` 的响应体结构。
 */
export interface AuditLogListResponse {
  /** 审计日志条目列表 */
  items: AuditLog[];
  /** 符合筛选条件的总记录数 */
  total: number;
  /** 当前页码 */
  page: number;
  /** 每页条数 */
  limit: number;
  /** 是否有更多数据 */
  has_more: boolean;
}

/**
 * 趋势数据 API 响应接口。
 * 对应后端趋势聚合接口的响应体结构。
 */
export interface TrendDataResponse {
  /** 趋势数据点列表 */
  items: TrendDataPoint[];
  /** 响应覆盖的起始时间 */
  start_time: string;
  /** 响应覆盖的结束时间 */
  end_time: string;
  /** 时间粒度 (day | week | month) */
  granularity: 'day' | 'week' | 'month';
}

/**
 * API 错误响应接口。
 * 对应后端鉴权失败 (403) 或参数校验失败 (422) 等错误响应。
 */
export interface AuditApiErrorResponse {
  /** 错误码 */
  error_code: string;
  /** 错误描述 */
  message: string;
  /** 详细错误信息 (可选) */
  details?: Record<string, unknown>;
}

// =============================================================================
// 前端筛选器状态
// =============================================================================

/**
 * 审计日志筛选器状态接口。
 * 用于 UmiJS Model 中缓存筛选参数，驱动 Filter 组件与 Table/Chart 的双向联动。
 */
export interface AuditFilterState {
  /** 时间范围 [start_time, end_time] */
  timeRange: [string, string];
  /** 选中的操作类型 */
  actionType: ActionType | undefined;
  /** 操作人关键词 */
  operator: string;
}

/**
 * 审计仪表板整体状态接口。
 * 封装 UmiJS Model 中的完整状态，包含筛选、分页、数据及加载状态。
 */
export interface AuditDashboardState {
  /** 当前筛选器状态 */
  filter: AuditFilterState;
  /** 当前页码 */
  currentPage: number;
  /** 每页条数 */
  pageSize: number;
  /** 审计日志列表数据 */
  logList: AuditLog[];
  /** 日志总数 */
  total: number;
  /** 趋势图表数据 */
  trendData: TrendDataPoint[];
  /** 列表加载状态 */
  listLoading: boolean;
  /** 趋势图加载状态 */
  trendLoading: boolean;
  /** 错误信息 (可选) */
  error: string | null;
}

// =============================================================================
// 工具类型
// =============================================================================

/**
 * 从 AuditLog 中提取表格展示所需的列字段。
 * 用于 ProTable 的 columns 定义中做类型约束。
 */
export type AuditLogTableColumns = Pick<
  AuditLog,
  'id' | 'action_type' | 'operator' | 'target_type' | 'target_id' | 'status' | 'timestamp'
>;

/**
 * ActionType 枚举的值类型联合。
 * 用于需要接受任意操作类型字符串的场景。
 */
export type ActionTypeValue = `${ActionType}`;

/**
 * 审计仪表板允许访问的角色类型联合。
 * 用于路由守卫与权限判断。
 */
export type AuditDashboardAllowedRole = `${AuditDashboardRole}`;