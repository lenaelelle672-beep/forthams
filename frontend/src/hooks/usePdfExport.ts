/**
 * @file hooks/usePdfExport.ts
 * @description PDF 导出 hook — 封装下载逻辑
 */

import { useState, useCallback } from 'react';
import { toast } from 'sonner';
import { exportReportPdf, downloadBlob } from '@/api/reports';

interface UsePdfExportOptions {
  /** 报表类型（对应后端模板文件前缀） */
  type: string;
  /** 可选的模板参数 */
  params?: Record<string, unknown>;
  /** 下载文件名（不含扩展名） */
  filename?: string;
}

interface UsePdfExportReturn {
  /** 是否正在导出 */
  exporting: boolean;
  /** 导出 PDF */
  exportPdf: () => Promise<void>;
}

/**
 * PDF 导出 hook
 *
 * @example
 * ```tsx
 * const { exporting, exportPdf } = usePdfExport({
 *   type: 'asset-register',
 *   filename: '资产台账',
 * });
 *
 * return (
 *   <Button onClick={exportPdf} disabled={exporting}>
 *     {exporting ? '导出中...' : '导出 PDF'}
 *   </Button>
 * );
 * ```
 */
export function usePdfExport({
  type,
  params,
  filename,
}: UsePdfExportOptions): UsePdfExportReturn {
  const [exporting, setExporting] = useState(false);

  const exportPdf = useCallback(async () => {
    if (exporting) return;

    setExporting(true);
    try {
      const blob = await exportReportPdf(type, params);
      const downloadName = filename
        ? `${filename}-${new Date().toISOString().slice(0, 10)}.pdf`
        : `${type}-${new Date().toISOString().slice(0, 10)}.pdf`;
      downloadBlob(blob, downloadName);
      toast.success('PDF 导出成功');
    } catch (error) {
      console.error('PDF 导出失败:', error);
      toast.error('PDF 导出失败，请重试');
    } finally {
      setExporting(false);
    }
  }, [type, params, filename, exporting]);

  return { exporting, exportPdf };
}