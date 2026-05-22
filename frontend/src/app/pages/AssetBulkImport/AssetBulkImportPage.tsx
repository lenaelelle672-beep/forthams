/**
 * AssetBulkImportPage.tsx
 * 
 * 资产批量导入导出页面组件
 * 支持 Excel/CSV 格式的资产批量导入和导出功能
 * 
 * @module AssetBulkImport
 * @version 1.0.0
 * @author SWARM-002 Team
 * 
 * 功能特性:
 * - 批量导入: 上传 xlsx/csv 文件批量创建资产
 * - 批量导出: 将资产列表导出为 xlsx/csv 文件
 * - 模板下载: 提供标准导入模板供用户下载
 * - 进度追踪: 显示导入/导出进度和结果
 * 
 * 文件格式约束:
 * - 支持格式: .xlsx, .csv
 * - 最大文件大小: 10MB
 * - 最大行数: 5000 行
 * 
 * 权限要求:
 * - role=ADMIN 或 role=ASSET_MANAGER
 */

import React, { useState, useCallback, useRef } from 'react';
import { Upload, Download, FileText, AlertCircle, CheckCircle, XCircle, Loader2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import './AssetBulkImportPage.css';

/**
 * 导出格式枚举
 */
export enum ExportFormat {
  XLSX = 'xlsx',
  CSV = 'csv'
}

/**
 * 导入结果状态
 */
export enum ImportStatus {
  IDLE = 'IDLE',
  UPLOADING = 'UPLOADING',
  PROCESSING = 'PROCESSING',
  SUCCESS = 'SUCCESS',
  ERROR = 'ERROR'
}

/**
 * 导出结果状态
 */
export enum ExportStatus {
  IDLE = 'IDLE',
  PROCESSING = 'PROCESSING',
  SUCCESS = 'SUCCESS',
  ERROR = 'ERROR'
}

/**
 * 导入结果数据接口
 */
export interface ImportResult {
  success: boolean;
  created: number;
  failed: number;
  errors: ImportError[];
  totalRows: number;
}

/**
 * 单条导入错误信息
 */
export interface ImportError {
  row: number;
  field: string;
  message: string;
  originalValue: string;
}

/**
 * 导出请求参数接口
 */
export interface ExportRequest {
  format: ExportFormat;
  filters?: Record<string, unknown>;
}

/**
 * 页面组件 Props 接口
 */
export interface AssetBulkImportPageProps {
  /** API 基础路径 */
  apiBaseUrl?: string;
  /** 是否显示导出功能 */
  showExport?: boolean;
  /** 是否显示模板下载功能 */
  showTemplate?: boolean;
  /** 最大文件大小(MB) */
  maxFileSize?: number;
  /** 最大导入行数 */
  maxRows?: number;
  /** 导出文件名(不含扩展名) */
  exportFileName?: string;
  /** 自定义样式类名 */
  className?: string;
  /** 导入成功回调 */
  onImportSuccess?: (result: ImportResult) => void;
  /** 导出成功回调 */
  onExportSuccess?: (blob: Blob, filename: string) => void;
  /** 错误回调 */
  onError?: (error: Error) => void;
}

/**
 * AssetBulkImportPage 组件默认值
 */
const DEFAULT_PROPS: Partial<AssetBulkImportPageProps> = {
  apiBaseUrl: '/api/v1/assets',
  showExport: true,
  showTemplate: true,
  maxFileSize: 10,
  maxRows: 5000,
  exportFileName: 'asset_export'
};

/**
 * 资产批量导入导出页面组件
 * 
 * 提供资产数据的批量导入和导出功能，支持 Excel 和 CSV 格式。
 * 页面包含导入区、导出区、模板下载三个主要功能模块。
 * 
 * @param props - 组件属性
 * @returns React 组件
 * 
 * @example
 * ```tsx
 * <AssetBulkImportPage
 *   apiBaseUrl="/api/v1/assets"
 *   showExport={true}
 *   showTemplate={true}
 *   maxFileSize={10}
 *   onImportSuccess={(result) => console.log('Imported:', result)}
 * />
 * ```
 */
export const AssetBulkImportPage: React.FC<AssetBulkImportPageProps> = (props) => {
  const {
    apiBaseUrl = DEFAULT_PROPS.apiBaseUrl!,
    showExport = DEFAULT_PROPS.showExport!,
    showTemplate = DEFAULT_PROPS.showTemplate!,
    maxFileSize = DEFAULT_PROPS.maxFileSize!,
    maxRows = DEFAULT_PROPS.maxRows!,
    exportFileName = DEFAULT_PROPS.exportFileName!,
    className,
    onImportSuccess,
    onExportSuccess,
    onError
  } = props;

  const { t } = useTranslation();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 导入相关状态
  const [importStatus, setImportStatus] = useState<ImportStatus>(ImportStatus.IDLE);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  // 导出相关状态
  const [exportStatus, setExportStatus] = useState<ExportStatus>(ExportStatus.IDLE);
  const [exportFormat, setExportFormat] = useState<ExportFormat>(ExportFormat.XLSX);

  // 文件校验错误
  const [fileError, setFileError] = useState<string | null>(null);

  /**
   * 验证文件格式
   * @param file - 待验证的文件
   * @returns 是否为有效格式
   */
  const validateFileFormat = useCallback((file: File): boolean => {
    const validExtensions = ['.xlsx', '.csv'];
    const fileExtension = '.' + file.name.split('.').pop()?.toLowerCase();
    return validExtensions.includes(fileExtension);
  }, []);

  /**
   * 验证文件大小
   * @param file - 待验证的文件
   * @returns 是否符合大小限制
   */
  const validateFileSize = useCallback((file: File): boolean => {
    const maxSizeBytes = maxFileSize * 1024 * 1024;
    return file.size <= maxSizeBytes;
  }, [maxFileSize]);

  /**
   * 处理文件选择
   * @param event - 文件选择事件
   */
  const handleFileSelect = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    setFileError(null);
    setImportResult(null);

    if (!file) {
      return;
    }

    if (!validateFileFormat(file)) {
      setFileError(t('asset_bulk_import.error.unsupported_format'));
      return;
    }

    if (!validateFileSize(file)) {
      setFileError(t('asset_bulk_import.error.file_too_large', { maxSize: maxFileSize }));
      return;
    }

    setSelectedFile(file);
  }, [validateFileFormat, validateFileSize, maxFileSize, t]);

  /**
   * 上传并导入文件
   * @returns void
   */
  const handleImport = useCallback(async (): Promise<void> => {
    if (!selectedFile) {
      return;
    }

    setImportStatus(ImportStatus.UPLOADING);
    setFileError(null);

    try {
      const formData = new FormData();
      formData.append('file', selectedFile);

      setImportStatus(ImportStatus.PROCESSING);

      const response = await fetch(`${apiBaseUrl}/import`, {
        method: 'POST',
        body: formData,
        headers: {
          'Authorization': `Bearer ${sessionStorage.getItem('auth_token') || localStorage.getItem('auth_token')}`
        }
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || t('asset_bulk_import.error.import_failed'));
      }

      const result: ImportResult = await response.json();
      setImportResult(result);
      setImportStatus(ImportStatus.SUCCESS);

      if (onImportSuccess) {
        onImportSuccess(result);
      }
    } catch (error) {
      setImportStatus(ImportStatus.ERROR);
      const errorMessage = error instanceof Error ? error.message : t('asset_bulk_import.error.unknown');
      setFileError(errorMessage);

      if (onError) {
        onError(error instanceof Error ? error : new Error(errorMessage));
      }
    }
  }, [selectedFile, apiBaseUrl, onImportSuccess, onError, t]);

  /**
   * 导出资产列表
   * @returns void
   */
  const handleExport = useCallback(async (): Promise<void> => {
    setExportStatus(ExportStatus.PROCESSING);
    setFileError(null);

    try {
      const request: ExportRequest = {
        format: exportFormat,
        filters: {}
      };

      const response = await fetch(`${apiBaseUrl}/export`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${sessionStorage.getItem('auth_token') || localStorage.getItem('auth_token')}`
        },
        body: JSON.stringify(request)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || t('asset_bulk_import.error.export_failed'));
      }

      const blob = await response.blob();
      const filename = `${exportFileName}_${new Date().toISOString().split('T')[0]}.${exportFormat}`;

      // 创建下载链接
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      setExportStatus(ExportStatus.SUCCESS);

      if (onExportSuccess) {
        onExportSuccess(blob, filename);
      }
    } catch (error) {
      setExportStatus(ExportStatus.ERROR);
      const errorMessage = error instanceof Error ? error.message : t('asset_bulk_import.error.unknown');
      setFileError(errorMessage);

      if (onError) {
        onError(error instanceof Error ? error : new Error(errorMessage));
      }
    }
  }, [exportFormat, apiBaseUrl, exportFileName, onExportSuccess, onError, t]);

  /**
   * 下载导入模板
   * @returns void
   */
  const handleDownloadTemplate = useCallback(async (): Promise<void> => {
    try {
      const format = exportFormat === ExportFormat.CSV ? 'csv' : 'xlsx';
      const response = await fetch(`${apiBaseUrl}/import/template?format=${format}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${sessionStorage.getItem('auth_token') || localStorage.getItem('auth_token')}`
        }
      });

      if (!response.ok) {
        throw new Error(t('asset_bulk_import.error.template_download_failed'));
      }

      const blob = await response.blob();
      const filename = `asset_import_template.${format}`;

      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : t('asset_bulk_import.error.unknown');
      setFileError(errorMessage);

      if (onError) {
        onError(error instanceof Error ? error : new Error(errorMessage));
      }
    }
  }, [exportFormat, apiBaseUrl, onError, t]);

  /**
   * 重置导入状态
   * @returns void
   */
  const handleReset = useCallback((): void => {
    setSelectedFile(null);
    setImportResult(null);
    setImportStatus(ImportStatus.IDLE);
    setFileError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, []);

  /**
   * 渲染导入状态图标
   * @param status - 导入状态
   * @returns React 节点
   */
  const renderStatusIcon = (status: ImportStatus): React.ReactNode => {
    switch (status) {
      case ImportStatus.UPLOADING:
      case ImportStatus.PROCESSING:
        return <Loader2 className="animate-spin" size={24} />;
      case ImportStatus.SUCCESS:
        return <CheckCircle className="text-green-500" size={24} />;
      case ImportStatus.ERROR:
        return <XCircle className="text-red-500" size={24} />;
      default:
        return null;
    }
  };

  /**
   * 渲染导入结果摘要
   * @returns React 节点
   */
  const renderImportSummary = (): React.ReactNode => {
    if (!importResult) return null;

    return (
      <div className="import-summary">
        <div className="summary-row">
          <span className="summary-label">{t('asset_bulk_import.label.total_rows')}:</span>
          <span className="summary-value">{importResult.totalRows}</span>
        </div>
        <div className="summary-row">
          <span className="summary-label">{t('asset_bulk_import.label.created')}:</span>
          <span className="summary-value text-green-500">{importResult.created}</span>
        </div>
        <div className="summary-row">
          <span className="summary-label">{t('asset_bulk_import.label.failed')}:</span>
          <span className="summary-value text-red-500">{importResult.failed}</span>
        </div>
      </div>
    );
  };

  /**
   * 渲染错误列表
   * @returns React 节点
   */
  const renderErrorList = (): React.ReactNode => {
    if (!importResult?.errors?.length) return null;

    return (
      <div className="error-list">
        <h4>{t('asset_bulk_import.label.error_details')}</h4>
        <ul>
          {importResult.errors.slice(0, 10).map((error, index) => (
            <li key={index} className="error-item">
              <AlertCircle size={16} />
              <span>
                {t('asset_bulk_import.label.row')} {error.row}: {error.field} - {error.message}
              </span>
            </li>
          ))}
          {importResult.errors.length > 10 && (
            <li className="error-more">
              {t('asset_bulk_import.message.more_errors', { count: importResult.errors.length - 10 })}
            </li>
          )}
        </ul>
      </div>
    );
  };

  return (
    <div className={`asset-bulk-import-page ${className || ''}`}>
      <header className="page-header">
        <h1>{t('asset_bulk_import.title')}</h1>
        <p className="page-description">{t('asset_bulk_import.description')}</p>
      </header>

      <div className="page-content">
        {/* 导入区域 */}
        <section className="import-section card">
          <div className="section-header">
            <Upload size={20} />
            <h2>{t('asset_bulk_import.section.import')}</h2>
          </div>

          <div className="upload-area">
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.csv"
              onChange={handleFileSelect}
              className="file-input"
              disabled={importStatus === ImportStatus.PROCESSING || importStatus === ImportStatus.UPLOADING}
            />

            {selectedFile && (
              <div className="selected-file">
                <FileText size={16} />
                <span>{selectedFile.name}</span>
                <span className="file-size">
                  ({(selectedFile.size / 1024 / 1024).toFixed(2)} MB)
                </span>
              </div>
            )}

            {fileError && (
              <div className="error-message">
                <AlertCircle size={16} />
                <span>{fileError}</span>
              </div>
            )}
          </div>

          <div className="action-buttons">
            <button
              className="btn btn-primary"
              onClick={handleImport}
              disabled={!selectedFile || importStatus === ImportStatus.PROCESSING || importStatus === ImportStatus.UPLOADING}
            >
              {importStatus === ImportStatus.UPLOADING || importStatus === ImportStatus.PROCESSING ? (
                <>
                  <Loader2 className="animate-spin" size={16} />
                  {t('asset_bulk_import.button.importing')}
                </>
              ) : (
                <>
                  <Upload size={16} />
                  {t('asset_bulk_import.button.import')}
                </>
              )}
            </button>

            <button
              className="btn btn-secondary"
              onClick={handleReset}
              disabled={importStatus === ImportStatus.PROCESSING || importStatus === ImportStatus.UPLOADING}
            >
              {t('asset_bulk_import.button.reset')}
            </button>
          </div>

          {importStatus !== ImportStatus.IDLE && (
            <div className="import-status">
              {renderStatusIcon(importStatus)}
              <span>{t(`asset_bulk_import.status.${importStatus.toLowerCase()}`)}</span>
            </div>
          )}

          {renderImportSummary()}
          {renderErrorList()}
        </section>

        {/* 导出区域 */}
        {showExport && (
          <section className="export-section card">
            <div className="section-header">
              <Download size={20} />
              <h2>{t('asset_bulk_import.section.export')}</h2>
            </div>

            <div className="export-options">
              <label className="format-label">{t('asset_bulk_import.label.export_format')}:</label>
              <div className="format-buttons">
                <button
                  className={`format-btn ${exportFormat === ExportFormat.XLSX ? 'active' : ''}`}
                  onClick={() => setExportFormat(ExportFormat.XLSX)}
                >
                  {t('asset_bulk_import.format.xlsx')}
                </button>
                <button
                  className={`format-btn ${exportFormat === ExportFormat.CSV ? 'active' : ''}`}
                  onClick={() => setExportFormat(ExportFormat.CSV)}
                >
                  {t('asset_bulk_import.format.csv')}
                </button>
              </div>
            </div>

            <div className="action-buttons">
              <button
                className="btn btn-primary"
                onClick={handleExport}
                disabled={exportStatus === ExportStatus.PROCESSING}
              >
                {exportStatus === ExportStatus.PROCESSING ? (
                  <>
                    <Loader2 className="animate-spin" size={16} />
                    {t('asset_bulk_import.button.exporting')}
                  </>
                ) : (
                  <>
                    <Download size={16} />
                    {t('asset_bulk_import.button.export')}
                  </>
                )}
              </button>
            </div>

            {exportStatus === ExportStatus.SUCCESS && (
              <div className="export-status success">
                <CheckCircle size={16} />
                <span>{t('asset_bulk_import.message.export_success')}</span>
              </div>
            )}
          </section>
        )}

        {/* 模板下载区域 */}
        {showTemplate && (
          <section className="template-section card">
            <div className="section-header">
              <FileText size={20} />
              <h2>{t('asset_bulk_import.section.template')}</h2>
            </div>

            <p className="template-description">
              {t('asset_bulk_import.message.template_description')}
            </p>

            <div className="action-buttons">
              <button className="btn btn-outline" onClick={handleDownloadTemplate}>
                <Download size={16} />
                {t('asset_bulk_import.button.download_template')}
              </button>
            </div>
          </section>
        )}
      </div>

      {/* 文件限制说明 */}
      <footer className="page-footer">
        <h3>{t('asset_bulk_import.label.file_constraints')}</h3>
        <ul>
          <li>{t('asset_bulk_import.message.supported_formats')}: .xlsx, .csv</li>
          <li>{t('asset_bulk_import.message.max_file_size', { maxSize: maxFileSize })}</li>
          <li>{t('asset_bulk_import.message.max_rows', { maxRows })}</li>
          <li>{t('asset_bulk_import.message.encoding')}: UTF-8</li>
        </ul>
      </footer>
    </div>
  );
};

/**
 * 导出组件及类型
 */
export type { AssetBulkImportPageProps, ImportResult, ImportError, ExportRequest };
export { ExportFormat, ImportStatus, ExportStatus };

export default AssetBulkImportPage;