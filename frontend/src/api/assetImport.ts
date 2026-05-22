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

import http from '@/utils/http';

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
  const response = await http.get<Blob>(
    '/v1/assets/import/template',
    { responseType: 'blob' },
  );
  return response as any;
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

  const response = await http.post<ParseResponse>(
    '/v1/assets/import/parse',
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
  return response as any;
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
  const response = await http.post<CommitResponse>(
    '/v1/assets/import/commit',
    { parseId, rows },
  );
  return response as any;
};

/**
 * FE-9: 按条件导出资产台账
 * POST /api/v1/assets/export
 * Content-Type: application/json，返回文件流（Blob）
 *
 * @param filters - 筛选条件：分类编码、状态编码、位置编码数组
 */
export const exportAssets = async (filters: ExportFilters): Promise<Blob> => {
  const response = await http.post<Blob>(
    '/v1/assets/export',
    {
      categoryCodes: filters.categoryCodes,
      statusCodes: filters.statusCodes,
      locationCodes: filters.locationCodes,
    },
    { responseType: 'blob' },
  );
  return response as any;
};

// ---------------------------------------------------------------------------
// Utility Helpers（Layer 0.2 / 0.3）
// ---------------------------------------------------------------------------
// NOTE: validateUploadFile → @/utils/fileValidator (canonical)
// NOTE: downloadBlob → @/utils/fileDownloader (canonical)
// NOTE: MAX_FILE_SIZE → @/types/assetImportExport#MAX_UPLOAD_FILE_SIZE (canonical)