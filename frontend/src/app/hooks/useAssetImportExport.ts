/**
 * useAssetImportExport — 资产批量导入导出自定义 Hook
 *
 * 封装资产文件上传（批量导入）与条件导出的 API 调用逻辑，
 * 管理加载状态与错误状态，提供简洁的调用接口。
 *
 * @module hooks/useAssetImportExport
 * @since SWARM-031
 */

import { useState, useCallback } from 'react';
import { toast } from 'sonner';
import { apiClient } from '../utils/api';

/* ------------------------------------------------------------------ */
/*  类型定义                                                           */
/* ------------------------------------------------------------------ */

/**
 * 导入明细条目
 *
 * @description 单条导入记录的结果
 */
export interface ImportDetailItem {
  /** 行号 */
  row?: number;
  /** 资产名称 */
  assetName?: string;
  /** 资产编号 */
  assetCode?: string;
  /** 导入状态：success / fail */
  status: 'success' | 'fail';
  /** 失败原因 */
  errorMessage?: string;
}

/**
 * 导入响应数据接口
 *
 * @description 后端 POST /api/assets/import 返回的数据结构
 */
export interface AssetImportResponse {
  /** 导入状态 */
  status: 'COMPLETED' | 'PARTIAL_SUCCESS' | 'FAILED';
  /** 成功条数 */
  successCount: number;
  /** 失败条数 */
  failCount: number;
  /** 导入明细 */
  details: ImportDetailItem[];
}

/**
 * 导出请求参数接口
 *
 * @description 后端 GET /api/assets/export 的查询参数
 */
export interface AssetExportParams {
  /** 搜索关键词 */
  keyword?: string;
  /** 资产状态过滤 */
  status?: string;
  /** 分类过滤 */
  categoryId?: string;
  /** 部门过滤 */
  departmentId?: string;
  /** 当前页码 */
  page?: number;
  /** 每页条数 */
  pageSize?: number;
  [key: string]: unknown;
}

/* ------------------------------------------------------------------ */
/*  常量                                                               */
/* ------------------------------------------------------------------ */

/** 文件大小上限 10MB */
const MAX_FILE_SIZE = 10 * 1024 * 1024;

/** 允许的文件扩展名正则 */
const VALID_FILE_PATTERN = /\.(xlsx|csv)$/i;

/* ------------------------------------------------------------------ */
/*  Hook 返回类型                                                      */
/* ------------------------------------------------------------------ */

/**
 * useAssetImportExport Hook 返回类型
 */
export interface UseAssetImportExportReturn {
  /** 导入中状态 */
  importing: boolean;
  /** 导出中状态 */
  exporting: boolean;
  /** 最近一次导入结果 */
  importResult: AssetImportResponse | null;
  /** 执行文件上传导入 */
  importFile: (file: File) => Promise<AssetImportResponse | null>;
  /** 执行条件导出 */
  exportAssets: (params: AssetExportParams) => Promise<boolean>;
  /** 校验文件类型 */
  validateFileType: (fileName: string) => boolean;
  /** 校验文件大小 */
  validateFileSize: (fileSize: number) => boolean;
}

/* ------------------------------------------------------------------ */
/*  Hook 实现                                                          */
/* ------------------------------------------------------------------ */

/**
 * useAssetImportExport — 资产批量导入导出 Hook
 *
 * 封装资产文件上传与条件导出的 API 调用逻辑，管理加载状态与错误状态。
 *
 * @returns Hook 返回对象，包含导入导出方法与状态
 *
 * @example
 * ```tsx
 * const { importing, exporting, importFile, exportAssets } = useAssetImportExport();
 *
 * // 导入
 * const result = await importFile(selectedFile);
 *
 * // 导出
 * const success = await exportAssets({ keyword: '电脑', status: 'ACTIVE' });
 * ```
 */
