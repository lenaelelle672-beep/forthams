/**
 * ImportTemplateDownload 组件
 *
 * 无状态下载按钮组件，调用模板下载 API，
 * 处理 Blob 转 URL 及内存释放 (URL.revokeObjectURL)。
 *
 * @module components/import/ImportTemplateDownload
 * @since SWARM-019
 */

import React, { useState, useCallback } from 'react';
import { Download, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { apiClient } from '../../utils/api';

/**
 * ImportTemplateDownload 组件属性
 *
 * @description 控制模板下载按钮的可选配置
 */
export interface ImportTemplateDownloadProps {
  /** 下载的文件格式，默认 xlsx */
  format?: 'xlsx' | 'csv';
  /** 按钮是否禁用（例如在上传中状态） */
  disabled?: boolean;
  /** 额外的 CSS 类名 */
  className?: string;
}

/**
 * 从 Content-Disposition 响应头解析文件名
 *
 * @param disposition - Content-Disposition 头值
 * @param fallback - 回退文件名
 * @returns 解析出的文件名
 */
function parseFilenameFromDisposition(
  disposition: string | undefined,
  fallback: string,
): string {
  if (!disposition) return fallback;
  const utf8Match = disposition.match(/filename\*?=(?:UTF-8'')?([^;\n]+)/i);
  if (utf8Match) {
    return decodeURIComponent(utf8Match[1].replace(/["']/g, ''));
  }
  const asciiMatch = disposition.match(/filename="?([^";\n]+)"?/i);
  if (asciiMatch) {
    return asciiMatch[1].replace(/["']/g, '');
  }
  return fallback;
}

/**
 * ImportTemplateDownload — 无状态模板下载按钮组件
 *
 * 点击后调用后端模板下载接口，将响应的 Blob 转为临时 URL 触发浏览器下载，
 * 下载完成后立即调用 `URL.revokeObjectURL` 释放内存。
 *
 * @param props - 组件属性
 * @returns React 组件
 *
 * @example
 * ```tsx
 * <ImportTemplateDownload format="xlsx" disabled={isUploading} />
 * ```
 */
export function ImportTemplateDownload({
  format = 'xlsx',
  disabled = false,
  className,
}: ImportTemplateDownloadProps) {
  const [downloading, setDownloading] = useState(false);

  /**
   * 处理模板下载
   *
   * @description 调用后端 GET /api/assets/import/template 接口，
   * 将返回的二进制流转为 Blob URL 触发浏览器下载，完成后释放内存。
   */
  const handleDownload = useCallback(async () => {
    if (disabled || downloading) return;

    setDownloading(true);
    try {
      const response = await apiClient.get(
        `/assets/import/template?format=${format}`,
        { responseType: 'blob' },
      );

      const blob = response.data instanceof Blob
        ? response.data
        : new Blob([response.data]);

      const disposition = response.headers?.['content-disposition'];
      const fallbackName = `asset_import_template.${format}`;
      const filename = parseFilenameFromDisposition(
        typeof disposition === 'string' ? disposition : undefined,
        fallbackName,
      );

      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : '下载模板失败，请稍后重试';
      toast.error(message);
    } finally {
      setDownloading(false);
    }
  }, [format, disabled, downloading]);

  return (
    <button
      type="button"
      onClick={handleDownload}
      disabled={disabled || downloading}
      className={`inline-flex items-center gap-2 px-4 py-2 text-sm font-medium
        rounded-lg border border-gray-200 bg-white text-gray-700
        hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500
        disabled:opacity-50 disabled:cursor-not-allowed transition-colors
        ${className ?? ''}`}
    >
      {downloading ? (
        <Loader2 className="w-4 h-4 animate-spin" />
      ) : (
        <Download className="w-4 h-4" />
      )}
      {downloading ? '下载中...' : '下载导入模板'}
    </button>
  );
}

export default ImportTemplateDownload;
