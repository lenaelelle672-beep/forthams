/**
 * Asset Retirement and Depreciation Types
 * @module retirement.types
 * @description Type definitions for asset retirement workflow and depreciation calculation
 * 
 * Supported depreciation methods:
 * - STRAIGHT_LINE: 折旧额 = (原值 - 残值) / 折旧年限
 * - DECLINING_BALANCE: 年折旧率 = 2 / 折旧年限，年折旧额 = 期初净值 × 年折旧率
 * 
 * @see SWARM-2026-Q2-003 资产折旧计算核心模块
 */

// ============================================================================
// Enums
// ============================================================================

/** 折旧计算方法枚举 */
export enum DepreciationMethod {
  /** 直线法（平均年限法） */
  STRAIGHT_LINE = 'STRAIGHT_LINE',
  /** 双倍余额递减法 */
  DECLINING_BALANCE = 'DECLINING_BALANCE',
}

/** 退休申请状态 */
export enum RetirementStatus {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
  CANCELLED = 'CANCELLED',
  PROCESSING = 'PROCESSING',
}

// ApprovalStatus 从 asset.types.ts 导入（统一枚举定义）

// ============================================================================
// Core Types - Asset Entity with Depreciation Attributes
// ============================================================================

/** 资产实体接口 */
export interface Asset {
  asset_id: string;
  asset_name: string;
  original_cost: number;
  acquisition_date: string; // ISO date string YYYY-MM-DD
  /** 折旧属性 - 使用寿命（月） */
  useful_life_months: number;
  /** 折旧属性 - 残值 */
  residual_value: number;
  /** 折旧方法 */
  depreciation_method: DepreciationMethod;
  current_book_value: number;
  accumulated_depreciation: number;
}

/** 折旧期间 */
export interface DepreciationPeriod {
  year: number;
  month: number;
}

// ============================================================================
// Depreciation Calculation Types
// ============================================================================

/** 单条折旧计算结果 */
export interface DepreciationResult {
  asset_id: string;
  period: string; // YYYY-MM 格式
  method: DepreciationMethod;
  /** 月折旧额（保留2位小数） */
  monthly_depreciation: number;
  /** 累计折旧 */
  accumulated_depreciation: number;
  /** 账面净值 */
  book_value: number;
}

/** 折旧计算输入参数 */
export interface DepreciationCalculationInput {
  asset: Asset;
  /** 计算基准日期 */
  calculation_date: string; // YYYY-MM-DD
  /** 可选的期间范围（不指定则计算单月） */
  period_range?: {
    start: string; // YYYY-MM
    end: string; // YYYY-MM
  };
}

/** 折旧计算批量输入 */
export interface BatchDepreciationInput {
  asset_ids: string[];
  period: string; // YYYY-MM
}

/** 批量折旧计算结果 */
export interface BatchDepreciationResult {
  total: number;
  successful: number;
  failed: number;
  results: DepreciationResult[];
  errors: DepreciationError[];
}

/** 折旧计算错误详情 */
export interface DepreciationError {
  asset_id: string;
  period: string;
  error_code: string;
  message: string;
}

// ============================================================================
// Validation Types
// ============================================================================

/** 边界约束校验结果 */
export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
}

/** 单个校验错误 */
export interface ValidationError {
  field: string;
  constraint: string;
  message: string;
}

/** 折旧配置验证输入 */
export interface DepreciationConfigValidation {
  original_cost: number;
  residual_value: number;
  useful_life_months: number;
  acquisition_date: string;
  depreciation_date: string;
}

// ============================================================================
// Report Types - 折旧明细报表
// ============================================================================

/** 折旧明细报表条目 */
export interface DepreciationReportItem {
  asset_id: string;
  asset_name: string;
  period: string;
  original_cost: number;
  monthly_depreciation: number;
  accumulated_depreciation: number;
  book_value: number;
  depreciation_method: DepreciationMethod;
}

/** 折旧明细报表响应 */
export interface DepreciationReportResponse {
  asset_id: string;
  asset_name: string;
  report_period: string; // YYYY-MM
  entries: DepreciationReportItem[];
  total_original_cost: number;
  total_book_value: number;
  total_monthly_depreciation: number;
}

/** 折旧报表查询参数 */
export interface DepreciationReportQuery {
  asset_id?: string;
  asset_ids?: string[];
  start_period: string; // YYYY-MM
  end_period: string; // YYYY-MM
  depreciation_method?: DepreciationMethod;
  page?: number;
  page_size?: number;
}

/** 折旧报表分页响应 */
export interface DepreciationReportPaginatedResponse {
  data: DepreciationReportItem[];
  pagination: {
    page: number;
    page_size: number;
    total: number;
    total_pages: number;
  };
}

// ============================================================================
// Scheduled Task Types - 定时任务
// ============================================================================

/** 折旧计提定时任务配置 */
export interface DepreciationSchedulerConfig {
  /** Cron 表达式，例如 "0 0 0 L * ?" 表示每月最后一天凌晨 */
  cron_expression: string;
  /** 是否启用 */
  enabled: boolean;
  /** 任务名称 */
  job_name: string;
  /** 最多重试次数 */
  max_retries: number;
  /** 重试间隔（秒） */
  retry_interval_seconds: number;
}

