/**
 * AssetImportDialog — 资产批量导入弹窗组件
 *
 * SWARM-056: 提供文件选择/拖拽上传区域，支持下载导入模板，
 * 前端静态校验（格式 + 大小），两阶段导入（解析 → 确认提交），
 * 行级错误明细展示，以及导入成功后触发列表刷新。
 *
 * 状态机: IDLE → FILE_SELECTED → PARSING → PARSED → COMMITTING → SUCCESS / ERROR_DETAIL
 *
 * @module pages/assets/AssetImportDialog
 * @since SWARM-056
 */

import React, { useState, useCallback, useRef } from 'react';
import {
  Upload,
  Download,
  Loader2,
  AlertCircle,
  CheckCircle,
  X,
  FileSpreadsheet,
} from 'lucide-react';
import {
  downloadTemplate,
  parseImportFile,
  commitImport,
  validateImportFile,
  type ImportResult,
  type ImportErrorItem,
} from '../../services/importExportApi';
import type { ImportParseResponse, ImportParseError } from '../../services/assetService';

/* ------------------------------------------------------------------ */
/*  Props 定义                                                          */
/* ------------------------------------------------------------------ */

/**
 * AssetImportDialog 组件属性
 */
interface AssetImportDialogProps {
  /** 是否打开弹窗 */
  open: boolean;
  /** 关闭弹窗回调 */
  onClose: () => void;
  /** 导入成功后的回调，用于通知父组件刷新列表 */
  onImportSuccess: () => void;
}

/* ------------------------------------------------------------------ */
/*  导入状态机                                                          */
/* ------------------------------------------------------------------ */

/**
 * 导入阶段状态枚举
 *
 * @description 控制弹窗 UI 的完整生命周期
 * - IDLE: 初始态，未选择文件
 * - FILE_SELECTED: 已选择文件，等待用户确认
 * - PARSING: 文件正在上传解析
 * - PARSED: 解析完成，显示预览（如有错误则显示）
 * - COMMITTING: 正在提交确认导入
 * - SUCCESS: 导入成功
 * - ERROR_DETAIL: 提交后存在行级错误
 */
type ImportState =
  | 'IDLE'
  | 'FILE_SELECTED'
  | 'PARSING'
  | 'PARSED'
  | 'COMMITTING'
  | 'SUCCESS'
  | 'ERROR_DETAIL';

/* ------------------------------------------------------------------ */
/*  辅助函数                                                            */
/* ------------------------------------------------------------------ */

/**
 * 格式化文件大小为人类可读字符串
 *
 * @param bytes - 文件大小（字节）
 * @returns 格式化后的字符串
 */
function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

/* ------------------------------------------------------------------ */
/*  组件                                                                */
/* ------------------------------------------------------------------ */

/**
 * AssetImportDialog — 资产批量导入弹窗
 *
 * 支持文件选择/拖拽上传、下载模板、前端校验、两阶段导入（解析→提交）。
 * 在 API 调用期间全局禁用关闭按钮、遮罩层点击关闭及提交按钮，防止重复提交。
 *
 * @param props - 组件属性
 * @returns React 组件
 */
