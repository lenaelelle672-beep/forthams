import { useState, useCallback, useRef } from 'react';
import { message } from 'antd';
import type { AssetRow, RowError } from '../types';
import { parseImportFile, commitImport } from '@/api/assetImport';

/** 上传状态枚举 */
export type UploadStatus = 'idle' | 'uploading' | 'parsing' | 'success' | 'error';

/** 提交结果 */
export interface ImportCommitResult {
  success: boolean;
  importedCount: number;
  failedCount: number;
}

/** 行级错误映射：rowNumber → field → errorMessage */
export type RowErrorMap = Record<number, Record<string, string>>;

/**
 * 资产批量导入工作流 Hook
 *
 * 管理完整的导入流程：文件上传 → 进度追踪 → 解析预览 → 行级校验 → 内联修正 → 确认提交
 *
 * @see [SWARM-P2-006-FE] Layer 2 — 导入面板
 */
export function useAssetImport() {
  // ─── 上传状态 ───
  const [uploadStatus, setUploadStatus] = useState<UploadStatus>('idle');
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [lastFile, setLastFile] = useState<File | null>(null);

  // ─── 解析结果 ───
  const [parseId, setParseId] = useState<string | null>(null);
  const [rows, setRows] = useState<AssetRow[]>([]);
  const [errorMap, setErrorMap] = useState<RowErrorMap>({});

  // ─── 提交状态 ───
  const [committing, setCommitting] = useState(false);
  const [commitResult, setCommitResult] = useState<ImportCommitResult | null>(null);

  // ─── 内部引用 ───
  const abortControllerRef = useRef<AbortController | null>(null);
  const uploadingRef = useRef(false);

  /**
   * 将后端返回的 RowError[] 转换为行级错误映射（rowNumber → field → message）
   * 便于 O(1) 查找某个单元格的错误信息
   */
  const buildErrorMap = useCallback((errors: RowError[]): RowErrorMap => {
    const map: RowErrorMap = {};
    for (const err of errors) {
      if (!map[err.rowNumber]) {
        map[err.rowNumber] = {};
      }
      map[err.rowNumber][err.field] = err.message;
    }
    return map;
  }, []);

  /**
   * 上传并解析 Excel 文件
   *
   * - FE-3: 支持 .xlsx 文件上传（文件类型与大小校验由组件层 beforeUpload 完成）
   * - FE-4: 通过 onUploadProgress 实时更新上传进度百分比
   * - ATB-006: 上传完成（100%）后切换到「解析中...」状态
   * - ATB-019: 并发上传防护，上传中拒绝第二个文件
   */
  const parseFile = useCallback(
    async (file: File) => {
      // 并发上传防护（ATB-019）
      if (uploadingRef.current) {
        message.warning('当前有文件正在上传，请等待完成');
        return;
      }

      uploadingRef.current = true;
      setLastFile(file);
      setUploadStatus('uploading');
      setUploadProgress(0);
      setUploadError(null);
      setParseId(null);
      setRows([]);
      setErrorMap({});
      setCommitResult(null);

      abortControllerRef.current = new AbortController();

      try {
        const response = await parseImportFile(file, (progressEvent) => {
          if (progressEvent.total) {
            const percent = Math.round(
              (progressEvent.loaded * 100) / progressEvent.total
            );
            setUploadProgress(percent);
            // 上传完成但等待后端响应 → 解析中
            if (percent >= 100 && uploadStatus === 'uploading') {
              setUploadStatus('parsing');
            }
          }
        });

        // 处理解析响应：{ parseId, rows, errors }
        const {
          parseId: id,
          rows: parsedRows,
          errors,
        } = response as {
          parseId: string;
          rows: AssetRow[];
          errors: RowError[];
        };

        setParseId(id);
        setRows(parsedRows);
        setErrorMap(buildErrorMap(errors || []));
        setUploadStatus('success');
      } catch (error: any) {
        // 请求被取消（AbortController）时静默退出
        if (error?.name === 'AbortError' || error?.name === 'CanceledError') {
          return;
        }
        const errorMsg =
          error?.response?.data?.message || '上传解析失败，请重试';
        setUploadError(errorMsg);
        setUploadStatus('error');
      } finally {
        uploadingRef.current = false;
      }
    },
    [buildErrorMap, uploadStatus]
  );

  /**
   * 重试上传
   *
   * ATB-007: 上传失败后进度条变红，点击重试按钮重新发送请求
   */
  const retryUpload = useCallback(() => {
    if (!lastFile) return;
    setUploadError(null);
    setUploadStatus('idle');
    // 使用 setTimeout 确保状态重置后再触发上传
    const file = lastFile;
    setTimeout(() => parseFile(file), 0);
  }, [lastFile, parseFile]);

  /**
   * 更新预览表格中的单元格值（内联修正）
   *
   * FE-6 / ATB-010:
   * - 仅校验失败行允许编辑
   * - 编辑后实时移除该单元格的错误提示
   */
  const updateCell = useCallback(
    (rowNumber: number, field: string, value: unknown) => {
      // 更新行数据
      setRows((prev) =>
        prev.map((row) =>
          row.rowNumber === rowNumber ? { ...row, [field]: value } : row
        )
      );

      // 清除该单元格的错误标记（仅移除被编辑的字段，保留同行其他字段错误）
      setErrorMap((prev) => {
        const rowErrors = prev[rowNumber];
        if (!rowErrors || !(field in rowErrors)) return prev;

        const { [field]: _removed, ...restFieldErrors } = rowErrors;

        if (Object.keys(restFieldErrors).length === 0) {
          // 该行所有错误已清除
          const { [rowNumber]: _removedRow, ...restMap } = prev;
          return restMap;
        }
        return { ...prev, [rowNumber]: restFieldErrors };
      });
    },
    []
  );

  /**
   * 判断指定行是否存在校验错误
   */
  const hasRowErrors = useCallback(
    (rowNumber: number): boolean => {
      return Object.keys(errorMap[rowNumber] || {}).length > 0;
    },
    [errorMap]
  );

  /**
   * 获取指定单元格的错误信息
   */
  const getCellError = useCallback(
    (rowNumber: number, field: string): string | null => {
      return errorMap[rowNumber]?.[field] ?? null;
    },
    [errorMap]
  );

  /**
   * 判断是否存在至少一行有效（无错误）数据
   *
   * ATB-013: 全部行校验失败时禁止提交
   */
  const hasValidRows = useCallback((): boolean => {
    if (rows.length === 0) return false;
    const errorRowNumbers = new Set(Object.keys(errorMap).map(Number));
    return rows.some((row) => !errorRowNumbers.has(row.rowNumber));
  }, [rows, errorMap]);

  /**
   * 获取有效行数与失败行数
   */
  const getRowStats = useCallback((): {
    total: number;
    valid: number;
    error: number;
  } => {
    const total = rows.length;
    const errorRowNumbers = new Set(Object.keys(errorMap).map(Number));
    const errorCount = rows.filter((row) => errorRowNumbers.has(row.rowNumber)).length;
    return { total, valid: total - errorCount, error: errorCount };
  }, [rows, errorMap]);

  /**
   * 确认提交导入数据
   *
   * FE-7 / ATB-011: 调用 POST /api/v1/assets/import/commit
   * 请求体：{ parseId: string, rows: AssetRow[] }
   *
   * ATB-012: 提交期间按钮 disabled 防止重复提交
   */
  const commit = useCallback(async () => {
    if (!parseId || rows.length === 0 || committing) return;

    setCommitting(true);

    try {
      const result = await commitImport(parseId, rows);
      setCommitResult(result as ImportCommitResult);
    } catch (error: any) {
      const errorMsg =
        error?.response?.data?.message || '提交导入失败，请重试';
      message.error(errorMsg);
    } finally {
      setCommitting(false);
    }
  }, [parseId, rows, committing]);

  /**
   * 重置所有导入状态
   */
  const reset = useCallback(() => {
    abortControllerRef.current?.abort();
    uploadingRef.current = false;
    setUploadStatus('idle');
    setUploadProgress(0);
    setUploadError(null);
    setLastFile(null);
    setParseId(null);
    setRows([]);
    setErrorMap({});
    setCommitting(false);
    setCommitResult(null);
  }, []);

  return {
    // 上传状态
    uploadStatus,
    uploadProgress,
    uploadError,
    lastFile,

    // 解析结果
    parseId,
    rows,
    errorMap,

    // 提交状态
    committing,
    commitResult,

    // 计算属性
    hasValidRows,
    hasRowErrors,
    getCellError,
    getRowStats,

    // 操作方法
    parseFile,
    retryUpload,
    updateCell,
    commit,
    reset,
  };
}

export default useAssetImport;