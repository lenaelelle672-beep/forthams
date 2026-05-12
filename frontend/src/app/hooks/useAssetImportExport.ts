/**
 * useAssetImportExport — 资产批量导入导出自定义 Hook
 *
 * 封装资产文件上传（批量导入）与条件导出的 API 调用逻辑，
 * 管理导入状态机与错误状态，提供简洁的调用接口。
 *
 * 状态机: idle → uploading → parsing → completed / partial_error / failed
 *
 * @module hooks/useAssetImportExport
 * @since SWARM-065
 */

import { useState, useCallback } from 'react';
import { toast } from 'sonner';
import { assetService } from '../services/assetService';
import type {
  ImportParseResponse,
  ImportParsedRow,
  ImportCommitResponse,
  AssetExportParams,
} from '../services/assetService';

/* ------------------------------------------------------------------ */
/*  类型定义                                                           */
/* ------------------------------------------------------------------ */

/**
 * 导入流程阶段枚举
 *
 * @description 控制导入 UI 的完整生命周期
 */
export type ImportPhase =
  | 'idle'
  | 'uploading'
  | 'parsing'
  | 'preview'
  | 'committing'
  | 'completed'
  | 'partial_error'
  | 'failed';

/**
 * 导入行级错误
 *
 * @description 单条导入记录的行级校验错误
 */
export interface ImportError {
  /** 行号 */
  rowNumber: number;
  /** 出错字段 */
  field: string;
  /** 错误信息 */
  message: string;
}

/**
 * useAssetImportExport Hook 返回类型
 */
export interface UseAssetImportExportReturn {
  /** 导入阶段 */
  importPhase: ImportPhase;
  /** 导出中状态 */
  exporting: boolean;
  /** 最近一次解析结果 */
  parseResult: ImportParseResponse | null;
  /** 最近一次提交结果 */
  commitResult: ImportCommitResponse | null;
  /** 错误信息 */
  error: string | null;
  /** 执行文件上传解析 */
  uploadAndParse: (file: File) => Promise<ImportParseResponse | null>;
  /** 执行确认提交 */
  commitImport: (parseId: string, correctedRows?: ImportParsedRow[]) => Promise<ImportCommitResponse | null>;
  /** 执行条件导出 */
  exportAssets: (params: AssetExportParams) => Promise<boolean>;
  /** 下载导入模板 */
  downloadTemplate: () => Promise<void>;
  /** 重置导入状态 */
  resetImport: () => void;
  /** 校验文件类型 */
  validateFileType: (fileName: string) => boolean;
  /** 校验文件大小 */
  validateFileSize: (fileSize: number) => boolean;
}

/* ------------------------------------------------------------------ */
/*  常量                                                               */
/* ------------------------------------------------------------------ */

/** 文件大小上限 10MB */
const MAX_FILE_SIZE = 10 * 1024 * 1024;

/** 允许的文件扩展名正则 */
const VALID_FILE_PATTERN = /\.xlsx$/i;

/* ------------------------------------------------------------------ */
/*  Hook 实现                                                          */
/* ------------------------------------------------------------------ */

/**
 * useAssetImportExport — 资产批量导入导出 Hook
 *
 * 封装资产文件上传与条件导出的 API 调用逻辑，管理状态机。
 * 不包含业务逻辑硬编码，仅做请求转发与状态管理。
 *
 * @returns Hook 返回对象，包含导入导出方法与状态
 *
 * @example
 * ```tsx
 * const { importPhase, uploadAndParse, commitImport, exportAssets } = useAssetImportExport();
 *
 * // 上传并解析文件
 * const result = await uploadAndParse(selectedFile);
 *
 * // 确认提交
 * const commit = await commitImport(parseId, correctedRows);
 *
 * // 导出
 * const success = await exportAssets({ keyword: '电脑', status: 'ACTIVE' });
 * ```
 */
