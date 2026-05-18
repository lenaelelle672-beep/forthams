/**
 * @module app/types/audit
 * @description 审计日志公共类型定义，从 auditService 集中导出供页面组件使用。
 *
 * 对应 SPEC: SWARM-060 Audit Log Dashboard Page
 * - ATB-01: 多维筛选与分页
 * - ATB-03: 趋势数据聚合
 *
 * @since SWARM-060
 */

export type {
  AuditLogListParams,
  AuditLogTrendParams,
  AuditLogItem,
  AuditLogListResponse,
  TrendDataPoint,
  AuditLogTrendResponse,
  AuditLogMetaResponse,
  TimeRangeValidationResult,
  PaginationValidationResult,
  AuditDashboardQueryParams,
  AuditDashboardData,
} from '../services/auditService';
