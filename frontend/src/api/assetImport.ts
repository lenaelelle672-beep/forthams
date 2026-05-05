/**
 * 资产批量导入导出 API 客户端
 *
 * 对接后端端点：
 * - GET  /api/v1/assets/import/template    — 下载导入模板（文件流）
 * - POST /api/v1/assets/import/parse       — 上传并解析 Excel（multipart/form-data）
 * - POST /api/v1/assets/import/commit      — 确认提交解析数据（JSON body）
 * - POST /api/v1/assets/export             — 按条件导出（JSON body，返回文件流）
 *
 * @module frontend/src/api/assetImport
 * @spec SWARM-P2-006-FE
 */

import axios from 'axios';

// ---------------------------------------------------------------------------
// Types & Interfaces（对齐 SPEC「数据约束」章节）
// ---------------------------------------------------------------------------

/** 单行资产数据 */
export interface AssetRow {
  rowNumber: number;
  name: string;
  categoryCode: string;
  statusCode: string;
  locationCode: string;
  purchaseDate: string;
  originalValue: number;
  [key: string]: unknown;
}

/** 行级校验错误 */
export interface RowError {
  rowNumber: number;
  field: string;
  message: string;
}

/** 解析接口响应结构 */
export interface ParseResponse {
  parseId: string;
  rows: AssetRow[];
  errors: RowError[];
}

/** 确认提交响应结构 */
export interface CommitResponse {
  success: boolean;
  importedCount: number;
  failedCount: number;
}

/** 导出筛选条件 */
export interface ExportFilters {
  categoryCodes: string[];
  statusCodes: string[];
  locationCodes: string[];
}

// ---------------------------------------------------------------------------
// API Functions
// ---------------------------------------------------------------------------

/**
 * FE-2: 下载资产导入模板
 * GET /api/v1/assets/import/template
 * 返回文件流（Blob）
 */
export const getImportTemplate = async (): Promise<Blob> => {
  const response = await axios.get<Blob>(
    '/api/v1/assets/import/template',
    { responseType: 'blob' },
  );
  return response.data;
};

/**
 * FE-3 / FE-4 / FE-5: 上传并解析 Excel 文件
 * POST /api/v1/assets/import/parse
 * Content-Type: multipart/form-data, field name: file
 *
 * @param file  - 上传的 .xlsx 文件
 * @param onUploadProgress - 可选的上传进度回调，参数为 0~100 的百分比
 */
export const parseImportFile = async (
  file: File,
  onUploadProgress?: (progress: number) => void,
): Promise<ParseResponse> => {
  const formData = new FormData();
  formData.append('file', file);

  const response = await axios.post<ParseResponse>(
    '/api/v1/assets/import/parse',
    formData,
    {
      headers: { 'Content-Type': 'multipart/form-data' },
      onUploadProgress: (progressEvent) => {
        if (onUploadProgress && progressEvent.total) {
          const percent = Math.round(
            (progressEvent.loaded * 100) / progressEvent.total,
          );
          onUploadProgress(percent);
        }
      },
    },
  );
  return response.data;
};

/**
 * FE-7: 确认提交解析数据
 * POST /api/v1/assets/import/commit
 *
 * @param parseId - 解析阶段返回的 ID
 * @param rows    - 用户修正后的资产行数据（可能包含用户编辑后的内容）
 */
export const commitImport = async (
  parseId: string,
  rows: AssetRow[],
): Promise<CommitResponse> => {
  const response = await axios.post<CommitResponse>(
    '/api/v1/assets/import/commit',
    { parseId, rows },
  );
  return response.data;
};

/**
 * FE-9: 按条件导出资产台账
 * POST /api/v1/assets/export
 * Content-Type: application/json，返回文件流（Blob）
 *
 * @param filters - 筛选条件：分类编码、状态编码、位置编码数组
 */
export const exportAssets = async (filters: ExportFilters): Promise<Blob> => {
  const response = await axios.post<Blob>(
    '/api/v1/assets/export',
    {
      categoryCodes: filters.categoryCodes,
      statusCodes: filters.statusCodes,
      locationCodes: filters.locationCodes,
    },
    { responseType: 'blob' },
  );
  return response.data;
};

// ---------------------------------------------------------------------------
// Utility Helpers（Layer 0.2 / 0.3）
// ---------------------------------------------------------------------------

/** 文件大小上限 10 MB（10,485,760 Bytes） */
const MAX_FILE_SIZE = 10 * 1024 * 1024;

/**
 * FE-3: 上传文件前端校验（类型 + 大小）
 *
 * 校验规则：
 *  - 类型：仅允许 .xlsx
 *  - 大小：≤ 10 MB
 *
 * @param file - 待校验文件
 * @returns valid=true 通过；valid=false 时附带 message 说明原因
 */
export const validateUploadFile = (
  file: File,
): { valid: boolean; message?: string } => {
  // 类型校验：仅允许 .xlsx
  if (!file.name.toLowerCase().endsWith('.xlsx')) {
    return { valid: false, message: '仅支持 .xlsx 格式文件' };
  }

  // 大小校验：≤ 10MB
  if (file.size > MAX_FILE_SIZE) {
    return { valid: false, message: '文件大小不能超过 10MB' };
  }

  return { valid: true };
};

/**
 * FE-2 / FE-9: 浏览器端 Blob 文件下载工具
 *
 * 实现步骤：
 *  1. URL.createObjectURL(blob)
 *  2. 创建隐藏 <a> 标签并设置 download 属性
 *  3. 触发 click 下载
 *  4. URL.revokeObjectURL() 释放内存
 *
 * @param blob     - 文件 Blob 数据
 * @param filename - 下载文件名（含扩展名）
 */
export const downloadBlob = (blob: Blob, filename: string): void => {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  // 添加到 DOM 以兼容 Firefox
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  // 释放 ObjectURL 防止内存泄漏
  URL.revokeObjectURL(url);
};