/**
 * @module audit.types
 * @description 操作日志仪表板相关类型定义。
 * 涵盖筛选参数、趋势图表数据、API 响应及状态管理所需的全部接口与枚举。
 * 对应 Phase 1: 核心可视化与筛选构建 —— 类型定义层。
 */

// ---------------------------------------------------------------------------
// 枚举：操作类型
// ---------------------------------------------------------------------------

/**
 * 审计操作类型枚举。
 * 与后端 `operationType` 字段对齐，用于筛选器下拉选项及图表分组。
 */
export enum AuditOperationType {
  /** 用户登录 */
  LOGIN = 'LOGIN',
  /** 用户登出 */
  LOGOUT = 'LOGOUT',
  /** 新增资源 */
  CREATE = 'CREATE',
  /** 修改资源 */
  UPDATE = 'UPDATE',
  /** 删除资源 */
  DELETE = 'DELETE',
  /** 数据导出 */
  EXPORT = 'EXPORT',
  /** 数据导入 */
  IMPORT = 'IMPORT',
  /** 审批通过 */
  APPROVE = 'APPROVE',
  /** 审批驳回 */
  REJECT = 'REJECT',
}

/**
 * 操作类型可读标签映射，用于 UI 展示。
 */
export const AuditOperationTypeLabel: Record<AuditOperationType, string> = {
  [AuditOperationType.LOGIN]: '登录',
  [AuditOperationType.LOGOUT]: '登出',
  [AuditOperationType.CREATE]: '新增',
  [AuditOperationType.UPDATE]: '修改',
  [AuditOperationType.DELETE]: '删除',
  [AuditOperationType.EXPORT]: '导出',
  [AuditOperationType.IMPORT]: '导入',
  [AuditOperationType.APPROVE]: '审批通过',
  [AuditOperationType.REJECT]: '审批驳回',
};

// ---------------------------------------------------------------------------
// 筛选参数
// ---------------------------------------------------------------------------

/**
 * 审计日志筛选参数接口。
 * 字段与 `GET /api/audit/logs/stats` 的 Query String 参数一一对应：
 * - `startTime` / `endTime`：ISO 8601 格式的时间字符串
 * - `operationType`：操作类型枚举值
 * - `operator`：操作人姓名（模糊匹配）
 */
export interface AuditFilterParams {
  /** 起始时间，ISO 8601 字符串（如 `2024-01-01T00:00:00Z`） */
  startTime?: string;
  /** 截止时间，ISO 8601 字符串 */
  endTime?: string;
  /** 操作类型，对应 AuditOperationType 枚举值 */
  operationType?: AuditOperationType | string;
  /** 操作人姓名 */
  operator?: string;
}

// ---------------------------------------------------------------------------
// 趋势图表数据
// ---------------------------------------------------------------------------

/**
 * 审计趋势折线图单条数据点接口。
 * 兼容 `@ant-design/charts` Line 组件的数据源格式：
 * - `date` 映射至 X 轴时间刻度
 * - `count` 映射至 Y 轴操作次数
 * - `operationType` 用于多系列分组及 Tooltip 展示
 */
export interface AuditTrendData {
  /** 日期字符串，格式 `YYYY-MM-DD` 或 `YYYY-MM-DD HH:mm`，视粒度而定 */
  date: string;
  /** 该时间点的操作次数 */
  count: number;
  /** 操作类型，用于折线系列分组 */
  operationType: string;
}

/**
 * 趋势图表 Tooltip 悬浮展示的明细信息。
 * 鼠标悬停至数据点时呈现，满足 ATB-6 验收要求。
 */
export interface AuditTrendTooltipData {
  /** 时间点 */
  date: string;
  /** 操作次数 */
  count: number;
  /** 操作类型 */
  operationType: string;
  /** 操作人列表（可选，后端聚合后可能为空） */
  operators?: string[];
}

// ---------------------------------------------------------------------------
// API 响应
// ---------------------------------------------------------------------------

/**
 * 审计统计接口响应体。
 * 对应 `GET /api/audit/logs/stats` 返回的 JSON 结构。
 */
export interface AuditStatsResponse {
  /** 趋势数据点列表 */
  trendData: AuditTrendData[];
  /** 筛选范围内操作总数 */
  totalCount: number;
}

/**
 * 通用 API 响应包装 — re-export from common.ts 统一定义。
 * @see types/common.ts ApiResponse
 */
export type { ApiResponse } from './common';

// ---------------------------------------------------------------------------
// 状态管理
// ---------------------------------------------------------------------------

/**
 * 审计仪表板数据加载状态枚举。
 * 用于驱动 Loading 态、Error 态及空数据态的 UI 切换（ATB-5）。
 */
export enum AuditDataStatus {
  /** 初始空闲态，尚未发起请求 */
  IDLE = 'idle',
  /** 请求进行中 */
  LOADING = 'loading',
  /** 请求成功 */
  SUCCESS = 'success',
  /** 请求失败 */
  ERROR = 'error',
}

/**
 * 审计仪表板 Store 状态接口。
 * 配合 Zustand 使用，包含筛选条件、图表数据及加载状态。
 */
export interface AuditDashboardState {
  /** 当前筛选参数 */
  filter: AuditFilterParams;
  /** 趋势图表数据 */
  trendData: AuditTrendData[];
  /** 操作总数 */
  totalCount: number;
  /** 数据加载状态 */
  status: AuditDataStatus;
  /** 错误信息（status 为 ERROR 时有值） */
  errorMessage: string | null;
}

/**
 * 审计仪表板 Store Actions 接口。
 * 定义状态变更方法，包含防抖请求逻辑的触发入口。
 */
export interface AuditDashboardActions {
  /**
   * 更新筛选条件并触发防抖数据请求。
   * 防抖间隔 300ms，满足 ATB-4 验收要求。
   * @param partial - 需要更新的筛选字段（支持部分更新）
   */
  updateFilter: (partial: Partial<AuditFilterParams>) => void;

  /**
   * 重置筛选条件为初始值并重新请求数据。
   */
  resetFilter: () => void;

  /**
   * 手动触发数据请求（用于初始加载及重试场景）。
   */
  fetchAuditStats: () => Promise<void>;
}

/**
 * 审计仪表板完整 Store 类型（State + Actions）。
 */
export type AuditDashboardStore = AuditDashboardState & AuditDashboardActions;

// ---------------------------------------------------------------------------
// 默认值常量
// ---------------------------------------------------------------------------

/**
 * 筛选参数初始默认值。
 * 默认不传时间范围，由后端决定返回最近数据。
 */
export const DEFAULT_AUDIT_FILTER: AuditFilterParams = {
  startTime: undefined,
  endTime: undefined,
  operationType: undefined,
  operator: undefined,
};

/**
 * 仪表板 Store 初始状态。
 */
export const INITIAL_AUDIT_DASHBOARD_STATE: AuditDashboardState = {
  filter: { ...DEFAULT_AUDIT_FILTER },
  trendData: [],
  totalCount: 0,
  status: AuditDataStatus.IDLE,
  errorMessage: null,
};