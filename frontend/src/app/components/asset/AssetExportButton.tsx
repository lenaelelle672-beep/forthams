/**
 * AssetExportButton — 资产条件导出按钮组件
 *
 * 独立的导出按钮组件，接受过滤参数并调用后端导出 API，
 * 由后端生成文件流，前端触发浏览器下载。
 *
 * @module components/asset/AssetExportButton
 * @since SWARM-031
 */

import React from 'react';
import { Download, Loader2 } from 'lucide-react';
import { useAssetImportExport } from '../../hooks/useAssetImportExport';
import type { AssetExportParams } from '../../hooks/useAssetImportExport';

/* ------------------------------------------------------------------ */
/*  Props 类型                                                         */
/* ------------------------------------------------------------------ */

/**
 * AssetExportButton 组件属性
 */
export interface AssetExportButtonProps {
  /** 导出参数（当前过滤条件） */
  params: AssetExportParams;
  /** 额外 CSS 类名 */
  className?: string;
  /** 按钮文本，默认"条件导出" */
  label?: string;
  /** 是否禁用 */
  disabled?: boolean;
}

/* ------------------------------------------------------------------ */
/*  组件实现                                                           */
/* ------------------------------------------------------------------ */

/**
 * AssetExportButton — 资产条件导出按钮
 *
 * 携带当前所有过滤条件调用后端导出 API，由后端生成文件流下载。
 * 使用 useAssetImportExport Hook 管理导出状态。
 *
 * @param props - 组件属性
 * @returns React 组件
 *
 * @example
 * ```tsx
 * <AssetExportButton
 *   params={{ keyword: '电脑', status: 'ACTIVE' }}
 *   label="导出 Excel"
 * />
 * ```
 */
export function AssetExportButton({
  params,
  className = '',
  label = '条件导出',
  disabled = false,
}: AssetExportButtonProps) {
  const { exporting, exportAssets } = useAssetImportExport();

  /**
   * 处理导出点击
   */
  const handleClick = async () => {
    await exportAssets(params);
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={exporting || disabled}
      className={`inline-flex items-center gap-1.5 px-4 py-2 text-sm
        rounded-lg bg-blue-600 text-white hover:bg-blue-700
        disabled:opacity-50 disabled:cursor-not-allowed
        transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500
        ${className}`}
    >
      {exporting ? (
        <Loader2 className="w-4 h-4 animate-spin" />
      ) : (
        <Download className="w-4 h-4" />
      )}
      {exporting ? '导出中...' : label}
    </button>
  );
}
