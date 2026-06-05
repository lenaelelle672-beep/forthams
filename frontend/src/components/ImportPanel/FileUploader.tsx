/**
 * FileUploader Component
 * 
 * 资产批量导入文件上传组件
 * 
 * 功能特性：
 * - 支持 CSV/Excel (.xlsx) 文件拖拽上传
 * - 文件大小校验（最大 10MB）
 * - 文件类型校验（仅允许 .csv/.xlsx）
 * - 数据预览（显示前100行）
 * - 导入进度显示
 * - 错误报告下载
 * 
 * 字段映射（12个核心字段）：
 * - asset_id (可选, 导入时为空则自动生成)
 * - asset_name (必填, 最大50字符)
 * - asset_type (必填, 枚举: EQUIPMENT/FURNITURE/VEHICLE/IT_HARDWARE/OTHER)
 * - serial_number (可选, 最大100字符)
 * - purchase_date (必填, YYYY-MM-DD格式)
 * - purchase_price (必填, >0, 最多2位小数)
 * - currency (必填, 默认CNY)
 * - department (必填, 需匹配已存在的部门编码)
 * - custodian (可选, 最大100字符)
 * - status (必填, 枚举: ACTIVE/INACTIVE/MAINTENANCE/RETIRED)
 * - location (可选, 最大200字符)
 * - remarks (可选, 最大500字符)
 */

import React, { useState, useCallback, useRef } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, FileText, X, AlertCircle, CheckCircle, Download, Loader2 } from 'lucide-react';
import { Button } from '../ui/Button';
import { Progress } from '../ui/Progress';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../ui/Card';
import { Badge } from '../ui/Badge';
import { cn } from '@/lib/utils';
import { parseImportFile, commitImport } from '@/api/assetImport';
import type { ParseResponse, CommitResponse } from '@/api/assetImport';

// 文件大小限制：10MB
const MAX_FILE_SIZE = 10 * 1024 * 1024;

// 支持的文件类型
const ALLOWED_EXTENSIONS = ['.csv', '.xlsx'];
const ALLOWED_MIME_TYPES = [
  'text/csv',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/csv'
];

// 导入状态枚举
type ImportStatus = 'idle' | 'uploading' | 'validating' | 'importing' | 'success' | 'error';

// 错误行数据结构
interface ValidationError {
  row: number;
  field: string;
  value: string;
  reason: string;
}

// 导入结果数据结构
interface ImportResult {
  taskId: string;
  status: 'completed' | 'failed' | 'partial';
  totalRows: number;
  successRows: number;
  failedRows: number;
  errors: ValidationError[];
  reportUrl?: string;
}

// 组件 Props 定义
interface FileUploaderProps {
  /** 上传成功回调 */
  onUploadSuccess?: (taskId: string, result: ImportResult) => void;
  /** 上传失败回调 */
  onUploadError?: (error: Error) => void;
  /** 导入进度回调 */
  onProgress?: (progress: number, status: ImportStatus) => void;
  /** 自定义类名 */
  className?: string;
  /** 是否禁用上传 */
  disabled?: boolean;
}

/**
 * 文件上传组件
 * 
 * @param props - 组件属性
 * @returns React 组件
 */
