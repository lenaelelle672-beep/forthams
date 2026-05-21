/**
 * 资产批量导入进度组件
 * @fileoverview 展示批量导入任务的实时进度状态
 * @module AssetBulkImport/ImportProgress
 * @requires react
 * @requires @/services/assetService
 * @design_reference SWARM-002 Phase 1
 */

import React, { useEffect, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { assetService } from '@/services/assetService';

/**
 * 导入任务状态枚举
 * @description 定义批量导入任务的完整生命周期状态
 */
export enum ImportTaskStatus {
  /** 等待上传 */
  PENDING = 'PENDING',
  /** 上传中 */
  UPLOADING = 'UPLOADING',
  /** 解析中 */
  PARSING = 'PARSING',
  /** 校验中 */
  VALIDATING = 'VALIDATING',
  /** 导入中 */
  IMPORTING = 'IMPORTING',
  /** 完成 */
  COMPLETED = 'COMPLETED',
  /** 失败 */
  FAILED = 'FAILED',
  /** 部分成功 */
  PARTIAL_SUCCESS = 'PARTIAL_SUCCESS',
}

/**
 * 导入任务结果数据结构
 * @description 包含导入任务的完整执行结果
 */
export interface ImportTaskResult {
  /** 任务唯一标识 */
  taskId: string;
  /** 任务状态 */
  status: ImportTaskStatus;
  /** 总行数 */
  totalRows: number;
  /** 已处理行数 */
  processedRows: number;
  /** 成功行数 */
  successCount: number;
  /** 失败行数 */
  failedCount: number;
  /** 错误详情列表 */
  errors: ImportErrorDetail[];
  /** 开始时间 */
  startTime: Date;
  /** 结束时间 */
  endTime?: Date;
  /** 文件名 */
  fileName: string;
}

/**
 * 导入错误详情
 * @description 单条导入错误的具体信息
 */
export interface ImportErrorDetail {
  /** 行号 */
  rowNumber: number;
  /** 错误字段 */
  field: string;
  /** 错误消息 */
  message: string;
  /** 原始数据 */
  originalValue?: string;
}

/**
 * ImportProgress 组件属性
 * @description 批量导入进度展示组件的输入参数
 */
export interface ImportProgressProps {
  /** 上传任务ID */
  taskId: string;
  /** 上传完成的回调 */
  onUploadComplete?: (result: ImportTaskResult) => void;
  /** 发生错误的回调 */
  onError?: (error: Error) => void;
  /** 轮询间隔(毫秒)，默认1000ms */
  pollInterval?: number;
  /** 是否自动开始轮询，默认true */
  autoPoll?: boolean;
}

/**
 * 格式化文件大小
 * @param bytes 字节数
 * @returns 格式化后的字符串
 */
const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
};

/**
 * 格式化时长
 * @param startTime 开始时间
 * @param endTime 结束时间
 * @returns 格式化后的时长字符串
 */
const formatDuration = (startTime: Date, endTime?: Date): string => {
  const end = endTime || new Date();
  const diff = Math.max(0, end.getTime() - startTime.getTime());
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  
  if (minutes > 0) {
    return `${minutes}分${remainingSeconds}秒`;
  }
  return `${seconds}秒`;
};

/**
 * 获取状态显示文本
 * @param status 任务状态
 * @param t 翻译函数
 * @returns 状态对应的翻译文本
 */
const getStatusText = (status: ImportTaskStatus, t: (key: string) => string): string => {
  const statusMap: Record<ImportTaskStatus, string> = {
    [ImportTaskStatus.PENDING]: t('import.status.pending'),
    [ImportTaskStatus.UPLOADING]: t('import.status.uploading'),
    [ImportTaskStatus.PARSING]: t('import.status.parsing'),
    [ImportTaskStatus.VALIDATING]: t('import.status.validating'),
    [ImportTaskStatus.IMPORTING]: t('import.status.importing'),
    [ImportTaskStatus.COMPLETED]: t('import.status.completed'),
    [ImportTaskStatus.FAILED]: t('import.status.failed'),
    [ImportTaskStatus.PARTIAL_SUCCESS]: t('import.status.partialSuccess'),
  };
  return statusMap[status] || status;
};

/**
 * 获取状态对应的颜色
 * @param status 任务状态
 * @returns Tailwind CSS 颜色类名
 */
const getStatusColor = (status: ImportTaskStatus): string => {
  const colorMap: Record<ImportTaskStatus, string> = {
    [ImportTaskStatus.PENDING]: 'text-gray-400',
    [ImportTaskStatus.UPLOADING]: 'text-blue-500',
    [ImportTaskStatus.PARSING]: 'text-blue-500',
    [ImportTaskStatus.VALIDATING]: 'text-blue-500',
    [ImportTaskStatus.IMPORTING]: 'text-blue-500',
    [ImportTaskStatus.COMPLETED]: 'text-green-500',
    [ImportTaskStatus.FAILED]: 'text-red-500',
    [ImportTaskStatus.PARTIAL_SUCCESS]: 'text-yellow-500',
  };
  return colorMap[status] || 'text-gray-400';
};

