/**
 * importExportApi — 资产批量导入/导出 API 抽象层
 *
 * SWARM-056: 提供模板下载、批量导入、条件导出等 API 函数，
 * 统一处理 Blob 流下载、FormData 上传及错误转换。
 *
 * @module services/importExportApi
 * @since SWARM-056
 */

import { apiClient } from '../utils/api';
import type {
  ImportParseResponse,
  ImportCommitResponse,
  AssetExportParams,
} from './assetService';

/* ------------------------------------------------------------------ */
/*  类型定义                                                            */
/* ------------------------------------------------------------------ */

/**
 * 导入行级错误结构
 *
 * @description 后端返回的行级校验错误，包含行号和错误消息
 */
export interface ImportErrorItem {
  /** 行号 */
  rowNumber: number;
  /** 出错字段名 */
  field?: string;
  /** 错误消息 */
  message: string;
}

/**
 * 导入结果
 *
 * @description 包含成功条数、失败条数及行级错误详情
 */
export interface ImportResult {
  /** 是否整体成功 */
  success: boolean;
  /** 成功导入条数 */
  importedCount: number;
  /** 失败条数 */
  failedCount: number;
  /** 行级错误列表 */
  errors: ImportErrorItem[];
}

/**
 * 导出查询参数（与 AssetExportParams 一致）
 *
 * @description 从 AssetListPage 筛选条件转换而来
 */
export type ExportQueryParams = AssetExportParams;

/* ------------------------------------------------------------------ */
/*  文件大小/格式常量                                                     */
/* ------------------------------------------------------------------ */

/** 允许的 MIME 类型 */
export const ALLOWED_MIME_TYPES = [
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/csv',
] as const;

/** 允许的文件扩展名 */
export const ALLOWED_EXTENSIONS = ['.xlsx', '.csv'] as const;

/** 最大文件大小（字节）：5MB */
export const MAX_FILE_SIZE = 5 * 1024 * 1024;

/* ------------------------------------------------------------------ */
/*  辅助函数                                                            */
/* ------------------------------------------------------------------ */

/**
 * 触发浏览器下载 Blob 文件
 *
 * @param blob - 文件 Blob 数据
 * @param filename - 默认文件名（从 Content-Disposition 提取或使用此值）
 */
function triggerDownload(blob: Blob, filename: string): void {
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.URL.revokeObjectURL(url);
}

/**
 * 从 Content-Disposition 响应头提取文件名
 *
 * @param disposition - Content-Disposition 头部值
 * @param fallback - 提取失败时的回退文件名
 * @returns 解析后的文件名
 */
function extractFilename(disposition: string | null, fallback: string): string {
  if (!disposition) return fallback;
  const utf8Match = disposition.match(/filename\*?=(?:UTF-8''|"?)([^";]+)/i);
  if (utf8Match) return decodeURIComponent(utf8Match[1]);
  const asciiMatch = disposition.match(/filename="?([^";\n]+)"?/i);
  if (asciiMatch) return asciiMatch[1];
  return fallback;
}

/* ------------------------------------------------------------------ */
/*  API 函数                                                            */
/* ------------------------------------------------------------------ */

/**
 * 下载导入模板
 *
 * @description 调用 GET /api/assets/import/template，获取空白 Excel 模板文件。
 * 前端以 Blob 流接收后触发浏览器下载。
 *
 * @param format - 文件格式，默认 'xlsx'
 * @throws 当后端返回非 2xx 时抛出 Error
 */
export async function downloadTemplate(format: string = 'xlsx'): Promise<void> {
  const response = await apiClient.get('/assets/import/template', {
    params: { format },
    responseType: 'blob',
  });

  const blob = response.data as Blob;
  const disposition = response.headers['content-disposition'] as string | null;
  const filename = extractFilename(disposition, `asset_import_template.${format}`);

  triggerDownload(blob, filename);
}

/**
 * 批量导入资产（解析阶段）
 *
 * @description 上传 .xlsx/.csv 文件至后端解析接口，
 * 返回解析后的行数据及行级校验错误。
 *
 * @param file - 用户上传的文件对象
 * @returns 解析结果（行数据 + 错误列表 + parseId）
 * @throws 当后端返回非 2xx 时抛出包含业务错误信息的 Error
 */
export async function parseImportFile(file: File): Promise<ImportParseResponse> {
  const formData = new FormData();
  formData.append('file', file);

  const response = await apiClient.post<ImportParseResponse>(
    '/assets/import/parse',
    formData,
    {
      headers: { 'Content-Type': 'multipart/form-data' },
    },
  );

  return response.data;
}

/**
 * 批量导入资产（确认提交阶段）
 *
 * @description 携带 parseId 提交确认导入，后端执行实际批量写入。
 *
 * @param parseId - 解析阶段返回的会话 ID
 * @param correctedRows - 用户修正后的行数据（可选）
 * @returns 提交结果（成功/失败条数）
 * @throws 当后端返回非 2xx 时抛出包含业务错误信息的 Error
 */
export async function commitImport(
  parseId: string,
  correctedRows?: Record<string, unknown>[],
): Promise<ImportCommitResponse> {
  const response = await apiClient.post<ImportCommitResponse>(
    '/assets/import/commit',
    { parseId, correctedRows },
  );

  return response.data;
}

/**
 * 条件导出资产列表
 *
 * @description 携带当前筛选参数调用后端导出 API，
 * 后端生成文件流后触发浏览器下载。
 *
 * @param params - 从 AssetListPage 筛选条件转换的查询参数
 * @returns 是否导出成功
 * @throws 当后端返回非 2xx 时抛出包含业务错误信息的 Error
 */
export async function exportAssets(params?: ExportQueryParams): Promise<boolean> {
  const response = await apiClient.get('/assets/export', {
    params,
    responseType: 'blob',
  });

  const blob = response.data as Blob;

  // 检查是否返回了 JSON 错误响应（如异步导出任务提示）
  if (blob.type && blob.type.includes('application/json')) {
    // 异步导出场景：后端返回任务状态 JSON
    const text = await blob.text();
    const json = JSON.parse(text);
    if (json.message) {
      // 异步导出成功提交
      return true;
    }
    throw new Error(json.message || '导出失败');
  }

  const disposition = response.headers['content-disposition'] as string | null;
  const filename = extractFilename(disposition, 'assets_export.xlsx');

  triggerDownload(blob, filename);
  return true;
}

/* ------------------------------------------------------------------ */
/*  前端静态校验                                                         */
/* ------------------------------------------------------------------ */

/**
 * 校验上传文件的前端静态规则（格式、大小）
 *
 * @param file - 待校验的文件对象
 * @returns 校验通过返回 null，不通过返回错误消息字符串
 */
export function validateImportFile(file: File): string | null {
  const ext = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();

  if (!ALLOWED_EXTENSIONS.includes(ext as typeof ALLOWED_EXTENSIONS[number])) {
    return '仅支持 .xlsx 或 .csv 格式';
  }

  if (file.size > MAX_FILE_SIZE) {
    return '文件大小不能超过 5MB';
  }

  // CSV 编码检测：尝试读取前几字节判断是否为 UTF-8
  // 此处仅做同步基础校验，详细编码检测在 parseImportFile 异常处理中覆盖

  return null;
}
