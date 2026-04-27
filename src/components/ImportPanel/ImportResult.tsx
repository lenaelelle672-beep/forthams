/**
 * ImportResult Component
 * 
 * 显示资产批量导入任务的结果，包括成功/失败状态、错误详情和报告下载功能。
 * 
 * @description
 * - 展示导入任务执行结果
 * - 显示成功导入的记录数
 * - 显示失败记录及其错误详情
 * - 支持错误报告 CSV 下载
 * 
 * @usage
 * ```tsx
 * <ImportResult 
 *   taskId="task_123"
 *   status="completed"
 *   successCount={450}
 *   failedCount={50}
 *   errors={errorList}
 *   onDownloadReport={handleDownload}
 * />
 * ```
 */

import React from 'react';
import { Download, AlertCircle, CheckCircle, XCircle, Clock } from 'lucide-react';

/**
 * 错误详情数据结构
 */
export interface ImportError {
  row_number: number;
  error_field: string;
  error_detail: string;
}

/**
 * 导入任务状态枚举
 */
export type ImportTaskStatus = 'pending' | 'processing' | 'completed' | 'failed';

/**
 * ImportResult 组件属性
 */
export interface ImportResultProps {
  /** 任务ID */
  taskId: string;
  /** 任务状态 */
  status: ImportTaskStatus;
  /** 成功导入的记录数 */
  successCount: number;
  /** 导入失败的记录数 */
  failedCount: number;
  /** 错误详情列表 */
  errors: ImportError[];
  /** 任务开始时间 */
  startTime?: Date;
  /** 任务完成时间 */
  endTime?: Date;
  /** 下载报告回调 */
  onDownloadReport: () => void;
  /** 下载错误报告回调 */
  onDownloadErrorReport?: () => void;
  /** 自定义类名 */
  className?: string;
}

/**
 * 获取状态图标组件
 * @param status 任务状态
 * @returns 对应的图标组件
 */
const getStatusIcon = (status: ImportTaskStatus): React.ReactNode => {
  switch (status) {
    case 'completed':
      return <CheckCircle className="w-6 h-6 text-green-500" />;
    case 'failed':
      return <XCircle className="w-6 h-6 text-red-500" />;
    case 'processing':
      return <Clock className="w-6 h-6 text-blue-500 animate-pulse" />;
    case 'pending':
      return <Clock className="w-6 h-6 text-gray-400" />;
    default:
      return null;
  }
};

/**
 * 获取状态文本描述
 * @param status 任务状态
 * @returns 状态描述文本
 */
const getStatusText = (status: ImportTaskStatus): string => {
  const statusMap: Record<ImportTaskStatus, string> = {
    pending: '等待中',
    processing: '处理中',
    completed: '已完成',
    failed: '失败'
  };
  return statusMap[status] || '未知状态';
};

/**
 * 格式化执行时间
 * @param start 开始时间
 * @param end 结束时间
 * @returns 格式化的时间字符串
 */
const formatDuration = (start?: Date, end?: Date): string => {
  if (!start || !end) return '-';
  const diff = end.getTime() - start.getTime();
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  
  if (minutes > 0) {
    return `${minutes}分${seconds % 60}秒`;
  }
  return `${seconds}秒`;
};

/**
 * ImportResult Component
 * 
 * 资产批量导入结果展示组件
 */
export const ImportResult: React.FC<ImportResultProps> = ({
  taskId,
  status,
  successCount,
  failedCount,
  errors,
  startTime,
  endTime,
  onDownloadReport,
  onDownloadErrorReport,
  className = ''
}) => {
  const totalCount = successCount + failedCount;
  const successRate = totalCount > 0 ? ((successCount / totalCount) * 100).toFixed(1) : '0';

  return (
    <div className={`bg-white rounded-lg shadow-md p-6 ${className}`}>
      {/* 标题与状态 */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          {getStatusIcon(status)}
          <div>
            <h3 className="text-lg font-semibold text-gray-800">
              导入结果 - {taskId}
            </h3>
            <p className="text-sm text-gray-500">
              状态: {getStatusText(status)}
            </p>
          </div>
        </div>
        
        {/* 操作按钮 */}
        <div className="flex gap-2">
          <button
            onClick={onDownloadReport}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
            disabled={status === 'processing'}
          >
            <Download className="w-4 h-4" />
            下载导入报告
          </button>
          
          {failedCount > 0 && onDownloadErrorReport && (
            <button
              onClick={onDownloadErrorReport}
              className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 transition-colors"
            >
              <AlertCircle className="w-4 h-4" />
              下载错误报告
            </button>
          )}
        </div>
      </div>

      {/* 统计卡片 */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="bg-green-50 rounded-lg p-4">
          <p className="text-sm text-gray-600 mb-1">成功导入</p>
          <p className="text-2xl font-bold text-green-600">{successCount}</p>
        </div>
        
        <div className="bg-red-50 rounded-lg p-4">
          <p className="text-sm text-gray-600 mb-1">导入失败</p>
          <p className="text-2xl font-bold text-red-600">{failedCount}</p>
        </div>
        
        <div className="bg-blue-50 rounded-lg p-4">
          <p className="text-sm text-gray-600 mb-1">成功率</p>
          <p className="text-2xl font-bold text-blue-600">{successRate}%</p>
        </div>
        
        <div className="bg-gray-50 rounded-lg p-4">
          <p className="text-sm text-gray-600 mb-1">执行时间</p>
          <p className="text-2xl font-bold text-gray-600">
            {formatDuration(startTime, endTime)}
          </p>
        </div>
      </div>

      {/* 错误详情列表 */}
      {failedCount > 0 && errors.length > 0 && (
        <div className="mt-6">
          <h4 className="text-md font-semibold text-gray-700 mb-3 flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-red-500" />
            错误详情
          </h4>
          
          <div className="border rounded-lg overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    行号
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    错误字段
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    错误详情
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {errors.slice(0, 20).map((error, index) => (
                  <tr key={index} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                    <td className="px-4 py-2 text-sm text-gray-900">
                      {error.row_number}
                    </td>
                    <td className="px-4 py-2 text-sm text-red-600 font-medium">
                      {error.error_field}
                    </td>
                    <td className="px-4 py-2 text-sm text-gray-700">
                      {error.error_detail}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            
            {errors.length > 20 && (
              <div className="bg-gray-50 px-4 py-3 text-sm text-gray-500 text-center">
                还有 {errors.length - 20} 条错误记录，请下载完整错误报告查看
              </div>
            )}
          </div>
        </div>
      )}

      {/* 全量失败提示 */}
      {failedCount > 0 && errors.length === 0 && (
        <div className="mt-6 p-4 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-red-700 flex items-center gap-2">
            <XCircle className="w-5 h-5" />
            导入过程中发生错误，请稍后重试或联系管理员
          </p>
        </div>
      )}

      {/* 全部成功提示 */}
      {failedCount === 0 && status === 'completed' && (
        <div className="mt-6 p-4 bg-green-50 border border-green-200 rounded-lg">
          <p className="text-green-700 flex items-center gap-2">
            <CheckCircle className="w-5 h-5" />
            所有 {successCount} 条资产数据已成功导入
          </p>
        </div>
      )}
    </div>
  );
};

export default ImportResult;