/** 折旧任务执行状态 */
export interface DepreciationJobStatus {
  job_id: string;
  job_name: string;
  status: 'SCHEDULED' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'RETRYING';
  last_run_time?: string;
  next_run_time?: string;
  last_run_result?: {
    success: boolean;
    processed_count: number;
    failed_count: number;
    error_message?: string;
  };
}

/** 手动触发折旧任务请求 */
export interface TriggerDepreciationJobRequest {
  /** 可选：指定年月（不指定则使用当前月份） */
  period?: string; // YYYY-MM
  /** 可选：指定资产ID列表（不指定则计算所有资产） */
  asset_ids?: string[];
  /** 是否强制重新计算（忽略幂等性检查） */
  force_recalculate?: boolean;
}

/** 折旧任务执行结果 */
export interface DepreciationJobExecutionResult {
  execution_id: string;
  period: string;
  started_at: string;
  completed_at?: string;
  total_assets: number;
  processed_assets: number;
  failed_assets: number;
  status: 'SUCCESS' | 'PARTIAL' | 'FAILED';
  errors: DepreciationError[];
}

// ============================================================================
// Retirement Workflow Types
// ============================================================================

/** 退休申请 */
export interface RetirementApplication {
  application_id: string;
  asset_id: string;
  asset_name: string;
  applicant_id: string;
  applicant_name: string;
  status: RetirementStatus;
  retirement_reason: string;
  expected_date: string;
  created_at: string;
  updated_at: string;
  approval_history?: ApprovalRecord[];
}

/** 审批记录 */
export interface ApprovalRecord {
  record_id: string;
  application_id: string;
  approver_id: string;
  approver_name: string;
  action: 'APPROVE' | 'REJECT' | 'TRANSFER';
  comment?: string;
  action_time: string;
  level: number;
}

/** 退休申请创建输入 */
export interface CreateRetirementApplicationInput {
  asset_id: string;
  retirement_reason: string;
  expected_date: string;
}

// ============================================================================
// Exception Types (for frontend error handling)
// ============================================================================

/** 折旧相关异常类型 */
export enum DepreciationExceptionType {
  /** 折旧日期早于入账日期 */
  DATE_EXCEPTION = 'DepreciationDateException',
  /** 无效的折旧配置（如残值>原值） */
  CONFIG_EXCEPTION = 'InvalidDepreciationConfigException',
  /** 验证异常 */
  VALIDATION_EXCEPTION = 'ValidationException',
  /** 资产不存在 */
  ASSET_NOT_FOUND = 'ASSET_NOT_FOUND',
  /** 计算异常 */
  CALCULATION_EXCEPTION = 'CalculationException',
}

/** 折旧异常信息 */
export interface DepreciationException {
  type: DepreciationExceptionType;
  message: string;
  asset_id?: string;
  details?: Record<string, unknown>;
}

// ============================================================================
// State Machine Types (for retirement workflow)
// ============================================================================

/** 退休状态机事件 */
export enum RetirementEvent {
  SUBMIT = 'SUBMIT',
  APPROVE = 'APPROVE',
  REJECT = 'REJECT',
  CANCEL = 'CANCEL',
  PROCESS = 'PROCESS',
}

/** 退休状态机状态 */
export enum RetirementState {
  DRAFT = 'DRAFT',
  PENDING_APPROVAL = 'PENDING_APPROVAL',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
  CANCELLED = 'CANCELLED',
  PROCESSING = 'PROCESSING',
  COMPLETED = 'COMPLETED',
}

// ============================================================================
// Utility Types
// ============================================================================

/** 折旧方法选项（用于下拉选择） */
export interface DepreciationMethodOption {
  value: DepreciationMethod;
  label: string;
  description: string;
}

/** 预设的折旧方法选项 */
export const DEPRECIATION_METHOD_OPTIONS: DepreciationMethodOption[] = [
  {
    value: DepreciationMethod.STRAIGHT_LINE,
    label: '直线法',
    description: '折旧额 = (原值 - 残值) / 使用寿命，适用于一般资产',
  },
  {
    value: DepreciationMethod.DECLINING_BALANCE,
    label: '双倍余额递减法',
    description: '年折旧率 = 2 / 使用年限，加速折旧，前期折旧多',
  },
];

/** 验证约束常量 */
export const DEPRECIATION_CONSTRAINTS = {
  /** 最大使用寿命（月） */
  MAX_USEFUL_LIFE_MONTHS: 600,
  /** 最小使用寿命（月） */
  MIN_USEFUL_LIFE_MONTHS: 1,
  /** 最大计算未来期间数（月） */
  MAX_FUTURE_PERIODS: 60,
  /** 折旧金额精度（小数位数） */
  DECIMAL_PRECISION: 2,
  /** 月折旧额最大误差 */
  MONTHLY_DEPRECIATION_TOLERANCE: 0.01,
} as const;