/**
 * AssetBatchImportDialog — 资产批量导入对话框组件
 *
 * 模态弹窗形式提供文件选择、校验、上传的完整导入流程。
 * 使用 useAssetImportExport Hook 管理导入状态与 API 调用。
 *
 * 状态机：IDLE -> UPLOADING -> COMPLETED | PARTIAL_SUCCESS | FAILED
 * 文件格式：仅允许 .xlsx 和 .csv
 * 文件大小：单次上传硬性上限 10MB
 *
 * @module components/asset/AssetBatchImportDialog
 * @since SWARM-031
 */

import React, { useState, useCallback, useRef } from 'react';
import { Upload, Loader2, FileText, AlertCircle, X, CheckCircle } from 'lucide-react';
import { useAssetImportExport } from '../../hooks/useAssetImportExport';
import type { AssetImportResponse } from '../../hooks/useAssetImportExport';

/* ------------------------------------------------------------------ */
/*  Props 类型                                                         */
/* ------------------------------------------------------------------ */

/**
 * AssetBatchImportDialog 组件属性
 */
export interface AssetBatchImportDialogProps {
  /** 是否显示对话框 */
  open: boolean;
  /** 关闭回调 */
  onClose: () => void;
  /** 导入成功回调（可选） */
  onSuccess?: (result: AssetImportResponse) => void;
}

/* ------------------------------------------------------------------ */
/*  组件实现                                                           */
/* ------------------------------------------------------------------ */

/**
 * AssetBatchImportDialog — 资产批量导入对话框
 *
 * 弹窗内提供文件选择区域、校验提示、上传按钮和结果展示。
 * 导入完成后展示成功/失败条数及明细列表。
 *
 * @param props - 组件属性
 * @returns React 组件
 *
 * @example
 * ```tsx
 * const [open, setOpen] = useState(false);
 * <AssetBatchImportDialog
 *   open={open}
 *   onClose={() => setOpen(false)}
 *   onSuccess={(result) => { refreshList(); }}
 * />
 * ```
 */