export function useAssetImportExport(): UseAssetImportExportReturn {
  /** 导入阶段状态 */
  const [importPhase, setImportPhase] = useState<ImportPhase>('idle');

  /** 导出加载状态 */
  const [exporting, setExporting] = useState(false);

  /** 解析结果 */
  const [parseResult, setParseResult] = useState<ImportParseResponse | null>(null);

  /** 提交结果 */
  const [commitResult, setCommitResult] = useState<ImportCommitResponse | null>(null);

  /** 错误信息 */
  const [error, setError] = useState<string | null>(null);

  /**
   * 校验文件类型
   *
   * @param fileName - 文件名
   * @returns 是否为合法的 .xlsx 文件
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
   * 执行文件上传解析
   *
   * @description 上传文件至后端解析接口，返回解析结果。
   * 自动处理文件类型与大小校验，管理状态机。
   *
   * @param file - 要上传的文件对象
   * @returns 解析响应数据，校验失败时返回 null
   */
  const uploadAndParse = useCallback(
    async (file: File): Promise<ImportParseResponse | null> => {
      // 前端校验
      if (!validateFileType(file.name)) {
        const msg = '仅支持 .xlsx 格式文件';
        toast.error(msg);
        return null;
      }
      if (!validateFileSize(file.size)) {
        const msg = '文件大小不能超过 10MB';
        toast.error(msg);
        return null;
      }

      setImportPhase('uploading');
      setError(null);
      setParseResult(null);

      try {
        const formData = new FormData();
        formData.append('file', file);

        const result = await assetService.importParse(formData);
        setParseResult(result);
        setImportPhase('preview');
        return result;
      } catch (err) {
        const msg = err instanceof Error ? err.message : '文件解析失败，请检查文件格式';
        setError(msg);
        setImportPhase('failed');
        toast.error(msg);
        return null;
      }
    },
    [validateFileType, validateFileSize],
  );

  /**
   * 执行确认提交
   *
   * @description 携带 parseId 提交确认导入，后端执行实际批量写入。
   *
   * @param parseId - 解析阶段返回的会话 ID
   * @param correctedRows - 用户修正后的行数据
   * @returns 提交结果，失败时返回 null
   */
  const commitImport = useCallback(
    async (parseId: string, correctedRows?: ImportParsedRow[]): Promise<ImportCommitResponse | null> => {
      setImportPhase('committing');
      setError(null);

      try {
        const result = await assetService.importCommit(parseId, correctedRows);
        setCommitResult(result);

        if (result.failedCount === 0) {
          setImportPhase('completed');
          toast.success(`成功导入 ${result.importedCount} 条资产`);
        } else if (result.importedCount > 0) {
          setImportPhase('partial_error');
          toast.warning(`成功导入 ${result.importedCount} 条资产，${result.failedCount} 条失败`);
        } else {
          setImportPhase('failed');
          toast.error(`导入失败：${result.failedCount} 条数据未通过校验`);
        }

        return result;
      } catch (err) {
        const msg = err instanceof Error ? err.message : '导入失败，请稍后重试';
        setError(msg);
        setImportPhase('failed');
        toast.error(msg);
        return null;
      }
    },
    [],
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
        const response = await assetService.export(params);

        const blob =
          response.data instanceof Blob
            ? response.data
            : new Blob([response.data]);

        // 解析文件名
        const disposition = response.headers?.['content-disposition'];
        const now = new Date();
        const pad = (n: number) => String(n).padStart(2, '0');
        const timestamp = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
        let filename = `资产台账_${timestamp}.xlsx`;
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
      } catch (err) {
        const msg =
          err instanceof Error ? err.message : '导出失败，请稍后重试';
        toast.error(msg);
        return false;
      } finally {
        setExporting(false);
      }
    },
    [],
  );

  /**
   * 下载导入模板
   *
   * @description 调用后端模板下载接口，返回 Blob 文件流并触发浏览器下载。
   */
  const downloadTemplate = useCallback(async () => {
    try {
      const response = await assetService.importTemplate('xlsx');

      const blob =
        response.data instanceof Blob
          ? response.data
          : new Blob([response.data]);

      const disposition = response.headers?.['content-disposition'];
      let filename = 'asset_import_template.xlsx';
      if (typeof disposition === 'string') {
        const match = disposition.match(
          /filename\*?=(?:UTF-8'')?([^;\n]+)/i,
        );
        if (match) {
          filename = decodeURIComponent(match[1].replace(/["']/g, ''));
        }
      }

      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err) {
      const msg = err instanceof Error ? err.message : '下载模板失败，请稍后重试';
      toast.error(msg);
    }
  }, []);

  /**
   * 重置导入状态
   *
   * @description 将所有导入相关状态恢复到初始态
   */
  const resetImport = useCallback(() => {
    setImportPhase('idle');
    setParseResult(null);
    setCommitResult(null);
    setError(null);
  }, []);

  return {
    importPhase,
    exporting,
    parseResult,
    commitResult,
    error,
    uploadAndParse,
    commitImport,
    exportAssets,
    downloadTemplate,
    resetImport,
    validateFileType,
    validateFileSize,
  };
}