export function FileUploader({
  onUploadSuccess,
  onUploadError,
  onProgress,
  className,
  disabled = false
}: FileUploaderProps) {
  // 状态管理
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [status, setStatus] = useState<ImportStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [previewData, setPreviewData] = useState<string[][] | null>(null);
  const [validationErrors, setValidationErrors] = useState<ValidationError[] | null>(null);
  
  // Refs
  const abortControllerRef = useRef<AbortController | null>(null);

  /**
   * 验证文件大小
   * @param file - 待验证的文件
   * @returns 验证结果
   */
  const validateFileSize = (file: File): { valid: boolean; error?: string } => {
    if (file.size > MAX_FILE_SIZE) {
      return {
        valid: false,
        error: `文件大小超过限制（${MAX_FILE_SIZE / 1024 / 1024}MB），当前文件 ${(file.size / 1024 / 1024).toFixed(2)}MB`
      };
    }
    return { valid: true };
  };

  /**
   * 验证文件类型
   * @param file - 待验证的文件
   * @returns 验证结果
   */
  const validateFileType = (file: File): { valid: boolean; error?: string } => {
    const extension = '.' + file.name.split('.').pop()?.toLowerCase();
    const mimeType = file.type;
    
    const isValidExtension = ALLOWED_EXTENSIONS.includes(extension);
    const isValidMimeType = ALLOWED_MIME_TYPES.includes(mimeType) || isValidExtension;
    
    if (!isValidExtension && !isValidMimeType) {
      return {
        valid: false,
        error: `不支持的文件类型，请上传 ${ALLOWED_EXTENSIONS.join(' 或 ')} 格式文件`
      };
    }
    return { valid: true };
  };

  /**
   * 处理文件预览
   * @param file - 待预览的文件
   */
  const handleFilePreview = useCallback(async (file: File) => {
    try {
      const extension = '.' + file.name.split('.').pop()?.toLowerCase();
      
      if (extension === '.csv') {
        // CSV 文件预览
        const text = await file.text();
        const lines = text.split('\n').slice(0, 101); // 读取前100行
        const preview = lines.map(line => line.split(','));
        setPreviewData(preview);
      } else if (extension === '.xlsx') {
        // Excel 文件预览（需要 xlsx 库支持）
        // 此处简化处理，实际项目中需要引入 xlsx 库
        setPreviewData([['Excel预览需要后端支持']]);
      }
    } catch (err) {
      console.error('文件预览失败:', err);
    }
  }, []);

  /**
   * 处理文件上传
   * @param file - 待上传的文件
   */
  const handleUpload = useCallback(async (file: File) => {
    setError(null);
    setImportResult(null);
    setValidationErrors(null);
    
    // 1. 文件大小校验
    const sizeValidation = validateFileSize(file);
    if (!sizeValidation.valid) {
      setError(sizeValidation.error || '文件大小验证失败');
      onUploadError?.(new Error(sizeValidation.error));
      return;
    }
    
    // 2. 文件类型校验
    const typeValidation = validateFileType(file);
    if (!typeValidation.valid) {
      setError(typeValidation.error || '文件类型验证失败');
      onUploadError?.(new Error(typeValidation.error));
      return;
    }
    
    setSelectedFile(file);
    setStatus('uploading');
    setUploadProgress(0);
    onProgress?.(0, 'uploading');
    
    // 初始化 AbortController
    abortControllerRef.current = new AbortController();
    
    try {
      // 3. 文件预览
      await handleFilePreview(file);
      setUploadProgress(20);
      onProgress?.(20, 'validating');
      setStatus('validating');
      
      // 检查是否已取消
      if (abortControllerRef.current?.signal.aborted) {
        throw new Error('上传已取消');
      }

      setUploadProgress(40);
      onProgress?.(40, 'importing');
      setStatus('importing');

      // 4. 调用真实解析 API
      const parseResult: ParseResponse = await parseImportFile(file, (progress) => {
        const actualProgress = 40 + progress * 0.3;
        setUploadProgress(actualProgress);
        onProgress?.(actualProgress, 'importing');
      });

      // 检查是否已取消
      if (abortControllerRef.current?.signal.aborted) {
        throw new Error('上传已取消');
      }

      // 5. 处理解析结果
      if (parseResult.errors && parseResult.errors.length > 0) {
        // 有校验错误
        const mappedErrors: ValidationError[] = parseResult.errors.map((err) => ({
          row: err.rowNumber,
          field: err.field,
          value: '',
          reason: err.message,
        }));
        setValidationErrors(mappedErrors);
        setStatus('error');
        setImportResult({
          taskId: parseResult.parseId,
          status: 'failed',
          totalRows: parseResult.rows.length,
          successRows: 0,
          failedRows: parseResult.errors.length,
          errors: mappedErrors,
        });
        onProgress?.(100, 'error');
        onUploadError?.(new Error('文件校验失败'));
        return;
      }

      // 6. 无错误，自动提交
      setUploadProgress(70);
      onProgress?.(70, 'importing');

      const commitResult: CommitResponse = await commitImport(parseResult.parseId, parseResult.rows);

      // 检查是否已取消
      if (abortControllerRef.current?.signal.aborted) {
        throw new Error('上传已取消');
      }

      setUploadProgress(100);

      // 7. 映射结果到 ImportResult
      const totalRows = (commitResult.importedCount || 0) + (commitResult.failedCount || 0);
      const result: ImportResult = {
        taskId: parseResult.parseId,
        status: commitResult.success ? 'completed' : 'failed',
        totalRows,
        successRows: commitResult.importedCount || 0,
        failedRows: commitResult.failedCount || 0,
        errors: [],
      };

      setImportResult(result);

      if (result.status === 'completed') {
        setStatus('success');
        onProgress?.(100, 'success');
        onUploadSuccess?.(result.taskId, result);
      } else {
        setStatus('error');
        setError('导入失败');
        onProgress?.(100, 'error');
        onUploadError?.(new Error('导入失败'));
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '文件上传失败';
      setError(errorMessage);
      setStatus('error');
      onProgress?.(0, 'error');
      onUploadError?.(err instanceof Error ? err : new Error(errorMessage));
    }
  }, [handleFilePreview, onUploadSuccess, onUploadError, onProgress]);

  /**
   * 下载错误报告
   */
  const handleDownloadReport = useCallback(() => {
    if (!importResult?.reportUrl) return;
    
    // 创建下载链接
    const link = document.createElement('a');
    link.href = importResult.reportUrl;
    link.download = `import_error_report_${importResult.taskId}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }, [importResult]);

  /**
   * 取消上传
   */
  const handleCancel = useCallback(() => {
    abortControllerRef.current?.abort();
    setStatus('idle');
    setUploadProgress(0);
    setSelectedFile(null);
    setError(null);
    onProgress?.(0, 'idle');
  }, [onProgress]);

  /**
   * 清除选择
   */
  const handleClear = useCallback(() => {
    setSelectedFile(null);
    setPreviewData(null);
    setImportResult(null);
    setValidationErrors(null);
    setError(null);
    setStatus('idle');
    setUploadProgress(0);
    onProgress?.(0, 'idle');
  }, [onProgress]);

  /**
   * Dropzone 回调
   */
  const onDrop = useCallback((acceptedFiles: File[]) => {
    if (acceptedFiles.length > 0) {
      handleUpload(acceptedFiles[0]);
    }
  }, [handleUpload]);

  /**
   * Dropzone 配置
   */
  const { getRootProps, getInputProps, isDragActive, isDragReject } = useDropzone({
    onDrop,
    accept: {
      'text/csv': ['.csv'],
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx']
    },
    maxFiles: 1,
    maxSize: MAX_FILE_SIZE,
    disabled: disabled || status === 'uploading' || status === 'importing'
  });

  /**
   * 格式化文件大小
   * @param bytes - 字节数
   * @returns 格式化字符串
   */
  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + ' KB';
    return (bytes / 1024 / 1024).toFixed(2) + ' MB';
  };

  /**
   * 获取状态徽章
   * @param currentStatus - 当前状态
   * @returns 徽章配置
   */
  const getStatusBadge = (currentStatus: ImportStatus) => {
    const badges: Record<ImportStatus, { label: string; variant: 'default' | 'success' | 'danger' | 'warning' | 'gray' }> = {
      idle: { label: '等待上传', variant: 'gray' },
      uploading: { label: '上传中', variant: 'default' },
      validating: { label: '校验中', variant: 'warning' },
      importing: { label: '导入中', variant: 'default' },
      success: { label: '导入成功', variant: 'success' },
      error: { label: '导入失败', variant: 'danger' }
    };
    return badges[currentStatus];
  };

  return (
    <Card className={cn('w-full', className)}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Upload className="h-5 w-5" />
          资产批量导入
        </CardTitle>
        <CardDescription>
          支持 CSV 和 Excel (.xlsx) 格式，单次最多导入 5000 条记录，文件大小不超过 10MB
        </CardDescription>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* 上传区域 */}
        <div
          {...getRootProps()}
          className={cn(
            'border-2 border-dashed rounded-lg p-8 text-center transition-colors cursor-pointer',
            isDragActive && 'border-primary bg-primary/5',
            isDragReject && 'border-destructive bg-destructive/5',
            (disabled || status === 'uploading' || status === 'importing') && 'opacity-50 cursor-not-allowed',
            selectedFile && 'border-success bg-success/5'
          )}
        >
          <input {...getInputProps()} />
          
          {!selectedFile ? (
            <div className="space-y-2">
              <Upload className={cn(
                'h-12 w-12 mx-auto',
                isDragActive ? 'text-primary' : 'text-muted-foreground'
              )} />
              <div>
                <p className="text-lg font-medium">
                  {isDragActive ? '释放文件开始上传' : '拖拽文件到此处'}
                </p>
                <p className="text-sm text-muted-foreground">
                  或点击选择文件（支持 CSV、Excel 格式）
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <FileText className="h-12 w-12 mx-auto text-primary" />
              <div>
                <p className="text-lg font-medium">{selectedFile.name}</p>
                <p className="text-sm text-muted-foreground">
                  {formatFileSize(selectedFile.size)}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* 错误提示 */}
        {error && (
          <div className="flex items-start gap-2 p-3 rounded-lg bg-destructive/10 text-destructive">
            <AlertCircle className="h-5 w-5 mt-0.5 flex-shrink-0" />
            <div className="flex-1">
              <p className="font-medium">上传失败</p>
              <p className="text-sm">{error}</p>
            </div>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setError(null);
              }}
              className="p-1 hover:bg-destructive/20 rounded"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        {/* 进度显示 */}
        {(status === 'uploading' || status === 'validating' || status === 'importing') && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span className="text-sm font-medium">{getStatusBadge(status).label}</span>
              </div>
              <Badge variant={getStatusBadge(status).variant}>
                {Math.round(uploadProgress)}%
              </Badge>
            </div>
            <Progress value={uploadProgress} className="h-2" />
          </div>
        )}

        {/* 导入结果 */}
        {importResult && (
          <div className="space-y-3 p-4 rounded-lg bg-muted/50">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {importResult.status === 'completed' ? (
                  <CheckCircle className="h-5 w-5 text-success" />
                ) : (
                  <AlertCircle className="h-5 w-5 text-destructive" />
                )}
                <span className="font-medium">
                  {importResult.status === 'completed' ? '导入完成' : '导入完成（部分失败）'}
                </span>
              </div>
              <Badge variant={importResult.status === 'completed' ? 'success' : 'warning'}>
                {getStatusBadge(status).label}
              </Badge>
            </div>
            
            <div className="grid grid-cols-4 gap-4 text-sm">
              <div>
                <p className="text-muted-foreground">总记录数</p>
                <p className="text-xl font-semibold">{importResult.totalRows}</p>
              </div>
              <div>
                <p className="text-muted-foreground">成功</p>
                <p className="text-xl font-semibold text-success">{importResult.successRows}</p>
              </div>
              <div>
                <p className="text-muted-foreground">失败</p>
                <p className="text-xl font-semibold text-destructive">{importResult.failedRows}</p>
              </div>
              <div>
                <p className="text-muted-foreground">任务ID</p>
                <p className="text-sm font-mono">{importResult.taskId.slice(0, 12)}...</p>
              </div>
            </div>

            {validationErrors && validationErrors.length > 0 && (
              <div className="mt-4">
                <p className="text-sm font-medium mb-2">校验错误（前5条）：</p>
                <div className="space-y-1 text-sm max-h-32 overflow-y-auto">
                  {validationErrors.slice(0, 5).map((err, idx) => (
                    <div key={idx} className="flex gap-2 text-destructive">
                      <span>第{err.row}行</span>
                      <span>字段: {err.field}</span>
                      <span>值: {err.value}</span>
                      <span>原因: {err.reason}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {importResult.failedRows > 0 && importResult.reportUrl && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleDownloadReport}
                className="mt-2"
              >
                <Download className="h-4 w-4 mr-2" />
                下载错误报告
              </Button>
            )}
          </div>
        )}

        {/* 数据预览 */}
        {previewData && previewData.length > 0 && (
          <div className="space-y-2">
            <p className="text-sm font-medium">数据预览（前100行）</p>
            <div className="overflow-x-auto border rounded-lg">
              <table className="w-full text-xs">
                <thead className="bg-muted">
                  <tr>
                    <th className="px-2 py-1 text-left font-medium">#</th>
                    {previewData[0]?.map((header, idx) => (
                      <th key={idx} className="px-2 py-1 text-left font-medium">
                        {header || `列${idx + 1}`}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {previewData.slice(1, 11).map((row, rowIdx) => (
                    <tr key={rowIdx} className="border-t">
                      <td className="px-2 py-1 text-muted-foreground">{rowIdx + 1}</td>
                      {row.map((cell, cellIdx) => (
                        <td key={cellIdx} className="px-2 py-1 truncate max-w-[150px]">
                          {cell}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {previewData.length > 11 && (
              <p className="text-sm text-muted-foreground text-center">
                还有 {previewData.length - 11} 行数据...
              </p>
            )}
          </div>
        )}

        {/* 操作按钮 */}
        <div className="flex gap-2">
          {selectedFile && (status === 'idle' || status === 'success' || status === 'error') && (
            <Button
              variant="outline"
              onClick={handleClear}
            >
              <X className="h-4 w-4 mr-2" />
              清除
            </Button>
          )}
          
          {(status === 'uploading' || status === 'validating' || status === 'importing') && (
            <Button
              variant="outline"
              onClick={handleCancel}
            >
              取消上传
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export default FileUploader;
