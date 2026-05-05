/**
 * 资产批量导入导出 - 类型定义
 * 基于 SPEC: [SWARM-P2-006-FE]
 */

// ============================================================
// 常量
// ============================================================

/** 单文件大小上限 (10 MB = 10,485,760 Bytes) */
export const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;

/** 允许的文件 MIME 类型 */
export const ALLOWED_MIME_TYPE =
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

/** 允许的文件扩展名 */
export const ALLOWED_FILE_EXTENSION = '.xlsx';

/** 预览表格默认每页行数 */
export const DEFAULT_PAGE_SIZE = 20;

/** 校验失败行背景色 */
export const ROW_ERROR_BG_COLOR = '#FFF2F0';

/** 校验通过行背景色 */
export const ROW_SUCCESS_BG_COLOR = '#F6FFED';

/** 已修正行标记色（橙色） */
export const ROW_CORRECTED_BADGE_COLOR = 'orange';

/** 文件类型校验错误提示 */
export const FILE_TYPE_ERROR_MESSAGE = '仅支持 .xlsx 格式文件';

/** 文件大小校验错误提示 */
export const FILE_SIZE_ERROR_MESSAGE = '文件大小不能超过 10MB';

/** 并发上传拦截提示 */
export const UPLOAD_CONCURRENT_MESSAGE =
  '当前有文件正在上传，请等待完成';

/** 无条件导出确认弹窗文案 */
export const EXPORT_NO_FILTER_MESSAGE =
  '未设置筛选条件，将导出全部资产，是否继续？';

/** 导出文件名前缀 */
export const EXPORT_FILENAME_PREFIX = '资产台账';

/** 导出文件名时间戳格式（用于 dayjs / Date 格式化） */
export const EXPORT_FILENAME_TIMESTAMP_FORMAT = 'YYYYMMDD_HHmmss';

/** 导出文件名正则校验（ATB-016） */
export const EXPORT_FILENAME_PATTERN = /资产台账_\d{8}_\d{6}\.xlsx/;

// ============================================================
// 导入相关类型
// ============================================================

/**
 * 解析返回的单行资产数据
 * 对应 SPEC 数据约束中的 AssetRow 结构：
 * `{ rowNumber, name, categoryCode, statusCode, locationCode, purchaseDate, originalValue, ... }`
 */
export interface AssetRow {
  /** 行号（Excel 中原始行号，1-based） */
  rowNumber: number;
  /** 资产名称 */
  name: string;
  /** 资产分类编码 */
  categoryCode: string;
  /** 资产状态编码 */
  statusCode: string;
  /** 存放位置编码 */
  locationCode: string;
  /** 购置日期（格式 YYYY-MM-DD） */
  purchaseDate: string;
  /** 原值 */
  originalValue: number;
  /** 其他扩展字段 */
  [key: string]: unknown;
}

/**
 * 行级校验错误
 * 对应 SPEC 数据约束中的 RowError 结构：
 * `{ rowNumber, field, message }`
 */
export interface RowError {
  /** 出错行号 */
  rowNumber: number;
  /** 出错字段名 */
  field: string;
  /** 错误原因 */
  message: string;
}

/**
 * 解析接口响应
 * 对应 POST /api/v1/assets/import/parse 返回结构：
 * `{ parseId, rows, errors }`
 */
export interface ImportParseResponse {
  /** 解析批次 ID，提交时需要回传 */
  parseId: string;
  /** 解析出的资产行数据 */
  rows: AssetRow[];
  /** 行级校验错误列表 */
  errors: RowError[];
}

/**
 * 确认提交请求体
 * 对应 POST /api/v1/assets/import/commit 请求结构：
 * `{ parseId, rows }`
 */
export interface ImportCommitPayload {
  /** 解析批次 ID */
  parseId: string;
  /** 用户修正后的资产行数据 */
  rows: AssetRow[];
}

/**
 * 确认提交响应
 * 对应 ATB-011 成功返回：`{ success, importedCount, failedCount }`
 */
