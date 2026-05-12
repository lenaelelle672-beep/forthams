/**
 * AssetExportDialog — 资产导出弹窗组件
 *
 * SWARM-056: 基于当前 AssetListPage 筛选条件，将资产列表导出为 Excel/CSV 文件。
 * 支持同步导出（直接下载）和异步导出（后端任务提交提示）两种模式。
 *
 * @module pages/assets/AssetExportDialog
 * @since SWARM-056
 */

import React, { useState, useCallback } from 'react';
import { Download, Loader2, AlertCircle, CheckCircle } from 'lucide-react';
import { exportAssets, type ExportQueryParams } from '../../services/importExportApi';

/* ------------------------------------------------------------------ */
/*  Props 定义                                                          */
/* ------------------------------------------------------------------ */

/**
 * AssetExportDialog 组件属性
 */
interface AssetExportDialogProps {
  /** 是否打开弹窗 */
  open: boolean;
  /** 关闭弹窗回调 */
  onClose: () => void;
  /** 当前 AssetListPage 的筛选条件 */
  currentFilters: ExportQueryParams;
}

/* ------------------------------------------------------------------ */
/*  导出状态机                                                          */
/* ------------------------------------------------------------------ */

/**
 * 导出状态枚举
 */
type ExportState = 'IDLE' | 'EXPORTING' | 'SUCCESS' | 'FAILED';

/* ------------------------------------------------------------------ */
/*  组件                                                                */
/* ------------------------------------------------------------------ */

/**
 * AssetExportDialog — 资产导出弹窗
 *
 * 接收父组件传入的筛选条件，调用后端导出 API 触发文件下载。
 * 支持同步导出和异步导出两种模式，提供 loading 禁用防重提交。
 *
 * @param props - 组件属性
 * @returns React 组件
 */
export default function AssetExportDialog({
  open,
  onClose,
  currentFilters,
}: AssetExportDialogProps) {
  const [state, setState] = useState<ExportState>('IDLE');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  /**
   * 重置弹窗状态
   */
  const resetState = useCallback(() => {
    setState('IDLE');
    setErrorMessage(null);
  }, []);

  /**
   * 处理关闭弹窗
   */
  const handleClose = useCallback(() => {
    resetState();
    onClose();
  }, [resetState, onClose]);

  /**
   * 执行导出操作
   */
  const handleExport = useCallback(async () => {
    setState('EXPORTING');
    setErrorMessage(null);

    try {
      await exportAssets(currentFilters);
      setState('SUCCESS');

      // 成功后 1.5 秒自动关闭
      setTimeout(() => {
        handleClose();
      }, 1500);
    } catch (err) {
      const message = err instanceof Error ? err.message : '导出失败，请稍后重试';
      setErrorMessage(message);
      setState('FAILED');
    }
  }, [currentFilters, handleClose]);

  if (!open) return null;

  // ---- Render ----
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={handleClose}
      data-testid="export-dialog-overlay"
    >
      <div
        className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4 p-6"
        onClick={(e) => e.stopPropagation()}
        data-testid="export-dialog"
      >
        {/* 标题 */}
        <h2 className="text-lg font-semibold text-gray-900 mb-4" data-testid="export-dialog-title">
          导出资产列表
        </h2>

        {/* 筛选条件预览 */}
        <div className="mb-4 p-3 bg-gray-50 rounded-lg text-sm text-gray-600">
          <p className="font-medium text-gray-700 mb-1">当前筛选条件：</p>
          {currentFilters.keyword && (
            <p>关键词：{currentFilters.keyword}</p>
          )}
          {currentFilters.status && (
            <p>状态：{currentFilters.status}</p>
          )}
          {currentFilters.categoryId && (
            <p>分类ID：{currentFilters.categoryId}</p>
          )}
          {currentFilters.departmentId && (
            <p>部门ID：{currentFilters.departmentId}</p>
          )}
          {!currentFilters.keyword && !currentFilters.status &&
            !currentFilters.categoryId && !currentFilters.departmentId && (
            <p>无筛选条件（将导出全部数据）</p>
          )}
        </div>

        {/* 成功提示 */}
        {state === 'SUCCESS' && (
          <div
            className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg flex items-center gap-2 text-green-700"
            data-testid="export-success-message"
          >
            <CheckCircle className="w-4 h-4 flex-shrink-0" />
            <span>导出任务已提交，文件正在下载...</span>
          </div>
        )}

        {/* 错误提示 */}
        {state === 'FAILED' && errorMessage && (
          <div
            className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-red-700"
            data-testid="export-error-message"
          >
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* 操作按钮 */}
        <div className="flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={handleClose}
            disabled={state === 'EXPORTING'}
            className="px-4 py-2 text-sm rounded-lg border border-gray-300
              bg-white text-gray-700 hover:bg-gray-50
              disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            data-testid="export-btn-cancel"
          >
            取消
          </button>
          <button
            type="button"
            onClick={handleExport}
            disabled={state === 'EXPORTING' || state === 'SUCCESS'}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-sm
              rounded-lg bg-blue-600 text-white hover:bg-blue-700
              disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            data-testid="export-btn-confirm"
          >
            {state === 'EXPORTING' ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                导出中...
              </>
            ) : state === 'SUCCESS' ? (
              <>
                <CheckCircle className="w-4 h-4" />
                已提交
              </>
            ) : (
              <>
                <Download className="w-4 h-4" />
                确认导出
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