export function AssetBatchImportDialog({
  open,
  onClose,
  onSuccess,
}: AssetBatchImportDialogProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  /** 已选择的文件 */
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  /** 前端校验错误 */
  const [validationError, setValidationError] = useState<string | null>(null);

  /** 导入结果 */
  const [importResult, setImportResult] = useState<AssetImportResponse | null>(null);

  const { importing, importFile, validateFileType, validateFileSize } =
    useAssetImportExport();

  /**
   * 处理文件选择
   *
   * @param event - 文件输入变化事件
   */
  const handleFileSelect = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      setValidationError(null);
      setImportResult(null);

      if (!file) return;

      if (!validateFileType(file.name)) {
        setValidationError('仅支持 .xlsx 或 .csv 格式');
        return;
      }

      if (!validateFileSize(file.size)) {
        setValidationError('文件大小不能超过 10MB');
        return;
      }

      setSelectedFile(file);
    },
    [validateFileType, validateFileSize],
  );

  /**
   * 执行上传导入
   */
  const handleUpload = useCallback(async () => {
    if (!selectedFile) return;

    const result = await importFile(selectedFile);
    if (result) {
      setImportResult(result);
      onSuccess?.(result);
    }
  }, [selectedFile, importFile, onSuccess]);

  /**
   * 重置状态
   */
  const handleReset = useCallback(() => {
    setSelectedFile(null);
    setValidationError(null);
    setImportResult(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, []);

  /**
   * 关闭对话框并重置
   */
  const handleClose = useCallback(() => {
    handleReset();
    onClose();
  }, [handleReset, onClose]);

  /** 导入结果状态判定 */
  const resultStatus = importResult?.status ?? 'FAILED';

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* 遮罩层 */}
      <div
        className="absolute inset-0 bg-black/50"
        onClick={handleClose}
        role="presentation"
      />

      {/* 对话框主体 */}
      <div
        className="relative bg-white rounded-xl shadow-2xl w-full max-w-2xl
          max-h-[90vh] overflow-y-auto mx-4"
        role="dialog"
        aria-modal="true"
        aria-label="批量导入资产"
      >
        {/* 头部 */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">批量导入资产</h2>
          <button
            type="button"
            onClick={handleClose}
            className="p-1 rounded-lg text-gray-400 hover:text-gray-600
              hover:bg-gray-100 transition-colors"
            aria-label="关闭"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 内容区 */}
        <div className="px-6 py-4 space-y-4">
          {/* 说明文字 */}
          <p className="text-sm text-gray-500">
            上传标准 Excel/CSV 文件批量创建资产，支持 .xlsx 和 .csv 格式，单文件最大 10MB
          </p>

          {/* 文件选择区域 */}
          {!importResult && (
            <>
              <label
                htmlFor="batch-import-dialog-file"
                className={`flex flex-col items-center justify-center w-full h-40
                  border-2 border-dashed rounded-xl cursor-pointer transition-colors
                  ${
                    importing
                      ? 'border-gray-200 bg-gray-50 cursor-not-allowed'
                      : 'border-gray-300 bg-white hover:border-blue-400 hover:bg-blue-50'
                  }
                  ${validationError ? 'border-red-300 bg-red-50' : ''}
                `}
              >
                <div className="flex flex-col items-center justify-center pt-5 pb-6">
                  {importing ? (
                    <Loader2 className="w-8 h-8 text-blue-500 animate-spin mb-2" />
                  ) : (
                    <Upload className="w-8 h-8 text-gray-400 mb-2" />
                  )}
                  <p className="text-sm text-gray-500">
                    {importing ? '正在导入...' : '点击选择文件或拖拽至此处'}
                  </p>
                  <p className="text-xs text-gray-400">支持 .xlsx 和 .csv 格式，最大 10MB</p>
                </div>
                <input
                  id="batch-import-dialog-file"
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx,.csv"
                  onChange={handleFileSelect}
                  disabled={importing}
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

              {/* 已选择文件 */}
              {selectedFile && (
                <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
                  <div className="flex items-center gap-3">
                    <FileText className="w-5 h-5 text-gray-500" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {selectedFile.name}
                      </p>
                      <p className="text-xs text-gray-500">
                        {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}

          {/* 导入结果 */}
          {importResult && (
            <div className="space-y-4">
              {/* 结果摘要 */}
              <div
                className={`p-4 rounded-lg border ${
                  resultStatus === 'COMPLETED'
                    ? 'bg-green-50 border-green-200'
                    : resultStatus === 'PARTIAL_SUCCESS'
                    ? 'bg-yellow-50 border-yellow-200'
                    : 'bg-red-50 border-red-200'
                }`}
              >
                <div className="flex items-center gap-2 mb-2">
                  {resultStatus === 'COMPLETED' ? (
                    <CheckCircle className="w-5 h-5 text-green-600" />
                  ) : (
                    <AlertCircle className="w-5 h-5 text-yellow-600" />
                  )}
                  <span className="font-medium text-gray-900">
                    {resultStatus === 'COMPLETED'
                      ? '导入完成'
                      : resultStatus === 'PARTIAL_SUCCESS'
                      ? '部分成功'
                      : '导入失败'}
                  </span>
                </div>
                <div className="flex gap-4 text-sm">
                  <span className="text-green-700">
                    成功：{importResult.successCount} 条
                  </span>
                  {importResult.failCount > 0 && (
                    <span className="text-red-700">
                      失败：{importResult.failCount} 条
                    </span>
                  )}
                </div>
              </div>

              {/* 失败明细列表 */}
              {importResult.details.length > 0 && importResult.failCount > 0 && (
                <div className="max-h-48 overflow-y-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-200">
                        <th className="py-2 text-left text-gray-600 font-medium">行号</th>
                        <th className="py-2 text-left text-gray-600 font-medium">资产名称</th>
                        <th className="py-2 text-left text-gray-600 font-medium">状态</th>
                        <th className="py-2 text-left text-gray-600 font-medium">错误原因</th>
                      </tr>
                    </thead>
                    <tbody>
                      {importResult.details.map((item, idx) => (
                        <tr key={idx} className="border-b border-gray-100">
                          <td className="py-1.5 text-gray-600">{item.row ?? '-'}</td>
                          <td className="py-1.5 text-gray-900">{item.assetName ?? '-'}</td>
                          <td className="py-1.5">
                            <span
                              className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                                item.status === 'success'
                                  ? 'bg-green-100 text-green-800'
                                  : 'bg-red-100 text-red-800'
                              }`}
                            >
                              {item.status === 'success' ? '成功' : '失败'}
                            </span>
                          </td>
                          <td className="py-1.5 text-red-600">
                            {item.errorMessage ?? '-'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>

        {/* 底部按钮 */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-200">
          {importResult ? (
            <>
              <button
                type="button"
                onClick={handleReset}
                className="px-4 py-2 text-sm rounded-lg border border-gray-300
                  bg-white text-gray-700 hover:bg-gray-50 transition-colors"
              >
                重新导入
              </button>
              <button
                type="button"
                onClick={handleClose}
                className="px-4 py-2 text-sm rounded-lg bg-blue-600 text-white
                  hover:bg-blue-700 transition-colors"
              >
                完成
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={handleClose}
                disabled={importing}
                className="px-4 py-2 text-sm rounded-lg border border-gray-300
                  bg-white text-gray-700 hover:bg-gray-50
                  disabled:opacity-50 transition-colors"
              >
                取消
              </button>
              <button
                type="button"
                onClick={handleUpload}
                disabled={!selectedFile || importing}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-sm
                  rounded-lg bg-blue-600 text-white hover:bg-blue-700
                  disabled:opacity-50 disabled:cursor-not-allowed
                  transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {importing ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    导入中...
                  </>
                ) : (
                  <>
                    <Upload className="w-4 h-4" />
                    开始导入
                  </>
                )}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
