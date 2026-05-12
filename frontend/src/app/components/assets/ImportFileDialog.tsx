/**
 * ImportFileDialog — 资产批量导入对话框组件
 *
 * 提供拖拽/点击上传区域，支持下载导入模板，
 * 前端静态校验（格式 + 大小），两阶段导入（解析 → 确认提交），
 * 行级错误明细展示与内联修正，以及上传进度反馈。
 *
 * 状态机: idle → uploading → preview → committing → completed / partial_error / failed
 *
 * @module components/assets/ImportFileDialog
 * @since SWARM-065
 */

import React, { useState, useCallback, useRef, useMemo } from 'react';
import {
  Upload,
  Download,
  Loader2,
  AlertCircle,
  CheckCircle2,
  XCircle,
  RotateCcw,
  FileText,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { useAssetImportExport } from '../../hooks/useAssetImportExport';
import type { ImportPhase, ImportError } from '../../hooks/useAssetImportExport';
import type { ImportParsedRow } from '../../services/assetService';

/* ------------------------------------------------------------------ */
/*  Props 类型                                                         */
/* ------------------------------------------------------------------ */

/**
 * ImportFileDialog 组件属性
 */
export interface ImportFileDialogProps {
  /** 额外 CSS 类名 */
  className?: string;
}

/* ------------------------------------------------------------------ */
/*  常量                                                               */
/* ------------------------------------------------------------------ */

/** 预览表格每页条数 */
const PREVIEW_PAGE_SIZE = 20;

/* ------------------------------------------------------------------ */
/*  组件实现                                                           */
/* ------------------------------------------------------------------ */

/**
 * ImportFileDialog — 资产批量导入对话框
 *
 * 支持文件拖拽/点击上传、下载模板、前端校验、
 * 两阶段导入（解析 → 确认提交）、行级错误内联修正。
 * 使用 useAssetImportExport Hook 进行 API 调用。
 *
 * @param props - 组件属性
 * @returns React 组件
 *
 * @example
 * ```tsx
 * <ImportFileDialog />
 * ```
 */
export function ImportFileDialog({ className }: ImportFileDialogProps) {
  /** 使用导入导出 Hook */
  const {
    importPhase,
    parseResult,
    commitResult,
    error,
    uploadAndParse,
    commitImport,
    downloadTemplate,
    resetImport,
    validateFileType,
    validateFileSize,
  } = useAssetImportExport();

  /** 已选择的文件 */
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  /** 前端校验错误 */
  const [validationError, setValidationError] = useState<string | null>(null);

  /** 用户修正后的行数据 */
  const [correctedRows, setCorrectedRows] = useState<Map<number, ImportParsedRow>>(new Map());

  /** 预览表格分页 */
  const [previewPage, setPreviewPage] = useState(1);

  /** 文件输入引用 */
  const fileInputRef = useRef<HTMLInputElement>(null);

  /** 并发上传锁 */
  const uploadLockRef = useRef(false);

  /* ---------------------------------------------------------------- */
  /*  导入阶段判断                                                     */
  /* ---------------------------------------------------------------- */

  const isIdle = importPhase === 'idle' || importPhase === 'failed';
  const isUploading = importPhase === 'uploading';
  const isPreview = importPhase === 'preview';
  const isCommitting = importPhase === 'committing';
  const isDone = importPhase === 'completed' || importPhase === 'partial_error';
  const isBusy = isUploading || isCommitting;

  /* ---------------------------------------------------------------- */
  /*  计算属性                                                         */
  /* ---------------------------------------------------------------- */

  /** 错误行号集合 */
  const errorRowNumbers = useMemo(() => {
    if (!parseResult) return new Set<number>();
    return new Set(parseResult.errors.map((e) => e.rowNumber));
  }, [parseResult]);

  /** 行号到错误的映射 */
  const errorByRow = useMemo(() => {
    if (!parseResult) return new Map<number, Map<string, string>>();
    const map = new Map<number, Map<string, string>>();
    for (const err of parseResult.errors) {
      if (!map.has(err.rowNumber)) {
        map.set(err.rowNumber, new Map());
      }
      map.get(err.rowNumber)!.set(err.field, err.message);
    }
    return map;
  }, [parseResult]);

  /** 合并修正后的行数据 */
  const displayRows = useMemo(() => {
    if (!parseResult) return [];
    return parseResult.rows.map((row) => correctedRows.get(row.rowNumber) ?? row);
  }, [parseResult, correctedRows]);

  /** 预览表格分页数据 */
  const previewPageData = useMemo(() => {
    const start = (previewPage - 1) * PREVIEW_PAGE_SIZE;
    return displayRows.slice(start, start + PREVIEW_PAGE_SIZE);
  }, [displayRows, previewPage]);

  /** 预览总页数 */
  const previewTotalPages = Math.max(1, Math.ceil(displayRows.length / PREVIEW_PAGE_SIZE));

  /** 是否有可提交的有效行（至少有一行没有错误） */
  const hasAnyValidRow = useMemo(() => {
    if (!parseResult) return false;
    return displayRows.some((row) => !errorRowNumbers.has(row.rowNumber));
  }, [parseResult, displayRows, errorRowNumbers]);

  /* ---------------------------------------------------------------- */
  /*  事件处理                                                         */
  /* ---------------------------------------------------------------- */

  /**
   * 处理文件选择
   *
   * @param file - 用户选择的文件
   */
  const handleFileSelect = useCallback(
    (file: File) => {
      if (uploadLockRef.current) {
        return;
      }

      setValidationError(null);

      if (!validateFileType(file.name)) {
        setValidationError('仅支持 .xlsx 格式文件');
        return;
      }

      if (!validateFileSize(file.size)) {
        setValidationError('文件大小不能超过 10MB');
        return;
      }

      setSelectedFile(file);
      setCorrectedRows(new Map());
      setPreviewPage(1);

      // 自动触发上传
      uploadLockRef.current = true;
      uploadAndParse(file).finally(() => {
        uploadLockRef.current = false;
      });
    },
    [validateFileType, validateFileSize, uploadAndParse],
  );

  /**
   * 处理 input[type="file"] change 事件
   *
   * @param e - 文件输入事件
   */
  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
        handleFileSelect(file);
      }
    },
    [handleFileSelect],
  );

  /**
   * 处理拖拽放置
   *
   * @param e - 拖拽事件
   */
  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();

      if (uploadLockRef.current) {
        return;
      }

      const file = e.dataTransfer.files[0];
      if (file) {
        handleFileSelect(file);
      }
    },
    [handleFileSelect],
  );

  /**
   * 处理拖拽悬停
   *
   * @param e - 拖拽事件
   */
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  /**
   * 处理行级修正
   *
   * @param rowNumber - 行号
   * @param field - 字段名
   * @param value - 修正值
   */
  const handleCellEdit = useCallback(
    (rowNumber: number, field: keyof ImportParsedRow, value: string | number) => {
      setCorrectedRows((prev) => {
        const next = new Map(prev);
        const original = parseResult?.rows.find((r) => r.rowNumber === rowNumber);
        const existing = next.get(rowNumber);
        const base = existing ?? original;
        if (base) {
          next.set(rowNumber, { ...base, [field]: value });
        }
        return next;
      });
    },
    [parseResult],
  );

  /**
   * 确认提交导入
   */
  const handleCommit = useCallback(async () => {
    if (!parseResult?.parseId) return;

    // 合并用户修正的行数据
    const corrected = parseResult.rows.map((row) => {
      const fixed = correctedRows.get(row.rowNumber);
      return fixed ?? row;
    });

    await commitImport(parseResult.parseId, corrected);
  }, [parseResult, correctedRows, commitImport]);

  /**
   * 重试上传
   */
  const handleRetry = useCallback(() => {
    resetImport();
    setValidationError(null);
    if (selectedFile) {
      uploadAndParse(selectedFile);
    }
  }, [resetImport, selectedFile, uploadAndParse]);

  /**
   * 重置全部
   */
  const handleFullReset = useCallback(() => {
    resetImport();
    setSelectedFile(null);
    setValidationError(null);
    setCorrectedRows(new Map());
    setPreviewPage(1);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, [resetImport]);

  /* ---------------------------------------------------------------- */
  /*  渲染                                                             */
  /* ---------------------------------------------------------------- */

  return (
    <div className={`space-y-6 ${className ?? ''}`} data-testid="import-file-dialog">
      {/* 模板下载 */}
      {(isIdle || importPhase === 'idle') && (
        <div>
          <button
            type="button"
            onClick={downloadTemplate}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium
              rounded-lg border border-gray-300 bg-white text-gray-700
              hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500
              transition-colors"
          >
            <Download className="w-4 h-4" />
            下载导入模板
          </button>
        </div>
      )}

      {/* 文件上传区域 — IDLE / FAILED 状态 */}
      {isIdle && (
        <div className="space-y-4">
          <label
            htmlFor="asset-import-file"
            className={`flex flex-col items-center justify-center w-full h-48
              border-2 border-dashed rounded-xl cursor-pointer transition-colors
              ant-upload-drag
              ${validationError ? 'border-red-300 bg-red-50' : 'border-gray-300 bg-white hover:border-blue-400 hover:bg-blue-50'}
              ${isBusy ? 'pointer-events-none opacity-50' : ''}
            `}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
          >
            <div className="ant-upload-drag-icon flex flex-col items-center justify-center pt-5 pb-6">
              <Upload className="w-10 h-10 text-gray-400 mb-3" />
              <p className="mb-1 text-sm text-gray-500">
                将 .xlsx 文件拖到此处，或点击选择文件
              </p>
              <p className="text-xs text-gray-400">
                仅支持 .xlsx 格式，最大 10MB
              </p>
            </div>
            <input
              id="asset-import-file"
              ref={fileInputRef}
              type="file"
              accept=".xlsx"
              onChange={handleInputChange}
              disabled={isBusy}
              className="hidden"
            />
          </label>

          {/* 校验错误提示 */}
          {validationError && (
            <div className="flex items-center gap-2 text-red-600 text-sm">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{validationError}</span>
            </div>
          )}
        </div>
      )}

      {/* 上传中进度 */}
      {isUploading && (
        <div className="flex flex-col items-center justify-center py-12" data-testid="upload-progress">
          <Loader2 className="w-12 h-12 text-blue-500 animate-spin mb-4" />
          <p className="text-sm text-gray-500">正在上传并解析文件...</p>
          <div className="w-full max-w-md mt-4 bg-gray-200 rounded-full h-2 ant-progress">
            <div
              className="bg-blue-500 h-2 rounded-full ant-progress-bg animate-pulse"
              style={{ width: '60%' }}
            />
          </div>
        </div>
      )}

      {/* 上传失败 */}
      {importPhase === 'failed' && !isUploading && (
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-red-600 text-sm">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>上传失败</span>
            {error && <span className="text-gray-500">: {error}</span>}
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleRetry}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-sm
                rounded-lg bg-red-50 text-red-700 border border-red-200
                hover:bg-red-100 transition-colors"
            >
              <RotateCcw className="w-4 h-4" />
              重试
            </button>
          </div>
        </div>
      )}

      {/* 解析预览 */}
      {isPreview && parseResult && (
        <div className="space-y-6">
          {/* 解析摘要 */}
          <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
            <div className="flex items-center gap-2 text-sm">
              <FileText className="w-4 h-4 text-gray-500" />
              <span className="text-gray-600">
                共 {parseResult.rows.length} 行数据
              </span>
            </div>
            {parseResult.errors.length > 0 && (
              <div className="flex items-center gap-2 text-sm text-red-600">
                <AlertCircle className="w-4 h-4" />
                <span>{parseResult.errors.length} 条校验错误</span>
              </div>
            )}
          </div>

          {/* 校验错误列表 */}
          {parseResult.errors.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-red-700">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span className="text-sm font-medium">
                  校验错误（{parseResult.errors.length} 条）
                </span>
              </div>
              <div className="overflow-x-auto rounded-lg border border-red-200">
                <table className="min-w-full divide-y divide-red-100">
                  <thead className="bg-red-50">
                    <tr>
                      <th className="px-4 py-2 text-left text-xs font-medium text-red-600 uppercase">行号</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-red-600 uppercase">字段</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-red-600 uppercase">错误信息</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-red-50">
                    {parseResult.errors.map((err, idx) => (
                      <tr key={`${err.rowNumber}-${err.field}-${idx}`}>
                        <td className="px-4 py-2 text-sm text-gray-900 font-mono">{err.rowNumber}</td>
                        <td className="px-4 py-2 text-sm text-gray-700 font-mono">{err.field}</td>
                        <td className="px-4 py-2 text-sm text-red-600">{err.message}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* 预览表格 */}
          <div className="overflow-x-auto rounded-lg border border-gray-200 ant-table">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">序号</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">资产名称</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">分类</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">状态</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">位置</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">购置日期</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">原值</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">校验状态</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {previewPageData.map((row) => {
                  const hasError = errorRowNumbers.has(row.rowNumber);
                  const rowErrors = errorByRow.get(row.rowNumber);
                  const nameHasError = rowErrors?.has('name');

                  return (
                    <tr
                      key={row.rowNumber}
                      className="transition-colors"
                      style={{ backgroundColor: hasError ? '#FFF2F0' : '#F6FFED' }}
                    >
                      <td className="px-4 py-3 text-sm text-gray-900 font-mono">
                        {row.rowNumber}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        {nameHasError ? (
                          <input
                            type="text"
                            value={row.name}
                            onChange={(e) =>
                              handleCellEdit(row.rowNumber, 'name', e.target.value)
                            }
                            className="w-full px-2 py-1 text-sm border border-red-300 rounded
                              focus:outline-none focus:ring-2 focus:ring-blue-500"
                            placeholder="请输入资产名称"
                          />
                        ) : (
                          <span className="text-gray-900">{row.name || '-'}</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700">
                        {row.categoryName || row.categoryCode}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700">
                        {row.statusName || row.statusCode}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700">
                        {row.locationName || row.locationCode}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700">
                        {row.purchaseDate}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700">
                        {row.originalValue.toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        {hasError ? (
                          <span className="inline-flex items-center gap-1 text-red-600">
                            <XCircle className="w-4 h-4" />
                            错误
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-green-600">
                            <CheckCircle2 className="w-4 h-4" />
                            通过
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* 预览分页 */}
          {previewTotalPages > 1 && (
            <div className="flex items-center justify-between">
              <p className="text-sm text-gray-600">
                共 {displayRows.length} 行，第 {previewPage}/{previewTotalPages} 页
              </p>
              <div className="flex items-center gap-2 ant-pagination">
                <button
                  type="button"
                  onClick={() => setPreviewPage((p) => Math.max(1, p - 1))}
                  disabled={previewPage <= 1}
                  className="inline-flex items-center gap-1 px-3 py-1.5 text-sm
                    rounded border border-gray-300 bg-white hover:bg-gray-50
                    disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronLeft className="w-4 h-4" />
                  上一页
                </button>
                {Array.from({ length: Math.min(previewTotalPages, 7) }, (_, i) => {
                  let pageNum: number;
                  if (previewTotalPages <= 7) {
                    pageNum = i + 1;
                  } else if (previewPage <= 4) {
                    pageNum = i + 1;
                  } else if (previewPage >= previewTotalPages - 3) {
                    pageNum = previewTotalPages - 6 + i;
                  } else {
                    pageNum = previewPage - 3 + i;
                  }
                  return (
                    <button
                      key={pageNum}
                      type="button"
                      onClick={() => setPreviewPage(pageNum)}
                      className={`px-3 py-1.5 text-sm rounded border transition-colors
                        ${previewPage === pageNum
                          ? 'bg-blue-600 text-white border-blue-600'
                          : 'border-gray-300 bg-white hover:bg-gray-50'
                        }`}
                    >
                      {pageNum}
                    </button>
                  );
                })}
                <button
                  type="button"
                  onClick={() => setPreviewPage((p) => Math.min(previewTotalPages, p + 1))}
                  disabled={previewPage >= previewTotalPages}
                  className="inline-flex items-center gap-1 px-3 py-1.5 text-sm
                    rounded border border-gray-300 bg-white hover:bg-gray-50
                    disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  下一页
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* 确认导入按钮 */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-200">
            <button
              type="button"
              onClick={handleFullReset}
              className="px-4 py-2 text-sm rounded-lg border border-gray-300
                bg-white text-gray-700 hover:bg-gray-50 transition-colors"
            >
              取消
            </button>
            <button
              type="button"
              onClick={handleCommit}
              disabled={isBusy || !hasAnyValidRow}
              className="inline-flex items-center gap-1.5 px-6 py-2.5 text-sm font-medium
                rounded-lg bg-blue-600 text-white hover:bg-blue-700
                disabled:opacity-50 disabled:cursor-not-allowed
                transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {isCommitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  导入中...
                </>
              ) : (
                '确认导入'
              )}
            </button>
          </div>
        </div>
      )}

      {/* 提交中 */}
      {isCommitting && !isPreview && (
        <div className="flex flex-col items-center justify-center py-12">
          <Loader2 className="w-12 h-12 text-blue-500 animate-spin mb-4" />
          <p className="text-sm text-gray-500">正在导入数据...</p>
        </div>
      )}

      {/* 导入完成 */}
      {isDone && commitResult && (
        <div className="space-y-4">
          {/* 结果摘要 */}
          <div
            className={`p-4 rounded-lg border ${
              commitResult.failedCount === 0
                ? 'bg-green-50 border-green-200'
                : commitResult.importedCount > 0
                ? 'bg-yellow-50 border-yellow-200'
                : 'bg-red-50 border-red-200'
            }`}
          >
            <div className="flex items-center gap-2 mb-2">
              {commitResult.failedCount === 0 ? (
                <CheckCircle2 className="w-5 h-5 text-green-600" />
              ) : (
                <AlertTriangle className="w-5 h-5 text-yellow-600" />
              )}
              <span className="font-medium text-gray-900">导入结果</span>
            </div>
            <div className="flex gap-4 text-sm">
              <span className="text-green-700">
                成功导入 {commitResult.importedCount} 条资产
              </span>
              {commitResult.failedCount > 0 && (
                <span className="text-red-700">
                  {commitResult.failedCount} 条失败
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              disabled
              className="px-4 py-2 text-sm rounded-lg bg-gray-100 text-gray-400
                cursor-not-allowed transition-colors"
            >
              导入完成
            </button>
            <button
              type="button"
              onClick={handleFullReset}
              className="px-4 py-2 text-sm rounded-lg border border-gray-300
                bg-white text-gray-700 hover:bg-gray-50 transition-colors"
            >
              重新导入
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default ImportFileDialog;
