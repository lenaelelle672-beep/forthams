import { useState, useRef, useCallback } from 'react';
import { message } from 'antd';
import http from '../../../utils/http';

/**
 * 导出筛选参数接口。
 *
 * 对应 POST /api/v1/assets/export 请求体结构，
 * 三个维度均为可选（传空数组表示不限该维度）。
 */
export interface ExportFilterParams {
  /** 资产分类编码列表 */
  categoryCodes: string[];
  /** 资产状态编码列表 */
  statusCodes: string[];
  /** 存放位置编码列表 */
  locationCodes: string[];
}

/**
 * useAssetExport Hook 返回值类型。
 */
export interface UseAssetExportReturn {
  /** 执行资产导出，传入筛选条件 */
  exportAssets: (filters: ExportFilterParams) => Promise<void>;
  /** 当前是否正在导出 */
  isExporting: boolean;
}

/**
 * 生成导出文件名。
 *
 * 格式为 `资产台账_YYYYMMDD_HHmmss.xlsx`，
 * 时间戳取前端当前本地时间（spec 要求）。
 *
 * @returns 符合命名规范的文件名字符串
 */
function generateExportFilename(): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  const datePart = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}`;
  const timePart = `${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
  return `资产台账_${datePart}_${timePart}.xlsx`;
}

/**
 * 通过 Blob + URL.createObjectURL 触发浏览器文件下载。
 *
 * 下载完成后立即调用 URL.revokeObjectURL 释放内存，
 * 满足 ATB-017 验收标准。
 *
 * @param blob  - 要下载的文件 Blob 数据
 * @param filename - 下载保存的文件名
 */
function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.setAttribute('download', filename);
  document.body.appendChild(anchor);
  anchor.click();
  anchor.parentNode?.removeChild(anchor);
  // 释放 Object URL 以避免内存泄漏
  URL.revokeObjectURL(url);
}

/**
 * useAssetExport — 资产导出功能核心 Hook（对应 FE-9）。
 *
 * 职责：
 * - 调用 `POST /api/v1/assets/export`，以 JSON body 发送筛选条件
 * - 接收 `application/octet-stream` 文件流响应
 * - 按规范生成文件名 `资产台账_YYYYMMDD_HHmmss.xlsx`（本地时间）
 * - 使用 Blob + URL.createObjectURL 触发浏览器下载，
 *   下载完成后调用 URL.revokeObjectURL 释放内存（ATB-017）
 * - 管理 isExporting 状态，通过 ref 防止并发导出
 *
 * @example
 * ```tsx
 * const { exportAssets, isExporting } = useAssetExport();
 *
 * const handleExport = () => {
 *   exportAssets({
 *     categoryCodes: ['office-equipment'],
 *     statusCodes: ['in-use'],
 *     locationCodes: [],
 *   });
 * };
 * ```
 */
export function useAssetExport(): UseAssetExportReturn {
  const [isExporting, setIsExporting] = useState(false);
  const exportingRef = useRef(false);

  /**
   * 执行资产导出。
   *
   * 发送 POST 请求至 /api/v1/assets/export，
   * 请求体为 `{ categoryCodes, statusCodes, locationCodes }`。
   * 三个维度均为可选，传空数组表示该维度不限。
   *
   * @param filters - 导出筛选条件
   */
  const exportAssets = useCallback(async (filters: ExportFilterParams): Promise<void> => {
    // 使用 ref 防止并发导出，避免闭包陈旧值问题
    if (exportingRef.current) {
      return;
    }

    exportingRef.current = true;
    setIsExporting(true);

    try {
      // 构建请求体，确保所有字段均为数组（空数组表示不限）
      const requestBody = {
        categoryCodes: filters.categoryCodes ?? [],
        statusCodes: filters.statusCodes ?? [],
        locationCodes: filters.locationCodes ?? [],
      };

      // POST 请求，responseType 设为 blob 以接收文件流
      const response = await http.post('/api/v1/assets/export', requestBody, {
        responseType: 'blob',
      });

      // 兼容处理：确保 response.data 为 Blob 对象
      const blob: Blob = response.data instanceof Blob
        ? response.data
        : new Blob([response.data], { type: 'application/octet-stream' });

      // 校验文件非空
      if (blob.size === 0) {
        throw new Error('导出文件为空，请检查筛选条件');
      }

      // 生成规范文件名并触发下载（内部会调用 revokeObjectURL）
      const filename = generateExportFilename();
      downloadBlob(blob, filename);

      message.success('资产导出成功');
    } catch (error: unknown) {
      if (error instanceof Error) {
        message.error(error.message);
      } else {
        message.error('导出失败，请稍后重试');
      }
    } finally {
      exportingRef.current = false;
      setIsExporting(false);
    }
  }, []);

  return {
    exportAssets,
    isExporting,
  } as const;
}

export default useAssetExport;