/**
 * FormatSelector.tsx
 * 
 * 资产批量导入导出 - 导出格式选择器组件
 * 
 * 功能说明:
 *   - 支持选择导出格式（CSV / Excel）
 *   - 提供格式切换交互
 *   - 触发导出下载功能
 * 
 * 规格依据: SWARM-2025-Q2-P2-006
 * 
 * @version 1.0
 * @date 2025-Q2-Sprint-2
 */

import { useState, useCallback } from 'react';
import { FileText, FileSpreadsheet, Download, Loader2 } from 'lucide-react';

/**
 * 导出格式枚举
 */
export type ExportFormat = 'csv' | 'xlsx';

/**
 * 导出筛选条件接口
 */
export interface ExportFilter {
  assetType?: string;
  status?: string;
  startDate?: string;
  endDate?: string;
  department?: string;
}

/**
 * FormatSelector 组件属性接口
 */
export interface FormatSelectorProps {
  /** 筛选条件 */
  filters?: ExportFilter;
  /** 是否禁用组件 */
  disabled?: boolean;
  /** 导出按钮点击回调 */
  onExport: (format: ExportFormat, filters?: ExportFilter) => Promise<void>;
  /** 导出中状态 */
  isExporting?: boolean;
  /** 样式类名 */
  className?: string;
}

/**
 * FormatSelector 组件
 * 
 * 提供 CSV 和 Excel 格式选择，支持触发资产数据导出
 * 
 * @param props - FormatSelectorProps
 * @returns JSX.Element
 */
export function FormatSelector({
  filters = {},
  disabled = false,
  onExport,
  isExporting = false,
  className = '',
}: FormatSelectorProps) {
  // 当前选中的导出格式
  const [selectedFormat, setSelectedFormat] = useState<ExportFormat>('csv');

  /**
   * 格式选择变更处理
   * @param format - 选中的导出格式
   */
  const handleFormatChange = useCallback((format: ExportFormat) => {
    if (disabled || isExporting) return;
    setSelectedFormat(format);
  }, [disabled, isExporting]);

  /**
   * 导出按钮点击处理
   */
  const handleExport = useCallback(async () => {
    if (disabled || isExporting) return;
    try {
      await onExport(selectedFormat, filters);
    } catch (error) {
      console.error('Export failed:', error);
    }
  }, [disabled, isExporting, selectedFormat, filters, onExport]);

  return (
    <div className={`flex items-center gap-4 ${className}`}>
      {/* 格式选择标签 */}
      <span className="text-sm font-medium text-gray-700">
        导出格式:
      </span>

      {/* CSV 格式选项 */}
      <button
        type="button"
        onClick={() => handleFormatChange('csv')}
        disabled={disabled || isExporting}
        className={`
          flex items-center gap-2 px-4 py-2 rounded-lg border-2 transition-all duration-200
          ${selectedFormat === 'csv'
            ? 'border-blue-500 bg-blue-50 text-blue-700'
            : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
          }
          ${disabled || isExporting ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
        `}
        aria-pressed={selectedFormat === 'csv'}
        aria-label="选择 CSV 格式导出"
      >
        <FileText className="w-4 h-4" />
        <span className="text-sm font-medium">CSV</span>
      </button>

      {/* Excel 格式选项 */}
      <button
        type="button"
        onClick={() => handleFormatChange('xlsx')}
        disabled={disabled || isExporting}
        className={`
          flex items-center gap-2 px-4 py-2 rounded-lg border-2 transition-all duration-200
          ${selectedFormat === 'xlsx'
            ? 'border-green-500 bg-green-50 text-green-700'
            : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
          }
          ${disabled || isExporting ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
        `}
        aria-pressed={selectedFormat === 'xlsx'}
        aria-label="选择 Excel 格式导出"
      >
        <FileSpreadsheet className="w-4 h-4" />
        <span className="text-sm font-medium">Excel</span>
      </button>

      {/* 导出按钮 */}
      <button
        type="button"
        onClick={handleExport}
        disabled={disabled || isExporting}
        className={`
          flex items-center gap-2 px-6 py-2 rounded-lg font-medium text-white
          transition-all duration-200
          ${isExporting
            ? 'bg-gray-400 cursor-wait'
            : 'bg-blue-600 hover:bg-blue-700 active:bg-blue-800'
          }
          ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
        `}
        aria-busy={isExporting}
      >
        {isExporting ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            <span>导出中...</span>
          </>
        ) : (
          <>
            <Download className="w-4 h-4" />
            <span>导出 {selectedFormat.toUpperCase()}</span>
          </>
        )}
      </button>
    </div>
  );
}

/**
 * 导出文件名生成工具
 * @param format - 导出格式
 * @param prefix - 文件名前缀
 * @returns 格式化后的文件名
 */
export function generateExportFileName(
  format: ExportFormat,
  prefix: string = 'asset_export'
): string {
  const timestamp = new Date().toISOString().slice(0, 19).replace(/[:-]/g, '');
  const extension = format === 'csv' ? 'csv' : 'xlsx';
  return `${prefix}_${timestamp}.${extension}`;
}

/**
 * 默认导出筛选条件
 */
export const DEFAULT_EXPORT_FILTER: ExportFilter = {
  assetType: undefined,
  status: undefined,
  startDate: undefined,
  endDate: undefined,
  department: undefined,
};

export default FormatSelector;