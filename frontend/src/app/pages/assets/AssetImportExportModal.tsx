/**
 * AssetImportExportModal — 资产批量导入导出页面
 *
 * 编排导入/导出双 Tab 页面的容器组件。
 * 导入 Tab：文件上传 → 解析预览 → 校验错误展示 → 确认提交。
 * 导出 Tab：分类/状态/位置筛选 → 条件导出。
 *
 * 所有 API 调用通过 assetService 进行，不包含 Mock 数据。
 * 页面级状态管理（筛选条件、加载态、错误态）由本组件内部消化。
 *
 * @module pages/assets/AssetImportExportModal
 * @since SWARM-043
 */

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  Upload,
  Loader2,
  Download,
  FileText,
  AlertCircle,
  RotateCcw,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { toast } from 'sonner';
import { assetService } from '../../services/assetService';
import type {
  ImportParseResponse,
  ImportParsedRow,
  ImportCommitResponse,
  CategoryTreeNode,
  LocationCascadeNode,
  AssetExportParams,
} from '../../services/assetService';
import { ImportValidationErrorList } from '../../components/assets/ImportValidationErrorList';
import { ExportConfigPanel } from '../../components/assets/ExportConfigPanel';

/* ------------------------------------------------------------------ */
/*  常量                                                               */
/* ------------------------------------------------------------------ */

/** 文件大小上限 10MB */
const MAX_FILE_SIZE = 10 * 1024 * 1024;

/** 允许的文件扩展名正则 */
const VALID_FILE_PATTERN = /\.xlsx$/i;

/** 预览表格每页条数 */
const PREVIEW_PAGE_SIZE = 20;

/* ------------------------------------------------------------------ */
/*  导入状态枚举                                                       */
/* ------------------------------------------------------------------ */

/**
 * 导入流程状态机
 *
 * @description IDLE → UPLOADING → PREVIEW → COMMITTING → DONE | FAILED
 */
enum ImportPhase {
  IDLE = 'IDLE',
  UPLOADING = 'UPLOADING',
  PREVIEW = 'PREVIEW',
  COMMITTING = 'COMMITTING',
  DONE = 'DONE',
  FAILED = 'FAILED',
}

/* ------------------------------------------------------------------ */
/*  页面组件                                                           */
/* ------------------------------------------------------------------ */

/**
 * AssetImportExportModal — 资产批量导入导出页面
 *
 * 提供"导入"和"导出"两个 Tab：
 * - 导入 Tab：选择 .xlsx 文件上传，后端解析后展示预览表格与校验错误，
 *   用户修正后可确认提交。
 * - 导出 Tab：通过分类、状态、位置筛选后，条件导出资产列表为 Excel 文件。
 *
 * @returns React 组件
 *
 * @example
 * ```tsx
 * // 在路由中使用
 * <Route path="/assets/import-export" element={<AssetImportExportModal />} />
 * ```
 */
