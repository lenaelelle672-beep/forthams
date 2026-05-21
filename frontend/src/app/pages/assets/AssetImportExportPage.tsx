/**
 * AssetImportExportPage — 资产批量导入导出页面
 *
 * 编排导入/导出双 Tab 页面的容器组件。
 * 导入 Tab：文件上传 → 解析预览 → 校验错误展示 → 确认提交。
 * 导出 Tab：分类/状态/位置筛选 → 条件导出。
 *
 * 组合 ImportFileDialog 和 ExportConfigDialog 两个子组件。
 * 页面级布局与 Tab 切换由本组件管理。
 *
 * @module pages/assets/AssetImportExportPage
 * @since SWARM-065
 */

import React, { useState } from 'react';
import { ImportFileDialog } from '../../components/assets/ImportFileDialog';
import { ExportConfigDialog } from '../../components/assets/ExportConfigDialog';

/* ------------------------------------------------------------------ */
/*  组件实现                                                           */
/* ------------------------------------------------------------------ */

/**
 * AssetImportExportPage — 资产批量导入导出页面
 *
 * 提供"导入"和"导出"两个 Tab：
 * - 导入 Tab：选择 .xlsx 文件上传，后端解析后展示预览表格与校验错误，
 *   用户修正后可确认提交。
 * - 导出 Tab：通过分类、状态、位置筛选后，条件导出资产列表为 Excel 文件。
 *
 * @returns React 组件
 *
 * @example
 * ```tsx
 * // 在路由中使用
 * <Route path="/assets/import-export" element={<AssetImportExportPage />} />
 * ```
 */
export default function AssetImportExportPage() {
  /** 当前激活的 Tab */
  const [activeTab, setActiveTab] = useState<'import' | 'export'>('import');

  return (
    <div
      className="container mx-auto px-4 py-8 max-w-6xl"
      data-testid="asset-import-export-page"
    >
      {/* 页面标题 */}
      <div className="mb-6">
        <h1
          className="text-2xl font-bold text-gray-900"
          role="heading"
          aria-level={1}
        >
          资产批量导入导出
        </h1>
        <p className="mt-2 text-sm text-gray-400">
          上传标准 Excel 文件批量创建资产，或按条件导出资产列表
        </p>
      </div>

      {/* Tab 切换 */}
      <div className="flex border-b border-gray-200 mb-6" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'import'}
          onClick={() => setActiveTab('import')}
          className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors
            ${
              activeTab === 'import'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-400 hover:text-gray-700'
            }`}
        >
          导入
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'export'}
          onClick={() => setActiveTab('export')}
          className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors
            ${
              activeTab === 'export'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-400 hover:text-gray-700'
            }`}
        >
          导出
        </button>
      </div>

      {/* Tab 内容 */}
      {activeTab === 'import' && <ImportFileDialog />}
      {activeTab === 'export' && <ExportConfigDialog />}
    </div>
  );
}

/**
 * Named export for compatibility
 */
export { AssetImportExportPage };