export interface ImportCommitResult {
  /** 是否整体成功 */
  success: boolean;
  /** 成功导入条数 */
  importedCount: number;
  /** 失败条数 */
  failedCount: number;
}

// ============================================================
// 导出相关类型
// ============================================================

/**
 * 资产状态选项（硬编码，对应 ATB-014）
 */
export const ASSET_STATUS_OPTIONS = [
  { label: '在用', value: 'in_use' },
  { label: '闲置', value: 'idle' },
  { label: '维修中', value: 'maintenance' },
  { label: '报废', value: 'scrapped' },
] as const;

/** 资产状态值联合类型 */
export type AssetStatusCode = (typeof ASSET_STATUS_OPTIONS)[number]['value'];

/**
 * 导出请求筛选条件
 * 对应 POST /api/v1/assets/export 请求结构：
 * `{ categoryCodes, statusCodes, locationCodes }`
 */
export interface ExportRequest {
  /** 资产分类编码列表 */
  categoryCodes: string[];
  /** 资产状态编码列表 */
  statusCodes: string[];
  /** 存放位置编码列表 */
  locationCodes: string[];
}

/**
 * 分类树节点
 * 对应 GET /api/v1/asset-categories/tree 返回数据
 */
export interface CategoryTreeNode {
  /** 分类编码（作为 value） */
  code: string;
  /** 分类名称 */
  label: string;
  /** 子分类 */
  children?: CategoryTreeNode[];
}

/**
 * 位置级联数据节点
 * 对应 GET /api/v1/asset-locations/cascade 返回数据
 */
export interface LocationCascadeNode {
  /** 位置编码 */
  value: string;
  /** 位置名称 */
  label: string;
  /** 子级位置 */
  children?: LocationCascadeNode[];
}

// ============================================================
// UI 状态类型
// ============================================================

/** 导入/导出页面当前激活的 Tab */
export type ActiveTab = 'import' | 'export';

/** 上传状态枚举 */
export type UploadStatus = 'idle' | 'uploading' | 'parsing' | 'success' | 'error';

/**
 * 上传进度状态
 */
export interface UploadProgressState {
  /** 进度百分比 (0-100) */
  percent: number;
  /** 当前状态 */
  status: UploadStatus;
  /** 错误信息（仅 status 为 error 时存在） */
  errorMessage?: string;
}

/**
 * 解析预览中带校验状态的行数据
 */
export interface PreviewRow extends AssetRow {
  /** 该行是否有效（无校验错误） */
  isValid: boolean;
  /** 该行是否已被用户手动修正 */
  isCorrected: boolean;
  /** 该行的错误列表 */
  rowErrors: RowError[];
}

/**
 * 预览表格分页配置
 */
export interface PreviewPagination {
  /** 当前页码（1-based） */
  current: number;
  /** 每页条数 */
  pageSize: number;
  /** 总条数 */
  total: number;
}

/**
 * 文件校验结果
 * 由 validateUploadFile() 工具函数返回
 */
export interface FileValidationResult {
  /** 是否通过校验 */
  valid: boolean;
  /** 校验失败时的提示信息 */
  message?: string;
}

/**
 * 预览表格列定义（对应 ATB-008 表头要求）
 */
export const PREVIEW_TABLE_COLUMNS = [
  { title: '序号', dataIndex: 'rowNumber', key: 'rowNumber', width: 80 },
  { title: '资产名称', dataIndex: 'name', key: 'name' },
  { title: '分类', dataIndex: 'categoryCode', key: 'categoryCode' },
  { title: '状态', dataIndex: 'statusCode', key: 'statusCode' },
  { title: '位置', dataIndex: 'locationCode', key: 'locationCode' },
  { title: '购置日期', dataIndex: 'purchaseDate', key: 'purchaseDate' },
  { title: '原值', dataIndex: 'originalValue', key: 'originalValue' },
  { title: '校验状态', key: 'validationStatus', width: 120 },
] as const;