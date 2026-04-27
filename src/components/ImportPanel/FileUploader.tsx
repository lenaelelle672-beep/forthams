/**
 * FileUploader Component
 * 资产批量导入 - 文件上传组件
 * @SWARM-2025-Q2-P2-006
 * 
 * 功能边界：
 * ✅ 支持 CSV/Excel 文件上传
 * ✅ 拖拽与点击两种上传方式
 * ✅ 文件大小校验（≤10MB）
 * ✅ 文件格式校验（.csv, .xlsx）
 * ✅ 预览数据（前10行）
 * ❌ 不支持 .xls 格式
 * ❌ 不支持附件/图片上传
 */

import React, { useCallback, useState, useRef } from 'react';
import { Upload, FileText, X, AlertCircle, CheckCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

export type SupportedFormat = 'csv' | 'xlsx';

export interface UploadedFile {
  file: File;
  format: SupportedFormat;
  size: number;
  previewData: string[][];
  rowCount: number;
}

export interface FileUploaderProps {
  /** 上传成功的回调 */
  onUploadSuccess?: (file: UploadedFile) => void;
  /** 上传失败的回调 */
  onUploadError?: (error: string) => void;
  /** 触发文件选择 */
  triggerRef?: React.RefObject<HTMLButtonElement>;
  /** 最大文件大小（字节），默认 10MB */
  maxFileSize?: number;
  /** 允许的文件格式，默认 ['csv', 'xlsx'] */
  allowedFormats?: SupportedFormat[];
  /** 是否禁用 */
  disabled?: boolean;
  /** 自定义类名 */
  className?: string;
}

const DEFAULT_MAX_SIZE = 10 * 1024 * 1024; // 10MB

/**
 * 解析文件内容用于预览
 * @param file 文件对象
 * @param format 文件格式
 * @returns 预览数据（二维数组）
 */
async function parseFileForPreview(file: File, format: SupportedFormat): Promise<string[][]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = (e) => {
      const content = e.target?.result as string;
      const lines = content.split('\n').filter(line => line.trim());
      // 仅取前10行预览
      const previewLines = lines.slice(0, 10);
      const data = previewLines.map(line => {
        if (format === 'csv') {
          return parseCSVLine(line);
        }
        return line.split('\t');
      });
      resolve(data);
    };
    
    reader.onerror = () => reject(new Error('文件读取失败'));
    reader.readAsText(file, 'UTF-8');
  });
}

/**
 * 解析CSV单行（处理引号包裹的逗号）
 */
function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
}

/**
 * 验证文件格式
 */
function validateFileFormat(fileName: string, allowedFormats: SupportedFormat[]): SupportedFormat | null {
  const ext = fileName.split('.').pop()?.toLowerCase();
  if (ext === 'csv') return 'csv';
  if (ext === 'xlsx' || ext === 'xls') return 'xlsx';
  return null;
}

/**
 * FileUploader 组件
 * 支持 CSV/Excel 文件上传，包含拖拽、点击上传、预览功能
 */