export function useAssetImportExport(): UseAssetImportExportReturn {
  /** 导入加载状态 */
  const [importing, setImporting] = useState(false);

  /** 导出加载状态 */
  const [exporting, setExporting] = useState(false);

  /** 最近一次导入结果 */
  const [importResult, setImportResult] = useState<AssetImportResponse | null>(null);

  /**
   * 校验文件类型
   *
   * @param fileName - 文件名
   * @returns 是否为合法的 xlsx/csv 文件
   */
  const validateFileType = useCallback((fileName: string): boolean => {
    return VALID_FILE_PATTERN.test(fileName);
  }, []);

  /**
   * 校验文件大小
   *
   * @param fileSize - 文件字节大小
   * @returns 是否在 10MB 以内
   */
  const validateFileSize = useCallback((fileSize: number): boolean => {
    return fileSize <= MAX_FILE_SIZE;
  }, []);

  /**
   * 执行文件上传导入
   *
   * @description 上传文件至后端批量导入 API，返回导入结果。
   * 自动处理文件类型与大小校验，管理加载状态。
   *
   * @param file - 要上传的文件对象
   * @returns 导入响应数据，校验失败时返回 null
   */
  const importFile = useCallback(
    async (file: File): Promise<AssetImportResponse | null> => {
      // 前端校验
      if (!validateFileType(file.name)) {
        toast.error('仅支持 .xlsx 或 .csv 格式');
        return null;
      }
      if (!validateFileSize(file.size)) {
        toast.error('文件大小不能超过 10MB');
        return null;
      }

      setImporting(true);
      try {
        const formData = new FormData();
        formData.append('file', file);

        const response = await apiClient.post<AssetImportResponse>(
          '/assets/import',
          formData,
          {
            headers: { 'Content-Type': 'multipart/form-data' },
          },
        );

        const result = response.data;
        setImportResult(result);

        // 根据后端返回状态显示提示
        if (result.status === 'COMPLETED') {
          toast.success(`导入完成：成功 ${result.successCount} 条`);
        } else if (result.status === 'PARTIAL_SUCCESS') {
          toast.warning(
            `部分成功：成功 ${result.successCount} 条，失败 ${result.failCount} 条`,
          );
        } else {
          toast.error(`导入失败：${result.failCount} 条数据未通过校验`);
        }

        return result;
      } catch (error) {
        const message =
          error instanceof Error ? error.message : '导入失败，请稍后重试';
        toast.error(message);
        return null;
      } finally {
        setImporting(false);
      }
    },
    [validateFileType, validateFileSize],
  );

  /**
   * 执行条件导出
   *
   * @description 携带过滤参数调用后端导出 API，由后端生成文件流，
   * 前端只负责触发浏览器下载。不允许前端本地生成文件。
   *
   * @param params - 导出查询参数
   * @returns 导出是否成功
   */
  const exportAssets = useCallback(
    async (params: AssetExportParams): Promise<boolean> => {
      setExporting(true);
      try {
        const response = await apiClient.get('/assets/export', {
          params,
          responseType: 'blob',
        });

        const blob =
          response.data instanceof Blob
            ? response.data
            : new Blob([response.data]);

        // 解析文件名
        const disposition = response.headers?.['content-disposition'];
        let filename = `assets_export_${new Date().toISOString().slice(0, 10)}.xlsx`;
        if (typeof disposition === 'string') {
          const match = disposition.match(
            /filename\*?=(?:UTF-8'')?([^;\n]+)/i,
          );
          if (match) {
            filename = decodeURIComponent(match[1].replace(/["']/g, ''));
          }
        }

        // 触发浏览器下载
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', filename);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);

        toast.success('导出成功');
        return true;
      } catch (error) {
        const message =
          error instanceof Error ? error.message : '导出失败，请稍后重试';
        toast.error(message);
        return false;
      } finally {
        setExporting(false);
      }
    },
    [],
  );

  return {
    importing,
    exporting,
    importResult,
    importFile,
    exportAssets,
    validateFileType,
    validateFileSize,
  };
}
