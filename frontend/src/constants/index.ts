/**
 * 资产折旧计算模块常量定义
 * @module constants/depreciation
 * 
 * 用于前端资产详情页展示折旧计算相关常量
 */

/**
 * 折旧方法枚举
 */
export enum DepreciationMethod {
  /** 直线法 */
  STRAIGHT_LINE = 'straight_line',
  /** 双倍余额递减法 */
  DOUBLE_DECLINING_BALANCE = 'double_declining_balance',
}

/**
 * 折旧状态枚举
 */
export enum DepreciationStatus {
  /** 计算中 */
  CALCULATING = 'calculating',
  /** 已完成 */
  COMPLETED = 'completed',
  /** 异常 */
  ERROR = 'error',
}

/**
 * 折旧计算精度配置
 */
export const DEPRECIATION_PRECISION = {
  /** 金额精度：小数点后2位 */
  AMOUNT_SCALE: 2,
  /** 折旧率精度：小数点后4位 */
  RATE_SCALE: 4,
  /** 月份均摊数 */
  MONTHS_IN_YEAR: 12,
} as const;

/**
 * 折旧计算默认值
 */
export const DEPRECIATION_DEFAULTS = {
  /** 默认残值率：10% */
  DEFAULT_SALVAGE_RATE: 0.1,
  /** 最大使用年限 */
  MAX_USEFUL_LIFE_YEARS: 100,
  /** 最小使用年限 */
  MIN_USEFUL_LIFE_YEARS: 1,
} as const;

/**
 * 折旧显示格式化配置
 */
export const DEPRECIATION_FORMAT = {
  /** 货币符号 */
  CURRENCY_SYMBOL: '¥',
  /** 千分位分隔符 */
  THOUSAND_SEPARATOR: ',',
  /** 小数位数 */
  DECIMAL_PLACES: 2,
} as const;

/**
 * 折旧 API 端点路径
 */
export const DEPRECIATION_API = {
  /** 获取当前折旧值 */
  CURRENT: '/api/v1/assets/{assetId}/depreciation/current',
  /** 获取折旧明细表 */
  SCHEDULE: '/api/v1/assets/{assetId}/depreciation/schedule',
  /** 触发折旧计算 */
  TRIGGER: '/api/v1/depreciation/trigger',
} as const;

/**
 * 折旧错误码定义
 */
export const DEPRECIATION_ERROR_CODES = {
  /** 资产不存在 */
  ASSET_NOT_FOUND: 'DEPRECIATION_ASSET_NOT_FOUND',
  /** 无效的日期范围 */
  INVALID_DATE_RANGE: 'DEPRECIATION_INVALID_DATE_RANGE',
  /** 未来日期不允许 */
  FUTURE_DATE_NOT_ALLOWED: 'DEPRECIATION_FUTURE_DATE_NOT_ALLOWED',
  /** 折旧计算异常 */
  CALCULATION_ERROR: 'DEPRECIATION_CALCULATION_ERROR',
  /** 参数校验失败 */
  VALIDATION_ERROR: 'DEPRECIATION_VALIDATION_ERROR',
} as const;

/**
 * 导出所有折旧相关常量
 */
export const DEPRECIATION_CONSTANTS = {
  method: DepreciationMethod,
  status: DepreciationStatus,
  precision: DEPRECIATION_PRECISION,
  defaults: DEPRECIATION_DEFAULTS,
  format: DEPRECIATION_FORMAT,
  api: DEPRECIATION_API,
  errorCodes: DEPRECIATION_ERROR_CODES,
} as const;

export default DEPRECIATION_CONSTANTS;