export const FileUploader: React.FC<FileUploaderProps> = ({
  onUploadSuccess,
  onUploadError,
  triggerRef,
  maxFileSize = DEFAULT_MAX_SIZE,
  allowedFormats = ['csv', 'xlsx'],
  disabled = false,
  className,
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [uploadedFile, setUploadedFile] = useState<UploadedFile | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  /**
   * 处理文件上传核心逻辑
   */
  const handleFile = useCallback(async (file: File) => {
    setError(null);
    setIsProcessing(true);

    try {
      // 1. 文件格式校验
      const format = validateFileFormat(file.name, allowedFormats);
      if (!format) {
        throw new Error(`不支持的文件格式。请上传 ${allowedFormats.join('/')} 格式的文件。`);
      }

      // 2. 文件大小校验
      if (file.size > maxFileSize) {
        throw new Error(`文件大小超过限制（最大 ${Math.round(maxFileSize / 1024 / 1024)}MB）。`);
      }

      // 3. 解析预览数据
      const previewData = await parseFileForPreview(file, format);
      const rowCount = previewData.length - 1; // 减去表头行

      const uploadedFileData: UploadedFile = {
        file,
        format,
        size: file.size,
        previewData,
        rowCount,
      };

      setUploadedFile(uploadedFileData);
      onUploadSuccess?.(uploadedFileData);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '文件处理失败';
      setError(errorMessage);
      onUploadError?.(errorMessage);
    } finally {
      setIsProcessing(false);
    }
  }, [allowedFormats, maxFileSize, onUploadSuccess, onUploadError]);

  /**
   * 拖拽进入区域
   */
  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  /**
   * 拖拽离开区域
   */
  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  /**
   * 拖拽放置
   */
  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    if (disabled) return;

    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      await handleFile(files[0]);
    }
  }, [disabled, handleFile]);

  /**
   * 点击选择文件
   */
  const handleClick = useCallback(() => {
    if (!disabled) {
      inputRef.current?.click();
    }
  }, [disabled]);

  /**
   * 文件选择变化
   */
  const handleChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      await handleFile(files[0]);
    }
    // 重置 input 以允许重复选择同一文件
    e.target.value = '';
  }, [handleFile]);

  /**
   * 清除已上传文件
   */
  const handleClear = useCallback(() => {
    setUploadedFile(null);
    setError(null);
  }, []);

  /**
   * 格式化文件大小
   */
  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
  };

  return (
    <div className={cn('space-y-4', className)}>
      {/* 隐藏的 file input */}
      <input
        ref={inputRef}
        type="file"
        accept=".csv,.xlsx"
        onChange={handleChange}
        className="hidden"
        disabled={disabled || isProcessing}
      />

      {/* 上传区域 */}
      {!uploadedFile ? (
        <div
          onClick={handleClick}
          onDragEnter={handleDragEnter}
          onDragOver={(e) => e.preventDefault()}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={cn(
            'relative border-2 border-dashed rounded-lg p-8 text-center transition-colors cursor-pointer',
            isDragging
              ? 'border-primary bg-primary/5'
              : 'border-gray-300 hover:border-primary hover:bg-gray-50',
            disabled && 'opacity-50 cursor-not-allowed',
            isProcessing && 'pointer-events-none'
          )}
        >
          <div className="flex flex-col items-center gap-3">
            <div className={cn(
              'w-12 h-12 rounded-full flex items-center justify-center',
              isDragging ? 'bg-primary/10' : 'bg-gray-100'
            )}>
              <Upload className={cn(
                'w-6 h-6',
                isDragging ? 'text-primary' : 'text-gray-500'
              )} />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-900">
                {isProcessing ? '处理中...' : '点击或拖拽文件到此处上传'}
              </p>
              <p className="text-xs text-gray-500 mt-1">
                支持 CSV、XLSX 格式，单文件不超过 10MB
              </p>
            </div>
          </div>
        </div>
      ) : (
        /* 已上传文件展示 */
        <div className="border border-gray-200 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded bg-green-50 flex items-center justify-center flex-shrink-0">
              <FileText className="w-5 h-5 text-green-600" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900 truncate">
                {uploadedFile.file.name}
              </p>
              <p className="text-xs text-gray-500 mt-0.5">
                {formatFileSize(uploadedFile.size)} · {uploadedFile.rowCount} 行数据
              </p>
            </div>
            <button
              type="button"
              onClick={handleClear}
              className="p-1 hover:bg-gray-100 rounded text-gray-400 hover:text-gray-600"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* 数据预览 */}
          {uploadedFile.previewData.length > 0 && (
            <div className="mt-4">
              <p className="text-xs font-medium text-gray-500 mb-2">数据预览（前10行）</p>
              <div className="overflow-x-auto border border-gray-100 rounded">
                <table className="w-full text-xs">
                  <tbody>
                    {uploadedFile.previewData.map((row, rowIndex) => (
                      <tr key={rowIndex} className={rowIndex === 0 ? 'bg-gray-50 font-medium' : ''}>
                        {row.map((cell, cellIndex) => (
                          <td
                            key={cellIndex}
                            className="px-3 py-1.5 border-b border-r border-gray-100 last:border-r-0 truncate max-w-[200px]"
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
        </div>
      )}

      {/* 错误提示 */}
      {error && (
        <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-100 rounded-lg">
          <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {/* 成功提示 */}
      {uploadedFile && !error && (
        <div className="flex items-start gap-2 p-3 bg-green-50 border border-green-100 rounded-lg">
          <CheckCircle className="w-4 h-4 text-green-600 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-green-700">
            文件上传成功，共 {uploadedFile.rowCount} 条记录待导入
          </p>
        </div>
      )}
    </div>
  );
};

export default FileUploader;