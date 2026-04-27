/**
 * AssetBatchPage - 资产批量导入导出页面
 * 
 * 支持功能：
 * - CSV/Excel 格式的资产批量导入
 * - 资产列表数据导出为 CSV/Excel
 * - 导入进度跟踪与状态查询
 * - 导入数据校验与错误报告生成
 * 
 * @module AssetBatchPage
 * @description 资产批量导入导出功能的前端页面组件
 */

import React, { useState, useCallback, useRef } from 'react';
import { 
  Upload, 
  Download, 
  FileText, 
  CheckCircle, 
  XCircle, 
  AlertTriangle,
  Loader2,
  RefreshCw
} from 'lucide-react';

/** 导入任务状态枚举 */
export enum ImportTaskStatus {
  PENDING = 'PENDING',
  PROCESSING = 'PROCESSING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  PARTIAL_SUCCESS = 'PARTIAL_SUCCESS'
}

/** 导入任务数据模型 */
export interface ImportTask {
  id: string;
  fileName: string;
  fileType: 'csv' | 'xlsx';
  status: ImportTaskStatus;
  totalRows: number;
  successRows: number;
  failedRows: number;
  createdAt: string;
  completedAt?: string;
  errorReportUrl?: string;
}

/** 导入错误详情 */
export interface ImportError {
  row: number;
  field: string;
  value: string;
  reason: string;
}

/** 导出格式枚举 */
export type ExportFormat = 'csv' | 'xlsx';

/** 资产批量操作 API 响应 */
export interface BatchImportResponse {
  taskId: string;
  status: ImportTaskStatus;
  totalRows: number;
}

/** 导出参数 */
export interface ExportParams {
  format: ExportFormat;
  filters?: {
    assetType?: string;
    status?: string;
    startDate?: string;
    endDate?: string;
    department?: string;
  };
  page?: number;
  pageSize?: number;
}

