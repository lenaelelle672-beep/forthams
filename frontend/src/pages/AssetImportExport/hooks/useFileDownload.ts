import { useState, useCallback } from 'react';
import { message } from 'antd';
import { http } from '@/utils/http';
import { downloadBlob } from '@/utils/fileDownloader';

/**
 * 导出筛选条件，对应 POST /api/v1/assets/export 请求体
 */
export interface ExportFilters {
  /** 资产分类编码列表 */
  categoryCodes: string[];
  /** 资产状态编码列表 */
  statusCodes: string[];
  /** 存放位置编码列表 */
  locationCodes: string[];
}

/**
 * 生成导出文件名，格式：资产台账_YYYYMMDD_HHmmss.xlsx
 * 时间戳取前端当前时间（spec 要求）
 */
function generateExportFilename(): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  const yyyy = now.getFullYear();
  const MM = pad(now.getMonth() + 1);
  const dd = pad(now.getDate());
  const HH = pad(now.getHours());
  const mm = pad(now.getMinutes());
  const ss = pad(now.getSeconds());
  return `资产台账_${yyyy}${MM}${dd}_${HH}${mm}${ss}.xlsx`;
}

/**
 * 尝试从 Blob 错误响应中提取后端返回的错误信息。
 * 当请求设置 responseType: 'blob' 时，即使后端返回 JSON 错误，
 * axios 也会将其包装为 Blob，需要手动解析。
 */
async function parseBlobErrorMessage(blob: Blob): Promise<string | null> {
  try {
    const text = await blob.text();
    const json = JSON.parse(text);
    return json.message || json.detail || json.error || null;
  } catch {
    return null;
  }
}

/**
 * 文件下载 Hook
 *
 * 提供两种文件下载能力：
 * - downloadTemplate: 下载导入模板（GET /api/v1/assets/import/template）
 * - downloadExport:   按条件导出资产台账（POST /api/v1/assets/export）
 *
 * 内部使用 Blob + URL.createObjectURL 处理文件流，
 * 通过 downloadBlob 工具函数在下载完成后自动调用 URL.revokeObjectURL 释放内存。
 *
 * @example
 * ```tsx
 * const { downloadTemplate, downloadExport, isDownloading } = useFileDownload();
 *
 * // 下载模板
 * <Button onClick={downloadTemplate} loading={isDownloading}>下载导入模板</Button>
 *
 * // 导出资产
 * <Button onClick={() => downloadExport(filters)} loading={isDownloading}>导出</Button>
 * ```
 */
export function useFileDownload() {
  const [isDownloading, setIsDownloading] = useState(false);

  /**
   * 下载导入模板
   *
   * 调用 GET /api/v1/assets/import/template 获取 xlsx 文件流，
   * 保存为 asset_import_template.xlsx。
   * 若接口返回错误，前端展示 Toast 错误提示，不缓存备用。
   */
  const downloadTemplate = useCallback(async () => {
    setIsDownloading(true);
    try {
      const response = await http.get('/api/v1/assets/import/template', {
        responseType: 'blob',
      });

      // 确保 Blob 类型正确
      const blob: Blob =
        response.data instanceof Blob
          ? response.data
          : new Blob([response.data], {
              type:
                'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            });

      downloadBlob(blob, 'asset_import_template.xlsx');
    } catch (error: any) {
      // 401 Token 过期处理：展示 Toast 并跳转登录页
      if (error?.response?.status === 401) {
        message.error('登录已过期');
        window.location.href = '/login';
        return;
      }

      // 尝试从 Blob 响应中提取后端错误信息
      let errorMessage = '下载模板失败，请稍后重试';
      if (error?.response?.data instanceof Blob) {
        const parsed = await parseBlobErrorMessage(error.response.data);
        if (parsed) errorMessage = parsed;
      }

      message.error(errorMessage);
    } finally {
      setIsDownloading(false);
    }
  }, []);

  /**
   * 按筛选条件导出资产台账为 Excel 文件
   *
   * 调用 POST /api/v1/assets/export，请求体为 { categoryCodes, statusCodes, locationCodes }，
   * 响应为文件流（Content-Type: application/octet-stream）。
   * 文件名格式：资产台账_YYYYMMDD_HHmmss.xlsx，时间戳取前端当前时间。
   *
   * @param filters 导出筛选条件，三个维度均为可选（传空数组表示不筛选）
   */
  const downloadExport = useCallback(async (filters: ExportFilters) => {
    setIsDownloading(true);
    try {
      const response = await http.post('/api/v1/assets/export', {
        categoryCodes: filters.categoryCodes ?? [],
        statusCodes: filters.statusCodes ?? [],
        locationCodes: filters.locationCodes ?? [],
      }, {
        responseType: 'blob',
      });

      // 确保 Blob 类型正确
      const blob: Blob =
        response.data instanceof Blob
          ? response.data
          : new Blob([response.data], {
              type:
                'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            });

      // 使用前端生成的文件名（spec 要求格式：资产台账_YYYYMMDD_HHmmss.xlsx）
      const filename = generateExportFilename();
      downloadBlob(blob, filename);
    } catch (error: any) {
      // 401 Token 过期处理：展示 Toast 并跳转登录页
      if (error?.response?.status === 401) {
        message.error('登录已过期');
        window.location.href = '/login';
        return;
      }

      // 尝试从 Blob 响应中提取后端错误信息
      let errorMessage = '导出失败，请稍后重试';
      if (error?.response?.data instanceof Blob) {
        const parsed = await parseBlobErrorMessage(error.response.data);
        if (parsed) errorMessage = parsed;
      }

      message.error(errorMessage);
    } finally {
      setIsDownloading(false);
    }
  }, []);

  return {
    /** 下载导入模板 */
    downloadTemplate,
    /** 按条件导出资产台账 */
    downloadExport,
    /** 是否正在下载中（用于按钮 loading 状态） */
    isDownloading,
  };
}

export default useFileDownload;