/**
 * 获取进度条填充颜色
 * @param status 任务状态
 * @returns Tailwind CSS 颜色类名
 */
const getProgressBarColor = (status: ImportTaskStatus): string => {
  const colorMap: Record<ImportTaskStatus, string> = {
    [ImportTaskStatus.PENDING]: 'bg-gray-400',
    [ImportTaskStatus.UPLOADING]: 'bg-blue-500',
    [ImportTaskStatus.PARSING]: 'bg-blue-500',
    [ImportTaskStatus.VALIDATING]: 'bg-blue-500',
    [ImportTaskStatus.IMPORTING]: 'bg-blue-500',
    [ImportTaskStatus.COMPLETED]: 'bg-green-500',
    [ImportTaskStatus.FAILED]: 'bg-red-500',
    [ImportTaskStatus.PARTIAL_SUCCESS]: 'bg-yellow-500',
  };
  return colorMap[status] || 'bg-gray-400';
};

/**
 * 资产批量导入进度组件
 * @description 展示批量导入任务的实时进度状态，包括上传进度、解析进度、导入进度
 * @param props ImportProgressProps
 * @returns React 组件
 * 
 * @example
 * ```tsx
 * <ImportProgress
 *   taskId="task-12345"
 *   onUploadComplete={(result) => console.log('完成:', result)}
 *   onError={(error) => console.error('错误:', error)}
 * />
 * ```
 */
