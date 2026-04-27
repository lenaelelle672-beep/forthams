/**
 * 资产批量导入面板组件
 * 
 * 功能说明：
 * - 支持 CSV/Excel 格式的资产批量导入
 * - 支持导入数据预览与校验
 * - 支持导入进度跟踪与状态查询
 * - 支持错误报告下载
 * 
 * @module ImportPanel
 */

import React, { useState, useCallback, useRef } from 'react';
import { Upload, FileText, AlertCircle, CheckCircle, XCircle, Download, Loader2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';

// 导入状态枚举
export enum ImportStatus {
  IDLE = 'IDLE',
  UPLOADING = 'UPLOADING',
  VALIDATING = 'VALIDATING',
  PROCESSING = 'PROCESSING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
}

// 导入任务结果接口
export interface ImportTaskResult {
  taskId: string;
  status: ImportStatus;
  totalRows: number;
  successCount: number;
  failCount: number;
  errors: ImportError[];
  createdAt: string;
  completedAt?: string;
}

// 导入错误详情接口
export interface ImportError {
  row: number;
  field: string;
  value: string;
  reason: string;
}

// 导入配置接口
export interface ImportConfig {
  /** 支持的文件类型 */
  acceptTypes: string[];
  /** 最大文件大小 (MB) */
  maxFileSize: number;
  /** 最大导入记录数 */
  maxRecords: number;
  /** 异步导入阈值 */
  asyncThreshold: number;
}

// 默认导入配置
export const DEFAULT_IMPORT_CONFIG: ImportConfig = {
  acceptTypes: ['.csv', '.xlsx'],
  maxFileSize: 10,
  maxRecords: 5000,
  asyncThreshold: 1000,
};

// 导入面板组件属性接口
export interface ImportPanelProps {
  /** 上传地址 */
  uploadUrl: string;
  /** 导入配置 */
  config?: Partial<ImportConfig>;
  /** 导入成功回调 */
  onImportSuccess?: (result: ImportTaskResult) => void;
  /** 导入失败回调 */
  onImportError?: (error: Error) => void;
  /** 任务状态变更回调 */
  onStatusChange?: (status: ImportStatus) => void;
}

// 文件预览数据类型
interface FilePreviewData {
  headers: string[];
  rows: string[][];
  totalRows: number;
}

/**
 * 格式化文件大小显示
 * 
 * @param bytes 字节数
 * @returns 格式化后的字符串
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * 验证文件类型
 * 
 * @param fileName 文件名
 * @param acceptTypes 支持的类型列表
 * @returns 是否有效
 */
export function validateFileType(fileName: string, acceptTypes: string[]): boolean {
  const ext = '.' + fileName.split('.').pop()?.toLowerCase();
  return acceptTypes.includes(ext);
}

/**
 * 验证文件大小
 * 
 * @param fileSize 文件大小（字节）
 * @param maxSize 最大文件大小（MB）
 * @returns 是否有效
 */
export function validateFileSize(fileSize: number, maxSize: number): boolean {
  return fileSize <= maxSize * 1024 * 1024;
}

/**
 * 格式化导入状态为显示文本
 * 
 * @param status 导入状态
 * @returns 状态显示文本
 */
export function formatImportStatus(status: ImportStatus): string {
  const statusMap: Record<ImportStatus, string> = {
    [ImportStatus.IDLE]: '待上传',
    [ImportStatus.UPLOADING]: '上传中',
    [ImportStatus.VALIDATING]: '校验中',
    [ImportStatus.PROCESSING]: '处理中',
    [ImportStatus.COMPLETED]: '已完成',
    [ImportStatus.FAILED]: '失败',
  };
  return statusMap[status] || status;
}

/**
 * 导入面板组件
 * 
 * 功能特性：
 * - 支持拖拽上传
 * - 支持 CSV/Excel 文件
 * - 实时显示上传进度
 * - 数据预览（前100行）
 * - 导入结果展示
 */
export const ImportPanel: React.FC<ImportPanelProps> = ({
  uploadUrl,
  config = {},
  onImportSuccess,
  onImportError,
  onStatusChange,
}) => {
  const { t } = useTranslation();
  const mergedConfig = { ...DEFAULT_IMPORT_CONFIG, ...config };
  
  const [status, setStatus] = useState<ImportStatus>(ImportStatus.IDLE);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewData, setPreviewData] = useState<FilePreviewData | null>(null);
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [importResult, setImportResult] = useState<ImportTaskResult | null>(null);
  const [errorMessage, setErrorMessage] = useState<string>('');
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  /**
   * 处理文件选择
   */
  const handleFileSelect = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // 验证文件类型
    if (!validateFileType(file.name, mergedConfig.acceptTypes)) {
      setErrorMessage(`不支持的文件类型，请上传 ${mergedConfig.acceptTypes.join(', ')} 格式`);
      return;
    }

    // 验证文件大小
    if (!validateFileSize(file.size, mergedConfig.maxFileSize)) {
      setErrorMessage(`文件大小超过限制，最大 ${mergedConfig.maxFileSize}MB`);
      return;
    }

    setSelectedFile(file);
    setErrorMessage('');
    setImportResult(null);
    
    // 触发预览数据加载
    parseFilePreview(file);
  }, [mergedConfig]);

  /**
   * 解析文件预览数据
   */
  const parseFilePreview = async (file: File) => {
    try {
      // 此处调用文件解析服务获取预览数据
      // 实际实现需要集成 CSV/Excel 解析器
      setPreviewData({
        headers: ['asset_id', 'asset_name', 'asset_type', 'serial_number', 'purchase_date', 
                  'purchase_price', 'currency', 'department', 'custodian', 'status', 'location', 'remarks'],
        rows: [],
        totalRows: 0,
      });
    } catch (error) {
      setErrorMessage('文件解析失败');
    }
  };

  /**
   * 处理文件拖拽
   */
  const handleDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.stopPropagation();
  }, []);

  /**
   * 处理文件拖放
   */
  const handleDrop = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.stopPropagation();
    
    const file = event.dataTransfer.files?.[0];
    if (file) {
      // 触发文件选择逻辑
      const input = fileInputRef.current;
      if (input) {
        const dataTransfer = new DataTransfer();
        dataTransfer.items.add(file);
        input.files = dataTransfer.files;
        input.dispatchEvent(new Event('change', { bubbles: true }));
      }
    }
  }, []);

  /**
   * 触发文件上传
   */
  const handleUpload = useCallback(async () => {
    if (!selectedFile) return;

    setStatus(ImportStatus.UPLOADING);
    setUploadProgress(0);
    setErrorMessage('');
    onStatusChange?.(ImportStatus.UPLOADING);

    abortControllerRef.current = new AbortController();

    try {
      const formData = new FormData();
      formData.append('file', selectedFile);

      const xhr = new XMLHttpRequest();
      
      xhr.upload.addEventListener('progress', (e) => {
        if (e.lengthComputable) {
          const progress = Math.round((e.loaded / e.total) * 100);
          setUploadProgress(progress);
        }
      });

      xhr.addEventListener('load', () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          const response = JSON.parse(xhr.responseText);
          handleImportResponse(response);
        } else {
          throw new Error(`上传失败: ${xhr.statusText}`);
        }
      });

      xhr.addEventListener('error', () => {
        throw new Error('网络错误，请重试');
      });

      xhr.open('POST', uploadUrl);
      xhr.setRequestHeader('Authorization', `Bearer ${localStorage.getItem('token')}`);
      xhr.send(formData);

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '未知错误';
      setStatus(ImportStatus.FAILED);
      setErrorMessage(errorMessage);
      onImportError?.(new Error(errorMessage));
      onStatusChange?.(ImportStatus.FAILED);
    }
  }, [selectedFile, uploadUrl, onImportSuccess, onImportError, onStatusChange]);

  /**
   * 处理导入响应
   */
  const handleImportResponse = (response: {
    taskId: string;
    status: string;
    totalRows: number;
  }) => {
    if (response.status === 'async') {
      // 异步导入，轮询任务状态
      setStatus(ImportStatus.PROCESSING);
      onStatusChange?.(ImportStatus.PROCESSING);
      pollTaskStatus(response.taskId);
    } else {
      // 同步导入，直接返回结果
      setStatus(ImportStatus.COMPLETED);
      onStatusChange?.(ImportStatus.COMPLETED);
    }
  };

  /**
   * 轮询任务状态
   */
  const pollTaskStatus = async (taskId: string) => {
    const pollInterval = setInterval(async () => {
      try {
        const response = await fetch(`${uploadUrl}/tasks/${taskId}`, {
          headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` },
        });
        
        if (!response.ok) {
          clearInterval(pollInterval);
          throw new Error('查询任务状态失败');
        }

        const result: ImportTaskResult = await response.json();
        setImportResult(result);

        if (result.status === ImportStatus.COMPLETED || result.status === ImportStatus.FAILED) {
          clearInterval(pollInterval);
          setStatus(result.status);
          onStatusChange?.(result.status);
          
          if (result.status === ImportStatus.COMPLETED) {
            onImportSuccess?.(result);
          } else {
            setErrorMessage(`导入失败，共 ${result.failCount} 条记录错误`);
            onImportError?.(new Error('导入失败'));
          }
        }
      } catch (error) {
        clearInterval(pollInterval);
        setStatus(ImportStatus.FAILED);
        setErrorMessage('查询任务状态失败');
        onImportError?.(error instanceof Error ? error : new Error('未知错误'));
      }
    }, 2000);

    // 30分钟超时
    setTimeout(() => clearInterval(pollInterval), 30 * 60 * 1000);
  };

  /**
   * 下载错误报告
   */
  const handleDownloadReport = useCallback(() => {
    if (!importResult?.taskId) return;

    const link = document.createElement('a');
    link.href = `${uploadUrl}/tasks/${importResult.taskId}/report`;
    link.download = `import_error_report_${importResult.taskId}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }, [importResult, uploadUrl]);

  /**
   * 取消上传
   */
  const handleCancel = useCallback(() => {
    abortControllerRef.current?.abort();
    setStatus(ImportStatus.IDLE);
    setUploadProgress(0);
    setSelectedFile(null);
    setPreviewData(null);
    onStatusChange?.(ImportStatus.IDLE);
  }, [onStatusChange]);

  /**
   * 清除选择
   */
  const handleClear = useCallback(() => {
    setSelectedFile(null);
    setPreviewData(null);
    setErrorMessage('');
    setImportResult(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, []);

  /**
   * 获取状态图标
   */
  const getStatusIcon = (currentStatus: ImportStatus) => {
    switch (currentStatus) {
      case ImportStatus.UPLOADING:
      case ImportStatus.VALIDATING:
      case ImportStatus.PROCESSING:
        return <Loader2 className="animate-spin" />;
      case ImportStatus.COMPLETED:
        return <CheckCircle className="text-green-500" />;
      case ImportStatus.FAILED:
        return <XCircle className="text-red-500" />;
      default:
        return null;
    }
  };

  return (
    <div className="import-panel bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      {/* 标题 */}
      <div className="mb-6">
        <h2 className="text-xl font-semibold text-gray-800 flex items-center gap-2">
          <Upload className="w-5 h-5" />
          资产批量导入
        </h2>
        <p className="text-sm text-gray-500 mt-1">
          支持 CSV/Excel 格式，单次最多导入 {mergedConfig.maxRecords} 条记录
        </p>
      </div>

      {/* 上传区域 */}
      <div
        className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors cursor-pointer
          ${selectedFile ? 'border-blue-400 bg-blue-50' : 'border-gray-300 hover:border-blue-400 hover:bg-gray-50'}
          ${status !== ImportStatus.IDLE ? 'opacity-50 pointer-events-none' : ''}`}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        onClick={() => status === ImportStatus.IDLE && fileInputRef.current?.click()}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept={mergedConfig.acceptTypes.join(',')}
          onChange={handleFileSelect}
          className="hidden"
        />
        
        {!selectedFile ? (
          <>
            <FileText className="w-12 h-12 mx-auto text-gray-400 mb-4" />
            <p className="text-gray-600 mb-2">拖拽文件到此处，或点击选择文件</p>
            <p className="text-sm text-gray-400">
              支持 {mergedConfig.acceptTypes.join(', ')} 格式，最大 {mergedConfig.maxFileSize}MB
            </p>
          </>
        ) : (
          <>
            <FileText className="w-12 h-12 mx-auto text-blue-500 mb-4" />
            <p className="text-gray-800 font-medium">{selectedFile.name}</p>
            <p className="text-sm text-gray-500 mt-1">
              {formatFileSize(selectedFile.size)}
            </p>
          </>
        )}
      </div>

      {/* 错误提示 */}
      {errorMessage && (
        <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-red-700 font-medium">导入失败</p>
            <p className="text-red-600 text-sm mt-1">{errorMessage}</p>
          </div>
        </div>
      )}

      {/* 预览数据 */}
      {previewData && selectedFile && status === ImportStatus.IDLE && (
        <div className="mt-6">
          <h3 className="text-lg font-medium text-gray-700 mb-3">数据预览</h3>
          <div className="overflow-x-auto border border-gray-200 rounded-lg">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">#</th>
                  {previewData.headers.map((header, index) => (
                    <th key={index} className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      {header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {previewData.rows.slice(0, 100).map((row, rowIndex) => (
                  <tr key={rowIndex} className={rowIndex % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                    <td className="px-4 py-2 text-gray-500">{rowIndex + 1}</td>
                    {row.map((cell, cellIndex) => (
                      <td key={cellIndex} className="px-4 py-2 text-gray-700 truncate max-w-xs">
                        {cell}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {previewData.totalRows > 100 && (
            <p className="text-sm text-gray-500 mt-2 text-center">
              共 {previewData.totalRows} 条记录，显示前 100 条
            </p>
          )}
        </div>
      )}

      {/* 导入结果 */}
      {importResult && (
        <div className="mt-6 p-4 bg-gray-50 border border-gray-200 rounded-lg">
          <div className="flex items-center gap-2 mb-4">
            {getStatusIcon(importResult.status)}
            <span className="font-medium text-gray-700">
              导入完成：{formatImportStatus(importResult.status)}
            </span>
          </div>
          
          <div className="grid grid-cols-3 gap-4 text-sm">
            <div className="text-center p-3 bg-white rounded border">
              <p className="text-2xl font-bold text-blue-600">{importResult.totalRows}</p>
              <p className="text-gray-500">总记录数</p>
            </div>
            <div className="text-center p-3 bg-white rounded border">
              <p className="text-2xl font-bold text-green-600">{importResult.successCount}</p>
              <p className="text-gray-500">成功</p>
            </div>
            <div className="text-center p-3 bg-white rounded border">
              <p className="text-2xl font-bold text-red-600">{importResult.failCount}</p>
              <p className="text-gray-500">失败</p>
            </div>
          </div>

          {importResult.failCount > 0 && (
            <div className="mt-4">
              <button
                onClick={handleDownloadReport}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
              >
                <Download className="w-4 h-4" />
                下载错误报告
              </button>
            </div>
          )}
        </div>
      )}

      {/* 操作按钮 */}
      <div className="mt-6 flex items-center justify-end gap-3">
        {status !== ImportStatus.IDLE && (
          <button
            onClick={handleCancel}
            className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded hover:bg-gray-50 transition-colors"
            disabled={status === ImportStatus.COMPLETED || status === ImportStatus.FAILED}
          >
            取消
          </button>
        )}
        
        {selectedFile && status === ImportStatus.IDLE && (
          <>
            <button
              onClick={handleClear}
              className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded hover:bg-gray-50 transition-colors"
            >
              清除
            </button>
            <button
              onClick={handleUpload}
              className="px-6 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors flex items-center gap-2"
            >
              <Upload className="w-4 h-4" />
              开始导入
            </button>
          </>
        )}
      </div>

      {/* 上传进度条 */}
      {(status === ImportStatus.UPLOADING || status === ImportStatus.VALIDATING || status === ImportStatus.PROCESSING) && (
        <div className="mt-4">
          <div className="flex items-center justify-between text-sm text-gray-600 mb-2">
            <span>{formatImportStatus(status)}</span>
            <span>{uploadProgress}%</span>
          </div>
          <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-blue-600 transition-all duration-300"
              style={{ width: `${uploadProgress}%` }}
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default ImportPanel;