export default function AssetImportDialog({
  open,
  onClose,
  onImportSuccess,
}: AssetImportDialogProps) {
  // ---- 状态 -----------------------------------------------------------
  const [state, setState] = useState<ImportState>('IDLE');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [parseResponse, setParseResponse] = useState<ImportParseResponse | null>(null);
  const [commitErrors, setCommitErrors] = useState<ImportErrorItem[]>([]);
  const [importedCount, setImportedCount] = useState(0);
  const [failedCount, setFailedCount] = useState(0);
  const [apiError, setApiError] = useState<string | null>(null);

  // ---- Refs -----------------------------------------------------------
  const fileInputRef = useRef<HTMLInputElement>(null);

  /** 是否处于 API 调用中 */
  const isBusy = state === 'PARSING' || state === 'COMMITTING';

  /**
   * 重置所有状态到初始态
   */
  const resetState = useCallback(() => {
    setState('IDLE');
    setSelectedFile(null);
    setValidationError(null);
    setParseResponse(null);
    setCommitErrors([]);
    setImportedCount(0);
    setFailedCount(0);
    setApiError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, []);

  /**
   * 处理关闭弹窗
   */
  const handleClose = useCallback(() => {
    if (isBusy) return; // API 调用期间禁止关闭
    resetState();
    onClose();
  }, [isBusy, resetState, onClose]);

  /**
   * 处理文件选择
   *
   * @param file - 用户选择的文件
   */
  const handleFileSelect = useCallback((file: File) => {
    setValidationError(null);
    setApiError(null);
    setCommitErrors([]);
    setParseResponse(null);

    // 前端静态校验
    const error = validateImportFile(file);
    if (error) {
      setValidationError(error);
      setSelectedFile(null);
      setState('IDLE');
      return;
    }

    setSelectedFile(file);
    setState('FILE_SELECTED');
  }, []);

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
   * 触发文件选择器
   */
  const openFileDialog = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  /**
   * 下载导入模板
   */
  const handleDownloadTemplate = useCallback(async () => {
    try {
      await downloadTemplate('xlsx');
    } catch {
      // 模板下载失败不阻塞主流程，由 API 层处理错误提示
    }
  }, []);

  /**
   * 执行上传解析（第一阶段）
   */
  const handleParse = useCallback(async () => {
    if (!selectedFile) return;

    setState('PARSING');
    setApiError(null);

    try {
      const result = await parseImportFile(selectedFile);
      setParseResponse(result);

      if (result.errors && result.errors.length > 0) {
        // 有行级错误，进入 PARSED 状态让用户查看
        setState('PARSED');
      } else if (result.rows && result.rows.length > 0) {
        // 解析成功无错误，直接进入 PARSED 等待确认
        setState('PARSED');
      } else {
        // 空文件
        setApiError('文件内容为空，请检查后重试');
        setState('FILE_SELECTED');
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : '文件解析失败，请检查文件格式';
      setApiError(message);
      setState('FILE_SELECTED');
    }
  }, [selectedFile]);

  /**
   * 执行确认提交（第二阶段）
   */
  const handleCommit = useCallback(async () => {
    if (!parseResponse?.parseId) return;

    setState('COMMITTING');
    setApiError(null);

    try {
      const result = await commitImport(parseResponse.parseId);
      setImportedCount(result.importedCount);
      setFailedCount(result.failedCount);

      if (result.failedCount > 0) {
        // 有行级业务校验错误（如资产编号重复）
        setState('ERROR_DETAIL');
      } else {
        setState('SUCCESS');
        // 通知父组件刷新列表
        onImportSuccess();
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : '导入提交失败，请稍后重试';
      setApiError(message);
      setState('PARSED');
    }
  }, [parseResponse, onImportSuccess]);

  if (!open) return null;

  // ---- Render --------------------------------------------------------
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={isBusy ? undefined : handleClose}
      data-testid="import-dialog-overlay"
    >
      <div
        className="bg-white rounded-lg shadow-xl w-full max-w-lg mx-4 p-6 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
        data-testid="import-dialog"
      >
        {/* 标题栏 */}
        <div className="flex items-center justify-between mb-4">
          <h2
            className="text-lg font-semibold text-gray-900"
            data-testid="import-dialog-title"
          >
            批量导入资产
          </h2>
          <button
            type="button"
            onClick={handleClose}
            disabled={isBusy}
            className="text-gray-400 hover:text-gray-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            data-testid="import-btn-close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 下载模板链接 */}
        <div className="mb-4">
          <button
            type="button"
            onClick={handleDownloadTemplate}
            disabled={isBusy}
            className="inline-flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-800
              disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            data-testid="import-btn-download-template"
          >
            <Download className="w-4 h-4" />
            下载导入模板
          </button>
        </div>

        {/* 前端校验错误 */}
        {validationError && (
          <div
            className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-red-700 text-sm"
            data-testid="import-validation-error"
          >
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{validationError}</span>
          </div>
        )}

        {/* API 错误 */}
        {apiError && (
          <div
            className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-red-700 text-sm"
            data-testid="import-api-error"
          >
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{apiError}</span>
          </div>
        )}

        {/* 文件选择/拖拽区域 (IDLE / FILE_SELECTED 状态) */}
        {(state === 'IDLE' || state === 'FILE_SELECTED') && (
          <div
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onClick={openFileDialog}
            className={`mb-4 border-2 border-dashed rounded-lg p-8 text-center cursor-pointer
              transition-colors ${
                validationError
                  ? 'border-red-300 bg-red-50'
                  : selectedFile
                    ? 'border-green-300 bg-green-50'
                    : 'border-gray-300 bg-gray-50 hover:border-blue-400 hover:bg-blue-50'
              }`}
            data-testid="import-drop-zone"
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.csv"
              onChange={handleInputChange}
              className="hidden"
              data-testid="import-file-input"
            />
            {selectedFile ? (
              <div className="flex items-center justify-center gap-3">
                <FileSpreadsheet className="w-8 h-8 text-green-600" />
                <div className="text-left">
                  <p className="text-sm font-medium text-gray-900" data-testid="import-file-name">
                    {selectedFile.name}
                  </p>
                  <p className="text-xs text-gray-500" data-testid="import-file-size">
                    {formatFileSize(selectedFile.size)}
                  </p>
                </div>
              </div>
            ) : (
              <div>
                <Upload className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                <p className="text-sm text-gray-600">
                  点击或拖拽文件到此处上传
                </p>
                <p className="text-xs text-gray-400 mt-1">
                  仅支持 .xlsx 或 .csv 格式，文件大小不超过 5MB
                </p>
              </div>
            )}
          </div>
        )}

        {/* 解析中的 Loading 状态 */}
        {state === 'PARSING' && (
          <div className="mb-4 p-6 text-center" data-testid="import-parsing">
            <Loader2 className="w-8 h-8 animate-spin mx-auto mb-2 text-blue-600" />
            <p className="text-sm text-gray-600">正在解析文件...</p>
          </div>
        )}

        {/* 解析结果预览（PARSED 状态） */}
        {state === 'PARSED' && parseResponse && (
          <div className="mb-4" data-testid="import-parse-preview">
            <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-700 mb-3">
              <p>
                解析完成：共 {parseResponse.rows?.length ?? 0} 行数据
                {parseResponse.errors && parseResponse.errors.length > 0 && (
                  <span className="text-red-600">
                    ，{parseResponse.errors.length} 行存在错误
                  </span>
                )}
              </p>
            </div>

            {/* 行级解析错误列表 */}
            {parseResponse.errors && parseResponse.errors.length > 0 && (
              <div className="mb-3 max-h-40 overflow-y-auto">
                <table className="w-full text-xs border border-gray-200 rounded">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-2 py-1 text-left text-gray-600">行号</th>
                      <th className="px-2 py-1 text-left text-gray-600">字段</th>
                      <th className="px-2 py-1 text-left text-gray-600">错误信息</th>
                    </tr>
                  </thead>
                  <tbody>
                    {parseResponse.errors.map((err: ImportParseError, idx: number) => (
                      <tr key={idx} className="border-t border-gray-100">
                        <td className="px-2 py-1 text-red-600">{err.rowNumber}</td>
                        <td className="px-2 py-1 text-gray-700">{err.field}</td>
                        <td className="px-2 py-1 text-red-600">{err.message}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* 提交中 Loading */}
        {state === 'COMMITTING' && (
          <div className="mb-4 p-6 text-center" data-testid="import-committing">
            <Loader2 className="w-8 h-8 animate-spin mx-auto mb-2 text-blue-600" />
            <p className="text-sm text-gray-600">正在导入数据...</p>
          </div>
        )}

        {/* 成功提示 */}
        {state === 'SUCCESS' && (
          <div
            className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg flex items-center gap-2 text-green-700"
            data-testid="import-success-message"
          >
            <CheckCircle className="w-4 h-4 flex-shrink-0" />
            <span>成功导入 {importedCount} 条资产</span>
          </div>
        )}

        {/* 行级业务校验错误（提交后） */}
        {state === 'ERROR_DETAIL' && (
          <div className="mb-4" data-testid="import-error-detail">
            <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg text-sm mb-3">
              <p className="text-yellow-700">
                导入完成：成功 {importedCount} 条，失败 {failedCount} 条
              </p>
            </div>
            {commitErrors.length > 0 && (
              <div className="max-h-40 overflow-y-auto">
                <table className="w-full text-xs border border-gray-200 rounded">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-2 py-1 text-left text-gray-600">行号</th>
                      <th className="px-2 py-1 text-left text-gray-600">错误信息</th>
                    </tr>
                  </thead>
                  <tbody>
                    {commitErrors.map((err, idx) => (
                      <tr key={idx} className="border-t border-gray-100">
                        <td className="px-2 py-1 text-red-600">第 {err.rowNumber} 行</td>
                        <td className="px-2 py-1 text-red-600">{err.message}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* 操作按钮 */}
        <div className="flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={handleClose}
            disabled={isBusy}
            className="px-4 py-2 text-sm rounded-lg border border-gray-300
              bg-white text-gray-700 hover:bg-gray-50
              disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            data-testid="import-btn-cancel"
          >
            {state === 'SUCCESS' ? '完成' : '取消'}
          </button>

          {/* FILE_SELECTED → 开始解析 */}
          {state === 'FILE_SELECTED' && (
            <button
              type="button"
              onClick={handleParse}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-sm
                rounded-lg bg-blue-600 text-white hover:bg-blue-700
                transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500"
              data-testid="import-btn-parse"
            >
              <Upload className="w-4 h-4" />
              确认导入
            </button>
          )}

          {/* PARSED → 确认提交 */}
          {state === 'PARSED' && (
            <button
              type="button"
              onClick={handleCommit}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-sm
                rounded-lg bg-blue-600 text-white hover:bg-blue-700
                transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500"
              data-testid="import-btn-commit"
            >
              <Upload className="w-4 h-4" />
              确认提交
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