const ImportProgress: React.FC<ImportProgressProps> = ({
  taskId,
  onUploadComplete,
  onError,
  pollInterval = 1000,
  autoPoll = true,
}) => {
  const { t } = useTranslation();
  const [taskResult, setTaskResult] = useState<ImportTaskResult | null>(null);
  const [isPolling, setIsPolling] = useState(autoPoll);
  const [isCancelled, setIsCancelled] = useState(false);

  /**
   * 获取任务状态
   * @description 轮询后端接口获取最新任务状态
   */
  const fetchTaskStatus = useCallback(async () => {
    if (!taskId || isCancelled) return;

    try {
      const result = await assetService.getImportProgress(taskId);
      setTaskResult(result);

      // 任务完成或失败时停止轮询
      if (
        result.status === ImportTaskStatus.COMPLETED ||
        result.status === ImportTaskStatus.FAILED ||
        result.status === ImportTaskStatus.PARTIAL_SUCCESS
      ) {
        setIsPolling(false);
        onUploadComplete?.(result);
      }
    } catch (error) {
      console.error('获取导入进度失败:', error);
      onError?.(error as Error);
      setIsPolling(false);
    }
  }, [taskId, isCancelled, onUploadComplete, onError]);

  /**
   * 取消导入任务
   * @description 用户主动取消导入操作
   */
  const handleCancel = useCallback(async () => {
    setIsCancelled(true);
    setIsPolling(false);
    try {
      await assetService.cancelImport(taskId);
    } catch (error) {
      console.error('取消导入失败:', error);
    }
  }, [taskId]);

  /**
   * 重新导入
   * @description 使用相同文件重新发起导入
   */
  const handleRetry = useCallback(() => {
    setIsCancelled(false);
    setIsPolling(true);
    if (taskResult?.fileName) {
      // 触发文件重新上传逻辑
      const fileInput = document.getElementById('asset-import-input') as HTMLInputElement;
      if (fileInput?.files?.[0]) {
        assetService.importAssets(fileInput.files[0]);
      }
    }
  }, [taskResult]);

  /**
   * 导出错误报告
   * @description 将错误详情导出为 CSV 文件
   */
  const handleExportErrors = useCallback(() => {
    if (!taskResult?.errors?.length) return;

    const headers = ['行号', '字段', '错误消息', '原始值'];
    const rows = taskResult.errors.map((error) => [
      error.rowNumber.toString(),
      error.field,
      error.message,
      error.originalValue || '',
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map((row) => row.map((cell) => `"${cell}"`).join(',')),
    ].join('\n');

    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `import_errors_${taskId}_${Date.now()}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
  }, [taskResult, taskId]);

  // 轮询效果
  useEffect(() => {
    if (!isPolling || !taskId) return;

    fetchTaskStatus();
    const intervalId = setInterval(fetchTaskStatus, pollInterval);

    return () => clearInterval(intervalId);
  }, [isPolling, taskId, pollInterval, fetchTaskStatus]);

  // 计算进度百分比
  const progressPercentage = taskResult
    ? Math.round((taskResult.processedRows / Math.max(taskResult.totalRows, 1)) * 100)
    : 0;

  // 计算成功率
  const successRate =
    taskResult && taskResult.totalRows > 0
      ? Math.round((taskResult.successCount / taskResult.totalRows) * 100)
      : 0;

  // 判断是否显示终止按钮
  const showCancelButton = [
    ImportTaskStatus.UPLOADING,
    ImportTaskStatus.PARSING,
    ImportTaskStatus.VALIDATING,
    ImportTaskStatus.IMPORTING,
  ].includes(taskResult?.status as ImportTaskStatus);

  // 判断是否显示重试按钮
  const showRetryButton =
    taskResult?.status === ImportTaskStatus.FAILED ||
    taskResult?.status === ImportTaskStatus.PARTIAL_SUCCESS;

  return (
    <div className="import-progress-container bg-white rounded-lg shadow-md p-6 max-w-2xl mx-auto">
      {/* 标题区 */}
      <div className="mb-6">
        <h2 className="text-xl font-semibold text-gray-800 mb-2">
          {t('import.progress.title')}
        </h2>
        {taskResult?.fileName && (
          <p className="text-sm text-gray-400">
            {t('import.progress.file')}: {taskResult.fileName}
          </p>
        )}
      </div>

      {/* 状态指示器 */}
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center">
          <div
            className={`w-3 h-3 rounded-full mr-2 ${getProgressBarColor(
              (taskResult?.status as ImportTaskStatus) || ImportTaskStatus.PENDING
            )}`}
          />
          <span
            className={`font-medium ${getStatusColor(
              (taskResult?.status as ImportTaskStatus) || ImportTaskStatus.PENDING
            )}`}
          >
            {getStatusText(
              (taskResult?.status as ImportTaskStatus) || ImportTaskStatus.PENDING,
              t
            )}
          </span>
        </div>
        {taskResult && (
          <span className="text-sm text-gray-400">
            {formatDuration(taskResult.startTime, taskResult.endTime)}
          </span>
        )}
      </div>

      {/* 进度条 */}
      <div className="mb-6">
        <div className="flex justify-between text-sm text-gray-500 mb-2">
          <span>
            {taskResult?.processedRows || 0} / {taskResult?.totalRows || 0} {t('import.progress.rows')}
          </span>
          <span>{progressPercentage}%</span>
        </div>
        <div className="w-full bg-blue-50 rounded-full h-2.5 overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-300 ${getProgressBarColor(
              (taskResult?.status as ImportTaskStatus) || ImportTaskStatus.PENDING
            )}`}
            style={{ width: `${progressPercentage}%` }}
          />
        </div>
      </div>

      {/* 统计信息 */}
      {taskResult && (
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="bg-green-50 rounded-lg p-4 text-center">
            <div className="text-2xl font-bold text-green-600">
              {taskResult.successCount}
            </div>
            <div className="text-sm text-gray-400">{t('import.progress.success')}</div>
          </div>
          <div className="bg-red-50 rounded-lg p-4 text-center">
            <div className="text-2xl font-bold text-red-600">
              {taskResult.failedCount}
            </div>
            <div className="text-sm text-gray-400">{t('import.progress.failed')}</div>
          </div>
          <div className="bg-blue-50 rounded-lg p-4 text-center">
            <div className="text-2xl font-bold text-blue-600">{successRate}%</div>
            <div className="text-sm text-gray-400">{t('import.progress.successRate')}</div>
          </div>
        </div>
      )}

      {/* 错误列表 */}
      {taskResult?.errors && taskResult.errors.length > 0 && (
        <div className="mb-6">
          <div className="flex justify-between items-center mb-2">
            <h3 className="text-sm font-medium text-gray-700">
              {t('import.progress.errorList')} ({taskResult.errors.length})
            </h3>
            <button
              onClick={handleExportErrors}
              className="text-sm text-blue-500 hover:text-blue-600"
            >
              {t('import.progress.exportErrors')}
            </button>
          </div>
          <div className="max-h-48 overflow-y-auto border border-gray-200 rounded-lg">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 sticky top-0">
                <tr>
                  <th className="px-4 py-2 text-left text-gray-400 font-medium">
                    {t('import.progress.table.row')}
                  </th>
                  <th className="px-4 py-2 text-left text-gray-400 font-medium">
                    {t('import.progress.table.field')}
                  </th>
                  <th className="px-4 py-2 text-left text-gray-400 font-medium">
                    {t('import.progress.table.message')}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1e3a5f]">
                {taskResult.errors.slice(0, 50).map((error, index) => (
                  <tr key={index} className="hover:bg-gray-50">
                    <td className="px-4 py-2 text-gray-500">{error.rowNumber}</td>
                    <td className="px-4 py-2 text-gray-500">{error.field}</td>
                    <td className="px-4 py-2 text-red-500">{error.message}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {taskResult.errors.length > 50 && (
              <div className="p-2 text-center text-sm text-gray-400 bg-gray-50">
                {t('import.progress.table.moreErrors', { count: taskResult.errors.length - 50 })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* 操作按钮 */}
      <div className="flex justify-end gap-3">
        {showCancelButton && (
          <button
            onClick={handleCancel}
            className="px-4 py-2 border border-gray-200 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
          >
            {t('import.progress.cancel')}
          </button>
        )}
        {showRetryButton && (
          <button
            onClick={handleRetry}
            className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
          >
            {t('import.progress.retry')}
          </button>
        )}
        {(taskResult?.status === ImportTaskStatus.COMPLETED ||
          taskResult?.status === ImportTaskStatus.PARTIAL_SUCCESS) && (
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors"
          >
            {t('import.progress.done')}
          </button>
        )}
      </div>
    </div>
  );
};

export default ImportProgress;
export type { ImportProgressProps, ImportTaskResult, ImportErrorDetail };