export default function AssetImportExportModal() {
  /* ---------------------------------------------------------------- */
  /*  Tab 状态                                                         */
  /* ---------------------------------------------------------------- */
  const [activeTab, setActiveTab] = useState<'import' | 'export'>('import');

  /* ---------------------------------------------------------------- */
  /*  导入相关状态                                                     */
  /* ---------------------------------------------------------------- */

  /** 导入阶段 */
  const [importPhase, setImportPhase] = useState<ImportPhase>(ImportPhase.IDLE);

  /** 已选择文件 */
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  /** 前端校验错误 */
  const [validationError, setValidationError] = useState<string | null>(null);

  /** 解析结果 */
  const [parseResult, setParseResult] = useState<ImportParseResponse | null>(null);

  /** 用户修正后的行数据 */
  const [correctedRows, setCorrectedRows] = useState<Map<number, ImportParsedRow>>(new Map());

  /** 提交结果 */
  const [commitResult, setCommitResult] = useState<ImportCommitResponse | null>(null);

  /** 预览表格分页 */
  const [previewPage, setPreviewPage] = useState(1);

  /** 文件输入引用 */
  const fileInputRef = useRef<HTMLInputElement>(null);

  /* ---------------------------------------------------------------- */
  /*  导出相关状态                                                     */
  /* ---------------------------------------------------------------- */

  /** 分类树数据 */
  const [categories, setCategories] = useState<CategoryTreeNode[]>([]);

  /** 位置级联数据 */
  const [locations, setLocations] = useState<LocationCascadeNode[]>([]);

  /** 导出中 */
  const [exporting, setExporting] = useState(false);

  /** 元数据加载中 */
  const [metaLoading, setMetaLoading] = useState(false);

  /** 元数据加载错误 */
  const [metaError, setMetaError] = useState<string | null>(null);

  /* ---------------------------------------------------------------- */
  /*  导出 Tab 数据加载                                                */
  /* ---------------------------------------------------------------- */

  /**
   * 加载导出 Tab 所需的分类树和位置级联数据
   *
   * @description 切换到导出 Tab 时触发数据加载，仅加载一次。
   */
  useEffect(() => {
    if (activeTab !== 'export') return;
    if (categories.length > 0 || locations.length > 0) return;
    if (metaLoading) return;

    let cancelled = false;
    setMetaLoading(true);
    setMetaError(null);

    Promise.all([
      assetService.getCategoryTree(),
      assetService.getLocationCascade(),
    ])
      .then(([tree, cascade]) => {
        if (cancelled) return;
        setCategories(tree);
        setLocations(cascade);
      })
      .catch((err) => {
        if (cancelled) return;
        const msg = err instanceof Error ? err.message : '加载筛选数据失败';
        setMetaError(msg);
        toast.error(msg);
      })
      .finally(() => {
        if (!cancelled) setMetaLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [activeTab, categories.length, locations.length, metaLoading]);

  /* ---------------------------------------------------------------- */
  /*  导入流程方法                                                     */
  /* ---------------------------------------------------------------- */

  /**
   * 校验文件类型
   *
   * @param fileName - 文件名
   * @returns 是否为合法的 .xlsx 文件
   */
  const isValidFileType = useCallback((fileName: string): boolean => {
    return VALID_FILE_PATTERN.test(fileName);
  }, []);

  /**
   * 校验文件大小
   *
   * @param fileSize - 文件字节大小
   * @returns 是否在 10MB 以内
   */
  const isValidFileSize = useCallback((fileSize: number): boolean => {
    return fileSize <= MAX_FILE_SIZE;
  }, []);

  /**
   * 处理文件选择
   *
   * @param event - 文件输入变化事件
   */
  const handleFileSelect = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      setValidationError(null);
      setParseResult(null);
      setCommitResult(null);
      setCorrectedRows(new Map());
      setPreviewPage(1);

      if (!file) return;

      if (!isValidFileType(file.name)) {
        setValidationError('仅支持 .xlsx 格式文件');
        toast.error('仅支持 .xlsx 格式文件');
        return;
      }

      if (!isValidFileSize(file.size)) {
        setValidationError('文件大小不能超过 10MB');
        toast.error('文件大小不能超过 10MB');
        return;
      }

      setSelectedFile(file);
    },
    [isValidFileType, isValidFileSize],
  );

  /**
   * 执行文件上传解析
   *
   * @description 上传文件至后端解析接口，返回行数据与错误列表
   */
  const handleUpload = useCallback(async () => {
    if (!selectedFile) return;
    if (importPhase === ImportPhase.UPLOADING) return;

    setImportPhase(ImportPhase.UPLOADING);
    setValidationError(null);

    try {
      const formData = new FormData();
      formData.append('file', selectedFile);

      const result = await assetService.importParse(formData);
      setParseResult(result);
      setImportPhase(ImportPhase.PREVIEW);
    } catch (error) {
      setImportPhase(ImportPhase.FAILED);
      const msg = error instanceof Error ? error.message : '解析失败，请稍后重试';
      toast.error(msg);
    }
  }, [selectedFile, importPhase]);

  /**
   * 确认提交导入
   *
   * @description 将解析结果提交至后端执行实际写入
   */
  const handleCommit = useCallback(async () => {
    if (!parseResult) return;
    if (importPhase === ImportPhase.COMMITTING) return;

    setImportPhase(ImportPhase.COMMITTING);

    try {
      // 合并用户修正的行数据
      const corrected = parseResult.rows.map((row) => {
        const fixed = correctedRows.get(row.rowNumber);
        return fixed ?? row;
      });

      const result = await assetService.importCommit(parseResult.parseId, corrected);
      setCommitResult(result);

      if (result.success) {
        setImportPhase(ImportPhase.DONE);
        toast.success(`成功导入 ${result.importedCount} 条资产${result.failedCount > 0 ? `，${result.failedCount} 条失败` : ''}`);
      } else {
        setImportPhase(ImportPhase.DONE);
        toast.warning(`成功导入 ${result.importedCount} 条，失败 ${result.failedCount} 条`);
      }
    } catch (error) {
      setImportPhase(ImportPhase.FAILED);
      const msg = error instanceof Error ? error.message : '导入失败，请稍后重试';
      toast.error(msg);
    }
  }, [parseResult, importPhase, correctedRows]);

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
   * 重置导入流程
   */
  const handleReset = useCallback(() => {
    setImportPhase(ImportPhase.IDLE);
    setSelectedFile(null);
    setValidationError(null);
    setParseResult(null);
    setCommitResult(null);
    setCorrectedRows(new Map());
    setPreviewPage(1);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, []);

  /**
   * 重试上传
   */
  const handleRetry = useCallback(() => {
    setImportPhase(ImportPhase.IDLE);
    setValidationError(null);
  }, []);

  /* ---------------------------------------------------------------- */
  /*  导出流程方法                                                     */
  /* ---------------------------------------------------------------- */

  /**
   * 从 Content-Disposition 响应头解析文件名
   *
   * @param disposition - Content-Disposition 头值
   * @param fallback - 回退文件名
   * @returns 解析出的文件名
   */
  function parseFilenameFromDisposition(
    disposition: string | undefined,
    fallback: string,
  ): string {
    if (!disposition) return fallback;
    const utf8Match = disposition.match(/filename\*?=(?:UTF-8'')?([^;\n]+)/i);
    if (utf8Match) {
      return decodeURIComponent(utf8Match[1].replace(/["']/g, ''));
    }
    const asciiMatch = disposition.match(/filename="?([^";\n]+)"?/i);
    if (asciiMatch) {
      return asciiMatch[1].replace(/["']/g, '');
    }
    return fallback;
  }

  /**
   * 执行导出
   *
   * @param params - 导出查询参数
   */
  const handleExport = useCallback(async (params: AssetExportParams) => {
    setExporting(true);
    try {
      const response = await assetService.export(params);

      const blob = response.data instanceof Blob
        ? response.data
        : new Blob([response.data]);

      const disposition = response.headers?.['content-disposition'];
      const now = new Date();
      const pad = (n: number) => String(n).padStart(2, '0');
      const timestamp = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
      const fallbackName = `资产台账_${timestamp}.xlsx`;
      const filename = parseFilenameFromDisposition(
        typeof disposition === 'string' ? disposition : undefined,
        fallbackName,
      );

      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast.success('导出成功');
    } catch (error) {
      const msg = error instanceof Error ? error.message : '导出失败，请稍后重试';
      toast.error(msg);
    } finally {
      setExporting(false);
    }
  }, []);

  /* ---------------------------------------------------------------- */
  /*  模板下载                                                         */
  /* ---------------------------------------------------------------- */

  /**
   * 下载导入模板
   */
  const handleDownloadTemplate = useCallback(async () => {
    try {
      const response = await assetService.importTemplate('xlsx');
      const blob = response.data instanceof Blob
        ? response.data
        : new Blob([response.data]);

      const disposition = response.headers?.['content-disposition'];
      const filename = parseFilenameFromDisposition(
        typeof disposition === 'string' ? disposition : undefined,
        'asset_import_template.xlsx',
      );

      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (error) {
      const msg = error instanceof Error ? error.message : '下载模板失败，请稍后重试';
      toast.error(msg);
    }
  }, []);

  /* ---------------------------------------------------------------- */
  /*  预览表格计算属性                                                 */
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

  /** 是否有可修正的错误行 */
  const hasAnyValidRow = useMemo(() => {
    if (!parseResult) return false;
    return displayRows.some((row) => !errorRowNumbers.has(row.rowNumber));
  }, [parseResult, displayRows, errorRowNumbers]);

  /* ---------------------------------------------------------------- */
  /*  渲染                                                             */
  /* ---------------------------------------------------------------- */

  const isImportBusy =
    importPhase === ImportPhase.UPLOADING || importPhase === ImportPhase.COMMITTING;

  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl">
      {/* 页面标题 */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900" role="heading" aria-level={1}>
          资产批量导入导出
        </h1>
        <p className="mt-2 text-sm text-gray-400">
          上传标准 Excel 文件批量创建资产，或按条件导出资产列表
        </p>
      </div>

      {/* Tab 切换 */}
      <div className="flex border-b border-gray-200 mb-6" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'import'}
          onClick={() => setActiveTab('import')}
          className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors
            ${
              activeTab === 'import'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-400 hover:text-gray-700'
            }`}
        >
          导入
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'export'}
          onClick={() => setActiveTab('export')}
          className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors
            ${
              activeTab === 'export'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-400 hover:text-gray-700'
            }`}
        >
          导出
        </button>
      </div>

      {/* 导入 Tab 内容 */}
      {activeTab === 'import' && (
        <div className="space-y-6">
          {/* 模板下载 */}
          {importPhase === ImportPhase.IDLE && (
            <div>
              <button
                type="button"
                onClick={handleDownloadTemplate}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium
                  rounded-lg border border-gray-200 bg-white text-gray-700
                  hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500
                  transition-colors"
              >
                <Download className="w-4 h-4" />
                下载导入模板
              </button>
            </div>
          )}

          {/* 文件上传区域 — IDLE / FAILED 状态 */}
          {(importPhase === ImportPhase.IDLE || importPhase === ImportPhase.FAILED) && (
            <div className="space-y-4">
              <label
                htmlFor="asset-import-file"
                className={`flex flex-col items-center justify-center w-full h-48
                  border-2 border-dashed rounded-xl cursor-pointer transition-colors
                  ${
                    importPhase === ImportPhase.UPLOADING
                      ? 'border-gray-200 bg-gray-50 cursor-not-allowed'
                      : 'border-gray-200 bg-white hover:border-blue-400 hover:bg-blue-50'
                  }
                  ${validationError ? 'border-red-300 bg-red-50' : ''}
                `}
              >
                <div className="flex flex-col items-center justify-center pt-5 pb-6">
                  <Upload className="w-10 h-10 text-gray-400 mb-3" />
                  <p className="mb-1 text-sm text-gray-400">
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
                  onChange={handleFileSelect}
                  disabled={isImportBusy}
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

              {/* 已选择文件 + 操作按钮 */}
              {selectedFile && (
                <div className="p-4 bg-white rounded-lg border border-gray-200 shadow-sm">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <FileText className="w-5 h-5 text-gray-400" />
                      <div>
                        <p className="text-sm font-medium text-gray-900">
                          {selectedFile.name}
                        </p>
                        <p className="text-xs text-gray-400">
                          {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={handleReset}
                        disabled={isImportBusy}
                        className="inline-flex items-center gap-1.5 px-4 py-2 text-sm
                          rounded-lg border border-gray-200 bg-white text-gray-700
                          hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed
                          transition-colors"
                      >
                        <RotateCcw className="w-4 h-4" />
                        重置
                      </button>
                      <button
                        type="button"
                        onClick={handleUpload}
                        disabled={isImportBusy}
                        className="inline-flex items-center gap-1.5 px-4 py-2 text-sm
                          rounded-lg bg-blue-600 text-white hover:bg-blue-700
                          disabled:opacity-50 disabled:cursor-not-allowed
                          transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        {isImportBusy ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            上传中...
                          </>
                        ) : (
                          <>
                            <Upload className="w-4 h-4" />
                            开始上传
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* 上传失败重试 */}
              {importPhase === ImportPhase.FAILED && selectedFile && (
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
              )}
            </div>
          )}

          {/* 上传中进度 */}
          {importPhase === ImportPhase.UPLOADING && (
            <div className="flex flex-col items-center justify-center py-12">
              <Loader2 className="w-12 h-12 text-blue-500 animate-spin mb-4" />
              <p className="text-sm text-gray-400">正在上传并解析文件...</p>
            </div>
          )}

          {/* 解析预览 */}
          {importPhase === ImportPhase.PREVIEW && parseResult && (
            <div className="space-y-6">
              {/* 解析摘要 */}
              <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
                <div className="flex items-center gap-2 text-sm">
                  <FileText className="w-4 h-4 text-gray-400" />
                  <span className="text-gray-500">
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
              <ImportValidationErrorList errors={parseResult.errors} />

              {/* 预览表格 */}
              <div className="overflow-x-auto rounded-lg border border-gray-200">
                <table className="min-w-full divide-y divide-[#1e3a5f]">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">
                        序号
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">
                        资产名称
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">
                        分类
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">
                        状态
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">
                        位置
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">
                        购置日期
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">
                        原值
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">
                        校验状态
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-[#1e3a5f]">
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
                  <p className="text-sm text-gray-500">
                    共 {displayRows.length} 行，第 {previewPage}/{previewTotalPages} 页
                  </p>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setPreviewPage((p) => Math.max(1, p - 1))}
                      disabled={previewPage <= 1}
                      className="inline-flex items-center gap-1 px-3 py-1.5 text-sm
                        rounded border border-gray-200 bg-white hover:bg-gray-50
                        disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      <ChevronLeft className="w-4 h-4" />
                      上一页
                    </button>
                    {/* 页码 */}
                    {Array.from({ length: Math.min(previewTotalPages, 5) }, (_, i) => {
                      let pageNum: number;
                      if (previewTotalPages <= 5) {
                        pageNum = i + 1;
                      } else if (previewPage <= 3) {
                        pageNum = i + 1;
                      } else if (previewPage >= previewTotalPages - 2) {
                        pageNum = previewTotalPages - 4 + i;
                      } else {
                        pageNum = previewPage - 2 + i;
                      }
                      return (
                        <button
                          key={pageNum}
                          type="button"
                          onClick={() => setPreviewPage(pageNum)}
                          className={`px-3 py-1.5 text-sm rounded border transition-colors
                            ${
                              previewPage === pageNum
                                ? 'bg-blue-600 text-white border-blue-600'
                                : 'border-gray-200 bg-white hover:bg-gray-50'
                            }`}
                        >
                          {pageNum}
                        </button>
                      );
                    })}
                    <button
                      type="button"
                      onClick={() =>
                        setPreviewPage((p) => Math.min(previewTotalPages, p + 1))
                      }
                      disabled={previewPage >= previewTotalPages}
                      className="inline-flex items-center gap-1 px-3 py-1.5 text-sm
                        rounded border border-gray-200 bg-white hover:bg-gray-50
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
                  onClick={handleReset}
                  className="px-4 py-2 text-sm rounded-lg border border-gray-200
                    bg-white text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  取消
                </button>
                <button
                  type="button"
                  onClick={handleCommit}
                  disabled={isImportBusy || !hasAnyValidRow}
                  className="inline-flex items-center gap-1.5 px-6 py-2.5 text-sm font-medium
                    rounded-lg bg-blue-600 text-white hover:bg-blue-700
                    disabled:opacity-50 disabled:cursor-not-allowed
                    transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {importPhase === ImportPhase.COMMITTING ? (
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

          {/* 导入完成 */}
          {(importPhase === ImportPhase.DONE || importPhase === ImportPhase.FAILED) && commitResult && (
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
                  onClick={handleReset}
                  className="px-4 py-2 text-sm rounded-lg border border-gray-200
                    bg-white text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  重新导入
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 导出 Tab 内容 */}
      {activeTab === 'export' && (
        <div className="space-y-6">
          {metaLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
              <span className="ml-3 text-sm text-gray-400">加载筛选数据...</span>
            </div>
          ) : metaError ? (
            <div className="p-6 bg-red-50 rounded-lg border border-red-200">
              <div className="flex items-center gap-2 text-red-700">
                <AlertCircle className="w-5 h-5" />
                <span className="text-sm">{metaError}</span>
              </div>
            </div>
          ) : (
            <ExportConfigPanel
              categories={categories}
              locations={locations}
              exporting={exporting}
              onExport={handleExport}
            />
          )}
        </div>
      )}
    </div>
  );
}