const AssetBatchPage: React.FC = () => {
  // ==================== 状态管理 ====================
  const [activeTab, setActiveTab] = useState<'import' | 'export'>('import');
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [previewData, setPreviewData] = useState<string[][]>([]);
  const [importTasks, setImportTasks] = useState<ImportTask[]>([]);
  const [selectedTask, setSelectedTask] = useState<ImportTask | null>(null);
  const [importErrors, setImportErrors] = useState<ImportError[]>([]);
  
  // 导出相关状态
  const [exportFormat, setExportFormat] = useState<ExportFormat>('csv');
  const [isExporting, setIsExporting] = useState(false);
  const [exportFilters, setExportFilters] = useState<ExportParams['filters']>({});

  const fileInputRef = useRef<HTMLInputElement>(null);

  // ==================== 常量定义 ====================
  const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
  const MAX_ROWS = 5000;
  const PREVIEW_ROWS = 10;

  const SUPPORTED_FORMATS = {
    import: ['.csv', '.xlsx'],
    export: ['csv', 'xlsx']
  };

  // ==================== 工具函数 ====================

  /**
   * 格式化文件大小
   * @param bytes 字节数
   * @returns 格式化后的字符串
   */
  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
  };

  /**
   * 格式化日期时间
   * @param dateString ISO 日期字符串
   * @returns 格式化后的日期字符串
   */
  const formatDateTime = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  /**
   * 获取状态显示文本
   * @param status 任务状态
   * @returns 状态对应的中文描述
   */
  const getStatusText = (status: ImportTaskStatus): string => {
    const statusMap: Record<ImportTaskStatus, string> = {
      [ImportTaskStatus.PENDING]: '等待中',
      [ImportTaskStatus.PROCESSING]: '处理中',
      [ImportTaskStatus.COMPLETED]: '已完成',
      [ImportTaskStatus.FAILED]: '失败',
      [ImportTaskStatus.PARTIAL_SUCCESS]: '部分成功'
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
      [ImportTaskStatus.PENDING]: 'text-gray-500',
      [ImportTaskStatus.PROCESSING]: 'text-blue-500',
      [ImportTaskStatus.COMPLETED]: 'text-green-500',
      [ImportTaskStatus.FAILED]: 'text-red-500',
      [ImportTaskStatus.PARTIAL_SUCCESS]: 'text-yellow-500'
    };
    return colorMap[status] || 'text-gray-500';
  };

  // ==================== 文件处理 ====================

  /**
   * 处理文件选择
   * @param event 文件选择事件
   */
  const handleFileSelect = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // 验证文件大小
    if (file.size > MAX_FILE_SIZE) {
      alert(`文件大小超过限制（${MAX_FILE_SIZE / (1024 * 1024)}MB）`);
      return;
    }

    setUploadFile(file);
    setImportErrors([]);

    // 读取文件预览
    try {
      const text = await file.text();
      const lines = text.split('\n').slice(0, PREVIEW_ROWS + 1);
      const preview = lines.map(line => {
        // 简单 CSV 解析
        const result: string[] = [];
        let current = '';
        let inQuotes = false;
        
        for (const char of line) {
          if (char === '"') {
            inQuotes = !inQuotes;
          } else if (char === ',' && !inQuotes) {
            result.push(current.trim());
            current = '';
          } else {
            current += char;
          }
        }
        result.push(current.trim());
        return result;
      });
      setPreviewData(preview);
    } catch (error) {
      console.error('文件读取失败:', error);
      alert('文件读取失败，请检查文件格式');
    }
  }, []);

  /**
   * 触发文件选择器
   */
  const triggerFileInput = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  /**
   * 清除已选文件
   */
  const clearFile = useCallback(() => {
    setUploadFile(null);
    setPreviewData([]);
    setImportErrors([]);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, []);

  // ==================== 导入功能 ====================

  /**
   * 提交导入任务
   */
  const submitImport = useCallback(async () => {
    if (!uploadFile) return;

    setIsUploading(true);
    setUploadProgress(0);

    try {
      const formData = new FormData();
      formData.append('file', uploadFile);

      // 模拟上传进度
      const progressInterval = setInterval(() => {
        setUploadProgress(prev => Math.min(prev + 10, 90));
      }, 200);

      // 实际 API 调用
      // const response = await assetImportApi.uploadFile(formData);
      
      // 模拟响应
      const mockResponse: BatchImportResponse = {
        taskId: `task_${Date.now()}`,
        status: ImportTaskStatus.PENDING,
        totalRows: 100
      };

      clearInterval(progressInterval);
      setUploadProgress(100);

      // 添加到任务列表
      const newTask: ImportTask = {
        id: mockResponse.taskId,
        fileName: uploadFile.name,
        fileType: uploadFile.name.endsWith('.xlsx') ? 'xlsx' : 'csv',
        status: ImportTaskStatus.PROCESSING,
        totalRows: mockResponse.totalRows,
        successRows: 0,
        failedRows: 0,
        createdAt: new Date().toISOString()
      };

      setImportTasks(prev => [newTask, ...prev]);
      setSelectedTask(newTask);

      // 模拟异步任务完成
      setTimeout(() => {
        setImportTasks(prev => 
          prev.map(task => 
            task.id === newTask.id 
              ? { ...task, status: ImportTaskStatus.COMPLETED, successRows: task.totalRows, completedAt: new Date().toISOString() }
              : task
          )
        );
      }, 3000);

    } catch (error) {
      console.error('导入失败:', error);
      alert('导入失败，请重试');
    } finally {
      setIsUploading(false);
    }
  }, [uploadFile]);

  /**
   * 查询任务状态
   * @param taskId 任务ID
   */
  const pollTaskStatus = useCallback(async (taskId: string) => {
    try {
      // const response = await assetImportApi.getTaskStatus(taskId);
      // 模拟响应
      const mockTask: ImportTask = {
        id: taskId,
        fileName: 'sample.csv',
        fileType: 'csv',
        status: ImportTaskStatus.COMPLETED,
        totalRows: 100,
        successRows: 95,
        failedRows: 5,
        createdAt: new Date().toISOString(),
        completedAt: new Date().toISOString()
      };

      setImportTasks(prev => 
        prev.map(task => task.id === taskId ? mockTask : task)
      );

      if (selectedTask?.id === taskId) {
        setSelectedTask(mockTask);
      }
    } catch (error) {
      console.error('查询任务状态失败:', error);
    }
  }, [selectedTask]);

  /**
   * 下载错误报告
   * @param taskId 任务ID
   */
  const downloadErrorReport = useCallback(async (taskId: string) => {
    try {
      // const blob = await assetImportApi.downloadErrorReport(taskId);
      // const url = URL.createObjectURL(blob);
      // const a = document.createElement('a');
      // a.href = url;
      // a.download = `error_report_${taskId}.csv`;
      // a.click();
      // URL.revokeObjectURL(url);

      console.log('下载错误报告:', taskId);
    } catch (error) {
      console.error('下载错误报告失败:', error);
    }
  }, []);

  // ==================== 导出功能 ====================

  /**
   * 执行导出
   */
  const executeExport = useCallback(async () => {
    setIsExporting(true);

    try {
      const params: ExportParams = {
        format: exportFormat,
        filters: exportFilters
      };

      // const blob = await assetExportApi.exportAssets(params);
      // const url = URL.createObjectURL(blob);
      // const fileName = `assets_export_${new Date().toISOString().split('T')[0]}.${exportFormat}`;
      // const a = document.createElement('a');
      // a.href = url;
      // a.download = fileName;
      // a.click();
      // URL.revokeObjectURL(url);

      console.log('导出参数:', params);
      
      // 模拟导出完成
      setTimeout(() => {
        setIsExporting(false);
        alert('导出成功！');
      }, 1000);

    } catch (error) {
      console.error('导出失败:', error);
      alert('导出失败，请重试');
      setIsExporting(false);
    }
  }, [exportFormat, exportFilters]);

  /**
   * 刷新任务列表
   */
  const refreshTasks = useCallback(() => {
    // 重新获取任务列表
    // const fetchTasks = async () => {
    //   const tasks = await assetImportApi.getTaskList();
    //   setImportTasks(tasks);
    // };
    // fetchTasks();

    setImportTasks(prev => prev.map(task => ({ ...task })));
  }, []);

  // ==================== 渲染组件 ====================

  /**
   * 渲染导入标签页
   */
  const renderImportTab = () => (
    <div className="space-y-6">
      {/* 文件上传区域 */}
      <div 
        className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-primary-500 transition-colors cursor-pointer"
        onClick={triggerFileInput}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept={SUPPORTED_FORMATS.import.join(',')}
          onChange={handleFileSelect}
          className="hidden"
        />
        <Upload className="w-12 h-12 mx-auto text-gray-400 mb-4" />
        <p className="text-lg font-medium text-gray-700 mb-2">
          点击选择文件或拖拽文件到此处
        </p>
        <p className="text-sm text-gray-500">
          支持 CSV、XLSX 格式，单次最多 {MAX_ROWS} 条记录，文件不超过 {MAX_FILE_SIZE / (1024 * 1024)}MB
        </p>
      </div>

      {/* 已选文件信息 */}
      {uploadFile && (
        <div className="bg-gray-50 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <FileText className="w-8 h-8 text-primary-500" />
              <div>
                <p className="font-medium text-gray-900">{uploadFile.name}</p>
                <p className="text-sm text-gray-500">
                  {formatFileSize(uploadFile.size)}
                </p>
              </div>
            </div>
            <button
              onClick={clearFile}
              className="text-gray-400 hover:text-red-500 transition-colors"
            >
              <XCircle className="w-5 h-5" />
            </button>
          </div>

          {/* 上传进度 */}
          {isUploading && (
            <div className="mt-4">
              <div className="flex justify-between text-sm text-gray-600 mb-1">
                <span>上传中...</span>
                <span>{uploadProgress}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div 
                  className="bg-primary-500 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
            </div>
          )}

          {/* 导入按钮 */}
          {!isUploading && (
            <button
              onClick={submitImport}
              className="mt-4 w-full bg-primary-500 text-white py-2 px-4 rounded-lg hover:bg-primary-600 transition-colors flex items-center justify-center space-x-2"
            >
              <Upload className="w-4 h-4" />
              <span>开始导入</span>
            </button>
          )}
        </div>
      )}

      {/* 数据预览 */}
      {previewData.length > 0 && (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
            <h3 className="font-medium text-gray-700">数据预览（前{PREVIEW_ROWS}行）</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  {previewData[0]?.map((header, index) => (
                    <th 
                      key={index}
                      className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                    >
                      {header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {previewData.slice(1).map((row, rowIndex) => (
                  <tr key={rowIndex} className={rowIndex % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                    {row.map((cell, cellIndex) => (
                      <td 
                        key={cellIndex}
                        className="px-4 py-2 text-sm text-gray-700 whitespace-nowrap"
                      >
                        {cell || '-'}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 导入任务列表 */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="px-4 py-3 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
          <h3 className="font-medium text-gray-700">导入任务</h3>
          <button
            onClick={refreshTasks}
            className="text-gray-500 hover:text-primary-500 transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
        
        {importTasks.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            <FileText className="w-12 h-12 mx-auto text-gray-300 mb-2" />
            <p>暂无导入记录</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-200 max-h-96 overflow-y-auto">
            {importTasks.map(task => (
              <div 
                key={task.id}
                className={`p-4 hover:bg-gray-50 cursor-pointer transition-colors ${
                  selectedTask?.id === task.id ? 'bg-primary-50' : ''
                }`}
                onClick={() => setSelectedTask(task)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <FileText className="w-6 h-6 text-gray-400" />
                    <div>
                      <p className="font-medium text-gray-900">{task.fileName}</p>
                      <p className="text-sm text-gray-500">
                        {formatDateTime(task.createdAt)}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-4">
                    <span className={`flex items-center space-x-1 ${getStatusColor(task.status)}`}>
                      {task.status === ImportTaskStatus.PROCESSING ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : task.status === ImportTaskStatus.COMPLETED ? (
                        <CheckCircle className="w-4 h-4" />
                      ) : task.status === ImportTaskStatus.FAILED ? (
                        <XCircle className="w-4 h-4" />
                      ) : (
                        <AlertTriangle className="w-4 h-4" />
                      )}
                      <span className="text-sm font-medium">{getStatusText(task.status)}</span>
                    </span>
                  </div>
                </div>

                {/* 任务详情 */}
                {selectedTask?.id === task.id && (
                  <div className="mt-4 pt-4 border-t border-gray-200">
                    <div className="grid grid-cols-4 gap-4 text-sm">
                      <div>
                        <span className="text-gray-500">总行数：</span>
                        <span className="font-medium">{task.totalRows}</span>
                      </div>
                      <div>
                        <span className="text-gray-500">成功：</span>
                        <span className="text-green-600 font-medium">{task.successRows}</span>
                      </div>
                      <div>
                        <span className="text-gray-500">失败：</span>
                        <span className="text-red-600 font-medium">{task.failedRows}</span>
                      </div>
                      <div>
                        {task.errorReportUrl && (
                          <button
                            onClick={() => downloadErrorReport(task.id)}
                            className="text-primary-500 hover:text-primary-600"
                          >
                            下载错误报告
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 错误报告 */}
      {importErrors.length > 0 && (
        <div className="bg-red-50 rounded-lg border border-red-200 overflow-hidden">
          <div className="px-4 py-3 bg-red-100 border-b border-red-200 flex items-center space-x-2">
            <AlertTriangle className="w-5 h-5 text-red-500" />
            <h3 className="font-medium text-red-700">校验错误（{importErrors.length}条）</h3>
          </div>
          <div className="divide-y divide-red-200 max-h-64 overflow-y-auto">
            {importErrors.map((error, index) => (
              <div key={index} className="p-3">
                <p className="text-sm">
                  <span className="text-red-600 font-medium">第{error.row}行</span>
                  <span className="text-gray-500 ml-2">字段：{error.field}</span>
                </p>
                <p className="text-sm text-gray-600 mt-1">
                  值：「{error.value}」— {error.reason}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );

  /**
   * 渲染导出标签页
   */
  const renderExportTab = () => (
    <div className="space-y-6">
      {/* 导出设置 */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h3 className="font-medium text-gray-700 mb-4">导出设置</h3>
        
        {/* 导出格式 */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            导出格式
          </label>
          <div className="flex space-x-4">
            <label className="flex items-center space-x-2 cursor-pointer">
              <input
                type="radio"
                name="exportFormat"
                value="csv"
                checked={exportFormat === 'csv'}
                onChange={() => setExportFormat('csv')}
                className="w-4 h-4 text-primary-500"
              />
              <span>CSV</span>
            </label>
            <label className="flex items-center space-x-2 cursor-pointer">
              <input
                type="radio"
                name="exportFormat"
                value="xlsx"
                checked={exportFormat === 'xlsx'}
                onChange={() => setExportFormat('xlsx')}
                className="w-4 h-4 text-primary-500"
              />
              <span>Excel (.xlsx)</span>
            </label>
          </div>
        </div>

        {/* 筛选条件 */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              资产类型
            </label>
            <select
              value={exportFilters.assetType || ''}
              onChange={e => setExportFilters(prev => ({ ...prev, assetType: e.target.value }))}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-primary-500 focus:border-primary-500"
            >
              <option value="">全部</option>
              <option value="EQUIPMENT">设备</option>
              <option value="FURNITURE">家具</option>
              <option value="VEHICLE">车辆</option>
              <option value="IT_HARDWARE">IT硬件</option>
              <option value="OTHER">其他</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              资产状态
            </label>
            <select
              value={exportFilters.status || ''}
              onChange={e => setExportFilters(prev => ({ ...prev, status: e.target.value }))}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-primary-500 focus:border-primary-500"
            >
              <option value="">全部</option>
              <option value="ACTIVE">在用</option>
              <option value="INACTIVE">闲置</option>
              <option value="MAINTENANCE">维护中</option>
              <option value="RETIRED">已退役</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              开始日期
            </label>
            <input
              type="date"
              value={exportFilters.startDate || ''}
              onChange={e => setExportFilters(prev => ({ ...prev, startDate: e.target.value }))}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-primary-500 focus:border-primary-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              结束日期
            </label>
            <input
              type="date"
              value={exportFilters.endDate || ''}
              onChange={e => setExportFilters(prev => ({ ...prev, endDate: e.target.value }))}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-primary-500 focus:border-primary-500"
            />
          </div>
        </div>

        {/* 导出按钮 */}
        <button
          onClick={executeExport}
          disabled={isExporting}
          className="mt-6 w-full bg-primary-500 text-white py-3 px-4 rounded-lg hover:bg-primary-600 transition-colors flex items-center justify-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isExporting ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              <span>导出中...</span>
            </>
          ) : (
            <>
              <Download className="w-5 h-5" />
              <span>导出资产数据</span>
            </>
          )}
        </button>
      </div>

      {/* 导出说明 */}
      <div className="bg-gray-50 rounded-lg p-4">
        <h4 className="font-medium text-gray-700 mb-2">导出说明</h4>
        <ul className="list-disc list-inside text-sm text-gray-600 space-y-1">
          <li>导出文件将自动下载到本地</li>
          <li>文件名格式：assets_export_YYYY-MM-DD.{exportFormat}</li>
          <li>CSV 编码为 UTF-8，支持 Excel 直接打开</li>
          <li>如需导出大量数据，建议分时间段导出</li>
        </ul>
      </div>
    </div>
  );

  // ==================== 主渲染 ====================
  return (
    <div className="min-h-screen bg-gray-100">
      <div className="max-w-6xl mx-auto py-8 px-4">
        {/* 页面标题 */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900">资产批量操作</h1>
          <p className="text-gray-500 mt-1">支持 Excel/CSV 格式的批量导入导出</p>
        </div>

        {/* 标签切换 */}
        <div className="bg-white rounded-lg shadow-sm mb-6">
          <div className="flex border-b border-gray-200">
            <button
              onClick={() => setActiveTab('import')}
              className={`px-6 py-4 font-medium transition-colors ${
                activeTab === 'import'
                  ? 'text-primary-600 border-b-2 border-primary-600'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <Upload className="w-5 h-5 inline mr-2" />
              批量导入
            </button>
            <button
              onClick={() => setActiveTab('export')}
              className={`px-6 py-4 font-medium transition-colors ${
                activeTab === 'export'
                  ? 'text-primary-600 border-b-2 border-primary-600'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <Download className="w-5 h-5 inline mr-2" />
              批量导出
            </button>
          </div>

          {/* 标签内容 */}
          <div className="p-6">
            {activeTab === 'import' ? renderImportTab() : renderExportTab()}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AssetBatchPage;